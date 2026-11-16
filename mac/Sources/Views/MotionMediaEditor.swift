import AppKit
import SwiftUI
import UniformTypeIdentifiers

// Native controls edit the same validated JSON used by AI and the web renderer.
struct MotionMediaEditor: View {
  let config: [String: JSONValue]
  let stage: StageController
  let apply: ([String: JSONValue]) -> Void
  @State private var error: String?
  private var timeline: [String: JSONValue] { config["timeline"]?.object ?? [:] }
  private var audio: [String: JSONValue] { config["audio"]?.object ?? [:] }
  private var pauses: [JSONValue] { timeline["pauses"]?.array ?? [] }
  private var clips: [JSONValue] { audio["clips"]?.array ?? [] }
  private var assets: [JSONValue] { audio["assets"]?.array ?? [] }
  private var duration: Double { timeline["duration"]?.number ?? 6 }
  private var baseDuration: Double {
    duration - pauses.reduce(0) { $0 + ($1.object?["duration"]?.number ?? 0) }
  }
  private var sources: [(String, String)] {
    [("builtin:tick", "数字轻点"), ("builtin:paper", "翻纸摩擦"), ("builtin:pop", "轻弹入场")]
      + assets.compactMap { a in
        guard let a = a.object, let id = a["id"]?.string else { return nil }
        return (id, a["name"]?.string ?? id)
      }
  }
  var body: some View {
    SectionCard(title: "中途停顿与音效", symbol: "waveform") {
      Text("停顿位置按原动效的秒数设置；增加停顿会延长镜头，原有变化速度保持不变。可拖动位置、时长及音效起点。")
        .font(.footnote).foregroundStyle(.secondary)
      ForEach(pauses.indices, id: \.self) { i in
        VStack(alignment: .leading) {
          HStack {
            Text("停顿 \(i + 1)").font(.footnote.weight(.semibold))
            Spacer()
            Button("删除") { changePause(i, nil) }.buttonStyle(.plain)
          }
          number("停顿位置（秒）", value: pauses[i].object?["at"]?.number ?? 0) {
            changePause(i, ("at", $0))
          }
          Slider(
            value: Binding(
              get: { pauses[i].object?["at"]?.number ?? 0 }, set: { changePause(i, ("at", $0)) }),
            in: 0...max(0.05, baseDuration - 0.05), step: 0.01
          ).accessibilityLabel("拖动停顿\(i+1)位置")
          number("停留多久（秒）", value: pauses[i].object?["duration"]?.number ?? 1) {
            changePause(i, ("duration", $0))
          }
          Slider(
            value: Binding(
              get: { pauses[i].object?["duration"]?.number ?? 1 },
              set: { changePause(i, ("duration", $0)) }), in: 0.05...20, step: 0.05
          ).accessibilityLabel("拖动停顿\(i+1)时长")
        }.padding(8).background(Color.well, in: RoundedRectangle(cornerRadius: 6))
      }
      Button("在当前画面加入1秒停顿") { addPause() }.buttonStyle(.pill(size: .small))
      Divider()
      Toggle(
        "启用音效",
        isOn: Binding(
          get: { audio["enabled"]?.bool ?? false }, set: { setAudio("enabled", .bool($0)) }))
      Slider(
        value: Binding(
          get: { audio["gain"]?.number ?? 0.7 }, set: { setAudio("gain", .number($0)) }), in: 0...2
      ).accessibilityLabel("音效总音量")
      Toggle(
        "自动匹配动效节拍",
        isOn: Binding(
          get: { audio["auto"]?.object?["enabled"]?.bool ?? false },
          set: { value in
            var next = audio
            var auto = next["auto"]?.object ?? [:]
            auto["enabled"] = .bool(value)
            next["auto"] = .object(auto)
            if value { next["enabled"] = .bool(true) }
            writeAudio(next)
          }))
      Text("自动跟随数字变化、纸张切换和剪字入场；变化快时节拍更密，停顿时不重复触发。其他动效可手动摆放音效。")
        .font(.footnote).foregroundStyle(.secondary)
      Picker(
        "自动音效",
        selection: Binding(
          get: { audio["auto"]?.object?["sourceId"]?.string ?? "builtin:tick" },
          set: { setAuto("sourceId", .string($0)) })
      ) { ForEach(sources, id: \.0) { id, name in Text(name).tag(id) } }
      number("自动音效音量", value: audio["auto"]?.object?["volume"]?.number ?? 0.45) {
        setAuto("volume", .number($0))
      }
      number("每秒最多节拍数", value: audio["auto"]?.object?["maxPerSecond"]?.number ?? 12) {
        setAuto("maxPerSecond", .number($0))
      }
      HStack {
        Button("导入音效…") { importAudio() }.buttonStyle(.pill(size: .small))
        Button("添加手动音效") { addClip(sourceId: sources.last?.0 ?? "builtin:tick") }.buttonStyle(
          .pill(size: .small))
      }
      ForEach(clips.indices, id: \.self) { i in
        VStack(alignment: .leading, spacing: 6) {
          HStack {
            Text("音效片段 \(i+1)").font(.footnote.weight(.semibold))
            Spacer()
            Button("删除") {
              var a = audio
              var list = clips
              list.remove(at: i)
              a["clips"] = .array(list)
              writeAudio(a)
            }.buttonStyle(.plain)
          }
          Picker(
            "素材",
            selection: Binding(
              get: { clips[i].object?["sourceId"]?.string ?? "builtin:tick" },
              set: { id in
                var a = audio
                var list = clips
                var r = list[i].object ?? [:]
                r["sourceId"] = .string(id)
                r["trimStart"] = .number(0)
                r["trimEnd"] = .number(
                  min(sourceDuration(id), duration - (r["start"]?.number ?? 0)))
                list[i] = .object(r)
                a["clips"] = .array(list)
                writeAudio(a)
              })
          ) { ForEach(sources, id: \.0) { id, name in Text(name).tag(id) } }
          ForEach(
            [
              ("start", "起点（秒）"), ("trimStart", "素材裁切起点"), ("trimEnd", "素材裁切终点"), ("volume", "音量"),
              ("rate", "播放速度"), ("fadeIn", "淡入秒数"), ("fadeOut", "淡出秒数"),
            ], id: \.0
          ) { key, label in
            number(label, value: clips[i].object?[key]?.number ?? 0) {
              setClip(i, key, .number($0))
            }
          }
          Slider(
            value: Binding(
              get: { clips[i].object?["start"]?.number ?? 0 },
              set: { setClip(i, "start", .number($0)) }),
            in: 0...max(0.01, duration - clipDuration(i)), step: 0.01
          ).accessibilityLabel("拖动音效\(i+1)起点")
        }.padding(8).background(Color.well, in: RoundedRectangle(cornerRadius: 6))
      }
      if let error { Text(error).font(.footnote).foregroundStyle(.red) }
    }
  }
  private func number(_ title: String, value: Double, set: @escaping (Double) -> Void) -> some View
  {
    CommitField(
      title: title,
      text: Binding(
        get: { String(format: "%.3f", value) }, set: { if let v = Double($0) { set(v) } }))
  }
  private func writeAudio(_ a: [String: JSONValue]) {
    var c = config
    c["audio"] = .object(a)
    apply(c)
  }
  private func setAudio(_ key: String, _ value: JSONValue) {
    var a = audio
    a[key] = value
    writeAudio(a)
  }
  private func setAuto(_ key: String, _ value: JSONValue) {
    var a = audio
    var r = a["auto"]?.object ?? [:]
    r[key] = value
    a["auto"] = .object(r)
    writeAudio(a)
  }
  private func setClip(_ i: Int, _ key: String, _ value: JSONValue) {
    var a = audio
    var list = clips
    var r = list[i].object ?? [:]
    r[key] = value
    list[i] = .object(r)
    a["clips"] = .array(list)
    writeAudio(a)
  }
  private func clipDuration(_ i: Int) -> Double {
    let c = clips[i].object ?? [:]
    return ((c["trimEnd"]?.number ?? 0) - (c["trimStart"]?.number ?? 0)) / (c["rate"]?.number ?? 1)
  }
  private func sourceDuration(_ id: String) -> Double {
    if id == "builtin:tick" { return 0.045 }
    if id == "builtin:paper" { return 0.12 }
    if id == "builtin:pop" { return 0.09 }
    return assets.first { $0.object?["id"]?.string == id }?.object?["duration"]?.number ?? 0.1
  }
  private func addClip(sourceId: String) {
    var a = audio
    var list = clips
    let start = min(stage.time, max(0, duration - 0.15))
    let len = min(sourceDuration(sourceId), duration - start)
    list.append(
      .object([
        "id": .string(UUID().uuidString), "sourceId": .string(sourceId), "start": .number(start),
        "trimStart": .number(0), "trimEnd": .number(len), "volume": .number(0.7),
        "rate": .number(1), "fadeIn": .number(0), "fadeOut": .number(min(0.01, len / 2)),
      ]))
    a["clips"] = .array(list)
    a["enabled"] = .bool(true)
    writeAudio(a)
  }
  private func changePause(_ i: Int, _ change: (String, Double)?) {
    var c = config
    var t = timeline
    var list = pauses
    let old = pauses.reduce(0) { $0 + ($1.object?["duration"]?.number ?? 0) }
    if let (key, v) = change {
      var p = list[i].object ?? [:]
      p[key] = .number(v)
      list[i] = .object(p)
    } else {
      list.remove(at: i)
    }
    list.sort { ($0.object?["at"]?.number ?? 0) < ($1.object?["at"]?.number ?? 0) }
    let total = list.reduce(0) { $0 + ($1.object?["duration"]?.number ?? 0) }
    t["pauses"] = .array(list)
    t["duration"] = .number(duration - old + total)
    t["currentTime"] = .number(min(t["currentTime"]?.number ?? 0, duration - old + total))
    c["timeline"] = .object(t)
    apply(c)
  }
  private func addPause() {
    var consumed = 0.0
    var at = stage.time
    for p in pauses {
      let x = p.object?["at"]?.number ?? 0
      let d = p.object?["duration"]?.number ?? 0
      if stage.time < x + consumed { break }
      if stage.time < x + consumed + d {
        at = x
        break
      }
      consumed += d
      at = stage.time - consumed
    }
    at = min(max(0, at), baseDuration - 0.05)
    if let i = pauses.firstIndex(where: { abs(($0.object?["at"]?.number ?? -1) - at) < 0.02 }) {
      changePause(i, ("duration", (pauses[i].object?["duration"]?.number ?? 0) + 1))
      return
    }
    var c = config
    var t = timeline
    var list = pauses
    list.append(
      .object(["id": .string(UUID().uuidString), "at": .number(at), "duration": .number(1)]))
    list.sort { ($0.object?["at"]?.number ?? 0) < ($1.object?["at"]?.number ?? 0) }
    t["pauses"] = .array(list)
    t["duration"] = .number(duration + 1)
    c["timeline"] = .object(t)
    apply(c)
  }
  private func importAudio() {
    let p = NSOpenPanel()
    p.allowedContentTypes = [.audio]
    guard p.runModal() == .OK, let url = p.url else { return }
    let scoped = url.startAccessingSecurityScopedResource()
    defer { if scoped { url.stopAccessingSecurityScopedResource() } }
    do {
      let data = try Data(contentsOf: url)
      guard data.count <= 20 * 1024 * 1024 else {
        error = "音效文件最多20MB"
        return
      }
      let mime = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "audio/wav"
      let src = "data:\(mime);base64," + data.base64EncodedString()
      let name = url.lastPathComponent
      Task {
        do {
          let result = try await stage.callString(
            "return JSON.stringify(await DM.Audio.assetInfo(src))", arguments: ["src": src])
          let info = try JSONDecoder().decode([String: JSONValue].self, from: Data(result.utf8))
          var a = audio
          var list = assets
          list.append(
            .object([
              "id": .string(UUID().uuidString), "name": .string(name), "src": .string(src),
              "duration": info["duration"] ?? .number(0),
            ]))
          a["assets"] = .array(list)
          a["enabled"] = .bool(true)
          writeAudio(a)
          error = nil
        } catch { self.error = error.localizedDescription }
      }
    } catch { self.error = error.localizedDescription }
  }
}
