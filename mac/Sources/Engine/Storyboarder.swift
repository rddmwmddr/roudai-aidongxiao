import Foundation

// 文稿 → 分镜。规则版离线，AI 版把文稿发给所选服务。界面只读这里的状态
final class Storyboarder: ObservableObject {
    enum Engine: Hashable {
        case rules
        case ai(UUID)
    }

    struct Output {
        var source: String
        var title: String?
        var rows: [Shot]
        var warnings: [String]
        /// 已有分镜时只对时长，字和效果都不动
        var timingOnly = false
    }

    @Published var engine: Engine = .rules
    @Published private(set) var running = false
    @Published private(set) var fraction = 0.0
    @Published private(set) var progress = ""
    @Published private(set) var errorText: String?
    @Published private(set) var warnings: [String] = []
    private var job: Task<Void, Never>?
    private let settings = AISettings.shared

    var profile: AIProfile? {
        if case .ai(let id) = engine { return settings.profiles.first { $0.id == id } }
        return nil
    }

    // AI 编导优先，离线规则兜底：没手动锁定规则时，优先选填了 Key 的 AI 服务
    func pickEngine() {
        if !settings.useRules {
            if let active = settings.active, let k = settings.key(for: active), !k.isEmpty {
                engine = .ai(active.id)
                return
            }
            if let ready = settings.profiles.first(where: { (settings.key(for: $0) ?? "").isEmpty == false }) {
                engine = .ai(ready.id)
                return
            }
        }
        engine = .rules
    }

    func choose(_ next: Engine) {
        engine = next
        if case .ai(let id) = next {
            settings.activeID = id
            settings.useRules = false
        } else {
            settings.useRules = true
        }
    }

    func stop() {
        job?.cancel()
    }

    func clearMessages() {
        errorText = nil
        warnings = []
    }

    func start(source: String, stage: StageController, onDone: @escaping (Output) -> Void) {
        guard !running else { return }
        clearMessages()
        running = true
        fraction = 0
        progress = "开始…"
        let chosen = profile
        job = Task {
            defer { running = false }
            do {
                let output: Output
                if let chosen {
                    output = try await runAI(source: source, profile: chosen, stage: stage)
                } else {
                    output = try await runRules(source: source, stage: stage)
                }
                try Task.checkCancellation()
                warnings = output.warnings
                onDone(output)
            } catch is CancellationError {
                errorText = "已停止"
            } catch {
                errorText = error.localizedDescription
            }
        }
    }

    // 导入 A-roll。有分镜：字和效果不动，只把时长对到声音上。有文稿：字用文稿，时长用声音。什么都没有：字也用识别的
    func startARoll(url: URL, script: String, rows: [Shot], stage: StageController, onDone: @escaping (Output) -> Void) {
        guard !running else { return }
        clearMessages()
        running = true
        fraction = 0
        progress = "正在读取 A-roll…"
        let chosen = profile
        let title = url.deletingPathExtension().lastPathComponent
        job = Task {
            defer { running = false }
            do {
                let transcript = try await ARollTranscriber.transcribe(url) { value in
                    Task { @MainActor in
                        self.fraction = value
                        self.progress = "正在识别 \(Int(value * 100))%"
                    }
                }
                try Task.checkCancellation()
                let spoken = ARollText.script(from: transcript.tokens)
                let hasScript = !script.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                var output: Output
                if !rows.isEmpty {
                    output = Output(source: script, title: nil, rows: rows, warnings: [], timingOnly: true)
                } else {
                    let source = hasScript ? script : spoken
                    output = chosen != nil
                        ? try await runAI(source: source, profile: chosen!, stage: stage)
                        : try await runRules(source: source, stage: stage, sentences: true)
                    output.title = title
                }
                let result = ARollAligner.align(lines: output.rows.map(\.line), tokens: transcript.tokens, duration: transcript.duration)
                // 字是识别出来的不会对不上；外面的文稿、分镜对上太少，多半是选错了文件，不动它
                if rows.isEmpty == false || hasScript, result.total > 0, Double(result.matched) / Double(result.total) < 0.3 {
                    throw ARollError.mismatch(matched: result.matched, total: result.total)
                }
                for i in output.rows.indices {
                    output.rows[i].duration = result.durations[i]
                }
                try Task.checkCancellation()
                warnings = output.warnings
                onDone(output)
            } catch is CancellationError {
                errorText = "已停止"
            } catch {
                errorText = error.localizedDescription
            }
        }
    }

    private func runRules(source: String, stage: StageController, sentences: Bool = false) async throws -> Output {
        progress = "正在拆分…"
        let json = try await stage.callString("return DMBridge.autoboard(text, null, sentences)", arguments: ["text": source, "sentences": sentences])
        struct Reply: Decodable {
            let title: String
            let rows: [Shot]
        }
        let reply = try JSONDecoder().decode(Reply.self, from: Data(json.utf8))
        fraction = 1
        return Output(source: source, title: reply.title, rows: reply.rows, warnings: [])
    }

    private func runAI(source: String, profile: AIProfile, stage: StageController) async throws -> Output {
        guard let key = settings.key(for: profile), !key.isEmpty else { throw AIError.missingKey(profile.name) }
        let client = AIClient(profile: profile, apiKey: key)
        let chunks = StoryboardPrompt.chunks(of: source)
        let library = (try? await stage.callString("return DMBridge.libraryPrompt()")) ?? ""
        var all: [Shot] = []
        var warnings: [String] = []
        let total = max(1, chunks.count)
        var doneShots = 0

        for (i, chunk) in chunks.enumerated() {
            try Task.checkCancellation()
            let chapterName = chunk.chapter
            let baseShots = doneShots
            let maxTotalChars = max(24000, chunk.text.count * 14)
            let prevSummary: String = {
                guard !all.isEmpty else { return "" }
                let recent = all.suffix(3).map { "\($0.trackLabel)(\($0.isMotion ? $0.template : $0.shotSize)):\($0.line.prefix(18))…" }.joined(separator: " → ")
                let usedTpls = Array(Set(all.filter(\.isMotion).map(\.template))).sorted().joined(separator: "、")
                return "前段收尾镜头：\(recent)" + (usedTpls.isEmpty ? "" : "；前文已用动效：\(usedTpls)")
            }()
            progress = total > 1 ? "第 \(i + 1)/\(total) 段（\(chapterName)）：等待 \(profile.name)…" : "等待 \(profile.name) 编导分镜…"
            fraction = Double(i) / Double(total)
            do {
                let reply = try await client.generateStream(system: StoryboardPrompt.system + library, user: StoryboardPrompt.userMessage(chapter: chapterName, text: chunk.text, previousSummary: prevSummary), schema: StoryboardPrompt.schema) { partial in
                    let st = StoryboardPrompt.streamStatus(partial: partial, source: chunk.text)
                    // 连续超过 4500 字符没出新镜头，或总输出远超文稿正常比例：判定模型重复死循环，立即熔断
                    if st.trailingChars > 4500 || partial.count > maxTotalChars {
                        throw AIError.truncated
                    }
                    Task { @MainActor in
                        let overall = (Double(i) + st.fraction) / Double(total)
                        if overall > self.fraction { self.fraction = min(0.98, overall) }
                        let countNow = baseShots + st.shots
                        if countNow > 0 {
                            self.progress = total > 1 ? "第 \(i + 1)/\(total) 段：已拆 \(countNow) 镜" : "正在分镜：已拆 \(countNow) 镜"
                        } else {
                            self.progress = total > 1 ? "第 \(i + 1)/\(total) 段（\(chapterName)）：思考中…" : "正在构思分镜…"
                        }
                    }
                }
                let decoded = try StoryboardPrompt.decodeRows(reply, chapter: chapterName)
                doneShots += decoded.count
                all += decoded
                fraction = Double(i + 1) / Double(total) * 0.98
            } catch let e as AIError {
                switch e {
                case .unauthorized, .missingKey, .missingModel, .badURL:
                    throw e
                default:
                    let fallback = try await runRules(source: "\(chunk.chapter)\n\(chunk.text)", stage: stage)
                    doneShots += fallback.rows.count
                    all += fallback.rows
                    warnings.append("第 \(i + 1) 段（\(chunk.chapter)）AI 输出超长或未完成，已用规则版：\(e.localizedDescription)")
                }
            } catch is CancellationError {
                throw CancellationError()
            } catch {
                let fallback = try await runRules(source: "\(chunk.chapter)\n\(chunk.text)", stage: stage)
                doneShots += fallback.rows.count
                all += fallback.rows
                warnings.append("第 \(i + 1) 段（\(chunk.chapter)）网络未连通，已用离线规则版：\(error.localizedDescription)")
            }
        }
        progress = "正在核对数字和原文…"
        fraction = 0.99
        let rowsData = try JSONEncoder().encode(all)
        let json = try await stage.callString("return DMBridge.reviewRows(rows, source)", arguments: ["rows": String(decoding: rowsData, as: UTF8.self), "source": source])
        struct Review: Decodable {
            let rows: [Shot]
            let coverage: Double
            let flagged: Int
        }
        let review = try JSONDecoder().decode(Review.self, from: Data(json.utf8))
        fraction = 1
        if review.flagged > 0 { warnings.append("\(review.flagged) 镜 AI 的结果用不了，已换成规则版，都标了「要确认」。") }
        if review.coverage < 0.97 { warnings.append("文稿里约 \(Int((1 - review.coverage) * 100))% 的文字没有进分镜，请对照检查。") }
        return Output(source: source, title: nil, rows: review.rows, warnings: warnings)
    }
}
