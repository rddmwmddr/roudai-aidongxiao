import AppKit
import SwiftUI
import UniformTypeIdentifiers

// The inspector edits the same versioned JSON that AI receives. Invalid edits never replace a valid shot.
struct MotionConfigEditor: View {
    @Binding var shot: Shot
    let stage: StageController
    @State private var draft: [String: JSONValue] = [:]
    @State private var problem: String?
    @State private var revision = 0
    @State private var csvDraft = ""
    @State private var paperText = ""
    @State private var lastWritten: JSONValue?
    @State private var table: [[String]] = []

    private func json(_ value: [String: JSONValue]) -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        return (try? encoder.encode(value)).map { String(decoding: $0, as: UTF8.self) } ?? "{}"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let problem {
                Label(problem, systemImage: "exclamationmark.circle")
                    .foregroundStyle(.red)
                    .font(.footnote)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityLabel("数据动效参数错误")
            }
            if !draft.isEmpty {
                MotionMediaEditor(config: draft, stage: stage, apply: apply)
                if shot.template == "magazine-letters" {
                    SectionCard(title: "整句生成字片", symbol: "textformat") {
                        CommitField(title: "剪字文案", text: $paperText, axis: .vertical, lineLimit: 1...4)
                        Button("按文字更新字片") { updateLetters() }.buttonStyle(.pill(size: .small))
                        Text("下方表格可逐字编辑文字、字体、底色、文字色及倾斜角度。font 可填 local-gothic / system-serif / system-sans。")
                            .font(.footnote).foregroundStyle(.secondary)
                    }
                }
                if shot.template == "text-match-cut" {
                    SectionCard(title: "报道截图与词句对齐", symbol: "doc.text.viewfinder") {
                        Text("可导入自己的报道截图，再拖动框选原文中的词句。图片文字由素材保留，框选区域会在切换时居中匹配；未导入截图的页使用下方文字排版。")
                            .font(.footnote).foregroundStyle(.secondary)
                        ForEach((draft["data"]?.object?["pages"]?.array ?? []).indices, id: \.self) { i in
                            Button("导入第\(i+1)页报道截图") { importMedia(side: "article:\(i)") }.buttonStyle(.pill(size: .small))
                            if let page = draft["data"]?.object?["pages"]?.array?[i].object, let src = page["image"]?.string, !src.isEmpty {
                                PaperArticleCropView(source: src, focus: ["focusX", "focusY", "focusWidth", "focusHeight"].map { page[$0]?.number ?? 0.1 }) { values in
                                    var next = draft, data = next["data"]?.object ?? [:], pages = data["pages"]?.array ?? [], page = pages[i].object ?? [:]
                                    for (j,key) in ["focusX", "focusY", "focusWidth", "focusHeight"].enumerated() { page[key] = .number(values[j]) }
                                    pages[i] = .object(page); data["pages"] = .array(pages); next["data"] = .object(data); apply(next)
                                }
                            }
                        }
                    }
                }
                if shot.template == "paper-cutout" {
                    SectionCard(title: "可替换的剪贴素材", symbol: "photo") {
                        Button("导入或替换图片 / 透明 PNG") { importMedia(side: "paper") }.buttonStyle(.pill(size: .small))
                        Text("素材内嵌到工程；支持 PNG / JPEG / WebP，透明通道保留。关闭纸张衬底可展示透明素材。")
                            .font(.footnote).foregroundStyle(.secondary)
                    }
                }
                SectionCard(title: "数据表格", symbol: "tablecells") {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("表头决定字段；数字只填数值，单位在样式中设置。")
                            .font(.footnote).foregroundStyle(.secondary)
                        ScrollView(.horizontal) {
                            VStack(alignment: .leading, spacing: 4) {
                                ForEach(table.indices, id: \.self) { i in
                                    HStack(spacing: 6) {
                                        ForEach(table[i].indices, id: \.self) { j in
                                            if i == 0 {
                                                Text(table[i][j]).font(.footnote.weight(.semibold)).frame(width: 130, alignment: .leading)
                                            } else if ["src", "image"].contains(table[0][j]) {
                                                Text(table[i][j].isEmpty ? "未导入" : "已内嵌素材").font(.footnote).frame(width: 130)
                                            } else {
                                                CommitField(title: "第\(i)行 \(table[0][j])", text: Binding(get: { table.indices.contains(i) && table[i].indices.contains(j) ? table[i][j] : "" }, set: { v in
                                                    guard table.indices.contains(i), table[i].indices.contains(j) else { return }
                                                    table[i][j] = v
                                                    applyTable()
                                                }), axis: .vertical, lineLimit: 1...5)
                                                .frame(width: 130)
                                                .padding(4).background(Color.well, in: RoundedRectangle(cornerRadius: 4))
                                            }
                                        }
                                        if i > 0 {
                                            Button { table.remove(at: i); applyTable() } label: { Image(systemName: "minus.circle") }
                                                .buttonStyle(.plain).help("删除第\(i)行")
                                        }
                                    }
                                }
                            }
                        }
                        HStack {
                            Button("添加一行") {
                                guard let header = table.first else { return }
                                if ["text-match-cut", "paper-cutout", "paper-unfold", "magazine-letters"].contains(shot.template), let last = table.last, table.count > 1 {
                                    table.append(last.enumerated().map { j, value in ["text", "heading", "before", "after", "body", "label", "caption"].contains(header[j]) ? (header[j] == "text" ? "字" : "新内容") : value })
                                    applyTable()
                                    return
                                }
                                table.append(header.map { ["value", "before", "after", "count", "marked", "progress"].contains($0) ? "0" : "" })
                            }
                            Button("导入 CSV") { importCSV() }
                        }.buttonStyle(.pill(size: .small))
                        DisclosureGroup("粘贴表格 / CSV") {
                            TextEditor(text: $csvDraft).font(.system(.footnote, design: .monospaced)).frame(minHeight: 140).accessibilityLabel("粘贴 CSV 或表格")
                            Button("应用粘贴数据") { importText(csvDraft) }.buttonStyle(.pill(size: .small))
                        }
                    }
                }
                if shot.template == "split-compare" {
                    SectionCard(title: "本地素材", symbol: "photo.on.rectangle") {
                        HStack {
                            Button("左侧图片或视频") { importMedia(side: "left") }
                            Button("右侧图片或视频") { importMedia(side: "right") }
                        }.buttonStyle(.pill(size: .small))
                    }
                }
                if draft["templateId"]?.string == "product-scene-focus" {
                    Button("替换场景为本地图片") { importMedia(side: "asset") }.buttonStyle(.pill(size: .small))
                }
                if shot.template == "timeline-ruler" {
                    SectionCard(title: "事件图片", symbol: "photo") {
                        ForEach((draft["data"]?.object?["events"]?.array ?? []).indices, id: \.self) { i in
                            Button("导入第\(i + 1)个事件的图片") { importMedia(side: "event:\(i)") }.buttonStyle(.pill(size: .small))
                        }
                    }
                }
                if draft["templateId"]?.string == "kinetic-narration" {
                    Button("导入带时间戳字幕 SRT / VTT") { importSubtitles() }.buttonStyle(.pill(size: .small))
                }
                if let sequence = draft["sequence"]?.array, !sequence.isEmpty {
                    SectionCard(title: "预设阶段与顺序", symbol: "list.number") {
                        ForEach(sequence.indices, id: \.self) { i in
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Text(sequence[i].object?["phase"]?.string ?? "阶段")
                                    Spacer()
                                    Button("上移") { movePhase(i, -1) }.disabled(i == 0)
                                    Button("下移") { movePhase(i, 1) }.disabled(i == sequence.count - 1)
                                }.buttonStyle(.pill(size: .small))
                                NumberField(title: "阶段持续秒数", value: Binding(get: { sequence[i].object?["duration"]?.number }, set: { value in
                                    guard let value else { return }
                                    var next = draft, phases = sequence, phase = phases[i].object ?? [:]
                                    phase["duration"] = .number(value); phases[i] = .object(phase)
                                    next["sequence"] = .array(phases)
                                    var timeline = next["timeline"]?.object ?? [:]
                                    timeline["duration"] = .number(phases.reduce(0) { $0 + ($1.object?["duration"]?.number ?? 0) })
                                    next["timeline"] = .object(timeline); apply(next)
                                }))
                            }
                        }
                    }
                }
                ForEach(["metadata", "style", "timeline", "output", "fieldMappings", "options", "camera"], id: \.self) { section in
                    if let values = draft[section]?.object, !values.isEmpty {
                        SectionCard(title: Self.labels[section] ?? section, symbol: "slider.horizontal.3") {
                            MotionObjectFields(values: values) { key, value in
                                var object = draft[section]?.object ?? [:]
                                object[key] = value
                                var candidate = draft
                                candidate[section] = .object(object)
                                // Changing duration also clamps the saved cursor.
                                if section == "timeline", key == "duration", let duration = value.number {
                                    object["currentTime"] = .number(min(object["currentTime"]?.number ?? 0, duration))
                                    candidate[section] = .object(object)
                                }
                                apply(candidate)
                            }
                            if section == "timeline" {
                                Button("记住当前播放位置") {
                                    var next = draft, timeline = next["timeline"]?.object ?? [:]
                                    timeline["currentTime"] = .number(min(stage.time, timeline["duration"]?.number ?? stage.time))
                                    next["timeline"] = .object(timeline); apply(next)
                                }.buttonStyle(.pill(size: .small))
                            }
                        }
                    }
                }
                SectionCard(title: "AI 配置与原始数据", symbol: "curlybraces", startsCollapsed: true) {
                    MotionJSONField(value: .object(draft)) { value in
                        if let object = value.object { apply(object) }
                    }
                    Button("复制完整配置") {
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString(json(draft), forType: .string)
                    }.buttonStyle(.pill(size: .small))
                    Toggle("标为演示数据", isOn: Binding(get: { draft["demo"]?.bool ?? true }, set: { v in var next = draft; next["demo"] = .bool(v); apply(next) }))
                }
            }
        }
        .task(id: shot.template) { await load() }
        .onChange(of: shot.fields["motion"]) { value in
            if value != lastWritten { Task { await load() } }
        }
        .onChange(of: shot.duration) { _ in Task { await load() } }
    }

    private func load() async {
        do {
            let text = try await stage.callString("return DMBridge.motionConfig(json)", arguments: ["json": shot.json])
            draft = try JSONDecoder().decode([String: JSONValue].self, from: Data(text.utf8))
            if shot.template == "magazine-letters" { paperText = (draft["data"]?.object?["letters"]?.array ?? []).compactMap { $0.object?["text"]?.string }.joined() }
            lastWritten = shot.fields["motion"]
            await refreshTable()
        } catch { problem = BatchRunner.describe(error) }
    }

    private func refreshTable() async {
        do {
            csvDraft = try await stage.callString("return DMBridge.motionCSV(json)", arguments: ["json": json(draft)])
            let value = try await stage.callString("return JSON.stringify(DMOpus.table(JSON.parse(json)).map(r=>r.map(v=>String(v))))", arguments: ["json": json(draft)])
            table = try JSONDecoder().decode([[String]].self, from: Data(value.utf8))
        } catch { problem = BatchRunner.describe(error) }
    }

    private func apply(_ candidate: [String: JSONValue]) {
        draft = candidate
        revision += 1
        let stamp = revision, id = shot.id, payload = json(candidate)
        Task {
            do {
                let validated = try await stage.callString("return DMBridge.validateMotion(json)", arguments: ["json": payload])
                guard revision == stamp, shot.id == id else { return }
                let value = try JSONDecoder().decode(JSONValue.self, from: Data(validated.utf8))
                lastWritten = value
                shot.fields["motion"] = value
                shot.fields["dur"] = nil
                shot.fields["sampleData"] = nil
                shot.fields["pending"] = nil
                problem = nil
                await refreshTable()
            } catch { if revision == stamp { problem = BatchRunner.describe(error) } }
        }
    }

    private func applyTable() {
        importText(table.map { $0.map { "\"" + $0.replacingOccurrences(of: "\"", with: "\"\"") + "\"" }.joined(separator: ",") }.joined(separator: "\n"))
    }

    private func importText(_ text: String) {
        let payload = json(draft)
        Task {
            do {
                let output = try await stage.callString("return DMBridge.importMotionCSV(json, csv)", arguments: ["json": payload, "csv": text])
                let value = try JSONDecoder().decode([String: JSONValue].self, from: Data(output.utf8))
                apply(value)
            } catch { problem = BatchRunner.describe(error) }
        }
    }

    private func movePhase(_ index: Int, _ direction: Int) {
        guard var phases = draft["sequence"]?.array, phases.indices.contains(index + direction) else { return }
        phases.swapAt(index, index + direction)
        var next = draft; next["sequence"] = .array(phases); apply(next)
    }

    private func importCSV() {
        let panel = NSOpenPanel(); panel.allowedContentTypes = [.commaSeparatedText, .tabSeparatedText, .plainText]
        guard panel.runModal() == .OK, let url = panel.url else { return }
        let scoped = url.startAccessingSecurityScopedResource(); defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        do { importText(try String(contentsOf: url, encoding: .utf8)) } catch { problem = error.localizedDescription }
    }

    private func importMedia(side: String) {
        let panel = NSOpenPanel(); panel.allowedContentTypes = (side.hasPrefix("event:") || side == "asset" || side == "paper" || side.hasPrefix("article:")) ? [.png, .jpeg, .webP] : [.png, .jpeg, .webP, .mpeg4Movie, .quickTimeMovie, .movie]
        guard panel.runModal() == .OK, let url = panel.url else { return }
        let scoped = url.startAccessingSecurityScopedResource(); defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        do {
            let bytes = try Data(contentsOf: url)
            guard bytes.count <= (side == "paper" || side.hasPrefix("article:") ? 12 : 100) * 1024 * 1024 else { problem = (side == "paper" || side.hasPrefix("article:")) ? "纸张图片上限12MB" : "素材上限为100MB，请先压缩视频"; return }
            let ext = url.pathExtension.lowercased(), video = ["mp4", "mov", "webm"].contains(ext)
            let mime = ["png":"image/png", "jpg":"image/jpeg", "jpeg":"image/jpeg", "webp":"image/webp", "mp4":"video/mp4", "mov":"video/quicktime", "webm":"video/webm"][ext] ?? "application/octet-stream"
            let uri = "data:\(mime);base64," + bytes.base64EncodedString()
            var next = draft, data = next["data"]?.object ?? [:]
            if side.hasPrefix("article:"), let i = Int(side.dropFirst(8)), var pages = data["pages"]?.array, pages.indices.contains(i) {
                var page = pages[i].object ?? [:]; page["image"] = .string(uri); pages[i] = .object(page); data["pages"] = .array(pages)
            } else if side == "paper" {
                var items = data["items"]?.array ?? [], item = items.first?.object ?? [:]
                item["src"] = .string(uri)
                if !items.isEmpty { items[0] = .object(item) }; data["items"] = .array(items)
            } else if side == "asset" {
                var options = next["options"]?.object ?? [:]; options["asset"] = .string(uri); next["options"] = .object(options)
            } else if side.hasPrefix("event:"), let i = Int(side.dropFirst(6)), var events = data["events"]?.array, events.indices.contains(i) {
                var event = events[i].object ?? [:]; event["image"] = .string(uri); events[i] = .object(event); data["events"] = .array(events)
            } else {
                var item = data[side]?.object ?? [:]; item["src"] = .string(uri); item["kind"] = .string(video ? "video" : "image"); data[side] = .object(item)
            }
            next["data"] = .object(data); apply(next)
        } catch { problem = error.localizedDescription }
    }

    private func updateLetters() {
        let payload = json(draft), text = paperText
        Task {
            do {
                let result = try await stage.callString("const c=JSON.parse(json); c.data.letters=DMOpus.paperLetters(text,c.data.letters); return JSON.stringify(DMOpus.validate(c))", arguments: ["json": payload, "text": text])
                apply(try JSONDecoder().decode([String: JSONValue].self, from: Data(result.utf8)))
            } catch { problem = BatchRunner.describe(error) }
        }
    }

    private func importSubtitles() {
        let panel = NSOpenPanel(); panel.allowedContentTypes = [.plainText, .data]
        guard panel.runModal() == .OK, let url = panel.url else { return }
        let scoped = url.startAccessingSecurityScopedResource(); defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        do {
            let text = try String(contentsOf: url, encoding: .utf8), payload = json(draft)
            Task {
                do {
                    let result = try await stage.callString("return JSON.stringify(DMOpus.importSubtitles(JSON.parse(json), text))", arguments: ["json": payload, "text": text])
                    apply(try JSONDecoder().decode([String: JSONValue].self, from: Data(result.utf8)))
                } catch { problem = BatchRunner.describe(error) }
            }
        } catch { problem = error.localizedDescription }
    }

    static let labels: [String: String] = ["metadata":"研究信息", "style":"样式与文字", "timeline":"时间线（秒）", "output":"画面与帧率", "fieldMappings":"字段映射", "options":"模板参数", "camera":"镜头与对象"]
}

private struct MotionObjectFields: View {
    let values: [String: JSONValue]
    let update: (String, JSONValue) -> Void
    private let labels = ["title":"标题", "subtitle":"说明", "background":"背景", "ink":"文字色", "accent":"强调色", "fontFamily":"字体", "fontSize":"字号", "titleSize":"标题字号", "numberSize":"数字字号", "unit":"单位", "prefix":"前缀", "decimals":"小数位", "source":"数据来源", "sampleSize":"样本量", "researchTime":"研究时间", "showSource":"显示来源", "showSampleSize":"显示样本量", "showResearchTime":"显示研究时间", "showTitle":"显示标题", "showSubtitle":"显示说明", "duration":"持续时间", "entrance":"入场时间", "hold":"结束停留", "currentTime":"保存的位置", "inPoint":"起始进度", "outPoint":"结束进度", "width":"画面宽度", "height":"画面高度", "fps":"帧率", "rateMode":"漏斗口径", "questionType":"题型", "inputMode":"输入口径", "totalVotes":"有效样本", "winnerLabel":"最高项标签（空为关闭）", "highlight":"强调对象", "stackMode":"堆叠方式", "denominator":"分母说明", "focusAt":"聚焦时刻", "focusHold":"聚焦停留", "focusIndex":"聚焦卡片（从0起）", "holdSeconds":"每条原声停留", "moveSeconds":"原声切换时间", "showAvatar":"显示头像", "showRating":"显示星级", "scale":"排列或坐标模式", "divider":"分隔位置", "syncStart":"视频同步起点", "startDate":"开始日期", "endDate":"结束日期", "layout":"排列", "seed":"固定随机种子", "keyword":"固定关键词", "paperCount":"纸张数量", "articleScale":"报道阅读倍率", "wrinkleStrength":"纸张褶皱光影 0–1", "inkWear":"油墨颗粒 0–1", "contextBlur":"焦外纵向虚化", "focusPadding":"清晰范围留白", "contextDimming":"焦外淡化强度", "cutSeconds":"每次切换秒数", "fontPair":"字体组合", "highlightColor":"高亮色", "paperColor":"纸张颜色", "texture":"纸纹强度 0–1", "tear":"撕边幅度", "thickness":"纸张厚度", "shadow":"投影强度 0–1", "backing":"显示纸张衬底", "entry":"入场动作", "entrySeconds":"入场秒数", "tilt":"倾斜角度", "direction":"折叠方向", "segments":"折纸分段数量", "unfoldSeconds":"展开秒数", "stagger":"逐字间隔秒数", "spread":"字片入场分散程度"]
    private func choices(_ key: String, _ current: String) -> [(String, String)]? {
        let options: [String: [(String, String)]] = [
            "direction": [("right", "向右展开"), ("left", "向左展开"), ("down", "向下展开"), ("up", "向上展开")],
            "fontPair": [("gothic-serif", "内置黑体 + 宋体"), ("sans-gothic", "系统黑体 + 内置黑体"), ("serif-sans", "宋体 + 系统黑体")],
            "entry": [("slide", "滑入"), ("pop", "弹出"), ("drop", "落下")],
            "fontFamily": [("local-gothic", "内置中文字体"), ("system-sans", "系统黑体"), ("system-serif", "系统宋体")],
            "questionType": [("single", "单选题"), ("multiple", "多选题")],
            "inputMode": [("count", "人数 ÷ 有效样本"), ("percent", "已输入百分比")],
            "rateMode": [("previous", "相对上一阶段的转化率"), ("first", "相对首阶段的保留率")],
            "stackMode": [("absolute", "绝对数量"), ("percent", "百分比构成")],
            "order": [("input", "输入顺序"), ("descending", "从高到低"), ("ascending", "从低到高")],
            "icon": [("person", "简洁小人"), ("dot", "圆点")],
            "finalLayout": [("grid", "点阵"), ("bars", "条形构成")],
            "route": [("smooth", "平滑镜头"), ("linear", "匀速镜头")],
            "markStyle": [("fill", "实心"), ("ring", "空心圆环"), ("cross", "交叉标记")],
            "cameraRoute": [("zoom-out", "连续拉远"), ("pan-zoom", "平移与拉远")],
            "arrangement": [("grid", "方阵"), ("rows", "横向排列")],
            "layout": [("bento", "看板"), ("row", "横排"), ("stack", "卡片叠放")],
            "pointStyle": [("dot", "圆点"), ("pin", "定位标记")]
        ]
        if key == "scale" { return ["linear", "even"].contains(current) ? [("linear", "实际时间间隔"), ("even", "等距节点")] : [("fixed", "固定坐标"), ("dynamic", "动态坐标")] }
        if key == "mode" { return ["tick", "roll"].contains(current) ? [("tick", "数字变化"), ("roll", "滚动数字")] : [("individual", "关联个体记录"), ("aggregate", "汇总数据")] }
        return options[key]
    }
    var body: some View {
        ForEach(values.keys.sorted(), id: \.self) { key in
            let value = values[key] ?? .null
            VStack(alignment: .leading, spacing: 4) {
                Text(labels[key] ?? key).font(.footnote).foregroundStyle(.secondary)
                switch value {
                case .bool(let v): Toggle(labels[key] ?? key, isOn: Binding(get: { v }, set: { update(key, .bool($0)) })).labelsHidden()
                case .number(let v): NumberField(title: labels[key] ?? key, value: Binding(get: { v }, set: { if let v = $0 { update(key, .number(v)) } }))
                case .string(let v):
                    if v.hasPrefix("#"), v.count == 7 {
                        ColorPicker(labels[key] ?? key, selection: Binding(get: { Color(hexString: v) }, set: { update(key, .string($0.hexString)) }), supportsOpacity: false).labelsHidden()
                    } else if let choices = choices(key, v) {
                        ValueMenu(name: labels[key] ?? key, value: Binding(get: { v }, set: { update(key, .string($0)) }), options: choices)
                    } else {
                        CommitField(title: labels[key] ?? key, text: Binding(get: { v }, set: { update(key, .string($0)) }), axis: .vertical, lineLimit: 1...5)
                        if key == "fontFamily" { Text("local-gothic 内置中文 / system-sans / system-serif").font(.footnote).foregroundStyle(.secondary) }
                    }
                default: MotionJSONField(value: value) { update(key, $0) }
                }
            }.padding(.vertical, 4)
        }
    }
}

private struct MotionJSONField: View {
    let value: JSONValue
    let update: (JSONValue) -> Void
    @State private var draft = ""
    @State private var problem: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            TextEditor(text: $draft).font(.system(.footnote, design: .monospaced)).frame(minHeight: 120).accessibilityLabel("结构化参数")
            Button("应用参数") {
                do { update(try JSONDecoder().decode(JSONValue.self, from: Data(draft.utf8))); problem = nil }
                catch { problem = error.localizedDescription }
            }.buttonStyle(.pill(size: .small))
            if let problem { Text(problem).foregroundStyle(.red).font(.footnote) }
        }
        .task(id: value) {
            let e = JSONEncoder(); e.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
            draft = (try? e.encode(value)).map { String(decoding: $0, as: UTF8.self) } ?? "{}"
        }
    }
}
