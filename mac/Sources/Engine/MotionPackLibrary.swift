import AppKit

struct MotionPack: Codable {
    typealias Entry = [String: JSONValue]
    var version = 1
    var templates: [Entry]?
    var overrides: [Entry]?

    init(json: String) throws {
        self = try JSONDecoder().decode(Self.self, from: Data(json.utf8))
    }

    mutating func put(_ entry: Entry, id: String) {
        if id.hasPrefix("local.") {
            templates = Self.merging(templates, with: [entry], by: "id")
        } else {
            overrides = Self.merging(overrides, with: [entry], by: "target")
        }
    }

    static func combine(external: String, local: String) throws -> String {
        if local == MotionPackLibrary.empty { return external }
        if external == MotionPackLibrary.empty { return local }
        var combined = try Self(json: external)
        let added = try Self(json: local)
        combined.templates = merging(combined.templates, with: added.templates, by: "id")
        combined.overrides = merging(combined.overrides, with: added.overrides, by: "target")
        return try combined.encoded()
    }

    private static func merging(_ base: [Entry]?, with entries: [Entry]?, by key: String) -> [Entry]? {
        guard let entries, !entries.isEmpty else { return base }
        var result = base ?? []
        for entry in entries {
            if let i = result.firstIndex(where: { $0[key] == entry[key] }) {
                result[i] = entry
            } else {
                result.append(entry)
            }
        }
        return result
    }

    func encoded() throws -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        return String(decoding: try encoder.encode(self), as: UTF8.self)
    }
}

// 外部工作文件夹只读。App 内保存的模板和覆盖放在独立文件里，同 ID 优先采用 App 内保存的版本。
final class MotionPackLibrary: ObservableObject {
    static let shared = MotionPackLibrary()
    static let changed = Notification.Name("motionPackChanged")
    static let fileName = "motion-pack.dmotion.json"
    static let empty = #"{"version":1}"#

    private static let bookmarkKey = "motionPack.folder.v1"
    static let byteLimit = 256 * 1024
    private let preferences: UserDefaults
    private let directory: URL
    private var backupURL: URL { directory.appending(path: "last-valid.dmotion.json") }
    private var authoredURL: URL { directory.appending(path: "authored.dmotion.json") }
    private(set) var externalJSON = MotionPackLibrary.empty
    private(set) var authoredJSON = MotionPackLibrary.empty

    @Published private(set) var folder: URL?
    @Published private(set) var status = "选择存放动效包的文件夹"
    private(set) var json = MotionPackLibrary.empty
    private(set) var revision = 0

    var hasBackup: Bool { externalJSON != Self.empty }

    func hasSavedDesign(_ id: String) -> Bool {
        guard let pack = try? MotionPack(json: authoredJSON) else { return false }
        let (entries, key) = id.hasPrefix("local.") ? (pack.templates, "id") : (pack.overrides, "target")
        return entries?.contains(where: { $0[key]?.string == id }) == true
    }

    var agentCommand: String? {
        let helper = Bundle.main.bundleURL.appending(path: "Contents/Helpers/dm-motion")
        guard let folder, FileManager.default.isExecutableFile(atPath: helper.path) else { return nil }
        func quote(_ path: String) -> String {
            "'" + path.replacingOccurrences(of: "'", with: "'\\''") + "'"
        }
        return "\(quote(helper.path)) --workspace \(quote(folder.path)) list"
    }

    private var watcher: Task<Void, Never>?
    private lazy var validator = StageController()

    init(
        preferences: UserDefaults = .standard,
        directory: URL = .applicationSupportDirectory.appending(path: "MotionPacks", directoryHint: .isDirectory)
    ) {
        self.preferences = preferences
        self.directory = directory
        do {
            if let data = try read(backupURL, in: backupURL.deletingLastPathComponent()),
               let backup = String(data: data, encoding: .utf8) {
                externalJSON = backup
                json = backup
                status = "正在使用上次通过校验的动效包"
            }
        } catch {
            status = "无法读取本机动效包副本。\(error.localizedDescription)"
        }
        do {
            if let data = try read(authoredURL, in: directory),
               let authored = String(data: data, encoding: .utf8) {
                let combined = try MotionPack.combine(external: externalJSON, local: authored)
                authoredJSON = authored
                json = combined
            }
        } catch {
            status = "无法读取 App 内保存的动效。\(error.localizedDescription)"
        }
        guard let bookmark = preferences.data(forKey: Self.bookmarkKey) else { return }
        do {
            var stale = false
            let url = try URL(resolvingBookmarkData: bookmark, options: [.withSecurityScope, .withoutUI], relativeTo: nil, bookmarkDataIsStale: &stale)
            if stale { try remember(url) }
            watch(url)
        } catch {
            status = "请重新连接上次选择的文件夹。\(backupStatus)"
        }
    }

    func chooseFolder() {
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.canCreateDirectories = true
        panel.prompt = "连接文件夹"
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do {
            try connect(to: url)
        } catch {
            status = "无法保存文件夹授权。\(error.localizedDescription)"
        }
    }

    func connect(to url: URL) throws {
        try remember(url)
        watch(url)
    }

    func copyProtocol() {
        guard let url = Bundle.main.url(forResource: "MotionPack", withExtension: "md"),
              let text = try? String(contentsOf: url, encoding: .utf8) else { return }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
    }

    func copyAgentCommand() {
        guard let agentCommand else { return }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(agentCommand, forType: .string)
    }

    func copyIndex() async {
        guard let json = try? await validator.callString("return DMBridge.templates()"),
              let templates = try? JSONDecoder().decode([TemplateInfo].self, from: Data(json.utf8)) else { return }
        let text = templates.filter { !$0.id.hasPrefix("local.") }.map { "\($0.id)\t\($0.name)" }.joined(separator: "\n")
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
    }

    private func remember(_ url: URL) throws {
        let opened = url.startAccessingSecurityScopedResource()
        defer { if opened { url.stopAccessingSecurityScopedResource() } }
        let bookmark = try url.bookmarkData(options: [.withSecurityScope, .securityScopeAllowOnlyReadAccess], includingResourceValuesForKeys: nil, relativeTo: nil)
        preferences.set(bookmark, forKey: Self.bookmarkKey)
    }

    func disconnect() {
        do {
            if FileManager.default.fileExists(atPath: backupURL.path) {
                try FileManager.default.removeItem(at: backupURL)
            }
        } catch {
            status = "无法移除本机动效包副本。\(error.localizedDescription)"
            return
        }
        watcher?.cancel()
        watcher = nil
        folder = nil
        preferences.removeObject(forKey: Self.bookmarkKey)
        status = "选择存放动效包的文件夹"
        externalJSON = Self.empty
        apply(authoredJSON)
    }

    func save(_ draft: MotionDesignDraft) throws {
        guard authoredJSON == draft.previousAuthored, externalJSON == draft.previousExternal else {
            throw MotionDesignError("动效库刚刚更新，请重新生成预览后再保存。")
        }
        try write(Data(draft.authored.utf8), to: authoredURL)
        authoredJSON = draft.authored
        apply(draft.effective)
    }

    private func watch(_ url: URL) {
        watcher?.cancel()
        folder = url
        status = "正在检查动效包。\(backupStatus)"
        watcher = Task { [weak self] in
            var last: Data?
            while let self, !Task.isCancelled {
                last = await self.scan(url, last: last)
                try? await Task.sleep(for: .seconds(1))
            }
        }
    }

    private struct Reply: Decodable {
        let templates: Int?
        let overrides: Int?
        let error: String?
    }

    private func scan(_ folder: URL, last: Data?) async -> Data? {
        let file = folder.appending(path: Self.fileName)
        do {
            let data = try read(file, in: folder)
            guard let data else {
                status = "等待文件 \(Self.fileName)。\(backupStatus)"
                return nil
            }
            guard data != last else { return last }
            guard let candidate = String(data: data, encoding: .utf8) else {
                status = "动效包需要 UTF-8 编码。\(backupStatus)"
                return data
            }
            let reply = try await validate(candidate)
            guard !Task.isCancelled else { return last }
            if let error = reply.error {
                status = "动效包校验失败。\(error) \(backupStatus)"
            } else {
                let authored = authoredJSON
                let effective = try MotionPack.combine(external: candidate, local: authored)
                if effective != candidate {
                    let merged = try await validate(effective)
                    guard !Task.isCancelled, authoredJSON == authored else { return last }
                    if let error = merged.error {
                        status = "工作文件夹的动效包与本机动效合并后未通过校验。\(error) \(backupStatus)"
                        return data
                    }
                }
                try write(data, to: backupURL)
                externalJSON = candidate
                apply(effective)
                status = "已加载 \(reply.templates ?? 0) 个模板、\(reply.overrides ?? 0) 个内置动效覆盖"
            }
            return data
        } catch {
            if !Task.isCancelled { status = "\(error.localizedDescription) \(backupStatus)" }
            return last
        }
    }

    private var backupStatus: String {
        hasBackup ? "继续使用上次通过校验的动效包。" : ""
    }

    private func validate(_ candidate: String) async throws -> Reply {
        let reply = try await validator.callString("return DMBridge.installMotionPack(json)", arguments: ["json": candidate])
        return try JSONDecoder().decode(Reply.self, from: Data(reply.utf8))
    }

    private func write(_ data: Data, to file: URL) throws {
        guard data.count <= Self.byteLimit else { throw ReadError.tooLarge }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try data.write(to: file, options: .atomic)
    }

    private func read(_ file: URL, in folder: URL) throws -> Data? {
        let accessed = folder.startAccessingSecurityScopedResource()
        defer { if accessed { folder.stopAccessingSecurityScopedResource() } }
        do {
            let info = try file.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey])
            guard info.isRegularFile == true, info.isSymbolicLink != true else {
                throw ReadError.invalidFile
            }
            let handle = try FileHandle(forReadingFrom: file)
            defer { try? handle.close() }
            let data = try handle.read(upToCount: Self.byteLimit + 1) ?? Data()
            guard data.count <= Self.byteLimit else { throw ReadError.tooLarge }
            return data
        } catch CocoaError.fileReadNoSuchFile {
            return nil
        } catch CocoaError.fileNoSuchFile {
            return nil
        }
    }

    private enum ReadError: LocalizedError {
        case invalidFile, tooLarge
        var errorDescription: String? {
            switch self {
            case .invalidFile: "动效包需要是普通 JSON 文件。"
            case .tooLarge: "动效包最多 256 KB。"
            }
        }
    }

    private func apply(_ next: String) {
        guard json != next else { return }
        json = next
        revision += 1
        NotificationCenter.default.post(name: Self.changed, object: nil)
    }
}
