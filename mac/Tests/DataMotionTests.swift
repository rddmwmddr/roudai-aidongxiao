import SwiftUI
import AppKit
import CoreGraphics
import CoreText
import Foundation
import Testing
@testable import DataMotion

@Suite("分镜文件")
struct BoardFileTests {
    @Test("旧文件里的出镜镜头打开时变成动效，口播不动")
    func oldARollBecomesMotion() throws {
        let json = """
        {"title":"旧文件","rows":[{"id":1,"no":"001","kind":"A","cat":"出镜","line":"这是一段出镜的口播。","tpl":"aroll"},{"id":2,"no":"002","line":"没写模板的一镜"}]}
        """
        let board = try BoardDocument.decode(Data(json.utf8))
        #expect(board.rows[0].template == "statement")
        #expect(board.rows[0].line == "这是一段出镜的口播。")
        #expect(board.rows[0].lines == ["这是一段出镜的口播"])
        #expect(board.rows[0].kind == "B")
        #expect(board.rows[1].template == "statement")
    }

    @Test("手动时长写进文件，可以清掉")
    func duration() throws {
        var shot = Shot(fields: ["id": .number(1), "line": .string("一句话"), "tpl": .string("statement")])
        #expect(shot.duration == nil)
        shot.duration = 6.4
        #expect(shot.fields["dur"]?.number == 6.4)
        shot.duration = nil
        #expect(shot.fields["dur"] == nil)
    }

    @Test("读写一圈，模板专用字段和元素调整都不丢")
    func roundTrip() throws {
        let json = """
        {"title":"测试","rows":[{"id":1,"no":"001","ch":"第一章","kind":"B","cat":"数据动效","line":"有45%","tpl":"comb",
        "groups":[{"title":"","relation":"single","metrics":[{"caption":"很少复查","value":45,"note":{"text":"基数"}}]}],
        "points":[{"label":"去年","v":14}],"layers":{"comb":{"bars:0":{"m":[1,0,0,2,0,-100],"speed":1.5,"anchor":0.1,"end":3}}}}]}
        """
        let board = try BoardDocument.decode(Data(json.utf8))
        let again = try BoardDocument.decode(try BoardDocument.encode(board))
        #expect(again == board)
        #expect(again.rows[0].fields["points"] != nil)
        #expect(again.rows[0].adjustedElementCount == 1)
        #expect(again.rows[0].groups[0].metrics[0].extra["note"] != nil)
    }

    @Test("元素调整按模板分开存，换模板再换回来还在")
    func layersPerTemplate() {
        var shot = Shot(fields: ["id": .number(1), "tpl": .string("comb")])
        shot.setLayers(#"{"bars:0":{"alpha":0.5}}"#, for: "comb")
        shot.template = "dots"
        #expect(shot.adjustedElementCount == 0)
        shot.template = "comb"
        #expect(shot.adjustedElementCount == 1)
        shot.setLayers("{}", for: "comb")
        #expect(shot.fields["layers"] == nil)
    }

    @Test("改一个数不影响同组其他字段")
    func metricEdit() throws {
        let row = #"{"id":1,"groups":[{"title":"甲","relation":"nested","metrics":[{"caption":"每周","value":66,"prefix":"有"},{"caption":"每天","value":37}]}]}"#
        var shot = try JSONDecoder().decode(Shot.self, from: Data(row.utf8))
        var g = shot.groups
        g[0].metrics[1].value = 40
        shot.groups = g
        #expect(shot.groups[0].metrics[1].value == 40)
        #expect(shot.groups[0].metrics[0].prefix == "有")
        #expect(shot.groups[0].relation == "nested")
    }
}

@Suite("文稿导入")
struct ImportTests {
    private func temp(_ name: String, _ data: Data) throws -> URL {
        let dir = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let url = dir.appending(path: name)
        try data.write(to: url)
        return url
    }

    @Test("UTF-8 文本")
    func utf8() throws {
        let url = try temp("稿.txt", Data("第一章\r\n有45%的人\r\n".utf8))
        #expect(try ScriptImporter.read(url) == "第一章\n有45%的人")
    }

    @Test("GBK 文本")
    func gbk() throws {
        let enc = String.Encoding(rawValue: CFStringConvertEncodingToNSStringEncoding(CFStringEncoding(CFStringEncodings.GB_18030_2000.rawValue)))
        let url = try temp("稿.txt", try #require("有45%的人".data(using: enc)))
        #expect(try ScriptImporter.read(url) == "有45%的人")
    }

    @Test("RTF 和 HTML")
    func attributed() throws {
        let rtf = try temp("稿.rtf", Data(#"{\rtf1\ansi Hello 45%}"#.utf8))
        #expect(try ScriptImporter.read(rtf).contains("Hello 45%"))
        let html = try temp("稿.html", Data("<html><meta charset=utf-8><body><p>有45%</p></body></html>".utf8))
        #expect(try ScriptImporter.read(html).contains("有45%"))
    }

    @Test("Word 文档")
    func docx() throws {
        let text = NSAttributedString(string: "第一章\n有45%的人很少复查。\n")
        let data = try text.data(from: NSRange(location: 0, length: text.length), documentAttributes: [.documentType: NSAttributedString.DocumentType.officeOpenXML])
        let url = try temp("稿.docx", data)
        let read = try ScriptImporter.read(url)
        #expect(read.contains("第一章"))
        #expect(read.contains("有45%的人很少复查。"))
    }

    @Test("带文字层的 PDF")
    func pdf() throws {
        let out = NSMutableData()
        var box = CGRect(x: 0, y: 0, width: 600, height: 400)
        let consumer = try #require(CGDataConsumer(data: out))
        let ctx = try #require(CGContext(consumer: consumer, mediaBox: &box, nil))
        ctx.beginPDFPage(nil)
        let font = CTFontCreateWithName("PingFangSC-Regular" as CFString, 24, nil)
        let line = CTLineCreateWithAttributedString(NSAttributedString(string: "有45%的人很少复查", attributes: [.font: font]))
        ctx.textPosition = CGPoint(x: 40, y: 200)
        CTLineDraw(line, ctx)
        ctx.endPDFPage()
        ctx.closePDF()
        let url = try temp("稿.pdf", out as Data)
        #expect(try ScriptImporter.read(url).contains("45%"))
    }

    @Test("扫描版 PDF 读不到字时说清楚怎么办")
    func scannedPDF() throws {
        let out = NSMutableData()
        var box = CGRect(x: 0, y: 0, width: 100, height: 100)
        let consumer = try #require(CGDataConsumer(data: out))
        let ctx = try #require(CGContext(consumer: consumer, mediaBox: &box, nil))
        ctx.beginPDFPage(nil)
        ctx.fill(CGRect(x: 10, y: 10, width: 20, height: 20))
        ctx.endPDFPage()
        ctx.closePDF()
        let url = try temp("扫描.pdf", out as Data)
        #expect(throws: ScriptImporter.ImportError.self) { try ScriptImporter.read(url) }
    }

    @Test("不支持的格式给出能照做的提示")
    func unsupported() throws {
        let junk = try temp("稿.xyz", Data((0..<4000).map { UInt8($0 % 251) }))
        #expect(throws: ScriptImporter.ImportError.self) { try ScriptImporter.read(junk) }
        // 不认识的扩展名，内容是文字就当文字
        #expect(try ScriptImporter.read(try temp("稿.abc", Data("有45%的人".utf8))) == "有45%的人")
    }

    private func fixture(_ name: String) throws -> URL {
        let bundle = Bundle(for: WindowDriver.self)
        let parts = name.split(separator: ".")
        return try #require(bundle.url(forResource: String(parts[0]), withExtension: String(parts[1])))
    }

    @Test("所有文档格式：每种都读出同一句话", arguments: ["样稿.pptx", "样稿.xlsx", "样稿.odt", "样稿.odp", "样稿.ods", "样稿.epub", "样稿.docx", "样稿.doc", "样稿.srt", "样稿.vtt", "样稿.ass", "样稿.lrc", "样稿.csv", "样稿.json", "样稿.xml", "样稿.fdx", "样稿.tex", "样稿.webarchive", "样稿.mhtml", "样稿.png", "样稿.pages"])
    func everyFormat(_ name: String) throws {
        let url = try fixture(name)
        let text = try ScriptImporter.read(url)
        #expect(text.contains("72") && text.contains("拿铁"), "\(name) 读到：\(text.prefix(80))")
    }

    @Test("字幕去掉序号和时间码")
    func subtitles() {
        let srt = "1\n00:00:01,000 --> 00:00:02,000\n第一句\n\n2\n00:00:02,000 --> 00:00:03,000\n第二句\n"
        #expect(ScriptImporter.subtitleText(srt) == "第一句\n第二句")
    }

    @Test("打开软件：第一个窗口是示例分镜，之后新建是空文档")
    func openingShowsSample() {
        BoardDocument.opensSample = true
        let first = BoardDocument.opening()
        let second = BoardDocument.opening()
        #expect(first.isSample && first.board.rows.count >= 10)
        #expect(!second.isSample && second.board.rows.isEmpty)
    }
}

@Suite("AI 配置导入")
struct AIConfigTests {
    @Test("JSON：Claude")
    func claudeJSON() throws {
        let list = try AIConfigImporter.parse(#"{"provider":"anthropic","api_key":"sk-ant-test"}"#)
        #expect(list.count == 1)
        #expect(list[0].kind == .anthropic)
        #expect(list[0].baseURL == "https://api.anthropic.com")
        #expect(list[0].model == "claude-opus-5-5")
        #expect(list[0].apiKey == "sk-ant-test")
    }

    @Test("JSON：自定义兼容接口")
    func customJSON() throws {
        let list = try AIConfigImporter.parse(#"{"name":"内网","base_url":"http://127.0.0.1:9000/v1","api_key":"abc","model":"m1"}"#)
        #expect(list == [ImportedAIConfig(name: "内网", kind: .openAICompatible, baseURL: "http://127.0.0.1:9000/v1", model: "m1", apiKey: "abc")])
    }

    @Test("JSON：多个服务放在 providers 下")
    func nested() throws {
        let list = try AIConfigImporter.parse(#"{"providers":{"deepseek":{"api_key":"a","base_url":"https://api.deepseek.com/v1","model":"deepseek-v4-pro"},"kimi":{"api_key":"b","base_url":"https://api.moonshot.cn/v1"}}}"#)
        #expect(list.count == 2)
    }

    @Test(".env：认识的服务商和带 BASE_URL 的未知服务商")
    func env() throws {
        let text = """
        # 注释
        export DEEPSEEK_API_KEY="sk-1"
        XIAOMI_API_KEY=tp-2
        XIAOMI_BASE_URL=https://token-plan.example.com/v1
        FOO_API_KEY=x
        FOO_BASE_URL=https://foo.example.com/v1
        BAR_API_KEY=没有地址的不导入
        """
        let list = try AIConfigImporter.parse(text)
        #expect(list.map(\.name).contains("DeepSeek"))
        #expect(list.first { $0.name == "小米 MiMo" }?.baseURL == "https://token-plan.example.com/v1")
        #expect(list.first { $0.name == "Foo" }?.baseURL == "https://foo.example.com/v1")
        #expect(!list.contains { $0.apiKey == "没有地址的不导入" })
    }

    @Test("没有 Key 时明确报错")
    func nothing() {
        #expect(throws: AIConfigImporter.ImportError.nothing) { try AIConfigImporter.parse("随便一段文字") }
    }
}

@Suite("钥匙串")
struct KeychainTests {
    @Test("写入、读取、替换、删除")
    func cycle() throws {
        let account = "test-\(UUID().uuidString)"
        defer { Keychain.delete(account: account) }
        try Keychain.save("甲", account: account)
        #expect(Keychain.read(account: account) == "甲")
        try Keychain.save("乙", account: account)
        #expect(Keychain.read(account: account) == "乙")
        Keychain.delete(account: account)
        #expect(Keychain.read(account: account) == nil)
    }
}

@Suite("分镜切段")
struct ChunkTests {
    @Test("按章节切开")
    func chapters() {
        let text = "序\n开头一句\n第一章\n第一章内容\n第二章：副标题\n第二章内容"
        let chunks = StoryboardPrompt.chunks(of: text)
        #expect(chunks.map(\.chapter) == ["序", "第一章", "第二章"])
        #expect(chunks[1].text == "第一章内容")
    }

    @Test("太长的章按段落再切，文字不丢")
    func long() {
        let para = String(repeating: "字", count: 900)
        let text = "第一章\n" + Array(repeating: para, count: 6).joined(separator: "\n")
        let chunks = StoryboardPrompt.chunks(of: text, limit: 2000)
        #expect(chunks.count == 3)
        #expect(chunks.map(\.text).joined(separator: "\n").count == 6 * 900 + 5)
    }

    @Test("解析模型回答：data 里的字段并进镜头，代码块包裹也能读")
    func decode() throws {
        let reply = """
        ```json
        {"rows":[{"line":"有45%","kind":"B","cat":"数据动效","tpl":"comb","visual":"竖条","note":"","data":"{\\"groups\\":[{\\"title\\":\\"\\",\\"relation\\":\\"single\\",\\"metrics\\":[{\\"caption\\":\\"很少\\",\\"value\\":45}]}]}"}]}
        ```
        """
        let rows = try StoryboardPrompt.decodeRows(reply, chapter: "第一章")
        #expect(rows.count == 1)
        #expect(rows[0].chapter == "第一章")
        #expect(rows[0].groups[0].metrics[0].value == 45)
        #expect(rows[0].note.isEmpty)
    }
}

// 用假服务验证 HTTP 请求和错误提示，不碰真实的 Key
nonisolated final class MockProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var handler: (@Sendable (URLRequest) -> (Int, Data))?
    nonisolated(unsafe) static var lastRequest: URLRequest?
    nonisolated(unsafe) static var lastBody: Data?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func stopLoading() {}

    override func startLoading() {
        Self.lastRequest = request
        if let stream = request.httpBodyStream {
            stream.open()
            var data = Data()
            let size = 65536
            let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: size)
            defer { buffer.deallocate() }
            while stream.hasBytesAvailable {
                let n = stream.read(buffer, maxLength: size)
                if n <= 0 { break }
                data.append(buffer, count: n)
            }
            stream.close()
            Self.lastBody = data
        } else {
            Self.lastBody = request.httpBody
        }
        let (code, data) = Self.handler?(request) ?? (500, Data())
        let response = HTTPURLResponse(url: request.url!, statusCode: code, httpVersion: nil, headerFields: ["Content-Type": "text/event-stream"])!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }
}

@Suite("AI 接口", .serialized)
struct AIClientTests {
    private func session() -> URLSession {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockProtocol.self]
        return URLSession(configuration: config)
    }

    private let claude = AIProfile(name: "Claude", kind: .anthropic, baseURL: "https://api.anthropic.com", model: "claude-opus-5-5")
    private let compat = AIProfile(name: "兼容", kind: .openAICompatible, baseURL: "https://x.example.com/v1/", model: "m")

    @Test("Claude：请求格式和流式解析")
    func claudeStream() async throws {
        MockProtocol.handler = { _ in
            let sse = """
            event: content_block_delta
            data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"你"}}

            event: content_block_delta
            data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"好"}}

            event: message_delta
            data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}

            """
            return (200, Data(sse.utf8))
        }
        let client = AIClient(profile: claude, apiKey: "sk-ant-x", session: session())
        let text = try await client.generate(system: "s", user: "u", schema: ["type": "object"]) { _ in }
        #expect(text == "你好")
        let r = try #require(MockProtocol.lastRequest)
        #expect(r.url?.absoluteString == "https://api.anthropic.com/v1/messages")
        #expect(r.value(forHTTPHeaderField: "x-api-key") == "sk-ant-x")
        #expect(r.value(forHTTPHeaderField: "anthropic-version") == "2026-10-21")
        #expect(r.value(forHTTPHeaderField: "anthropic-beta") == "server-side-fallback-2026-07-01")
        let sent = try #require(MockProtocol.lastBody)
        let body = try #require(try JSONSerialization.jsonObject(with: sent) as? [String: Any])
        #expect(body["model"] as? String == "claude-opus-5-5")
        #expect(body["stream"] as? Bool == true)
        #expect(body["fallbacks"] as? String == "default")
        #expect(body["thinking"] == nil)
        #expect(body["temperature"] == nil)
        let out = try #require(body["output_config"] as? [String: Any])
        #expect(out["effort"] as? String == "high")
        #expect((out["format"] as? [String: Any])?["type"] as? String == "json_schema")
    }

    @Test("Claude：先看 stop_reason，拒绝和截断都要报出来")
    func claudeStops() async throws {
        for (reason, expected) in [("refusal", AIError.refused), ("max_tokens", AIError.truncated)] {
            MockProtocol.handler = { _ in
                (200, Data("data: {\"type\":\"content_block_delta\",\"delta\":{\"type\":\"text_delta\",\"text\":\"半\"}}\n\ndata: {\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"\(reason)\"}}\n\n".utf8))
            }
            let client = AIClient(profile: claude, apiKey: "k", session: session())
            await #expect(throws: expected) {
                _ = try await client.generate(system: "s", user: "u", schema: nil) { _ in }
            }
        }
    }

    @Test("第三方代理不发只有官方接口认识的字段")
    func proxyNoFallback() async throws {
        MockProtocol.handler = { _ in (200, Data("data: {\"type\":\"content_block_delta\",\"delta\":{\"type\":\"text_delta\",\"text\":\"好\"}}\n\n".utf8)) }
        var p = claude
        p.baseURL = "https://proxy.example.com"
        _ = try await AIClient(profile: p, apiKey: "k", session: session()).generate(system: "s", user: "u", schema: nil) { _ in }
        let sent = try #require(MockProtocol.lastBody)
        let body = try #require(try JSONSerialization.jsonObject(with: sent) as? [String: Any])
        #expect(body["fallbacks"] == nil)
        #expect(MockProtocol.lastRequest?.value(forHTTPHeaderField: "anthropic-beta") == nil)
    }

    @Test("兼容接口：地址拼接、鉴权头、流式解析")
    func openAIStream() async throws {
        MockProtocol.handler = { _ in
            (200, Data("data: {\"choices\":[{\"delta\":{\"content\":\"甲\"}}]}\n\ndata: {\"choices\":[{\"delta\":{\"content\":\"乙\"},\"finish_reason\":\"stop\"}]}\n\ndata: [DONE]\n\n".utf8))
        }
        let client = AIClient(profile: compat, apiKey: "k1", session: session())
        let text = try await client.generate(system: "s", user: "u", schema: ["type": "object"]) { _ in }
        #expect(text == "甲乙")
        let r = try #require(MockProtocol.lastRequest)
        #expect(r.url?.absoluteString == "https://x.example.com/v1/chat/completions")
        #expect(r.value(forHTTPHeaderField: "Authorization") == "Bearer k1")
    }

    @Test("错误码变成能照做的提示，4xx 不重试")
    func errors() async throws {
        nonisolated(unsafe) var calls = 0
        MockProtocol.handler = { _ in
            calls += 1
            return (401, Data(#"{"error":{"message":"bad key"}}"#.utf8))
        }
        let client = AIClient(profile: compat, apiKey: "k", session: session())
        await #expect(throws: AIError.unauthorized("兼容")) {
            _ = try await client.generate(system: "s", user: "u", schema: nil) { _ in }
        }
        #expect(calls == 1)
    }

    @Test("模型列表")
    func models() async throws {
        MockProtocol.handler = { _ in (200, Data(#"{"data":[{"id":"b"},{"id":"a"}]}"#.utf8)) }
        let list = try await AIClient(profile: compat, apiKey: "k", session: session()).listModels()
        #expect(list == ["a", "b"])
    }

    @Test("缺模型、坏地址都在发请求之前拦下")
    func preflight() async {
        var noModel = compat
        noModel.model = ""
        await #expect(throws: AIError.missingModel("兼容")) {
            _ = try await AIClient(profile: noModel, apiKey: "k", session: session()).generate(system: "s", user: "u", schema: nil) { _ in }
        }
        var bad = compat
        bad.baseURL = "不是地址"
        await #expect(throws: AIError.badURL("不是地址")) {
            _ = try await AIClient(profile: bad, apiKey: "k", session: session()).generate(system: "s", user: "u", schema: nil) { _ in }
        }
    }
}

@Suite("导出核对")
struct VerifyTests {
    @Test("颜色分类能发现错位")
    func classify() {
        // 4 × 1 的图：前两格橙，后两格灰
        let w = 4
        var px: [UInt8] = []
        for i in 0..<w { px += i < 2 ? [255, 92, 30, 255] : [54, 54, 58, 255] }
        let space = CGColorSpace(name: CGColorSpace.sRGB)!
        let ctx = CGContext(data: &px, width: w, height: 1, bitsPerComponent: 8, bytesPerRow: w * 4, space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
        let image = ctx.makeImage()!
        let shades = [ProbeInfo.Shade(name: "primary", rgb: [255, 92, 30]), ProbeInfo.Shade(name: "dim", rgb: [54, 54, 58])]
        let k = 1920.0 / Double(w)
        let points = (0..<w).map { [(Double($0) + 0.25) * k, 0.0] }
        let right = ProbeInfo(duration: 1, edited: false, shades: shades, rows: [.init(title: "对", points: points, expect: ["primary", "primary", "dim", "dim"])])
        #expect(ExportVerifier.classify(image: image, probes: right)[0].mismatched == 0)
        let wrong = ProbeInfo(duration: 1, edited: false, shades: shades, rows: [.init(title: "错", points: points, expect: ["primary", "dim", "dim", "dim"])])
        #expect(ExportVerifier.classify(image: image, probes: wrong)[0].mismatched == 1)
    }

    @Test("文件名去掉不能用的字符")
    func fileName() {
        let shot = Shot(fields: ["id": .number(3), "no": .string("003")])
        #expect(BatchRunner.fileName(for: shot, templateName: "出镜/无动效", size: .uhd, fps: 60) == "003_出镜无动效_4K60.mp4")
    }
}

// 系统在每次事件循环结束时关闭撤销分组，这里手动模拟：一个动作一组
@Suite("撤销")
struct BoardDocumentUndoTests {
    @Test("每个动作单独一步，名字对得上，撤销重做都准")
    func steps() {
        let undo = UndoManager()
        undo.groupsByEvent = false
        let doc = BoardDocument(board: Board(title: "甲", rows: [], script: nil))
        func act(_ name: String, _ title: String) {
            undo.beginUndoGrouping()
            var next = doc.board
            next.title = title
            doc.update(next, undoManager: undo, action: name)
            undo.endUndoGrouping()
        }
        act("移动元素", "乙")
        act("改速度", "丙")
        #expect(undo.undoActionName == "改速度")
        undo.undo()
        #expect(doc.board.title == "乙")
        #expect(undo.undoActionName == "移动元素")
        #expect(undo.redoActionName == "改速度")
        undo.undo()
        #expect(doc.board.title == "甲")
        #expect(!undo.canUndo)
        undo.redo()
        #expect(doc.board.title == "乙")
        undo.redo()
        #expect(doc.board.title == "丙")
    }

    @Test("后台线程取快照不崩，拿到的是最新内容")
    func snapshotOffMain() async throws {
        let doc = BoardDocument(board: Board(title: "甲", rows: [], script: nil))
        var next = doc.board
        next.title = "乙"
        doc.update(next, undoManager: nil)
        let title = await Task.detached { try doc.snapshot(contentType: .dataMotionBoard).title }.result
        #expect(try title.get() == "乙")
    }

    @Test("内容没变不产生撤销步骤")
    func noChange() {
        let undo = UndoManager()
        undo.groupsByEvent = false
        let doc = BoardDocument()
        undo.beginUndoGrouping()
        doc.update(doc.board, undoManager: undo, action: "没变")
        undo.endUndoGrouping()
        #expect(undo.undoActionName != "没变")
    }
}


// ---------- 按钮的配色 ----------
@Suite("按钮")
struct ButtonShapeTests {
    private func components(_ color: Color, _ appearance: NSAppearance.Name) -> (r: Double, g: Double, b: Double, a: Double) {
        var out = (r: 0.0, g: 0.0, b: 0.0, a: 1.0)
        NSAppearance(named: appearance)?.performAsCurrentDrawingAppearance {
            if let c = NSColor(color).usingColorSpace(.sRGB) {
                out = (Double(c.redComponent), Double(c.greenComponent), Double(c.blueComponent), Double(c.alphaComponent))
            }
        }
        return out
    }

    private func luminance(_ c: (r: Double, g: Double, b: Double)) -> Double {
        func f(_ v: Double) -> Double { v <= 0.03928 ? v / 12.92 : pow((v + 0.055) / 1.055, 2.4) }
        return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
    }

    private func contrast(_ a: (r: Double, g: Double, b: Double), _ b: (r: Double, g: Double, b: Double)) -> Double {
        let x = luminance(a), y = luminance(b)
        return (max(x, y) + 0.05) / (min(x, y) + 0.05)
    }

    @Test("完成和删除的文字对比度够")
    func contrasts() {
        let white = (r: 1.0, g: 1.0, b: 1.0)
        for name in [NSAppearance.Name.aqua, .darkAqua] {
            let fill = components(.doneFill, name)
            #expect(contrast((fill.r, fill.g, fill.b), white) >= 4.5)
            // 浅色底用窗口的白，深色底用窗口的深灰
            let base = name == .aqua ? (r: 1.0, g: 1.0, b: 1.0) : (r: 0.17, g: 0.17, b: 0.18)
            for (soft, ink) in [(Color.doneSoft, Color.doneInk), (Color.dangerSoft, Color.dangerInk)] {
                let s = components(soft, name)
                let i = components(ink, name)
                let blended = (r: s.r * s.a + base.r * (1 - s.a), g: s.g * s.a + base.g * (1 - s.a), b: s.b * s.a + base.b * (1 - s.a))
                #expect(contrast((i.r, i.g, i.b), blended) >= 4.5)
            }
        }
    }
}

@Suite("A-roll")
struct ARollTests {
    /// 按字生成时间：每字 0.2 秒，带 | 的地方停 0.5 秒（停顿算进下一个字）
    private func tokens(_ text: String) -> [ARollToken] {
        var out: [ARollToken] = []
        var t = 0.0
        var pause = 0.0
        for ch in text {
            if ch == "|" {
                pause = 0.5
                continue
            }
            let length = 0.2 + pause
            out.append(ARollToken(text: String(ch), start: t, end: t + length))
            t += length
            pause = 0
        }
        return out
    }

    @Test("靠停顿断句：没有标点也能拆开，短的用逗号")
    func sentences() {
        let text = ARollText.script(from: tokens("欢迎收看重构调研|你好|我们询问了很多朋友"))
        #expect(text == "欢迎收看重构调研。你好，我们询问了很多朋友。")
    }

    @Test("识别结果自带的标点留着，不重复")
    func keepsPunctuation() {
        var list = tokens("你会问吗")
        list.append(ARollToken(text: " ？", start: 0.8, end: 0.9))
        list += tokens("|我们问了")
        let text = ARollText.script(from: list)
        #expect(text == "你会问吗？我们问了。")
    }

    @Test("每一镜的时长接起来正好是整段声音，第一镜从 0 开始")
    func aligned() {
        let list = tokens("第一句话说的是这件事情第二句话说的是那件事情第三句话说的是另一件事")
        let lines = ["第一句话说的是这件事情。", "第二句话说的是那件事情。", "第三句话说的是另一件事。"]
        let duration = list.last!.end
        let result = ARollAligner.align(lines: lines, tokens: list, duration: duration)
        #expect(result.matched == 3)
        let values = result.durations.compactMap { $0 }
        #expect(values.count == 3)
        #expect(abs(values.reduce(0, +) - duration) < 0.05)
        #expect(abs(values[0] - 11 * 0.2) < 0.05)
    }

    @Test("识别有错字也对得上；对不上的按字数插值")
    func alignedWithErrors() {
        // 文稿写「AI」，识别成「阿姨」。第二镜整句都没认对
        let list = tokens("你会问阿姨这个问题么完全不一样的一段话我们询问了很多的朋友们")
        let lines = ["你会问AI这个问题么", "这一句话根本没有说", "我们询问了很多的朋友们"]
        let duration = list.last!.end
        let result = ARollAligner.align(lines: lines, tokens: list, duration: duration)
        #expect(result.matched == 2)
        #expect(result.total == 3)
        let values = result.durations.compactMap { $0 }
        #expect(values.count == 3)
        #expect(abs(values.reduce(0, +) - duration) < 0.05)
        #expect(values.allSatisfy { $0 >= 0.5 })
    }

    @Test("文件类型：视频和音频走 A-roll，文稿不走")
    func types() {
        #expect(ARollImporter.handles(URL(fileURLWithPath: "/a/口播.mov")))
        #expect(ARollImporter.handles(URL(fileURLWithPath: "/a/口播.mp4")))
        #expect(ARollImporter.handles(URL(fileURLWithPath: "/a/口播.m4a")))
        #expect(ARollImporter.handles(URL(fileURLWithPath: "/a/口播.wav")))
        #expect(!ARollImporter.handles(URL(fileURLWithPath: "/a/文稿.txt")))
        #expect(!ARollImporter.handles(URL(fileURLWithPath: "/a/文稿.docx")))
        #expect(!ARollImporter.handles(URL(fileURLWithPath: "/a/没有后缀")))
    }
}
