import AppKit
import Foundation
import Testing
import WebKit
@testable import DataMotion

@Suite("调研动效原生验收", .serialized)
@MainActor
struct OpusTests {
    private static var renderWindows: [NSWindow] = []
    private func readyStage() async throws -> StageController {
        StageController.timerFrames = true
        let stage = StageController()
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 960, height: 540), styleMask: [.borderless], backing: .buffered, defer: false)
        window.contentView = stage.web
        window.setFrameOrigin(NSPoint(x: -4000, y: -4000))
        window.orderBack(nil)
        Self.renderWindows.append(window)
        let start = Date()
        while (!stage.ready || stage.catalog.isEmpty) && Date().timeIntervalSince(start) < 30 {
            try await Task.sleep(for: .milliseconds(50))
        }
        #expect(stage.ready)
        return stage
    }

    @Test("23个入口、中文预览、配置保存重开与撤销", .timeLimit(.minutes(2)))
    func configurationAndPlayback() async throws {
        let stage = try await readyStage()
        #expect(stage.catalog.filter { $0.category == "research" }.count == 20)
        #expect(stage.catalog.filter { $0.category == "research-presets" }.count == 3)
        let json = try await stage.callString("""
            const configs=[...DMOpus.IDS.filter(id=>!DMOpus.PAPER_IDS.includes(id)).map(DMOpus.defaults),...Object.keys(DMOpus.PRESETS).map(DMOpus.preset)];
            configs.forEach(c=>{c.timeline.currentTime=1.25});
            return JSON.stringify({title:'原生验收 · 演示数据',rows:configs.map((c,i)=>DMOpus.row(c,i+1))});
            """)
        let board = try BoardDocument.decode(Data(json.utf8))
        #expect(board.rows.count == 23)
        let copy = try BoardDocument.decode(try BoardDocument.encode(board))
        #expect(copy == board)
        let doc = BoardDocument(board: copy), undo = UndoManager()
        undo.groupsByEvent = false
        var edited = copy
        var motion = edited.rows[0].fields["motion"]?.object ?? [:]
        var style = motion["style"]?.object ?? [:]
        style["title"] = .string("AI 修改之后仍可人工编辑")
        motion["style"] = .object(style)
        edited.rows[0].fields["motion"] = .object(motion)
        undo.beginUndoGrouping(); doc.update(edited, undoManager: undo, action: "编辑研究标题"); undo.endUndoGrouping()
        #expect(doc.board == edited)
        undo.undo(); #expect(doc.board == copy)
        undo.redo(); #expect(doc.board == edited)
        for shot in copy.rows {
            _ = try await stage.call("return await DMBridge.load(json, false)", arguments: ["json": shot.json])
            let position = try await stage.call("return JSON.parse(DMBridge.frameInfo()).t") as? Double
            #expect(position == 1.25)
            _ = try await stage.call("DMBridge.seek(0.5); DMBridge.play();")
            try await Task.sleep(for: .milliseconds(90))
            _ = try await stage.call("DMBridge.pause();")
            let playing = try await stage.call("return JSON.parse(DMBridge.frameInfo()).playing") as? Bool
            #expect(playing == false)
            let duration = try await stage.call("return DMBridge.seek(0.25), __dmState().scene.duration") as? Double
            #expect((duration ?? 0) > 0)
            let errors = try await stage.callString("return DMBridge.validate(json)", arguments: ["json": shot.json])
            #expect(errors == "{\"errors\":[]}")
        }
    }

    @Test("AI结构化输出进入同一配置并核对文稿数字", .timeLimit(.minutes(2)))
    func aiRoundTrip() async throws {
        let stage = try await readyStage()
        let text = #"{"rows":[{"line":"品牌甲满意度从42升至58。","kind":"B","cat":"数据动效","tpl":"comparison-dumbbell","visual":"满意度对比","note":"","data":"{\"motionInput\":{\"data\":{\"rows\":[{\"label\":\"品牌甲\",\"before\":42,\"after\":58}]},\"style\":{\"title\":\"满意度变化\"}}}"}]}"#
        let rows = try StoryboardPrompt.decodeRows(text, chapter: "演示")
        #expect(rows.count == 1)
        let data = try JSONEncoder().encode(rows)
        let result = try await stage.callString("return DMBridge.reviewRows(rows, source)", arguments: ["rows": String(decoding: data, as: UTF8.self), "source": "品牌甲满意度从42升至58。"])
        let reply = try #require(try JSONSerialization.jsonObject(with: Data(result.utf8)) as? [String: Any])
        #expect((reply["flagged"] as? Int) == 0)
        let checked = try #require(reply["rows"] as? [[String: Any]])
        let motion = try #require(checked.first?["motion"] as? [String: Any])
        #expect((motion["demo"] as? Bool) == false)
        #expect((motion["templateId"] as? String) == "comparison-dumbbell")
        let provenance = try #require(motion["metadata"] as? [String: Any])
        #expect((provenance["showSampleSize"] as? Bool) == false)
    }

    @Test("WebKit双视频素材可同步定位并原生导出", .timeLimit(.minutes(2)))
    func nativeVideoExport() async throws {
        let stage = try await readyStage()
        let resource = try #require(Bundle(for: WindowDriver.self).url(forResource: "OpusColorbars", withExtension: "mp4"))
        let uri = "data:video/mp4;base64," + (try Data(contentsOf: resource)).base64EncodedString()
        let json = try await stage.callString("""
            const c=DMOpus.defaults('split-compare');
            c.data.left.src=uri;c.data.left.kind='video';c.data.right.src=uri;c.data.right.kind='video';
            c.options.syncStart=0.4;c.timeline.duration=2;c.timeline.entrance=0.1;c.timeline.hold=0.3;
            c.output={width:960,height:540,fps:60};
            const row=DMOpus.row(c);await DMBridge.load(JSON.stringify(row),false);
            await DM.Opus.prepareFrame({...row,template:row.tpl},1);
            await DM.Opus.prepareFrame({...row,template:row.tpl},0.2);
            return JSON.stringify(row);
            """, arguments: ["uri": uri])
        let shot = try JSONDecoder().decode(Shot.self, from: Data(json.utf8))
        let file = FileManager.default.temporaryDirectory.appending(path: "roudai-opus-native-video.mp4")
        let engine = ExportEngine()
        let result = try await engine.export(shot, to: file, size: .hd, fps: 60) { _, _ in }
        #expect(result.width == 960)
        #expect(result.height == 540)
        #expect(abs(result.duration-2) < 0.1)
    }

    @Test("WebKit原生导出使用项目尺寸帧率与时长", .timeLimit(.minutes(2)))
    func nativeExport() async throws {
        let stage = try await readyStage()
        let json = try await stage.callString("""
            const c=DMOpus.defaults('poll-results-bars');
            c.timeline.duration=2;c.timeline.entrance=0.1;c.timeline.hold=0.3;
            c.output={width:960,height:540,fps:30};
            return JSON.stringify(DMOpus.row(c));
            """)
        let shot = try JSONDecoder().decode(Shot.self, from: Data(json.utf8))
        let dir = FileManager.default.temporaryDirectory.appending(path: "roudai-opus-native-acceptance")
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let file = dir.appending(path: "native-poll-results.mp4")
        let engine = ExportEngine()
        let check = try await engine.export(shot, to: file, size: .uhd, fps: 60) { _, _ in }
        #expect(check.width == 960)
        #expect(check.height == 540)
        #expect(abs(check.duration - 2) < 0.1)
        #expect((try file.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0) > 5000)
    }
}
