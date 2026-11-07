// 用 WKWebView（App 同款）跑一段 JS 文件，把返回的 {文件名: dataURL} 存下来
import AppKit
import WebKit

let args = CommandLine.arguments
let stage = URL(fileURLWithPath: args[1])
let script = try! String(contentsOfFile: args[2], encoding: .utf8)
let outDir = args[3]
try? FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)

final class Runner: NSObject, WKNavigationDelegate, WKUIDelegate {
    let web: WKWebView
    let window: NSWindow
    override init() {
        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        web = WKWebView(frame: NSRect(x: 0, y: 0, width: 800, height: 450), configuration: config)
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 800, height: 450), styleMask: [.borderless], backing: .buffered, defer: false)
        super.init()
        window.contentView = web
        window.setFrameOrigin(NSPoint(x: -3000, y: -3000))
        window.orderBack(nil)
        web.navigationDelegate = self
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        Task { @MainActor in
            do {
                let result = try await webView.callAsyncJavaScript(script, arguments: [:], contentWorld: .page)
                guard let dict = result as? [String: Any] else { print("结果不是字典", String(describing: result)); exit(2) }
                for (name, value) in dict {
                    guard let s = value as? String else { continue }
                    if s.hasPrefix("data:"), let comma = s.firstIndex(of: ","), let data = Data(base64Encoded: String(s[s.index(after: comma)...])) {
                        try data.write(to: URL(fileURLWithPath: outDir).appendingPathComponent(name))
                        print("写出", name, data.count)
                    } else {
                        print(name, s)
                    }
                }
                exit(0)
            } catch {
                print("出错", error)
                exit(1)
            }
        }
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.prohibited)
let runner = Runner()
runner.web.loadFileURL(stage, allowingReadAccessTo: stage.deletingLastPathComponent())
app.run()
