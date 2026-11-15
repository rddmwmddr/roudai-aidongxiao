import AppKit
import AVFoundation
import CryptoKit
import Foundation
import WebKit

// Native video sampling avoids WKWebView's paused/offscreen HTMLVideoElement seek stalls.
// Both the preview and export stage install this bridge and receive the same decoded image.
final class MotionMediaBridge: NSObject, WKScriptMessageHandlerWithReply {
    private struct Entry {
        let generator: AVAssetImageGenerator
        let duration: Double
        let width: Double
        let height: Double
    }
    private var entries: [String: Entry] = [:]

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping @MainActor @Sendable (Any?, String?) -> Void) {
        Task { @MainActor in
            do {
                guard let body = message.body as? [String: Any], let action = body["action"] as? String else { throw failure("视频请求格式错误") }
                if action == "open" {
                    guard let src = body["src"] as? String, let comma = src.firstIndex(of: ","),
                          ["data:video/mp4;base64", "data:video/quicktime;base64", "data:video/webm;base64"].contains(String(src[..<comma])),
                          let bytes = Data(base64Encoded: String(src[src.index(after: comma)...])), bytes.count <= 100 * 1024 * 1024 else { throw failure("视频需为100MB以内的本地MP4/MOV/WebM") }
                    let key = SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
                    if entries[key] == nil {
                        let directory = FileManager.default.temporaryDirectory.appending(path: "research-motion-media")
                        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                        let ext = src.hasPrefix("data:video/webm") ? "webm" : src.hasPrefix("data:video/quicktime") ? "mov" : "mp4"
                        let file = directory.appending(path: "\(key).\(ext)")
                        if !FileManager.default.fileExists(atPath: file.path) { try bytes.write(to: file, options: .atomic) }
                        let asset = AVURLAsset(url: file)
                        guard let track = try await asset.loadTracks(withMediaType: .video).first else { throw failure("素材没有视频轨道") }
                        let size = try await track.load(.naturalSize), transform = try await track.load(.preferredTransform)
                        let rect = CGRect(origin: .zero, size: size).applying(transform)
                        let duration = try await asset.load(.duration).seconds
                        guard duration.isFinite, duration > 0 else { throw failure("视频时长无效") }
                        let generator = AVAssetImageGenerator(asset: asset)
                        generator.appliesPreferredTrackTransform = true
                        generator.requestedTimeToleranceBefore = .zero
                        generator.requestedTimeToleranceAfter = .zero
                        entries[key] = Entry(generator: generator, duration: duration, width: abs(rect.width), height: abs(rect.height))
                    }
                    let entry = entries[key]!
                    replyHandler(["key": key, "duration": entry.duration, "width": entry.width, "height": entry.height], nil)
                } else if action == "frame" {
                    guard let key = body["key"] as? String, let entry = entries[key], let time = body["time"] as? Double, time.isFinite else { throw failure("视频帧请求格式错误") }
                    let seconds = min(max(0, time), max(0, entry.duration - 0.04))
                    let requested = CMTime(seconds: seconds, preferredTimescale: 60000)
                    let (image, actual): (CGImage, CMTime) = try await withCheckedThrowingContinuation { continuation in
                        entry.generator.generateCGImagesAsynchronously(forTimes: [NSValue(time: requested)]) { _, image, actual, result, error in
                            if result == .succeeded, let image { continuation.resume(returning: (image, actual)) }
                            else { continuation.resume(throwing: error ?? NSError(domain: "ResearchMotionMedia", code: 2, userInfo: [NSLocalizedDescriptionKey: "视频帧解码失败"])) }
                        }
                    }
                    guard let png = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:]) else { throw failure("视频帧转换失败") }
                    replyHandler(["b64": png.base64EncodedString(), "actualTime": actual.seconds], nil)
                } else { throw failure("不支持的视频操作") }
            } catch { replyHandler(nil, error.localizedDescription) }
        }
    }

    private func failure(_ message: String) -> NSError {
        NSError(domain: "ResearchMotionMedia", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }
}
