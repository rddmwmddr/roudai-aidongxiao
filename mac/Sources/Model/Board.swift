import Foundation
import os
import SwiftUI
import UniformTypeIdentifiers

// 分镜表的文件格式和网页版一样，都是 {"title": "...", "rows": [...]}。
// 模板字段有几十种，这里不逐个建模：常用字段给属性，其余原样保留，这样换模板时数据不会丢。

nonisolated enum JSONValue: Codable, Hashable, Sendable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() {
            self = .null
        } else if let v = try? c.decode(Bool.self) {
            self = .bool(v)
        } else if let v = try? c.decode(Double.self) {
            self = .number(v)
        } else if let v = try? c.decode(String.self) {
            self = .string(v)
        } else if let v = try? c.decode([JSONValue].self) {
            self = .array(v)
        } else {
            self = .object(try c.decode([String: JSONValue].self))
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .null: try c.encodeNil()
        case .bool(let v): try c.encode(v)
        case .number(let v):
            // 整数不写成 66.0，文件好读，和网页版一致
            if v.rounded() == v, abs(v) < 1e15 { try c.encode(Int64(v)) } else { try c.encode(v) }
        case .string(let v): try c.encode(v)
        case .array(let v): try c.encode(v)
        case .object(let v): try c.encode(v)
        }
    }

    var string: String? { if case .string(let v) = self { return v } else { return nil } }
    var number: Double? { if case .number(let v) = self { return v } else { return nil } }
    var bool: Bool? { if case .bool(let v) = self { return v } else { return nil } }
    var array: [JSONValue]? { if case .array(let v) = self { return v } else { return nil } }
    var object: [String: JSONValue]? { if case .object(let v) = self { return v } else { return nil } }
}

nonisolated struct Shot: Identifiable, Hashable, Sendable {
    var fields: [String: JSONValue]

    init(fields: [String: JSONValue]) { self.fields = fields }

    var id: Int {
        get { Int(fields["id"]?.number ?? 0) }
        set { fields["id"] = .number(Double(newValue)) }
    }
    var no: String {
        get { fields["no"]?.string ?? String(format: "%03d", id) }
        set { fields["no"] = .string(newValue) }
    }
    var chapter: String {
        get { fields["ch"]?.string ?? "正片" }
        set { fields["ch"] = .string(newValue) }
    }
    var kind: String {
        get { fields["kind"]?.string ?? "B" }
        set { fields["kind"] = .string(newValue) }
    }
    var category: String {
        get { fields["cat"]?.string ?? "" }
        set { fields["cat"] = .string(newValue) }
    }
    var line: String {
        get { fields["line"]?.string ?? "" }
        set { fields["line"] = .string(newValue) }
    }
    var visual: String {
        get { fields["visual"]?.string ?? "" }
        set { fields["visual"] = .string(newValue) }
    }
    var template: String {
        get { fields["tpl"]?.string ?? "statement" }
        set { fields["tpl"] = .string(newValue) }
    }
    var note: String {
        get { fields["note"]?.string ?? "" }
        set {
            if newValue.isEmpty { fields["note"] = nil } else { fields["note"] = .string(newValue) }
        }
    }
    // 缺数字（文稿写 XX%），或者还是样例数据：都不能导出
    var isPending: Bool { (fields["pending"]?.bool ?? false) || usesSampleData }
    var usesSampleData: Bool { fields["sampleData"]?.bool ?? false }
    // 这一镜的秒数。nil 是自动：按口播和动效算
    var duration: Double? {
        get { fields["dur"]?.number }
        set { fields["dur"] = newValue.map(JSONValue.number) }
    }

    // 「出镜」不再是一种镜头。旧文件里的出镜镜头变成重音字幕，口播一个字不动
    var withoutARoll: Shot {
        guard (fields["tpl"]?.string ?? "aroll") == "aroll" else { return self }
        var next = self
        next.template = "statement"
        next.kind = "B"
        next.category = "文字动效"
        next.visual = "念到哪字出到哪"
        if next.lines.isEmpty {
            var text = line.trimmingCharacters(in: .whitespacesAndNewlines)
            while let last = text.last, "。！？!?；;，,：:".contains(last) { text.removeLast() }
            if !text.isEmpty { next.lines = [text] }
        }
        return next
    }

    // 文字类模板的句子
    var lines: [String] {
        get { fields["lines"]?.array?.compactMap(\.string) ?? [] }
        set { fields["lines"] = newValue.isEmpty ? nil : .array(newValue.map(JSONValue.string)) }
    }

    // ---------- 百分比数据 ----------
    var groups: [MetricGroup] {
        get { fields["groups"]?.array?.map(MetricGroup.init(json:)) ?? [] }
        set { fields["groups"] = newValue.isEmpty ? nil : .array(newValue.map(\.json)) }
    }

    // ---------- 元素调整：按模板分开存，换模板再换回来还在 ----------
    func layers(for template: String) -> JSONValue? {
        fields["layers"]?.object?[template]
    }

    func layersJSON(for template: String) -> String {
        guard let value = layers(for: template), let data = try? Self.encoder.encode(value) else { return "{}" }
        return String(decoding: data, as: UTF8.self)
    }

    mutating func setLayers(_ json: String, for template: String) {
        var all = fields["layers"]?.object ?? [:]
        let value = (try? JSONDecoder().decode(JSONValue.self, from: Data(json.utf8))) ?? .object([:])
        if let object = value.object, object.isEmpty {
            all[template] = nil
        } else {
            all[template] = value
        }
        fields["layers"] = all.isEmpty ? nil : .object(all)
    }

    var adjustedElementCount: Int {
        fields["layers"]?.object?[template]?.object?.count ?? 0
    }

    // 给渲染页的 JSON
    var json: String {
        guard let data = try? Self.encoder.encode(JSONValue.object(fields)) else { return "{}" }
        return String(decoding: data, as: UTF8.self)
    }

    private static let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.outputFormatting = [.sortedKeys]
        return e
    }()
}

extension Shot: Codable {
    nonisolated init(from decoder: Decoder) throws {
        fields = try decoder.singleValueContainer().decode([String: JSONValue].self)
    }

    nonisolated func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        try c.encode(fields)
    }
}

nonisolated struct Metric: Identifiable, Hashable, Sendable {
    let id: UUID
    var caption: String
    var value: Double?
    var prefix: String
    var emphasis: Bool
    var answer: String
    var land: Double?
    var extra: [String: JSONValue]

    init(json: JSONValue) {
        var o = json.object ?? [:]
        id = UUID()
        caption = o.removeValue(forKey: "caption")?.string ?? ""
        value = o.removeValue(forKey: "value")?.number
        prefix = o.removeValue(forKey: "prefix")?.string ?? ""
        emphasis = o.removeValue(forKey: "emphasis")?.bool ?? false
        answer = o.removeValue(forKey: "answer")?.string ?? ""
        land = o.removeValue(forKey: "land")?.number
        extra = o
    }

    var json: JSONValue {
        var o = extra
        o["caption"] = .string(caption)
        o["value"] = value.map(JSONValue.number) ?? .null
        if !prefix.isEmpty { o["prefix"] = .string(prefix) }
        if emphasis { o["emphasis"] = .bool(true) }
        if !answer.isEmpty { o["answer"] = .string(answer) }
        if let land { o["land"] = .number(land) }
        return .object(o)
    }

    static func == (a: Metric, b: Metric) -> Bool { a.json == b.json }
    func hash(into h: inout Hasher) { h.combine(json) }
}

nonisolated struct MetricGroup: Identifiable, Hashable, Sendable {
    let id: UUID
    var title: String
    var relation: String
    var metrics: [Metric]
    var extra: [String: JSONValue]

    init(json: JSONValue) {
        var o = json.object ?? [:]
        id = UUID()
        title = o.removeValue(forKey: "title")?.string ?? ""
        relation = o.removeValue(forKey: "relation")?.string ?? "single"
        metrics = o.removeValue(forKey: "metrics")?.array?.map(Metric.init(json:)) ?? []
        extra = o
    }

    var json: JSONValue {
        var o = extra
        o["title"] = .string(title)
        o["relation"] = .string(relation)
        o["metrics"] = .array(metrics.map(\.json))
        return .object(o)
    }

    static func == (a: MetricGroup, b: MetricGroup) -> Bool { a.json == b.json }
    func hash(into h: inout Hasher) { h.combine(json) }
}

nonisolated struct Board: Codable, Hashable, Sendable {
    var title: String
    var rows: [Shot]
    var script: String?

    static let empty = Board(title: "未命名分镜表", rows: [], script: nil)

    var chapters: [String] {
        var seen = Set<String>()
        return rows.map(\.chapter).filter { seen.insert($0).inserted }
    }

    // 重排编号，保证序号和顺序一致
    mutating func renumber() {
        for i in rows.indices {
            rows[i].id = i + 1
            rows[i].no = String(format: "%03d", i + 1)
        }
    }
}

extension UTType {
    nonisolated static let dataMotionBoard = UTType(exportedAs: "com.ahuamiao.datamotion.board", conformingTo: .json)
}

// 用引用类型的文档，撤销由自己注册：每个动作单独一步，菜单里显示「撤销移动元素」这样的名字。
// 系统自动保存时会在后台线程要快照，所以内容放在锁里，主线程和保存线程读到的都是完整的一份
nonisolated final class BoardDocument: ReferenceFileDocument {
    typealias Snapshot = Board

    static let readableContentTypes: [UTType] = [.dataMotionBoard, .json]
    static let writableContentTypes: [UTType] = [.dataMotionBoard]

    private let storage: OSAllocatedUnfairLock<Board>

    var board: Board { storage.withLock { $0 } }

    init(board: Board = .empty) {
        storage = OSAllocatedUnfairLock(initialState: board)
    }

    // 打开软件先看见软件：第一个窗口是示例分镜。之后新建的才是空文档
    nonisolated(unsafe) static var opensSample = true
    private(set) var isSample = false

    static func opening() -> BoardDocument {
        guard opensSample else { return BoardDocument() }
        opensSample = false
        guard let url = Bundle.main.url(forResource: "示例分镜", withExtension: "dmboard"),
              let data = try? Data(contentsOf: url),
              let sample = try? decode(data) else { return BoardDocument() }
        let document = BoardDocument(board: sample)
        document.isSample = true
        return document
    }

    init(configuration: ReadConfiguration) throws {
        guard let data = configuration.file.regularFileContents else {
            throw CocoaError(.fileReadCorruptFile)
        }
        storage = OSAllocatedUnfairLock(initialState: try Self.decode(data))
        Self.opensSample = false
    }

    func snapshot(contentType: UTType) throws -> Board { board }

    func fileWrapper(snapshot: Board, configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: try Self.encode(snapshot))
    }

    @MainActor
    func update(_ new: Board, undoManager: UndoManager?, action: String? = nil) {
        let old = board
        guard new != old else { return }
        objectWillChange.send()
        storage.withLock { $0 = new }
        undoManager?.registerUndo(withTarget: self) { doc in
            doc.update(old, undoManager: undoManager, action: action)
        }
        if let action { undoManager?.setActionName(action) }
    }

    static func decode(_ data: Data) throws -> Board {
        var board = try JSONDecoder().decode(Board.self, from: data)
        board.rows = board.rows.map(\.withoutARoll)
        if board.rows.contains(where: { $0.id == 0 }) { board.renumber() }
        return board
    }

    static func encode(_ board: Board) throws -> Data {
        let e = JSONEncoder()
        e.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        return try e.encode(board)
    }
}
