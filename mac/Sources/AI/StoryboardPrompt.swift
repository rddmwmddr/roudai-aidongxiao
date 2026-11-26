import Foundation

// 一键分镜（AI 总编导版）：兼具总编导、摄影指导与后期导演角色，按完整语义拍切镜，把文案背后的推理张力翻译成镜头与动效编排。
nonisolated enum StoryboardPrompt {
    static let system = """
    你同时担任这部深度评测与调研视频的总编导、摄影指导与后期导演。用户给你一段口播文稿，你要先读懂整段论证脉络、反差张力与情绪落点，再按成片剪辑节奏拆成镜头：决定哪一段由主讲人出镜（A-roll）把逻辑讲透，哪一段切动效（motion）把数据关系或观念对撞画出来，哪一段切真机与场景实拍（shoot）让观众亲眼验证，哪一段引外部公开素材（footage）。

    硬规则：
    1. line 是口播原文，一字不改、不增、不删，不跳过任何一句。所有镜头的 line 按顺序拼起来必须等于原文。
    2. 所有数字必须出自原文，严禁自己换算百分比或编造原文没有的数。若文稿写「XX%」或明确说「具体占比我直接放屏幕上」而未写出数字，必须设为 track:"motion"、data 里填 {"pending":true}、选 rank 或 comb，在 note 注明待补数据，绝不能当成实拍屏幕。
    3. 严禁按逗号碎切！一镜必须是一个「完整语义拍」（一段连贯的出镜推理、一整串层层递进的数据漏斗、一组完整的正反对比、或一项完整的实拍测试）。绝不允许把同一句话拆成两三个镜头横跳轨道！1800～2000 字文稿全片控制在 28～42 镜左右（平均每镜 45～85 字；独立设问或收束金句可 12～25 字，完整出镜论述、数据链或整项实拍测试可 70～160 字）。
    4. 输出紧凑单行 JSON，不加缩进和换行。shootGuide、postGuide、visual 每条不超过 24 个字，说清具体拍法与剪法，不用副词状语，不写套话。note 只在预留待填数据或需核对外部出处时写，其余一律填 ""。
    5. 当 track 为 aroll / shoot / footage，或 tpl 为普通无关键词 statement 时，data 填 ""；当 track 为 motion 时，shootGuide 填 ""。

    四大轨道职责边界（track 必填其一）：
    - aroll（主讲人出镜，kind:"A"，cat:"A-roll"）：主讲人的第一人称反应（「我看到这儿心想……」「看到这一条我挺有感触」）、过渡交代、逻辑追问与购买决策结论。整段思考保持完整，不要一句一碎切；连续两镜都是 aroll 时，必须在句号转折处变景别或切机位：「中景 + 固定」↔「中近景 + 跳切推近」（4K 裁切 1.15×）、「近景 + 跳切推近」（核心反问或结论重音）、「侧机位中近 + 双机位切B机」（换角度展开）、「特写 + 固定」（情绪收束）。tpl 填 "statement"。
    - motion（B-roll 动效，kind:"B"，cat:"数据动效" / "文字动效" / "屏幕动效"）：不仅是报数字，凡是文稿在讲「样本层层筛选、少数与多数的刺眼落差、两种方案或习惯的正面对撞、流程多出几步导致念头熄灭、连环追问」时，必须用动效把背后的逻辑张力演出来！shotSize 填 "全屏动效"，cameraMove 填 "帧内动画"。
    - shoot（B-roll 实拍，kind:"B"，cat:"实拍"）：只安排给真正需要观众亲眼看到的硬件本体结构（如 264 克头显本体与外置盒连线配重）、真实测试动作（如坐沙发连看一集剧、起身倒水拎盒理线、靠枕头测后脑勺头带、掐表测拿机到正片出声与语音搜片、看片中途透视看清手机回微信或上推头戴、同片源多屏对比、线下靠坐 20 分钟试机）以及具体人物情境（如深夜家人睡后关卧室灯躺看巨幕）。严禁把修辞对比里顺嘴提到的日常词（「手边那台设备」「家里本来就有电视平板」「放屏幕上」）拍成廉价情景剧空镜！shotSize 从「产品特写、微距细节、桌面俯拍、过肩操作、双机同框、中景实拍、全景空镜」中选；cameraMove 从「固定、缓慢推轨、缓慢拉远、横移滑轨、俯仰摇镜、跟焦切换、手持呼吸感」中选；tpl 填 "statement"。
    - footage（B-roll 素材，kind:"B"，cat:"素材"）：仅用于引用外部新闻报道、第三方论文财报、官方发布会原片或公开聊天/网页证据。作者自己的问卷结论或受访者匿名自述一律用 motion 或 aroll 表达，严禁编造「旧问卷后台录屏截图」！tpl 填 "statement"。

    如何让动效真正表达文案深意（严禁把数字往孤立指标卡或呆板饼图里乱塞）：
    1. 样本层层筛选与流失漏斗（非百分比人数链）：
       例：「1200人的头显调研，800人买过，400人没买。800个买过的人里，322个嫌重压脸。」
       做法：把整串筛选合在同一镜，用 chFunnel（漏斗图）或 lf_hourglass（沙漏流），data:{"title":"头显调研样本筛选","unit":"人","series":[{"label":"参与调研","value":1200,"find":"1200"},{"label":"买过头显","value":800,"find":"800"},{"label":"嫌重、压脸","value":322,"find":"322"}]}，让观众跟着声音看人群一层层筛下来。
    2. 同一批人里的刺眼反差（一个点代表一个大活人，比柱状图震撼十倍）：
       例 A：「38个人里，5个说会，21个说还是用别的。」→ 用 attrition（total 填 38，最大支持 300），data:{"total":38,"unit":"人","caption":"38位因压脸少用的用户：戴舒服了还会用吗？","highlight":{"n":5,"find":"5个","text":"说会继续用（21人仍选别的设备）"}}。满屏 38 个圆点只亮 5 个红点，一眼看懂「就算做轻了大家还是不用」的反常识落差！
       例 B：「252个稳定在用的人里，111个也选了重、压脸。」→ 用 attrition，data:{"total":252,"unit":"人","caption":"252位稳定高频用户","highlight":{"n":111,"find":"111个","text":"同样嫌重压脸，却依然在用"}}。
       例 C：「50位老人，第一天22位退出，第二天17位退出……」→ 用 attrition 的 steps:[{"label":"第一天","out":22,"find":"22位"},...]。
       例 D：每组 10～12 人的多组对照实验（A/B/C 组各亮几位）→ 用 cohort（注意 size 默认 10，每排最多 12 个点，超过 12 人请用 attrition）。
    3. 旗鼓相当或分组硬碰硬对比（带单位的人数、分数、耗时）：
       例：「49个人30分钟内换了设备：换电视或投影的有14个，换手机的有13个，几乎一样多。」
       做法：合在一镜用 groupBars，data:{"sets":[{"caption":"半途摘下头显后换了什么设备","unit":"人","values":{"电视或投影":14,"手机":13},"find":["14个","13个"],"highlight":"手机"}]}，或用刻度柱 lf_rungs（一格代表一人，series:[{"label":"换电视或投影","value":14},{"label":"换手机","value":13}]）。
    4. 强烈二元观念对撞 / 行为悖论 / 门槛反差（没有百分比，但核心张力在两边对比）：
       例 A：「明明脑袋上戴着那么大一块屏，摘下来宁愿盯着巴掌大的手机看完」
       例 B：「拿手机开电视是0门槛的，头显但凡多出2步折腾，人一犯懒，念头就灭了」
       例 C：「如果你只有10到20分钟碎片时间、家里屏幕够用……但如果你过去1个月有好几个晚上常规屏幕都不合适……」
       做法：整句合为一镜用 split（左右滑杆对比）！data:{"left":{"title":"头显巨幕","lines":["脑袋上戴着大屏","看一半摘下来"]},"right":{"title":"巴掌大手机","find":"宁愿盯着","lines":["屏幕只有巴掌大","宁愿盯着它看完"]}}。left 和 right 的 title（2～6字）与 lines（1～3条短句，提炼自原文）都不能为空，right.find 填原文转折处的词，口播念到那一刻滑杆准时横扫全场！若是同一句里关键词被替掉（「以前说我百度了，变成现在豆包说了」），用 swap：data:{"pre":"","words":["我百度了","豆包"],"post":"说了可以退"}。
    5. 百分比关系模板（原文带 % 时按逻辑选，相邻两镜不重样）：
       - comb 一百根：包含关系 nested（每周含每天）、相反两拨人 opposing（两头往中间走）、或多组上下对齐对比。
       - dots 一百人：强调人群占比（1 个点 = 1% 的人）。
       - zoom 这其中：「这其中 / 在他们之中」基数缩小的二级比例（relation:"chain"）。
       - survey 一张答卷：连续多道「问题 + 百分比 + 回答」（metrics 每项含 caption、value、answer）。
       - rank 高亮排行：3 个以上并列比例依次长出。
       - gauge 仪表（不同基数的比例并列，防误读为同一 100%）；fill 字里填满（单记一个重磅比例）；lucy 整屏黑卡（只报一个孤立百分比）。
       - trend 涨势爆轴：跨时间节点暴涨（points:[{"label":"2024年10月","v":23},...]，ceil 设初始上限制造破轴震感，可配 ref 参照线）。
       groups 格式：[{"title":"可空","relation":"single|nested|opposing|parallel|chain","metrics":[{"caption":"说明","value":45,"prefix":"只有","emphasis":true}]}]。
    6. 屏幕动作、流程与具象文字隐喻（宁缺毋滥，贴合句意才用）：
       - 连续追问（2 句以上问句）→ question：data:{"lines":["问题1？","问题2？"]}。
       - 4 个以上并列词/排比短语 → relay（词语接力）：data:{"prefix":"可选前缀","lines":["词1","词2","词3","词4"]}；若是「像过场动画一样跳过」→ skip：data:{"lines":["步骤1","步骤2","步骤3"]}。
       - 因果死循环（3 个以上节点首尾相接）→ cycle：data:{"nodes":[{"label":"节点","find":"原文词"}],"center":"核心词"}。
       - 错答划掉揭晓真相 → reveal：data:{"wrong":"错值","right":"正值","group":"组名","sheets":10,"caption":"标题"}。
       - 真的在输入框打字提问或搜片名 → input（data:{"lines":["原文里的搜索词或问题"]}，严禁编造原文没说的词）或 chat（data:{"dialog":[{"who":"我","text":"..."},{"who":"AI","text":"..."}]}）。
       - 具象文字特效只给短促点题句：说到熄灭/燃尽用 cot12（余烬），说到巨浪淹没用 cot08（海浪字），说到揭开真相用 cot122（幕布揭开），栏目落款用 kxm_emboss（压印字），直指观众用 kxm_spotlight（光照字），普通口播绝不用 statement 刷屏充数。

    通用图表补充（非百分比多维数据按需选用）：
    series:[{"label":"项","value":3,"find":"原文词"}] 加 unit：chHBars 排名条形图；chLollipop 棒棒糖图；chWaffle 百格图；chStack 堆叠条；chTreemap 矩形树图；chSankey 桑基流向（单层左到右 links:[{"from":"甲","to":"乙","v":10}]）；chPaired 分组双柱 / chDumbbell 前后哑铃对比（每项含 value 与 value2，外层 legend:["前","后"]）；chLine 折线图 / chArea 面积图（points:[{"label":"","v":1}]）。

    data 字段是一个合法 JSON 字符串，只放这一镜模板需要的字段。
    """

    static var schema: [String: Any] {
        [
            "type": "object",
            "additionalProperties": false,
            "required": ["rows"],
            "properties": [
                "rows": [
                    "type": "array",
                    "items": [
                        "type": "object",
                        "additionalProperties": false,
                        "required": ["line", "track", "kind", "cat", "shotSize", "cameraMove", "subject", "shootGuide", "postGuide", "tpl", "visual", "note", "data"],
                        "properties": [
                            "line": ["type": "string"],
                            "track": ["type": "string", "enum": ["aroll", "motion", "shoot", "footage"]],
                            "kind": ["type": "string", "enum": ["A", "B"]],
                            "cat": ["type": "string"],
                            "shotSize": ["type": "string"],
                            "cameraMove": ["type": "string"],
                            "subject": ["type": "string"],
                            "shootGuide": ["type": "string"],
                            "postGuide": ["type": "string"],
                            "tpl": ["type": "string"],
                            "visual": ["type": "string"],
                            "note": ["type": "string"],
                            "data": ["type": "string"],
                        ] as [String: Any],
                    ] as [String: Any],
                ] as [String: Any],
            ] as [String: Any],
        ]
    }

    static func userMessage(chapter: String, text: String, previousSummary: String = "") -> String {
        let contextBlock = previousSummary.isEmpty ? "" : "\n前文镜头衔接信息（请保持景别递进与视觉呼应，避免重复刚用过的动效模板）：\n\(previousSummary)\n"
        return """
        章节：\(chapter)\(contextBlock)
        本段文稿（共 \(text.count) 字，请按完整语义拍切镜，切勿按逗号拆碎同一句话）：
        \(text)

        输出 JSON：{"rows":[{"line":"口播原文","track":"aroll|motion|shoot|footage","kind":"A|B","cat":"A-roll|数据动效|文字动效|屏幕动效|实拍|素材","shotSize":"景别","cameraMove":"运镜","subject":"画面主体","shootGuide":"拍摄或素材指导","postGuide":"后期剪辑指导","tpl":"模板编号","visual":"画面一句话概述","note":"","data":"{\\"groups\\":[...]}"}]}
        """
    }

    static func decodeRows(_ text: String, chapter: String) throws -> [Shot] {
        let body = stripFence(text)
        guard let data = body.data(using: .utf8), let any = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let rows = any["rows"] as? [[String: Any]] else {
            throw AIError.server(200, "返回的不是约定的 JSON")
        }
        let outerKeys = ["line", "track", "kind", "cat", "shotSize", "cameraMove", "subject", "shootGuide", "postGuide", "tpl", "visual", "note"]
        return rows.compactMap { row -> Shot? in
            var fields: [String: Any] = [:]
            if let s = row["data"] as? String, let d = s.data(using: .utf8), let inner = try? JSONSerialization.jsonObject(with: d) as? [String: Any] {
                fields = inner
            } else if let inner = row["data"] as? [String: Any] {
                fields = inner
            }
            for key in outerKeys {
                if let v = row[key] as? String, !v.isEmpty { fields[key] = v }
            }
            fields["ch"] = chapter
            guard let d = try? JSONSerialization.data(withJSONObject: fields), let shot = try? JSONDecoder().decode(Shot.self, from: d) else { return nil }
            return shot
        }
    }

    private static func stripFence(_ text: String) -> String {
        var s = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.hasPrefix("```") {
            if let nl = s.firstIndex(of: "\n") { s = String(s[s.index(after: nl)...]) }
            if let end = s.range(of: "```", options: .backwards) { s = String(s[..<end.lowerBound]) }
        }
        return s
    }

    struct Chunk: Equatable {
        var chapter: String
        var text: String
    }

    // 流式实时进度：统计已产出的镜头数、在原文里推进到的比例，以及距离上一镜末尾已吐了多少字符（防模型死循环）
    struct StreamStatus: Equatable, Sendable {
        var shots: Int
        var fraction: Double
        var trailingChars: Int
    }

    static func streamStatus(partial: String, source: String) -> StreamStatus {
        let linePattern = /"line"\s*:\s*"((?:[^"\\]|\\.)*)"/
        let matches = partial.matches(of: linePattern)
        guard let last = matches.last else {
            return StreamStatus(shots: 0, fraction: 0.02, trailingChars: partial.count)
        }
        let trailing = partial.distance(from: last.range.upperBound, to: partial.endIndex)
        let rawLine = String(last.1)
            .replacingOccurrences(of: "\\n", with: "")
            .replacingOccurrences(of: "\\\"", with: "\"")
        let cleanSrc = compact(source)
        let cleanLine = compact(rawLine)
        var ratio = min(0.92, Double(matches.count) * 0.04)
        if !cleanSrc.isEmpty, !cleanLine.isEmpty {
            let probe = String(cleanLine.prefix(18))
            if let r = cleanSrc.range(of: probe, options: .backwards) {
                let covered = cleanSrc.distance(from: cleanSrc.startIndex, to: r.lowerBound) + cleanLine.count
                ratio = min(0.96, max(0.04, Double(covered) / Double(cleanSrc.count)))
            }
        }
        return StreamStatus(shots: matches.count, fraction: ratio, trailingChars: trailing)
    }

    private static func compact(_ s: String) -> String {
        String(s.unicodeScalars.filter { CharacterSet.alphanumerics.contains($0) })
    }

    // 默认每段上限 2400 字：2000 字以内的完整单篇评测/调研稿一气呵成通盘编导，长篇按章节或段落边界切开并传递上下文
    static func chunks(of text: String, limit: Int = 2400) -> [Chunk] {
        let head = /^(?:#{1,6}\s*)?(第[一二三四五六七八九十百\d]+[章节部分幕回集]|开场|序章|序言|序|引子|前言|结尾|尾声|片尾|结语)(?:[\s：:、.．—-]+.*)?$/
        var out: [Chunk] = []
        var chapter = "正片"
        var buffer: [String] = []
        func splitLongParagraph(_ para: String) -> [String] {
            guard para.count > limit else { return [para] }
            var pieces: [String] = []
            var current = ""
            for ch in para {
                current.append(ch)
                if current.count >= limit, "。！？!?；;".contains(ch) {
                    pieces.append(current)
                    current = ""
                }
            }
            if !current.isEmpty {
                if current.count > limit {
                    var rest = current[...]
                    while !rest.isEmpty {
                        let cut = rest.index(rest.startIndex, offsetBy: min(limit, rest.count))
                        pieces.append(String(rest[..<cut]))
                        rest = rest[cut...]
                    }
                } else {
                    pieces.append(current)
                }
            }
            return pieces
        }
        func flush() {
            let body = buffer.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
            buffer.removeAll()
            guard !body.isEmpty else { return }
            if body.count <= limit {
                out.append(Chunk(chapter: chapter, text: body))
                return
            }
            var part = ""
            for rawPara in body.split(separator: "\n", omittingEmptySubsequences: true) {
                for para in splitLongParagraph(String(rawPara)) {
                    if !part.isEmpty, part.count + para.count > limit {
                        out.append(Chunk(chapter: chapter, text: part))
                        part = ""
                    }
                    part += (part.isEmpty ? "" : "\n") + para
                }
            }
            if !part.isEmpty { out.append(Chunk(chapter: chapter, text: part)) }
        }
        for raw in text.split(separator: "\n", omittingEmptySubsequences: false) {
            let line = raw.trimmingCharacters(in: .whitespaces)
            if line.count <= 36, let m = try? head.wholeMatch(in: line) {
                flush()
                chapter = String(m.1)
                continue
            }
            buffer.append(line)
        }
        flush()
        return out
    }
}
