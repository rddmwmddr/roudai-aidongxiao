import AppKit
import Compression
import Foundation
import PDFKit
import UniformTypeIdentifiers
import Vision

// 把文稿文件读成纯文本。全部用系统能力，不引第三方库。
// 先看文件内容判断格式，再看扩展名：改过扩展名、没有扩展名的文件也能读
nonisolated enum ScriptImporter {
    enum ImportError: LocalizedError {
        case unsupported(String)
        case empty(String)
        case unreadable(String)

        var errorDescription: String? {
            switch self {
            case .unsupported(let name): "「\(name)」里没有读到文字。这个文件可能是音视频之外的二进制格式。把内容粘贴进文稿页，也可以生成分镜。"
            case .empty(let name): "「\(name)」里没有读到文字。图片和扫描版已经走过文字识别，文件里可能确实没有字。"
            case .unreadable(let name): "读不了「\(name)」。文件可能损坏或者加了密码。把内容粘贴进文稿页，也可以生成分镜。"
            }
        }
    }

    // 什么文件都能选。读不出字再说明
    static let contentTypes: [UTType] = [.item]

    static func read(_ url: URL) throws -> String {
        let accessing = url.startAccessingSecurityScopedResource()
        defer { if accessing { url.stopAccessingSecurityScopedResource() } }
        let name = url.lastPathComponent
        let ext = url.pathExtension.lowercased()
        let clean = normalize(try extract(url, ext: ext, name: name))
        if clean.isEmpty { throw ImportError.empty(name) }
        return clean
    }

    private static let imageExtensions: Set<String> = ["png", "jpg", "jpeg", "heic", "heif", "tif", "tiff", "bmp", "gif", "webp"]
    private static let subtitleExtensions: Set<String> = ["srt", "vtt", "ass", "ssa", "lrc", "sbv"]
    private static let markupExtensions: Set<String> = ["xml", "opml", "fdx", "xhtml", "svg", "fodt"]

    private static func extract(_ url: URL, ext: String, name: String) throws -> String {
        // iWork 和 rtfd 可能是文件夹
        var isFolder: ObjCBool = false
        FileManager.default.fileExists(atPath: url.path, isDirectory: &isFolder)
        if isFolder.boolValue {
            if ext == "rtfd" { return try attributed(url, type: .rtfd, name: name) }
            return try iWorkFolder(url, name: name)
        }
        let data: Data
        do {
            data = try Data(contentsOf: url, options: .mappedIfSafe)
        } catch {
            throw ImportError.unreadable(name)
        }
        let head = [UInt8](data.prefix(8))
        if head.starts(with: [0x25, 0x50, 0x44, 0x46]) { return try pdfText(url, name: name) }
        if head.starts(with: [0x50, 0x4B, 0x03, 0x04]) || head.starts(with: [0x50, 0x4B, 0x05, 0x06]) {
            return try zipText(data, ext: ext, url: url, name: name)
        }
        if head.starts(with: [0xD0, 0xCF, 0x11, 0xE0]) { return try legacyOffice(url, data: data, name: name) }
        if head.starts(with: Array("{\\rtf".utf8)) { return try attributed(url, type: .rtf, name: name) }
        if head.starts(with: Array("bplist".utf8)), let page = webArchiveHTML(data) { return htmlText(page) }
        if imageExtensions.contains(ext) || NSImage(data: data) != nil && decodeText(data) == nil {
            return try imageText(url, name: name)
        }
        guard let text = decodeText(data) else { throw ImportError.unsupported(name) }
        if subtitleExtensions.contains(ext) { return subtitleText(text) }
        if ["html", "htm", "mhtml"].contains(ext) || looksLikeHTML(text) { return htmlText(text) }
        if markupExtensions.contains(ext) { return htmlText(text) }
        return text
    }

    // ---------- 纯文本 ----------
    /// 解得开、而且不是二进制才算文字
    static func decodeText(_ data: Data) -> String? {
        if data.isEmpty { return "" }
        let probe = data.prefix(4096)
        // UTF-16 带 BOM
        if data.starts(with: [0xFF, 0xFE]) || data.starts(with: [0xFE, 0xFF]) { return String(data: data, encoding: .utf16) }
        let zeros = probe.reduce(0) { $0 + ($1 == 0 ? 1 : 0) }
        if zeros > 0 { return nil }
        if let s = String(data: data, encoding: .utf8) { return s.hasPrefix("\u{FEFF}") ? String(s.dropFirst()) : s }
        // Windows 上存的文稿常常是 GBK
        let gb18030 = String.Encoding(rawValue: CFStringConvertEncodingToNSStringEncoding(CFStringEncoding(CFStringEncodings.GB_18030_2000.rawValue)))
        if let s = String(data: data, encoding: gb18030), !isGarbled(s) { return s }
        let big5 = String.Encoding(rawValue: CFStringConvertEncodingToNSStringEncoding(CFStringEncoding(CFStringEncodings.big5.rawValue)))
        if let s = String(data: data, encoding: big5), !isGarbled(s) { return s }
        return nil
    }

    private static func isGarbled(_ s: String) -> Bool {
        let sample = s.unicodeScalars.prefix(4000)
        let bad = sample.filter { $0.value < 0x20 && ![9, 10, 13].contains($0.value) || (0xE000...0xF8FF).contains($0.value) }.count
        return bad * 20 > sample.count
    }

    private static func looksLikeHTML(_ text: String) -> Bool {
        let head = text.prefix(400).lowercased()
        return head.contains("<!doctype html") || head.contains("<html")
    }

    /// 字幕和歌词：去掉序号、时间码、样式，留下念的话
    static func subtitleText(_ text: String) -> String {
        var lines: [String] = []
        for raw in text.components(separatedBy: .newlines) {
            var line = raw.trimmingCharacters(in: .whitespaces)
            if line.isEmpty || line == "WEBVTT" || line.hasPrefix("NOTE") || line.hasPrefix("[Script Info]") || line.hasPrefix("[V4") || line.hasPrefix("[Events]") || line.hasPrefix("Format:") || line.hasPrefix("Style:") { continue }
            if line.range(of: #"^\d+$"#, options: .regularExpression) != nil { continue }
            if line.range(of: #"\d{1,2}:\d{2}[:.,]\d{2}.*(-->|,\d)"#, options: .regularExpression) != nil, line.contains("-->") || line.range(of: #"^\d{1,2}:\d{2}:\d{2}\.\d+,\d"#, options: .regularExpression) != nil { continue }
            if line.hasPrefix("Dialogue:") {
                let parts = line.split(separator: ",", maxSplits: 9, omittingEmptySubsequences: false)
                line = parts.count == 10 ? String(parts[9]) : line
                line = line.replacingOccurrences(of: #"\{[^}]*\}"#, with: "", options: .regularExpression).replacingOccurrences(of: "\\N", with: " ")
            }
            line = line.replacingOccurrences(of: #"^\[\d{1,2}:\d{2}(?:\.\d+)?\]"#, with: "", options: .regularExpression)
            line = line.replacingOccurrences(of: #"<[^>]+>"#, with: "", options: .regularExpression).trimmingCharacters(in: .whitespaces)
            if line.isEmpty || line.range(of: #"^\[[a-z]{2}:.*\]$"#, options: .regularExpression) != nil { continue }
            if lines.last != line { lines.append(line) }
        }
        return lines.joined(separator: "\n")
    }

    // ---------- HTML ----------
    static func htmlText(_ html: String) -> String {
        var s = html
        for block in ["script", "style", "head", "metadata"] {
            s = s.replacingOccurrences(of: "<\(block)\\b[\\s\\S]*?</\(block)>", with: "", options: [.regularExpression, .caseInsensitive])
        }
        s = s.replacingOccurrences(of: #"<(br|/p|/div|/h[1-6]|/li|/tr|/section|/article|/speaker|/text|/paragraph)\b[^>]*>"#, with: "\n", options: [.regularExpression, .caseInsensitive])
        s = s.replacingOccurrences(of: #"<[^>]+>"#, with: "", options: .regularExpression)
        return decodeEntities(s)
    }

    private static func decodeEntities(_ text: String) -> String {
        guard text.contains("&") else { return text }
        var s = text
        for (name, value) in [("&nbsp;", " "), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", "\""), ("&apos;", "'"), ("&ldquo;", "“"), ("&rdquo;", "”"), ("&lsquo;", "‘"), ("&rsquo;", "’"), ("&mdash;", "—"), ("&hellip;", "…")] {
            s = s.replacingOccurrences(of: name, with: value)
        }
        let numeric = try? NSRegularExpression(pattern: #"&#(x?)([0-9a-fA-F]+);"#)
        if let numeric {
            for m in numeric.matches(in: s, range: NSRange(s.startIndex..., in: s)).reversed() {
                guard let whole = Range(m.range, in: s), let digits = Range(m.range(at: 2), in: s), let flag = Range(m.range(at: 1), in: s) else { continue }
                let code = UInt32(s[digits], radix: s[flag].isEmpty ? 10 : 16).flatMap(Unicode.Scalar.init)
                if let code { s.replaceSubrange(whole, with: String(Character(code))) }
            }
        }
        return s.replacingOccurrences(of: "&amp;", with: "&")
    }

    private static func webArchiveHTML(_ data: Data) -> String? {
        guard let plist = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any],
              let main = plist["WebMainResource"] as? [String: Any], let body = main["WebResourceData"] as? Data else { return nil }
        return decodeText(body)
    }

    // ---------- 系统直接认识的 ----------
    private static func attributed(_ url: URL, type: NSAttributedString.DocumentType, name: String) throws -> String {
        do {
            return try NSAttributedString(url: url, options: [.documentType: type], documentAttributes: nil).string
        } catch {
            throw ImportError.unreadable(name)
        }
    }

    // ---------- PDF 和图片：有文字层读文字层，没有就识别 ----------
    private static func pdfText(_ url: URL, name: String) throws -> String {
        guard let doc = PDFDocument(url: url) else { throw ImportError.unreadable(name) }
        if doc.isLocked { throw ImportError.unreadable(name) }
        let text = (doc.string ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        // 每页平均不到 10 个字：多半是扫描版，页码之类的字不算
        if text.count >= max(10, doc.pageCount * 10) { return text }
        var pages: [String] = text.isEmpty ? [] : []
        for i in 0..<min(doc.pageCount, 300) {
            guard let page = doc.page(at: i) else { continue }
            let box = page.bounds(for: .mediaBox)
            let scale = min(3, 2400 / max(box.width, box.height, 1))
            let size = NSSize(width: box.width * scale, height: box.height * scale)
            let image = page.thumbnail(of: size, for: .mediaBox)
            if let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) {
                let found = recognize(cg)
                if !found.isEmpty { pages.append(found) }
            }
        }
        return pages.isEmpty ? text : pages.joined(separator: "\n\n")
    }

    private static func imageText(_ url: URL, name: String) throws -> String {
        guard let image = NSImage(contentsOf: url), let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
            throw ImportError.unsupported(name)
        }
        return recognize(cg)
    }

    private static func recognize(_ image: CGImage) -> String {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.recognitionLanguages = ["zh-Hans", "zh-Hant", "en-US"]
        request.usesLanguageCorrection = true
        try? VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
        return (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
    }

    // ---------- 老版 Office 和 WPS（OLE 容器） ----------
    private static func legacyOffice(_ url: URL, data: Data, name: String) throws -> String {
        if let s = try? NSAttributedString(url: url, options: [.documentType: NSAttributedString.DocumentType.docFormat], documentAttributes: nil).string,
           !s.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return s
        }
        let text = utf16Runs(data)
        if text.isEmpty { throw ImportError.empty(name) }
        return text
    }

    /// 从二进制里捞 UTF-16 的文字段。Office 的正文和幻灯片文字都这样存
    static func utf16Runs(_ data: Data) -> String {
        var runs: [String] = []
        var current: [UInt16] = []
        func flush() {
            if current.count >= 2 {
                let s = String(decoding: current, as: UTF16.self).trimmingCharacters(in: .whitespacesAndNewlines)
                let cjk = s.unicodeScalars.contains { (0x4E00...0x9FFF).contains($0.value) }
                let wordy = s.count >= 8 && s.contains(" ")
                if cjk || wordy, !runs.contains(s) { runs.append(s) }
            }
            current.removeAll(keepingCapacity: true)
        }
        data.withUnsafeBytes { (raw: UnsafeRawBufferPointer) in
            var i = 0
            while i + 1 < raw.count {
                let unit = UInt16(raw[i]) | UInt16(raw[i + 1]) << 8
                let readable = (0x20...0x7E).contains(unit) || unit == 9 || unit == 10 || unit == 13 || (0x3000...0x303F).contains(unit) || (0x4E00...0x9FFF).contains(unit) || (0xFF00...0xFFEF).contains(unit) || (0x2010...0x2027).contains(unit)
                if readable { current.append(unit) } else { flush() }
                i += 2
            }
        }
        flush()
        return runs.joined(separator: "\n")
    }

    // ---------- zip 容器：docx、pptx、xlsx、odt、epub、iWork ----------
    private static func zipText(_ data: Data, ext: String, url: URL, name: String) throws -> String {
        guard let zip = ZipArchive(data) else { throw ImportError.unreadable(name) }
        let names = zip.names
        if names.contains("word/document.xml") {
            if let s = try? NSAttributedString(url: url, options: [.documentType: NSAttributedString.DocumentType.officeOpenXML], documentAttributes: nil).string,
               !s.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                return s
            }
            return XMLText.read(zip.file("word/document.xml") ?? Data(), texts: ["w:t"], breaks: ["w:p"])
        }
        if names.contains(where: { $0.hasPrefix("ppt/slides/slide") }) {
            return numbered(names, prefix: "ppt/slides/slide").compactMap { zip.file($0) }.map { XMLText.read($0, texts: ["a:t"], breaks: ["a:p"]) }.joined(separator: "\n\n")
        }
        if names.contains("xl/sharedStrings.xml") || names.contains(where: { $0.hasPrefix("xl/worksheets/") }) {
            var parts: [String] = []
            if let shared = zip.file("xl/sharedStrings.xml") { parts.append(XMLText.read(shared, texts: ["t"], breaks: ["si"])) }
            for sheet in numbered(names, prefix: "xl/worksheets/sheet") {
                if let d = zip.file(sheet) { parts.append(XMLText.read(d, texts: ["t"], breaks: ["is"])) }
            }
            return parts.filter { !$0.isEmpty }.joined(separator: "\n")
        }
        if names.contains("content.xml") {
            return XMLText.read(zip.file("content.xml") ?? Data(), texts: ["text:p", "text:h", "text:span"], breaks: ["text:p", "text:h"])
        }
        if names.contains("META-INF/container.xml") {
            let pages = names.filter { $0.range(of: #"\.x?html?$"#, options: [.regularExpression, .caseInsensitive]) != nil && !$0.lowercased().contains("nav") && !$0.lowercased().contains("toc") }
            return epubOrder(zip, pages).compactMap { zip.file($0).flatMap(decodeText) }.map(htmlText).joined(separator: "\n\n")
        }
        if names.contains(where: { $0.hasSuffix(".iwa") }) || ["pages", "key", "numbers"].contains(ext) {
            if let preview = zip.file("QuickLook/Preview.pdf"), let doc = PDFDocument(data: preview), let s = doc.string, !s.isEmpty { return s }
            let parts = names.filter { $0.hasSuffix(".iwa") }.sorted(by: iWorkOrder).compactMap { zip.file($0) }.map(IWork.strings)
            return IWork.joined(parts)
        }
        // 别的 zip：把里面能读的文字文件连起来
        let plain = names.sorted().filter { ["txt", "md", "html", "htm", "xml", "csv"].contains(($0 as NSString).pathExtension.lowercased()) }
        let text = plain.compactMap { zip.file($0).flatMap(decodeText) }.joined(separator: "\n\n")
        if text.isEmpty { throw ImportError.unsupported(name) }
        return text
    }

    private static func numbered(_ names: [String], prefix: String) -> [String] {
        func index(_ s: String) -> Int { Int(s.dropFirst(prefix.count).prefix { $0.isNumber }) ?? 0 }
        return names.filter { $0.hasPrefix(prefix) && $0.hasSuffix(".xml") }.sorted { index($0) < index($1) }
    }

    /// 按 epub 目录的阅读顺序排
    private static func epubOrder(_ zip: ZipArchive, _ pages: [String]) -> [String] {
        guard let opfName = zip.names.first(where: { $0.hasSuffix(".opf") }), let opf = zip.file(opfName).flatMap(decodeText) else { return pages.sorted() }
        let base = (opfName as NSString).deletingLastPathComponent
        var byID: [String: String] = [:]
        for item in matches(in: opf, #"<item\b[^>]*>"#) {
            if let id = attribute("id", in: item), let href = attribute("href", in: item) { byID[id] = href.removingPercentEncoding ?? href }
        }
        let spine = matches(in: opf, #"<itemref\b[^>]*>"#).compactMap { attribute("idref", in: $0) }.compactMap { byID[$0] }
            .map { base.isEmpty ? $0 : "\(base)/\($0)" }.filter { zip.names.contains($0) }
        return spine.isEmpty ? pages.sorted() : spine
    }

    private static func matches(in text: String, _ pattern: String) -> [String] {
        guard let re = try? NSRegularExpression(pattern: pattern) else { return [] }
        return re.matches(in: text, range: NSRange(text.startIndex..., in: text)).compactMap { Range($0.range, in: text).map { String(text[$0]) } }
    }

    private static func attribute(_ name: String, in tag: String) -> String? {
        guard let re = try? NSRegularExpression(pattern: "\\b\(name)=\"([^\"]*)\""),
              let m = re.firstMatch(in: tag, range: NSRange(tag.startIndex..., in: tag)), let r = Range(m.range(at: 1), in: tag) else { return nil }
        return String(tag[r])
    }

    // ---------- iWork ----------
    private static func iWorkOrder(_ a: String, _ b: String) -> Bool {
        func rank(_ s: String) -> Int { s.contains("Document.iwa") ? 0 : s.contains("Slide") ? 1 : s.contains("DataList") ? 2 : 3 }
        return rank(a) == rank(b) ? a < b : rank(a) < rank(b)
    }

    private static func iWorkFolder(_ url: URL, name: String) throws -> String {
        let root = url.appendingPathComponent("Index.zip")
        if let data = try? Data(contentsOf: root), let zip = ZipArchive(data) {
            let parts = zip.names.filter { $0.hasSuffix(".iwa") }.sorted(by: iWorkOrder).compactMap { zip.file($0) }.map(IWork.strings)
            return IWork.joined(parts)
        }
        let preview = url.appendingPathComponent("QuickLook/Preview.pdf")
        if FileManager.default.fileExists(atPath: preview.path) { return try pdfText(preview, name: name) }
        throw ImportError.unsupported(name)
    }

    static func normalize(_ text: String) -> String {
        text.replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
            .replacingOccurrences(of: "\u{2028}", with: "\n")
            .replacingOccurrences(of: "\u{2029}", with: "\n")
            .replacingOccurrences(of: "\u{00A0}", with: " ")
            .replacingOccurrences(of: "\u{FFFC}", with: "")
            .replacingOccurrences(of: "\n{3,}", with: "\n\n", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

// ---------- 最小的 zip 读取：中央目录加 deflate ----------
nonisolated struct ZipArchive {
    private struct Entry {
        let method: UInt16
        let compressed: Int
        let size: Int
        let offset: Int
    }

    private let data: Data
    private var entries: [String: Entry] = [:]
    private(set) var names: [String] = []

    init?(_ data: Data) {
        self.data = data
        let bytes = [UInt8](data)
        guard bytes.count >= 22 else { return nil }
        var end = bytes.count - 22
        let floor = max(0, bytes.count - 66000)
        while end >= floor, !(bytes[end] == 0x50 && bytes[end + 1] == 0x4B && bytes[end + 2] == 5 && bytes[end + 3] == 6) { end -= 1 }
        guard end >= floor else { return nil }
        func u16(_ i: Int) -> Int { Int(bytes[i]) | Int(bytes[i + 1]) << 8 }
        func u32(_ i: Int) -> Int { u16(i) | u16(i + 2) << 16 }
        var at = u32(end + 16)
        for _ in 0..<u16(end + 10) {
            guard at + 46 <= bytes.count, bytes[at] == 0x50, bytes[at + 1] == 0x4B, bytes[at + 2] == 1, bytes[at + 3] == 2 else { break }
            let nameLength = u16(at + 28)
            guard at + 46 + nameLength <= bytes.count else { break }
            let name = String(decoding: bytes[(at + 46)..<(at + 46 + nameLength)], as: UTF8.self)
            entries[name] = Entry(method: UInt16(u16(at + 10)), compressed: u32(at + 20), size: u32(at + 24), offset: u32(at + 42))
            names.append(name)
            at += 46 + nameLength + u16(at + 30) + u16(at + 32)
        }
        if names.isEmpty { return nil }
    }

    func file(_ name: String) -> Data? {
        guard let e = entries[name], e.offset + 30 <= data.count else { return nil }
        let base = data.startIndex + e.offset
        let nameLength = Int(data[base + 26]) | Int(data[base + 27]) << 8
        let extra = Int(data[base + 28]) | Int(data[base + 29]) << 8
        let start = base + 30 + nameLength + extra
        guard start + e.compressed <= data.endIndex else { return nil }
        let raw = data[start..<(start + e.compressed)]
        if e.method == 0 { return Data(raw) }
        guard e.method == 8, e.size > 0 else { return e.size == 0 ? Data() : nil }
        var out = Data(count: e.size)
        let written = out.withUnsafeMutableBytes { (dst: UnsafeMutableRawBufferPointer) -> Int in
            raw.withUnsafeBytes { (src: UnsafeRawBufferPointer) -> Int in
                compression_decode_buffer(dst.bindMemory(to: UInt8.self).baseAddress!, e.size, src.bindMemory(to: UInt8.self).baseAddress!, e.compressed, nil, COMPRESSION_ZLIB)
            }
        }
        return written == e.size ? out : nil
    }
}

// ---------- 从 XML 里取文字 ----------
nonisolated final class XMLText: NSObject, XMLParserDelegate {
    private let texts: Set<String>
    private let breaks: Set<String>
    private var depth = 0
    private var out = ""

    private init(texts: Set<String>, breaks: Set<String>) {
        self.texts = texts
        self.breaks = breaks
    }

    static func read(_ data: Data, texts: Set<String>, breaks: Set<String>) -> String {
        let reader = XMLText(texts: texts, breaks: breaks)
        let parser = XMLParser(data: data)
        parser.delegate = reader
        parser.parse()
        return reader.out
    }

    func parser(_ parser: XMLParser, didStartElement name: String, namespaceURI: String?, qualifiedName q: String?, attributes: [String: String] = [:]) {
        if texts.contains(q ?? name) { depth += 1 }
    }

    func parser(_ parser: XMLParser, didEndElement name: String, namespaceURI: String?, qualifiedName q: String?) {
        let tag = q ?? name
        if texts.contains(tag) { depth -= 1 }
        if breaks.contains(tag), !out.isEmpty, !out.hasSuffix("\n") { out += "\n" }
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) {
        if depth > 0 { out += string }
    }
}

// ---------- iWork 的 .iwa：分段的 snappy 压缩，里面是 protobuf ----------
nonisolated enum IWork {
    /// 不解析完整结构：解压后取可读的文字段，过滤样式名这类内部名字
    static func strings(_ iwa: Data) -> [String] {
        let bytes = decompress([UInt8](iwa))
        var found: [String] = []
        var i = 0
        // protobuf 字符串：长度前缀加 UTF-8。逐个位置试，能完整解成可读文字才算
        while i < bytes.count {
            var length = 0
            var shift = 0
            var j = i
            while j < bytes.count, shift < 28 {
                let b = bytes[j]
                length |= Int(b & 0x7F) << shift
                j += 1
                if b & 0x80 == 0 { break }
                shift += 7
            }
            // 字符串字段的标记：字段号任意，线路类型 2
            let tagged = i > 0 && bytes[i - 1] & 0x07 == 2
            if tagged, length >= 2, length <= 2_000_000, j + length <= bytes.count {
                let slice = bytes[j..<(j + length)]
                if let s = String(bytes: slice, encoding: .utf8), isContent(s) {
                    found.append(s)
                    i = j + length
                    continue
                }
            }
            i += 1
        }
        return found
    }

    private static func isContent(_ s: String) -> Bool {
        var cjk = 0
        var letters = 0
        for u in s.unicodeScalars {
            if u.value < 0x20, u.value != 9, u.value != 10, u.value != 13 { return false }
            if u.value == 0xFFFD || (0xE000...0xF8FF).contains(u.value) { return false }
            if (0x4E00...0x9FFF).contains(u.value) { cjk += 1 } else if u.properties.isAlphabetic { letters += 1 }
        }
        if cjk >= 2 { return !isInternalName(s) && !isStyleName(s) }
        // 英文：要有空格，够长，排除样式名和路径。Fill Left、Body Text 这种都短
        return letters >= 8 && s.count >= 24 && s.contains(" ") && !isInternalName(s)
    }

    // 模板自带的样式名、日期格式。多个文件统计出来的，每个 iWork 文件都有
    private static let styleNames: Set<String> = ["项目符号", "正文", "链接", "编号", "说明", "标签", "图像", "字母", "带圆圈编号", "中文大写数字－简体", "中文小写数字－简体", "大标题", "标题", "副标题", "小标题", "对象标题", "对象说明", "页眉与页脚", "页眉", "页脚", "斜体", "粗体", "默认", "上午", "下午", "脚注", "题注", "引文", "引用", "下划线", "删除线", "目录", "加重", "大项目符号", "破折号", "笔记", "哈佛样式", "自由格式", "白色", "黑色", "照片", "幻灯片标题", "空白", "标题与副标题", "标题与项目符号", "标题、项目符号与照片"]

    private static func isStyleName(_ raw: String) -> Bool {
        let s = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if styleNames.contains(s) { return true }
        if s.range(of: #"^.{1,4}（(粗体|斜体|深色|浅色|红色|白色|黑色)）$"#, options: .regularExpression) != nil { return true }
        return s.range(of: #"^(表格样式|表格标题|图表样式|形状样式|文本样式|线条样式|标题|小标题|大标题|标签|说明|项目符号|正文级别|目录小标题|表格)\s*\d*(（[^）]*）)?$"#, options: .regularExpression) != nil
            || s.range(of: #"^(周[一二三四五六日]|星期[一二三四五六日天]|[一二三四五六七八九十]+月)$"#, options: .regularExpression) != nil
    }

    private static func isInternalName(_ s: String) -> Bool {
        s.contains("/") && !s.contains(" ") || s.hasPrefix("http") || s.hasPrefix("com.apple") || s.range(of: #"^[A-Za-z0-9_.\-]+$"#, options: .regularExpression) != nil
    }

    static func joined(_ parts: [[String]]) -> String {
        var seen = Set<String>()
        var out: [String] = []
        for s in parts.flatMap({ $0 }) where seen.insert(s).inserted { out.append(s) }
        return out.joined(separator: "\n")
    }

    /// iwa 的分块：1 字节 0、3 字节小端长度、snappy 块（没有文件头和校验）
    private static func decompress(_ data: [UInt8]) -> [UInt8] {
        var out: [UInt8] = []
        var i = 0
        while i + 4 <= data.count {
            guard data[i] == 0 else { break }
            let length = Int(data[i + 1]) | Int(data[i + 2]) << 8 | Int(data[i + 3]) << 16
            i += 4
            guard i + length <= data.count else { break }
            snappy(data, from: i, to: i + length, into: &out)
            i += length
        }
        return out
    }

    private static func snappy(_ d: [UInt8], from: Int, to: Int, into out: inout [UInt8]) {
        var i = from
        // 开头是解压后长度
        while i < to, d[i] & 0x80 != 0 { i += 1 }
        i += 1
        let base = out.count
        while i < to {
            let tag = d[i]
            i += 1
            switch tag & 3 {
            case 0:
                var n = Int(tag >> 2)
                if n >= 60 {
                    let extra = n - 59
                    guard i + extra <= to else { return }
                    n = 0
                    for k in 0..<extra { n |= Int(d[i + k]) << (8 * k) }
                    i += extra
                }
                n += 1
                guard i + n <= to else { return }
                out.append(contentsOf: d[i..<(i + n)])
                i += n
            case 1:
                guard i < to else { return }
                copy(&out, base: base, length: 4 + Int((tag >> 2) & 7), offset: Int(tag >> 5) << 8 | Int(d[i]))
                i += 1
            case 2:
                guard i + 2 <= to else { return }
                copy(&out, base: base, length: 1 + Int(tag >> 2), offset: Int(d[i]) | Int(d[i + 1]) << 8)
                i += 2
            default:
                guard i + 4 <= to else { return }
                copy(&out, base: base, length: 1 + Int(tag >> 2), offset: Int(d[i]) | Int(d[i + 1]) << 8 | Int(d[i + 2]) << 16 | Int(d[i + 3]) << 24)
                i += 4
            }
        }
    }

    private static func copy(_ out: inout [UInt8], base: Int, length: Int, offset: Int) {
        guard offset > 0, out.count - offset >= base else { return }
        for _ in 0..<length { out.append(out[out.count - offset]) }
    }
}
