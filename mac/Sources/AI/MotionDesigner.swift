import Foundation

struct MotionDesignError: LocalizedError {
    let message: String
    init(_ message: String) { self.message = message }
    var errorDescription: String? { message }
}

struct MotionDesignDraft {
    let target: MotionDesigner.Target
    let summary: String
    let clip: MotionPreviewClip
    let previousExternal: String
    let previousAuthored: String
    let authored: String
    let effective: String

    func reusableCopy() throws -> Self {
        let changed = try MotionPack(json: authored)
        guard var entry = changed.overrides?.first(where: { $0["target"]?.string == target.id }) else {
            throw MotionDesignError("找不到要另存的内置动效。")
        }
        // 预览已校验过覆盖的图层和样式。复用模板的字段相同，只另给名称和 ID。
        let copy = MotionDesigner.Target(id: "local.ai-\(UUID().uuidString.lowercased())", name: "\(target.name) · 自定义")
        entry["target"] = nil
        entry["base"] = .string(target.id)
        entry["id"] = .string(copy.id)
        entry["name"] = .string(copy.name)
        var pack = try MotionPack(json: previousAuthored)
        pack.put(entry, id: copy.id)
        let authored = try pack.encoded()
        let effective = try MotionPack.combine(external: previousExternal, local: authored)
        let combined = try MotionPack(json: effective)
        guard (combined.templates?.count ?? 0) <= 40 else {
            throw MotionDesignError("动效库最多可保存 40 个本机模板。")
        }
        return Self(
            target: copy, summary: summary, clip: clip, previousExternal: previousExternal,
            previousAuthored: previousAuthored, authored: authored, effective: effective
        )
    }
}

final class MotionDesigner {
    struct Target: Equatable {
        let id: String
        let name: String
    }

    // 草稿使用自己的渲染页。预览和校验都不改工作中的画面。
    private lazy var stage = StageController()

    private struct Context: Decodable {
        let entry: MotionPack.Entry?
        let error: String?
    }

    private struct Reply: Decodable {
        let change: JSONValue?
        let summary: String?
    }

    func generate(
        _ request: String, target: Target?, client: AIClient, library: MotionPackLibrary,
        onRepair: (String) -> Void = { _ in }
    ) async throws -> MotionDesignDraft {
        let previousExternal = library.externalJSON
        let previousAuthored = library.authoredJSON
        let pack = library.json
        let id = target?.id ?? "local.ai-\(UUID().uuidString.lowercased())"
        let context: String
        let original: MotionPack.Entry
        if let target {
            context = try await stage.callString("""
                const result = await window.dmMotionCommand('get', id, pack, null);
                if (result.error) return JSON.stringify({error: result.error});
                const elements = result.survey.elements.slice(0, 120).map(({id, label}) => ({id, label}));
                return JSON.stringify({entry: result.entry, elements, colors: DM.colorRoles(result.sample)});
                """, arguments: ["id": target.id, "pack": pack])
            let detail = try JSONDecoder().decode(Context.self, from: Data(context.utf8))
            if let error = detail.error { throw MotionDesignError(error) }
            original = detail.entry ?? [:]
        } else {
            context = "{}"
            original = [:]
        }

        let task: String
        if let target {
            task = "修改目标：\(target.name)（\(target.id)）。基于当前已保存的版本，只输出这次要改的字段。"
        } else {
            task = "新建模板：输出 name、可选 description，以及 elements 和 duration。只创建一个新模板。"
        }
        let editing = id.hasPrefix("local.")
            ? "本机模板可用 name、description、duration、elements、defaults、layers。复用内置动效的本机模板保留原 base，用 overlays 添加文字，只改 name、description、defaults、layers、overlays。"
            : "内置动效可改 defaults 和 layers，并用 overlays 叠加独立文字。添加标题、角标、标签时写 overlays。底图的绘制逻辑和数据结构照常使用。"
        let user = """
            \(task)
            \(editing)
            已保存的配置和可用元素：
            \(context)
            用户描述：
            \(request)
            """
        var feedback = ""
        for attempt in 0..<2 {
            try Task.checkCancellation()
            do {
                let text = try await client.generate(
                    system: Self.instructions,
                    user: user + feedback, schema: Self.schema
                ) { _ in }
                try Task.checkCancellation()
                let (patch, summary) = try Self.decode(text)
                var entry = try Self.applying(patch, to: original)
                let identity = id.hasPrefix("local.") ? "id" : "target"
                entry[identity] = .string(id)
                guard entry != original else { throw MotionDesignError("草稿与原模板相同，请具体描述想改的地方。") }
                var local = try MotionPack(json: previousAuthored)
                local.put(entry, id: id)
                let authored = try local.encoded()
                let effective = try MotionPack.combine(external: previousExternal, local: authored)
                guard authored.utf8.count <= MotionPackLibrary.byteLimit else {
                    throw MotionDesignError("动效包超过 256 KB，请减少动效元素。")
                }
                let json = try await stage.callString(
                    "return JSON.stringify(await window.dmMotionCommand('preview', id, pack, null))",
                    arguments: ["id": id, "pack": effective]
                )
                try Task.checkCancellation()
                let reply = try JSONDecoder().decode(MotionPreviewClip.Reply.self, from: Data(json.utf8))
                if let error = reply.error { throw MotionDesignError(error) }
                guard let clip = reply.clip else { throw MotionDesignError("草稿没有生成可播放的画面。") }
                let savedTarget = Target(id: id, name: entry["name"]?.string ?? target?.name ?? "新动效")
                return MotionDesignDraft(
                    target: savedTarget, summary: summary, clip: clip,
                    previousExternal: previousExternal, previousAuthored: previousAuthored, authored: authored, effective: effective
                )
            } catch let error as MotionDesignError {
                if attempt == 1 { throw error }
                onRepair(error.message)
                feedback = "\n上次草稿的校验问题：\(error.message)\n请修正后重新输出完整的 JSON。"
            }
        }
        throw MotionDesignError("未能生成动效，请重试。")
    }

    private static func decode(_ text: String) throws -> (MotionPack.Entry, String) {
        let data = Data(StoryboardPrompt.stripFence(text).utf8)
        guard data.count <= MotionPackLibrary.byteLimit,
              let reply = try? JSONDecoder().decode(Reply.self, from: data),
              let change = reply.change else {
            throw MotionDesignError("AI 返回的草稿格式无法读取。")
        }
        let patch = change.object ?? change.string.flatMap {
            try? JSONDecoder().decode(MotionPack.Entry.self, from: Data($0.utf8))
        }
        let summary = String((reply.summary ?? "").trimmingCharacters(in: .whitespacesAndNewlines).prefix(240))
        guard let patch, !patch.isEmpty else {
            throw MotionDesignError(summary.isEmpty ? "AI 没有返回可应用的修改。" : summary)
        }
        return (patch, summary)
    }

    private static func applying(_ change: MotionPack.Entry, to original: MotionPack.Entry) throws -> MotionPack.Entry {
        var patch = change
        for (field, flag) in [("elements", "replaceElements"), ("overlays", "replaceOverlays")] {
            let replace = patch.removeValue(forKey: flag)
            if let replace, replace.bool == nil || patch[field]?.array == nil {
                throw MotionDesignError("\(flag) 需要是布尔值，并且和 \(field) 一起提供。")
            }
            guard replace?.bool != true, var elements = original[field]?.array, let edits = patch[field]?.array else { continue }
            var editedIDs = Set<String>()
            for edit in edits {
                guard let fields = edit.object, let id = fields["id"]?.string, editedIDs.insert(id).inserted else {
                    throw MotionDesignError("要修改的每个元素都需要提供唯一的 ID。")
                }
                if let index = elements.firstIndex(where: { $0.object?["id"]?.string == id }),
                   let previous = elements[index].object {
                    elements[index] = .object(merge(previous, fields))
                } else {
                    elements.append(edit)
                }
            }
            patch[field] = .array(elements)
        }
        return merge(original, patch)
    }

    private static func merge(_ old: MotionPack.Entry, _ patch: MotionPack.Entry) -> MotionPack.Entry {
        old.merging(patch) { before, after in
            guard let before = before.object, let after = after.object else { return after }
            return .object(merge(before, after))
        }
    }

    private static var schema: [String: Any] {
        [
            "type": "object", "additionalProperties": false, "required": ["change", "summary"],
            "properties": ["change": ["type": "string"], "summary": ["type": "string"]],
        ]
    }

    private static let instructions = """
        你是「肉呆爱动效」的动效设计师。只返回 JSON 对象，change 是包含动效字段的 JSON 字符串，summary 用一句中文说明实际改动。
        例如 {"change":"{\\"defaults\\":{\\"colors\\":{\\"primary\\":\\"#84CC16\\"}}}","summary":"主色改为绿色"}。
        ID 由 App 指定，不输出 id、target、version 或整份动效包。不输出脚本或外部链接。
        能力不足时把 change 写成 "{}"，summary 说明目前支持的最接近效果。

        新模板的画布为 1920 × 1080，坐标原点在左上。duration 为 0.5 到 60 秒。elements 为 1 到 48 个按顺序绘制的元素。
        每项必填 id（唯一且不能是 bg 或 main）、type（rect、circle 或 text）、x、y 和六位十六进制 color。
        rect 和 circle 必填 width、height。text 可以写固定 text 或 bind（line 绑定分镜口播，title 绑定标题），字号 size 为 8 到 240。
        enter 支持 fade、slide、pop、none，start 和 seconds 用秒。入场应在动效结束前完成。
        修改已保存模板时，elements 只列要改的元素，使用原 ID 和要改的字段。新增元素提供完整字段。其余元素会保留。
        用户明确要求删除元素或重排绘制顺序时，可以设置 replaceElements:true 并返回完整的 elements 数组。
        给内置动效或基于内置动效的模板加字，用 overlays 数组。每项 type 必须是 text，其他坐标、颜色和字号字段与文字元素相同，默认直接显示。
        例如左上角加一句「总共5000人」时，change 的内容是 {"overlays":[{"id":"total-title","type":"text","text":"总共5000人","x":80,"y":60,"size":48,"color":"#FFFFFF"}]}。
        用户要求标题跟着分镜样本人数变化时，用 bind:"sampleSize" 和含 {sampleSize} 的 text，人数由当前分镜提供。
        例如把已有的 total-title 改成随样本人数变化，只返回 {"overlays":[{"id":"total-title","bind":"sampleSize","text":"总共{sampleSize}人"}]}。
        如果用户给了 5000、800 等数字来举例，模板里写 {sampleSize}。缺少明确的样本人数时，App 会隐藏这条文字。
        编辑 overlays 时按原 ID 提交要改的字段。要删除或重排已有的叠加文字时，用 replaceOverlays:true 并给完整的 overlays，可用空数组清空。
        layers 若要调整叠加文字，键用 overlay: 加该文字的 ID，例如 overlay:total-title。
        defaults 可包含 theme（black 或 paper）、colors（例如 bg、primary、secondary）、speed（0.05 到 20 倍）和 hold（0 到 30 秒）。
        自建模板的背景用 defaults.colors.bg，文字和形状的颜色写在对应元素里。
        layers 是按元素 ID 索引的对象。单元素支持 alpha（0 到 1）、hidden、color、speed、delay（0 到 30 秒）和 m（[a,b,c,d,tx,ty]，位移单位为像素）。
        只返回有必要的修改。用户未要求重置时，不要删除原有字段。
        """
}
