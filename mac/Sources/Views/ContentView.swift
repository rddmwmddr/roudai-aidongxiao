import AppKit
import SwiftUI
import UniformTypeIdentifiers

enum ShotFilter: Hashable {
    case all
    case needsReview
    case adjusted
    case chapter(String)

    func includes(_ shot: Shot) -> Bool {
        switch self {
        case .all: true
        case .needsReview: !shot.note.isEmpty
        case .adjusted: shot.adjustedElementCount > 0
        case .chapter(let c): shot.chapter == c
        }
    }
}

// 能撤销的操作做完后，底部出现一个限时撤销。文档再有别的改动就收起，免得撤到别的操作上
struct UndoNotice: Identifiable, Equatable {
    let id = UUID()
    let text: String
    let restoring: Shot.ID?
    let boardAfter: Board
}

#if DEBUG
extension Notification.Name {
    static let debugImportFile = Notification.Name("debugImportFile")
}
#endif

struct ContentView: View {
    @ObservedObject var document: BoardDocument
    @Environment(\.undoManager) private var undoManager
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @StateObject private var stage = StageController()
    @StateObject private var storyboarder = Storyboarder()
    @State private var selection: Shot.ID?
    @State private var tableSelection = Set<Shot.ID>()
    @State private var filter: ShotFilter = .all
    @State private var query = ""
    @State private var script: String
    @State private var exporting = false
    @State private var replacingFonts = false
    @State private var importing = false
    @State private var importTypes = ScriptImporter.contentTypes
    @State private var errorText: String?
    @State private var notice: UndoNotice?
    @State private var autoplayNext = false
    @State private var page = ViewMode.stage
    @FocusState private var searching: Bool
    // 每个窗口自己记。系统在关窗口、切页时会往这个绑定里写值，放成全局的话会把下一个窗口的检查器也关掉
    @SceneStorage("editorInspector") private var inspectorShown = false

    init(document: BoardDocument) {
        self.document = document
        _script = State(initialValue: document.board.script ?? "")
    }

    private var board: Board { document.board }

    // 没有镜头时只有文稿这一页，空文档不需要别的说明
    private var mode: ViewMode {
        board.rows.isEmpty ? .script : page
    }

    // 检查器和表格写回文档走这里，每次写入都是一步撤销
    private var boardBinding: Binding<Board> {
        Binding(get: { document.board }, set: { document.update($0, undoManager: undoManager, action: "修改镜头") })
    }

    private var visibleRows: [Shot] {
        let q = query.trimmingCharacters(in: .whitespaces)
        return board.rows.filter { row in
            filter.includes(row) && (q.isEmpty || row.line.localizedCaseInsensitiveContains(q) || row.no.contains(q))
        }
    }

    private var currentIndex: Int? {
        guard let selection else { return nil }
        return board.rows.firstIndex { $0.id == selection }
    }

    private var currentShot: Shot? {
        currentIndex.map { board.rows[$0] }
    }

    private var templateNames: [String: String] {
        Dictionary(uniqueKeysWithValues: stage.templates.map { ($0.id, $0.name) })
    }

    var body: some View {
        window
        .frame(minWidth: 880, minHeight: 620)
        .preferredColorScheme(.dark)
        .focusedSceneValue(\.documentActions, actions)
        .sheet(isPresented: $exporting) {
            ExportSheet(board: board, current: currentShot, visible: visibleRows, picked: tableSelection, names: templateNames)
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: importTypes) { result in
            switch result {
            case .success(let url): readScript(url)
            case .failure(let error): errorText = error.localizedDescription
            }
        }
        .onDrop(of: [.fileURL], isTargeted: nil, perform: handleDrop)
        .alert("没有完成", isPresented: Binding(get: { errorText != nil }, set: { if !$0 { errorText = nil } })) {
            Button("好") { errorText = nil }
        } message: {
            Text(errorText ?? "")
        }
        .onAppear {
            setUp()
            installHandlers()
        }
        .onChange(of: stage.playing) { now in
            // 关了循环就接着播下一镜，时间线上看着是一条连续的片子
            if !now, !stage.loop, stage.duration > 0, stage.time >= stage.duration - 0.2, let i = currentIndex, i + 1 < board.rows.count {
                selection = board.rows[i + 1].id
                autoplayNext = true
            }
        }
        .onChange(of: stage.duration) { d in
            if autoplayNext, d > 0 {
                autoplayNext = false
                stage.seek(0)
                stage.playPause()
            }
        }
        .onChange(of: undoManager) { _ in installHandlers() }
        .onChange(of: currentShot) { shot in stage.sync(shot) }
        .onChange(of: document.board) { now in
            if let notice, notice.boardAfter != now { self.notice = nil }
            if (now.script ?? "") != script, !storyboarder.running { script = now.script ?? "" }
        }
        .onChange(of: tableSelection) { ids in
            // 分镜表里点一行，右边跟着显示这一镜
            if ids.count == 1, let id = ids.first { selection = id }
        }
        .onChange(of: visibleRows.map(\.id)) { ids in
            if let s = selection, !ids.contains(s) { selection = ids.first }
            if selection == nil { selection = ids.first }
        }
        .onChange(of: query) { q in
            if !q.isEmpty, mode == .script { setMode(.stage) }
        }
        // 文稿停笔一会儿就写进文档，和备忘录一样，关窗口不丢。打字的撤销归文字框自己管
        .task(id: script) {
            try? await Task.sleep(for: .milliseconds(600))
            if !Task.isCancelled { persistScript() }
        }
        .onReceive(NotificationCenter.default.publisher(for: .fontsChanged)) { _ in
            Task { await FontLibrary.shared.apply(to: stage) }
        }
        .modifier(SpaceToPlay(stage: stage, onSplit: splitAtPlayhead))
        #if DEBUG
        // 系统的选文件面板在别的进程，测试点不了。测试直接把文件交到这里，后面走的路一样
        .onReceive(NotificationCenter.default.publisher(for: .debugImportFile)) { note in
            if let url = note.object as? URL { readScript(url) }
        }
        #endif
    }

    // 窗口是系统的工具栏和检查器，它们的玻璃、圆角都是系统给的。镜头在时间线上，不需要左边的列表
    private var window: some View {
        detail
            .overlay(alignment: .bottom) {
                if let notice {
                    TimedUndoPill(text: notice.text, undo: { undo(notice) }, dismiss: { self.notice = nil })
                        .id(notice.id)
                        .padding(.bottom, mode == .stage ? 262 : mode == .script ? 72 : 22)
                        .transition(reduceMotion ? .opacity : Self.noticeTransition)
                }
            }
            .animation(ButtonMotion.state(reduce: reduceMotion), value: notice)
        .sidePanel(isPresented: inspectorVisible) {
            InspectorView(board: boardBinding, selection: selection, stage: stage, onNotice: { showNotice($0) })
        }
        .toolbar { toolbar }
        // 工具栏不要底色和分隔线：玻璃按钮直接浮在内容上
        .toolbarBackground(.hidden, for: .windowToolbar)
    }

    private var inspectorVisible: Binding<Bool> {
        Binding(
            get: { mode != .script && inspectorShown },
            set: { shown in
                if mode != .script { inspectorShown = shown }
            }
        )
    }

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        if !board.rows.isEmpty {
            ToolbarItem(placement: .principal) {
                Picker("页面", selection: Binding(get: { mode }, set: setMode)) {
                    ForEach(ViewMode.allCases) { m in
                        Image(systemName: m.symbol)
                            .accessibilityLabel(m.label)
                            .tag(m)
                    }
                }
                .pickerStyle(.segmented)
                .labelsHidden()
                .tint(.coral)
                .named("页面")
            }
        }
        ToolbarItem(placement: .primaryAction) {
            Button { replacingFonts = true } label: {
                Label("替换字体", systemImage: "character.book.closed")
                    .labelStyle(.titleAndIcon)
            }
            .named("替换字体")
            .help("替换全部镜头的字体")
            .popover(isPresented: $replacingFonts, arrowEdge: .bottom) {
                FontReplacementView()
            }
        }
        if !board.rows.isEmpty {
            ToolbarItemGroup(placement: .primaryAction) {
                FilterMenu(board: board, filter: $filter)
                Button {
                    exporting = true
                } label: {
                    Label("导出", systemImage: "square.and.arrow.up")
                }
                .named("导出…")
                .help("导出")
                if mode != .script {
                    Button { inspectorShown.toggle() } label: {
                        Label("这一镜", systemImage: "sidebar.right")
                    }
                    .named("这一镜")
                    .help("这一镜")
                }
            }
            if #available(macOS 26, *) {
                ToolbarSpacer(.fixed, placement: .primaryAction)
            }
            // 不用 .searchable：它不能按条件去掉（空文档没有镜头可搜），加减它会让整个窗口重建
            ToolbarItem(placement: .primaryAction) {
                SearchField(text: $query, focus: $searching)
            }
        }
    }

    private var detail: some View {
        EditorStage(
            mode: mode,
            rows: visibleRows,
            selection: $selection,
            picked: $tableSelection,
            actions: shotActions,
            stage: stage,
            names: templateNames,
            previousDataTemplate: previousDataTemplate,
            onPick: replaceCurrent,
            onUndo: { undoManager?.undo() },
            onRedo: { undoManager?.redo() },
            onAdd: addShot,
            onDelete: deleteShot,
            onTrim: trim,
            onMove: move
        ) {
            pages
        }
    }

    private func replaceCurrent(_ next: Shot) {
        if let i = document.board.rows.firstIndex(where: { $0.id == next.id }) {
            edit("换动效") { $0.rows[i] = next }
        }
    }

    // 三页的内容。渲染页一直在窗口里，只是不显示：空文档也要靠它生成分镜，切页不用重建画面
    private var pages: some View {
        ZStack {
            StageWebHost(web: stage.web, visible: mode == .stage && currentShot != nil)
            switch mode {
            case .script:
                ScriptPage(text: $script, storyboarder: storyboarder, onImport: pickScript, onImportARoll: pickARoll, onGenerate: generate, onDropFile: readScript)
            case .stage:
                EmptyView()
            case .table:
                ShotTable(board: boardBinding, rows: visibleRows, selection: $tableSelection, stage: stage, names: templateNames) { id in
                    selection = id
                    setMode(.stage)
                }
            }
        }
    }

    private var previousDataTemplate: String? {
        guard let i = currentIndex else { return nil }
        return board.rows[..<i].last { $0.fields["groups"] != nil }?.template
    }

    private var actions: DocumentActions {
        DocumentActions(
            importScript: pickScript,
            importARoll: pickARoll,
            loadSample: loadSample,
            generate: generate,
            export: { exporting = true },
            previous: { move(-1) },
            next: { move(1) },
            playPause: { stage.playPause() },
            rewind: { stage.seek(0) },
            toggleLoop: { stage.loop.toggle() },
            addShot: addShot,
            deleteShot: deleteCurrent,
            resetAdjustments: { stage.resetElements() },
            setMode: setMode,
            toggleInspector: { inspectorShown.toggle() },
            focusSearch: { searching = true },
            hasShot: currentShot != nil,
            hasRows: !board.rows.isEmpty,
            hasAdjustments: (currentShot?.adjustedElementCount ?? 0) > 0,
            loops: stage.loop,
            mode: mode
        )
    }

    private func setMode(_ m: ViewMode) {
        page = m
    }

    private func edit(_ action: String, _ change: (inout Board) -> Void) {
        var next = document.board
        change(&next)
        document.update(next, undoManager: undoManager, action: action)
    }

    // 这两个回调活得比一次界面刷新久，环境里的撤销管理器一变就要重新装，否则会写到旧的上面
    private func installHandlers() {
        stage.onCommit = { template, layers, label in
            guard let i = currentIndex else { return }
            edit(label) { $0.rows[i].setLayers(layers, for: template) }
            if label == "还原这一镜" { showNotice("已还原") }
        }
        stage.onNavigate = { dir in move(dir) }
    }

    private func setUp() {
        // 示例分镜：停在第三镜播起来，一打开就看得到动效
        if document.isSample, board.rows.count >= 3 {
            selection = board.rows[2].id
            autoplayNext = true
        }
        if selection == nil { selection = board.rows.first?.id }
        stage.sync(currentShot)
        // 窗口打开时焦点放在画面上，不放在搜索框里：空格能直接播放，方向键能直接切镜头
        Task {
            try? await Task.sleep(for: .milliseconds(300))
            if mode == .stage { stage.focusStage() }
        }
    }

    private func move(_ dir: Int) {
        let rows = visibleRows
        guard !rows.isEmpty else { return }
        guard let s = selection, let i = rows.firstIndex(where: { $0.id == s }) else {
            selection = rows.first?.id
            return
        }
        let next = i + dir
        if rows.indices.contains(next) { selection = rows[next].id }
    }

    // ---------- 镜头 ----------
    private func addShot() {
        var fields: [String: JSONValue] = ["line": .string(""), "kind": .string("B"), "cat": .string("文字动效"), "tpl": .string("statement"), "visual": .string(""), "lines": .array([.string("在这里写上屏的文字")])]
        fields["ch"] = .string(currentShot?.chapter ?? "正片")
        let shot = Shot(fields: fields)
        let at = (currentIndex ?? board.rows.count - 1) + 1
        edit("新增一镜") { b in
            b.rows.insert(shot, at: at)
            b.renumber()
        }
        selection = document.board.rows[at].id
        setMode(.stage)
    }

    // ---------- 拆分、组合、重新匹配 ----------
    private var shotActions: ShotActions {
        ShotActions(splitText: splitText, splitClip: splitClip, merge: merge, rematch: rematch, export: exportShots)
    }

    private func splitAtPlayhead() {
        if let selection { splitClip(selection) }
    }

    // 回车：字拆在光标处。手动定过时长的镜头按字数分时长
    private func splitText(_ id: Shot.ID, _ offset: Int) {
        guard let shot = board.rows.first(where: { $0.id == id }) else { return }
        let text = shot.line as NSString
        guard offset > 0, offset < text.length else { return }
        let head = text.substring(to: offset)
        let tail = text.substring(from: offset)
        let parts = shot.duration.map { total -> (Double, Double) in
            let k = Double(offset) / Double(text.length)
            return (total * k, total * (1 - k))
        }
        split(shot, head: head, tail: tail, seconds: parts)
    }

    // B：当前这一镜拆在播放头，别的镜头拆在正中。两段时长加起来不变
    private func splitClip(_ id: Shot.ID) {
        guard let shot = board.rows.first(where: { $0.id == id }) else { return }
        Task {
            let total = id == selection && stage.duration > 0 ? stage.duration : ((await stage.durations([shot]))[id] ?? 0)
            guard total >= 1 else { return }
            let at = id == selection ? min(total - 0.5, max(0.5, stage.time)) : total / 2
            let letters = Array(shot.line)
            let cut = ShotSplit.offset(in: shot.line, fraction: at / total)
            split(shot, head: String(letters[..<cut]), tail: String(letters[cut...]), seconds: (at, total - at))
        }
    }

    private func split(_ shot: Shot, head: String, tail: String, seconds: (Double, Double)?) {
        Task {
            var first = shot
            first.line = head
            var second = shot
            second.line = tail
            first = await stage.rematched(first)
            second = await stage.rematched(second)
            first.duration = seconds?.0
            second.duration = seconds?.1
            guard let i = document.board.rows.firstIndex(where: { $0.id == shot.id && $0.line == shot.line }) else { return }
            edit("拆分镜头") { b in
                b.rows[i] = first
                b.rows.insert(second, at: i + 1)
                b.renumber()
            }
            tableSelection = []
            selection = document.board.rows[i + 1].id
            showNotice("已拆成两镜")
        }
    }

    private func merge(_ ids: Set<Shot.ID>) {
        let group = board.rows.filter { ids.contains($0.id) }
        guard group.count >= 2, let at = board.rows.firstIndex(where: { ids.contains($0.id) }) else { return }
        Task {
            var one = group[0]
            one.line = ShotSplit.joined(group.map(\.line))
            one.duration = nil
            one = await stage.rematched(one)
            // 拖过或者对过声音的镜头：时长相加，声音还对得上
            if group.contains(where: { $0.duration != nil }) {
                let known = await stage.durations(group)
                one.duration = group.reduce(0) { $0 + ($1.duration ?? known[$1.id] ?? 0) }
            }
            guard document.board.rows.filter({ ids.contains($0.id) }).map(\.json) == group.map(\.json) else { return }
            edit("组合镜头") { b in
                b.rows.removeAll { ids.contains($0.id) }
                b.rows.insert(one, at: at)
                b.renumber()
            }
            tableSelection = []
            selection = document.board.rows[at].id
            showNotice("已组合 \(group.count) 镜")
        }
    }

    private func rematch(_ ids: Set<Shot.ID>) {
        let group = board.rows.filter { ids.contains($0.id) }
        guard !group.isEmpty else { return }
        Task {
            var next: [Shot.ID: Shot] = [:]
            for shot in group { next[shot.id] = await stage.rematched(shot) }
            edit("重新匹配") { b in
                for i in b.rows.indices {
                    if let row = next[b.rows[i].id] { b.rows[i] = row }
                }
            }
            showNotice("已重新匹配 \(group.count) 镜")
        }
    }

    private func exportShots(_ ids: Set<Shot.ID>) {
        if ids.count == 1, let id = ids.first {
            tableSelection = []
            selection = id
        } else {
            tableSelection = ids
        }
        exporting = true
    }

    // 时间线上拖出来的秒数。nil 是恢复自动
    private func trim(_ id: Shot.ID, _ seconds: Double?) {
        guard let i = board.rows.firstIndex(where: { $0.id == id }) else { return }
        edit("调整时长") { $0.rows[i].duration = seconds }
    }

    private func deleteCurrent() {
        if let selection { deleteShot(selection) }
    }

    private func deleteShot(_ id: Shot.ID) {
        guard let i = board.rows.firstIndex(where: { $0.id == id }) else { return }
        let removed = board.rows[i]
        edit("删除镜头") { b in
            b.rows.remove(at: i)
            b.renumber()
        }
        let rows = document.board.rows
        selection = rows.isEmpty ? nil : rows[min(i, rows.count - 1)].id
        showNotice("已删除第 \(removed.no) 镜", restoring: removed.id)
    }

    private func showNotice(_ text: String, restoring id: Shot.ID? = nil) {
        notice = UndoNotice(text: text, restoring: id, boardAfter: document.board)
    }

    private func undo(_ notice: UndoNotice) {
        self.notice = nil
        undoManager?.undo()
        if let id = notice.restoring { selection = id }
    }

    // ---------- 文稿 ----------
    private func persistScript() {
        let saved = document.board.script ?? ""
        guard saved != script else { return }
        var next = document.board
        next.script = script
        document.update(next, undoManager: nil)
    }

    private func generate() {
        guard mode == .script, !script.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            setMode(.script)
            return
        }
        storyboarder.start(source: script, stage: stage, onDone: apply)
    }

    private func apply(_ output: Storyboarder.Output) {
        var next = document.board
        next.rows = output.rows
        next.renumber()
        next.script = output.source
        if let title = output.title, next.title == Board.empty.title { next.title = title }
        document.update(next, undoManager: undoManager, action: "生成分镜")
        if script != output.source { script = output.source }
        selection = next.rows.first?.id
        showNotice("已生成 \(next.rows.count) 镜")
        // 有要看的警告就留在文稿页，没有就直接去调画面
        setMode(output.warnings.isEmpty ? .stage : .script)
    }

    private func pickScript() {
        importTypes = ScriptImporter.contentTypes
        importing = true
    }

    private func pickARoll() {
        importTypes = ARollImporter.contentTypes
        importing = true
    }

    // 识别的进度和错误都在文稿页，所以先去那一页。已有分镜时只对时长
    private func importARoll(_ url: URL) {
        persistScript()
        let back = mode
        setMode(.script)
        storyboarder.startARoll(url: url, script: script, rows: board.rows, stage: stage) { output in
            guard output.timingOnly else { return apply(output) }
            let current = selection
            edit("对齐 A-roll") { $0.rows = output.rows }
            selection = current
            showNotice("已按 A-roll 对齐 \(output.rows.count) 镜")
            setMode(back == .script ? .stage : back)
        }
    }

    private func loadSample() {
        guard let url = Bundle.main.url(forResource: "示例分镜", withExtension: "dmboard"),
              let data = try? Data(contentsOf: url),
              let sample = try? BoardDocument.decode(data) else {
            errorText = "示例文件缺失。请重新安装这个 App。"
            return
        }
        document.update(sample, undoManager: undoManager, action: "载入示例")
        selection = sample.rows.first?.id
        setMode(.stage)
    }

    private func readScript(_ url: URL) {
        if ARollImporter.handles(url) { return importARoll(url) }
        // 扫描版要做文字识别，放后台，窗口不卡
        Task {
            do {
                let text = try await Task.detached { try ScriptImporter.read(url) }.value
                script = text
                edit("导入文稿") { $0.script = text }
                setMode(.script)
            } catch {
                errorText = error.localizedDescription
            }
        }
    }

    private func handleDrop(_ providers: [NSItemProvider]) -> Bool {
        guard let provider = providers.first else { return false }
        _ = provider.loadObject(ofClass: URL.self) { url, _ in
            guard let url else { return }
            Task { @MainActor in readScript(url) }
        }
        return true
    }
}

// 筛选收进一个菜单，要用时才看得见
private struct FilterMenu: View {
    let board: Board
    @Binding var filter: ShotFilter

    private func count(_ f: ShotFilter) -> Int { board.rows.filter(f.includes).count }

    var body: some View {
        Menu {
            Picker("筛选", selection: $filter) {
                Text("全部 \(count(.all))").tag(ShotFilter.all)
                Text("要确认 \(count(.needsReview))").tag(ShotFilter.needsReview)
                Text("调整过 \(count(.adjusted))").tag(ShotFilter.adjusted)
            }
            .pickerStyle(.inline)
            .labelsHidden()
            Picker("章节", selection: $filter) {
                ForEach(board.chapters, id: \.self) { c in
                    Text("\(c) \(count(.chapter(c)))").tag(ShotFilter.chapter(c))
                }
            }
            .pickerStyle(.inline)
            .labelsHidden()
        } label: {
            Label("筛选", systemImage: filter == .all ? "line.3.horizontal.decrease" : "line.3.horizontal.decrease.circle.fill")
        }
        .named("筛选")
        .help("筛选")
    }
}

// 空格键：焦点在文字框里时打字，其他时候播放暂停。画面里按空格由渲染页自己处理
struct SpaceToPlay: ViewModifier {
    @ObservedObject var stage: StageController
    let onSplit: () -> Void
    @State private var monitor: Any?

    func body(content: Content) -> some View {
        content
            .onAppear {
                monitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
                    guard event.keyCode == 49 || event.keyCode == 11, event.modifierFlags.intersection(.deviceIndependentFlagsMask).isEmpty else { return event }
                    guard !stage.web.isHidden, let window = stage.web.window, event.window === window else { return event }
                    let responder = window.firstResponder
                    // 脚本框打不了字，空格和 B 照常。别的文字框要打字
                    if (responder is NSTextView && !(responder is ScriptTextView)) || responder is NSTextField { return event }
                    if event.keyCode == 11 {
                        onSplit()
                        return nil
                    }
                    if responder === stage.web { return event }
                    stage.playPause()
                    return nil
                }
            }
            .onDisappear {
                if let monitor { NSEvent.removeMonitor(monitor) }
                monitor = nil
            }
    }
}

extension ContentView {
    fileprivate static var noticeTransition: AnyTransition {
        if #available(macOS 14, *) { return AnyTransition(.blurReplace).combined(with: .offset(y: 10)) }
        return AnyTransition.opacity.combined(with: .offset(y: 10))
    }
}

extension View {
    /// 右栏。macOS 14 起用系统的 inspector，macOS 13 没有，排一列固定宽度的栏
    @ViewBuilder func sidePanel<Panel: View>(isPresented: Binding<Bool>, @ViewBuilder panel: () -> Panel) -> some View {
        if #available(macOS 14, *), !ProcessInfo.processInfo.environment.keys.contains("DM_SIDE_PANEL") {
            inspector(isPresented: isPresented) {
                panel().inspectorColumnWidth(min: 260, ideal: 320, max: 460)
            }
        } else {
            HStack(spacing: 0) {
                self
                if isPresented.wrappedValue {
                    Divider()
                    panel().frame(width: 320)
                }
            }
        }
    }
}
