import SwiftUI
import UniformTypeIdentifiers

struct SettingsView: View {
    var body: some View {
        AISettingsView()
            .frame(width: 640, height: 400)
    }
}

// ---------- AI ----------
struct AISettingsView: View {
    @ObservedObject private var settings = AISettings.shared
    @State private var selection: UUID?
    @State private var showImporter = false
    @State private var showPaste = false
    @State private var pasted = ""
    @State private var message: String?
    @State private var askingRemove = false

    var body: some View {
        HStack(spacing: 0) {
            List(settings.profiles, selection: $selection) { p in
                Text(p.name).lineLimit(1).tag(p.id)
            }
            .listStyle(.sidebar)
            .safeAreaInset(edge: .bottom, spacing: 0) {
                HStack(spacing: 4) {
                    if !askingRemove {
                        addMenu
                    }
                    // 配置和钥匙串里的 Key 删了找不回来，所以这里要确认
                    ConfirmDeleteButton(symbol: "minus", label: "删除服务", confirmTitle: "删除服务和 Key", enabled: selection != nil, asking: $askingRemove) {
                        if let p = settings.profiles.first(where: { $0.id == selection }) {
                            settings.remove(p)
                            selection = settings.profiles.first?.id
                        }
                    }
                    Spacer()
                }
                .followsMorph(askingRemove)
                .padding(8)
                .onChange(of: selection) { _ in askingRemove = false }
            }
            .frame(width: 200)
            Divider()
            if let current = settings.profiles.first(where: { $0.id == selection }) {
                // 按 ID 取，不按下标：删掉服务后，旧的绑定还可能被读一次，下标已经越界
                let id = current.id
                ProfileForm(profile: Binding(
                    get: { settings.profiles.first { $0.id == id } ?? current },
                    set: { new in
                        if let i = settings.profiles.firstIndex(where: { $0.id == id }) { settings.profiles[i] = new }
                    }
                ), settings: settings)
                .id(id)
            } else {
                Color.clear.frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .onAppear { if selection == nil { selection = settings.active?.id } }
        .fileImporter(isPresented: $showImporter, allowedContentTypes: [.json, .plainText, .data]) { r in
            if case .success(let url) = r {
                let accessing = url.startAccessingSecurityScopedResource()
                defer { if accessing { url.stopAccessingSecurityScopedResource() } }
                if let data = try? Data(contentsOf: url) {
                    importText(String(decoding: data, as: UTF8.self))
                } else {
                    message = "读不了这个文件。把内容复制出来，用「粘贴配置」试试。"
                }
            }
        }
        .sheet(isPresented: $showPaste) {
            VStack(alignment: .leading, spacing: 10) {
                TextEditor(text: $pasted)
                    .font(.system(.footnote, design: .monospaced))
                    .frame(minHeight: 180)
                    .accessibilityLabel("配置内容")
                HStack {
                    Spacer()
                    Button("取消") { showPaste = false }
                        .buttonStyle(.pill())
                        .keyboardShortcut(.cancelAction)
                    Button("导入") {
                        importText(pasted)
                        pasted = ""
                        showPaste = false
                    }
                    .buttonStyle(.pill(.prominent))
                    .keyboardShortcut(.defaultAction)
                    .disabled(pasted.isEmpty)
                }
            }
            .padding(18)
            .frame(width: 500)
        }
        .alert("导入配置", isPresented: Binding(get: { message != nil }, set: { if !$0 { message = nil } })) {
            Button("好") { message = nil }
        } message: {
            Text(message ?? "")
        }
    }

    private var addMenu: some View {
        Menu {
            ForEach(AIPreset.all) { preset in
                Button(preset.name) {
                    let p = preset.makeProfile()
                    settings.profiles.append(p)
                    if settings.activeID == nil { settings.activeID = p.id }
                    selection = p.id
                }
            }
            Divider()
            Button("从文件导入配置…") { showImporter = true }
            Button("粘贴配置…") {
                pasted = ""
                showPaste = true
            }
        } label: {
            Image(systemName: "plus")
        }
        .menuStyle(.button)
        .buttonStyle(.glassKey(diameter: 26))
        .menuIndicator(.hidden)
        .fixedSize()
        .accessibilityLabel("添加 AI 服务")
    }

    private func importText(_ text: String) {
        do {
            let list = try AIConfigImporter.parse(text)
            var last: AIProfile?
            for config in list { last = try settings.add(config) }
            selection = last?.id
        } catch {
            message = error.localizedDescription
        }
    }
}

struct ProfileForm: View {
    @Binding var profile: AIProfile
    let settings: AISettings
    @State private var keyDraft = ""
    @State private var hasKey = false
    @State private var models: [String] = []
    @State private var problem: String?
    @State private var testResult: ResultPhase = .idle
    @FocusState private var keyFocused: Bool

    var body: some View {
        Form {
            TextField("名称", text: $profile.name)
            Picker("接口", selection: $profile.kind) {
                ForEach(AIKind.allCases) { k in Text(k.label).tag(k) }
            }
            TextField("地址", text: $profile.baseURL)
            HStack(spacing: 6) {
                TextField("模型", text: $profile.model)
                if !models.isEmpty {
                    Menu {
                        ForEach(models, id: \.self) { m in
                            Button(m) { profile.model = m }
                        }
                    } label: {
                        Image(systemName: "chevron.up.chevron.down")
                    }
                    .menuStyle(.button)
                    .buttonStyle(.icon(diameter: 22))
                    .menuIndicator(.hidden)
                    .fixedSize()
                    .named("选择模型")
                }
            }
            SecureField("Key", text: $keyDraft, prompt: Text(hasKey ? "••••••••" : ""))
                .focused($keyFocused)
                .onSubmit(saveKey)
                .onChange(of: keyFocused) { f in
                    if !f { saveKey() }
                }
            HStack {
                ResultButton(title: "测试连接", phase: $testResult, enabled: hasKey || !keyDraft.isEmpty, action: connect)
            }
            if let problem {
                Label(problem, systemImage: "exclamationmark.circle")
                    .foregroundStyle(.red)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .formStyle(.columns)
        .padding(20)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .onAppear { hasKey = settings.key(for: profile) != nil }
    }

    private func saveKey() {
        guard !keyDraft.isEmpty else { return }
        do {
            try settings.setKey(keyDraft, for: profile)
            keyDraft = ""
            hasKey = true
            problem = nil
        } catch {
            problem = error.localizedDescription
        }
    }

    // 一个按钮做完连接要做的事：存 Key、拿模型列表（有的服务不给，不算失败）、试一句话
    private func connect() {
        saveKey()
        guard let key = settings.key(for: profile) else { return }
        problem = nil
        testResult = .working
        let client = AIClient(profile: profile, apiKey: key)
        let name = profile.name
        Task {
            if let list = try? await client.listModels() { models = list }
            do {
                guard !profile.model.isEmpty else { throw AIError.missingModel(name) }
                _ = try await client.testConnection()
                testResult = .success("已连通")
            } catch {
                problem = error.localizedDescription
                testResult = .failure("连不上")
            }
        }
    }
}
