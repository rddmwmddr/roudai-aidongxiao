import SwiftUI

@main
struct DataMotionApp: App {
    init() {
        // 启动时不弹打开文件的面板
        UserDefaults.standard.register(defaults: ["NSShowAppCentricOpenPanelInsteadOfUntitledFile": false])
    }

    var body: some Scene {
        DocumentGroup(newDocument: { BoardDocument.opening() }) { file in
            ContentView(document: file.document)
        }
        .windowToolbarStyle(.unified)
        .defaultSize(width: 1480, height: 920)
        .commands {
            AppCommands()
        }

        Settings {
            SettingsView()
        }

        Window("使用说明", id: "help") {
            HelpView()
        }
        .windowResizability(.contentSize)

        Window("关于肉呆爱动效", id: "about") {
            AboutView()
        }
        .windowResizability(.contentSize)
    }
}

// 菜单命令要作用在当前窗口上，窗口把自己能做的事放进这里
struct DocumentActions {
    var importScript: () -> Void
    var importARoll: () -> Void
    var loadSample: () -> Void
    var generate: () -> Void
    var export: () -> Void
    var previous: () -> Void
    var next: () -> Void
    var playPause: () -> Void
    var rewind: () -> Void
    var toggleLoop: () -> Void
    var addShot: () -> Void
    var deleteShot: () -> Void
    var resetAdjustments: () -> Void
    var setMode: (ViewMode) -> Void
    var toggleInspector: () -> Void
    var focusSearch: () -> Void
    var hasShot: Bool
    var hasRows: Bool
    var hasAdjustments: Bool
    var loops: Bool
    var mode: ViewMode
}

extension FocusedValues {
    @Entry var documentActions: DocumentActions?
}

// 一个窗口只有三页：写文稿、调画面、看全表
enum ViewMode: CaseIterable, Identifiable {
    case script
    case stage
    case table

    var id: Self { self }

    var label: String {
        switch self {
        case .script: "文稿"
        case .stage: "画面"
        case .table: "分镜表"
        }
    }

    var symbol: String {
        switch self {
        case .script: "doc.text"
        case .stage: "play.rectangle"
        case .table: "tablecells"
        }
    }
}

struct AppCommands: Commands {
    @FocusedValue(\.documentActions) private var actions
    @Environment(\.openWindow) private var openWindow

    var body: some Commands {
        CommandGroup(replacing: .appInfo) {
            Button("关于肉呆爱动效") { openWindow(id: "about") }
        }

        CommandGroup(replacing: .help) {
            Button("肉呆爱动效使用说明") { openWindow(id: "help") }
        }

        CommandGroup(replacing: .importExport) {
            Button("导入文本…") { actions?.importScript() }
                .keyboardShortcut("i", modifiers: [.command, .shift])
                .disabled(actions == nil)
            Button("导入 A-roll…") { actions?.importARoll() }
                .keyboardShortcut("a", modifiers: [.command, .shift])
                .disabled(actions == nil)
            Button("生成分镜") { actions?.generate() }
                .keyboardShortcut("g", modifiers: [.command, .shift])
                .disabled(actions == nil)
            Button("载入示例分镜") { actions?.loadSample() }
                .disabled(actions == nil)
            Divider()
            Button("导出…") { actions?.export() }
                .keyboardShortcut("e", modifiers: .command)
                .disabled(actions?.hasRows != true)
        }

        CommandGroup(replacing: .toolbar) {
            Button("显示或隐藏这一镜") { actions?.toggleInspector() }
                .keyboardShortcut("i", modifiers: [.command, .option])
                .disabled(actions?.hasRows != true)
            Button("搜索") { actions?.focusSearch() }
                .keyboardShortcut("f", modifiers: .command)
                .disabled(actions?.hasRows != true)
            Divider()
            ForEach(Array(ViewMode.allCases.enumerated()), id: \.element) { index, mode in
                Button {
                    actions?.setMode(mode)
                } label: {
                    if actions?.mode == mode {
                        Label(mode.label, systemImage: "checkmark")
                    } else {
                        Text(mode.label)
                    }
                }
                .keyboardShortcut(KeyEquivalent(Character("\(index + 1)")), modifiers: .command)
                .disabled(actions?.hasRows != true)
            }
        }

        CommandMenu("镜头") {
            Button("播放或暂停") { actions?.playPause() }
                .disabled(actions?.hasShot != true)
            Button("回到开头") { actions?.rewind() }
                .keyboardShortcut(.leftArrow, modifiers: .command)
                .disabled(actions?.hasShot != true)
            Button {
                actions?.toggleLoop()
            } label: {
                if actions?.loops == true {
                    Label("循环播放", systemImage: "checkmark")
                } else {
                    Text("循环播放")
                }
            }
            .disabled(actions == nil)
            Divider()
            Button("上一镜") { actions?.previous() }
                .keyboardShortcut(.upArrow, modifiers: .command)
                .disabled(actions?.hasRows != true)
            Button("下一镜") { actions?.next() }
                .keyboardShortcut(.downArrow, modifiers: .command)
                .disabled(actions?.hasRows != true)
            Divider()
            Button("新增一镜") { actions?.addShot() }
                .keyboardShortcut("n", modifiers: [.command, .option])
                .disabled(actions == nil)
            Button("删除这一镜") { actions?.deleteShot() }
                .keyboardShortcut(.delete, modifiers: .command)
                .disabled(actions?.hasShot != true)
            Divider()
            Button("还原这一镜的调整") { actions?.resetAdjustments() }
                .disabled(actions?.hasAdjustments != true)
        }
    }
}
