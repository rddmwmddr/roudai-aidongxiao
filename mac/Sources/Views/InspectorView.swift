import SwiftUI

// 系统检查器，只管这一镜：画面上的内容、口播、其余属性。动效在画面上选
struct InspectorView: View {
    @Binding var board: Board
    let selection: Shot.ID?
    @ObservedObject var stage: StageController
    let onNotice: (String) -> Void

    var body: some View {
        if let shot = board.rows.first(where: { $0.id == selection }) {
            // 按 ID 取，不按下标：镜头删掉后旧绑定还可能被读一次
            let id = shot.id
            ShotForm(
                shot: Binding(
                    get: { board.rows.first { $0.id == id } ?? shot },
                    set: { new in
                        if let i = board.rows.firstIndex(where: { $0.id == id }) { board.rows[i] = new }
                    }
                ),
                previousDataTemplate: board.rows.prefix { $0.id != id }.last { $0.fields["groups"] != nil }?.template,
                stage: stage,
                onNotice: onNotice
            )
            .id(id)
        } else {
            Color.clear
        }
    }
}

// 文字框：回车或离开时才写回文档。这样撤销一次是一处修改，而不是一个字
struct CommitField: View {
    let title: String
    @Binding var text: String
    var axis: Axis = .horizontal
    var lineLimit: ClosedRange<Int> = 1...1
    @State private var draft = ""
    @FocusState private var focused: Bool

    var body: some View {
        TextField(title, text: $draft, axis: axis)
            .lineLimit(lineLimit)
            .focused($focused)
            .accessibilityLabel(title)
            .onAppear { draft = text }
            .onChange(of: text) { v in
                if !focused { draft = v }
            }
            .onChange(of: focused) { f in
                if !f, draft != text { text = draft }
            }
            .onSubmit {
                if draft != text { text = draft }
                focused = false
            }
    }
}

struct NumberField: View {
    let title: String
    @Binding var value: Double?
    var prompt: String?
    var validate: (Double) -> Bool = { _ in true }
    @State private var draft = ""
    @FocusState private var focused: Bool

    private func show(_ v: Double?) -> String {
        guard let v else { return "" }
        return Int(exactly: v).map(String.init) ?? String(v)
    }

    private func commit() {
        let trimmed = draft.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty {
            if value != nil { value = nil }
        } else if let v = Double(trimmed), v.isFinite, validate(v) {
            if v != value { value = v }
        } else {
            draft = show(value)
        }
    }

    var body: some View {
        TextField(title, text: $draft, prompt: Text(prompt ?? title))
            .monospacedDigit()
            .focused($focused)
            .named(title)
            .onAppear { draft = show(value) }
            .onChange(of: value) { v in
                if !focused { draft = show(v) }
            }
            .onChange(of: focused) { f in
                if !f { commit() }
            }
            .onSubmit {
                commit()
                focused = false
            }
    }
}

// 一行属性：左边名字，右边值
struct PropertyRow<Content: View>: View {
    let name: String
    @ViewBuilder let content: Content

    init(_ name: String, @ViewBuilder content: () -> Content) {
        self.name = name
        self.content = content()
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(name)
                .foregroundStyle(.secondary)
                .frame(width: 32, alignment: .leading)
            content
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, 6)
        .overlay(alignment: .bottom) {
            Line()
                .stroke(Color.primary.opacity(0.16), style: StrokeStyle(lineWidth: 1, dash: [1, 3]))
                .frame(height: 1)
        }
    }
}

private struct Line: Shape {
    nonisolated func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.minX, y: rect.midY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
        return p
    }
}

// 卡片里的条目：一块浅灰的圆角
struct WellRow<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        content
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .background(Color.well, in: RoundedRectangle(cornerRadius: 7))
    }
}

// 添加一条：加号加一句话
struct AddRow: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Image(systemName: "plus").font(.system(size: 10, weight: .semibold))
                Text(title)
            }
            .foregroundStyle(.secondary)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .named(title)
    }
}

// 选一个值：平时就是一段字，点开才是菜单
struct ValueMenu<T: Hashable>: View {
    let name: String
    @Binding var value: T
    let options: [(T, String)]

    var body: some View {
        Menu(options.first { $0.0 == value }?.1 ?? "") {
            Picker(name, selection: $value) {
                ForEach(options, id: \.0) { Text($0.1).tag($0.0) }
            }
            .pickerStyle(.inline)
            .labelsHidden()
        }
        .menuStyle(.borderlessButton)
        .menuIndicator(.hidden)
        .fixedSize()
        .accessibilityLabel(name)
    }
}

struct ShotForm: View {
    @Binding var shot: Shot
    let previousDataTemplate: String?
    @ObservedObject var stage: StageController
    let onNotice: (String) -> Void
    @State private var natural: Double?
    @State private var dataIssue: String?
    @State private var checkingData = false
    @State private var sampleSizeInfo: SampleSizeInfo?

    private struct SampleSizeInfo: Decodable {
        let bound: Bool
        let detected: Int?
    }

    private var showsSampleSize: Bool {
        sampleSizeInfo?.bound == true || shot.fields["sampleSize"] != nil
    }

    private var naturalStamp: String {
        var plain = shot
        plain.duration = nil
        return "\(stage.motionPackRevision)|\(plain.json)"
    }

    private var rate: Binding<Double?> {
        Binding(get: {
            guard let natural, natural > 0, let dur = shot.duration, dur > 0 else { return nil }
            return (natural / dur * 100).rounded() / 100
        }, set: { value in
            guard let value, value > 0, let natural, natural > 0 else {
                shot.duration = nil
                return
            }
            shot.duration = (natural / min(8, max(0.125, value)) * 100).rounded() / 100
        })
    }

    private var names: [String: String] {
        Dictionary(uniqueKeysWithValues: stage.templates.map { ($0.id, $0.name) })
    }

    private var hasMotionConfig: Bool {
        shot.fields["motion"] != nil
    }

    private var hasLegacyData: Bool {
        !hasMotionConfig && ["groups", "series", "lines"].contains { shot.fields[$0] != nil }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 6) {
                if shot.isPending || dataIssue != nil {
                    Card { dataStatus.padding(12) }
                }
                if !shot.note.isEmpty && !shot.usesSampleData {
                    Card { noteRow.padding(12) }
                }
                if showsSampleSize || hasLegacyData {
                    SectionCard(title: "内容", symbol: "text.alignleft") {
                        VStack(alignment: .leading, spacing: 12) {
                            if showsSampleSize {
                                PropertyRow("样本") {
                                    NumberField(
                                        title: "样本人数", value: number("sampleSize"),
                                        prompt: sampleSizeInfo?.detected.map { "\($0)（口播识别）" } ?? "填写人数",
                                        validate: { $0 >= 1 && $0 <= 9_007_199_254_740_991 && $0.rounded() == $0 }
                                    )
                                }
                            }
                            if hasLegacyData {
                                if shot.fields["groups"] != nil { MetricsEditor(shot: $shot) }
                                if shot.fields["series"] != nil { SeriesEditor(shot: $shot) }
                                if shot.fields["lines"] != nil { LinesEditor(shot: $shot) }
                            }
                        }
                    }
                }
                if hasMotionConfig {
                    MotionConfigEditor(shot: $shot, stage: stage)
                }
                SectionCard(title: "口播", symbol: "waveform") {
                    CommitField(title: "口播", text: $shot.line, axis: .vertical, lineLimit: 1...12)
                }
                SectionCard(title: "属性", symbol: "slider.horizontal.3") {
                    properties
                }
                if !hasMotionConfig {
                    ColorRows(shot: $shot, stage: stage)
                    ExtraFields(shot: $shot)
                }
            }
            .padding(.horizontal, 8)
            .padding(.bottom, 8)
        }
        .scrollIndicators(.never)
        .textFieldStyle(.plain)
        .task(id: naturalStamp) {
            natural = (await stage.naturals([shot]))[shot.id]
        }
        .task(id: "\(stage.motionPackRevision)|\(shot.template)|\(shot.line)") {
            let json = try? await stage.callString("return DMBridge.sampleSizeInfo(id, line)", arguments: [
                "id": shot.template, "line": shot.line,
            ])
            if !Task.isCancelled {
                sampleSizeInfo = json.flatMap { try? JSONDecoder().decode(SampleSizeInfo.self, from: Data($0.utf8)) }
            }
        }
        .task(id: "\(stage.motionPackRevision)|\(shot.json)") {
            dataIssue = nil
            let original = shot
            guard !original.usesSampleData else { return }
            let issues = try? await stage.exportIssues([original])
            if !Task.isCancelled { dataIssue = issues?[original.id] }
        }
    }

    private var dataStatus: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(shot.usesSampleData ? "正在使用样例数据" : "第 \(shot.no) 镜的数据", systemImage: "exclamationmark.circle")
                .foregroundStyle(.orange)
            Text(dataIssue ?? (shot.usesSampleData
                ? "把下方的样例换成这一镜的真实数据，再确认导出。"
                : "补齐下方的动效数据，再确认导出。"))
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            if shot.isPending {
                Button(checkingData ? "正在检查…" : "确认当前数据，可导出") {
                    Task { await confirmData() }
                }
                .disabled(checkingData)
                .named("标记为已确认")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func confirmData() async {
        checkingData = true
        defer { checkingData = false }
        let original = shot
        do {
            let reply = try await stage.confirmMotionData(original)
            guard shot == original else { return }
            if let next = reply.row {
                shot = next
                dataIssue = nil
                onNotice("数据已确认，可以导出")
            } else {
                dataIssue = reply.error
            }
        } catch {
            if shot == original { dataIssue = "数据检查失败，请重试。" }
        }
    }

    private var noteRow: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            ReviewDot()
            Text(shot.note)
                .fixedSize(horizontal: false, vertical: true)
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button {
                shot.note = ""
                onNotice("已确认")
            } label: {
                Image(systemName: "checkmark")
            }
            .buttonStyle(.icon(diameter: 22))
            .named("标记为已确认")
            .help("标记为已确认")
        }
    }

    private var properties: some View {
        VStack(alignment: .leading, spacing: 0) {
            PropertyRow("章节") {
                CommitField(title: "章节", text: Binding(get: { shot.chapter }, set: { shot.chapter = $0 }))
            }
            PropertyRow("画面") {
                CommitField(title: "画面", text: $shot.visual, axis: .vertical, lineLimit: 1...6)
            }
            PropertyRow("时长") {
                NumberField(title: "这一镜的秒数", value: number("dur"), prompt: "自动")
            }
            // 速率和时长是一回事：2 是两倍快，时长变成一半。清空回到 1
            PropertyRow("速率") {
                NumberField(title: "动效速率", value: rate, prompt: "1")
            }
            PropertyRow("停留") {
                NumberField(title: "念完后停留的秒数", value: number("hold"), prompt: "自动")
            }
            PropertyRow("倍速") {
                NumberField(title: "口播倍速", value: number("speed"), prompt: "1")
            }
            PropertyRow("底色") {
                ValueMenu(name: "底色", value: Binding(get: { shot.fields["theme"]?.string ?? "" }, set: { shot.fields["theme"] = $0.isEmpty ? nil : .string($0) }), options: [("", "模板默认"), ("black", "黑底"), ("paper", "纸底")])
            }
        }
    }

    private func number(_ key: String) -> Binding<Double?> {
        Binding(get: { shot.fields[key]?.number }, set: { v in shot.fields[key] = v.map(JSONValue.number) })
    }
}

// 模板专用的数据（折线的点、方阵的分组）没有专门的控件，直接改 JSON，离开就生效
private struct ExtraFields: View {
    @Binding var shot: Shot
    @State private var draft = ""
    @State private var loaded = ""
    @State private var problem: String?
    @FocusState private var focused: Bool

    private static let knownKeys: Set<String> = ["id", "no", "ch", "kind", "cat", "line", "visual", "tpl", "note", "pending", "sampleData", "sampleBackup", "groups", "series", "lines", "layers", "overlayText", "sampleSize", "speed", "hold", "dur", "theme"]

    private var hasExtra: Bool {
        shot.fields.keys.contains { !Self.knownKeys.contains($0) }
    }

    var body: some View {
        if hasExtra {
            SectionCard(title: "其他字段", symbol: "curlybraces", startsCollapsed: !shot.isPending) {
                VStack(alignment: .leading, spacing: 6) {
                    TextEditor(text: $draft)
                        .font(.system(.footnote, design: .monospaced))
                        .scrollContentBackground(.hidden)
                        .frame(minHeight: 160)
                        .focused($focused)
                        .accessibilityLabel("其他字段")
                    if let problem {
                        Label(problem, systemImage: "exclamationmark.circle")
                            .foregroundStyle(.red)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            .onDisappear(perform: apply)
            .onChange(of: focused) { f in
                if !f { apply() }
            }
            // 打开时读一次，换效果后再读。onChange 的闭包拿到的是上一次的镜头，这里用 task
            .task(id: shot.template) { load() }
        }
    }

    private func load() {
        let extra = shot.fields.filter { !Self.knownKeys.contains($0.key) }
        let e = JSONEncoder()
        e.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        draft = (try? e.encode(extra)).map { String(decoding: $0, as: UTF8.self) } ?? "{}"
        loaded = draft
        problem = nil
    }

    private func apply() {
        guard draft != loaded else { return }
        guard let value = try? JSONDecoder().decode([String: JSONValue].self, from: Data(draft.utf8)) else {
            problem = "不是合法的 JSON"
            return
        }
        problem = nil
        loaded = draft
        for key in shot.fields.keys where !Self.knownKeys.contains(key) {
            shot.fields[key] = nil
        }
        for (k, v) in value where !Self.knownKeys.contains(k) {
            shot.fields[k] = v
        }
    }
}

// 百分比数据：一行一个数，数字在前，说明在后
struct MetricsEditor: View {
    @Binding var shot: Shot

    private static let relations: [(String, String)] = [("single", "单个"), ("nested", "包含"), ("opposing", "相反两拨"), ("parallel", "并列"), ("chain", "这其中（基数变了）")]

    var body: some View {
        let groups = shot.groups
        ForEach(groups.indices, id: \.self) { gi in
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    CommitField(title: "标题", text: groupBinding(gi, \.title))
                    groupMenu(gi, count: groups.count)
                }
                ForEach(groups[gi].metrics.indices, id: \.self) { mi in
                    MetricRow(
                        value: metricBinding(gi, mi, \.value),
                        caption: metricBinding(gi, mi, \.caption),
                        prefix: metricBinding(gi, mi, \.prefix),
                        emphasis: metricBinding(gi, mi, \.emphasis),
                        onDelete: {
                            var g = shot.groups
                            g[gi].metrics.remove(at: mi)
                            shot.groups = g
                        }
                    )
                }
                AddRow(title: "添加一个数") {
                    var g = shot.groups
                    g[gi].metrics.append(Metric(json: .object(["caption": .string(""), "value": .number(50)])))
                    shot.groups = g
                }
            }
        }
    }

    private func groupMenu(_ gi: Int, count: Int) -> some View {
        Menu {
            Picker("几个数的关系", selection: groupBinding(gi, \.relation)) {
                ForEach(Self.relations, id: \.0) { r in Text(r.1).tag(r.0) }
            }
            .pickerStyle(.inline)
            .labelsHidden()
            Divider()
            Button("添加一组") {
                var g = shot.groups
                g.append(MetricGroup(json: .object(["title": .string(""), "relation": .string("single"), "metrics": .array([.object(["caption": .string(""), "value": .number(50)])])])))
                shot.groups = g
            }
            if count > 1 {
                Button("删掉这一组", role: .destructive) {
                    var g = shot.groups
                    g.remove(at: gi)
                    shot.groups = g
                }
            }
        } label: {
            Text(Self.relations.first { $0.0 == shot.groups[gi].relation }?.1 ?? "单个")
        }
        .menuStyle(.borderlessButton)
        .menuIndicator(.hidden)
        .fixedSize()
        .accessibilityLabel("几个数的关系")
    }

    private func groupBinding<T>(_ gi: Int, _ path: WritableKeyPath<MetricGroup, T>) -> Binding<T> {
        Binding(get: { shot.groups[gi][keyPath: path] }, set: { v in
            var g = shot.groups
            g[gi][keyPath: path] = v
            shot.groups = g
        })
    }

    private func metricBinding<T>(_ gi: Int, _ mi: Int, _ path: WritableKeyPath<Metric, T>) -> Binding<T> {
        Binding(get: { shot.groups[gi].metrics[mi][keyPath: path] }, set: { v in
            var g = shot.groups
            g[gi].metrics[mi][keyPath: path] = v
            shot.groups = g
        })
    }
}

private struct MetricRow: View {
    @Binding var value: Double?
    @Binding var caption: String
    @Binding var prefix: String
    @Binding var emphasis: Bool
    let onDelete: () -> Void
    @State private var showingMore = false

    var body: some View {
        WellRow {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            NumberField(title: "数值", value: $value, prompt: "待填")
                .frame(width: 34)
            CommitField(title: "说明", text: $caption, axis: .vertical, lineLimit: 1...4)
            Button {
                showingMore.toggle()
            } label: {
                Image(systemName: "ellipsis")
            }
            .buttonStyle(.icon(diameter: 22, faint: true))
            .named("这个数的更多设置")
            .help("更多")
            .popover(isPresented: $showingMore, arrowEdge: .trailing) {
                VStack(alignment: .leading, spacing: 10) {
                    PropertyRow("前缀") {
                        CommitField(title: "前缀", text: $prefix)
                    }
                    .textFieldStyle(.plain)
                    Toggle("落定后其他元素退后", isOn: $emphasis)
                        .toggleStyle(.switch)
                        .controlSize(.small)
                    Button("删掉这个数", role: .destructive) {
                        showingMore = false
                        onDelete()
                    }
                    .buttonStyle(.pill(size: .small))
                }
                .padding(14)
                .frame(width: 240)
            }
        }
        }
    }
}

// 图表的数据：一行一个数，和百分比的写法一样，单位写在第一行
struct SeriesEditor: View {
    @Binding var shot: Shot

    private var rows: [[String: JSONValue]] {
        shot.fields["series"]?.array?.compactMap(\.object) ?? []
    }

    private func write(_ rows: [[String: JSONValue]]) {
        shot.fields["series"] = .array(rows.map(JSONValue.object))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            let list = rows
            PropertyRow("单位") {
                CommitField(title: "单位", text: Binding(get: { shot.fields["unit"]?.string ?? "" }, set: { shot.fields["unit"] = .string($0) }))
            }
            ForEach(list.indices, id: \.self) { i in
                WellRow {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    NumberField(title: "数值", value: Binding(get: { rows.indices.contains(i) ? rows[i]["value"]?.number : nil }, set: { v in
                        var r = rows
                        if r.indices.contains(i) { r[i]["value"] = v.map(JSONValue.number) ?? .null }
                        write(r)
                    }), prompt: "待填")
                    .frame(width: 34)
                    CommitField(title: "名称", text: Binding(get: { rows.indices.contains(i) ? rows[i]["label"]?.string ?? "" : "" }, set: { v in
                        var r = rows
                        if r.indices.contains(i) { r[i]["label"] = .string(v) }
                        write(r)
                    }), axis: .vertical, lineLimit: 1...2)
                    Button {
                        var r = rows
                        r.remove(at: i)
                        write(r)
                    } label: {
                        Image(systemName: "minus")
                    }
                    .buttonStyle(.icon(diameter: 22, faint: true))
                    .named("删掉第 \(i + 1) 个数")
                    .help("删掉这个数")
                }
                }
            }
            AddRow(title: "添加一个数值") {
                write(rows + [["label": .string(""), "value": .number(50)]])
            }
        }
    }
}

// 上屏文字：一行一句
struct LinesEditor: View {
    @Binding var shot: Shot

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            let lines = shot.lines
            ForEach(lines.indices, id: \.self) { i in
                WellRow {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    CommitField(title: "第 \(i + 1) 句", text: Binding(get: { shot.lines.indices.contains(i) ? shot.lines[i] : "" }, set: { v in
                        var l = shot.lines
                        if l.indices.contains(i) { l[i] = v }
                        shot.lines = l
                    }), axis: .vertical, lineLimit: 1...3)
                    Button {
                        var l = shot.lines
                        l.remove(at: i)
                        shot.lines = l
                    } label: {
                        Image(systemName: "minus")
                    }
                    .buttonStyle(.icon(diameter: 22, faint: true))
                    .named("删掉第 \(i + 1) 句")
                    .help("删掉这一句")
                }
                }
            }
            AddRow(title: "添加一句") {
                shot.lines = shot.lines + ["新的一句"]
            }
        }
    }
}

// 这一镜能换的颜色：组件、CSS 动效、数据模板各自声明。改了写进 colors，右键恢复默认。
// 取色盘拖动时一直在变，停下来再写进文档，撤销一次回到改之前
private struct ColorRows: View {
    @Binding var shot: Shot
    @ObservedObject var stage: StageController
    @State private var roles: [ColorRole] = []
    @State private var pending: [String: String] = [:]

    private var stamp: String {
        "\(shot.template)|\(shot.fields["theme"]?.string ?? "")|\(shot.fields["colors"].map { "\($0)" } ?? "")"
    }

    var body: some View {
        // 外层一直在：没有颜色时这里是空的，读颜色的任务也要能跑
        VStack(alignment: .leading, spacing: 0) {
            if !roles.isEmpty {
                SectionCard(title: "颜色", symbol: "paintpalette") {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(roles) { role in
                            PropertyRow(role.name) {
                                HStack {
                                    ColorPicker(role.name, selection: binding(role), supportsOpacity: false)
                                        .labelsHidden()
                                        .named("颜色\(role.name)")
                                    Spacer(minLength: 0)
                                }
                                // 色块没有文字基线，和左边的名字按中线对齐
                                .alignmentGuide(.firstTextBaseline) { d in d[VerticalAlignment.center] + 5 }
                                .contextMenu {
                                    if role.custom { Button("恢复默认") { write(role.key, nil) } }
                                }
                            }
                        }
                    }
                }
            }
        }
        .task(id: "\(stage.motionPackRevision)|\(stamp)") { roles = await stage.colorRoles(shot) }
        .task(id: pending) {
            guard !pending.isEmpty else { return }
            try? await Task.sleep(for: .milliseconds(350))
            if Task.isCancelled { return }
            let next = pending
            pending = [:]
            var colors = shot.fields["colors"]?.object ?? [:]
            for (key, hex) in next { colors[key] = .string(hex) }
            shot.fields["colors"] = .object(colors)
        }
    }

    private func binding(_ role: ColorRole) -> Binding<Color> {
        Binding(get: { Color(hexString: pending[role.key] ?? role.value) }, set: { pending[role.key] = $0.hexString })
    }

    private func write(_ key: String, _ hex: String?) {
        var colors = shot.fields["colors"]?.object ?? [:]
        colors[key] = hex.map(JSONValue.string)
        shot.fields["colors"] = colors.isEmpty ? nil : .object(colors)
    }
}

extension Color {
    init(hexString: String) {
        let digits = hexString.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let v = UInt32(digits, radix: 16) ?? 0
        self.init(.sRGB, red: Double((v >> 16) & 0xFF) / 255, green: Double((v >> 8) & 0xFF) / 255, blue: Double(v & 0xFF) / 255)
    }

    var hexString: String {
        let c = NSColor(self).usingColorSpace(.sRGB) ?? .black
        let r = Int((c.redComponent * 255).rounded())
        let g = Int((c.greenComponent * 255).rounded())
        let b = Int((c.blueComponent * 255).rounded())
        return String(format: "#%02X%02X%02X", min(max(r, 0), 255), min(max(g, 0), 255), min(max(b, 0), 255))
    }
}
