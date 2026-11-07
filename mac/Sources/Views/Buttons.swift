import AppKit
import SwiftUI

// 全 App 内容区的按钮，都是液态玻璃。状态变化参考 khagwal.com/interactions：
// 状态留在按钮里，停止和撤销从按钮侧面分出来（玻璃容器自己融合、分开），完成时变色带勾。
// 数值按 Emil Kowalski 和 Jakub Krehel 的规范：形变 spring 0.3 秒不回弹；
// 文字和图标替换带模糊；减弱动态效果时形变换成淡入淡出，进度保留。
// 工具栏、菜单、系统弹窗继续用原生控件。

enum ButtonMotion {
    static let press = Animation.easeOut(duration: 0.15)
    static let morph = Animation.spring(response: 0.3, dampingFraction: 1)
    static let fade = Animation.easeOut(duration: 0.15)
    /// 结果在按钮上停留多久。完整的错误说明不放在这里，放在按钮下面不会消失的文字里
    static let resultHold = Duration.milliseconds(1600)
    /// 确认按钮展开后多久才能点，防止双击直接确认
    static let confirmArm = Duration.milliseconds(350)

    static func state(reduce: Bool) -> Animation { reduce ? fade : morph }
    static func swap(reduce: Bool) -> AnyTransition {
        if reduce { return .opacity }
        if #available(macOS 14, *) { return AnyTransition(.blurReplace) }
        return .opacity
    }
}

// 调试版记下控件位置，真实窗口测试用它发鼠标事件。SwiftUI 的无障碍树要有辅助技术连上才会建，进程内拿不到。
// 发布版里这个修饰符什么都不做
#if DEBUG
enum ControlFrames {
    static var entries: [UUID: (name: String, frame: CGRect, order: Int)] = [:]
    static var counter = 0

    static func record(_ id: UUID, _ name: String, _ frame: CGRect) {
        counter += 1
        entries[id] = (name, frame, counter)
    }

    // 退场动画里的旧按钮、关掉的窗口都可能还登记着同名的，取最后更新的那个
    static func frame(matching match: (String) -> Bool) -> CGRect? {
        entries.values.filter { match($0.name) }.max { $0.order < $1.order }?.frame
    }
}

// 条目跟着视图的状态一起消失。onDisappear 在标签变化时也可能触发，而且排在 onAppear 后面，靠不住
private final class ControlFrameToken {
    let id = UUID()
    var name = ""

    deinit {
        let id = id
        Task { @MainActor in ControlFrames.entries[id] = nil }
    }
}

private struct ControlFrameRecorder: ViewModifier {
    let name: String
    @State private var token = ControlFrameToken()

    func body(content: Content) -> some View {
        // onChange 的闭包是上一次界面留下的，里面的 name 是旧的。最新的名字放在 token 上
        let _ = (token.name = name)
        content
            .background {
                GeometryReader { geo in
                    let frame = geo.frame(in: .global)
                    Color.clear
                        .onAppear { ControlFrames.record(token.id, token.name, frame) }
                        .onChange(of: frame) { now in ControlFrames.record(token.id, token.name, now) }
                }
            }
            .onChange(of: name) { now in
                if let old = ControlFrames.entries[token.id] { ControlFrames.record(token.id, now, old.frame) }
            }
    }
}

extension View {
    func testFrame(_ name: String) -> some View { modifier(ControlFrameRecorder(name: name)) }
}
#else
extension View {
    func testFrame(_ name: String) -> some View { self }
}
#endif

extension View {
    /// 控件的名字：旁白读它，智能体和测试按它找。一个控件只有这一个名字
    func named(_ name: String) -> some View {
        accessibilityLabel(name)
            .accessibilityIdentifier(name)
            .testFrame(name)
    }
}

enum PillSize {
    case regular, small

    var height: CGFloat { self == .regular ? 30 : 26 }
    var padding: CGFloat { self == .regular ? 14 : 11 }
    var gap: CGFloat { 3 }
    var font: Font { self == .regular ? .body.weight(.medium) : .callout.weight(.medium) }
}

enum PillTone {
    /// quiet 和 inset 不是玻璃：一个放在弹层里（弹层本身是玻璃），一个放在玻璃条里
    case neutral, prominent, quiet, inset, success, failure
}

extension Color {
    // 系统绿配白字只有 2:1，这里压到 4.5:1 以上
    static let doneFill = Color(light: 0x1B7F39, dark: 0x1E8540)
    static let doneSoft = Color(light: 0x1F8A3F, dark: 0x3CC765).opacity(0.16)
    static let doneInk = Color(light: 0x17702F, dark: 0x6FE08E)
    static let dangerSoft = Color(light: 0xD92D20, dark: 0xFF6B60).opacity(0.13)
    static let dangerSoftHover = Color(light: 0xD92D20, dark: 0xFF6B60).opacity(0.20)
    static let dangerInk = Color(light: 0xB8251A, dark: 0xFF8A80)
    static let warnSoft = Color(light: 0xD97706, dark: 0xF5A524).opacity(0.18)

    static let ink = Color(light: 0x1C1C1E, dark: 0xF5F5F7)
    static let inkHover = Color(light: 0x3A3A3C, dark: 0xD1D1D6)
    static let onInk = Color(light: 0xFFFFFF, dark: 0x1C1C1E)
    static func pillNeutral(hover: Bool) -> Color { .primary.opacity(hover ? 0.13 : 0.08) }

    nonisolated init(light: UInt32, dark: UInt32) {
        self.init(nsColor: NSColor(name: nil) { appearance in
            let hex = appearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua ? dark : light
            return NSColor(srgbRed: CGFloat(hex >> 16 & 255) / 255, green: CGFloat(hex >> 8 & 255) / 255, blue: CGFloat(hex & 255) / 255, alpha: 1)
        })
    }
}

// ---------- 基础胶囊 ----------
struct PillButtonStyle: ButtonStyle {
    var tone: PillTone = .neutral
    var size: PillSize = .regular

    func makeBody(configuration: Configuration) -> some View {
        PillBody(configuration: configuration, tone: tone, size: size)
    }
}

extension ButtonStyle where Self == PillButtonStyle {
    static func pill(_ tone: PillTone = .neutral, size: PillSize = .regular) -> PillButtonStyle {
        PillButtonStyle(tone: tone, size: size)
    }
}

private struct PillBody: View {
    let configuration: ButtonStyleConfiguration
    let tone: PillTone
    let size: PillSize
    @Environment(\.isEnabled) private var enabled
    @Environment(\.isFocused) private var focused
    @Environment(\.colorSchemeContrast) private var contrast
    @State private var hovering = false

    private var destructive: Bool { configuration.role == .destructive }
    private var hover: Bool { hovering && enabled }

    private var fill: Color {
        if destructive { return hover ? .dangerSoftHover : .dangerSoft }
        switch tone {
        case .neutral, .inset: return .pillNeutral(hover: hover)
        case .prominent: return hover ? .inkHover : .ink
        case .quiet: return hover ? .pillNeutral(hover: false) : .clear
        case .success: return .doneSoft
        case .failure: return .dangerSoft
        }
    }

    private var tint: Color? {
        if destructive { return .dangerSoft }
        switch tone {
        case .prominent: return .ink
        case .success: return .doneSoft
        case .failure: return .dangerSoft
        default: return nil
        }
    }

    private var isGlass: Bool { tone != .quiet && tone != .inset }

    private var ink: Color {
        if destructive { return .dangerInk }
        switch tone {
        case .neutral, .inset: return .primary
        case .prominent: return .onInk
        case .quiet: return .secondary
        case .success: return .doneInk
        case .failure: return .dangerInk
        }
    }

    var body: some View {
        configuration.label
            .font(size.font)
            .lineLimit(1)
            .foregroundStyle(ink)
            .padding(.horizontal, size.padding)
            .frame(minWidth: size.height, minHeight: size.height)
            .modifier(PillSurface(isGlass: isGlass, tint: tint, fill: fill))
            .overlay {
                if contrast == .increased, tone != .quiet {
                    Capsule().strokeBorder(ink.opacity(0.6))
                }
            }
            .contentShape(Capsule())
            .modifier(FocusRing(shown: focused))
            .opacity(enabled ? 1 : 0.45)
            .pressScale(configuration.isPressed && enabled)
            .onHover { hovering = $0 }
            .noFocusRing()
    }
}

private struct PillSurface: ViewModifier {
    let isGlass: Bool
    let tint: Color?
    let fill: Color

    @ViewBuilder
    func body(content: Content) -> some View {
        if isGlass {
            content.glass(in: Capsule(), tint: tint, interactive: true, fallback: fill)
        } else {
            content.background(fill, in: Capsule())
        }
    }
}

private struct FocusRing: ViewModifier {
    let shown: Bool

    func body(content: Content) -> some View {
        content.overlay {
            if shown {
                Capsule().stroke(Color.accentColor, lineWidth: 2).padding(-3)
            }
        }
    }
}

// ---------- 图标按钮：平时只有图标，鼠标放上去才有底 ----------
struct IconButtonStyle: ButtonStyle {
    var diameter: CGFloat = 28
    var faint = false

    func makeBody(configuration: Configuration) -> some View {
        IconBody(configuration: configuration, diameter: diameter, faint: faint)
    }
}

extension ButtonStyle where Self == IconButtonStyle {
    static func icon(diameter: CGFloat = 28, faint: Bool = false) -> IconButtonStyle {
        IconButtonStyle(diameter: diameter, faint: faint)
    }
}

private struct IconBody: View {
    let configuration: ButtonStyleConfiguration
    let diameter: CGFloat
    let faint: Bool
    @Environment(\.isEnabled) private var enabled
    @Environment(\.isFocused) private var focused
    @State private var hovering = false

    private var active: Bool { hovering && enabled }

    private var ink: AnyShapeStyle {
        if configuration.role == .destructive { return AnyShapeStyle(Color.dangerInk) }
        if active { return AnyShapeStyle(.primary) }
        return faint ? AnyShapeStyle(.tertiary) : AnyShapeStyle(.secondary)
    }

    var body: some View {
        configuration.label
            .font(.system(size: diameter * 0.42, weight: .medium))
            .foregroundStyle(ink)
            .frame(width: diameter, height: diameter)
            .background(active ? Color.pillNeutral(hover: false) : .clear, in: Circle())
            .contentShape(Circle())
            .modifier(FocusRing(shown: focused))
            .opacity(enabled ? 1 : 0.45)
            .scaleEffect(configuration.isPressed && enabled ? 0.96 : 1)
            .animation(ButtonMotion.press, value: configuration.isPressed)
            .onHover { hovering = $0 }
            .noFocusRing()
    }
}

// ---------- 玻璃圆键：单独放的图标按钮 ----------
struct GlassKeyStyle: ButtonStyle {
    var diameter: CGFloat = 32
    var main = false

    func makeBody(configuration: Configuration) -> some View {
        GlassKeyBody(configuration: configuration, diameter: diameter, main: main)
    }
}

extension ButtonStyle where Self == GlassKeyStyle {
    static func glassKey(diameter: CGFloat = 32, main: Bool = false) -> GlassKeyStyle {
        GlassKeyStyle(diameter: diameter, main: main)
    }
}

private struct GlassKeyBody: View {
    let configuration: ButtonStyleConfiguration
    let diameter: CGFloat
    let main: Bool
    @Environment(\.isEnabled) private var enabled

    var body: some View {
        configuration.label
            .font(.system(size: diameter * 0.38, weight: main ? .bold : .medium))
            .frame(width: diameter, height: diameter)
            .glass(in: Circle(), interactive: true)
            .contentShape(Circle())
            .opacity(enabled ? 1 : 0.45)
            .pressScale(configuration.isPressed && enabled)
    }
}

// 组合按钮内部用：只负责按下反馈和焦点环，形状由外层画，按下时整体一起缩
private struct InnerPressStyle: ButtonStyle {
    var onPress: (Bool) -> Void = { _ in }

    func makeBody(configuration: Configuration) -> some View {
        InnerPressBody(configuration: configuration, onPress: onPress)
    }
}

private struct InnerPressBody: View {
    let configuration: ButtonStyleConfiguration
    let onPress: (Bool) -> Void
    @Environment(\.isFocused) private var focused

    var body: some View {
        configuration.label
            .modifier(FocusRing(shown: focused))
            .noFocusRing()
            .onChange(of: configuration.isPressed) { pressed in onPress(pressed) }
    }
}

// 贴合内容，超过上限才截断。frame(maxWidth:) 会把内容撑到上限
nonisolated private struct CappedWidth: Layout {
    let cap: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        subviews.first?.sizeThatFits(ProposedViewSize(width: min(proposal.width ?? cap, cap), height: proposal.height)) ?? .zero
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        subviews.first?.place(at: bounds.origin, proposal: ProposedViewSize(bounds.size))
    }
}

// ---------- 耗时任务：进度和停止都在按钮里 ----------
enum TaskPhase: Equatable {
    case idle
    case running(Double, String)
    case finished(String, ok: Bool)

    enum Stage: Hashable {
        case idle, running, ok, warn
    }

    /// 只看阶段不看内容。动画挂在这上面，进度每跳一次不会触发形变
    var stage: Stage {
        switch self {
        case .idle: .idle
        case .running: .running
        case .finished(_, let ok): ok ? .ok : .warn
        }
    }
}

extension View {
    /// 按钮旁边的元素和按钮走同一个动画，不然形变途中会压在按钮上
    func followsMorph<V: Equatable>(_ value: V) -> some View {
        modifier(FollowsMorph(value: value))
    }
}

private struct FollowsMorph<V: Equatable>: ViewModifier {
    let value: V
    @Environment(\.accessibilityReduceMotion) private var reduce

    func body(content: Content) -> some View {
        content.animation(ButtonMotion.state(reduce: reduce), value: value)
    }
}

struct TaskButton: View {
    let title: String
    let phase: TaskPhase
    var enabled = true
    let onStart: () -> Void
    let onStop: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduce
    @State private var hovering = false
    @State private var pressed = false
    @Namespace private var glassSpace
    private let size = PillSize.regular

    private var kind: TaskPhase.Stage { phase.stage }

    private var percent: Int {
        if case .running(let f, _) = phase { return Int((min(max(f, 0), 1) * 100).rounded()) }
        return 0
    }

    private var fill: Color {
        switch kind {
        case .idle: hovering && enabled ? .inkHover : .ink
        case .running: .pillNeutral(hover: false)
        case .ok: .doneFill
        case .warn: .warnSoft
        }
    }

    private var ink: Color {
        switch kind {
        case .idle: .onInk
        case .ok: .white
        case .running, .warn: .primary
        }
    }

    private var isRunning: Bool { kind == .running }

    private var spokenLabel: String {
        switch phase {
        case .idle: title
        case .running(_, let text): text
        case .finished(let text, _): text
        }
    }

    private var tint: Color? {
        switch kind {
        case .idle: .ink
        case .running: nil
        case .ok: .doneFill
        case .warn: .warnSoft
        }
    }

    var body: some View {
        GlassGroup(spacing: 10) {
            HStack(spacing: isRunning ? size.gap : 0) {
                Button {
                    if kind == .idle, enabled { onStart() }
                } label: {
                    label
                        .font(size.font)
                        .lineLimit(1)
                        .padding(.horizontal, size.padding)
                        .frame(minHeight: size.height)
                        .background {
                            if case .running(let f, _) = phase {
                                ProgressWash(fraction: f)
                                    .animation(.linear(duration: 0.2), value: percent)
                            }
                        }
                        .clipShape(Capsule())
                        .contentShape(Capsule())
                        .glass(in: Capsule(), tint: tint, interactive: true, fallback: fill)
                        .glassID("main", in: glassSpace)
                }
                .buttonStyle(InnerPressStyle { pressed = $0 })
                // 这里不能用 disabled：禁用环境会把里面的强调色压成灰，进度底色就没了
                .disabled(kind == .idle && !enabled)
                .keyboardShortcut(kind == .idle && enabled ? .defaultAction : nil)
                .named(spokenLabel)
                .accessibilityValue(isRunning ? "\(percent)%" : "")

                // 一直留在层级里，只把宽度收成 0。玻璃容器里的子视图一旦移除，旁边的按钮就点不动了（macOS 27 上实测）
                Button {
                    if isRunning { onStop() }
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 11, weight: .bold))
                        .opacity(isRunning ? 1 : 0)
                        .frame(width: isRunning ? size.height : 0, height: size.height)
                        .contentShape(Circle())
                        .glass(in: Circle(), interactive: true, fallback: .pillNeutral(hover: false))
                        .glassID("stop", in: glassSpace)
                }
                .buttonStyle(InnerPressStyle { pressed = $0 })
                .keyboardShortcut(isRunning ? .cancelAction : nil)
                .named(isRunning ? "停止" : "")
                .accessibilityHidden(!isRunning)
            }
        }
        .foregroundStyle(ink)
        .opacity(enabled || kind != .idle ? 1 : 0.45)
        .pressScale(pressed)
        .animation(ButtonMotion.state(reduce: reduce), value: kind)
        .onHover { hovering = $0 }
    }

    @ViewBuilder
    private var label: some View {
        switch phase {
        case .idle:
            Text(title)
                .transition(ButtonMotion.swap(reduce: reduce))
        case .running(_, let text):
            HStack(spacing: 8) {
                CappedWidth(cap: 380) {
                    Text(text)
                        .truncationMode(.middle)
                }
                .help(text)
                Text("\(percent)%")
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
                    .frame(minWidth: 34, alignment: .trailing)
                    .contentTransition(reduce ? .opacity : .numericText())
                    .animation(ButtonMotion.fade, value: percent)
            }
            .transition(ButtonMotion.swap(reduce: reduce))
        case .finished(let text, let ok):
            HStack(spacing: 5) {
                Image(systemName: ok ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                    .foregroundStyle(ok ? Color.white : Color.orange)
                    .accessibilityHidden(true)
                Text(text)
            }
            .transition(ButtonMotion.swap(reduce: reduce))
        }
    }
}

private struct ProgressWash: View {
    let fraction: Double

    var body: some View {
        GeometryReader { geo in
            let width = geo.size.width * min(max(fraction, 0), 1)
            let solid = width > 22 ? (width - 22) / width : 0
            Rectangle()
                .fill(LinearGradient(stops: [
                    .init(color: .primary.opacity(0.14), location: 0),
                    .init(color: .primary.opacity(0.14), location: solid),
                    .init(color: .primary.opacity(0), location: 1),
                ], startPoint: .leading, endPoint: .trailing))
                .frame(width: width)
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

// ---------- 短操作：结果在按钮上停一下再回去，宽度不跳 ----------
enum ResultPhase: Equatable {
    case idle, working
    case success(String)
    case failure(String)
}

struct ResultButton: View {
    let title: String
    @Binding var phase: ResultPhase
    var enabled = true
    var size: PillSize = .small
    let action: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduce

    private var tone: PillTone {
        switch phase {
        case .idle, .working: .neutral
        case .success: .success
        case .failure: .failure
        }
    }

    private var spoken: String {
        switch phase {
        case .idle: ""
        case .working: "正在处理"
        case .success(let t), .failure(let t): t
        }
    }

    var body: some View {
        Button {
            // 不用 allowsHitTesting：状态变回来之后点击可能还是进不去
            if phase == .idle { action() }
        } label: {
            ZStack {
                Text(title).opacity(0).accessibilityHidden(true)
                content
            }
        }
        .buttonStyle(.pill(tone, size: size))
        .disabled(!enabled && phase == .idle)
        .named(title)
        .accessibilityValue(spoken)
        .animation(ButtonMotion.state(reduce: reduce), value: phase)
        .task(id: phase) {
            switch phase {
            case .success(let t), .failure(let t):
                announceToVoiceOver(t)
                try? await Task.sleep(for: ButtonMotion.resultHold)
                if !Task.isCancelled { phase = .idle }
            case .idle, .working:
                break
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch phase {
        case .idle:
            Text(title).transition(ButtonMotion.swap(reduce: reduce))
        case .working:
            ProgressView()
                .controlSize(.small)
                .scaleEffect(0.8)
                .frame(height: 14)
                .transition(ButtonMotion.swap(reduce: reduce))
        case .success(let t):
            HStack(spacing: 4) {
                Image(systemName: "checkmark.circle.fill").accessibilityHidden(true)
                Text(t)
            }
            .transition(ButtonMotion.swap(reduce: reduce))
        case .failure(let t):
            HStack(spacing: 4) {
                Image(systemName: "xmark.circle.fill").accessibilityHidden(true)
                Text(t)
            }
            .transition(ButtonMotion.swap(reduce: reduce))
        }
    }
}

// ---------- 不可恢复的删除：在原地展开确认 ----------
struct ConfirmDeleteButton: View {
    let symbol: String
    let label: String
    let confirmTitle: String
    var enabled = true
    var size: PillSize = .small
    @Binding var asking: Bool
    let action: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduce
    @State private var armed = false
    @State private var pressed = false
    @Namespace private var glassSpace
    private let cancelWidth: CGFloat = 52

    var body: some View {
        GlassGroup(spacing: 10) {
            HStack(spacing: asking ? size.gap : 0) {
                // 两个按钮一直都在，理由同任务按钮：玻璃容器里的子视图不能移除
                Button(role: asking ? .destructive : nil) {
                    if asking {
                        guard armed else { return }
                        asking = false
                        action()
                    } else {
                        asking = true
                    }
                } label: {
                    Group {
                        if asking {
                            Text(confirmTitle)
                                .font(size.font)
                                .foregroundStyle(Color.dangerInk)
                                .lineLimit(1)
                                .padding(.horizontal, size.padding)
                                .frame(minHeight: size.height)
                                .transition(ButtonMotion.swap(reduce: reduce))
                        } else {
                            Image(systemName: symbol)
                                .font(.system(size: size.height * 0.42, weight: .semibold))
                                .foregroundStyle(Color.primary)
                                .frame(width: size.height, height: size.height)
                                .transition(ButtonMotion.swap(reduce: reduce))
                        }
                    }
                    .contentShape(Capsule())
                    .glass(in: Capsule(), tint: asking ? .dangerSoft : nil, interactive: true, fallback: asking ? .dangerSoft : .pillNeutral(hover: false))
                    .glassID("main", in: glassSpace)
                }
                .buttonStyle(InnerPressStyle { pressed = $0 })
                .disabled(!enabled && !asking)
                .named(asking ? confirmTitle : label)
                .help(asking ? "" : label)

                Button {
                    if asking { asking = false }
                } label: {
                    Text("取消")
                        .font(size.font)
                        .foregroundStyle(Color.primary)
                        .lineLimit(1)
                        .opacity(asking ? 1 : 0)
                        .frame(width: asking ? cancelWidth : 0, height: size.height)
                        .contentShape(Capsule())
                        .glass(in: Capsule(), interactive: true, fallback: .pillNeutral(hover: false))
                        .glassID("cancel", in: glassSpace)
                }
                .buttonStyle(InnerPressStyle { pressed = $0 })
                .keyboardShortcut(asking ? .cancelAction : nil)
                .named(asking ? "取消" : "")
                .accessibilityHidden(!asking)
            }
        }
        .opacity(enabled || asking ? 1 : 0.45)
        .pressScale(pressed)
        .animation(ButtonMotion.state(reduce: reduce), value: asking)
        .task(id: asking) {
            armed = false
            guard asking else { return }
            try? await Task.sleep(for: ButtonMotion.confirmArm)
            if !Task.isCancelled { armed = true }
        }
    }
}

// ---------- 限时撤销：数字倒数，鼠标放上去就停。时间到了 ⌘Z 还能撤销 ----------
struct TimedUndoPill: View {
    let text: String
    var seconds = 8
    let undo: () -> Void
    let dismiss: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduce
    @State private var remaining: Int?
    @State private var hovering = false

    private var shown: Int { remaining ?? seconds }

    var body: some View {
        HStack(spacing: 10) {
            Text(text)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            Button(action: undo) {
                HStack(spacing: 6) {
                    Text("撤销")
                    Text("\(shown)")
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                        .frame(minWidth: 10)
                        .contentTransition(reduce ? .opacity : .numericText())
                        .animation(ButtonMotion.fade, value: shown)
                        .accessibilityHidden(true)
                }
            }
            .buttonStyle(.pill(.inset, size: .small))
            .named("撤销")
        }
        .padding(.leading, 14)
        .padding(.trailing, 5)
        .padding(.vertical, 5)
        .glass(in: Capsule())
        .fixedSize()
        .onHover { hovering = $0 }
        .task {
            remaining = seconds
            announceToVoiceOver("\(text)，可以撤销")
            while let left = remaining, left > 0 {
                try? await Task.sleep(for: .seconds(1))
                if Task.isCancelled { return }
                if !hovering { remaining = left - 1 }
            }
            dismiss()
        }
    }
}

extension View {
    /// 按钮按下时不画系统焦点环。macOS 13 没有这个开关
    @ViewBuilder func noFocusRing() -> some View {
        if #available(macOS 14, *) { focusEffectDisabled() } else { self }
    }
}

/// 让旁白读一句话。系统的新接口要 macOS 14，这个所有版本都有
func announceToVoiceOver(_ text: String) {
    guard let app = NSApp else { return }
    NSAccessibility.post(element: app, notification: .announcementRequested, userInfo: [.announcement: text, .priority: NSAccessibilityPriorityLevel.high.rawValue])
}
