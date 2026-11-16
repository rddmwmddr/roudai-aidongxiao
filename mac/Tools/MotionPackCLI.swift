import AppKit
import Darwin
import ImageIO
import WebKit

private struct CLIError: LocalizedError {
    let message: String
    init(_ message: String) { self.message = message }
    var errorDescription: String? { message }
}

private struct Command {
    static let usage = """
        dm-motion --workspace <folder> <command>
          list                         列出内置与本机动效
          get <id>                     查看配置、样例数据和元素 ID
          validate                     校验工作文件夹里的动效包
          upsert <template.json>       新增或完整替换本机模板
          remove <local.id>            删除本机模板
          override <id> <patch.json>   保存该内置动效的整份覆盖配置
          reset <id>                   恢复内置动效
          preview <id> <out.gif> [row.json]   生成样例或指定分镜的 GIF
        """
    static let byteLimit = 256 * 1024
    static let arities = ["list": 0...0, "get": 1...1, "validate": 0...0, "upsert": 1...1,
                          "remove": 1...1, "override": 2...2, "reset": 1...1, "preview": 2...3]

    let name: String
    let id: String
    let workspace: URL
    let input: URL?
    let output: URL?

    init(_ args: [String]) throws {
        guard args.count >= 3, args[0] == "--workspace",
              let arity = Self.arities[args[2]], arity.contains(args.count - 3) else {
            throw CLIError("命令或参数有误。用 dm-motion --help 查看用法")
        }
        name = args[2]
        id = args.count > 3 && name != "upsert" ? args[3] : ""
        workspace = URL(fileURLWithPath: args[1], isDirectory: true).resolvingSymlinksInPath()
        guard (try? workspace.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true else {
            throw CLIError("找不到工作文件夹 \(workspace.path)")
        }
        let inputPath: String? = switch name {
        case "upsert": args[3]
        case "override": args[4]
        case "preview" where args.count == 6: args[5]
        default: nil
        }
        input = inputPath.map { URL(fileURLWithPath: $0) }
        if name == "preview" {
            let url = URL(fileURLWithPath: args[4]).standardizedFileURL
            guard url.pathExtension.lowercased() == "gif" else { throw CLIError("预览文件名需要以 .gif 结尾") }
            output = url
        } else {
            output = nil
        }
    }

    var pack: URL { workspace.appendingPathComponent("motion-pack.dmotion.json") }
    var writesPack: Bool { ["upsert", "remove", "override", "reset"].contains(name) }

    static func readJSON(_ url: URL) throws -> String {
        let info = try url.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey])
        guard info.isRegularFile == true, info.isSymbolicLink != true else {
            throw CLIError("\(url.lastPathComponent) 需要是普通文件")
        }
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        let data = try handle.read(upToCount: byteLimit + 1) ?? Data()
        guard data.count <= byteLimit, let json = String(data: data, encoding: .utf8) else {
            throw CLIError("\(url.lastPathComponent) 需要是最多 256 KB 的 UTF-8 文件")
        }
        return json
    }

    func readPack() throws -> String? {
        do {
            return try Self.readJSON(pack)
        } catch CocoaError.fileReadNoSuchFile {
            return nil
        } catch CocoaError.fileNoSuchFile {
            return nil
        }
    }

    func lockPack() throws -> Int32 {
        let path = workspace.appendingPathComponent(".dm-motion.lock").path
        let fd = open(path, O_CREAT | O_RDWR | O_NOFOLLOW | O_NONBLOCK, 0o600)
        guard fd >= 0 else { throw CLIError("无法锁定动效包，请检查工作文件夹的写入权限") }
        var info = stat()
        guard fstat(fd, &info) == 0, (info.st_mode & S_IFMT) == S_IFREG,
              flock(fd, LOCK_EX | LOCK_NB) == 0 else {
            close(fd)
            throw CLIError("无法锁定动效包。如果另一个命令正在修改，请等它结束后再试")
        }
        return fd
    }

    func writeGIF(_ frames: [String], seconds: Double, to url: URL) throws {
        let data = NSMutableData()
        guard !frames.isEmpty,
              let gif = CGImageDestinationCreateWithData(data, "com.compuserve.gif" as CFString, frames.count, nil) else {
            throw CLIError("动效没有生成可用的预览帧")
        }
        CGImageDestinationSetProperties(gif, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFLoopCount: 0]] as CFDictionary)
        let delay = max(0.02, seconds / Double(frames.count))
        let options = [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFDelayTime: delay]] as CFDictionary
        for frame in frames {
            guard let comma = frame.firstIndex(of: ","),
                  let jpeg = Data(base64Encoded: String(frame[frame.index(after: comma)...])),
                  let source = CGImageSourceCreateWithData(jpeg as CFData, nil) else {
                throw CLIError("无法解码预览帧")
            }
            CGImageDestinationAddImageFromSource(gif, source, 0, options)
        }
        guard CGImageDestinationFinalize(gif) else { throw CLIError("无法编码 GIF") }
        try data.write(to: url, options: .atomic)
    }
}

@MainActor
private final class Engine: NSObject, WKNavigationDelegate {
    private let command: Command
    private let stage: URL
    private let window: NSWindow
    private let web: WKWebView

    init(command: Command, stage: URL) {
        self.command = command
        self.stage = stage
        let frame = NSRect(x: 0, y: 0, width: 480, height: 270)
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        web = WKWebView(frame: frame, configuration: configuration)
        window = NSWindow(contentRect: frame, styleMask: .borderless, backing: .buffered, defer: false)
        super.init()
        window.contentView = web
        window.setFrameOrigin(NSPoint(x: -3000, y: -3000))
        window.orderBack(nil)
        web.navigationDelegate = self
    }

    func load() {
        web.loadFileURL(stage, allowingReadAccessTo: stage)
        DispatchQueue.main.asyncAfter(deadline: .now() + 40) {
            MotionCLI.fail(CLIError("动效引擎处理超时"))
        }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: any Error) {
        MotionCLI.fail(error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: any Error) {
        MotionCLI.fail(error)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        MotionCLI.fail(CLIError("动效引擎意外退出"))
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        Task {
            do {
                try MotionCLI.printJSON(try await run())
                exit(EXIT_SUCCESS)
            } catch {
                MotionCLI.fail(error)
            }
        }
    }

    private func run() async throws -> [String: Any] {
        let lock = command.writesPack ? try command.lockPack() : nil
        defer { if let lock { close(lock) } }
        let original = try command.readPack()
        let input = try command.input.map(Command.readJSON)
        let reply = try await web.callAsyncJavaScript("""
            for (let i = 0; !window.__dmReady && i < 300; i++) {
                await new Promise(resolve => setTimeout(resolve, 25));
            }
            if (!window.__dmReady) throw new Error('动效引擎未能载入');
            return JSON.stringify(await window.dmMotionCommand(command, id, pack, input));
            """, arguments: ["command": command.name, "id": command.id,
                              "pack": original ?? #"{"version":1}"#, "input": (input as Any?) ?? NSNull()],
            contentWorld: .page)
        guard let json = reply as? String,
              var result = try JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: Any] else {
            throw CLIError("无法读取动效引擎的返回结果")
        }
        if let error = result["error"] as? String { throw CLIError(error) }
        if let next = result.removeValue(forKey: "updatedPack") as? String {
            let changed = next != original
            if changed {
                let data = Data(next.utf8)
                guard data.count <= Command.byteLimit else { throw CLIError("保存后动效包超过 256 KB") }
                guard try command.readPack() == original else { throw CLIError("动效包已被其他程序改动，请重试") }
                try data.write(to: command.pack, options: .atomic)
            }
            result["changed"] = changed
        }
        if let output = command.output {
            guard let frames = result.removeValue(forKey: "frames") as? [String],
                  let seconds = result["seconds"] as? Double else {
                throw CLIError("无法读取动效预览帧")
            }
            try command.writeGIF(frames, seconds: seconds, to: output)
            result["file"] = output.path
            result["frameCount"] = frames.count
            result["id"] = command.id
        }
        result["version"] = 1
        return result
    }
}

@main
private enum MotionCLI {
    @MainActor static func main() {
        let args = Array(CommandLine.arguments.dropFirst())
        if args == ["--help"] {
            print(Command.usage)
            return
        }
        do {
            let command = try Command(args)
            let executable = URL(fileURLWithPath: CommandLine.arguments[0]).resolvingSymlinksInPath()
            let stage = executable.deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("Resources/stage.html")
            guard FileManager.default.isReadableFile(atPath: stage.path) else {
                throw CLIError("找不到 App 的动效引擎，请运行 App 内置的 dm-motion")
            }
            let app = NSApplication.shared
            app.setActivationPolicy(.prohibited)
            let engine = Engine(command: command, stage: stage)
            engine.load()
            withExtendedLifetime(engine) { app.run() }
        } catch {
            fail(error)
        }
    }

    static func printJSON(_ value: [String: Any], to stream: FileHandle = .standardOutput) throws {
        var data = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys, .withoutEscapingSlashes])
        data.append(10)
        try stream.write(contentsOf: data)
    }

    static func fail(_ error: any Error) -> Never {
        try? printJSON(["version": 1, "error": error.localizedDescription], to: .standardError)
        exit(EXIT_FAILURE)
    }
}
