import AppKit
import SwiftUI

// 窗口用系统的工具栏和检查器，那些玻璃是系统给的。这里放配色和自己画的玻璃件。
// 苹果的规矩：玻璃只给控件和导航这一层，画面、正文、表格是内容，不用玻璃；玻璃上不叠玻璃；挨着的玻璃放进一个容器。

extension Color {
    static let hairline = Color.primary.opacity(0.07)
    /// 面板里的条目
    static let well = Color.primary.opacity(0.045)
}

// ---------- 玻璃：macOS 26 起是系统的液态玻璃，更早的系统用材质 ----------
@available(macOS 26, *)
private func glassKind(_ tint: Color?, _ interactive: Bool) -> Glass {
    var kind = Glass.regular
    if let tint { kind = kind.tint(tint) }
    return interactive ? kind.interactive() : kind
}

extension View {
    /// 全 App 只有这一处用 glassEffect。fallback 是旧系统上的底色
    @ViewBuilder
    func glass<S: Shape>(in shape: S, tint: Color? = nil, interactive: Bool = false, fallback: Color? = nil) -> some View {
        if #available(macOS 26, *) {
            glassEffect(glassKind(tint, interactive), in: shape)
        } else if let fill = fallback ?? tint {
            background(fill, in: shape)
        } else {
            background(.regularMaterial, in: shape)
                .overlay(shape.stroke(Color.hairline))
        }
    }

    /// 同一个容器里，ID 相同的玻璃在状态变化时融合、分开
    @ViewBuilder
    func glassID(_ id: String, in space: Namespace.ID) -> some View {
        if #available(macOS 26, *) {
            glassEffectID(id, in: space)
        } else {
            self
        }
    }

    /// 玻璃按下时自己有反馈，旧系统才需要缩一下
    @ViewBuilder
    func pressScale(_ pressed: Bool) -> some View {
        if #available(macOS 26, *) {
            self
        } else {
            scaleEffect(pressed ? 0.96 : 1).animation(ButtonMotion.press, value: pressed)
        }
    }
}

/// 挨着的玻璃放进来，靠近时融在一起
struct GlassGroup<Content: View>: View {
    var spacing: CGFloat = 8
    @ViewBuilder let content: Content

    var body: some View {
        if #available(macOS 26, *) {
            GlassEffectContainer(spacing: spacing) { content }
        } else {
            content
        }
    }
}

// 检查器本身是玻璃，里面的分组不再叠玻璃，只给一块浅底
struct Card<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        content
            .background(Color.well, in: RoundedRectangle(cornerRadius: 12))
    }
}

// 带标题的分组：图标、标题，点标题折叠，下次打开还记得
struct SectionCard<Content: View>: View {
    let title: String
    let symbol: String
    var startsCollapsed = false
    @ViewBuilder let content: Content
    @AppStorage private var collapsed: Bool

    init(title: String, symbol: String, startsCollapsed: Bool = false, @ViewBuilder content: () -> Content) {
        self.title = title
        self.symbol = symbol
        self.startsCollapsed = startsCollapsed
        self.content = content()
        _collapsed = AppStorage(wrappedValue: startsCollapsed, "card.\(title)")
    }

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 0) {
                Button {
                    collapsed.toggle()
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "chevron.down")
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundStyle(.tertiary)
                            .rotationEffect(collapsed ? .degrees(-90) : .zero)
                            .frame(width: 12)
                        Image(systemName: symbol)
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                            .frame(width: 14)
                        Text(title)
                            .fontWeight(.medium)
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, 10)
                    .frame(height: 34)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .named("卡片\(title)")
                .accessibilityValue(collapsed ? "收起" : "展开")
                if !collapsed {
                    content
                        .padding(.horizontal, 12)
                        .padding(.bottom, 12)
                }
            }
        }
    }
}

// 工具栏里的搜索框。玻璃底是工具栏给的
struct SearchField: View {
    @Binding var text: String
    var focus: FocusState<Bool>.Binding

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
            TextField("搜索", text: $text)
                .textFieldStyle(.plain)
                .focused(focus)
                .accessibilityLabel("搜索镜头")
            if !text.isEmpty {
                Button {
                    text = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 12))
                        .foregroundStyle(.tertiary)
                }
                .buttonStyle(.plain)
                .named("清除搜索")
            }
        }
        .padding(.horizontal, 8)
        .frame(width: 190)
    }
}

// 要确认：全 App 只有这一个记号
struct ReviewDot: View {
    var body: some View {
        Circle()
            .fill(.orange)
            .frame(width: 6, height: 6)
            .alignmentGuide(.firstTextBaseline) { $0[.bottom] + 1 }
            .accessibilityLabel("要确认")
    }
}

// 新建文稿的首页：一百根竖条从左边亮起来，玻璃按钮压在上面。竖条是这个工具的招牌动效，也给玻璃东西可折射
struct CombBackdrop: View {
    @Environment(\.accessibilityReduceMotion) private var reduce
    @State private var lit = 0.0

    private static let orange = Color(light: 0xFF7A1F, dark: 0xFF8A33)

    var body: some View {
        GeometryReader { geo in
            let width = min(geo.size.width * 0.74, 1020)
            ZStack {
                CombBars(from: 0, to: 1).fill(Color.primary.opacity(0.08))
                CombBars(from: 0, to: lit).fill(Self.orange)
            }
            .frame(width: width, height: min(geo.size.height * 0.34, 220))
            .position(x: geo.size.width / 2, y: geo.size.height / 2)
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .onAppear {
            if reduce {
                lit = 0.62
            } else {
                withAnimation(.easeOut(duration: 1.2)) { lit = 0.62 }
            }
        }
    }
}

private struct CombBars: Shape {
    var from: Double
    var to: Double
    private let count = 100

    var animatableData: Double {
        get { to }
        set { to = newValue }
    }

    nonisolated func path(in rect: CGRect) -> Path {
        var p = Path()
        let pitch = rect.width / CGFloat(count)
        let bar = pitch * 0.58
        for i in 0..<count where Double(i) / Double(count) < to {
            p.addRoundedRect(in: CGRect(x: rect.minX + CGFloat(i) * pitch, y: rect.minY, width: bar, height: rect.height), cornerSize: CGSize(width: bar / 2, height: bar / 2))
        }
        return p
    }
}
