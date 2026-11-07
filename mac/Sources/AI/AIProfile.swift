import Foundation
import Security

// AI 服务的配置。密钥只进钥匙串，配置文件和分镜表里都没有。

nonisolated enum AIKind: String, Codable, CaseIterable, Identifiable, Sendable {
    case anthropic
    case openAICompatible

    var id: String { rawValue }
    var label: String {
        switch self {
        case .anthropic: "Claude"
        case .openAICompatible: "OpenAI 兼容接口"
        }
    }
}

nonisolated struct AIProfile: Identifiable, Codable, Hashable, Sendable {
    var id = UUID()
    var name: String
    var kind: AIKind
    var baseURL: String
    var model: String

    var endpointHost: String { URL(string: baseURL)?.host() ?? baseURL }
}

nonisolated struct AIPreset: Identifiable, Sendable {
    var id: String { name }
    let name: String
    let kind: AIKind
    let baseURL: String
    let model: String
    let envKeys: [String]

    // 模型名只填确认过的。其他服务商的模型更新快，留给「测试连接」拿到的列表或手填
    static let all: [AIPreset] = [
        AIPreset(name: "Claude", kind: .anthropic, baseURL: "https://api.anthropic.com", model: "claude-opus-5-5", envKeys: ["ANTHROPIC_API_KEY", "CLAUDE_API_KEY"]),
        AIPreset(name: "DeepSeek", kind: .openAICompatible, baseURL: "https://api.deepseek.com/v1", model: "deepseek-v4-pro", envKeys: ["DEEPSEEK_API_KEY"]),
        AIPreset(name: "小米 MiMo", kind: .openAICompatible, baseURL: "https://api.xiaomimimo.com/v1", model: "", envKeys: ["XIAOMI_API_KEY", "MIMO_API_KEY"]),
        AIPreset(name: "Kimi", kind: .openAICompatible, baseURL: "https://api.moonshot.cn/v1", model: "", envKeys: ["MOONSHOT_API_KEY", "KIMI_API_KEY"]),
        AIPreset(name: "通义千问", kind: .openAICompatible, baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "", envKeys: ["DASHSCOPE_API_KEY", "QWEN_API_KEY"]),
        AIPreset(name: "智谱", kind: .openAICompatible, baseURL: "https://open.bigmodel.cn/api/paas/v4", model: "", envKeys: ["ZHIPU_API_KEY", "GLM_API_KEY"]),
        AIPreset(name: "豆包", kind: .openAICompatible, baseURL: "https://ark.cn-beijing.volces.com/api/v3", model: "", envKeys: ["ARK_API_KEY", "DOUBAO_API_KEY"]),
        AIPreset(name: "OpenAI", kind: .openAICompatible, baseURL: "https://api.openai.com/v1", model: "", envKeys: ["OPENAI_API_KEY"]),
        AIPreset(name: "自定义", kind: .openAICompatible, baseURL: "", model: "", envKeys: []),
    ]

    func makeProfile() -> AIProfile {
        AIProfile(name: name, kind: kind, baseURL: baseURL, model: model)
    }
}

// ---------- 钥匙串 ----------
nonisolated enum Keychain {
    static let service = "com.ahuamiao.datamotion.ai"

    enum KeychainError: LocalizedError {
        case failed(OSStatus)
        var errorDescription: String? {
            switch self {
            case .failed(let s): "钥匙串保存失败（\(s)）。请在「钥匙串访问」里确认登录钥匙串已解锁，然后再试。"
            }
        }
    }

    static func save(_ secret: String, account: String) throws {
        let base: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
        SecItemDelete(base as CFDictionary)
        guard !secret.isEmpty else { return }
        var add = base
        add[kSecValueData as String] = Data(secret.utf8)
        add[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlocked
        let status = SecItemAdd(add as CFDictionary, nil)
        if status != errSecSuccess { throw KeychainError.failed(status) }
    }

    static func read(account: String) -> String? {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account, kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess, let data = item as? Data else { return nil }
        return String(decoding: data, as: UTF8.self)
    }

    static func delete(account: String) {
        let base: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
        SecItemDelete(base as CFDictionary)
    }
}

// ---------- 配置导入：支持 JSON 和 .env 两种写法 ----------
nonisolated struct ImportedAIConfig: Equatable, Sendable {
    var name: String
    var kind: AIKind
    var baseURL: String
    var model: String
    var apiKey: String
}

nonisolated enum AIConfigImporter {
    enum ImportError: LocalizedError, Equatable {
        case nothing
        var errorDescription: String? {
            "没有在内容里找到 API Key。可以导入 JSON（含 api_key、base_url、model），或 .env（如 DEEPSEEK_API_KEY=…）。"
        }
    }

    static func parse(_ text: String) throws -> [ImportedAIConfig] {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if let data = trimmed.data(using: .utf8), let any = try? JSONSerialization.jsonObject(with: data) {
            let list = fromJSON(any)
            if !list.isEmpty { return list }
        }
        let list = fromEnv(trimmed)
        if list.isEmpty { throw ImportError.nothing }
        return list
    }

    private static func fromJSON(_ any: Any) -> [ImportedAIConfig] {
        if let array = any as? [Any] { return array.flatMap(fromJSON) }
        guard let d = any as? [String: Any] else { return [] }
        // {"providers": {...}} 或 {"profiles": [...]} 这种外层
        for key in ["providers", "profiles", "models"] {
            if let inner = d[key] as? [Any] { return inner.flatMap(fromJSON) }
            if let inner = d[key] as? [String: Any] {
                return inner.flatMap { name, value -> [ImportedAIConfig] in
                    guard var body = value as? [String: Any] else { return [] }
                    if body["name"] == nil { body["name"] = name }
                    return fromJSON(body)
                }.sorted { $0.name < $1.name }
            }
        }
        func pick(_ keys: [String]) -> String? {
            for k in keys {
                if let v = d[k] as? String, !v.isEmpty { return v }
            }
            return nil
        }
        guard let key = pick(["api_key", "apiKey", "key", "token", "API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY"]) else { return [] }
        let base = pick(["base_url", "baseURL", "baseUrl", "api_base", "endpoint", "url"]) ?? ""
        let provider = pick(["provider", "type", "name"]) ?? ""
        let model = pick(["model", "model_name", "modelName"]) ?? ""
        return [build(name: pick(["name"]) ?? provider, providerHint: provider, base: base, model: model, key: key)]
    }

    private static func fromEnv(_ text: String) -> [ImportedAIConfig] {
        var env: [String: String] = [:]
        for raw in text.split(whereSeparator: \.isNewline) {
            var line = raw.trimmingCharacters(in: .whitespaces)
            if line.hasPrefix("#") { continue }
            if line.hasPrefix("export ") { line.removeFirst(7) }
            guard let eq = line.firstIndex(of: "=") else { continue }
            let k = line[..<eq].trimmingCharacters(in: .whitespaces)
            var v = line[line.index(after: eq)...].trimmingCharacters(in: .whitespaces)
            if v.count >= 2, let f = v.first, f == v.last, f == "\"" || f == "'" { v = String(v.dropFirst().dropLast()) }
            env[k] = v
        }
        var out: [ImportedAIConfig] = []
        var used = Set<String>()
        for preset in AIPreset.all where !preset.envKeys.isEmpty {
            guard let keyName = preset.envKeys.first(where: { env[$0]?.isEmpty == false }), let key = env[keyName] else { continue }
            used.insert(keyName)
            let stem = keyName.replacingOccurrences(of: "_API_KEY", with: "")
            let base = env["\(stem)_BASE_URL"] ?? env["\(stem)_API_BASE"] ?? preset.baseURL
            let model = env["\(stem)_MODEL"] ?? preset.model
            out.append(ImportedAIConfig(name: preset.name, kind: preset.kind, baseURL: base, model: model, apiKey: key))
        }
        // 不认识的服务商：FOO_API_KEY + FOO_BASE_URL 也能导入
        for (k, v) in env.sorted(by: { $0.key < $1.key }) where k.hasSuffix("_API_KEY") && !used.contains(k) && !v.isEmpty {
            let stem = String(k.dropLast("_API_KEY".count))
            guard let base = env["\(stem)_BASE_URL"] ?? env["\(stem)_API_BASE"] else { continue }
            out.append(ImportedAIConfig(name: stem.capitalized, kind: .openAICompatible, baseURL: base, model: env["\(stem)_MODEL"] ?? "", apiKey: v))
        }
        return out
    }

    private static func build(name: String, providerHint: String, base: String, model: String, key: String) -> ImportedAIConfig {
        let hint = (providerHint + " " + base + " " + name).lowercased()
        let isClaude = hint.contains("anthropic") || hint.contains("claude") || key.hasPrefix("sk-ant-")
        if isClaude {
            let preset = AIPreset.all[0]
            return ImportedAIConfig(name: name.isEmpty ? preset.name : name, kind: .anthropic, baseURL: base.isEmpty ? preset.baseURL : base, model: model.isEmpty ? preset.model : model, apiKey: key)
        }
        let preset = AIPreset.all.first { p in
            let stem = p.name.lowercased()
            return hint.contains(stem) || (!p.baseURL.isEmpty && hint.contains(URL(string: p.baseURL)?.host() ?? "\u{0}"))
        }
        return ImportedAIConfig(name: name.isEmpty ? (preset?.name ?? "导入的服务") : name, kind: .openAICompatible, baseURL: base.isEmpty ? (preset?.baseURL ?? "") : base, model: model.isEmpty ? (preset?.model ?? "") : model, apiKey: key)
    }
}

// ---------- 配置存储 ----------
final class AISettings: ObservableObject {
    static let shared = AISettings()
    private static let defaultsKey = "ai.profiles.v1"
    private static let activeKey = "ai.active.v1"
    private static let rulesKey = "ai.useRules.v1"

    @Published var profiles: [AIProfile] {
        didSet { persist() }
    }
    @Published var activeID: UUID? {
        didSet { UserDefaults.standard.set(activeID?.uuidString, forKey: Self.activeKey) }
    }

    // 上次生成分镜时选了规则版。下次不会自己换回 AI，文稿不会在没注意时发出去
    @Published var useRules: Bool {
        didSet { UserDefaults.standard.set(useRules, forKey: Self.rulesKey) }
    }

    init() {
        useRules = UserDefaults.standard.bool(forKey: Self.rulesKey)
        if let data = UserDefaults.standard.data(forKey: Self.defaultsKey),
           let saved = try? JSONDecoder().decode([AIProfile].self, from: data) {
            profiles = saved
        } else {
            profiles = []
        }
        if let s = UserDefaults.standard.string(forKey: Self.activeKey) { activeID = UUID(uuidString: s) }
    }

    var active: AIProfile? {
        profiles.first { $0.id == activeID } ?? profiles.first
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(profiles) {
            UserDefaults.standard.set(data, forKey: Self.defaultsKey)
        }
    }

    func key(for profile: AIProfile) -> String? {
        Keychain.read(account: profile.id.uuidString)
    }

    func setKey(_ key: String, for profile: AIProfile) throws {
        try Keychain.save(key, account: profile.id.uuidString)
    }

    @discardableResult
    func add(_ config: ImportedAIConfig) throws -> AIProfile {
        var profile = AIProfile(name: config.name, kind: config.kind, baseURL: config.baseURL, model: config.model)
        if let same = profiles.firstIndex(where: { $0.name == config.name && $0.baseURL == config.baseURL }) {
            profile.id = profiles[same].id
            profiles[same] = profile
        } else {
            profiles.append(profile)
        }
        try setKey(config.apiKey, for: profile)
        if activeID == nil { activeID = profile.id }
        return profile
    }

    func remove(_ profile: AIProfile) {
        Keychain.delete(account: profile.id.uuidString)
        profiles.removeAll { $0.id == profile.id }
        if activeID == profile.id { activeID = profiles.first?.id }
    }
}
