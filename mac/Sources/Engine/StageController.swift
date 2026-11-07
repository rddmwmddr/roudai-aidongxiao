import AppKit
import OSLog
import WebKit

private let log = Logger(subsystem: "com.ahuamiao.datamotion", category: "stage")

nonisolated struct StageElement: Identifiable, Hashable, Sendable, Decodable {
    let id: String
    let label: String
    let parent: String?
    let kind: String
    let group: Bool
    let first: Double?
    let last: Double?
}

nonisolated struct TemplateInfo: Identifiable, Hashable, Sendable, Decodable {
    let id: String
    let name: String
    let family: String
    let desc: String
    let custom: Bool
}

nonisolated struct RankedTemplate: Identifiable, Hashable, Sendable, Decodable {
    let id: String
    let name: String
    let family: String
    let why: String
    let score: Double
}

nonisolated struct MotionInfo: Identifiable, Hashable, Sendable, Decodable {
    let id: String
    let name: String
    let category: String
    let categoryName: String
    let desc: String
    let keywords: [String]
    let en: String
}

nonisolated struct MotionCategory: Identifiable, Hashable, Sendable, Decodable {
    let id: String
    let name: String
}

// WKUserContentController 会强引用消息处理者，中间隔一层，窗口关掉时控制器才能释放
private final class WeakHandler: NSObject, WKScriptMessageHandler {
    weak var target: StageController?
    init(_ target: StageController) { self.target = target }
    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.handle(message)
    }
}

// 不要网页的右键菜单（重新载入、检查元素）
final class StageWebView: WKWebView {
    override func willOpenMenu(_ menu: NSMenu, with event: NSEvent) {
        menu.removeAllItems()
    }
}

// 一段预览：几十张图轮着放
struct MotionPreviewClip {
    let frames: [NSImage]
    let seconds: Double
    let sample: Bool
}

// 播放时间一秒变 60 次，单独发布，只有进度线和播放头跟着刷新
final class PlayClock: ObservableObject {
    @Published var time = 0.0
}

final class StageController: NSObject, ObservableObject, WKNavigationDelegate {
    let web: StageWebView
    @Published private(set) var ready = false
    #if DEBUG
    nonisolated(unsafe) static var timerFrames = false
    #endif
    let clock = PlayClock()
    var time: Double { clock.time }
    @Published private(set) var duration = 0.0
    @Published private(set) var playing = false
    @Published private(set) var elements: [StageElement] = []
    @Published private(set) var selection: [String] = []
    @Published private(set) var sceneError: String?
    @Published private(set) var templates: [TemplateInfo] = []
    @Published private(set) var catalog: [MotionInfo] = []
    @Published private(set) var categories: [MotionCategory] = []
    @Published var loop = true {
        didSet { run("DMBridge.setLoop(\(loop))") }
    }

    var onCommit: ((_ template: String, _ layers: String, _ label: String) -> Void)?
    var onNavigate: ((_ direction: Int) -> Void)?

    private var loadedID: Int?
    private var loadedBody: String?
    private var loadedLayers: String?
    private var loadedTemplate: String?
    private var queued: Shot?
    private var readyWaiters: [CheckedContinuation<Void, Never>] = []
    private var thumbnails: [String: NSImage] = [:]
    private var previews: [String: MotionPreviewClip] = [:]
    private var secondsByContent: [String: Double] = [:]
    private var frames: [String: [NSImage]] = [:]

    override init() {
        let config = WKWebViewConfiguration()
        if #available(macOS 14, *) { config.preferences.inactiveSchedulingPolicy = .none }
        config.suppressesIncrementalRendering = true
        let controller = WKUserContentController()
        config.userContentController = controller
        #if DEBUG
        // 窗口测试把窗口放在屏幕外，WebKit 会停掉画面循环。测试时改用定时器
        if Self.timerFrames {
            controller.addUserScript(WKUserScript(source: "window.requestAnimationFrame=f=>setTimeout(()=>f(performance.now()),16);window.cancelAnimationFrame=clearTimeout;", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        #endif
        web = StageWebView(frame: NSRect(x: 0, y: 0, width: 1280, height: 720), configuration: config)
        super.init()
        controller.add(WeakHandler(self), name: "dm")
        web.navigationDelegate = self
        web.allowsBackForwardNavigationGestures = false
        web.allowsMagnification = false
        web.setAccessibilityLabel("动效画面")
        web.underPageBackgroundColor = .textBackgroundColor
        guard let url = Bundle.main.url(forResource: "stage", withExtension: "html") else {
            sceneError = "缺少渲染页 stage.html，请重新安装这个 App。"
            return
        }
        web.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
    }

    // 只允许加载自己的页面，不跳转到任何外部地址
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
        action.request.url?.isFileURL == true ? .allow : .cancel
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        log.error("渲染进程退出，重新载入")
        ready = false
        loadedID = nil
        loadedBody = nil
        webView.reload()
    }

    // ---------- 收消息 ----------
    fileprivate func handle(_ message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        switch type {
        case "ready":
            ready = true
            readyWaiters.forEach { $0.resume() }
            readyWaiters.removeAll()
            Task {
                await loadTemplates()
                await FontLibrary.shared.apply(to: self)
                if let q = queued {
                    queued = nil
                    sync(q)
                }
            }
        case "time":
            clock.time = body["t"] as? Double ?? (body["t"] as? NSNumber)?.doubleValue ?? 0
            // 每帧都来一条。值没变就不发布，不然整个窗口一秒刷新 60 次
            let newDuration = (body["duration"] as? NSNumber)?.doubleValue ?? 0
            if newDuration != duration { duration = newDuration }
            let newPlaying = (body["playing"] as? NSNumber)?.boolValue ?? false
            if newPlaying != playing { playing = newPlaying }
            if duration > 0, sceneError != nil { sceneError = nil }
        case "elements":
            if let s = body["list"] as? String, let list = try? JSONDecoder().decode([StageElement].self, from: Data(s.utf8)) {
                elements = list
            }
        case "selection":
            selection = body["ids"] as? [String] ?? []
        case "commit":
            let template = body["template"] as? String ?? ""
            let layers = body["layers"] as? String ?? "{}"
            loadedLayers = layers
            onCommit?(template, layers, body["label"] as? String ?? "调整元素")
        case "nav":
            onNavigate?((body["dir"] as? NSNumber)?.intValue ?? 1)
        case "sceneError":
            sceneError = body["message"] as? String
            elements = []
        case "fatal":
            sceneError = body["message"] as? String
        default:
            break
        }
    }

    // ---------- 发命令 ----------
    private func run(_ js: String) {
        guard ready else { return }
        web.evaluateJavaScript(js) { _, error in
            if let error { log.error("脚本出错: \(error.localizedDescription, privacy: .public)") }
        }
    }

    func waitUntilReady() async {
        if ready { return }
        await withCheckedContinuation { readyWaiters.append($0) }
    }

    func call(_ body: String, arguments: [String: Any] = [:]) async throws -> Any? {
        await waitUntilReady()
        return try await web.callAsyncJavaScript(body, arguments: arguments, contentWorld: .page)
    }

    /// 这段话重新配动效。编号和手动时长不变
    func rematched(_ shot: Shot) async -> Shot {
        let json = try? await callString("return DMBridge.rematch(line, chapter)", arguments: ["line": shot.line, "chapter": shot.chapter])
        var row = json.flatMap { try? JSONDecoder().decode(Shot.self, from: Data($0.utf8)) }
            ?? Shot(fields: ["line": .string(shot.line), "ch": .string(shot.chapter), "kind": .string("B"), "cat": .string("文字动效"), "tpl": .string("statement"), "lines": .array([.string(shot.line)])])
        row.id = shot.id
        row.no = shot.no
        row.duration = shot.duration
        return row
    }

    func callString(_ body: String, arguments: [String: Any] = [:]) async throws -> String {
        (try await call(body, arguments: arguments) as? String) ?? ""
    }

    private func loadTemplates() async {
        if let s = try? await callString("return DMBridge.templates()"),
           let list = try? JSONDecoder().decode([TemplateInfo].self, from: Data(s.utf8)) {
            templates = list
        }
        struct Catalog: Decodable {
            let categories: [MotionCategory]
            let items: [MotionInfo]
        }
        if let s = try? await callString("return DMBridge.catalog()"),
           let found = try? JSONDecoder().decode(Catalog.self, from: Data(s.utf8)) {
            categories = found.categories
            catalog = found.items
        }
    }

    // 动效库的缩略图。第一次要才画，画过的留着
    func thumbnail(_ id: String) async -> NSImage? {
        if let done = thumbnails[id] { return done }
        guard let url = try? await callString("return DMBridge.thumb(id)", arguments: ["id": id]),
              let comma = url.firstIndex(of: ","),
              let data = Data(base64Encoded: String(url[url.index(after: comma)...])),
              let image = NSImage(data: data) else { return nil }
        thumbnails[id] = image
        return image
    }

    // 挑动效时的预览：用这一镜自己的字演一遍。试过的留着，来回看不用重画
    func preview(_ shot: Shot, template: String) async -> MotionPreviewClip? {
        let key = "\(template)|\(shot.json)"
        if let done = previews[key] { return done }
        struct Reply: Decodable {
            let frames: [String]
            let seconds: Double
            let sample: Bool
        }
        guard let json = try? await callString("return DMBridge.preview(row, id)", arguments: ["row": shot.json, "id": template]),
              let reply = try? JSONDecoder().decode(Reply.self, from: Data(json.utf8)) else { return nil }
        let images = reply.frames.compactMap { url -> NSImage? in
            guard let comma = url.firstIndex(of: ","),
                  let data = Data(base64Encoded: String(url[url.index(after: comma)...])) else { return nil }
            return NSImage(data: data)
        }
        guard !images.isEmpty else { return nil }
        let clip = MotionPreviewClip(frames: images, seconds: reply.seconds, sample: reply.sample)
        if previews.count >= 24 { previews.removeAll() }
        previews[key] = clip
        return clip
    }

    // 时间线上的胶片。内容没变就用画过的
    func frames(of shot: Shot, count: Int) async -> [NSImage] {
        let key = "\(count)|\(shot.json)"
        if let done = frames[key] { return done }
        guard let urls = try? await call("return DMBridge.frames(row, n)", arguments: ["row": shot.json, "n": count]) as? [String] else { return [] }
        let images = urls.compactMap { url -> NSImage? in
            guard let comma = url.firstIndex(of: ","),
                  let data = Data(base64Encoded: String(url[url.index(after: comma)...])) else { return nil }
            return NSImage(data: data)
        }
        frames[key] = images
        return images
    }

    // 每一镜的真实秒数。内容没变就不再算
    func durations(_ rows: [Shot]) async -> [Shot.ID: Double] {
        let missing = rows.filter { secondsByContent[$0.json] == nil }
        if !missing.isEmpty,
           let data = try? JSONEncoder().encode(missing),
           let json = try? await callString("return DMBridge.durations(rows)", arguments: ["rows": String(decoding: data, as: UTF8.self)]),
           let found = try? JSONDecoder().decode([String: Double].self, from: Data(json.utf8)) {
            for shot in missing {
                if let value = found[String(shot.id)] { secondsByContent[shot.json] = value }
            }
        }
        var out: [Shot.ID: Double] = [:]
        for shot in rows {
            out[shot.id] = secondsByContent[shot.json]
        }
        return out
    }

    // 给这一镜换动效。数据不够时引擎放样例并标要确认，见 D.adopt
    func adopt(_ shot: Shot, template: String) async -> Shot? {
        guard let json = try? await callString("return DMBridge.adopt(row, id)", arguments: ["row": shot.json, "id": template]) else { return nil }
        return try? JSONDecoder().decode(Shot.self, from: Data(json.utf8))
    }

    // 把文档里的这一镜同步到画面。只改了元素调整时不重建，保留选中状态和时间
    func sync(_ shot: Shot?) {
        guard ready else {
            queued = shot
            return
        }
        guard let shot else {
            if loadedID != nil {
                loadedID = nil
                loadedBody = nil
                elements = []
                selection = []
                duration = 0
                clock.time = 0
                sceneError = nil
                run("DMBridge.clear()")
            }
            return
        }
        var bare = shot
        bare.fields["layers"] = nil
        let body = bare.json
        let layers = shot.layersJSON(for: shot.template)
        if loadedID == shot.id, loadedBody == body, loadedTemplate == shot.template {
            if loadedLayers != layers {
                loadedLayers = layers
                Task { _ = try? await call("DMBridge.setLayers(tpl, json)", arguments: ["tpl": shot.template, "json": layers]) }
            }
            return
        }
        let keep = loadedID == shot.id
        loadedID = shot.id
        loadedBody = body
        loadedLayers = layers
        loadedTemplate = shot.template
        if !keep {
            elements = []
            selection = []
            clock.time = 0
        }
        sceneError = nil
        let json = shot.json
        Task { _ = try? await call("DMBridge.load(json, keep)", arguments: ["json": json, "keep": keep]) }
    }

    func playPause() { run("DMBridge.toggle()") }
    func pause() { run("DMBridge.pause()") }
    func seek(_ t: Double) {
        clock.time = t
        run("DMBridge.seek(\(t))")
    }

    func select(_ ids: [String]) {
        selection = ids
        Task { _ = try? await call("DMBridge.select(ids)", arguments: ["ids": ids]) }
    }

    func setHidden(_ id: String, _ hidden: Bool) {
        Task { _ = try? await call("DMBridge.toggleHidden(id, hidden)", arguments: ["id": id, "hidden": hidden]) }
    }

    func resetElements() { run("DMBridge.resetElements()") }

    func focusStage() {
        web.window?.makeFirstResponder(web)
    }

    func rank(_ shot: Shot, last: String?) async -> [RankedTemplate] {
        guard let s = try? await callString("return DMBridge.rank(json, last)", arguments: ["json": shot.json, "last": last ?? NSNull()]) else { return [] }
        return (try? JSONDecoder().decode([RankedTemplate].self, from: Data(s.utf8))) ?? []
    }
}

// ---------- 字体库：字体文件放在 App 自己的目录里 ----------
nonisolated struct FontEntry: Identifiable, Codable, Hashable, Sendable {
    var id = UUID()
    var name: String
    var file: String
}

final class FontLibrary: ObservableObject {
    static let shared = FontLibrary()
    enum Slot: String, CaseIterable, Identifiable {
        case cn, num, title
        var id: String { rawValue }
        var label: String {
            switch self {
            case .cn: "中文"
            case .num: "数字"
            case .title: "诗句"
            }
        }
    }

    @Published private(set) var entries: [FontEntry] = []
    @Published private(set) var assignment: [String: UUID] = [:]

    private var folder: URL {
        let dir = URL.applicationSupportDirectory.appending(path: "fonts", directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    init() {
        if let d = UserDefaults.standard.data(forKey: "fonts.entries"), let v = try? JSONDecoder().decode([FontEntry].self, from: d) { entries = v }
        if let d = UserDefaults.standard.data(forKey: "fonts.assign"), let v = try? JSONDecoder().decode([String: UUID].self, from: d) { assignment = v }
    }

    private func persist() {
        UserDefaults.standard.set(try? JSONEncoder().encode(entries), forKey: "fonts.entries")
        UserDefaults.standard.set(try? JSONEncoder().encode(assignment), forKey: "fonts.assign")
        NotificationCenter.default.post(name: .fontsChanged, object: nil)
    }

    enum FontError: LocalizedError {
        case collection, unreadable(String)
        var errorDescription: String? {
            switch self {
            case .collection: "ttc 是字体合集，这里用不了。请导入其中单独的 ttf 或 otf。"
            case .unreadable(let n): "「\(n)」不是可用的字体文件。请换一个 ttf、otf、woff 或 woff2。"
            }
        }
    }

    func add(_ url: URL) throws -> FontEntry {
        let accessing = url.startAccessingSecurityScopedResource()
        defer { if accessing { url.stopAccessingSecurityScopedResource() } }
        let ext = url.pathExtension.lowercased()
        if ext == "ttc" || ext == "otc" { throw FontError.collection }
        guard ["ttf", "otf", "woff", "woff2"].contains(ext), let data = try? Data(contentsOf: url), data.count > 1024 else {
            throw FontError.unreadable(url.lastPathComponent)
        }
        let magic = data.prefix(4)
        let known: [Data] = [Data([0, 1, 0, 0]), Data("OTTO".utf8), Data("true".utf8), Data("wOFF".utf8), Data("wOF2".utf8)]
        guard known.contains(magic) else { throw FontError.unreadable(url.lastPathComponent) }
        let entry = FontEntry(name: url.deletingPathExtension().lastPathComponent, file: "\(UUID().uuidString).\(ext)")
        try data.write(to: folder.appending(path: entry.file))
        entries.append(entry)
        persist()
        return entry
    }

    func remove(_ entry: FontEntry) {
        try? FileManager.default.removeItem(at: folder.appending(path: entry.file))
        entries.removeAll { $0.id == entry.id }
        assignment = assignment.filter { $0.value != entry.id }
        persist()
    }

    func assign(_ slot: Slot, to id: UUID?) {
        assignment[slot.rawValue] = id
        persist()
    }

    func entry(for slot: Slot) -> FontEntry? {
        guard let id = assignment[slot.rawValue] else { return nil }
        return entries.first { $0.id == id }
    }

    // 把指定的字体灌进一个渲染页。出错时退回默认字体，不影响其他工作
    func apply(to stage: StageController) async {
        for slot in Slot.allCases {
            var b64: Any = NSNull()
            if let e = entry(for: slot), let data = try? Data(contentsOf: folder.appending(path: e.file)) {
                b64 = data.base64EncodedString()
            }
            do {
                _ = try await stage.call("await DMBridge.setFont(slot, b64)", arguments: ["slot": slot.rawValue, "b64": b64])
            } catch {
                log.error("字体载入失败 \(slot.rawValue, privacy: .public): \(error.localizedDescription, privacy: .public)")
            }
        }
    }
}

extension Notification.Name {
    static let fontsChanged = Notification.Name("com.ahuamiao.datamotion.fontsChanged")
}
