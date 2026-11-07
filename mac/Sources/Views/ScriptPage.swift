import SwiftUI

// 文稿页。没有字的时候是首页：正中两个大玻璃按钮「导入文本」「导入 A-roll」。文字框一直在下面，粘贴、打字、拖文件都落在这里，有字了按钮让开
struct ScriptPage: View {
    @Binding var text: String
    @ObservedObject var storyboarder: Storyboarder
    let onImport: () -> Void
    let onImportARoll: () -> Void
    let onGenerate: () -> Void
    let onDropFile: (URL) -> Void
    @FocusState private var writing: Bool
    @ObservedObject private var settings = AISettings.shared

    private var hasText: Bool {
        !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        ZStack {
            VStack(spacing: 0) {
                TextEditor(text: $text)
                    .font(.system(size: 15))
                    .lineSpacing(5)
                    .scrollContentBackground(.hidden)
                    .focused($writing)
                    .disabled(storyboarder.running)
                    .accessibilityLabel("文稿")
                    .frame(maxWidth: 720)
                    .padding(.horizontal, 24)
                    .padding(.top, 20)
                    .dropDestination(for: URL.self) { urls, _ in
                        guard let url = urls.first else { return false }
                        onDropFile(url)
                        return true
                    }
                messages
                if hasText || storyboarder.running { bottomBar }
            }
            if !hasText && !storyboarder.running {
                CombBackdrop()
                GlassGroup(spacing: 14) {
                    HStack(spacing: 14) {
                        homeButton("导入文本", "square.and.arrow.down", action: onImport)
                        homeButton("导入 A-roll", "video", action: onImportARoll)
                    }
                }
            }
        }
        .background(Color.deskBase)
        .onAppear {
            storyboarder.pickEngine()
            if !hasText { writing = true }
        }
    }

    private func homeButton(_ title: String, _ symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: symbol)
                .font(.system(size: 22, weight: .semibold))
                .padding(.horizontal, 40)
                .frame(height: 78)
                .contentShape(Capsule())
                .glass(in: Capsule(), interactive: true)
        }
        .buttonStyle(.plain)
        .named(title)
    }

    private var bottomBar: some View {
        HStack(spacing: 12) {
            Button("导入文本", action: onImport)
                .buttonStyle(.pill())
                .disabled(storyboarder.running)
                .named("导入文本")
            Button("导入 A-roll", action: onImportARoll)
                .buttonStyle(.pill())
                .disabled(storyboarder.running)
                .named("导入 A-roll")
            engineMenu
                .disabled(storyboarder.running)
            Spacer()
            TaskButton(title: "生成分镜", phase: phase, enabled: hasText, onStart: onGenerate, onStop: storyboarder.stop)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    private var phase: TaskPhase {
        storyboarder.running ? .running(storyboarder.fraction, storyboarder.progress) : .idle
    }

    @ViewBuilder
    private var messages: some View {
        if storyboarder.errorText != nil || !storyboarder.warnings.isEmpty {
            VStack(alignment: .leading, spacing: 4) {
                if let error = storyboarder.errorText {
                    Label(error, systemImage: "exclamationmark.circle")
                        .foregroundStyle(.red)
                }
                ForEach(storyboarder.warnings, id: \.self) { warning in
                    Label(warning, systemImage: "exclamationmark.triangle")
                }
            }
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: 720, alignment: .leading)
            .padding(.horizontal, 24)
            .padding(.top, 8)
            .padding(.bottom, hasText || storyboarder.running ? 0 : 16)
        }
    }

    // 菜单里写清文稿会发到哪：选 AI 就看得到地址，规则版写明离线
    private var engineMenu: some View {
        Menu {
            engineRow("规则（离线）", .rules)
            ForEach(settings.profiles) { p in
                engineRow("\(p.name) · \(p.endpointHost)", .ai(p.id))
            }
            Divider()
            if #available(macOS 14, *) {
                SettingsLink { Text("接入 AI…") }
            } else {
                Button("接入 AI…") { NSApp.sendAction(Selector(("showSettingsWindow:")), to: nil, from: nil) }
            }
        } label: {
            Text(storyboarder.profile.map { "\($0.name) · \($0.endpointHost)" } ?? "规则（离线）")
        }
        .menuStyle(.borderlessButton)
        .fixedSize()
        .accessibilityLabel("分镜方式")
    }

    private func engineRow(_ title: String, _ engine: Storyboarder.Engine) -> some View {
        Button {
            storyboarder.choose(engine)
        } label: {
            if storyboarder.engine == engine {
                Label(title, systemImage: "checkmark")
            } else {
                Text(title)
            }
        }
    }
}
