import AppKit
import Combine
import SwiftUI

// 对镜头的整段操作。时间线和脚本走同一份
struct ShotActions {
    /// 按字拆：回车。第二个参数是 UTF-16 下标
    var splitText: (Shot.ID, Int) -> Void
    /// 按时间拆：B。当前这一镜拆在播放头，别的镜头拆在正中
    var splitClip: (Shot.ID) -> Void
    var merge: (Set<Shot.ID>) -> Void
    var rematch: (Set<Shot.ID>) -> Void
    var export: (Set<Shot.ID>) -> Void
}

// 画面右边的脚本：一个文本框，一镜一段。
// 点片段、拖片段，这里跳到那一句，高亮，跟着播放走字。点一句，时间线跳到那一镜。
// 回车拆开，退格并回上一句，选中几句右键组合。字在文稿页和右栏改，这里只管分段
struct ScriptFollow: NSViewRepresentable {
    let rows: [Shot]
    @Binding var selection: Shot.ID?
    let clock: PlayClock
    let duration: Double
    let actions: ShotActions

    func makeCoordinator() -> Coordinator { Coordinator(clock: clock) }

    func makeNSView(context: Context) -> ScriptScrollView {
        let storage = NSTextStorage()
        let layout = NSLayoutManager()
        storage.addLayoutManager(layout)
        let container = NSTextContainer(size: NSSize(width: 300, height: CGFloat.greatestFiniteMagnitude))
        container.widthTracksTextView = true
        layout.addTextContainer(container)

        let text = ScriptTextView(frame: .zero, textContainer: container)
        text.isEditable = true
        text.isSelectable = true
        text.allowsUndo = false
        text.isRichText = false
        text.importsGraphics = false
        text.drawsBackground = false
        text.isAutomaticQuoteSubstitutionEnabled = false
        text.isAutomaticTextReplacementEnabled = false
        text.isContinuousSpellCheckingEnabled = false
        text.isGrammarCheckingEnabled = false
        text.insertionPointColor = NSColor(Color.lime)
        text.selectedTextAttributes = [.backgroundColor: NSColor.white.withAlphaComponent(0.18)]
        text.isVerticallyResizable = true
        text.isHorizontallyResizable = false
        text.autoresizingMask = [.width]
        text.minSize = .zero
        text.maxSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude)
        text.setAccessibilityLabel("脚本")
        text.delegate = context.coordinator
        text.script = context.coordinator

        let scroll = ScriptScrollView()
        scroll.drawsBackground = false
        scroll.hasVerticalScroller = false
        scroll.documentView = text
        scroll.onResize = { [weak coordinator = context.coordinator] in coordinator?.reveal(animated: false) }
        context.coordinator.textView = text
        return scroll
    }

    func updateNSView(_ view: ScriptScrollView, context: Context) {
        context.coordinator.update(self)
    }

    final class Coordinator: NSObject, NSTextViewDelegate {
        weak var textView: ScriptTextView?
        private var parent: ScriptFollow?
        private var paragraphs: [(id: Shot.ID, range: NSRange)] = []
        private var signature: [String] = []
        private var current: Shot.ID?
        private var painted: NSRange?
        private var sung = -1
        private var duration = 0.0
        private var time = 0.0
        private var quiet = false
        private var ticking: AnyCancellable?

        init(clock: PlayClock) {
            super.init()
            // 只有这一句跟着播放时间改颜色，不重新排版
            ticking = clock.$time.sink { [weak self] t in
                self?.time = t
                self?.paint()
            }
        }

        func update(_ next: ScriptFollow) {
            parent = next
            duration = next.duration
            let spoken = next.rows.filter { !$0.line.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            let lines = spoken.map { "\($0.id)|\($0.line)" }
            let rebuilt = lines != signature
            if rebuilt {
                signature = lines
                rebuild(spoken)
            }
            if rebuilt || next.selection != current {
                current = next.selection
                sung = -1
                paint(force: true)
                reveal(animated: !rebuilt)
            } else {
                paint()
            }
        }

        private func rebuild(_ spoken: [Shot]) {
            guard let view = textView, let storage = view.textStorage else { return }
            let style = NSMutableParagraphStyle()
            style.lineSpacing = 4
            style.paragraphSpacing = 18
            let attributes: [NSAttributedString.Key: Any] = [
                .font: NSFont.systemFont(ofSize: 16, weight: .medium),
                .foregroundColor: NSColor.white.withAlphaComponent(0.38),
                .paragraphStyle: style,
            ]
            var whole = ""
            var list: [(id: Shot.ID, range: NSRange)] = []
            for shot in spoken {
                // 一镜一段：换行换成空格，下标不变
                let line = shot.line.replacingOccurrences(of: "\n", with: " ")
                let start = (whole as NSString).length
                list.append((shot.id, NSRange(location: start, length: (line as NSString).length)))
                whole += line + "\n"
            }
            quiet = true
            view.layoutManager?.removeTemporaryAttribute(.foregroundColor, forCharacterRange: NSRange(location: 0, length: storage.length))
            painted = nil
            storage.setAttributedString(NSAttributedString(string: whole, attributes: attributes))
            view.setSelectedRange(NSRange(location: 0, length: 0))
            view.sizeToFit()
            quiet = false
            paragraphs = list
        }

        private var currentRange: NSRange? {
            paragraphs.first { $0.id == current }?.range
        }

        private func paint(force: Bool = false) {
            guard let layout = textView?.layoutManager else { return }
            guard let range = currentRange, range.length > 0 else {
                if let painted { layout.removeTemporaryAttribute(.foregroundColor, forCharacterRange: painted) }
                painted = nil
                return
            }
            let k = duration > 0 ? min(1, max(0, time / duration)) : 0
            let count = Int((Double(range.length) * k).rounded())
            if !force, painted == range, count == sung { return }
            if let painted, painted != range { layout.removeTemporaryAttribute(.foregroundColor, forCharacterRange: painted) }
            layout.addTemporaryAttribute(.foregroundColor, value: NSColor(Color.lime), forCharacterRange: NSRange(location: range.location, length: count))
            layout.addTemporaryAttribute(.foregroundColor, value: NSColor.white, forCharacterRange: NSRange(location: range.location + count, length: range.length - count))
            painted = range
            sung = count
        }

        /// 把当前这一句滚到正中
        func reveal(animated: Bool) {
            guard let view = textView, let scroll = view.enclosingScrollView, let layout = view.layoutManager,
                  let container = view.textContainer, let range = currentRange else { return }
            layout.ensureLayout(for: container)
            let glyphs = layout.glyphRange(forCharacterRange: range, actualCharacterRange: nil)
            let rect = layout.boundingRect(forGlyphRange: glyphs, in: container)
            let clip = scroll.contentView
            let mid = rect.midY + view.textContainerOrigin.y
            let y = max(0, min(mid - clip.bounds.height / 2, view.frame.height - clip.bounds.height))
            if animated, !NSWorkspace.shared.accessibilityDisplayShouldReduceMotion {
                NSAnimationContext.runAnimationGroup { context in
                    context.duration = 0.25
                    clip.animator().setBoundsOrigin(NSPoint(x: 0, y: y))
                }
            } else {
                clip.setBoundsOrigin(NSPoint(x: 0, y: y))
            }
            scroll.reflectScrolledClipView(clip)
        }

        // ---------- 光标和选择 ----------
        private func shots(in selected: NSRange) -> [Shot.ID] {
            if selected.length == 0 {
                return paragraphs.first { NSLocationInRange(selected.location, NSRange(location: $0.range.location, length: $0.range.length + 1)) }.map { [$0.id] } ?? []
            }
            return paragraphs.filter { NSIntersectionRange($0.range, selected).length > 0 }.map(\.id)
        }

        /// 光标落在一句里，时间线跟过去。选中跨了几句就不动
        func follow() {
            guard let view = textView, !quiet else { return }
            let ids = shots(in: view.selectedRange())
            if ids.count == 1, ids[0] != parent?.selection {
                parent?.selection = ids[0]
            }
        }

        func textViewDidChangeSelection(_ notification: Notification) {
            guard let view = textView, !view.tracking else { return }
            follow()
        }

        func returnPressed() {
            guard let view = textView else { return }
            let at = view.selectedRange().location
            guard let p = paragraphs.first(where: { at > $0.range.location && at < $0.range.location + $0.range.length }) else { return }
            parent?.actions.splitText(p.id, at - p.range.location)
        }

        func backspacePressed() {
            guard let view = textView, view.selectedRange().length == 0 else { return }
            let at = view.selectedRange().location
            guard let i = paragraphs.firstIndex(where: { $0.range.location == at }), i > 0 else { return }
            parent?.actions.merge([paragraphs[i - 1].id, paragraphs[i].id])
        }

        func menu(for event: NSEvent) -> NSMenu? {
            guard let view = textView, let actions = parent?.actions else { return nil }
            let index = view.characterIndexForInsertion(at: view.convert(event.locationInWindow, from: nil))
            if !NSLocationInRange(index, view.selectedRange()) {
                view.setSelectedRange(NSRange(location: index, length: 0))
                follow()
            }
            let ids = shots(in: view.selectedRange())
            guard let first = ids.first else { return nil }
            let group = Set(ids)
            let menu = NSMenu()
            if ids.count >= 2 {
                menu.add("组合这 \(ids.count) 句") { actions.merge(group) }
                menu.add("重新匹配这 \(ids.count) 句") { actions.rematch(group) }
                menu.add("导出这 \(ids.count) 句…") { actions.export(group) }
            } else {
                let at = view.selectedRange().location
                if let p = paragraphs.first(where: { $0.id == first }), at > p.range.location, at < p.range.location + p.range.length {
                    menu.add("拆分") { actions.splitText(first, at - p.range.location) }
                }
                menu.add("重新匹配") { actions.rematch(group) }
                menu.add("导出这一句…") { actions.export(group) }
            }
            if view.selectedRange().length > 0 {
                menu.addItem(.separator())
                menu.addItem(withTitle: "拷贝", action: #selector(NSText.copy(_:)), keyEquivalent: "")
            }
            return menu
        }

        #if DEBUG
        func characterIndex(of id: Shot.ID) -> Int? { paragraphs.first { $0.id == id }?.range.location }

        /// 测试用：这一句在窗口里的位置
        func point(of id: Shot.ID, fraction: Double) -> NSPoint? {
            guard let view = textView, let layout = view.layoutManager, let container = view.textContainer,
                  let range = paragraphs.first(where: { $0.id == id })?.range else { return nil }
            let at = range.location + Int(Double(range.length) * fraction)
            let glyph = layout.glyphIndexForCharacter(at: at)
            let rect = layout.lineFragmentRect(forGlyphAt: glyph, effectiveRange: nil)
            let spot = layout.location(forGlyphAt: glyph)
            let origin = view.textContainerOrigin
            return view.convert(NSPoint(x: rect.minX + spot.x + origin.x, y: rect.midY + origin.y), to: nil)
        }
        #endif
    }
}

final class ScriptScrollView: NSScrollView {
    var onResize: (() -> Void)?
    private var lastHeight: CGFloat = -1

    override func layout() {
        super.layout()
        guard bounds.height != lastHeight, let text = documentView as? NSTextView else { return }
        lastHeight = bounds.height
        // 第一句和最后一句也能停在正中
        text.textContainerInset = NSSize(width: 14, height: max(8, bounds.height / 2 - 24))
        text.sizeToFit()
        onResize?()
    }
}

// 能放光标、能选字，打不了字
final class ScriptTextView: NSTextView {
    weak var script: ScriptFollow.Coordinator?
    private(set) var tracking = false
    /// 点进来才拿焦点。窗口打开时不抢，空格、B、方向键留给画面
    var wantsFocus = false

    override var acceptsFirstResponder: Bool { wantsFocus }

    // 窗口没在前台时，点一下也落光标，和时间线的片段一样
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    override func resignFirstResponder() -> Bool {
        wantsFocus = false
        return super.resignFirstResponder()
    }

    override func shouldChangeText(in affectedCharRange: NSRange, replacementString: String?) -> Bool { false }

    override func keyDown(with event: NSEvent) {
        let flags = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
        switch event.keyCode {
        case 36, 76:
            if flags.isEmpty { script?.returnPressed() }
        case 51:
            if flags.isEmpty { script?.backspacePressed() }
        case 123, 124, 125, 126:
            super.keyDown(with: event)
        default:
            // 输入法也不进来，字母键不响也不写。⌘ 组合键走菜单
            if flags.contains(.command) { super.keyDown(with: event) }
        }
    }

    override func mouseDown(with event: NSEvent) {
        wantsFocus = true
        window?.makeFirstResponder(self)
        tracking = true
        super.mouseDown(with: event)
        tracking = false
        script?.follow()
    }

    override func rightMouseDown(with event: NSEvent) {
        wantsFocus = true
        window?.makeFirstResponder(self)
        super.rightMouseDown(with: event)
    }

    override func menu(for event: NSEvent) -> NSMenu? { script?.menu(for: event) }
}

private final class MenuClosure: NSObject {
    let run: () -> Void
    init(_ run: @escaping () -> Void) { self.run = run }
    @objc func fire() { run() }
}

private extension NSMenu {
    func add(_ title: String, _ run: @escaping () -> Void) {
        let closure = MenuClosure(run)
        let item = NSMenuItem(title: title, action: #selector(MenuClosure.fire), keyEquivalent: "")
        item.target = closure
        item.representedObject = closure
        addItem(item)
    }
}

// 拆在哪个字：优先落在标点后面
enum ShotSplit {
    static func offset(in line: String, fraction: Double) -> Int {
        let letters = Array(line)
        guard letters.count >= 2 else { return letters.count }
        let target = min(letters.count - 1, max(1, Int((Double(letters.count) * fraction).rounded())))
        let marks = Set("，。！？、；：,.!?;:")
        for reach in 0...8 {
            for i in [target - reach, target + reach] where i >= 1 && i < letters.count {
                if marks.contains(letters[i - 1]) { return i }
            }
        }
        return target
    }

    static func joined(_ lines: [String]) -> String {
        let marks = Set("，。！？、；：,.!?;:…")
        var out = ""
        for line in lines.map({ $0.trimmingCharacters(in: .whitespacesAndNewlines) }) where !line.isEmpty {
            if let last = out.last, !marks.contains(last) { out += "，" }
            out += line
        }
        return out
    }
}
