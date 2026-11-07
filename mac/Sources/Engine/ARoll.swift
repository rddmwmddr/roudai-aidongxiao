import AVFoundation
import Foundation
import Speech
import UniformTypeIdentifiers

// A-roll：口播的视频或音频。在本机识别，声音和文字都不离开这台电脑。
// 三件事分开：读声音、认字（ARollTranscriber），断句（ARollText），把每一镜对到声音上（ARollAligner）。后两件没有系统依赖，单元测试直接测

nonisolated struct ARollToken: Sendable, Equatable {
    var text: String
    var start: Double
    var end: Double
}

nonisolated struct ARollTranscript: Sendable, Equatable {
    var tokens: [ARollToken]
    var duration: Double
}

nonisolated enum ARollError: LocalizedError {
    case needsNewerSystem
    case unsupportedLanguage
    case noAudio(String)
    case noSpeech(String)
    case mismatch(matched: Int, total: Int)

    var errorDescription: String? {
        switch self {
        case .needsNewerSystem: "识别 A-roll 需要 macOS 26 或更高版本。"
        case .unsupportedLanguage: "这台电脑不支持识别中文语音。"
        case .noAudio(let name): "「\(name)」里没有声音。"
        case .noSpeech(let name): "「\(name)」里没有识别到说话。"
        case .mismatch(let matched, let total): "这段 A-roll 和文稿对不上：\(total) 镜里只对上 \(matched) 镜，没有改动。"
        }
    }
}

nonisolated enum ARollImporter {
    static let contentTypes: [UTType] = [.movie, .audio]

    static func handles(_ url: URL) -> Bool {
        guard let type = UTType(filenameExtension: url.pathExtension) else { return false }
        return type.conforms(to: .movie) || type.conforms(to: .audio)
    }
}

// ---------- 断句 ----------
// 识别结果几乎没有标点，一段话连成一片。逐字的时间里有停顿：停了的那个字时长明显偏长，从这里断
nonisolated enum ARollText {
    private static let enders: Set<Character> = ["。", "！", "？", "!", "?", "；", ";"]
    private static let commas: Set<Character> = ["，", ",", "、", "：", ":"]

    private static func isPunctuation(_ s: String) -> Bool {
        !s.isEmpty && s.allSatisfy { enders.contains($0) || commas.contains($0) }
    }

    private static func isSingleHan(_ s: String) -> Bool {
        guard s.count == 1, let scalar = s.unicodeScalars.first else { return false }
        return (0x3400...0x9FFF).contains(scalar.value)
    }

    static func script(from tokens: [ARollToken]) -> String {
        let lengths = tokens
            .map { ($0.text.trimmingCharacters(in: .whitespaces), $0.end - $0.start) }
            .filter { isSingleHan($0.0) }
            .map(\.1)
            .sorted()
        let median = lengths.isEmpty ? 0.2 : lengths[lengths.count / 2]
        let pause = max(0.38, median * 2.2)
        var out = ""
        var clause = 0
        for token in tokens {
            let text = token.text.trimmingCharacters(in: .whitespaces)
            guard !text.isEmpty else { continue }
            if isPunctuation(text) {
                if let last = out.last, enders.contains(last) || commas.contains(last) { continue }
                out += text
                clause = 0
                continue
            }
            if clause >= 1, isSingleHan(text), token.end - token.start > pause {
                // 两到五个字的是半句话，用逗号接上；单独一个字（「会。」）和长的都是整句
                out += clause >= 6 || clause == 1 ? "。" : "，"
                clause = 0
            }
            out += text
            clause += text.count
        }
        if let last = out.last, !enders.contains(last) {
            if commas.contains(last) { out.removeLast() }
            out += "。"
        }
        return out
    }
}

// ---------- 对时间 ----------
// 每一镜的口播在声音里从哪开始。文稿和识别结果不会一字不差（错字、数字写法），所以取一小段字去找，不要求整句相同。
// 按顺序往后找，找不到的按字数插在前后两镜之间。相邻两镜的开始时间相减就是时长，全片加起来正好是 A-roll 的长度
nonisolated enum ARollAligner {
    struct Result: Equatable {
        var durations: [Double?]
        var matched: Int
        var total: Int
    }

    private static func normalized(_ text: String) -> [Character] {
        text.lowercased().filter { $0.isLetter || $0.isNumber }.map { $0 }
    }

    private static func find(_ gram: ArraySlice<Character>, in chars: [Character], from: Int, to: Int) -> Int? {
        guard !gram.isEmpty, to - from >= gram.count else { return nil }
        var i = from
        while i <= to - gram.count {
            if chars[i] == gram.first, chars[i..<(i + gram.count)].elementsEqual(gram) { return i }
            i += 1
        }
        return nil
    }

    static func align(lines: [String], tokens: [ARollToken], duration: Double) -> Result {
        var chars: [Character] = []
        var times: [Double] = []
        for token in tokens {
            let piece = normalized(token.text)
            for (i, ch) in piece.enumerated() {
                chars.append(ch)
                times.append(token.start + (token.end - token.start) * Double(i) / Double(piece.count))
            }
        }
        let parts = lines.map(normalized)
        var starts: [Double?] = Array(repeating: nil, count: parts.count)
        var cursor = 0
        var matched = 0
        var total = 0
        for (index, line) in parts.enumerated() where !line.isEmpty {
            total += 1
            let from = max(0, cursor - 30)
            let to = min(chars.count, cursor + line.count * 2 + 120)
            var found: Int?
            // 先用长一点的片段，错字躲不开就往后挪几个字再试
            search: for length in [8, 6, 5, 3] where length <= line.count {
                for offset in 0...min(6, line.count - length) {
                    if let at = find(line[offset..<(offset + length)], in: chars, from: from, to: to) {
                        found = max(0, at - offset)
                        break search
                    }
                }
            }
            if let found, found < times.count {
                starts[index] = times[found]
                matched += 1
                cursor = found + line.count
            } else {
                cursor += line.count
            }
        }
        // 找到的镜头是锚点，第一镜从 0 开始，最后到声音结束。相邻两个锚点之间按字数分配
        var anchors: [(index: Int, time: Double)] = [(0, 0)]
        for (index, start) in starts.enumerated() where index > 0 {
            if let start, start >= anchors[anchors.count - 1].time { anchors.append((index, start)) }
        }
        anchors.append((parts.count, duration))
        var filled: [Double] = Array(repeating: 0, count: parts.count)
        for (a, b) in zip(anchors, anchors.dropFirst()) where a.index < b.index {
            let weights = parts[a.index..<b.index].map { Double($0.count) }
            let sum = max(1, weights.reduce(0, +))
            var t = a.time
            for (k, w) in weights.enumerated() {
                filled[a.index + k] = t
                t += (b.time - a.time) * w / sum
            }
        }
        var durations: [Double?] = Array(repeating: nil, count: parts.count)
        for k in parts.indices where !parts[k].isEmpty {
            let next = k + 1 < parts.count ? filled[k + 1] : duration
            durations[k] = max(0.5, ((next - filled[k]) * 100).rounded() / 100)
        }
        return Result(durations: durations, matched: matched, total: total)
    }
}

// ---------- 读声音、认字 ----------
nonisolated enum ARollTranscriber {
    /// onProgress 是 0 到 1。读声音占一成，认字占九成
    static func transcribe(_ url: URL, onProgress: @escaping @Sendable (Double) -> Void) async throws -> ARollTranscript {
        guard #available(macOS 26, *) else { throw ARollError.needsNewerSystem }
        let accessing = url.startAccessingSecurityScopedResource()
        defer { if accessing { url.stopAccessingSecurityScopedResource() } }
        let name = url.lastPathComponent
        let (audio, duration) = try await extractAudio(from: url, name: name) { onProgress($0 * 0.1) }
        defer { try? FileManager.default.removeItem(at: audio) }
        let tokens = try await recognize(audio, duration: duration) { onProgress(0.1 + $0 * 0.9) }
        guard tokens.contains(where: { !$0.text.trimmingCharacters(in: .whitespaces).isEmpty }) else { throw ARollError.noSpeech(name) }
        return ARollTranscript(tokens: tokens, duration: duration)
    }

    // 不管是视频还是音频，先抽成 16k 单声道 PCM，临时放一下，识别完就删
    private static func extractAudio(from url: URL, name: String, onProgress: @escaping @Sendable (Double) -> Void) async throws -> (URL, Double) {
        let asset = AVURLAsset(url: url)
        guard let track = try await asset.loadTracks(withMediaType: .audio).first else { throw ARollError.noAudio(name) }
        let duration = try await asset.load(.duration).seconds
        let settings: [String: Any] = [
            AVFormatIDKey: kAudioFormatLinearPCM,
            AVSampleRateKey: 16000,
            AVNumberOfChannelsKey: 1,
            AVLinearPCMBitDepthKey: 16,
            AVLinearPCMIsFloatKey: false,
            AVLinearPCMIsBigEndianKey: false,
            AVLinearPCMIsNonInterleaved: false,
        ]
        let reader = try AVAssetReader(asset: asset)
        let output = AVAssetReaderTrackOutput(track: track, outputSettings: settings)
        reader.add(output)
        guard reader.startReading() else { throw reader.error ?? ARollError.noAudio(name) }
        guard let format = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 16000, channels: 1, interleaved: true) else { throw ARollError.noAudio(name) }
        let target = FileManager.default.temporaryDirectory.appending(path: "aroll-\(UUID().uuidString).caf")
        do {
            let file = try AVAudioFile(forWriting: target, settings: format.settings, commonFormat: .pcmFormatInt16, interleaved: true)
            var frames = 0
            while let sample = output.copyNextSampleBuffer() {
                try Task.checkCancellation()
                let count = CMSampleBufferGetNumSamples(sample)
                guard count > 0, let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(count)) else { continue }
                buffer.frameLength = AVAudioFrameCount(count)
                let status = CMSampleBufferCopyPCMDataIntoAudioBufferList(sample, at: 0, frameCount: Int32(count), into: buffer.mutableAudioBufferList)
                guard status == noErr else { continue }
                try file.write(from: buffer)
                frames += count
                if duration > 0 { onProgress(min(1, Double(frames) / 16000 / duration)) }
            }
        } catch {
            try? FileManager.default.removeItem(at: target)
            throw error
        }
        if reader.status == .failed {
            try? FileManager.default.removeItem(at: target)
            throw reader.error ?? ARollError.noAudio(name)
        }
        return (target, duration)
    }

    @available(macOS 26, *)
    private static func recognize(_ audio: URL, duration: Double, onProgress: @escaping @Sendable (Double) -> Void) async throws -> [ARollToken] {
        guard SpeechTranscriber.isAvailable else { throw ARollError.needsNewerSystem }
        guard let locale = await SpeechTranscriber.supportedLocale(equivalentTo: Locale(identifier: "zh_CN")) else { throw ARollError.unsupportedLanguage }
        let transcriber = SpeechTranscriber(locale: locale, transcriptionOptions: [], reportingOptions: [], attributeOptions: [.audioTimeRange])
        // 这台电脑还没有中文模型时，系统下载一次
        if let install = try await AssetInventory.assetInstallationRequest(supporting: [transcriber]) {
            try await install.downloadAndInstall()
        }
        let analyzer = SpeechAnalyzer(modules: [transcriber])
        let context = AnalysisContext()
        context.contextualStrings[.general] = ["AI", "重构调研"]
        try await analyzer.setContext(context)
        let collector = Task { () -> [ARollToken] in
            var tokens: [ARollToken] = []
            for try await result in transcriber.results {
                for run in result.text.runs {
                    guard let range = run.audioTimeRange else { continue }
                    tokens.append(ARollToken(text: String(result.text[run.range].characters), start: range.start.seconds, end: range.end.seconds))
                }
                if duration > 0, let last = tokens.last { onProgress(min(1, last.end / duration)) }
            }
            return tokens
        }
        let file = try AVAudioFile(forReading: audio)
        try await withTaskCancellationHandler {
            if let last = try await analyzer.analyzeSequence(from: file) {
                try await analyzer.finalizeAndFinish(through: last)
            } else {
                await analyzer.cancelAndFinishNow()
            }
        } onCancel: {
            Task { await analyzer.cancelAndFinishNow() }
        }
        let tokens = try await collector.value
        try Task.checkCancellation()
        return tokens
    }
}
