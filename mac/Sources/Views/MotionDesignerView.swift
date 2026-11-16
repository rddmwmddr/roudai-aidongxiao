import SwiftUI

struct MotionDesignerView: View {
    let current: MotionDesigner.Target?
    let library: MotionPackLibrary
    let onBack: () -> Void
    let onSave: (MotionDesigner.Target, Bool) -> Void
    @ObservedObject private var settings = AISettings.shared
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var designer = MotionDesigner()
    @State private var editsExisting: Bool
    @State private var savedTarget: MotionDesigner.Target?
    @State private var request = ""
    @State private var generation: UUID?
    @State private var draft: MotionDesignDraft?
    @State private var progress = ""
    @State private var issue: String?
    @State private var saved = false

    init(
        current: MotionDesigner.Target?, continuing: Bool = false, library: MotionPackLibrary = .shared,
        onBack: @escaping () -> Void, onSave: @escaping (MotionDesigner.Target, Bool) -> Void
    ) {
        self.current = current
        self.library = library
        self.onBack = onBack
        self.onSave = onSave
        _editsExisting = State(initialValue: continuing && current != nil)
    }

    private var target: MotionDesigner.Target? { savedTarget ?? current }
    private var prompt: String { request.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var example: String {
        editsExisting ? "例如，在左上角显示当前分镜的样本人数。" : "例如，做一张黑底绿字标题卡，标题从右侧滑入。"
    }
    private var canGenerate: Bool {
        guard let profile = settings.active else { return false }
        return settings.hasKey(for: profile) && !profile.model.isEmpty && (1...2000).contains(prompt.count)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Button(action: onBack) { Label("返回动效库", systemImage: "chevron.left") }
                    .named("返回动效库")
                Spacer()
                Text("AI 做动效").font(.headline)
                Spacer()
                settingsButton
            }
            Divider()
            if let target {
                Picker("操作", selection: Binding(get: { editsExisting }, set: selectMode)) {
                    Text("新建模板").tag(false)
                    Text("修改「\(target.name)」").tag(true)
                }
                .pickerStyle(.segmented)
                .labelsHidden()
            }
            if editsExisting, let target {
                Text(target.id.hasPrefix("local.")
                     ? "保存会更新使用「\(target.name)」的分镜。"
                     : "保存会更新使用「\(target.name)」的分镜。另存为模板后，可在动效库里单独选用。")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
            TextEditor(text: Binding(get: { request }, set: updateRequest))
                .font(.body)
                .padding(6)
                .frame(height: 76)
                .background(.background, in: RoundedRectangle(cornerRadius: 8))
                .overlay(alignment: .topLeading) {
                    if request.isEmpty {
                        Text(example)
                            .foregroundStyle(.secondary)
                            .padding(.leading, 11)
                            .padding(.top, 8)
                            .allowsHitTesting(false)
                            .accessibilityHidden(true)
                    }
                }
                .overlay { RoundedRectangle(cornerRadius: 8).strokeBorder(.quaternary) }
                .named("描述想要的动效")
                .disabled(generation != nil)
            HStack {
                if let profile = settings.active, settings.hasKey(for: profile), !profile.model.isEmpty {
                    Text("描述与模板配置将发送到 \(profile.name)")
                        .help(profile.endpointHost)
                } else {
                    Text("先在 AI 设置中配置服务、模型和 API Key。")
                }
                Spacer()
                if generation != nil {
                    Button("取消") { generation = nil }
                } else {
                    Button("生成预览") { generation = UUID() }
                        .buttonStyle(.pill(.inset))
                        .disabled(!canGenerate)
                        .named("生成预览")
                }
            }
            .foregroundStyle(.secondary)
            .font(.callout)
            if let issue {
                Text(issue).foregroundStyle(Color.dangerInk)
                    .textSelection(.enabled)
                    .lineLimit(4)
                    .named("动效生成提示")
            }
            preview
        }
        .padding(18)
        .buttonStyle(.pill())
        .task(id: generation) {
            if let generation { await generate(generation) }
        }
    }

    private var settingsButton: some View {
        Group {
            if #available(macOS 14, *) {
                SettingsLink { Text("AI 设置") }
            } else {
                Button("AI 设置") { NSApp.sendAction(Selector(("showSettingsWindow:")), to: nil, from: nil) }
            }
        }
    }

    private var preview: some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack {
                RoundedRectangle(cornerRadius: 8).fill(Color.primary.opacity(0.05))
                if generation != nil {
                    VStack(spacing: 8) {
                        ProgressView().controlSize(.small)
                        Text(progress).foregroundStyle(.secondary).lineLimit(3)
                    }
                    .padding()
                } else if let draft {
                    MotionFlipbook(clip: draft.clip, still: reduceMotion)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .named("动效草稿预览")
                } else {
                    Text("生成后的动效会在这里播放").foregroundStyle(.secondary)
                }
            }
            .frame(maxHeight: .infinity)
            if let draft, generation == nil {
                HStack(alignment: .center) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(draft.target.name).fontWeight(.semibold).lineLimit(1)
                        Text(saved ? "已保存，可继续描述要改的地方" : "样例预览 · \(draft.summary.isEmpty ? "草稿尚未保存" : draft.summary)")
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                    }
                    Spacer()
                    if !saved {
                        if !draft.target.id.hasPrefix("local.") {
                            Button("另存为模板") { save(draft, asCopy: true) }
                                .buttonStyle(.pill(.inset))
                                .named("另存为模板")
                        }
                        Button("保存到动效库") { save(draft) }
                            .buttonStyle(.pill(.inset))
                            .named("保存到动效库")
                    }
                }
            }
        }
    }

    private func selectMode(_ edit: Bool) {
        guard edit != editsExisting else { return }
        editsExisting = edit
        request = ""
        generation = nil
        draft = nil
        issue = nil
        saved = false
    }

    private func updateRequest(_ text: String) {
        request = text
        issue = nil
        if !saved { draft = nil }
    }

    private func generate(_ id: UUID) async {
        guard let profile = settings.active else { generation = nil; return }
        issue = nil
        progress = "正在生成动效草稿…"
        do {
            let client = AIClient(profile: profile, apiKey: try settings.key(for: profile), enableThinking: true)
            let result = try await designer.generate(
                prompt, target: editsExisting ? target : nil, client: client, library: library
            ) { reason in
                if generation == id { progress = "正在修正草稿。\(reason)" }
            }
            guard !Task.isCancelled, generation == id else { return }
            draft = result
            saved = false
        } catch {
            guard !Task.isCancelled, generation == id else { return }
            issue = error.localizedDescription
        }
        generation = nil
    }

    private func save(_ draft: MotionDesignDraft, asCopy: Bool = false) {
        do {
            let draft = asCopy ? try draft.reusableCopy() : draft
            let created = asCopy || !editsExisting
            try library.save(draft)
            self.draft = draft
            savedTarget = draft.target
            editsExisting = true
            request = ""
            saved = true
            issue = nil
            onSave(draft.target, created)
        } catch {
            issue = error.localizedDescription
        }
    }
}
