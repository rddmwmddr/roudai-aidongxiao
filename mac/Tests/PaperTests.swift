import AppKit
import Foundation
import Testing
@testable import DataMotion

@Suite("纸张与拼贴实际包验收", .serialized)
@MainActor
struct PaperTests {
    private static var windows: [NSWindow] = []
    @Test("四个入口、内容编辑、保存恢复、撤销与原生 MP4", .timeLimit(.minutes(3)))
    func paperTemplates() async throws {
        StageController.timerFrames = true
        let stage = StageController()
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 960, height: 540), styleMask: [.borderless], backing: .buffered, defer: false)
        window.contentView = stage.web; window.setFrameOrigin(NSPoint(x: -4000, y: -4000)); window.orderBack(nil); Self.windows.append(window)
        let start = Date()
        while (!stage.ready || stage.catalog.isEmpty) && Date().timeIntervalSince(start) < 30 { try await Task.sleep(for: .milliseconds(50)) }
        #expect(stage.catalog.filter { $0.category == "paper" }.count == 4)
        let focus = try await stage.call("""
            const box={x:750,y:355,w:420,h:110},depth=DM.PaperPress.depthAt;
            return [depth(960,410,box,1920,1080,180),depth(960,250,box,1920,1080,180),depth(100,1000,box,1920,1080,180)];
            """) as? [Double]
        #expect(focus?.count == 3)
        #expect((focus?[0] ?? 1) == 0)
        #expect((focus?[1] ?? 1) < 0.15, "邻近正文应保留清晰细节")
        #expect((focus?[2] ?? 0) > 0.8, "远处逐渐虚化")
        let json = try await stage.callString("""
            return JSON.stringify({title:'纸张原生保存重开验收',rows:DMOpus.PAPER_IDS.map((id,i)=>{
              const c=DMOpus.defaults(id);c.style.title='AI 修改后继续人工编辑 · '+id;
              c.timeline={...c.timeline,duration:2.4,entrance:0.1,hold:0.3,currentTime:1};c.output={width:960,height:540,fps:30};
              if(id==='text-match-cut'){c.options.paperCount=4;c.options.cutSeconds=0.4;c.options.keyword='真实声音'};
              if(id==='paper-unfold'){c.options.direction='down';c.options.unfoldSeconds=1.3};
              if(id==='magazine-letters'){c.data.letters=DMOpus.paperLetters('中文可编辑');c.options.stagger=0.1;c.options.entrySeconds=0.6};
              if(id==='paper-cutout'){const cv=document.createElement('canvas');cv.width=cv.height=128;const g=cv.getContext('2d');g.fillStyle='#227F77';g.fillRect(32,32,64,64);c.data.items[0].src=cv.toDataURL();c.options.entrySeconds=1};
              return DMOpus.row(c,i+1)
            })});
            """)
        let board = try BoardDocument.decode(Data(json.utf8))
        let restored = try BoardDocument.decode(try BoardDocument.encode(board)); #expect(restored == board)
        let doc = BoardDocument(board: restored), undo = UndoManager(); undo.groupsByEvent = false
        var edited = restored; edited.rows[0].line = "人工改写"
        undo.beginUndoGrouping(); doc.update(edited, undoManager: undo, action: "编辑纸张内容"); undo.endUndoGrouping()
        undo.undo(); #expect(doc.board == restored); undo.redo(); #expect(doc.board == edited)
        let dir = FileManager.default.temporaryDirectory.appending(path: "roudai-paper-native-acceptance")
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        for shot in restored.rows {
            _ = try await stage.call("return await DMBridge.load(json,false)", arguments: ["json":shot.json])
            _ = try await stage.call("DMBridge.seek(0.4); DMBridge.play()")
            try await Task.sleep(for: .milliseconds(100))
            _ = try await stage.call("DMBridge.pause(); DMBridge.seek(0.25)")
            let playing = try await stage.call("return JSON.parse(DMBridge.frameInfo()).playing") as? Bool; #expect(playing == false)
            let engine = ExportEngine(), file = dir.appending(path: shot.template + ".mp4")
            let result = try await engine.export(shot, to: file, size: .uhd, fps:60) {_,_ in}
            #expect(result.width == 960); #expect(result.height == 540); #expect(abs(result.duration-2.4)<0.1)
            #expect((try file.resourceValues(forKeys:[.fileSizeKey]).fileSize ?? 0)>5000)
        }
    }
}
