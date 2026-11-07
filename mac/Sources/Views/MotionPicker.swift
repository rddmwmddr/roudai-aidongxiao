import SwiftUI

// 挑动效：左边分类，右边上面是预览，下面是缩略图。指到哪个就用这一镜自己的字演哪个，点一下换到画面上，弹层不关，可以一个个试
struct MotionButton: View {
    let shot: Shot
    @ObservedObject var stage: StageController
    let names: [String: String]
    var previousDataTemplate: String?
    /// 画面上的那个是玻璃；分镜表里每行一个，是内容，不用玻璃
    var floating = false
    let onPick: (Shot) -> Void
    @State private var showing = false

    private var title: String { names[shot.template] ?? "重音字幕" }

    var body: some View {
        Button {
            showing.toggle()
        } label: {
            HStack(spacing: 5) {
                Image(systemName: "sparkles")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                Text(title).fontWeight(.medium).lineLimit(1)
                Image(systemName: "chevron.down")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, floating ? 12 : 0)
            .frame(height: floating ? 30 : nil)
            .contentShape(Rectangle())
            .modifier(FloatingGlass(on: floating))
        }
        .buttonStyle(.plain)
        .named("动效")
        .accessibilityValue(title)
        .popover(isPresented: $showing, arrowEdge: .bottom) {
            MotionPicker(shot: shot, stage: stage, previousDataTemplate: previousDataTemplate, onPick: onPick)
        }
    }
}

private struct FloatingGlass: ViewModifier {
    let on: Bool

    @ViewBuilder
    func body(content: Content) -> some View {
        if on {
            content.glass(in: Capsule(), interactive: true)
        } else {
            content
        }
    }
}

struct MotionPicker: View {
    let shot: Shot
    @ObservedObject var stage: StageController
    let previousDataTemplate: String?
    let onPick: (Shot) -> Void
    @State private var category = Self.suggested
    @State private var query = ""
    @State private var ranked: [RankedTemplate] = []
    @State private var hovered: String?
    @FocusState private var searching: Bool

    private static let suggested = "suggested"
    private let columns = Array(repeating: GridItem(.flexible(), spacing: 10), count: 3)

    private var previewed: MotionInfo? {
        let id = hovered ?? shot.template
        return stage.catalog.first { $0.id == id }
    }

    private var items: [MotionInfo] {
        let q = query.trimmingCharacters(in: .whitespaces)
        if !q.isEmpty {
            return stage.catalog.filter { m in
                m.name.localizedCaseInsensitiveContains(q) || m.en.localizedCaseInsensitiveContains(q) || m.desc.contains(q) || m.keywords.contains { $0.contains(q) }
            }
        }
        if category == Self.suggested {
            let top = ranked.prefix(8).map(\.id)
            return top.compactMap { id in stage.catalog.first { $0.id == id } }
        }
        return stage.catalog.filter { $0.category == category }
    }

    var body: some View {
        VStack(spacing: 0) {
            TextField("搜索", text: $query)
                .textFieldStyle(.plain)
                .focused($searching)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .accessibilityLabel("搜索动效")
            Divider()
            HStack(spacing: 0) {
                categories
                Divider()
                VStack(spacing: 0) {
                    MotionPreviewPane(shot: shot, item: previewed, stage: stage)
                    Divider()
                    ScrollView {
                        LazyVGrid(columns: columns, spacing: 12) {
                            ForEach(items) { item in
                                MotionTile(item: item, selected: item.id == shot.template, stage: stage) {
                                    Task {
                                        if let next = await stage.adopt(shot, template: item.id) { onPick(next) }
                                    }
                                }
                                .onHover { inside in
                                    if inside { hovered = item.id }
                                }
                            }
                        }
                        .padding(12)
                    }
                }
            }
        }
        .frame(width: 660, height: 620)
        .task { ranked = await stage.rank(shot, last: previousDataTemplate) }
    }

    private var categories: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 2) {
                row("适合", Self.suggested)
                ForEach(stage.categories) { c in
                    row(c.name, c.id)
                }
            }
            .padding(8)
        }
        .frame(width: 92)
    }

    private func row(_ name: String, _ id: String) -> some View {
        Button {
            query = ""
            category = id
        } label: {
            Text(name)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 8)
                .padding(.vertical, 5)
                .background(category == id && query.isEmpty ? Color.pillNeutral(hover: false) : .clear, in: RoundedRectangle(cornerRadius: 6))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(category == id && query.isEmpty ? .primary : .secondary)
        .named("分类\(name)")
    }
}

// 预览：一段几十张的图轮着放，比渲染页单独再开一个轻得多。系统设了减弱动态就停在结尾
private struct MotionPreviewPane: View {
    let shot: Shot
    let item: MotionInfo?
    @ObservedObject var stage: StageController
    @State private var clip: MotionPreviewClip?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            ZStack {
                Rectangle().fill(.black)
                if let clip {
                    MotionFlipbook(clip: clip, still: reduceMotion)
                        .named("预览画面")
                }
            }
            .aspectRatio(16 / 9, contentMode: .fit)
            .frame(height: 176)
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text(item?.name ?? "")
                    .font(.system(size: 15, weight: .semibold))
                    .lineLimit(2)
                Text(item?.desc ?? "")
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .lineLimit(5)
                if clip?.sample == true {
                    Text("样例数据")
                        .font(.system(size: 11))
                        .foregroundStyle(.orange)
                        .padding(.top, 2)
                }
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(12)
        .frame(height: 200)
        .task(id: item?.id) {
            guard let id = item?.id else { return }
            // 鼠标扫过一排时不用每个都画
            try? await Task.sleep(for: .milliseconds(90))
            if Task.isCancelled { return }
            let next = await stage.preview(shot, template: id)
            if !Task.isCancelled { clip = next }
        }
    }
}

private struct MotionFlipbook: View {
    let clip: MotionPreviewClip
    let still: Bool

    var body: some View {
        if still {
            frame(clip.frames.count - 1)
        } else {
            let fps = Double(clip.frames.count) / max(0.5, clip.seconds)
            TimelineView(.periodic(from: .now, by: 1 / fps)) { context in
                frame(Int(context.date.timeIntervalSinceReferenceDate * fps) % clip.frames.count)
            }
        }
    }

    private func frame(_ index: Int) -> some View {
        Image(nsImage: clip.frames[index])
            .resizable()
            .aspectRatio(16 / 9, contentMode: .fit)
    }
}

private struct MotionTile: View {
    let item: MotionInfo
    let selected: Bool
    @ObservedObject var stage: StageController
    let action: () -> Void
    @State private var image: NSImage?

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 5) {
                ZStack {
                    Rectangle().fill(.black)
                    if let image {
                        Image(nsImage: image)
                            .resizable()
                            .aspectRatio(16 / 9, contentMode: .fit)
                    }
                }
                .aspectRatio(16 / 9, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 4))
                .overlay {
                    if selected {
                        RoundedRectangle(cornerRadius: 4).strokeBorder(Color.lime, lineWidth: 2)
                    }
                }
                Text(item.name)
                    .lineLimit(1)
                    .foregroundStyle(selected ? .primary : .secondary)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .named(item.name)
        .help(item.desc)
        .task(id: item.id) { image = await stage.thumbnail(item.id) }
    }
}
