import AppKit
import AVFoundation
import CoreMedia
import Foundation
import Testing

@testable import DataMotion

@Suite("中途停顿与音效", .serialized)
@MainActor
struct MotionMediaTests {
  private static var windows: [NSWindow] = []
  @Test("原生 AAC 编码、停顿、卡点与可编辑配置", .timeLimit(.minutes(3)))
  func exportSound() async throws {
    StageController.timerFrames = true
    let stage = StageController()
    let window = NSWindow(
      contentRect: NSRect(x: 0, y: 0, width: 960, height: 540), styleMask: [.borderless],
      backing: .buffered, defer: false)
    window.contentView = stage.web
    window.setFrameOrigin(NSPoint(x: -5000, y: -5000))
    window.orderBack(nil)
    Self.windows.append(window)
    let start = Date()
    while !stage.ready && Date().timeIntervalSince(start) < 30 {
      try await Task.sleep(for: .milliseconds(50))
    }
    let report = try await stage.callString(
      """
      await DM.Audio.codecConfig();
      const c=DMOpus.defaults('number-counter');c.timeline={...c.timeline,duration:4.6,entrance:.2,hold:.5,pauses:[{id:'test-hold',at:1,duration:.6}]};
      c.output={width:960,height:540,fps:30};c.data={keyframes:[[0,0],[.15,0],[.8,120],[1,120]]};c.audio.enabled=true;c.audio.auto.enabled=true;
      const validated=DMOpus.validate(c),buffer=await DM.Audio.render(validated),events=DM.Audio.events(validated);let peak=0;
      for(const v of buffer.getChannelData(0))peak=Math.max(peak,Math.abs(v));
      const inner=DMOpus.MEDIA.inner(c),a=DM.Opus.numericState(inner,DMOpus.MEDIA.motionTime(c,1.1)).value,b=DM.Opus.numericState(inner,DMOpus.MEDIA.motionTime(c,1.5)).value;
      return JSON.stringify({config:c,peak,events:events.length,silentHold:!events.some(e=>e.at>1.03&&e.at<1.59),sameValue:a===b});
      """)
    let value = try JSONDecoder().decode([String: JSONValue].self, from: Data(report.utf8))
    #expect((value["peak"]?.number ?? 0) > 0.01)
    #expect((value["events"]?.number ?? 0) > 5)
    #expect(value["silentHold"]?.bool == true)
    #expect(value["sameValue"]?.bool == true)
    let data = try JSONEncoder().encode(value["config"]!)
    let motion = String(decoding: data, as: UTF8.self)
    let row = try await stage.callString(
      "return JSON.stringify(DMOpus.row(JSON.parse(motion),1))", arguments: ["motion": motion])
    let shot = try BoardDocument.decode(Data("{\"title\":\"音效停顿验收\",\"rows\":[\(row)]}".utf8)).rows[
      0]
    let directory = FileManager.default.temporaryDirectory.appending(
      path: "roudai-media-acceptance")
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    try Data(report.utf8).write(to: directory.appending(path: "native-media-report.json"))
    _ = try await stage.call("await DMBridge.load(json,false);DMBridge.play();return true", arguments: ["json": shot.json])
    try await Task.sleep(for: .milliseconds(400))
    let soundState = try await stage.callString("return DM.Audio.prepare().state")
    #expect(soundState == "running", "实际预览的音频时钟必须运行")
    _ = try await stage.call("DMBridge.pause();return true")
    let engine = ExportEngine()
    let file = directory.appending(path: "数字变速与中途停顿-含音效.mp4")
    let result = try await engine.export(shot, to: file, size: .uhd, fps: 60) { _, _ in }
    #expect(abs(result.duration - 4.6) < 0.1)
    #expect((try file.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0) > 10000)
    let asset = AVURLAsset(url: file)
    let tracks = try await asset.loadTracks(withMediaType: .audio)
    #expect(tracks.count == 1)
    let reader = try AVAssetReader(asset: asset)
    let output = AVAssetReaderTrackOutput(track: tracks[0], outputSettings: [AVFormatIDKey: kAudioFormatLinearPCM, AVLinearPCMIsFloatKey: true, AVLinearPCMBitDepthKey: 32])
    reader.add(output)
    #expect(reader.startReading())
    var frames = 0, audible = false
    while let sample = output.copyNextSampleBuffer() {
      frames += CMSampleBufferGetNumSamples(sample)
      if let block = CMSampleBufferGetDataBuffer(sample) {
        var bytes = [UInt8](repeating: 0, count: CMBlockBufferGetDataLength(block))
        let copied = bytes.withUnsafeMutableBytes { CMBlockBufferCopyDataBytes(block, atOffset: 0, dataLength: $0.count, destination: $0.baseAddress!) }
        if copied == kCMBlockBufferNoErr && bytes.contains(where: { $0 != 0 }) { audible = true }
      }
    }
    #expect(reader.status == .completed, "导出的 AAC 必须可实际解码")
    #expect(frames > 200000)
    #expect(audible, "成片音轨必须含真实非静音采样")

  }
}
