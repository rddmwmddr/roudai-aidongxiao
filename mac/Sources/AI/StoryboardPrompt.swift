import Foundation

// 一键分镜（AI 版）：按章切开，一章一次请求，结果交给引擎核对。
nonisolated enum StoryboardPrompt {
    static let system = """
    你是视频数据动效的分镜师。用户给你一章口播文稿，你要按分镜标准拆成镜头，并为每一镜选动效模板、填好数据。

    硬规则：
    1. line 是口播原文，一字不改、不增、不删，也不能跳过任何一句。所有镜头的 line 按顺序连起来必须等于原文。
    2. 所有数字必须来自原文。原文没有的数字不能写。原文写 XX% 这种待填的，pending 设为 true，value 留空。
    3. 一镜一件事。一句话里多个数是一组对比时放同一镜。
    4. 数字前的铺垫超过两三秒，拆出一镜问题卡或 statement，动效从念到内容时才开始。
    5. 文稿里的问题用 question 模板，让观众读到。
    6. 每一镜都是动效。长段叙述没有数据时用 statement。
    7. 相邻的数据镜尽量不用同一个模板，除非重复本身有意义。

    判断数据关系（决定画面对不对）：
    - nested 包含：每天在每周里面，同一基数。
    - opposing 相反两拨：一正一反、互不重叠、加起来不超过 100。
    - chain 这其中：「这其中」「在他们之中」，基数变了，用 zoom 模板。
    - parallel 并列：互不相关的几个比例。
    - 基数不同：「这还仅仅是……的比例」，在 metric 上写 note: {"text": "这句原话"}。
    拿不准的写进 note，交给人确认。

    模板：
    百分比类，data 里写 groups：comb 一百根（包含、相反、几组对齐）；dots 一百人（说的是人）；zoom 这其中；rank 高亮排行（3 个以上并列）；survey 一张答卷（连问连答，caption 写题目，answer 写答案）；gauge 仪表（基数各不相同）；tape 一把尺子；fill 字里填满（一个要记住的数）；lucy 整屏黑卡（只报一个百分比，caption 留空）。
    groups 格式：[{"title":"可空","relation":"single|nested|opposing|parallel|chain","metrics":[{"caption":"说明","value":45,"prefix":"只有","emphasis":false}]}]。nested 和 opposing 一组最多两个数。上限：comb 4 组，dots 3 组，zoom 4 个数，rank 8 个，survey 10 个，gauge、fill 4 个，tape 5 个。

    其他模板，data 里写对应字段：
    titleV、titleH 诗句卡：lines，head 可选，foot 可选。
    question 问题卡：lines，一行一个问题。
    statement 重音字幕：lines 整句，key 关键词数组。
    relay 词语接力：lines 一串词，prefix 可选。
    swap 词位替换：pre、words、post，value 可选。
    split 左右对比：left、right，各含 title、lines、find。
    trend 涨势爆轴：title，points:[{"label":"2024年10月","v":14}]，ceil 初始上限，ref:{"v":59,"label":"参照"}。
    cohort 三组方阵：cohort:[{"id":"A","name":"A组","rule":"规则"}]，events:[{"g":"A","n":8,"find":"念到的词","tier":0}]，caption。
    groupBars 三组对比柱：sets:[{"caption":"","unit":"分","values":{"A组":90},"find":[],"highlight":"A组"}]。
    attrition 一批批离开：total，caption，steps:[{"label":"第一天","out":3,"find":"念到的词","stamp":""}] 或 highlight:{"n":3,"find":"","text":""}。
    cycle 死循环：nodes:[{"label":"节点","find":"念到的词"}]，center。
    reveal 错答揭晓：wrong、right、group、sheets、caption。
    input 输入框：lines。chat 对话气泡：dialog:[{"who":"我或AI","text":""}]。skip 跳过过场：lines。

    图表模板，data 里写 title，series:[{"label":"抖音","value":3}] 和 unit（不是百分比的一串数优先用这些）：chBars 柱状图（2 到 12 个）；chHBars 排名条形图（标签长、有名次）；chLollipop 棒棒糖图；chFunnel 漏斗图（一层层变少）；chDonut 环形图、chPie 饼图、chWaffle 百格图、chStack 堆叠条、chTreemap 矩形树图（构成）；chRadial 径向条形图；chGauge 进度环（只有一个数）；chHist 直方图（5 段以上的分布）；chWave 波浪柱（20 个以上）；chWaterfall 瀑布图（有正有负，最后一项加 total:true）；chDiverge 正负条形图（有负数）。
    series 里每项再写 value2、外层写 legend:["之前","之后"]：chPaired 分组柱状图；chDumbbell 前后对比图。
    时间序列写 points:[{"label":"2024","v":14}]：chLine 折线图、chArea 面积图、chDraw 一笔画加大数；chBarcode 逐日条码（20 个点以上）。
    其余：chRace 排名赛跑 frames:[{"label":"2024","values":{"甲":1}}]；chStream 河流图 streams:[{"name":"","values":[]}],labels:[]；chCandle K 线图 ohlc:[{"o":1,"h":2,"l":0,"c":1}]；chCalendar 日历热力图 days:[]；chScatter 散点图 points:[{"x":1,"y":2}]；chBox 箱线图 boxes:[{"label":"","min":0,"q1":1,"med":2,"q3":3,"max":4}]；chHeat 矩阵热力图 rows,cols,cells；chSankey 桑基图 links:[{"from":"","to":"","v":1}]；chNetwork 关系网络 nodes:[],links:[[0,1]],center；chTree 树状图 tree:{"name":"","children":[]}；chPictorial 符号柱 series 加 each；chRainfall 雨量双面积 top,bottom,labels,topName,bottomName；chMorph 散点变形 views,points:[{"a":0,"b":0,"c":0}]；chBigSlice 大切片 series 每项加 weight；chSingleAxis 单轴气泡 rows,cols,cells；chJitter 抖动分布 groups2:[{"label":"","values":[]}]；chLive 实时滚动线 values；chForce 力导向星系 nodes,links；chThreads 丝线流向 columns,threads；chChord 环形关系 nodes,chords。

    cat 从这几个里选：数据动效、文字动效、屏幕动效。
    visual 用一句话写画面，给后期看。note 只写要人确认的事，没有就留空。
    data 字段是一个 JSON 字符串，只放这一镜模板需要的字段。
    """

    // Claude 的结构化输出：模板字段太多，统一放进 data 这个 JSON 字符串，外层保持简单
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
                        "required": ["line", "kind", "cat", "tpl", "visual", "note", "data"],
                        "properties": [
                            "line": ["type": "string"],
                            "kind": ["type": "string", "enum": ["A", "B"]],
                            "cat": ["type": "string"],
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

    static func userMessage(chapter: String, text: String) -> String {
        """
        章节：\(chapter)

        文稿：
        \(text)

        输出 JSON：{"rows":[{"line":"口播原文","kind":"B","cat":"数据动效","tpl":"comb","visual":"画面说明","note":"","data":"{\\"groups\\":[...]}"}]}
        """
    }

    // 把模型的回答变成镜头。外层 rows 加上 data 里的字段
    static func decodeRows(_ text: String, chapter: String) throws -> [Shot] {
        let body = stripFence(text)
        guard let data = body.data(using: .utf8), let any = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let rows = any["rows"] as? [[String: Any]] else {
            throw AIError.server(200, "返回的不是约定的 JSON")
        }
        return rows.compactMap { row -> Shot? in
            var fields: [String: Any] = [:]
            if let s = row["data"] as? String, let d = s.data(using: .utf8), let inner = try? JSONSerialization.jsonObject(with: d) as? [String: Any] {
                fields = inner
            } else if let inner = row["data"] as? [String: Any] {
                fields = inner
            }
            for key in ["line", "kind", "cat", "tpl", "visual", "note"] {
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

    // 按章切分。没有章节标题的长文按段落切，一次不超过 limit 个字
    struct Chunk: Equatable {
        var chapter: String
        var text: String
    }

    static func chunks(of text: String, limit: Int = 3500) -> [Chunk] {
        let head = /^(?:#{1,6}\s*)?(第[一二三四五六七八九十百\d]+[章节部分幕回集]|开场|序章|序言|序|引子|前言|结尾|尾声|片尾|结语)(?:[\s：:、.．—-]+.*)?$/
        var out: [Chunk] = []
        var chapter = "正片"
        var buffer: [String] = []
        func flush() {
            let body = buffer.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
            buffer.removeAll()
            guard !body.isEmpty else { return }
            if body.count <= limit {
                out.append(Chunk(chapter: chapter, text: body))
                return
            }
            var part = ""
            for para in body.split(separator: "\n", omittingEmptySubsequences: true) {
                if !part.isEmpty, part.count + para.count > limit {
                    out.append(Chunk(chapter: chapter, text: part))
                    part = ""
                }
                part += (part.isEmpty ? "" : "\n") + para
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
