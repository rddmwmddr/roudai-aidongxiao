import ObjectiveC
import SwiftUI
import AppKit
import AVFoundation
import Foundation
import Testing
import WebKit
@testable import DataMotion

// 整条流程在真实的文档窗口里跑：真实的鼠标键盘事件、真实的菜单、真实的编码和文件。
// 需要先启动假的 AI 服务：python3 tests/mock_ai_server.py
@MainActor
final class WindowDriver {
    let window: NSWindow
    let web: StageWebView
    let document: NSDocument
    let out: URL
    private var eventNumber = 100

    init(document: NSDocument, window: NSWindow, web: StageWebView, out: URL) {
        self.document = document
        self.window = window
        self.web = web
        self.out = out
    }

    static func findWeb(in view: NSView?) -> StageWebView? {
        guard let view else { return nil }
        if let w = view as? StageWebView { return w }
        for sub in view.subviews {
            if let w = findWeb(in: sub) { return w }
        }
        return nil
    }

    static func find<T: NSView>(_ type: T.Type, in view: NSView?) -> T? {
        guard let view else { return nil }
        if let w = view as? T { return w }
        for sub in view.subviews {
            if let w = find(type, in: sub) { return w }
        }
        return nil
    }

    func wait(_ seconds: Double) async {
        try? await Task.sleep(for: .milliseconds(Int(seconds * 1000)))
    }

    func until(_ what: String, timeout: Double = 20, _ check: () async -> Bool) async -> Bool {
        let start = Date()
        while Date().timeIntervalSince(start) < timeout {
            if await check() { return true }
            await wait(0.08)
        }
        print("等待超时：\(what)")
        return false
    }

    func js(_ body: String) async -> Any? {
        do {
            return try await web.callAsyncJavaScript(body, contentWorld: .page)
        } catch {
            print("脚本出错：\(error)")
            return nil
        }
    }

    func jsNumber(_ body: String) async -> Double {
        (await js(body) as? NSNumber)?.doubleValue ?? .nan
    }

    func jsString(_ body: String) async -> String {
        (await js(body) as? String) ?? ""
    }

    // ---------- 截图：先试整窗，不行就把原生界面和网页内容拼起来 ----------
    func snap(_ name: String, sheet: Bool = false) async {
        let target = sheet ? (window.attachedSheet ?? window) : window
        let url = out.appending(path: "\(name).png")
        // 教程图要在控件上画框，把这一刻的控件位置一起存下来
        if out.lastPathComponent == "tutorial-shots" {
            let list = ControlFrames.entries.values.map { ["name": $0.name, "x": $0.frame.minX, "y": $0.frame.minY, "w": $0.frame.width, "h": $0.frame.height, "order": $0.order] as [String: Any] }
            if let data = try? JSONSerialization.data(withJSONObject: list) {
                try? data.write(to: out.appending(path: "\(name).json"))
            }
        }
        let shown = target.alphaValue
        target.alphaValue = 1
        defer { target.alphaValue = shown }
        await wait(0.25)
        typealias Fn = @convention(c) (CGRect, UInt32, UInt32, UInt32) -> Unmanaged<CGImage>?
        if let sym = dlsym(UnsafeMutableRawPointer(bitPattern: -2), "CGWindowListCreateImage") {
            let fn = unsafeBitCast(sym, to: Fn.self)
            if let image = fn(.null, 8, UInt32(target.windowNumber), 1 | 8)?.takeRetainedValue(), image.width > 10 {
                let rep = await withCanvas(NSBitmapImageRep(cgImage: image), target: target)
                if let data = rep.representation(using: .png, properties: [:]), !isBlank(rep) {
                    try? data.write(to: url)
                    return
                }
            }
        }
        guard let content = target.contentView else { return }
        guard let rep = content.bitmapImageRepForCachingDisplay(in: content.bounds) else { return }
        content.cacheDisplay(in: content.bounds, to: rep)
        let image = NSImage(size: content.bounds.size)
        image.addRepresentation(rep)
        if target === window, web.window === window, !web.isHidden {
            if let shot = try? await web.takeSnapshot(configuration: nil) {
                image.lockFocus()
                let frame = web.convert(web.bounds, to: content)
                shot.draw(in: frame)
                image.unlockFocus()
            }
        }
        if let tiff = image.tiffRepresentation, let r = NSBitmapImageRep(data: tiff), let data = r.representation(using: .png, properties: [:]) {
            try? data.write(to: url)
        }
    }

    // 窗口在屏幕外时，WebKit 的画布合成不到窗口图里。取画布自己的内容盖上去，画面和用户看到的一样
    private func withCanvas(_ rep: NSBitmapImageRep, target: NSWindow) async -> NSBitmapImageRep {
        guard target === window, web.window === window, !web.isHidden else { return rep }
        let body = "const c=document.querySelector('canvas');if(!c)return '';const st=window.__dmState();if(st&&st.scene&&window.__dmEditor)window.__dmEditor.draw(c.getContext('2d'),Math.min(st.t,st.scene.duration));const r=c.getBoundingClientRect();return JSON.stringify({u:c.toDataURL('image/png'),x:r.x,y:r.y,w:r.width,h:r.height})"
        let text = await jsString(body)
        guard let raw = text.data(using: .utf8), let info = try? JSONSerialization.jsonObject(with: raw) as? [String: Any],
              let uri = info["u"] as? String, let comma = uri.firstIndex(of: ","),
              let png = Data(base64Encoded: String(uri[uri.index(after: comma)...])), let canvas = NSImage(data: png),
              let x = info["x"] as? Double, let y = info["y"] as? Double, let w = info["w"] as? Double, let h = info["h"] as? Double else { return rep }
        let scale = Double(rep.pixelsWide) / window.frame.width
        let frame = web.convert(web.bounds, to: nil)
        let copy = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: rep.pixelsWide, pixelsHigh: rep.pixelsHigh, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0) ?? rep
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: copy)
        rep.draw(in: NSRect(x: 0, y: 0, width: rep.pixelsWide, height: rep.pixelsHigh))
        // 画布矩形：网页坐标是左上角原点，图是左下角原点
        canvas.draw(in: NSRect(x: (frame.minX + x) * scale, y: (frame.maxY - y - h) * scale, width: w * scale, height: h * scale))
        NSGraphicsContext.restoreGraphicsState()
        return copy
    }

    private func isBlank(_ rep: NSBitmapImageRep) -> Bool {
        let w = rep.pixelsWide
        let h = rep.pixelsHigh
        var colors = Set<UInt32>()
        // 文稿页字少，取样要密，不然会被当成空白
        for i in 0..<2400 {
            guard let c = rep.colorAt(x: w * (i % 60 + 1) / 62, y: h * (i / 60 + 1) / 42) else { continue }
            let r = UInt32((c.redComponent * 255).rounded())
            let g = UInt32((c.greenComponent * 255).rounded())
            let b = UInt32((c.blueComponent * 255).rounded())
            colors.insert(r << 16 | g << 8 | b)
        }
        return colors.count < 2
    }

    // ---------- 真实事件 ----------
    private func point(_ css: CGPoint) -> NSPoint {
        web.convert(NSPoint(x: css.x, y: css.y), to: nil)
    }

    // 窗口在屏幕外时，WebKit 收不到系统鼠标事件。直接派发指针事件，走同一套编辑器代码
    private func send(_ type: NSEvent.EventType, _ css: CGPoint, clicks: Int = 1) {
        let kind = type == .leftMouseDown ? "down" : type == .leftMouseUp ? "up" : "move"
        let script = """
        (() => {
          if (!window.__dmPointer) {
            window.__dmPointer = {target: null};
            Element.prototype.setPointerCapture = function () { window.__dmPointer.target = this; };
            Element.prototype.releasePointerCapture = function () { window.__dmPointer.target = null; };
            Element.prototype.hasPointerCapture = function () { return window.__dmPointer.target === this; };
          }
          const x = \(css.x), y = \(css.y), kind = "\(kind)", clicks = \(clicks);
          const under = document.elementFromPoint(x, y) || document.body;
          const t = kind !== "down" && window.__dmPointer.target ? window.__dmPointer.target : under;
          const init = {bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0, buttons: kind === "up" ? 0 : (kind === "down" || window.__dmPointer.pressed) ? 1 : 0, pointerId: 1, pointerType: "mouse", isPrimary: true, detail: clicks};
          if (kind === "down") window.__dmPointer.pressed = under;
          t.dispatchEvent(new PointerEvent(kind === "down" ? "pointerdown" : kind === "up" ? "pointerup" : "pointermove", init));
          t.dispatchEvent(new MouseEvent(kind === "down" ? "mousedown" : kind === "up" ? "mouseup" : "mousemove", init));
          if (kind === "up") {
            if (window.__dmPointer.pressed && window.__dmPointer.pressed.contains(under)) under.dispatchEvent(new MouseEvent("click", init));
            window.__dmPointer.pressed = null;
            window.__dmPointer.target = null;
          }
        })()
        """
        web.evaluateJavaScript(script, completionHandler: nil)
    }

    func click(_ css: CGPoint) async {
        send(.mouseMoved, css)
        await wait(0.05)
        send(.leftMouseDown, css)
        await wait(0.04)
        send(.leftMouseUp, css)
        await wait(0.15)
    }

    func drag(from a: CGPoint, to b: CGPoint, steps: Int = 8) async {
        send(.mouseMoved, a)
        await wait(0.05)
        send(.leftMouseDown, a)
        await wait(0.05)
        for i in 1...steps {
            let k = CGFloat(i) / CGFloat(steps)
            send(.leftMouseDragged, CGPoint(x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k))
            await wait(0.025)
        }
        send(.leftMouseUp, b)
        await wait(0.25)
    }

    func key(_ code: UInt16, _ chars: String) async {
        for type in [NSEvent.EventType.keyDown, .keyUp] {
            if let e = NSEvent.keyEvent(with: type, location: .zero, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: (window.attachedSheet ?? window).windowNumber, context: nil, characters: chars, charactersIgnoringModifiers: chars, isARepeat: false, keyCode: code) {
                // 本地监听器在这里。系统层面 App 没有关键窗口，按键到这一步就断了，接着交给第一响应者
                NSApp.sendEvent(e)
                let responder = window.firstResponder
                if type == .keyDown, responder is NSTextView { responder?.keyDown(with: e) }
            }
            await wait(0.03)
        }
    }

    // 设计坐标（1920×1080）换成网页里的点
    func stagePoint(_ x: Double, _ y: Double) async -> CGPoint {
        let v = await jsString("const r=document.getElementById('stage').getBoundingClientRect();return [r.left,r.top,r.width,r.height].join(',');").split(separator: ",").compactMap { Double($0) }
        guard v.count == 4 else { return .zero }
        return CGPoint(x: v[0] + x / 1920 * v[2], y: v[1] + y / 1080 * v[3])
    }

    func rect(of selector: String) async -> CGRect? {
        let s = await jsString("const e=document.querySelector(\(quote(selector)));if(!e)return '';const r=e.getBoundingClientRect();return [r.left,r.top,r.width,r.height].join(',');")
        let v = s.split(separator: ",").compactMap { Double($0) }
        return v.count == 4 ? CGRect(x: v[0], y: v[1], width: v[2], height: v[3]) : nil
    }

    private func quote(_ s: String) -> String { "\"\(s.replacingOccurrences(of: "\"", with: "\\\""))\"" }

    // ---------- 菜单 ----------
    func menuItem(_ title: String, in menu: NSMenu? = NSApp.mainMenu) -> (NSMenu, Int)? {
        guard let menu else { return nil }
        for (i, item) in menu.items.enumerated() {
            if item.title == title { return (menu, i) }
            if let sub = item.submenu, let found = menuItem(title, in: sub) { return found }
        }
        return nil
    }

    // 窗口刚变成当前窗口时，菜单要等一下才拿到这个窗口的命令，所以多试几次
    @discardableResult
    func menu(_ title: String) async -> Bool {
        for _ in 0..<60 {
            if let (before, _) = menuItem(title) {
                // 和用户点开菜单时一样，先让菜单刷新状态。刷新后序号可能变，要重新找，否则会点到别的项
                before.delegate?.menuNeedsUpdate?(before)
                before.update()
                if let (m, i) = menuItem(title), m.items[i].isEnabled {
                    m.performActionForItem(at: i)
                    return true
                }
            }
            await wait(0.1)
        }
        print("菜单项不可用：\(title) 关键窗口：\(NSApp.keyWindow?.title ?? "无") 窗口：\(NSApp.windows.filter(\.isVisible).map { "\($0.title)\($0.isKeyWindow ? "*" : "")" })")
        return false
    }

    func save() async -> Bool {
        document.save(nil)
        await wait(0.6)
        return !document.isDocumentEdited
    }

    func savedBoard() async -> [String: Any]? {
        guard await save(), let url = document.fileURL, let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }
}

// 让 App 以为自己在前台，窗口放在屏幕外。系统层面它没有被激活，别的 App 的焦点不受影响
@MainActor
enum Backstage {
    nonisolated(unsafe) static weak var key: NSWindow?
    nonisolated(unsafe) static var pressed = false
    private static var installed = false
    private static let backstage = NSRect(x: 60, y: 60, width: 1480, height: 900)

    // 窗口留在屏幕范围内，动画才走。压到壁纸那一层，几乎全透明，鼠标穿透：看不见也点不到
    static func tuck(_ window: NSWindow) {
        window.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopWindow)))
        window.alphaValue = 0.02
        window.ignoresMouseEvents = true
    }

    static func place(_ window: NSWindow) {
        key = window
        tuck(window)
        window.setFrame(backstage, display: true)
        NotificationCenter.default.post(name: NSApplication.didBecomeActiveNotification, object: NSApp)
        NotificationCenter.default.post(name: NSWindow.didBecomeKeyNotification, object: window)
    }

    static func install() {
        guard !installed else { return }
        installed = true
        StageController.timerFrames = true
        BoardDocument.opensSample = false
        swap(NSWindow.self, #selector(getter: NSWindow.isKeyWindow), #selector(getter: NSWindow.backstageIsKey))
        swap(NSWindow.self, #selector(getter: NSWindow.isMainWindow), #selector(getter: NSWindow.backstageIsKey))
        swap(NSApplication.self, #selector(getter: NSApplication.isActive), #selector(getter: NSApplication.backstageActive))
        if let a = class_getClassMethod(NSEvent.self, #selector(getter: NSEvent.pressedMouseButtons)), let b = class_getClassMethod(NSEvent.self, #selector(getter: NSEvent.backstagePressedButtons)) {
            method_exchangeImplementations(a, b)
        }
        // 系统按这些判断画激活样式：红绿灯的颜色、玻璃的亮度
        for name in ["hasKeyAppearance", "hasMainAppearance", "_hasKeyAppearance", "_hasMainAppearance", "_hasActiveAppearance", "_hasActiveAppearanceIgnoringKeyFocus", "_hasActiveControls"] {
            swap(NSWindow.self, Selector(name), #selector(getter: NSWindow.backstageIsKey))
        }
        swap(NSApplication.self, #selector(getter: NSApplication.keyWindow), #selector(getter: NSApplication.backstageKey))
        swap(NSApplication.self, #selector(getter: NSApplication.mainWindow), #selector(getter: NSApplication.backstageKey))
        // 关于、设置这些窗口也不露出来：显示之前先挪走
        for (a, b) in [(#selector(NSWindow.makeKeyAndOrderFront(_:)), #selector(NSWindow.backstageMakeKey(_:))),
                       (#selector(NSWindow.orderFront(_:)), #selector(NSWindow.backstageOrderFront(_:))),
                       (#selector(NSWindow.orderFrontRegardless), #selector(NSWindow.backstageOrderFrontRegardless))] {
            if let original = class_getInstanceMethod(NSWindow.self, a), let replacement = class_getInstanceMethod(NSWindow.self, b) {
                method_exchangeImplementations(original, replacement)
            }
        }
    }

    static func hide(_ window: NSWindow) {
        tuck(window)
    }

    private static var patched = Set<ObjectIdentifier>()

    /// 这个窗口里的所有视图都接第一次点击。沿继承链改，只碰真实出现过的视图类
    static func acceptFirstMouse(in window: NSWindow) {
        guard let root = window.contentView?.superview ?? window.contentView else { return }
        let selector = #selector(NSView.acceptsFirstMouse(for:))
        let block: @convention(block) (NSView, NSEvent?) -> Bool = { _, _ in true }
        let implementation = imp_implementationWithBlock(block)
        var stack = [root]
        while let view = stack.popLast() {
            stack.append(contentsOf: view.subviews)
            var type: AnyClass? = object_getClass(view)
            while let current = type, !patched.contains(ObjectIdentifier(current)) {
                patched.insert(ObjectIdentifier(current))
                var count: UInt32 = 0
                if let list = class_copyMethodList(current, &count) {
                    for i in 0..<Int(count) where method_getName(list[i]) == selector {
                        method_setImplementation(list[i], implementation)
                    }
                    free(list)
                }
                type = class_getSuperclass(current)
            }
        }
    }

    private static func swap(_ type: AnyClass, _ a: Selector, _ b: Selector) {
        guard let original = class_getInstanceMethod(type, a), let replacement = class_getInstanceMethod(type, b) else { return }
        class_replaceMethod(type, a, method_getImplementation(replacement), method_getTypeEncoding(original))
    }
}

extension NSEvent {
    @objc class var backstagePressedButtons: Int { Backstage.pressed ? 1 : 0 }
}

extension NSWindow {
    @objc var backstageIsKey: Bool { Backstage.key === self }
    // 下面三个和系统方法交换过实现，调自己就是调原来的
    @objc func backstageMakeKey(_ sender: Any?) {
        Backstage.hide(self)
        Backstage.key = self
        backstageMakeKey(sender)
    }
    @objc func backstageOrderFront(_ sender: Any?) {
        Backstage.hide(self)
        backstageOrderFront(sender)
    }
    @objc func backstageOrderFrontRegardless() {
        Backstage.hide(self)
        backstageOrderFrontRegardless()
    }
}

extension NSApplication {
    @objc var backstageActive: Bool { true }
    @objc var backstageKey: NSWindow? { Backstage.key }
}

@Suite("真实窗口", .serialized)
@MainActor
struct AppFlowTests {
    private func makeDriver(_ out: URL, board: URL? = nil, fileName: String? = nil, prepare: ((inout [[String: Any]]) -> Void)? = nil) async throws -> WindowDriver {
        // 别的窗口的控件也会登记，同名的就混了
        for other in NSDocumentController.shared.documents {
            other.updateChangeCount(.changeCleared)
            other.close()
        }
        let bundled = Bundle(for: WindowDriver.self).url(forResource: "窗口测试分镜", withExtension: "dmboard")
        let sample = try #require(board ?? bundled)
        let folder = FileManager.default.temporaryDirectory.appending(path: "flow-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let temp = folder.appending(path: "\(fileName ?? "flow").dmboard")
        try FileManager.default.copyItem(at: sample, to: temp)
        if let prepare {
            var whole = try #require(try JSONSerialization.jsonObject(with: Data(contentsOf: temp)) as? [String: Any])
            var rows = try #require(whole["rows"] as? [[String: Any]])
            prepare(&rows)
            whole["rows"] = rows
            try JSONSerialization.data(withJSONObject: whole).write(to: temp)
        }
        Backstage.install()
        let (doc, _) = try await NSDocumentController.shared.openDocument(withContentsOf: temp, display: false)
        if doc.windowControllers.isEmpty { doc.makeWindowControllers() }
        let window = try #require(doc.windowControllers.first?.window)
        // 窗口放屏幕外，不激活 App：测试不打扰正在用电脑的人
        Backstage.place(window)
        doc.showWindows()
        Backstage.place(window)
        var found: StageWebView?
        for _ in 0..<100 {
            found = WindowDriver.findWeb(in: window.contentView)
            if found != nil { break }
            try await Task.sleep(for: .milliseconds(100))
        }
        let web = try #require(found)
        return WindowDriver(document: doc, window: window, web: web, out: out)
    }

    private func outputFolder() throws -> URL {
        let out = FileManager.default.temporaryDirectory.appending(path: "flow-shots", directoryHint: .isDirectory)
        try? FileManager.default.removeItem(at: out)
        try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
        print("截图目录：\(out.path)")
        return out
    }

    @Test("打开文档、在画面里调整元素、撤销、保存")
    func editing() async throws {
        let out = try outputFolder()
        let d = try await makeDriver(out)
        #expect(await d.until("渲染页就绪") { (await d.js("return !!window.__dmReady") as? Bool) == true })
        await d.wait(1)
        await d.snap("01_打开文档")
        #expect(d.window.isKeyWindow)
        // 画面层不写提示
        #expect(await d.jsNumber("return document.querySelectorAll('.dme-hint,.dme-dockhint').length") == 0)

        // 菜单走到第 26 镜：一百根，45/20/37
        await d.goToShot("026")
        await d.wait(0.5)
        let tpl = await d.jsString("return window.__dmState().row.tpl")
        #expect(tpl == "comb")
        let duration = await d.jsNumber("return window.__dmState().scene.duration")
        #expect(duration > 10)
        _ = await d.js("DMBridge.seek(\(duration - 0.3))")
        #expect(await d.until("这一帧有矩形") { await d.jsNumber("return window.__dmEditor.rec.length") > 200 })
        #expect(await d.until("元素清点完") { await d.jsNumber("return window.__dmEditor.elements.length") > 100 })
        await d.snap("02_一百根")

        // 点选
        await d.click(await d.stagePoint(300, 800))
        #expect(await d.until("选中元素") { await d.jsNumber("return window.__dmEditor.sel.length") == 1 })
        let id = await d.jsString("return window.__dmEditor.sel[0]")
        print("选中：\(id)")
        #expect(id.hasPrefix("bars:"))
        await d.snap("03_选中竖条")
        #expect(await d.jsString("return document.querySelector('.dme-hud').style.display") != "none")

        // 拖动
        await d.drag(from: await d.stagePoint(300, 800), to: await d.stagePoint(360, 740))
        let m1 = await d.jsNumber("return (window.__dmEditor.layers[\(jsq(id))].m||[])[4]")
        print("拖动后 dx=\(m1)")
        #expect(m1 > 30)
        #expect(d.document.undoManager?.canUndo == true)
        #expect(d.document.undoManager?.undoActionName == "移动元素")

        // 拉高：拖上边的手柄
        let top = try #require(await d.rect(of: ".dme-h[data-h=n]"))
        await d.drag(from: CGPoint(x: top.midX, y: top.midY), to: CGPoint(x: top.midX, y: top.midY - 50))
        let sy = await d.jsNumber("return window.__dmEditor.layers[\(jsq(id))].m[3]")
        print("拉高后 sy=\(sy)")
        #expect(sy > 1.1)
        await d.snap("04_拉高之后")

        // 时间条右端往左拖：变快
        let span = try #require(await d.rect(of: ".dme-span"))
        await d.drag(from: CGPoint(x: span.maxX - 2, y: span.midY), to: CGPoint(x: span.maxX - span.width * 0.4, y: span.midY))
        let speed = await d.jsNumber("return window.__dmEditor.layers[\(jsq(id))].speed || 0")
        print("拖时间条后 speed=\(speed)")
        #expect(speed > 1.2)
        await d.snap("05_改速度")

        // 面板里输入透明度
        let alphaField = try #require(await d.rect(of: ".dme-f input[aria-label=不透明度]"))
        await d.click(CGPoint(x: alphaField.midX, y: alphaField.midY))
        _ = await d.js("const i=document.querySelector('.dme-f input[aria-label=不透明度]');i.focus();i.value='55';i.dispatchEvent(new Event('change',{bubbles:true}));i.dispatchEvent(new FocusEvent('blur'));i.blur();")
        await d.wait(0.2)
        #expect(abs(await d.jsNumber("return window.__dmEditor.layers[\(jsq(id))].alpha") - 0.55) < 0.001)

        // 方向键移动
        let before = await d.jsNumber("return window.__dmEditor.layers[\(jsq(id))].m[4]")
        d.window.makeFirstResponder(d.web)
        _ = await d.js("document.querySelector('.dme').focus()")
        await d.key(124, String(UnicodeScalar(NSRightArrowFunctionKey)!))
        await d.wait(0.7)
        let after = await d.jsNumber("return window.__dmEditor.layers[\(jsq(id))].m[4]")
        print("方向键：\(before) → \(after)")
        #expect(abs(after - before - 1) < 0.01)

        // 撤销：改动回到画面，再重做。
        // 系统按一次事件循环给撤销分组，测试框架接管了主循环，所以这里几次修改落在同一组，一步一步退由 BoardDocumentUndoTests 验证
        let undo = try #require(d.document.undoManager)
        #expect(undo.undoActionName == "移动元素")
        undo.undo()
        await d.wait(0.4)
        #expect(await d.jsNumber("return Object.keys(window.__dmEditor.layers).length") == 0)
        undo.redo()
        await d.wait(0.4)
        #expect(abs(await d.jsNumber("return window.__dmEditor.layers[\(jsq(id))].m[4]") - after) < 0.01)

        // 保存，文件里有调整
        let saved = try #require(await d.savedBoard())
        let rows = try #require(saved["rows"] as? [[String: Any]])
        #expect(rows.count == 133)
        let layers = (rows[25]["layers"] as? [String: Any])?["comb"] as? [String: Any]
        let mine = layers?[id] as? [String: Any]
        #expect(mine?["m"] != nil)
        #expect(mine?["speed"] != nil)
        #expect(mine?["alpha"] != nil)

        // 换一镜再回来，调整还在
        await d.menu("下一镜")
        await d.wait(0.4)
        await d.menu("上一镜")
        await d.wait(0.5)
        #expect(await d.jsNumber("return Object.keys(window.__dmEditor.layers).length") >= 1)

        // 还原
        #expect(await d.menu("还原这一镜的调整"))
        await d.wait(0.4)
        #expect(await d.jsNumber("return Object.keys(window.__dmEditor.layers).length") == 0)

        // 元素清单：从画面下方打开
        #expect(await d.until("元素清点完", timeout: 8) { d.hasControl("元素") })
        await d.wait(0.5)
        #expect(await d.clickControl("元素"))
        #expect(await d.until("弹出元素清单", timeout: 3) { d.popover() != nil })
        await d.wait(0.5)
        if let pop = d.popover() {
            await WindowDriver(document: d.document, window: pop, web: d.web, out: d.out).snap("06_元素列表")
        }
        await d.closePopover("元素")

        // 分镜表
        #expect(await d.menu("分镜表"))
        await d.wait(0.8)
        await d.snap("07_分镜表")
        #expect(await d.menu("文稿"))
        await d.wait(0.6)
        await d.snap("07_文稿页")
        #expect(await d.menu("画面"))
        await d.wait(0.5)

        d.document.updateChangeCount(.changeCleared)
        d.document.close()
    }

    @Test("文稿生成分镜：规则版和 AI 版")
    func storyboard() async throws {
        let out = FileManager.default.temporaryDirectory.appending(path: "flow-shots", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
        let d = try await makeDriver(out)
        #expect(await d.until("渲染页就绪") { (await d.js("return !!window.__dmReady") as? Bool) == true })
        await d.wait(0.8)
        let settings = AISettings.shared
        let savedProfiles = settings.profiles
        let savedActive = settings.activeID
        let savedRules = settings.useRules
        settings.profiles = []
        settings.activeID = nil
        defer {
            settings.profiles = savedProfiles
            settings.activeID = savedActive
            settings.useRules = savedRules
        }

        let script = """
        第一章
        这段是一段比较长的开场叙述，没有任何数字，只是在说这件事情的来龙去脉，让观众进入情境，后面才会看到数据。
        我们询问了5000位朋友，其中有86%的朋友说：喝。
        你喝咖啡么？
        第二章
        朋友不再猜，而是选择，问拿铁、美式、手冲、冷萃、摩卡、澳白、冰滴。
        有45%表示喝完之后，很少去回味。选择完全信任的朋友，占到了20%。会询问产地的，只有37%。
        """

        // 菜单「生成分镜」：不在文稿页时先过去，在文稿页且有字就开始
        func runScript(_ name: String) async throws {
            #expect(await d.menu("画面"))
            await d.wait(0.3)
            #expect(await d.menu("生成分镜"))
            #expect(await d.until("文稿页打开") { WindowDriver.find(NSTextView.self, in: d.window.contentView) != nil })
            await d.wait(0.4)
            let tv = try #require(WindowDriver.find(NSTextView.self, in: d.window.contentView))
            d.window.makeFirstResponder(tv)
            tv.string = script
            tv.didChangeText()
            await d.wait(0.3)
            await d.snap("\(name)_文稿页")
            #expect(await d.menu("生成分镜"))
        }

        // 规则版
        try await runScript("08_规则")
        #expect(await d.until("规则版写入") {
            guard let rows = (await d.savedBoardQuick())?["rows"] as? [[String: Any]] else { return false }
            return rows.count < 40
        })
        // 没有警告就直接到画面，底部能一键撤销
        #expect(await d.until("回到画面", timeout: 5) { d.hasControl("播放") || d.hasControl("暂停") })
        #expect(await d.until("生成后可撤销", timeout: 3) { d.hasControl("撤销") })
        await d.wait(0.5)
        await d.snap("08_规则_结果")
        let rulesBoard = try #require(await d.savedBoard())
        let ruleRows = try #require(rulesBoard["rows"] as? [[String: Any]])
        print("规则版镜头：", ruleRows.map { "\($0["no"] ?? "")/\($0["ch"] ?? "")/\($0["tpl"] ?? "")" })
        #expect(ruleRows.count >= 4)
        #expect(Set(ruleRows.compactMap { $0["ch"] as? String }) == ["第一章", "第二章"])
        #expect(ruleRows.contains { ($0["tpl"] as? String) == "relay" })
        #expect(ruleRows.contains { ($0["groups"]) != nil })
        await d.wait(0.4)
        await d.snap("09_规则版分镜")

        // 撤销回到 133 镜
        d.document.undoManager?.undo()
        await d.wait(0.5)
        let undone = try #require(await d.savedBoardQuick())
        #expect((undone["rows"] as? [[String: Any]])?.count == 133)

        // AI 版：OpenAI 兼容和 Claude 两条路，都打本机假服务
        for (label, kind) in [("兼容接口", AIKind.openAICompatible), ("Claude 接口", AIKind.anthropic)] {
            let base = kind == .anthropic ? "http://127.0.0.1:18765" : "http://127.0.0.1:18765/v1"
            let profile = try settings.add(ImportedAIConfig(name: "假服务\(label)", kind: kind, baseURL: base, model: "mock-model", apiKey: "fake-key"))
            settings.activeID = profile.id
            settings.useRules = false
            try await runScript("10_AI\(label)")
            await d.wait(0.2)
            await d.snap("10_AI\(label)_运行中")
            #expect(await d.until("AI 版写入", timeout: 40) {
                guard let rows = (await d.savedBoardQuick())?["rows"] as? [[String: Any]] else { return false }
                return rows.count < 40
            })
            // 有警告就留在文稿页给人看
            await d.wait(0.5)
            await d.snap("10_AI\(label)_结果")
            #expect(WindowDriver.find(NSTextView.self, in: d.window.contentView) != nil)
            let board = try #require(await d.savedBoard())
            let rows = try #require(board["rows"] as? [[String: Any]])
            print("\(label)：", rows.map { "\($0["no"] ?? "")/\($0["tpl"] ?? "")/\(($0["note"] as? String)?.prefix(24) ?? "")" })
            // 假服务每段都故意写一个原文没有的数字 77：两段两镜都要被拦下，换成规则版并标「要确认」
            let flagged = rows.filter { ($0["note"] as? String)?.contains("77") == true }
            #expect(flagged.count == 2)
            #expect(!JSONString(rows).contains("\"value\":77"))
            #expect(flagged.allSatisfy { $0["groups"] != nil })
            // 文字一个不丢
            let joined = rows.compactMap { $0["line"] as? String }.joined()
            #expect(joined.contains("其中有86%的朋友说：喝。") && joined.contains("只有37%"))
            settings.remove(profile)
            d.document.undoManager?.undo()
            await d.wait(0.4)
        }
        d.document.updateChangeCount(.changeCleared)
        d.document.close()
    }

    @Test("导出：MP4 读回核对、调整过的镜头、批量跳过")
    func exporting() async throws {
        let sample = try #require(Bundle(for: WindowDriver.self).url(forResource: "窗口测试分镜", withExtension: "dmboard"))
        let board = try BoardDocument.decode(try Data(contentsOf: sample))
        let dir = FileManager.default.temporaryDirectory.appending(path: "export-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: dir) }
        // 挑文字最长的一百根：批量导出要跑一会儿，才来得及点停止
        let comb = try #require(board.rows.filter { $0.template == "comb" && !$0.isPending && $0.fields["groups"] != nil }.max { $0.line.count < $1.line.count })
        let dots = try #require(board.rows.first { $0.template == "dots" && !$0.isPending })
        let question = try #require(board.rows.first { $0.template == "question" })
        let engine = ExportEngine()

        var t0 = Date()
        let a = try await engine.export(comb, to: dir.appending(path: "a.mp4"), size: .hd, fps: 60) { _, _ in }
        print("1080p60 一百根：成片 \(a.duration) 秒，用时 \(Date().timeIntervalSince(t0)) 秒，\(a.summary)", a.rows)
        #expect(a.width == 1920 && a.height == 1080)
        #expect(a.durationOK)
        #expect(a.dataChecked)
        #expect(a.ok)
        // 留一张 WebKit 导出的末帧，和 Chrome 比辉光
        let shots = FileManager.default.temporaryDirectory.appending(path: "flow-shots", directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: shots, withIntermediateDirectories: true)
        let gen = AVAssetImageGenerator(asset: AVURLAsset(url: dir.appending(path: "a.mp4")))
        gen.requestedTimeToleranceAfter = .zero
        gen.requestedTimeToleranceBefore = .zero
        let (frame, _) = try await gen.image(at: CMTime(seconds: a.duration - 0.2, preferredTimescale: 600))
        try NSBitmapImageRep(cgImage: frame).representation(using: .png, properties: [:])?.write(to: shots.appending(path: "导出末帧_WebKit_\(comb.no).png"))

        t0 = Date()
        var edited = dots
        edited.setLayers(#"{"dots:0":{"m":[1,0,0,1,120,40],"alpha":0.8}}"#, for: "dots")
        let b = try await engine.export(edited, to: dir.appending(path: "b.mp4"), size: .uhd, fps: 60) { _, _ in }
        print("4K60 调整过的一百人：成片 \(b.duration) 秒，用时 \(Date().timeIntervalSince(t0)) 秒，\(b.summary)")
        #expect(b.width == 3840 && b.height == 2160)
        #expect(b.edited)
        #expect(!b.dataChecked)
        #expect(b.ok)
        let size = (try FileManager.default.attributesOfItem(atPath: dir.appending(path: "b.mp4").path)[.size] as? NSNumber)?.intValue ?? 0
        #expect(size > 1_000_000)

        // 速度调慢后，时长变长，成片也跟着变长
        var slow = comb
        slow.setLayers(#"{"num:0:0":{"speed":0.25,"anchor":1,"end":6}}"#, for: "comb")
        let s = try await engine.export(slow, to: dir.appending(path: "slow.mp4"), size: .hd, fps: 30) { _, _ in }
        print("调慢后时长 \(s.duration)，原来 \(a.duration)")
        #expect(s.durationOK)

        // 动效库和图表走同一条导出路径：文字放进动作、整张动效、图表，读回时长都要对
        func make(_ tpl: String, _ extra: [String: JSONValue]) -> Shot {
            var fields: [String: JSONValue] = ["id": .number(900), "no": .string("900"), "line": .string("这一句口播是测试用的。"), "tpl": .string(tpl), "kind": .string("B")]
            fields.merge(extra) { _, new in new }
            return Shot(fields: fields)
        }
        let series: JSONValue = .array([.object(["label": .string("抖音"), "value": .number(3)]), .object(["label": .string("微信"), "value": .number(12)]), .object(["label": .string("快手"), "value": .number(4)])])
        for (name, shot) in [
            ("文字动效", make("mp006", ["lines": .array([.string("这一句口播是测试用的")])])),
            ("整张动效", make("mp005", [:])),
            ("CSS 动效", make("cot12", ["lines": .array([.string("早就已经烟火遍地")])])),
            ("界面组件", make("kxs_ring", ["lines": .array([.string("比以往更会问问题了 51%")])])),
            ("手动时长", make("statement", ["lines": .array([.string("这一句口播是测试用的")]), "dur": .number(1.2)])),
            ("图表", make("chBars", ["series": series, "unit": .string("亿")])),
            ("细读图表", make("lf_rungs", ["series": series])),
            ("细读图表写自己的数据", make("lf_fall", ["lf": .object(["D": .array([.array([.string("收入"), .number(30), .null]), .array([.string("成本"), .number(-9), .null]), .array([.string("利润"), .number(21), .null])])]), "caption": .string("一格 = 一万元")])),
            ("重写的图表", make("chForce", ["nodes": .array((1...16).map { .string("节点\($0)") }), "links": .array((0..<16).map { .array([.number(Double($0)), .number(Double(($0 * 5 + 1) % 4))]) })])),
        ] {
            let check = try await ExportEngine().export(shot, to: dir.appending(path: "\(name).mp4"), size: .hd, fps: 30) { _, _ in }
            print("\(name)：\(check.duration) 秒，\(check.summary)")
            #expect(check.durationOK)
        }

        // 批量：3 镜，写清单；再跑一次全部跳过
        let names = ["comb": "一百根", "dots": "一百人", "question": "问题卡"]
        let runner = BatchRunner()
        runner.start(shots: [comb, dots, question], names: names, folder: dir, size: .hd, fps: 30)
        while runner.isRunning { try await Task.sleep(for: .milliseconds(100)) }
        print("批量：完成 \(runner.doneCount)，失败 \(runner.failedCount)", runner.items.map(\.status))
        #expect(runner.doneCount == 3)
        let csv = try String(contentsOf: dir.appending(path: "输出清单.csv"), encoding: .utf8)
        #expect(csv.contains("一百根"))
        #expect(!(try FileManager.default.contentsOfDirectory(atPath: dir.path).contains { $0.hasPrefix("写入中_") }))
        let again = BatchRunner()
        again.start(shots: [comb, dots, question], names: names, folder: dir, size: .hd, fps: 30)
        while again.isRunning { try await Task.sleep(for: .milliseconds(50)) }
        #expect(again.skippedCount == 3)

        // 中途取消，不留半截文件
        let cancel = BatchRunner()
        var long = comb
        long.no = "901"
        cancel.start(shots: [long], names: names, folder: dir, size: .uhd, fps: 60)
        try await Task.sleep(for: .milliseconds(800))
        cancel.cancel()
        while cancel.isRunning { try await Task.sleep(for: .milliseconds(50)) }
        let left = try FileManager.default.contentsOfDirectory(atPath: dir.path).filter { $0.hasPrefix("901") }
        print("取消后剩下：\(left)", cancel.items.map(\.status))
        #expect(left.isEmpty)

        // 换字体：导入系统字体，数字槽位生效，导出不受影响
        let font = URL(fileURLWithPath: "/System/Library/Fonts/Supplemental/Arial.ttf")
        if FileManager.default.isReadableFile(atPath: font.path) {
            let lib = FontLibrary.shared
            let entry = try lib.add(font)
            lib.assign(.num, to: entry.id)
            let f = try await ExportEngine().export(comb, to: dir.appending(path: "font.mp4"), size: .hd, fps: 30) { _, _ in }
            print("换字体后：\(f.summary)")
            #expect(f.durationOK)
            lib.remove(entry)
            #expect(lib.assignment.isEmpty)
        }
    }

    @Test("新文档的空状态、三页、无障碍名字")
    func looks() async throws {
        let out = FileManager.default.temporaryDirectory.appending(path: "flow-shots", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
        let d = try await makeDriver(out)
        #expect(await d.until("渲染页就绪") { (await d.js("return !!window.__dmReady") as? Bool) == true })
        await d.goToShot("026")
        await d.wait(0.8)
        await d.click(await d.stagePoint(300, 800))
        await d.wait(0.3)

        // 画面层：每个可操作的东西都要有名字
        let unnamed = await d.jsString("""
        const bad = [...document.querySelectorAll('button,input,[role=slider],[tabindex]')].filter((e) => {
          const name = (e.getAttribute('aria-label') || e.textContent || '').trim();
          const lab = e.closest('label');
          return !name && !(lab && lab.textContent.trim());
        }).map((e) => e.className || e.tagName);
        return bad.join(',');
        """)
        print("画面层没有名字的控件：[\(unnamed)]")
        #expect(unnamed.isEmpty)

        // 原生层的名字这里查不了：SwiftUI 的无障碍树要有辅助技术连上才会建，进程内只能走到窗口的红绿灯。
        // 名字靠代码里的 accessibilityLabel，实际效果要开 VoiceOver 听

        // 三页。系统是浅色的时候窗口也是深色，接缝处渲染页和原生是同一个底色
        NSApp.appearance = NSAppearance(named: .aqua)
        #expect(await d.menu("分镜表"))
        await d.wait(1)
        await d.snap("13_分镜表")
        #expect(await d.menu("文稿"))
        await d.wait(0.6)
        await d.snap("13_文稿页")
        #expect(await d.menu("画面"))
        await d.wait(0.8)
        await d.snap("14_画面")
        #expect(d.pageSeamMatches())
        NSApp.appearance = nil
        d.document.updateChangeCount(.changeCleared)
        d.document.close()

        // 新文档
        await d.wait(0.5)
        let blank = try NSDocumentController.shared.makeUntitledDocument(ofType: "com.ahuamiao.datamotion.board")
        NSDocumentController.shared.addDocument(blank)
        blank.makeWindowControllers()
        blank.showWindows()
        var win: NSWindow?
        for _ in 0..<40 {
            win = blank.windowControllers.first?.window
            if win != nil, WindowDriver.findWeb(in: win?.contentView) != nil { break }
            try await Task.sleep(for: .milliseconds(100))
        }
        if let win, let web = WindowDriver.findWeb(in: win.contentView) {
            win.setFrame(NSRect(x: 60, y: 60, width: 1480, height: 900), display: true)
            let e = WindowDriver(document: blank, window: win, web: web, out: out)
            await e.wait(1.2)
            await e.snap("15_新文档")
        }
        blank.updateChangeCount(.changeCleared)
        blank.close()
    }

    @Test("空文档：首页正中一个大按钮，打字不丢，生成后能撤销回来")
    func blankDocument() async throws {
        ControlFrames.entries.removeAll()
        let out = FileManager.default.temporaryDirectory.appending(path: "flow-shots", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
        let d = try await makeDriver(out) { rows in rows.removeAll() }
        #expect(await d.until("渲染页就绪") { (await d.js("return !!window.__dmReady") as? Bool) == true })
        await d.wait(1.2)
        await d.snap("15_空文档")
        // 只有文稿这一页：正中一个导入文本，还没有字，所以没有生成分镜；文字框在下面，画面藏着，没有播放条
        let tv = try #require(WindowDriver.find(NSTextView.self, in: d.window.contentView))
        #expect(!d.hasControl("播放"))
        #expect(d.web.isHidden)
        #expect(!d.hasControl("生成分镜"))
        let big = try #require(ControlFrames.frame { $0 == "导入文本" })
        let content = try #require(d.window.contentView?.bounds)
        #expect(big.height >= 70)
        // 两个按钮一起居中
        let aroll = try #require(ControlFrames.frame { $0 == "导入 A-roll" })
        #expect(aroll.height >= 70)
        #expect(abs((big.minX + aroll.maxX) / 2 - content.midX) < 2)

        // 像人一样打字：停笔后写进文件，没有生成也不丢
        d.window.makeFirstResponder(tv)
        let text = "第一章\n我们询问了5000位朋友，其中有86%的朋友说：喝。\n你喝咖啡么？"
        tv.insertText(text, replacementRange: NSRange(location: 0, length: 0))
        tv.didChangeText()
        #expect(await d.until("文稿写进文件", timeout: 4) {
            ((await d.savedBoardQuick())?["script"] as? String) == text
        })
        await d.wait(1.0)
        await d.snap("15_空文档_有字")
        #expect(d.hasControl("生成分镜"))

        // 生成：离开文稿页到画面，底部能撤销
        #expect(await d.menu("生成分镜"))
        #expect(await d.until("生成完成", timeout: 20) { d.hasControl("撤销") })
        #expect(await d.until("到画面", timeout: 5) { !d.web.isHidden })
        await d.wait(0.6)
        await d.snap("15_空文档_生成后")
        #expect(await d.until("时间线出来", timeout: 5) { d.hasControl("片段001") })
        let rows = (await d.savedBoardQuick())?["rows"] as? [[String: Any]] ?? []
        #expect(rows.count >= 2)

        // 撤销：回到白纸，文字还在
        #expect(await d.clickControl("撤销"))
        #expect(await d.until("回到文稿页", timeout: 5) { WindowDriver.find(NSTextView.self, in: d.window.contentView) != nil })
        await d.wait(0.8)
        let again = try #require(WindowDriver.find(NSTextView.self, in: d.window.contentView))
        #expect(again.string == text)
        #expect(((await d.savedBoardQuick())?["rows"] as? [[String: Any]])?.isEmpty == true)
        d.document.updateChangeCount(.changeCleared)
        d.document.close()

        // 大按钮点得到。沙盒的文件面板在别的进程里，测试关不掉它，所以这里单独放一页，只看动作有没有走到
        ControlFrames.entries.removeAll()
        var tapped = false
        let page = await hostWindow(ScriptPage(text: .constant(""), storyboarder: Storyboarder(), onImport: { tapped = true }, onImportARoll: {}, onGenerate: {}, onDropFile: { _ in }), size: NSSize(width: 900, height: 600), d: d)
        await page.wait(0.5)
        #expect(await page.clickControl("导入文本"))
        #expect(await page.until("导入被叫到", timeout: 2) { tapped })
        page.window.close()
    }

    @Test("动效库：按分类选、搜索、样例数据不能导出")
    func motionPicker() async throws {
        ControlFrames.entries.removeAll()
        let out = FileManager.default.temporaryDirectory.appending(path: "flow-shots", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
        let d = try await makeDriver(out)
        #expect(await d.until("渲染页就绪") { (await d.js("return !!window.__dmReady") as? Bool) == true })
        await d.wait(1)
        func rows() async -> [[String: Any]] { ((await d.savedBoardQuick())?["rows"] as? [[String: Any]]) ?? [] }

        // 打开挑选器，看到分类
        #expect(await d.clickControl("动效"))
        #expect(await d.until("弹出挑选器", timeout: 3) { d.popover() != nil && d.hasControl("分类图表") })
        await d.wait(1.2)
        let pop = try #require(d.popover())
        let picker = WindowDriver(document: d.document, window: pop, web: d.web, out: d.out)
        await picker.snap("动效库_适合")

        // WebKit 有没有 ctx.filter 决定模糊走哪条路
        print("WebKit 原生 filter：", await d.jsString("return String(Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'filter')?.get?.toString().includes('native code'))"))
        // 删掉的分类不再出现
        #expect(!d.hasControl("分类图形") && !d.hasControl("分类转场") && !d.hasControl("分类镜头") && !d.hasControl("分类光影") && !d.hasControl("分类界面") && !d.hasControl("分类网页") && !d.hasControl("分类出镜"))
        #expect(await d.clickControl("分类质感", in: pop))
        #expect(await d.until("质感分类", timeout: 3) { d.hasControl("错误抖动") })
        await d.wait(1.5)
        await picker.snap("动效库_质感")

        // 选分类，再选一个：画面换了，弹层不关
        #expect(await d.clickControl("分类文字特效", in: pop))
        #expect(await d.until("文字特效分类", timeout: 3) { d.hasControl("极光渐变") })
        await d.wait(1.5)
        await picker.snap("动效库_文字特效")
        #expect(await d.clickControl("极光渐变", in: pop))
        #expect(await d.until("换成极光渐变", timeout: 4) { await d.jsString("return window.__dmState().row.tpl") == "cot01" })
        #expect(d.popover() != nil)
        #expect((await rows())[0]["tpl"] as? String == "cot01")
        await d.wait(0.6)
        await d.snap("动效库_用上")

        // 选一个缺数据的图表：先放样例，标要确认，这一镜不能导出
        #expect(await d.clickControl("分类图表", in: pop))
        #expect(await d.until("图表分类", timeout: 3) { d.hasControl("涨势爆轴") })
        await d.wait(1.2)
        await picker.snap("动效库_图表")
        // 搜索：搜到第一屏以外的动效
        let field = try #require(pop.firstResponder as? NSTextView)
        field.insertText("折线", replacementRange: NSRange(location: 0, length: 0))
        #expect(await d.until("搜到折线图", timeout: 3) { d.hasControl("折线图") })
        await d.wait(0.8)
        await picker.snap("动效库_搜索")
        #expect(await d.clickControl("折线图", in: pop))
        #expect(await d.until("换成折线图", timeout: 4) { await d.jsString("return window.__dmState().row.tpl") == "chLine" })
        let first = (await rows())[0]
        #expect(first["sampleData"] as? Bool == true)
        #expect((first["note"] as? String)?.contains("样例") == true)
        let board = try BoardDocument.decode(try Data(contentsOf: try #require(d.document.fileURL)))
        #expect(board.rows[0].isPending)
        await d.wait(0.5)
        await d.snap("动效库_样例数据")
        await d.closePopover("动效")

        // 确认之后才能导出
        #expect(await d.menu("显示或隐藏这一镜"))
        await d.wait(0.6)
        #expect(await d.until("确认按钮", timeout: 3) { d.hasControl("标记为已确认") })
        #expect(await d.clickControl("标记为已确认"))
        await d.wait(0.5)
        let afterConfirm = (await rows())[0]
        #expect(afterConfirm["sampleData"] == nil)

        d.document.updateChangeCount(.changeCleared)
        d.document.close()
    }

    @Test("剪辑台：时间线、播放、右栏")
    func editorDesk() async throws {
        ControlFrames.entries.removeAll()
        let out = FileManager.default.temporaryDirectory.appending(path: "flow-shots", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
        let d = try await makeDriver(out)
        #expect(await d.until("渲染页就绪") { (await d.js("return !!window.__dmReady") as? Bool) == true })
        await d.wait(1)
        await d.goToShot("026")
        await d.wait(0.8)
        _ = await d.js("DMBridge.seek(20)")
        await d.wait(0.6)

        // 时间线上点片段换镜头，播放键和撤销都能用
        #expect(await d.until("时间线出来", timeout: 5) { d.hasControl("片段026") })
        await d.wait(2)
        await d.snap("剪辑台")
        #expect(await d.jsString("return getComputedStyle(document.documentElement).getPropertyValue('--surround')").contains("2F2B29"))
        // 前面测试关掉的窗口，视图还没释放，同名片段的位置也登记着，所以逐个试
        d.window.makeKeyAndOrderFront(nil)
        await d.wait(0.3)
        let clickedAt = Date()
        for frame in ControlFrames.entries.values.filter({ $0.name == "片段027" }).map(\.frame) {
            // 长镜头的片段可能比窗口还宽，点左边
            await d.clickWindow(NSPoint(x: frame.minX + 24, y: d.window.frame.height - frame.midY))
            if await d.until("换到 027", timeout: 2.5, { await d.jsString("return window.__dmState().row.no") == "027" }) { break }
        }
        // 窗口不在前台时第一下点击只是激活窗口。失败时看这一行，分得清是 App 的问题还是有人切走了窗口
        print("点片段到换好镜头：\(String(format: "%.2f", Date().timeIntervalSince(clickedAt))) 秒，窗口在前台：\(d.window.isKeyWindow)")
        #expect(await d.jsString("return window.__dmState().row.no") == "027")
        await d.snap("剪辑台_换镜头")

        // 右边的脚本和时间线联动：点一句，时间线跳到那一镜；拖别的片段，脚本跟到那一句
        let script = try #require(WindowDriver.find(ScriptTextView.self, in: d.window.contentView))
        let follow = try #require(script.script)
        #expect(await d.until("脚本排好", timeout: 3) { follow.point(of: 28, fraction: 0.5) != nil })
        await d.wait(0.5)
        await d.clickQueued(at: try #require(follow.point(of: 28, fraction: 0.5)))
        #expect(await d.until("点脚本换镜头", timeout: 3) { await d.jsString("return window.__dmState().row.no") == "028" })
        await d.wait(0.5)
        #expect(await d.dragControl("时长027", by: 6))
        #expect(await d.until("拖片段换镜头", timeout: 3) { await d.jsString("return window.__dmState().row.no") == "027" })
        d.document.undoManager?.undo()
        await d.wait(0.5)
        await d.snap("剪辑台_脚本")

        #expect(await d.clickControl("播放"))
        #expect(await d.until("变成暂停", timeout: 3) { d.hasControl("暂停") })
        await d.wait(1)
        await d.snap("剪辑台_播放中")
        #expect(await d.clickControl("暂停"))

        // 关了循环，一镜播完接着播下一镜
        #expect(await d.clickControl("循环播放"))
        await d.wait(0.2)
        _ = await d.js("DMBridge.seek(window.__dmState().scene.duration - 0.15)")
        #expect(await d.clickControl("播放"))
        #expect(await d.until("接到下一镜", timeout: 4) { (await d.jsString("return window.__dmState().row.no")) == "028" })
        #expect(await d.until("接着播", timeout: 3) { d.hasControl("暂停") })
        #expect(await d.clickControl("暂停"))
        #expect(await d.clickControl("循环播放"))

        // 拖片段右边缘改时长：往右 80 点是 2 秒，写进文件，画面跟着变，撤销回去
        await d.wait(0.6)
        let current = await d.jsString("return window.__dmState().row.no")
        let index = (Int(current) ?? 1) - 1
        let natural = (await d.js("return window.__dmState().scene.duration")) as? Double ?? 0
        #expect(natural > 0)
        #expect(await d.dragControl("时长\(current)", by: 80))
        #expect(await d.until("写进文件", timeout: 3) {
            let saved = (await d.savedBoardQuick())?["rows"] as? [[String: Any]]
            return saved?[index]["dur"] != nil
        })
        let saved = ((await d.savedBoardQuick())?["rows"] as? [[String: Any]])?[index]["dur"] as? Double ?? 0
        print("拖动前 \(natural) 秒，拖动后 \(saved) 秒")
        #expect(abs(saved - natural - 2) < 0.6)
        #expect(await d.until("画面时长跟着变", timeout: 3) {
            let now = (await d.js("return window.__dmState().scene.duration")) as? Double ?? 0
            return abs(now - saved) < 0.01
        })
        await d.snap("剪辑台_拖长之后")
        d.document.undoManager?.undo()
        #expect(await d.until("撤销回去", timeout: 3) {
            let row = ((await d.savedBoardQuick())?["rows"] as? [[String: Any]])?[index]
            return row?["dur"] == nil
        })

        // 点片段上的效果胶囊：弹窗，有预览，点一个就换
        #expect(await d.clickControl("效果\(current)"))
        #expect(await d.until("弹出挑选器", timeout: 3) { d.popover() != nil && d.hasControl("分类文字特效") })
        #expect(await d.until("预览画出来", timeout: 8) { d.hasControl("预览画面") })
        let effectPop = try #require(d.popover())
        await WindowDriver(document: d.document, window: effectPop, web: d.web, out: d.out).snap("剪辑台_换效果")
        #expect(await d.clickControl("分类文字特效", in: effectPop))
        #expect(await d.until("文字特效", timeout: 3) { d.hasControl("极光渐变") })
        #expect(await d.clickControl("极光渐变", in: effectPop))
        #expect(await d.until("换好了", timeout: 4) { await d.jsString("return window.__dmState().row.tpl") == "cot01" })
        await d.closePopover("效果\(current)")
        d.document.undoManager?.undo()
        #expect(await d.until("换回去", timeout: 3) { await d.jsString("return window.__dmState().row.tpl") != "cot01" })

        // 全片没有出镜了
        let allRows = (await d.savedBoardQuick())?["rows"] as? [[String: Any]] ?? []
        #expect(!allRows.contains { ($0["tpl"] as? String) == "aroll" })

        // 右栏默认收起，点开才有；开关不影响画面
        await d.snap("剪辑台_收起右栏")
        #expect(await d.menu("显示或隐藏这一镜"))
        await d.wait(0.6)
        await d.snap("剪辑台_右栏")
        #expect(await d.menu("显示或隐藏这一镜"))
        await d.wait(0.4)

        #expect(await d.menu("文稿"))
        await d.wait(0.6)
        await d.snap("剪辑台_文稿")
        #expect(await d.menu("分镜表"))
        await d.wait(0.8)
        await d.snap("剪辑台_分镜表")
        #expect(await d.menu("画面"))
        await d.wait(0.4)

        // 关于：感谢动效来源
        let before = Set(NSApp.windows.map(\.windowNumber))
        #expect(await d.menu("关于肉呆爱动效"))
        var about: NSWindow?
        #expect(await d.until("关于窗口", timeout: 4) {
            about = NSApp.windows.first { !before.contains($0.windowNumber) && $0.isVisible }
            return about != nil
        })
        if let about {
            await d.wait(0.5)
            await WindowDriver(document: d.document, window: about, web: d.web, out: d.out).snap("关于")
            about.close()
        }
        d.window.makeKeyAndOrderFront(nil)
        await d.wait(0.3)

        #expect(d.pageSeamMatches())
        // 没有版式切换，也没有左边的列表
        #expect(!d.hasControl("版式"))
        #expect(!d.hasControl("镜头026"))
        d.document.updateChangeCount(.changeCleared)
        d.document.close()

        // 关掉窗口再开一个：时间线还在
        let next = try await makeDriver(out)
        await next.wait(1)
        #expect(await next.until("时间线", timeout: 5) { next.hasControl("片段001") })
        next.document.updateChangeCount(.changeCleared)
        next.document.close()
    }

    @Test("拆分和组合：回车、B、退格、选中几句，字不丢，动效重配，能撤销")
    func splitAndMerge() async throws {
        ControlFrames.entries.removeAll()
        let out = FileManager.default.temporaryDirectory.appending(path: "flow-shots", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
        let demo = try #require(Bundle.main.url(forResource: "示例分镜", withExtension: "dmboard"))
        let d = try await makeDriver(out, board: demo)
        #expect(await d.until("渲染页就绪") { (await d.js("return !!window.__dmReady") as? Bool) == true })
        await d.wait(1)
        func rows() async -> [[String: Any]] { ((await d.savedBoardQuick())?["rows"] as? [[String: Any]]) ?? [] }
        func text(_ row: [String: Any]) -> String { row["line"] as? String ?? "" }
        func currentNo() async -> String { await d.jsString("return window.__dmState().row.no") }
        let script = try #require(WindowDriver.find(ScriptTextView.self, in: d.window.contentView))
        let follow = try #require(script.script)
        let start = await rows()
        #expect(start.count == 16)

        // 脚本框回车：拆在光标处，字不丢，选到第二段
        await d.goToShot("013")
        await d.wait(0.6)
        await d.clickQueued(at: try #require(follow.point(of: 13, fraction: 0.5)))
        #expect(d.window.firstResponder === script)
        await d.key(36, "\r")
        #expect(await d.until("回车拆成两镜", timeout: 4) { await rows().count == 17 })
        var now = await rows()
        #expect(text(now[12]) + text(now[13]) == text(start[12]))
        #expect(await d.until("选到第二段", timeout: 3) { await currentNo() == "014" })
        await d.snap("拆分_回车")
        d.document.undoManager?.undo()
        #expect(await d.until("撤销回一镜", timeout: 3) { await rows().count == 16 })
        #expect(text((await rows())[12]) == text(start[12]))

        // 时间线 B：拆在播放头，两段时长加起来不变
        await d.goToShot("003")
        await d.wait(0.8)
        let total = (await d.js("return window.__dmState().scene.duration")) as? Double ?? 0
        #expect(total > 2)
        _ = await d.js("DMBridge.seek(window.__dmState().scene.duration * 0.4)")
        await d.wait(0.4)
        d.window.makeFirstResponder(nil)
        await d.key(11, "b")
        #expect(await d.until("B 拆成两镜", timeout: 4) { await rows().count == 17 })
        now = await rows()
        let parts = (now[2]["dur"] as? Double ?? 0) + (now[3]["dur"] as? Double ?? 0)
        print("B 拆分：总长 \(total)，两段 \(now[2]["dur"] ?? "无") \(now[3]["dur"] ?? "无")，字：\(text(now[2])) / \(text(now[3]))")
        #expect(abs(parts - total) < 0.1)
        #expect(text(now[2]) + text(now[3]) == text(start[2]))
        d.document.undoManager?.undo()
        #expect(await d.until("撤销回一镜", timeout: 3) { await rows().count == 16 })

        // 选中两句，右键组合：字连起来，两个数都进数据动效
        await d.goToShot("003")
        await d.wait(0.6)
        let spanStart = try #require(follow.characterIndex(of: 3))
        let spanEnd = try #require(follow.characterIndex(of: 5))
        script.setSelectedRange(NSRange(location: spanStart, length: spanEnd - spanStart - 1))
        let inside = try #require(follow.point(of: 3, fraction: 0.5))
        let right = try #require(NSEvent.mouseEvent(with: .rightMouseDown, location: inside, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: d.window.windowNumber, context: nil, eventNumber: 0, clickCount: 1, pressure: 1))
        let menu = try #require(follow.menu(for: right))
        print("脚本右键：", menu.items.map(\.title))
        let combine = try #require(menu.items.firstIndex { $0.title == "组合这 2 句" })
        #expect(menu.items.contains { $0.title == "重新匹配这 2 句" })
        #expect(menu.items.contains { $0.title == "导出这 2 句…" })
        menu.performActionForItem(at: combine)
        #expect(await d.until("组合成一镜", timeout: 4) { await rows().count == 15 })
        now = await rows()
        print("组合：\(now[2]["tpl"] ?? "") \(text(now[2]))")
        #expect(text(now[2]).contains("72%") && text(now[2]).contains("18%"))
        let metrics = ((now[2]["groups"] as? [[String: Any]]) ?? []).flatMap { ($0["metrics"] as? [[String: Any]]) ?? [] }
        #expect(metrics.count == 2)
        #expect(await d.until("选到组合后的这一镜", timeout: 3) { await currentNo() == "003" })
        await d.wait(0.6)
        await d.snap("组合_脚本")
        d.document.undoManager?.undo()
        #expect(await d.until("撤销回两镜", timeout: 3) { await rows().count == 16 })

        // 退格：光标在句首，并回上一句
        await d.goToShot("006")
        await d.wait(0.6)
        script.setSelectedRange(NSRange(location: try #require(follow.characterIndex(of: 6)), length: 0))
        script.wantsFocus = true
        d.window.makeFirstResponder(script)
        await d.key(51, "\u{7F}")
        #expect(await d.until("退格并回上一句", timeout: 4) { await rows().count == 15 })
        d.document.undoManager?.undo()
        #expect(await d.until("撤销", timeout: 3) { await rows().count == 16 })

        // 脚本框打不了字，字母键不改文稿
        let before = script.string
        script.wantsFocus = true
        d.window.makeFirstResponder(script)
        await d.key(0, "a")
        #expect(script.string == before)

        // ⌘ 点两个片段：画面不换，两个片段都标出来
        d.window.makeFirstResponder(nil)
        await d.goToShot("002")
        await d.wait(0.6)
        for name in ["片段003", "片段004"] {
            let frame = try #require(ControlFrames.frame { $0 == name })
            await d.clickQueued(at: NSPoint(x: frame.minX + 24, y: d.window.frame.height - frame.midY), flags: .command)
        }
        await d.wait(0.4)
        #expect(await currentNo() == "002")
        await d.snap("多选片段")
        // 只有当前这一句亮：别的句子没有留下颜色
        let layout = try #require(script.layoutManager)
        let bright = (script.string as NSString).length
        var lit = 0
        var at = 0
        while at < bright {
            var range = NSRange()
            if layout.temporaryAttribute(.foregroundColor, atCharacterIndex: at, effectiveRange: &range) != nil { lit += range.length }
            at = max(at + 1, range.location + range.length)
        }
        #expect(lit == (text((await rows())[1]) as NSString).length)
        d.document.updateChangeCount(.changeCleared)
        d.document.close()
    }

    // 官网教程和微博图用的真实截图。平时跳过：TEST_RUNNER_TUTORIAL_SHOTS=1 才跑
    @Test("教程截图", .enabled(if: ProcessInfo.processInfo.environment["TUTORIAL_SHOTS"] != nil))
    func tutorialShots() async throws {
        ControlFrames.entries.removeAll()
        let out = FileManager.default.temporaryDirectory.appending(path: "tutorial-shots", directoryHint: .isDirectory)
        try? FileManager.default.removeItem(at: out)
        try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
        let demo = try #require(Bundle.main.url(forResource: "示例分镜", withExtension: "dmboard"))
        let whole = try #require(try JSONSerialization.jsonObject(with: Data(contentsOf: demo)) as? [String: Any])
        let fixture = try #require(Bundle(for: WindowDriver.self).url(forResource: "aroll", withExtension: "mov"))

        // 首页：两个大按钮
        let emptyFile = FileManager.default.temporaryDirectory.appending(path: "tutorial-empty-\(UUID().uuidString).dmboard")
        try JSONSerialization.data(withJSONObject: ["title": "示例分镜：一杯咖啡", "rows": []] as [String: Any]).write(to: emptyFile)
        let home = try await makeDriver(out, board: emptyFile, fileName: "一杯咖啡")
        #expect(await home.until("渲染页就绪") { (await home.js("return !!window.__dmReady") as? Bool) == true })
        await home.wait(1.2)
        await home.snap("01_首页")
        // 导入 A-roll：抓进度和结果
        NotificationCenter.default.post(name: .debugImportFile, object: fixture)
        await home.wait(0.8)
        await home.snap("02_识别中")
        #expect(await home.until("识别并拆好", timeout: 60) { ((await home.savedBoardQuick())?["rows"] as? [[String: Any]])?.count ?? 0 >= 4 })
        await home.wait(1.5)
        await home.snap("03_A-roll结果")
        home.document.updateChangeCount(.changeCleared)
        home.document.close()

        // 文稿页：贴好文字，按生成分镜
        let scriptFile = FileManager.default.temporaryDirectory.appending(path: "tutorial-script-\(UUID().uuidString).dmboard")
        try JSONSerialization.data(withJSONObject: ["title": "示例分镜：一杯咖啡", "rows": [], "script": whole["script"] ?? ""] as [String: Any]).write(to: scriptFile)
        let script = try await makeDriver(out, board: scriptFile, fileName: "一杯咖啡")
        #expect(await script.until("渲染页就绪") { (await script.js("return !!window.__dmReady") as? Bool) == true })
        await script.wait(1.2)
        await script.snap("04_文稿")
        #expect(await script.clickControl("生成分镜"))
        #expect(await script.until("分镜出来", timeout: 20) { ((await script.savedBoardQuick())?["rows"] as? [[String: Any]])?.count ?? 0 >= 4 })
        await script.wait(1.5)
        await script.snap("05_生成分镜")
        script.document.updateChangeCount(.changeCleared)
        script.document.close()

        // 剪辑台：示例分镜第 3 镜，一百根
        let d = try await makeDriver(out, board: demo, fileName: "一杯咖啡")
        #expect(await d.until("渲染页就绪") { (await d.js("return !!window.__dmReady") as? Bool) == true })
        await d.wait(1)
        await d.goToShot("003")
        #expect(await d.until("时间线出来", timeout: 5) { d.hasControl("片段003") })
        await d.wait(1)
        _ = await d.js("DMBridge.seek(window.__dmState().scene.duration - 0.3)")
        await d.wait(0.6)
        _ = await d.js("DMBridge.seek(window.__dmState().scene.duration * 0.55)")
        await d.wait(0.5)
        let liveBox = try #require(WindowDriver.find(ScriptTextView.self, in: d.window.contentView))
        if let spot = liveBox.script?.point(of: 3, fraction: 0) {
            ControlFrames.record(UUID(), "当前句", CGRect(x: spot.x, y: d.window.frame.height - spot.y - 16, width: 190, height: 32))
        }
        await d.snap("06_剪辑台")
        _ = await d.js("DMBridge.seek(window.__dmState().scene.duration - 0.3)")
        await d.wait(0.4)

        // 文稿页：示例分镜有字，底部有导入和生成
        #expect(await d.menu("文稿"))
        await d.wait(0.8)
        await d.snap("17_文稿页")
        #expect(await d.menu("画面"))
        await d.wait(0.6)
        _ = await d.js("DMBridge.seek(window.__dmState().scene.duration - 0.3)")
        await d.wait(0.3)

        // 拖片段右边缘：拖到一半抓一张
        let start = try #require(d.axPoint({ $0 == "时长003" }))
        d.mouse(.leftMouseDown, at: start, in: d.window)
        await d.wait(0.05)
        for i in 1...8 {
            d.mouse(.leftMouseDragged, at: NSPoint(x: start.x + 90 * CGFloat(i) / 8, y: start.y), in: d.window)
            await d.wait(0.03)
        }
        await d.wait(0.3)
        await d.snap("07_拖时长")
        d.mouse(.leftMouseUp, at: NSPoint(x: start.x + 90, y: start.y), in: d.window)
        await d.wait(0.4)
        d.document.undoManager?.undo()
        await d.wait(0.4)

        // 点胶囊：弹窗和预览
        #expect(await d.clickControl("效果003"))
        #expect(await d.until("弹出挑选器", timeout: 3) { d.popover() != nil && d.hasControl("分类文字特效") })
        #expect(await d.until("预览画出来", timeout: 8) { d.hasControl("预览画面") })
        await d.wait(1.2)
        let pop = try #require(d.popover())
        let picker = WindowDriver(document: d.document, window: pop, web: d.web, out: d.out)
        await picker.snap("08_换效果")
        let field = try #require(pop.firstResponder as? NSTextView)
        field.insertText("错位", replacementRange: NSRange(location: 0, length: 0))
        #expect(await d.until("搜到错位印刷", timeout: 3) { d.hasControl("错位印刷") })
        await d.wait(1)
        #expect(await d.clickControl("错位印刷", in: pop))
        #expect(await d.until("预览错位印刷", timeout: 8) { await d.jsString("return window.__dmState().row.tpl") == "kxm_misprint" })
        await d.wait(1.8)
        await picker.snap("09_错位印刷")
        await d.snap("10_窗口和弹窗")
        await d.closePopover("效果003")
        d.document.undoManager?.undo()
        await d.wait(0.6)

        // 脚本框回车拆开：第 5 镜
        let scriptBox = try #require(WindowDriver.find(ScriptTextView.self, in: d.window.contentView))
        let follow = try #require(scriptBox.script)
        await d.goToShot("005")
        await d.wait(0.6)
        let caret = try #require(follow.point(of: 5, fraction: 0.5))
        await d.clickQueued(at: caret)
        await d.wait(0.5)
        ControlFrames.record(UUID(), "光标", CGRect(x: caret.x - 4, y: d.window.frame.height - caret.y - 16, width: 8, height: 32))
        await d.snap("15a_光标")
        await d.key(36, "\r")
        #expect(await d.until("回车拆成两镜", timeout: 4) { ((await d.savedBoardQuick())?["rows"] as? [[String: Any]])?.count == 17 })
        await d.wait(1)
        let first = try #require(follow.point(of: 5, fraction: 0))
        let second = try #require(follow.point(of: 6, fraction: 0))
        ControlFrames.record(UUID(), "第一段", CGRect(x: first.x, y: d.window.frame.height - first.y - 16, width: 200, height: 32))
        ControlFrames.record(UUID(), "第二段", CGRect(x: second.x, y: d.window.frame.height - second.y - 16, width: 200, height: 32))
        await d.snap("15_回车拆分")
        d.document.undoManager?.undo()
        await d.wait(0.8)
        d.window.makeFirstResponder(nil)

        // ⌘ 点两个片段
        await d.goToShot("002")
        await d.wait(0.8)
        for name in ["片段003", "片段004"] {
            let frame = try #require(ControlFrames.frame { $0 == name })
            await d.clickQueued(at: NSPoint(x: frame.minX + 24, y: d.window.frame.height - frame.midY), flags: .command)
        }
        await d.wait(0.5)
        await d.snap("16_多选片段")
        await d.goToShot("003")
        let plain = try #require(ControlFrames.frame { $0 == "片段003" })
        await d.clickQueued(at: NSPoint(x: plain.minX + 24, y: d.window.frame.height - plain.midY))
        await d.wait(0.6)
        _ = await d.js("DMBridge.seek(window.__dmState().scene.duration - 0.3)")
        await d.wait(0.3)

        // 这一镜：右栏改文字和数字
        #expect(await d.menu("显示或隐藏这一镜"))
        await d.wait(0.8)
        await d.snap("11_这一镜")
        #expect(await d.menu("显示或隐藏这一镜"))
        await d.wait(0.4)

        // 分镜表
        #expect(await d.menu("分镜表"))
        await d.wait(0.8)
        await d.snap("12_分镜表")
        #expect(await d.menu("画面"))
        await d.wait(0.5)

        // 导出面板
        #expect(await d.clickControl("导出…"))
        await d.wait(1.2)
        // 面板是当前窗口，按钮才是激活的样子
        Backstage.key = d.window.attachedSheet ?? d.window
        if let sheet = d.window.attachedSheet {
            NotificationCenter.default.post(name: NSWindow.didBecomeKeyNotification, object: sheet)
            NotificationCenter.default.post(name: NSWindow.didBecomeMainNotification, object: sheet)
            sheet.display()
        }
        await d.wait(0.5)
        await d.snap("13_导出", sheet: true)
        Backstage.key = d.window
        await d.snap("14_导出窗口")
        d.window.attachedSheet.map { d.window.endSheet($0) }
        d.document.updateChangeCount(.changeCleared)
        d.document.close()
        print("教程截图：\(out.path)")
    }

    @Test("A-roll：导入视频，本机识别、按句拆镜、配动效，时长对到声音上")
    func arollFlow() async throws {
        final class Token {}
        let fixture = try #require(Bundle(for: Token.self).url(forResource: "aroll", withExtension: "mov"))
        let out = FileManager.default.temporaryDirectory.appending(path: "flow-shots", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)

        // 什么都没有：字从声音里来。用有路径的空文档：没存过盘的文档一保存就弹面板，测试会卡住
        let e = try await makeDriver(out) { $0 = [] }
        #expect(await e.until("渲染页就绪") { (await e.js("return !!window.__dmReady") as? Bool) == true })
        await e.wait(0.8)
        await e.snap("A-roll_首页")
        #expect(e.hasControl("导入 A-roll"))
        NotificationCenter.default.post(name: .debugImportFile, object: fixture)
        #expect(await e.until("识别并拆好", timeout: 60) { ((await e.savedBoardQuick())?["rows"] as? [[String: Any]])?.count ?? 0 >= 4 })
        let rows = (await e.savedBoardQuick())?["rows"] as? [[String: Any]] ?? []
        for r in rows { print("A-roll 镜头", r["no"] ?? "", r["tpl"] ?? "", r["dur"] ?? "无时长", r["line"] ?? "") }
        let asset = AVURLAsset(url: fixture)
        let length = try await asset.load(.duration).seconds
        let total = rows.compactMap { $0["dur"] as? Double }.reduce(0, +)
        print("A-roll 长度 \(length)，镜头时长加起来 \(total)")
        #expect(rows.allSatisfy { $0["dur"] != nil })
        #expect(abs(total - length) < 1.5)
        #expect(rows.contains { ($0["line"] as? String ?? "").contains("咖啡") })
        // 带百分比的句子走数据动效
        #expect(rows.contains { $0["groups"] != nil })
        // 说到的短句配上了具体动效，不全是重音字幕
        #expect(rows.contains { !["statement", "question"].contains($0["tpl"] as? String ?? "") && $0["groups"] == nil })
        #expect(!rows.contains { ($0["tpl"] as? String) == "aroll" })
        await e.wait(1)
        await e.snap("A-roll_生成后")
        e.document.updateChangeCount(.changeCleared)
        e.document.close()

        // 已有分镜：字和效果不动，只对时长
        let lines = ["欢迎收看一杯咖啡。", "我们询问了5000位朋友，其中有86%的朋友说：喝。", "这个系统彻底崩溃了。", "谢谢你的收看。"]
        let d = try await makeDriver(out) { all in
            all = lines.enumerated().map { i, line in
                ["id": i + 1, "no": String(format: "%03d", i + 1), "kind": "B", "cat": "文字动效", "line": line, "tpl": i == 2 ? "kxm_shake" : "statement", "lines": [line]] as [String: Any]
            }
        }
        #expect(await d.until("渲染页就绪") { (await d.js("return !!window.__dmReady") as? Bool) == true })
        await d.wait(0.5)
        NotificationCenter.default.post(name: .debugImportFile, object: fixture)
        #expect(await d.until("对好时长", timeout: 60) {
            let now = (await d.savedBoardQuick())?["rows"] as? [[String: Any]] ?? []
            return now.count == 4 && now.allSatisfy { $0["dur"] != nil }
        })
        let timed = (await d.savedBoardQuick())?["rows"] as? [[String: Any]] ?? []
        for r in timed { print("A-roll 对齐", r["no"] ?? "", r["tpl"] ?? "", r["dur"] ?? "") }
        #expect(timed.map { $0["line"] as? String ?? "" } == lines)
        #expect(timed[2]["tpl"] as? String == "kxm_shake")
        // 第三句在声音里靠后，前两镜不能被平均分
        let d0 = timed[0]["dur"] as? Double ?? 0
        let d1 = timed[1]["dur"] as? Double ?? 0
        #expect(d1 > d0)
        d.document.updateChangeCount(.changeCleared)
        d.document.close()

        // 文稿完全对不上：不动它，告诉人
        let wrong = try await makeDriver(out)
        #expect(await wrong.until("渲染页就绪") { (await wrong.js("return !!window.__dmReady") as? Bool) == true })
        await wrong.wait(0.5)
        NotificationCenter.default.post(name: .debugImportFile, object: fixture)
        await wrong.wait(8)
        let untouched = (await wrong.savedBoardQuick())?["rows"] as? [[String: Any]] ?? []
        #expect(untouched.count == 133)
        #expect(!untouched.contains { $0["dur"] != nil })
        await wrong.snap("A-roll_对不上")
        wrong.document.updateChangeCount(.changeCleared)
        wrong.document.close()
    }

    @Test("按钮：导出面板走真引擎")
    func exportSheetFlow() async throws {
        ControlFrames.entries.removeAll()
        let out = FileManager.default.temporaryDirectory.appending(path: "flow-shots", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
        let d = try await makeDriver(out)
        #expect(await d.until("渲染页就绪") { (await d.js("return !!window.__dmReady") as? Bool) == true })
        let defaults = UserDefaults.standard
        let savedSize = defaults.string(forKey: "export.size")
        let savedFps = defaults.object(forKey: "export.fps")
        defaults.set(ExportSize.hd.rawValue, forKey: "export.size")
        defaults.set(30, forKey: "export.fps")
        defer {
            defaults.set(savedSize, forKey: "export.size")
            defaults.set(savedFps, forKey: "export.fps")
        }
        let sample = try #require(Bundle(for: WindowDriver.self).url(forResource: "窗口测试分镜", withExtension: "dmboard"))
        let board = try BoardDocument.decode(try Data(contentsOf: sample))
        // 挑文字最长的一百根：批量导出要跑一会儿，才来得及点停止
        let comb = try #require(board.rows.filter { $0.template == "comb" && !$0.isPending && $0.fields["groups"] != nil }.max { $0.line.count < $1.line.count })
        let dots = try #require(board.rows.first { $0.template == "dots" && !$0.isPending })
        let dir = FileManager.default.temporaryDirectory.appending(path: "sheet-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: dir) }

        let names = ["comb": "一百根", "dots": "一百人"]
        let two = Board(title: "", rows: [comb, dots], script: nil)

        // 一镜：点导出，按钮里出进度和停止；完成后变绿，文件读得回来
        let file = dir.appending(path: "single.mp4")
        let g = await hostWindow(ExportSheet(board: two, current: comb, visible: two.rows, picked: [], names: names, destination: { _ in file }), size: NSSize(width: 380, height: 220), d: d)
        await g.wait(0.5)
        await g.snap("面板_导出_开始前")
        #expect(await g.clickControl("导出"))
        #expect(await g.until("出现停止", timeout: 5) { g.hasControl("停止") })
        await g.wait(0.7)
        await g.snap("面板_导出_运行中")
        #expect(await g.until("导出完成", timeout: 90) { g.hasControl("已导出") })
        await g.wait(0.5)
        await g.snap("面板_导出_完成")
        #expect(FileManager.default.fileExists(atPath: file.path))
        #expect(await g.until("停止收起", timeout: 4) { !g.hasControl("停止") })
        g.window.close()

        // 一镜：Esc 中途停止，回到可以重新开始，不留文件
        ControlFrames.entries.removeAll()
        let stopped = dir.appending(path: "stopped.mp4")
        let h = await hostWindow(ExportSheet(board: two, current: comb, visible: two.rows, picked: [], names: names, destination: { _ in stopped }), size: NSSize(width: 380, height: 220), d: d)
        await h.wait(0.5)
        await h.key(36, "\r")
        #expect(await h.until("回车开始", timeout: 5) { h.hasControl("停止") })
        await h.wait(0.4)
        await h.key(53, "\u{1b}")
        #expect(await h.until("回到开始", timeout: 15) { h.hasControl("导出") })
        await h.wait(0.5)
        await h.snap("面板_导出_已停止")
        let left = try FileManager.default.contentsOfDirectory(atPath: dir.path).filter { $0.contains("stopped") }
        #expect(left.isEmpty)
        h.window.close()

        // 多镜：按钮里出总进度，点停止
        ControlFrames.entries.removeAll()
        let batchDir = dir.appending(path: "batch", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: batchDir, withIntermediateDirectories: true)
        let b = await hostWindow(ExportSheet(board: two, current: nil, visible: two.rows, picked: [], names: names, destination: { _ in batchDir }), size: NSSize(width: 560, height: 360), d: d)
        await b.wait(0.5)
        await b.snap("面板_批量_开始前")
        #expect(await b.clickControl("导出"))
        #expect(await b.until("批量运行中", timeout: 5) { b.hasControl("停止") })
        await b.wait(0.8)
        await b.snap("面板_批量_运行中")
        #expect(await b.clickControl("停止"))
        #expect(await b.until("批量停下", timeout: 15) { !b.hasControl("停止") })
        await b.wait(0.5)
        await b.snap("面板_批量_已停止")
        b.window.close()

        // 多镜跑到完成：已有的文件跳过
        ControlFrames.entries.removeAll()
        let existing = batchDir.appending(path: BatchRunner.fileName(for: comb, templateName: "一百根", size: .hd, fps: 30))
        try Data("已有".utf8).write(to: existing)
        // 上一步停下之前，短的那一镜可能已经导完。删掉它，这一步才是「一镜完成、一镜跳过」
        try? FileManager.default.removeItem(at: batchDir.appending(path: BatchRunner.fileName(for: dots, templateName: "一百人", size: .hd, fps: 30)))
        let c = await hostWindow(ExportSheet(board: two, current: nil, visible: two.rows, picked: [], names: names, destination: { _ in batchDir }), size: NSSize(width: 560, height: 360), d: d)
        await c.wait(0.5)
        #expect(await c.clickControl("导出"))
        #expect(await c.until("批量完成", timeout: 90) { c.hasControl("完成 1，跳过 1") })
        await c.wait(0.6)
        await c.snap("面板_批量_完成")
        c.window.close()

        d.document.updateChangeCount(.changeCleared)
        d.document.close()
    }

    @Test("设置窗口")
    func settingsWindow() async throws {
        ControlFrames.entries.removeAll()
        let out = FileManager.default.temporaryDirectory.appending(path: "flow-shots", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
        let d = try await makeDriver(out)
        await d.wait(0.5)
        // 走应用菜单打开真正的设置窗口
        let before = Set(NSApp.windows.map(\.windowNumber))
        #expect(await d.menu("设置…"))
        var settingsWindow: NSWindow?
        #expect(await d.until("设置窗口打开") {
            settingsWindow = NSApp.windows.first { !before.contains($0.windowNumber) && $0.isVisible }
            return settingsWindow != nil
        })
        if let settingsWindow {
            await d.wait(0.6)
            let shot = WindowDriver(document: d.document, window: settingsWindow, web: d.web, out: out)
            await shot.snap("11_设置_AI")

            // 真实点击：连本机假服务测连接、拿模型；不可恢复的删除要确认
            for stale in AISettings.shared.profiles where stale.name.hasPrefix("假服务") { AISettings.shared.remove(stale) }
            let saved = (AISettings.shared.profiles, AISettings.shared.activeID)
            defer {
                AISettings.shared.profiles = saved.0
                AISettings.shared.activeID = saved.1
            }
            let profile = try AISettings.shared.add(ImportedAIConfig(name: "假服务设置页", kind: .openAICompatible, baseURL: "http://127.0.0.1:18765/v1", model: "mock-model", apiKey: "fake-key"))
            AISettings.shared.activeID = profile.id
            settingsWindow.close()
            await d.wait(0.3)
            #expect(await d.menu("设置…"))
            var second: NSWindow?
            #expect(await d.until("设置窗口再次打开") {
                second = NSApp.windows.first { $0.isVisible && $0 !== d.window && $0.title != "" && !before.contains($0.windowNumber) }
                return second != nil && d.hasControl("测试连接")
            })
            if let second {
                let s = WindowDriver(document: d.document, window: second, web: d.web, out: out)
                await s.wait(0.5)
                await s.snap("按钮_设置_连接前")
                #expect(await s.clickControl("测试连接", settle: 0.02))
                #expect(await s.until("连通", timeout: 8) { await s.snapIfResult("按钮_设置_已连通") })
                // 测试连接顺便拿到模型列表
                #expect(await s.until("模型列表", timeout: 3) { s.hasControl("选择模型") })
                await s.wait(1.8)
                let countBefore = AISettings.shared.profiles.count
                let name = "删除服务"
                #expect(await s.clickControl(name, settle: 0.5))
                await s.snap("按钮_设置_确认删除")
                #expect(await s.clickControl("取消"))
                await s.wait(0.4)
                #expect(AISettings.shared.profiles.count == countBefore)
                #expect(await s.clickControl(name, settle: 0.5))
                #expect(await s.clickControl("删除服务和 Key"))
                await s.wait(0.4)
                #expect(AISettings.shared.profiles.count == countBefore - 1)
                second.close()
            }
        }
        d.document.updateChangeCount(.changeCleared)
        d.document.close()
    }
}

// ---------- 按钮：状态表、真实点击、文档里的撤销 ----------
private struct ButtonGallery: View {
    @State private var asking = true
    @State private var never = false

    private func row<Content: View>(_ title: String, @ViewBuilder _ content: () -> Content) -> some View {
        HStack(alignment: .center, spacing: 12) {
            Text(title).font(.caption).foregroundStyle(.secondary).frame(width: 64, alignment: .leading)
            content()
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            row("基础") {
                Button("导入") {}.buttonStyle(.pill(.prominent))
                Button("取消") {}.buttonStyle(.pill())
                Button("导入…") {}.buttonStyle(.pill(.quiet))
                Button("导入字体…") {}.buttonStyle(.pill(size: .small))
                Button("删掉这个数", role: .destructive) {}.buttonStyle(.pill(size: .small))
                Button("不可用") {}.buttonStyle(.pill()).disabled(true)
            }
            row("图标") {
                Button {} label: { Image(systemName: "play.fill") }.buttonStyle(.icon())
                Button {} label: { Image(systemName: "square.3.layers.3d") }.buttonStyle(.icon())
                Button {} label: { Image(systemName: "checkmark") }.buttonStyle(.icon(diameter: 22))
                Button {} label: { Image(systemName: "plus") }.buttonStyle(.icon(diameter: 22, faint: true))
                Button {} label: { Image(systemName: "eye") }.buttonStyle(.icon(diameter: 22, faint: true))
            }
            row("任务") {
                TaskButton(title: "导出", phase: .idle, onStart: {}, onStop: {})
                TaskButton(title: "生成分镜", phase: .idle, enabled: false, onStart: {}, onStop: {})
                TaskButton(title: "", phase: .running(0.08, "正在导出"), onStart: {}, onStop: {})
                TaskButton(title: "", phase: .running(0.62, "正在导出"), onStart: {}, onStop: {})
            }
            row("") {
                TaskButton(title: "", phase: .running(0.45, "第 3/5 段（第二章）：已收到 1208 字"), onStart: {}, onStop: {})
                TaskButton(title: "", phase: .finished("已导出", ok: true), onStart: {}, onStop: {})
            }
            row("") {
                TaskButton(title: "", phase: .finished("完成 12，跳过 3", ok: true), onStart: {}, onStop: {})
                TaskButton(title: "", phase: .finished("完成 12，失败 1", ok: false), onStart: {}, onStop: {})
            }
            row("结果") {
                ResultButton(title: "测试连接", phase: .constant(.idle)) {}
                ResultButton(title: "测试连接", phase: .constant(.working)) {}
                ResultButton(title: "测试连接", phase: .constant(.success("已连通"))) {}
                ResultButton(title: "测试连接", phase: .constant(.failure("连不上"))) {}
                ResultButton(title: "测试连接", phase: .constant(.idle), enabled: false) {}
            }
            row("确认") {
                ConfirmDeleteButton(symbol: "trash", label: "删除字体", confirmTitle: "删除字体", asking: $never) {}
                ConfirmDeleteButton(symbol: "minus", label: "删除服务", confirmTitle: "删除服务和 Key", asking: $asking) {}
            }
            row("限时撤销") {
                TimedUndoPill(text: "已删除第 012 镜", undo: {}, dismiss: {})
            }
        }
        .padding(24)
        .frame(width: 900, alignment: .leading)
        .background(.background)
    }
}

@MainActor
@Observable
private final class ButtonProbe {
    var phase: TaskPhase = .idle
    var starts = 0
    var stops = 0
    var asking = false
    var confirms = 0
    var result: ResultPhase = .idle
    var hits = 0
    var plain = 0
    var disabledHits = 0
}

private struct ButtonLive: View {
    @Bindable var probe: ButtonProbe

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                Button("普通按钮") { probe.plain += 1 }.buttonStyle(.pill()).testFrame("普通按钮")
                Button("点不了") { probe.disabledHits += 1 }.buttonStyle(.pill()).disabled(true).testFrame("点不了")
                ResultButton(title: "保存 Key", phase: $probe.result) {
                    probe.hits += 1
                    probe.result = .success("已保存")
                }
            }
            HStack(spacing: 10) {
                TaskButton(title: "导出", phase: probe.phase) {
                    probe.starts += 1
                    probe.phase = .running(0.3, "正在导出")
                } onStop: {
                    probe.stops += 1
                    probe.phase = .idle
                }
            }
            .followsMorph(probe.phase.stage)
            HStack {
                ConfirmDeleteButton(symbol: "trash", label: "删除字体", confirmTitle: "删除字体确认", asking: $probe.asking) {
                    probe.confirms += 1
                }
            }
        }
        .padding(24)
        .frame(width: 640, height: 190, alignment: .topLeading)
        .background(.background)
    }
}

extension WindowDriver {
    /// 打开着的弹出层是单独的窗口
    func popover() -> NSWindow? {
        NSApp.windows.first { $0.isVisible && $0 !== window && String(describing: type(of: $0)).contains("Popover") }
    }

    /// 收起弹出层：再点一下打开它的按钮。合成事件触发不了系统的「点别处收起」
    func closePopover(_ trigger: String) async {
        guard popover() != nil else { return }
        await clickControl(trigger)
        _ = await until("弹出层收起", timeout: 3) { popover() == nil }
        window.makeKeyAndOrderFront(nil)
        await wait(0.3)
    }

    /// 窗口里两个点的颜色是否一样：渲染页最下面一行、下方控制行的空白处
    func pageSeamMatches() -> Bool {
        typealias Fn = @convention(c) (CGRect, UInt32, UInt32, UInt32) -> Unmanaged<CGImage>?
        guard let sym = dlsym(UnsafeMutableRawPointer(bitPattern: -2), "CGWindowListCreateImage") else { return false }
        let fn = unsafeBitCast(sym, to: Fn.self)
        guard let image = fn(.null, 8, UInt32(window.windowNumber), 1 | 8)?.takeRetainedValue() else { return false }
        let rep = NSBitmapImageRep(cgImage: image)
        let scale = CGFloat(rep.pixelsWide) / window.frame.width
        let frame = web.convert(web.bounds, to: nil)
        // AppKit 坐标从窗口下边算起，图片从上边算起
        let x = Int((frame.minX + 4) * scale)
        let inWeb = rep.colorAt(x: x, y: rep.pixelsHigh - Int((frame.minY + 6) * scale))
        let inBar = rep.colorAt(x: x, y: rep.pixelsHigh - Int((frame.minY - 6) * scale))
        guard let inWeb, let inBar else { return false }
        let close = abs(inWeb.redComponent - inBar.redComponent) + abs(inWeb.greenComponent - inBar.greenComponent) + abs(inWeb.blueComponent - inBar.blueComponent)
        print("接缝颜色：渲染页 \(inWeb) 原生 \(inBar)")
        return close < 0.02
    }

    /// 测试连接的结果只在按钮上停一下，等到就拍。这里不看按钮内容，等 0.7 秒，结果停留 1.6 秒
    /// 一直按下一镜，直到走到这一镜。新窗口拿到焦点之前菜单不生效，不能按固定次数
    func goToShot(_ no: String) async {
        for _ in 0..<300 {
            let now = await jsString("return window.__dmState().row.no")
            if now == no { return }
            await menu((Int(now) ?? 0) < (Int(no) ?? 0) ? "下一镜" : "上一镜")
            // 画面换镜头是异步的。不等它换好就再按，会一路冲过头
            for _ in 0..<15 {
                await wait(0.02)
                if await jsString("return window.__dmState().row.no") != now { break }
            }
        }
    }

    func snapIfResult(_ name: String) async -> Bool {
        await wait(0.7)
        await snap(name)
        return true
    }

    /// 按名字找控件，返回窗口坐标。位置来自调试版的 ControlFrames
    func axPoint(_ match: (String) -> Bool, in target: NSWindow? = nil) -> NSPoint? {
        let win = target ?? window
        guard let frame = ControlFrames.frame(matching: match) else { return nil }
        // SwiftUI 的 global 坐标从根视图顶部算起。主窗口的根视图盖满窗口（含标题栏），弹出层的根视图要让开箭头
        if let host = hostingRoot(of: win.contentView), host !== win.contentView {
            let bounds = host.bounds
            return host.convert(NSPoint(x: frame.midX, y: host.isFlipped ? frame.midY : bounds.height - frame.midY), to: nil)
        }
        return NSPoint(x: frame.midX, y: win.frame.height - frame.midY)
    }

    private func hostingRoot(of view: NSView?) -> NSView? {
        guard let view else { return nil }
        if String(describing: type(of: view)).contains("HostingView") { return view }
        for sub in view.subviews {
            if let found = hostingRoot(of: sub) { return found }
        }
        return nil
    }

    func hasControl(_ name: String, in target: NSWindow? = nil) -> Bool {
        axPoint({ $0 == name }, in: target) != nil
    }

    /// 排进事件队列再派发。文字框按下后会自己等松手，⌘ 点片段要读当前事件，这两种都得走队列
    func post(_ type: NSEvent.EventType, at p: NSPoint, flags: NSEvent.ModifierFlags = []) {
        Backstage.acceptFirstMouse(in: window)
        let e = NSEvent.mouseEvent(with: type, location: p, modifierFlags: flags, timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, eventNumber: 0, clickCount: 1, pressure: type == .leftMouseUp ? 0 : 1)
        if let e { NSApp.postEvent(e, atStart: false) }
    }

    func clickQueued(at p: NSPoint, flags: NSEvent.ModifierFlags = []) async {
        post(.leftMouseDown, at: p, flags: flags)
        post(.leftMouseUp, at: p, flags: flags)
        await wait(0.25)
    }

    // 走事件队列：窗口在屏幕外时，SwiftUI 的手势要从队列里拿事件才认
    func mouse(_ type: NSEvent.EventType, at p: NSPoint, in win: NSWindow) {
        // 窗口没在前台时，普通点击只用来激活窗口。这里没有激活这一步，所有视图都接第一次点击
        Backstage.acceptFirstMouse(in: win)
        if type == .leftMouseDown { Backstage.pressed = true }
        if type == .leftMouseUp { Backstage.pressed = false }
        let e = NSEvent.mouseEvent(with: type, location: p, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: win.windowNumber, context: nil, eventNumber: 0, clickCount: 1, pressure: type == .leftMouseUp ? 0 : 1)
        if let e { NSApp.postEvent(e, atStart: false) }
    }

    /// 真实鼠标事件按住一个原生控件横向拖一段
    func dragControl(_ name: String, by dx: CGFloat) async -> Bool {
        guard let start = axPoint({ $0 == name }) else { return false }
        mouse(.leftMouseDown, at: start, in: window)
        await wait(0.05)
        for i in 1...8 {
            mouse(.leftMouseDragged, at: NSPoint(x: start.x + dx * CGFloat(i) / 8, y: start.y), in: window)
            await wait(0.02)
        }
        mouse(.leftMouseUp, at: NSPoint(x: start.x + dx, y: start.y), in: window)
        await wait(0.2)
        return true
    }

    /// 真实鼠标事件点一个原生控件
    @discardableResult
    func clickControl(_ name: String, in target: NSWindow? = nil, settle: Double = 0.1) async -> Bool {
        await clickControl(where: { $0 == name }, in: target, settle: settle)
    }

    @discardableResult
    func clickControl(where match: (String) -> Bool, in target: NSWindow? = nil, settle: Double = 0.1) async -> Bool {
        let win = target ?? window
        guard let p = axPoint(match, in: win) else { return false }
        mouse(.mouseMoved, at: p, in: win)
        await wait(0.02)
        mouse(.leftMouseDown, at: p, in: win)
        await wait(0.04)
        mouse(.leftMouseUp, at: p, in: win)
        await wait(settle)
        return true
    }

    /// 按窗口坐标点一下
    func clickWindow(_ p: NSPoint) async {
        mouse(.mouseMoved, at: p, in: window)
        await wait(0.02)
        mouse(.leftMouseDown, at: p, in: window)
        await wait(0.04)
        mouse(.leftMouseUp, at: p, in: window)
        await wait(0.1)
    }

    /// 按住不放，给按下状态拍一张
    func pressAndSnap(_ name: String, shot: String, in target: NSWindow) async {
        guard let p = axPoint({ $0 == name }, in: target) else { return }
        mouse(.leftMouseDown, at: p, in: target)
        await wait(0.2)
        await snap(shot)
        mouse(.leftMouseUp, at: p, in: target)
        await wait(0.1)
    }

    /// 连拍形变过程，拼成一张
    func filmstrip(_ name: String, frames: Int = 8, every: Double = 0.035, act: () -> Void) async {
        typealias Fn = @convention(c) (CGRect, UInt32, UInt32, UInt32) -> Unmanaged<CGImage>?
        guard let sym = dlsym(UnsafeMutableRawPointer(bitPattern: -2), "CGWindowListCreateImage") else { return }
        let fn = unsafeBitCast(sym, to: Fn.self)
        act()
        var images: [CGImage] = []
        for _ in 0..<frames {
            await wait(every)
            if let image = fn(.null, 8, UInt32(window.windowNumber), 1 | 8)?.takeRetainedValue() { images.append(image) }
        }
        guard let first = images.first else { return }
        let columns = 2
        let lines = (images.count + 1) / columns
        let ctx = CGContext(data: nil, width: first.width * columns, height: first.height * lines, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
        for (i, image) in images.enumerated() {
            ctx.draw(image, in: CGRect(x: (i % columns) * first.width, y: (lines - 1 - i / columns) * first.height, width: first.width, height: first.height))
        }
        guard let whole = ctx.makeImage() else { return }
        try? NSBitmapImageRep(cgImage: whole).representation(using: .png, properties: [:])?.write(to: out.appending(path: "\(name).png"))
    }
}

extension AppFlowTests {
    private func hostWindow<V: View>(_ view: V, size: NSSize, d: WindowDriver) async -> WindowDriver {
        let win = NSWindow(contentRect: NSRect(x: 120, y: 160, width: size.width, height: size.height), styleMask: [.titled, .closable], backing: .buffered, defer: false)
        win.isReleasedWhenClosed = false
        win.contentView = NSHostingView(rootView: view)
        win.makeKeyAndOrderFront(nil)
        for _ in 0..<40 where !win.isKeyWindow {
            win.makeKeyAndOrderFront(nil)
            await d.wait(0.1)
        }
        return WindowDriver(document: d.document, window: win, web: d.web, out: d.out)
    }

    @Test("按钮：每个状态的样子")
    func buttonGallery() async throws {
        // 关掉的窗口不会触发 onDisappear，上一个测试的位置要清掉
        ControlFrames.entries.removeAll()
        let out = FileManager.default.temporaryDirectory.appending(path: "flow-shots", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
        let d = try await makeDriver(out)
        let g = await hostWindow(ButtonGallery(), size: NSSize(width: 900, height: 620), d: d)
        NSApp.appearance = NSAppearance(named: .aqua)
        await g.wait(0.8)
        await g.snap("按钮_状态表_浅色")
        NSApp.appearance = NSAppearance(named: .darkAqua)
        await g.wait(0.6)
        await g.snap("按钮_状态表_深色")
        NSApp.appearance = nil
        g.window.close()
        d.document.updateChangeCount(.changeCleared)
        d.document.close()
    }

    @Test("按钮：真实鼠标和键盘")
    func buttonInteractions() async throws {
        // 关掉的窗口不会触发 onDisappear，上一个测试的位置要清掉
        ControlFrames.entries.removeAll()
        let out = FileManager.default.temporaryDirectory.appending(path: "flow-shots", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
        let d = try await makeDriver(out)
        let probe = ButtonProbe()
        let g = await hostWindow(ButtonLive(probe: probe), size: NSSize(width: 640, height: 190), d: d)
        let win = g.window
        await g.wait(0.5)

        // 普通按钮有效，禁用的按钮点不动，按下的样子留一张
        #expect(await g.clickControl("普通按钮"))
        #expect(probe.plain == 1)
        await g.clickControl("点不了")
        #expect(probe.disabledHits == 0)
        await g.pressAndSnap("普通按钮", shot: "按钮_按下", in: win)

        // 任务按钮：点开始，分裂出停止；点停止回去
        await g.filmstrip("按钮_任务分裂") { probe.starts += 1; probe.phase = .running(0.3, "正在导出") }
        #expect(g.hasControl("停止"))
        #expect(await g.clickControl("停止"))
        #expect(probe.stops == 1)
        #expect(await g.until("停止收起", timeout: 3) { !g.hasControl("停止") })
        await g.wait(0.2)
        #expect(await g.clickControl("导出"))
        #expect(probe.starts == 2)
        await g.wait(0.4)
        // Esc 就是停止
        await g.key(53, "\u{1b}")
        await g.wait(0.2)
        #expect(probe.stops == 2)
        await g.wait(0.4)
        // 回车就是开始（默认按钮）
        await g.key(36, "\r")
        await g.wait(0.2)
        #expect(probe.starts == 3)
        await g.wait(0.3)
        probe.phase = .running(0.8, "正在导出")
        await g.wait(0.4)
        await g.snap("按钮_任务运行中")
        await g.filmstrip("按钮_任务完成") { probe.phase = .finished("已导出", ok: true) }
        // 完成之后主按钮不再响应，回车也不会再开始一次
        await g.clickControl("已导出")
        await g.key(36, "\r")
        await g.wait(0.2)
        #expect(probe.starts == 3)

        // 确认删除：展开后 350 毫秒内的点击不算，防双击；之后才算
        #expect(await g.clickControl("删除字体", settle: 0.02))
        #expect(probe.asking)
        await g.clickControl("删除字体确认", settle: 0.02)
        #expect(probe.confirms == 0)
        await g.wait(0.6)
        await g.snap("按钮_确认删除")
        #expect(await g.clickControl("删除字体确认"))
        #expect(probe.confirms == 1)
        #expect(!probe.asking)
        await g.wait(0.4)
        // 再展开一次，Esc 取消，什么都没删
        await g.clickControl("删除字体")
        await g.wait(0.5)
        await g.key(53, "\u{1b}")
        await g.wait(0.3)
        #expect(!probe.asking)
        #expect(probe.confirms == 1)
        await g.wait(0.4)
        await g.filmstrip("按钮_确认展开") { probe.asking = true }
        probe.asking = false
        await g.wait(0.4)

        // 结果按钮：显示结果时不接受点击，停一下自己回去
        #expect(await g.clickControl("保存 Key"))
        #expect(probe.hits == 1)
        #expect(probe.result == .success("已保存"))
        await g.wait(0.3)
        await g.snap("按钮_已保存")
        await g.clickControl("保存 Key")
        #expect(probe.hits == 1)
        #expect(await g.until("结果自己回去", timeout: 3) { probe.result == .idle })

        win.close()
        d.document.updateChangeCount(.changeCleared)
        d.document.close()
    }

    @Test("按钮：文档里的撤销、还原、播放")
    func buttonsInDocument() async throws {
        // 关掉的窗口不会触发 onDisappear，上一个测试的位置要清掉
        ControlFrames.entries.removeAll()
        let out = FileManager.default.temporaryDirectory.appending(path: "flow-shots", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
        // 第 26 镜带着一处调整打开：测试框架会把一次运行里的修改并成一个撤销组，先调再还原就分不开了
        let d = try await makeDriver(out) { rows in
            rows[25]["layers"] = ["comb": ["bars:1": ["hidden": true]]]
        }
        #expect(await d.until("渲染页就绪") { (await d.js("return !!window.__dmReady") as? Bool) == true })
        await d.wait(0.8)
        func rows() async -> [[String: Any]] { ((await d.savedBoardQuick())?["rows"] as? [[String: Any]]) ?? [] }
        func rowCount() async -> Int { await rows().count }
        #expect(await rowCount() == 133)

        // 要确认：标记后底部出现撤销，撤销后说明回来
        let start = await rows()
        if let noteIndex = start.firstIndex(where: { !(($0["note"] as? String) ?? "").isEmpty }) {
            let note = start[noteIndex]["note"] as? String
            for _ in 0..<noteIndex { await d.menu("下一镜") }
            #expect(await d.menu("显示或隐藏这一镜"))
            await d.wait(0.5)
            #expect(await d.clickControl("标记为已确认"))
            await d.wait(0.4)
            #expect(d.hasControl("撤销"))
            #expect(((await rows())[noteIndex]["note"] as? String ?? "").isEmpty)
            await d.snap("按钮_已确认")
            #expect(await d.clickControl("撤销"))
            await d.wait(0.4)
            #expect((await rows())[noteIndex]["note"] as? String == note)
            #expect(d.hasControl("标记为已确认"))
            #expect(await d.menu("显示或隐藏这一镜"))
            for _ in 0..<noteIndex { await d.menu("上一镜") }
        } else {
            print("示例里没有要确认的镜头，跳过")
        }
        d.document.undoManager?.removeAllActions()

        // 元素清单：还原后底部出现撤销，撤销后调整回来；行里的眼睛能点
        await d.goToShot("026")
        await d.wait(0.8)
        #expect(await d.jsNumber("return Object.keys(window.__dmEditor.layers).length") == 1)
        #expect(await d.until("元素清点完", timeout: 8) { await d.jsNumber("return window.__dmEditor.elements.length") > 0 })
        await d.wait(0.5)
        #expect(await d.clickControl("元素"))
        #expect(await d.until("弹出元素清单", timeout: 3) { d.popover() != nil && d.hasControl("还原这一镜") })
        await d.wait(0.5)
        let pop = try #require(d.popover())
        #expect(await d.clickControl("还原这一镜", in: pop))
        #expect(await d.until("出现撤销", timeout: 3) { d.hasControl("撤销") })
        #expect(await d.jsNumber("return Object.keys(window.__dmEditor.layers).length") == 0)
        await d.wait(0.4)
        await d.snap("按钮_已还原")
        await d.closePopover("元素")
        #expect(await d.clickControl("撤销"))
        #expect(await d.until("调整回来", timeout: 3) {
            await d.jsNumber("return Object.keys(window.__dmEditor.layers).length") == 1
        })
        #expect(await d.until("撤销入口收起", timeout: 3) { !d.hasControl("撤销") })
        await d.wait(0.5)
        #expect(await d.clickControl("元素"))
        #expect(await d.until("再次弹出", timeout: 3) { d.popover() != nil && d.axPoint({ $0.hasPrefix("隐藏") }, in: d.popover()) != nil })
        await d.wait(0.5)
        let pop2 = try #require(d.popover())
        #expect(await d.clickControl(where: { $0.hasPrefix("隐藏") }, in: pop2))
        #expect(await d.until("眼睛生效", timeout: 3) {
            await d.jsNumber("return Object.values(window.__dmEditor.layers).filter((l)=>l.hidden).length") == 2
        })
        await d.closePopover("元素")
        for _ in 0..<25 { await d.menu("上一镜") }
        d.document.undoManager?.removeAllActions()

        // 传输条的图标按钮
        #expect(await d.clickControl("播放"))
        #expect(await d.until("变成暂停", timeout: 3) { d.hasControl("暂停") })
        #expect(await d.clickControl("暂停"))
        #expect(await d.until("变回播放", timeout: 3) { d.hasControl("播放") })

        // 删除镜头：出现限时撤销，点它回到 133 镜
        #expect(await d.menu("删除这一镜"))
        #expect(await d.until("出现撤销", timeout: 3) { d.hasControl("撤销") })
        await d.wait(0.4)
        await d.snap("按钮_删除后撤销")
        #expect(await rowCount() == 132)
        #expect(await d.clickControl("撤销"))
        await d.wait(0.4)
        #expect(await rowCount() == 133)
        #expect(await d.until("撤销胶囊收起", timeout: 3) { !d.hasControl("撤销") })

        // 删除后再做别的改动：撤销入口要收起，免得撤到别的操作上
        #expect(await d.menu("删除这一镜"))
        #expect(await d.until("出现撤销", timeout: 3) { d.hasControl("撤销") })
        #expect(await d.menu("新增一镜"))
        #expect(await d.until("撤销入口收起", timeout: 3) { !d.hasControl("撤销") })
        d.document.undoManager?.undo()
        await d.wait(0.4)
        if await rowCount() != 133 {
            d.document.undoManager?.undo()
            await d.wait(0.4)
        }
        #expect(await rowCount() == 133)

        // 没人动：倒数结束自己收起，⌘Z 还能撤销。真实指针停在胶囊上时倒数会暂停，先挪开
        if d.window.frame.contains(NSEvent.mouseLocation) {
            CGWarpMouseCursorPosition(CGPoint(x: 4, y: 4))
        }
        #expect(await d.menu("删除这一镜"))
        #expect(await d.until("出现撤销", timeout: 3) { d.hasControl("撤销") })
        #expect(await d.until("倒数结束", timeout: 12) { !d.hasControl("撤销") })
        #expect(await rowCount() == 132)
        d.document.undoManager?.undo()
        await d.wait(0.4)
        #expect(await rowCount() == 133)

        d.document.updateChangeCount(.changeCleared)
        d.document.close()
    }
}

private func jsq(_ s: String) -> String { "\"\(s.replacingOccurrences(of: "\"", with: "\\\""))\"" }

private func JSONString(_ any: Any) -> String {
    (try? JSONSerialization.data(withJSONObject: any)).map { String(decoding: $0, as: UTF8.self) } ?? ""
}

extension WindowDriver {
    // 生成过程中文件可能还没存，这里直接存一次再读
    func savedBoardQuick() async -> [String: Any]? {
        document.save(nil)
        await wait(0.25)
        guard let url = document.fileURL, let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }
}

