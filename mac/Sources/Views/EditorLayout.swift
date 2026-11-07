import AppKit
import SwiftUI

// 窗口的主体，参考 Kawsar Ahmed 的 Video Editor：深暖灰，中间大画面，下面玻璃圆键和玻璃时间线。
// 每一镜就是时间线上的一个片段，所以没有左边的列表

extension Color {
    static let deskBase = Color(light: 0x2F2B29, dark: 0x2F2B29)
    static let deskWell = Color.white.opacity(0.07)
    static let lime = Color(light: 0xE4F56B, dark: 0xE4F56B)
    static let coral = Color(light: 0xF2545B, dark: 0xF2545B)
}

struct EditorStage<Center: View>: View {
    let mode: ViewMode
    let rows: [Shot]
    @Binding var selection: Shot.ID?
    @Binding var picked: Set<Shot.ID>
    let actions: ShotActions
    @ObservedObject var stage: StageController
    let names: [String: String]
    let previousDataTemplate: String?
    let onPick: (Shot) -> Void
    let onUndo: () -> Void
    let onRedo: () -> Void
    let onAdd: () -> Void
    let onDelete: (Shot.ID) -> Void
    let onTrim: (Shot.ID, Double?) -> Void
    let onMove: (Int) -> Void
    @ViewBuilder let center: Center
    @State private var showingElements = false

    private var current: Shot? { rows.first { $0.id == selection } }

    var body: some View {
        VStack(spacing: 0) {
            if mode == .stage, let current {
                HStack(spacing: 8) {
                    MotionButton(shot: current, stage: stage, names: names, previousDataTemplate: previousDataTemplate, floating: true, onPick: onPick)
                    Button {
                        showingElements.toggle()
                    } label: {
                        Image(systemName: "square.3.layers.3d")
                    }
                    .buttonStyle(.glassKey(diameter: 30))
                    .named("元素")
                    .help("元素")
                    .disabled(stage.elements.isEmpty)
                    .popover(isPresented: $showingElements, arrowEdge: .bottom) {
                        ElementList(shot: current, stage: stage)
                    }
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
            }
            GeometryReader { geo in
                HStack(spacing: 0) {
                    center
                    // 窗口太窄时先保画面
                    if mode == .stage, geo.size.width >= 760 {
                        ScriptFollow(rows: rows, selection: $selection, clock: stage.clock, duration: stage.duration, actions: actions)
                            .frame(width: 300)
                            .named("脚本")
                            .background(Color.deskWell, in: RoundedRectangle(cornerRadius: 16))
                            .padding(.vertical, 8)
                            .padding(.trailing, 14)
                    }
                }
            }
            if mode == .stage {
                progressLine
                controlRow
                ShotTimeline(rows: rows, selection: $selection, picked: $picked, actions: actions, stage: stage, names: names, previousDataTemplate: previousDataTemplate, onPick: onPick, onAdd: onAdd, onDelete: onDelete, onTrim: onTrim)
                    .clipShape(RoundedRectangle(cornerRadius: 20))
                    .glass(in: RoundedRectangle(cornerRadius: 20))
                    .padding(.horizontal, 10)
                    .padding(.bottom, 10)
            }
        }
        .background(Color.deskBase.ignoresSafeArea())
    }

    // 画面底下一条细线，走到当前时间
    private var progressLine: some View {
        ProgressLine(clock: stage.clock, duration: stage.duration)
    }

    // 控制行：左撤销、中播放、右循环和全屏
    private var controlRow: some View {
        ZStack {
            GlassGroup(spacing: 6) {
                HStack(spacing: 6) {
                    key("arrow.uturn.backward", "撤销一步", action: onUndo)
                    key("arrow.uturn.forward", "重做一步", action: onRedo)
                    key("trash", "删除这一镜") { if let selection { onDelete(selection) } }
                    Spacer()
                    Toggle(isOn: Binding(get: { stage.loop }, set: { stage.loop = $0 })) {
                        Image(systemName: "repeat")
                    }
                    .toggleStyle(LoopToggleStyle())
                    .named("循环播放")
                    .help("循环播放这一镜")
                    key("arrow.up.left.and.arrow.down.right", "全屏") { NSApp.keyWindow?.toggleFullScreen(nil) }
                }
            }
            GlassGroup(spacing: 6) {
                HStack(spacing: 6) {
                    key("backward.end.fill", "回到开头") { stage.seek(0) }
                    key("backward.fill", "上一镜") { onMove(-1) }
                    Button {
                        stage.playPause()
                    } label: {
                        Image(systemName: stage.playing ? "pause.fill" : "play.fill")
                    }
                    .buttonStyle(.glassKey(diameter: 46, main: true))
                    .named(stage.playing ? "暂停" : "播放")
                    .help(stage.playing ? "暂停" : "播放")
                    key("forward.fill", "下一镜") { onMove(1) }
                    key("forward.end.fill", "跳到结尾") { stage.seek(max(0, stage.duration - 0.05)) }
                }
            }
        }
        .padding(.horizontal, 14)
        .frame(height: 62)
    }

    private func key(_ symbol: String, _ name: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
        }
        .buttonStyle(.glassKey())
        .named(name)
        .help(name)
    }
}

private struct LoopToggleStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        Button {
            configuration.isOn.toggle()
        } label: {
            configuration.label
                .foregroundStyle(configuration.isOn ? Color.lime : Color.white.opacity(0.7))
        }
        .buttonStyle(.glassKey())
        .accessibilityValue(configuration.isOn ? "开" : "关")
    }
}

// ---------- 时间线：刻度、章节胶囊、缩略图片段、口播刻度，一镜一列 ----------
struct ShotTimeline: View {
    let rows: [Shot]
    @Binding var selection: Shot.ID?
    @Binding var picked: Set<Shot.ID>
    let actions: ShotActions
    @ObservedObject var stage: StageController
    let names: [String: String]
    let previousDataTemplate: String?
    let onPick: (Shot) -> Void
    let onAdd: () -> Void
    let onDelete: (Shot.ID) -> Void
    let onTrim: (Shot.ID, Double?) -> Void
    @State private var seconds: [Shot.ID: Double] = [:]
    @State private var pendingSeek: Double?
    @State private var trimming: Trim?
    @State private var revealJob: Task<Void, Never>?

    private struct Trim {
        let id: Shot.ID
        var seconds: Double
    }

    // 两秒的片段要放得下效果名
    static let pxPerSecond = 40.0
    private static let minWidth = 56.0
    private static let gap = 5.0

    private func duration(_ shot: Shot) -> Double {
        if let trimming, trimming.id == shot.id { return trimming.seconds }
        return shot.duration ?? seconds[shot.id] ?? max(2, Double(shot.line.count) / 4.2)
    }

    // 片段是懒加载的，没画过的宽度只是估算，第一次常常滚不准。再校正两次就准了
    private func reveal(_ id: Shot.ID, _ proxy: ScrollViewProxy, animated: Bool) {
        revealJob?.cancel()
        if animated {
            withAnimation(.easeOut(duration: 0.2)) { proxy.scrollTo(id, anchor: .center) }
        } else {
            proxy.scrollTo(id, anchor: .center)
        }
        revealJob = Task {
            for wait in [250, 400] {
                try? await Task.sleep(for: .milliseconds(wait))
                if Task.isCancelled { return }
                proxy.scrollTo(id, anchor: .center)
            }
        }
    }

    // 松手才写进文档，一次拖动是一步撤销
    private func commitTrim() {
        guard let trimming else { return }
        seconds[trimming.id] = trimming.seconds
        onTrim(trimming.id, trimming.seconds)
        self.trimming = nil
    }

    private func width(_ shot: Shot) -> Double {
        max(Self.minWidth, duration(shot) * Self.pxPerSecond)
    }

    private struct Layout {
        var start: [Shot.ID: Double] = [:]
    }

    private var layout: Layout {
        var result = Layout()
        var t = 0.0
        for shot in rows {
            result.start[shot.id] = t
            t += duration(shot)
        }
        return result
    }

    var body: some View {
        let map = layout
        ScrollViewReader { proxy in
            ScrollView(.horizontal) {
                LazyHStack(alignment: .top, spacing: Self.gap) {
                    ForEach(rows) { shot in
                        ClipColumn(
                            shot: shot,
                            width: width(shot),
                            startTime: map.start[shot.id] ?? 0,
                            seconds: duration(shot),
                            chapterStart: isChapterStart(shot),
                            motionName: names[shot.template] ?? "重音字幕",
                            selected: selection == shot.id,
                            picked: picked.contains(shot.id),
                            group: picked.contains(shot.id) && picked.count >= 2 ? picked : [shot.id],
                            actions: actions,
                            trimming: trimming?.id == shot.id,
                            stage: stage,
                            previousDataTemplate: previousDataTemplate,
                            onSelect: { selection = shot.id },
                            onTap: { tap(shot) },
                            onScrub: { scrub(shot, $0) },
                            onPick: onPick,
                            onAdd: onAdd,
                            onDelete: { onDelete(shot.id) },
                            onTrimChange: {
                                trimming = Trim(id: shot.id, seconds: $0)
                                // 剪到哪一镜，画面和脚本跟到哪一镜
                                if selection != shot.id { selection = shot.id }
                            },
                            onTrimEnd: commitTrim,
                            onTrimReset: { onTrim(shot.id, nil) }
                        )
                        .id(shot.id)
                        .zIndex(selection == shot.id ? 1 : 0)
                    }
                }
                .padding(.horizontal, 14)
            }
            .scrollIndicators(.never)
            .onChange(of: selection) { id in
                // 拖着边缘时不滚动，不然片段从手底下跑掉
                if trimming == nil, let id { reveal(id, proxy, animated: true) }
            }
            .onAppear {
                if let selection { reveal(selection, proxy, animated: false) }
            }
            // 真实时长算出来后，前面片段的宽度都变了，选中的片段会被挤出视野
            .onChange(of: seconds) { _ in
                if trimming == nil, let selection { reveal(selection, proxy, animated: false) }
            }
        }
        .frame(height: 172)
        .task(id: rows) {
            seconds = await stage.durations(rows)
        }
        .onChange(of: stage.duration) { d in
            if let f = pendingSeek, d > 0 {
                pendingSeek = nil
                stage.seek(f * d)
            }
        }
    }

    // ⌘ 点：加减一镜。⇧ 点：连选一段。直接点：只选这一镜
    private func tap(_ shot: Shot) {
        let flags = NSApp.currentEvent?.modifierFlags ?? NSEvent.modifierFlags
        if flags.contains(.command) {
            if picked.isEmpty, let selection { picked = [selection] }
            if picked.contains(shot.id) { picked.remove(shot.id) } else { picked.insert(shot.id) }
        } else if flags.contains(.shift), let selection,
                  let a = rows.firstIndex(where: { $0.id == selection }), let b = rows.firstIndex(where: { $0.id == shot.id }) {
            picked = Set(rows[min(a, b)...max(a, b)].map(\.id))
        } else {
            picked = []
            selection = shot.id
        }
    }

    private func isChapterStart(_ shot: Shot) -> Bool {
        guard let i = rows.firstIndex(where: { $0.id == shot.id }) else { return false }
        return i == 0 || rows[i - 1].chapter != shot.chapter
    }

    private func scrub(_ shot: Shot, _ fraction: Double) {
        if selection == shot.id {
            stage.seek(fraction * stage.duration)
        } else {
            pendingSeek = fraction
            selection = shot.id
        }
    }

    static func clock(_ t: Double) -> String {
        String(format: "%02d:%02d", Int(t) / 60, Int(t) % 60)
    }
}

private struct ClipColumn: View {
    let shot: Shot
    let width: Double
    let startTime: Double
    let seconds: Double
    let chapterStart: Bool
    let motionName: String
    let selected: Bool
    let picked: Bool
    let group: Set<Shot.ID>
    let actions: ShotActions
    let trimming: Bool
    @ObservedObject var stage: StageController
    let previousDataTemplate: String?
    let onSelect: () -> Void
    let onTap: () -> Void
    let onScrub: (Double) -> Void
    let onPick: (Shot) -> Void
    let onAdd: () -> Void
    let onDelete: () -> Void
    let onTrimChange: (Double) -> Void
    let onTrimEnd: () -> Void
    let onTrimReset: () -> Void
    @State private var strip: [NSImage] = []
    @State private var picking = false
    @State private var hoveringCaption = false

    private var frameCount: Int { max(1, Int((width / 103).rounded(.up))) }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ruler
            captionTrack
            clip
            audioTrack
        }
        .frame(width: width)
        .overlay(alignment: .topLeading) {
            if selected { Playhead(clock: stage.clock, duration: stage.duration, startTime: startTime, seconds: seconds, width: width) }
        }
        .task(id: "\(frameCount)|\(shot.json)") { strip = await stage.frames(of: shot, count: frameCount) }
    }

    // 刻度：一秒一格，点或拖就是定位
    private var ruler: some View {
        ZStack(alignment: .topLeading) {
            Canvas { ctx, size in
                let step = size.width / max(1, seconds)
                var x = 0.0
                var i = 0
                while x < size.width {
                    let tall = i % 5 == 0
                    ctx.fill(Path(CGRect(x: x, y: size.height - (tall ? 8 : 4), width: 1, height: tall ? 8 : 4)), with: .color(.white.opacity(tall ? 0.45 : 0.2)))
                    x += step
                    i += 1
                }
            }
            Text(ShotTimeline.clock(startTime))
                .font(.system(size: 10).monospacedDigit())
                .foregroundStyle(Color.white.opacity(0.65))
        }
        .frame(height: 26)
        .padding(.top, 6)
        .contentShape(Rectangle())
        .gesture(DragGesture(minimumDistance: 0).onChanged { value in
            onScrub(min(1, max(0, value.location.x / width)))
        })
        .accessibilityHidden(true)
    }

    // 胶囊轨：这一镜用的动效，每章第一镜前面带章节名。点它换效果
    private var captionTrack: some View {
        Button {
            onSelect()
            picking.toggle()
        } label: {
            HStack(spacing: 5) {
                Image(systemName: "circle.lefthalf.filled")
                    .font(.system(size: 10))
                Text(chapterStart && shot.chapter != "正片" ? "\(shot.chapter) · \(motionName)" : motionName).lineLimit(1)
                Spacer(minLength: 0)
            }
            .font(.system(size: 11))
            .foregroundStyle(Color.white.opacity(hoveringCaption || picking ? 1 : 0.8))
            .padding(.horizontal, 7)
            .frame(height: 20)
            .background(hoveringCaption || picking ? Color.white.opacity(0.18) : Color.deskWell, in: Capsule())
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .onHover { hoveringCaption = $0 }
        .named("效果\(shot.no)")
        .accessibilityValue(motionName)
        .help(motionName)
        .popover(isPresented: $picking, arrowEdge: .top) {
            MotionPicker(shot: shot, stage: stage, previousDataTemplate: previousDataTemplate, onPick: onPick)
        }
    }

    private var clip: some View {
        ZStack(alignment: .bottomLeading) {
            RoundedRectangle(cornerRadius: 7).fill(Color.black)
            if !strip.isEmpty {
                HStack(spacing: 1) {
                    ForEach(strip.indices, id: \.self) { i in
                        Image(nsImage: strip[i])
                            .resizable()
                            .frame(width: 103, height: 58)
                    }
                }
                .frame(width: width, height: 58, alignment: .leading)
                .clipped()
            }
            HStack(spacing: 4) {
                Text(shot.no)
                    .font(.system(size: 10, weight: .medium).monospacedDigit())
                    .foregroundStyle(Color.white)
                if !shot.note.isEmpty {
                    ReviewDot().help(shot.note)
                }
            }
            .padding(.horizontal, 5)
            .padding(.vertical, 2)
            .background(Color.black.opacity(0.55), in: RoundedRectangle(cornerRadius: 4))
            .padding(4)
        }
        .frame(width: width, height: 58)
        .clipShape(RoundedRectangle(cornerRadius: 7))
        .overlay {
            RoundedRectangle(cornerRadius: 7)
                .strokeBorder(selected ? Color.lime : picked ? Color.lime.opacity(0.65) : Color.white.opacity(0.08), lineWidth: selected || picked ? 3 : 1)
        }
        .overlay {
            if picked { RoundedRectangle(cornerRadius: 7).fill(Color.lime.opacity(0.16)).allowsHitTesting(false) }
        }
        .contentShape(Rectangle())
        .onTapGesture(perform: onTap)
        .contextMenu {
            if group.count >= 2 {
                Button("组合这 \(group.count) 镜") { actions.merge(group) }
                Button("重新匹配这 \(group.count) 镜") { actions.rematch(group) }
                Button("导出这 \(group.count) 镜…") { actions.export(group) }
            } else {
                Button("拆分") { actions.splitClip(shot.id) }
                Button("重新匹配") { actions.rematch(group) }
                Button("导出这一镜…") { actions.export(group) }
                Divider()
                Button("新增一镜", action: onAdd)
                if shot.duration != nil {
                    Button("恢复自动时长", action: onTrimReset)
                }
                Button("删除这一镜", role: .destructive, action: onDelete)
            }
        }
        .help(shot.line)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("第 \(shot.no) 镜 \(shot.line)")
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
        .testFrame("片段\(shot.no)")
        .overlay(alignment: .trailing) {
            TrimHandle(no: shot.no, seconds: seconds, emphasized: selected, onChange: onTrimChange, onEnd: onTrimEnd)
        }
        .overlay(alignment: .topTrailing) {
            if trimming {
                Text(String(format: "%.1f 秒", seconds))
                    .font(.system(size: 10, weight: .medium).monospacedDigit())
                    .foregroundStyle(Color.black)
                    .padding(.horizontal, 7)
                    .frame(height: 17)
                    .background(Color.lime, in: Capsule())
                    .fixedSize()
                    .offset(y: -20)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
            }
        }
    }

    // 口播轨：有口播的镜头一条刻度线，长度就是念多久
    private var audioTrack: some View {
        HStack(spacing: 5) {
            Image(systemName: "music.note")
                .font(.system(size: 9))
                .foregroundStyle(Color.white.opacity(0.7))
                .frame(width: 16, height: 16)
                .background(Color.deskWell, in: Circle())
            Canvas { ctx, size in
                let y = size.height / 2
                ctx.fill(Path(CGRect(x: 0, y: y, width: size.width, height: 1)), with: .color(.lime.opacity(0.5)))
                var x = 0.0
                while x <= size.width {
                    ctx.fill(Path(CGRect(x: x, y: y - 3, width: 1, height: 7)), with: .color(.lime.opacity(0.5)))
                    x += 26
                }
            }
        }
        .frame(height: 18)
        .accessibilityHidden(true)
    }
}

// 片段右边缘：往右拖拉长，往左拖缩短。一镜最短半秒，后面的片段跟着挪
private struct TrimHandle: View {
    let no: String
    let seconds: Double
    let emphasized: Bool
    let onChange: (Double) -> Void
    let onEnd: () -> Void
    @State private var start: Double?
    @State private var hovering = false

    private static func clamp(_ value: Double) -> Double {
        min(600, max(0.5, (value * 10).rounded() / 10))
    }

    var body: some View {
        Color.clear
            .frame(width: 12)
            .overlay {
                Capsule()
                    .fill(Color.lime)
                    .frame(width: 3, height: 26)
                    .opacity(hovering || start != nil || emphasized ? 1 : 0)
            }
            .contentShape(Rectangle())
            .modifier(ResizeCursor())
            .onHover { hovering = $0 }
            .gesture(
                DragGesture(minimumDistance: 1, coordinateSpace: .global)
                    .onChanged { value in
                        let base = start ?? seconds
                        if start == nil { start = seconds }
                        onChange(Self.clamp(base + value.translation.width / ShotTimeline.pxPerSecond))
                    }
                    .onEnded { _ in
                        start = nil
                        onEnd()
                    }
            )
            .named("时长\(no)")
            .accessibilityValue(String(format: "%.1f 秒", seconds))
            .accessibilityAdjustableAction { direction in
                switch direction {
                case .increment: onChange(Self.clamp(seconds + 0.5))
                case .decrement: onChange(Self.clamp(seconds - 0.5))
                @unknown default: return
                }
                onEnd()
            }
    }
}

private struct ResizeCursor: ViewModifier {
    func body(content: Content) -> some View {
        if #available(macOS 15, *) {
            content.pointerStyle(.columnResize)
        } else {
            content.onHover { inside in
                if inside { NSCursor.resizeLeftRight.push() } else { NSCursor.pop() }
            }
        }
    }
}

// 这两个只跟播放时间走。放成单独的视图，播放时不用刷新整条时间线
private struct ProgressLine: View {
    @ObservedObject var clock: PlayClock
    let duration: Double

    var body: some View {
        GeometryReader { geo in
            let k = duration > 0 ? min(1, clock.time / duration) : 0
            ZStack(alignment: .leading) {
                Rectangle().fill(Color.white.opacity(0.08)).frame(height: 1.5)
                Rectangle().fill(Color.white).frame(width: geo.size.width * k, height: 1.5)
            }
            .frame(maxHeight: .infinity, alignment: .bottom)
        }
        .frame(height: 3)
        .accessibilityHidden(true)
    }
}

// 柠檬黄的播放头：上面一个时间气泡，一条线贯穿轨道。放在片段自己身上，位置不用另外算
private struct Playhead: View {
    @ObservedObject var clock: PlayClock
    let duration: Double
    let startTime: Double
    let seconds: Double
    let width: CGFloat

    var body: some View {
        let k = duration > 0 ? min(1, clock.time / duration) : 0
        VStack(spacing: 0) {
            Text(ShotTimeline.clock(startTime + seconds * k))
                .font(.system(size: 10, weight: .medium).monospacedDigit())
                .foregroundStyle(Color.black)
                .padding(.horizontal, 7)
                .frame(height: 17)
                .background(Color.lime, in: Capsule())
            Circle().fill(Color.lime).frame(width: 7, height: 7).padding(.top, -1)
            Rectangle().fill(Color.lime).frame(width: 1)
        }
        .frame(width: 60, height: 172)
        .offset(x: width * k - 30)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}
