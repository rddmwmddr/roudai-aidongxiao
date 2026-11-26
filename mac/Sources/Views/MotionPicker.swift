import SwiftUI

// 挑动效：左边分类，右边上面是预览，下面是缩略图。指到哪个就用这一镜自己的字演哪个，点一下换到画面上，弹层不关，可以一个个试
struct MotionButton: View {
    let shot: Shot
    @ObservedObject var stage: StageController
    let names: [String: String]
    var previousDataTemplate: String?
    /// 画面上的那个是玻璃；分镜表里每行一个，是内容，不用玻璃
    var floating = false
    let onPick: (Shot, Shot) -> Bool
    @State private var showing = false

    private var title: String {
        shot.isMotion ? (names[shot.template] ?? (shot.template.hasPrefix("local.") ? "本机模板未加载" : "重音字幕")) : "换成动效"
    }

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
        .popover(isPresented: $showing, arrowEdge: .leading) {
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
    let onPick: (Shot, Shot) -> Bool
    @State private var category = Self.suggested
    @State private var query = ""
    @State private var ranked: [RankedTemplate] = []
    @State private var hovered: String?
    @State private var requested: MotionInfo?
    @State private var status: String?
    @State private var designing = false
    @State private var lastSavedDesign: MotionDesigner.Target?
    @FocusState private var searching: Bool

    private static let suggested = "suggested"
    private static let all = "all"
    private let columns = Array(repeating: GridItem(.flexible(), spacing: 10), count: 3)

    private var previewed: MotionInfo? {
        let id = hovered ?? shot.template
        return stage.catalog.first { $0.id == id }
    }

    private var currentDesign: MotionDesigner.Target? {
        stage.catalog.first { $0.id == shot.template }.map { MotionDesigner.Target(id: $0.id, name: $0.name) }
    }

    private var items: [MotionInfo] {
        let q = query.trimmingCharacters(in: .whitespaces)
        if !q.isEmpty {
            return stage.catalog.filter { m in
                m.name.localizedCaseInsensitiveContains(q) || m.en.localizedCaseInsensitiveContains(q) || m.desc.contains(q) || m.keywords.contains { $0.localizedCaseInsensitiveContains(q) }
            }
        }
        if category == Self.suggested {
            let top = ranked.prefix(8).map(\.id)
            return top.compactMap { id in stage.catalog.first { $0.id == id } }
        }
        return category == Self.all ? stage.catalog : stage.catalog.filter { $0.category == category }
    }

    var body: some View {
        Group {
            if designing {
                MotionDesignerView(
                    current: lastSavedDesign ?? currentDesign,
                    continuing: lastSavedDesign != nil,
                    onBack: { designing = false },
                    onSave: { saved, created in
                        lastSavedDesign = saved
                        if created {
                            category = "local"
                            query = ""
                            hovered = nil
                        }
                    }
                )
                .id(shot.template)
            } else {
                browser
            }
        }
        .frame(width: 660, height: 620)
        .task(id: "\(stage.motionPackRevision)|\(shot.json)") { ranked = await stage.rank(shot, last: previousDataTemplate) }
        .task(id: requested?.id) {
            if let requested { await switchMotion(to: requested) }
        }
        .onChange(of: shot.id) { _ in
            requested = nil
            status = nil
            hovered = nil
            designing = false
            lastSavedDesign = nil
        }
        .onChange(of: shot.template) { _ in lastSavedDesign = nil }
    }

    private var browser: some View {
        VStack(spacing: 0) {
            HStack {
                TextField("搜索全部动效", text: $query)
                    .textFieldStyle(.plain)
                    .focused($searching)
                    .accessibilityLabel("搜索动效")
                Button {
                    if lastSavedDesign == nil, let currentDesign, MotionPackLibrary.shared.hasSavedDesign(currentDesign.id) {
                        lastSavedDesign = currentDesign
                    }
                    designing = true
                } label: {
                    Label("AI 做动效", systemImage: "sparkles")
                }
                .buttonStyle(.pill(size: .small))
                .disabled(requested != nil)
                .named("AI 做动效")
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            Divider()
            HStack(spacing: 0) {
                categories
                Divider()
                VStack(spacing: 0) {
                    MotionPreviewPane(shot: shot, item: previewed, stage: stage)
                    Divider()
                    if let requested {
                        HStack {
                            ProgressView().controlSize(.small)
                            Text(status ?? "正在切换到「\(requested.name)」…")
                            Spacer()
                            Button("取消切换") {
                                self.requested = nil
                                status = nil
                            }
                        }
                        .padding(10)
                    } else if let status {
                        Text(status)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(10)
                    } else if category == Self.suggested && query.isEmpty {
                        Text("这里是推荐。可在「全部动效」或其他分类里直接切换。")
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(10)
                    }
                    ScrollView {
                        LazyVGrid(columns: columns, spacing: 12) {
                            ForEach(items) { item in
                                MotionTile(item: item, selected: item.id == shot.template, stage: stage) {
                                    status = nil
                                    hovered = item.id
                                    requested = item
                                }
                                .disabled(requested != nil)
                                .onHover { inside in
                                    if inside && requested == nil { hovered = item.id }
                                }
                            }
                        }
                        .padding(12)
                    }
                }
            }
        }
    }

    private func switchMotion(to item: MotionInfo) async {
        let original = shot
        guard let local = await stage.adopt(original, template: item.id) else {
            if !Task.isCancelled {
                requested = nil
                status = "切换失败，请再试一次。"
            }
            return
        }
        guard !Task.isCancelled else { return }
        var next = local
        var message = "已切换到「\(item.name)」"
        if local.usesSampleData {
            let settings = AISettings.shared
            message = "已切换为样例。补好数据后，在检查器确认即可导出。"
            if let profile = settings.active {
                status = "正在准备使用 \(profile.name) 重做「\(item.name)」…"
                do {
                    let key = try settings.key(for: profile)
                    status = "正在用 \(profile.name) 为「\(item.name)」重做这一镜…"
                    let reply = try await stage.regenerateMotion(original, item: item, profile: profile, key: key) { reason in
                        status = "正在修正「\(item.name)」的数据。\(reason)"
                    }
                    if let generated = reply.row {
                        next = generated
                        message = "已用当前镜头的数据切换到「\(item.name)」"
                    } else if let error = reply.error {
                        message = "\(error)。\(message)"
                    }
                } catch {
                    message = "\(error.localizedDescription) \(message)"
                }
            }
        }
        guard !Task.isCancelled else { return }
        status = onPick(original, next) ? message : "这一镜刚被修改，请重新选择动效。"
        requested = nil
    }

    private var categories: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 2) {
                row("适合", Self.suggested)
                row("全部动效", Self.all)
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

    private struct PreviewKey: Hashable {
        let shot: Shot
        let template: String?
        let packRevision: Int
    }

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
        .task(id: PreviewKey(shot: shot, template: item?.id, packRevision: stage.motionPackRevision)) {
            clip = nil
            guard let id = item?.id else { return }
            // 鼠标扫过一排时不用每个都画
            try? await Task.sleep(for: .milliseconds(90))
            if Task.isCancelled { return }
            let next = await stage.preview(shot, template: id)
            if !Task.isCancelled { clip = next }
        }
    }
}

struct MotionFlipbook: View {
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
        .task(id: "\(stage.motionPackRevision)|\(item.id)") { image = await stage.thumbnail(item.id) }
    }
}
