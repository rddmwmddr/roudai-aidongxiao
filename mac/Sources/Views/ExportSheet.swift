import AppKit
import SwiftUI
import UniformTypeIdentifiers

// 导出面板：默认只导出动效镜 MP4（可勾选连构图示意一起导出全片动态预演），也支持一键导出离线《分镜板与拍摄清单 HTML》
struct ExportSheet: View {
    enum Scope: Hashable {
        case current, visible, all, picked
    }

    enum Format: String, CaseIterable, Identifiable {
        case mp4
        case storyboardHTML
        var id: String { rawValue }
    }

    let board: Board
    let current: Shot?
    let visible: [Shot]
    let picked: Set<Shot.ID>
    let names: [String: String]
    let stage: StageController?
    let initialFormat: Format
    /// 选保存位置。测试不弹系统面板，直接给一个地址
    let destination: ((_ singleFileName: String?) -> URL?)?
    let onFix: ((Shot.ID) -> Void)?
    @Environment(\.dismiss) private var dismiss
    @AppStorage("export.size") private var sizeRaw = ExportSize.hd.rawValue
    @AppStorage("export.fps") private var fps = 60
    @State private var scope: Scope
    @State private var format: Format
    @State private var includeSketch = false
    @State private var issues: [Shot.ID: String]?
    @State private var checkFailed = false
    @State private var htmlWriting = false
    @State private var htmlFraction = 0.0
    @State private var htmlDoneURL: URL?
    @State private var htmlError: String?
    @StateObject private var runner = BatchRunner()

    init(
        board: Board,
        current: Shot?,
        visible: [Shot],
        picked: Set<Shot.ID>,
        names: [String: String],
        stage: StageController? = nil,
        initialFormat: Format = .mp4,
        destination: ((String?) -> URL?)? = nil,
        onFix: ((Shot.ID) -> Void)? = nil
    ) {
        self.board = board
        self.current = current
        self.visible = visible
        self.picked = picked
        self.names = names
        self.stage = stage
        self.initialFormat = initialFormat
        self.destination = destination
        self.onFix = onFix
        _format = State(initialValue: initialFormat)
        _scope = State(initialValue: initialFormat == .storyboardHTML ? .all : (picked.count >= 2 ? .picked : current != nil ? .current : .all))
    }

    private struct CheckKey: Hashable {
        let rows: [Shot]
        let revision: Int
    }

    private var size: ExportSize { ExportSize(rawValue: sizeRaw) ?? .uhd }

    private func base(_ s: Scope) -> [Shot] {
        switch s {
        case .current: current.map { [$0] } ?? []
        case .visible: visible
        case .all: board.rows
        case .picked: board.rows.filter { picked.contains($0.id) }
        }
    }

    private func mp4Candidates(_ s: Scope) -> [Shot] {
        let pool = base(s)
        if s == .current { return pool }
        return pool.filter { $0.isMotion || includeSketch }
    }

    private func exportable(_ s: Scope) -> [Shot] {
        if format == .storyboardHTML { return base(s) }
        return mp4Candidates(s).filter { issue(for: $0) == nil }
    }

    private func issue(for shot: Shot) -> String? {
        if let reason = issues?[shot.id] { return reason }
        if shot.usesSampleData { return "正在使用样例数据，请核对并确认当前数据" }
        if shot.isPending { return "数据待确认，请核对并确认当前数据" }
        return nil
    }

    private var nonMotionCount: Int {
        guard format == .mp4, scope != .current else { return 0 }
        return base(scope).filter { !$0.isMotion }.count
    }

    private var checking: Bool { format == .mp4 && stage != nil && issues == nil && !checkFailed }

    private var blocked: [Shot] {
        guard format == .mp4 else { return [] }
        return mp4Candidates(scope).filter { issue(for: $0) != nil }
    }

    private var failedAlone: String? {
        if let htmlError { return htmlError }
        if runner.items.count == 1, !runner.isRunning, case .failed(let text) = runner.items[0].status { return text }
        return nil
    }

    private var showsForm: Bool {
        (runner.items.isEmpty && htmlDoneURL == nil && !htmlWriting) || failedAlone != nil
    }

    private var isBusy: Bool {
        runner.isRunning || htmlWriting
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if showsForm {
                Form {
                    if stage != nil {
                        Picker("类型", selection: $format) {
                            Text("视频素材（MP4）").tag(Format.mp4)
                            Text("分镜与拍摄清单（HTML）").tag(Format.storyboardHTML)
                        }
                    }
                    Picker("范围", selection: $scope) {
                        if current != nil {
                            Text("这一镜").tag(Scope.current)
                        }
                        if visible.count < board.rows.count {
                            Text("当前列表 \(base(.visible).count)").tag(Scope.visible)
                        }
                        Text("全部 \(base(.all).count)").tag(Scope.all)
                        if !picked.isEmpty {
                            Text("选中的 \(base(.picked).count)").tag(Scope.picked)
                        }
                    }
                    if format == .mp4 {
                        if base(scope).contains(where: { $0.fields["motion"] != nil }) {
                            Text("调研动效按项目中保存的画面尺寸与帧率导出，请在右侧「画面与帧率」修改。")
                        }
                        Picker(base(scope).contains(where: { $0.fields["motion"] != nil }) ? "分辨率（其他模板）" : "分辨率", selection: $sizeRaw) {
                            ForEach(ExportSize.allCases) { s in Text(s.label).tag(s.rawValue) }
                        }
                        Picker("帧率", selection: $fps) {
                            Text("60").tag(60)
                            Text("30").tag(30)
                        }
                    }
                }
                .formStyle(.columns)
                if format == .mp4, scope != .current, nonMotionCount > 0 {
                    Toggle("连 A-roll / 实拍 / 素材构图示意一起导成动态预演（\(nonMotionCount) 镜）", isOn: $includeSketch)
                        .named("包含构图示意")
                }
                if checking {
                    ProgressView("正在检查镜头…").controlSize(.small)
                } else if format == .mp4, checkFailed {
                    Text("无法检查镜头，请关闭后重新打开导出。")
                        .foregroundStyle(.red)
                } else if !blocked.isEmpty {
                    Text("可导出 \(exportable(scope).count) 镜 · \(blocked.count) 镜待处理")
                        .fontWeight(.medium)
                    ScrollView {
                        VStack(alignment: .leading, spacing: 10) {
                            ForEach(blocked) { shot in
                                HStack(alignment: .top) {
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text("第 \(shot.no) 镜 · \(label(for: shot))")
                                        Text(issue(for: shot) ?? "")
                                            .foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    if let onFix {
                                        Button("去处理") {
                                            dismiss()
                                            onFix(shot.id)
                                        }
                                        .named("处理第 \(shot.no) 镜")
                                    }
                                }
                            }
                        }
                    }
                    .frame(height: min(160, CGFloat(blocked.count) * 56))
                }
                if let failedAlone {
                    Label(failedAlone, systemImage: "exclamationmark.circle")
                        .foregroundStyle(.red)
                        .fixedSize(horizontal: false, vertical: true)
                }
            } else if let doneURL = htmlDoneURL {
                Text(doneURL.lastPathComponent).lineLimit(1).truncationMode(.middle).help(doneURL.path(percentEncoded: false))
                Text("已生成单文件分镜板、现场拍摄打勾单与后期顺片表")
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            } else if htmlWriting {
                Text("正在绘制各镜构图示意与分镜卡 \(Int(htmlFraction * 100))%")
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
            } else if runner.items.count > 1 {
                List(runner.items) { item in
                    HStack(spacing: 8) {
                        Text(item.fileName).lineLimit(1).truncationMode(.middle).help(item.fileName)
                        Spacer()
                        statusText(item.status)
                    }
                }
                .listStyle(.plain)
                .frame(minHeight: 260)
            } else if let item = runner.items.first {
                Text(item.fileName).lineLimit(1).truncationMode(.middle).help(item.fileName)
                if case .done(let summary) = item.status {
                    Text(summary)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            HStack(spacing: 8) {
                if let target = htmlDoneURL ?? (runner.finished && !showsForm ? (runner.file ?? runner.folder) : nil) {
                    Button("在访达中显示") { NSWorkspace.shared.activateFileViewerSelecting([target]) }
                }
                Spacer()
                if showsForm {
                    Button("取消") { dismiss() }
                        .keyboardShortcut(.cancelAction)
                }
                TaskButton(title: "导出", phase: phase, enabled: format == .storyboardHTML ? !exportable(scope).isEmpty : (!checking && !checkFailed && !exportable(scope).isEmpty), onStart: start, onStop: { runner.cancel() })
                if !showsForm, !isBusy {
                    Button("完成") { dismiss() }
                        .keyboardShortcut(.cancelAction)
                }
            }
            .buttonStyle(.pill())
            .followsMorph(phase.stage)
        }
        .padding(20)
        .frame(width: runner.items.count > 1 ? 560 : 420)
        .interactiveDismissDisabled(isBusy)
        .task(id: CheckKey(rows: board.rows, revision: stage?.motionPackRevision ?? 0)) {
            guard let stage else { return }
            issues = nil
            checkFailed = false
            do {
                let result = try await stage.exportIssues(board.rows)
                if !Task.isCancelled { issues = result }
            } catch {
                if !Task.isCancelled { checkFailed = true }
            }
        }
        // 只导一镜时按了停止，回到开始前的样子
        .onChange(of: runner.isRunning) { running in
            if !running, runner.items.count == 1, runner.items[0].status == .cancelled { runner.reset() }
        }
    }

    private var phase: TaskPhase {
        if htmlWriting {
            return .running(htmlFraction, "正在生成分镜单")
        }
        if htmlDoneURL != nil {
            return .finished("已导出", ok: true)
        }
        if runner.isRunning {
            return .running(runner.fraction, runner.items.count > 1 ? runner.progressLine : "正在导出")
        }
        if showsForm { return .idle }
        if runner.items.count == 1 { return .finished("已导出", ok: true) }
        let stopped = runner.items.contains { $0.status == .cancelled }
        return .finished(stopped ? "已停止，\(runner.resultLine)" : runner.resultLine, ok: !stopped && runner.failedCount == 0)
    }

    private func statusText(_ s: BatchRunner.Status) -> some View {
        let text = switch s {
        case .waiting: "等待"
        case .running(let p): "\(Int(p * 100))%"
        case .done(let summary): summary
        case .skipped: "已有，跳过"
        case .failed(let reason): reason
        case .cancelled: "已停止"
        }
        var failed = false
        if case .failed = s { failed = true }
        return Text(text)
            .monospacedDigit()
            .lineLimit(1)
            .foregroundStyle(failed ? Color.red : .secondary)
            .help(text)
    }

    private func label(for shot: Shot) -> String {
        shot.isMotion ? (names[shot.template] ?? shot.template) : shot.timelineCaption(names: names)
    }

    private func start() {
        htmlError = nil
        let shots = exportable(scope)
        if format == .storyboardHTML {
            guard let stage else { return }
            let cleanTitle = board.title.isEmpty ? "分镜与拍摄清单" : board.title
            let fileName = "\(cleanTitle)_分镜与拍摄清单.html"
            guard let file = (destination ?? Self.askHTMLWhere)(fileName) else { return }
            htmlWriting = true
            htmlFraction = 0
            Task {
                let html = await StoryboardExporter.buildHTML(board: board, shots: shots, stage: stage, names: names) { p in
                    Task { @MainActor in self.htmlFraction = p }
                }
                do {
                    try Data(html.utf8).write(to: file, options: .atomic)
                    htmlDoneURL = file
                } catch {
                    htmlError = error.localizedDescription
                }
                htmlWriting = false
            }
            return
        }
        var labelMap = names
        for s in shots where !s.isMotion {
            labelMap[s.template] = label(for: s)
        }
        if scope == .current, let shot = shots.first {
            let name = BatchRunner.fileName(for: shot, templateName: label(for: shot), size: size, fps: fps)
            guard let file = (destination ?? Self.askWhere)(name) else { return }
            runner.start(shot: shot, file: file, size: size, fps: fps)
        } else {
            guard let folder = (destination ?? Self.askWhere)(nil) else { return }
            // 按镜头各自名称生成文件名（非动效镜写明 A-roll/实拍/素材与景别）
            runner.startCustom(shots: shots, labeler: { label(for: $0) }, folder: folder, size: size, fps: fps)
        }
    }

    private static func askHTMLWhere(_ fileName: String?) -> URL? {
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.html]
        panel.nameFieldStringValue = fileName ?? "分镜与拍摄清单.html"
        panel.prompt = "导出"
        return panel.runModal() == .OK ? panel.url : nil
    }

    private static func askWhere(_ fileName: String?) -> URL? {
        if let fileName {
            let panel = NSSavePanel()
            panel.allowedContentTypes = [.mpeg4Movie]
            panel.nameFieldStringValue = fileName
            panel.prompt = "导出"
            return panel.runModal() == .OK ? panel.url : nil
        }
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.canCreateDirectories = true
        panel.prompt = "导出到这里"
        return panel.runModal() == .OK ? panel.url : nil
    }
}
