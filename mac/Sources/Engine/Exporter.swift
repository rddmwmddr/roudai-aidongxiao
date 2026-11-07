import AVFoundation
import CoreGraphics
import Foundation
import OSLog
import WebKit

private let log = Logger(subsystem: "com.ahuamiao.datamotion", category: "export")

nonisolated enum ExportSize: String, CaseIterable, Identifiable, Sendable {
    case uhd = "4k"
    case hd = "1080p"
    var id: String { rawValue }
    var label: String { self == .uhd ? "4K（3840 × 2160）" : "1080p（1920 × 1080）" }
    var short: String { self == .uhd ? "4K" : "1080p" }
}

nonisolated struct ExportCheck: Sendable, Hashable {
    struct Row: Sendable, Hashable {
        let title: String
        let mismatched: Int
    }

    let duration: Double
    let expected: Double
    let width: Int
    let height: Int
    let rows: [Row]
    let edited: Bool

    var durationOK: Bool { abs(duration - expected) < 0.15 }
    var ok: Bool { durationOK && rows.allSatisfy { $0.mismatched == 0 } }
    var dataChecked: Bool { !rows.isEmpty }

    var summary: String {
        if !durationOK { return String(format: "时长不对：应为 %.1f 秒，实际 %.1f 秒", expected, duration) }
        let bad = rows.filter { $0.mismatched > 0 }
        if !bad.isEmpty { return "\(bad.count) 组数据和画面对不上，请看这一镜的末帧" }
        if edited { return "时长核对通过。这一镜有手动调整，不逐根核对" }
        if dataChecked { return "时长和每根、每点的颜色都核对通过" }
        return "时长核对通过"
    }
}

// 单独一个看不见的渲染页负责编码，导出时预览还能继续用
final class ExportEngine: NSObject, WKScriptMessageHandlerWithReply, WKScriptMessageHandler {
    private let stage: StageController
    private var handle: FileHandle?
    private var writeError: Error?
    private var onProgress: ((Double, Double) -> Void)?

    private var sinkInstalled = false
    private var fontsApplied = false

    override init() {
        stage = StageController()
        super.init()
    }

    var engineWeb: WKWebView { stage.web }

    func prepare() async {
        await stage.waitUntilReady()
        if !sinkInstalled {
            sinkInstalled = true
            let cc = stage.web.configuration.userContentController
            cc.addScriptMessageHandler(WeakReply(self), contentWorld: .page, name: "sink")
            cc.add(WeakProgress(self), name: "dmExport")
            _ = try? await stage.call("window.__exportPost = (m) => window.webkit.messageHandlers.dmExport.postMessage(m);")
        }
        if !fontsApplied {
            fontsApplied = true
            await FontLibrary.shared.apply(to: stage)
        }
    }

    // 写文件。position 由封装器给，文件头最后才回写，所以要能跳着写
    fileprivate func receive(_ body: Any) -> Bool {
        guard let d = body as? [String: Any], let b64 = d["b64"] as? String, let pos = (d["pos"] as? NSNumber)?.uint64Value, let data = Data(base64Encoded: b64), let handle else { return false }
        do {
            try handle.seek(toOffset: pos)
            try handle.write(contentsOf: data)
            return true
        } catch {
            writeError = error
            return false
        }
    }

    fileprivate func progress(_ body: Any) {
        guard let d = body as? [String: Any], let p = (d["p"] as? NSNumber)?.doubleValue, let sec = (d["sec"] as? NSNumber)?.doubleValue else { return }
        onProgress?(p, sec)
    }

    func cancel() {
        Task { _ = try? await stage.call("DMBridge.cancelExport()") }
    }

    // 编码写到 target，然后读回核对
    func export(_ shot: Shot, to target: URL, size: ExportSize, fps: Int, onProgress: @escaping (Double, Double) -> Void) async throws -> ExportCheck {
        await prepare()
        FileManager.default.createFile(atPath: target.path(percentEncoded: false), contents: nil)
        let h = try FileHandle(forWritingTo: target)
        handle = h
        writeError = nil
        self.onProgress = onProgress
        defer {
            try? h.close()
            handle = nil
            self.onProgress = nil
        }
        let probesJSON = try await stage.callString("return DMBridge.probes(json)", arguments: ["json": shot.json])
        let probes = try JSONDecoder().decode(ProbeInfo.self, from: Data(probesJSON.utf8))
        do {
            _ = try await withTaskCancellationHandler {
                try await stage.call(
                    """
                    return await DMBridge.exportRow(json, size, fps, (p, sec) => window.__exportPost({p, sec}));
                    """,
                    arguments: ["json": shot.json, "size": size.rawValue, "fps": fps]
                )
            } onCancel: {
                Task { @MainActor [weak self] in self?.cancel() }
            }
        } catch {
            try? FileManager.default.removeItem(at: target)
            if Task.isCancelled { throw CancellationError() }
            throw error
        }
        if let writeError {
            try? FileManager.default.removeItem(at: target)
            throw writeError
        }
        try h.synchronize()
        try h.close()
        handle = nil
        return try await ExportVerifier.verify(url: target, probes: probes)
    }

    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping @MainActor @Sendable (Any?, String?) -> Void) {
        replyHandler(receive(message.body) ? true : nil, nil)
    }

    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        progress(message.body)
    }
}

private final class WeakReply: NSObject, WKScriptMessageHandlerWithReply {
    weak var target: ExportEngine?
    init(_ t: ExportEngine) { target = t }
    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping @MainActor @Sendable (Any?, String?) -> Void) {
        let ok = target?.receive(message.body) ?? false
        replyHandler(ok ? true : nil, ok ? nil : "写文件失败")
    }
}

private final class WeakProgress: NSObject, WKScriptMessageHandler {
    weak var target: ExportEngine?
    init(_ t: ExportEngine) { target = t }
    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.progress(message.body)
    }
}

nonisolated struct ProbeInfo: Decodable, Sendable {
    struct Shade: Decodable, Sendable {
        let name: String
        let rgb: [Double]
    }

    struct Row: Decodable, Sendable {
        let title: String
        let points: [[Double]]
        let expect: [String?]
    }

    let duration: Double
    let edited: Bool
    let shades: [Shade]
    let rows: [Row]
}

// 读回成片：时长、尺寸、末帧逐根逐点的颜色
nonisolated enum ExportVerifier {
    enum VerifyError: LocalizedError {
        case noVideo
        var errorDescription: String? { "导出的文件里没有视频轨道。请重新导出这一镜。" }
    }

    static func verify(url: URL, probes: ProbeInfo) async throws -> ExportCheck {
        let asset = AVURLAsset(url: url)
        let duration = try await asset.load(.duration).seconds
        guard let track = try await asset.loadTracks(withMediaType: .video).first else { throw VerifyError.noVideo }
        let size = try await track.load(.naturalSize)
        var rows: [ExportCheck.Row] = []
        if !probes.rows.isEmpty {
            let generator = AVAssetImageGenerator(asset: asset)
            generator.requestedTimeToleranceAfter = .zero
            generator.requestedTimeToleranceBefore = .zero
            generator.appliesPreferredTrackTransform = true
            let at = CMTime(seconds: max(0, duration - 0.2), preferredTimescale: 600)
            let (image, _) = try await generator.image(at: at)
            rows = classify(image: image, probes: probes)
        }
        return ExportCheck(duration: duration, expected: probes.duration, width: Int(size.width), height: Int(size.height), rows: rows, edited: probes.edited)
    }

    static func classify(image: CGImage, probes: ProbeInfo) -> [ExportCheck.Row] {
        let w = image.width
        let h = image.height
        var pixels = [UInt8](repeating: 0, count: w * h * 4)
        let space = CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB()
        pixels.withUnsafeMutableBytes { raw in
            guard let ctx = CGContext(data: raw.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4, space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return }
            ctx.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
        }
        let k = Double(w) / 1920
        return probes.rows.map { row in
            var miss = 0
            for (i, p) in row.points.enumerated() where i < row.expect.count {
                guard let want = row.expect[i], p.count == 2 else { continue }
                let x = min(w - 1, max(0, Int((p[0] * k).rounded())))
                let y = min(h - 1, max(0, Int((p[1] * k).rounded())))
                let o = (y * w + x) * 4
                let r = Double(pixels[o])
                let g = Double(pixels[o + 1])
                let b = Double(pixels[o + 2])
                var best = ""
                var bestD = Double.infinity
                for s in probes.shades where s.rgb.count == 3 {
                    let d = pow(r - s.rgb[0], 2) + pow(g - s.rgb[1], 2) + pow(b - s.rgb[2], 2)
                    if d < bestD {
                        bestD = d
                        best = s.name
                    }
                }
                if best != want { miss += 1 }
            }
            return ExportCheck.Row(title: row.title, mismatched: miss)
        }
    }
}

// ---------- 批量 ----------
final class BatchRunner: ObservableObject {
    enum Status: Equatable {
        case waiting, running(Double), done(String), skipped, failed(String), cancelled
    }

    struct Item: Identifiable {
        let shot: Shot
        let fileName: String
        var status: Status = .waiting
        var id: Int { shot.id }
    }

    @Published private(set) var items: [Item] = []
    @Published private(set) var isRunning = false
    @Published private(set) var finished = false
    @Published private(set) var etaText = ""
    @Published private(set) var folder: URL?
    @Published private(set) var file: URL?
    private var task: Task<Void, Never>?
    private let engine = ExportEngine()

    static func fileName(for shot: Shot, templateName: String, size: ExportSize, fps: Int) -> String {
        let bad = CharacterSet(charactersIn: "/\\:*?\"<>|\n\r")
        let clean = templateName.components(separatedBy: bad).joined()
        return "\(shot.no)_\(clean)_\(size.short)\(fps).mp4"
    }

    var total: Int { items.count }
    var doneCount: Int { items.filter { if case .done = $0.status { true } else { false } }.count }
    var skippedCount: Int { items.filter { $0.status == .skipped }.count }
    var failedCount: Int { items.filter { if case .failed = $0.status { true } else { false } }.count }

    var fraction: Double {
        guard !items.isEmpty else { return 0 }
        let sum = items.reduce(0.0) { acc, item in
            switch item.status {
            case .running(let p): acc + p
            case .done, .skipped, .failed: acc + 1
            default: acc
            }
        }
        return sum / Double(items.count)
    }

    func start(shots: [Shot], names: [String: String], folder: URL, size: ExportSize, fps: Int) {
        guard !isRunning else { return }
        self.folder = folder
        items = shots.map { Item(shot: $0, fileName: Self.fileName(for: $0, templateName: names[$0.template] ?? $0.template, size: size, fps: fps)) }
        finished = false
        isRunning = true
        task = Task { await run(folder: folder, size: size, fps: fps) }
    }

    // 只导一镜：写到用户选的文件。沙盒只放行那一个路径，不能先写临时名字
    func start(shot: Shot, file: URL, size: ExportSize, fps: Int) {
        guard !isRunning else { return }
        self.file = file
        folder = nil
        items = [Item(shot: shot, fileName: file.lastPathComponent)]
        finished = false
        isRunning = true
        task = Task { await runOne(to: file, size: size, fps: fps) }
    }

    func cancel() {
        task?.cancel()
        engine.cancel()
    }

    func reset() {
        items = []
        finished = false
        folder = nil
        file = nil
    }

    var progressLine: String {
        "\(doneCount + skippedCount + failedCount) / \(total)  \(etaText)"
    }

    var resultLine: String {
        var parts = ["完成 \(doneCount)"]
        if skippedCount > 0 { parts.append("跳过 \(skippedCount)") }
        if failedCount > 0 { parts.append("失败 \(failedCount)") }
        return parts.joined(separator: "，")
    }

    private func runOne(to url: URL, size: ExportSize, fps: Int) async {
        defer {
            isRunning = false
            finished = true
        }
        items[0].status = .running(0)
        do {
            let check = try await engine.export(items[0].shot, to: url, size: size, fps: fps) { [weak self] p, _ in
                self?.items[0].status = .running(p)
            }
            items[0].status = .done(check.summary)
        } catch {
            if error is CancellationError || Task.isCancelled {
                items[0].status = .cancelled
            } else {
                let text = Self.describe(error)
                items[0].status = .failed(text.contains("编码") ? "\(text)。换成 1080p 或关掉其他占用显卡的程序再试。" : text)
            }
        }
    }

    private func run(folder: URL, size: ExportSize, fps: Int) async {
        let accessing = folder.startAccessingSecurityScopedResource()
        defer {
            if accessing { folder.stopAccessingSecurityScopedResource() }
            isRunning = false
            finished = true
            etaText = ""
        }
        // 批量经常在后台跑，告诉系统不要因为窗口不在前台就降速
        let activity = ProcessInfo.processInfo.beginActivity(options: [.userInitiated, .idleSystemSleepDisabled], reason: "批量导出动效")
        defer { ProcessInfo.processInfo.endActivity(activity) }
        var csv = "序号,章节,动效,口播,文件,状态,核对,时长秒\n"
        let startAll = Date()
        var encodedSeconds = 0.0
        var producedSeconds = 0.0
        var index = 0
        while index < items.count {
            let i = index
            index += 1
            if Task.isCancelled {
                items[i].status = .cancelled
                continue
            }
            let item = items[i]
            let url = folder.appending(path: item.fileName)
            if FileManager.default.fileExists(atPath: url.path(percentEncoded: false)) {
                items[i].status = .skipped
                csv += line(item, status: "已有，跳过", check: "", duration: "")
                continue
            }
            // 先写到临时名字，中途断了不会留下一个看起来完整的文件。扩展名留 mp4，读回核对时系统靠它认格式
            let part = folder.appending(path: "写入中_" + item.fileName)
            items[i].status = .running(0)
            do {
                let check = try await engine.export(item.shot, to: part, size: size, fps: fps) { [weak self] p, sec in
                    guard let self else { return }
                    self.items[i].status = .running(p)
                    let remaining = self.estimate(elapsedOnShot: sec, p: p, encoded: encodedSeconds, produced: producedSeconds, from: i)
                    self.etaText = remaining
                }
                try FileManager.default.moveItem(at: part, to: url)
                encodedSeconds = Date().timeIntervalSince(startAll)
                producedSeconds += check.duration
                items[i].status = .done(check.summary)
                csv += line(item, status: "完成", check: check.summary, duration: String(format: "%.1f", check.duration))
            } catch is CancellationError {
                try? FileManager.default.removeItem(at: part)
                items[i].status = .cancelled
            } catch {
                try? FileManager.default.removeItem(at: part)
                if Task.isCancelled {
                    items[i].status = .cancelled
                    continue
                }
                let text = Self.describe(error)
                log.error("导出失败 \(item.shot.no, privacy: .public): \(text, privacy: .public)")
                items[i].status = .failed(text)
                csv += line(item, status: "失败", check: text, duration: "")
            }
        }
        try? Data(("\u{FEFF}" + csv).utf8).write(to: folder.appending(path: "输出清单.csv"))
    }

    static func describe(_ error: Error) -> String {
        if let wk = error as? WKError, let message = wk.userInfo["WKJavaScriptExceptionMessage"] as? String {
            return message.replacingOccurrences(of: "Error: ", with: "")
        }
        return error.localizedDescription
    }

    private func estimate(elapsedOnShot sec: Double, p: Double, encoded: Double, produced: Double, from i: Int) -> String {
        guard p > 0.02 else { return etaText }
        let thisTotal = sec / p
        let left = thisTotal - sec
        let rest = Double(items.count - i - 1)
        let avg = i > 0 ? encoded / Double(i) : thisTotal
        let seconds = left + rest * avg
        if seconds < 60 { return "还要约 \(Int(seconds.rounded())) 秒" }
        return "还要约 \(Int((seconds / 60).rounded(.up))) 分钟"
    }

    private func line(_ item: Item, status: String, check: String, duration: String) -> String {
        let f = { (s: String) in "\"\(s.replacingOccurrences(of: "\"", with: "\"\""))\"" }
        return [item.shot.no, f(item.shot.chapter), f(item.shot.template), f(String(item.shot.line.prefix(60))), f(item.fileName), status, f(check), duration].joined(separator: ",") + "\n"
    }
}
