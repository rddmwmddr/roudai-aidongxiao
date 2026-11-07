import AppKit
import SwiftUI

// 导出只有这一个面板：选范围、分辨率、帧率，按导出。
// 一镜存成一个文件，多镜选一个文件夹（已有的跳过，写一份输出清单）
struct ExportSheet: View {
    enum Scope: Hashable {
        case current, visible, all, picked
    }

    let board: Board
    let current: Shot?
    let visible: [Shot]
    let picked: Set<Shot.ID>
    let names: [String: String]
    /// 选保存位置。测试不弹系统面板，直接给一个地址
    let destination: ((_ singleFileName: String?) -> URL?)?
    @Environment(\.dismiss) private var dismiss
    @AppStorage("export.size") private var sizeRaw = ExportSize.uhd.rawValue
    @AppStorage("export.fps") private var fps = 60
    @State private var scope: Scope
    @StateObject private var runner = BatchRunner()

    init(board: Board, current: Shot?, visible: [Shot], picked: Set<Shot.ID>, names: [String: String], destination: ((String?) -> URL?)? = nil) {
        self.board = board
        self.current = current
        self.visible = visible
        self.picked = picked
        self.names = names
        self.destination = destination
        _scope = State(initialValue: picked.count >= 2 ? .picked : current != nil ? .current : .all)
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

    private func exportable(_ s: Scope) -> [Shot] {
        base(s).filter { !$0.isPending }
    }

    private var missingData: Int {
        base(scope).filter(\.isPending).count
    }

    private var failedAlone: String? {
        if runner.items.count == 1, !runner.isRunning, case .failed(let text) = runner.items[0].status { return text }
        return nil
    }

    private var showsForm: Bool {
        runner.items.isEmpty || failedAlone != nil
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if showsForm {
                Form {
                    Picker("范围", selection: $scope) {
                        if current != nil {
                            Text("这一镜").tag(Scope.current)
                        }
                        if visible.count < board.rows.count {
                            Text("当前列表 \(exportable(.visible).count)").tag(Scope.visible)
                        }
                        Text("全部 \(exportable(.all).count)").tag(Scope.all)
                        if !picked.isEmpty {
                            Text("选中的 \(exportable(.picked).count)").tag(Scope.picked)
                        }
                    }
                    Picker("分辨率", selection: $sizeRaw) {
                        ForEach(ExportSize.allCases) { s in Text(s.label).tag(s.rawValue) }
                    }
                    Picker("帧率", selection: $fps) {
                        Text("60").tag(60)
                        Text("30").tag(30)
                    }
                }
                .formStyle(.columns)
                if missingData > 0 {
                    Text("\(missingData) 镜缺数据，不导出")
                        .foregroundStyle(.secondary)
                }
                if let failedAlone {
                    Label(failedAlone, systemImage: "exclamationmark.circle")
                        .foregroundStyle(.red)
                        .fixedSize(horizontal: false, vertical: true)
                }
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
                if runner.finished, !showsForm, let target = runner.file ?? runner.folder {
                    Button("在访达中显示") { NSWorkspace.shared.activateFileViewerSelecting([target]) }
                }
                Spacer()
                if showsForm {
                    Button("取消") { dismiss() }
                        .keyboardShortcut(.cancelAction)
                }
                TaskButton(title: "导出", phase: phase, enabled: !exportable(scope).isEmpty, onStart: start, onStop: { runner.cancel() })
                if !showsForm, !runner.isRunning {
                    Button("完成") { dismiss() }
                        .keyboardShortcut(.cancelAction)
                }
            }
            .buttonStyle(.pill())
            .followsMorph(phase.stage)
        }
        .padding(20)
        .frame(width: runner.items.count > 1 ? 560 : 380)
        .interactiveDismissDisabled(runner.isRunning)
        // 只导一镜时按了停止，回到开始前的样子
        .onChange(of: runner.isRunning) { running in
            if !running, runner.items.count == 1, runner.items[0].status == .cancelled { runner.reset() }
        }
    }

    private var phase: TaskPhase {
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

    private func start() {
        let shots = exportable(scope)
        if scope == .current, let shot = shots.first {
            let name = BatchRunner.fileName(for: shot, templateName: names[shot.template] ?? shot.template, size: size, fps: fps)
            guard let file = (destination ?? Self.askWhere)(name) else { return }
            runner.start(shot: shot, file: file, size: size, fps: fps)
        } else {
            guard let folder = (destination ?? Self.askWhere)(nil) else { return }
            runner.start(shots: shots, names: names, folder: folder, size: size, fps: fps)
        }
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
