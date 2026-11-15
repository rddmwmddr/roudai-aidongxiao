// Shared contract for native editor, web editor and local AI CLI. No network/runtime dependencies.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DMOpus = api;
})(typeof window === "object" ? window : globalThis, function () {
  "use strict";
  const VERSION = "8f1b78a25d0cf310c9bf904d434285046c4ed25a/canvas-1";
  const IDS = [
    "comparison-dumbbell",
    "dot-tally",
    "bar-race",
    "number-counter",
    "card-stack-cascade",
    "poll-results-bars",
    "sankey-flow",
    "funnel-conversion",
    "bubble-scatter-grow",
    "heatmap-calendar",
    "testimonial-card-carousel",
    "timeline-ruler",
    "split-compare",
    "stacked-area-flow",
    "cohort-regroup",
    "sample-scale-reveal",
    "kinetic-narration",
    "research-map-journey",
    "decision-path-explainer",
    "product-scene-focus",
  ];
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const fail = (s) => {
    throw new Error(s);
  };
  const obj = (v, name) => {
    if (!v || Array.isArray(v) || typeof v !== "object")
      fail(`${name} 必须是对象`);
  };
  const keys = (v, allowed, name) => {
    obj(v, name);
    for (const k of Object.keys(v))
      if (!allowed.includes(k)) fail(`${name}.${k} 不支持`);
  };
  const num = (v, name, lo = -1e9, hi = 1e9, integer = false) => {
    if (
      typeof v !== "number" ||
      !Number.isFinite(v) ||
      v < lo ||
      v > hi ||
      (integer && !Number.isInteger(v))
    )
      fail(`${name} 必须是 ${lo}–${hi} 的${integer ? "整数" : "数字"}`);
  };
  const str = (v, name, max = 180) => {
    if (typeof v !== "string" || [...v].length > max)
      fail(`${name} 必须是至多 ${max} 字的文字`);
  };
  const arr = (v, name, lo = 1, hi = 12) => {
    if (!Array.isArray(v) || v.length < lo || v.length > hi)
      fail(`${name} 需要 ${lo}–${hi} 项`);
  };
  const enumOf = (v, xs, name) => {
    if (!xs.includes(v)) fail(`${name} 只支持 ${xs.join(" / ")}`);
  };
  const colors = [
    "background",
    "ink",
    "accent",
    "beforeColor",
    "afterColor",
    "goodColor",
    "badColor",
  ];
  const STYLE = [
    "title",
    "subtitle",
    "fontFamily",
    "fontSize",
    "titleSize",
    "numberSize",
    "unit",
    "prefix",
    "decimals",
    "colors",
    ...colors,
  ];
  const OPTIONS = {
    "comparison-dumbbell": {
      beforeLabel: "上一期",
      afterLabel: "本期",
      sort: "none",
      showValues: true,
      showDelta: true,
      deltaMode: "absolute",
      goodDirection: "up",
      zeroBased: false,
    },
    "dot-tally": {
      cols: 20,
      markStyle: "fill",
      shuffle: false,
      seed: 7,
      legend: ["其他人群", "目标人群"],
      totalLabel: "目标人群 / 总人数",
    },
    "bar-race": { topN: 6, scale: "fixed", showRank: true, showPeriod: true },
    "number-counter": { mode: "tick", label: "净推荐值 NPS", separator: "," },
  };

  const RESEARCH = {
    "card-stack-cascade": {
      title: "研究总览 · 从指标到发现",
      data: {
        cards: [
          {
            title: "系统体验",
            body: "响应更快，常用任务路径缩短",
            value: "82分",
          },
          {
            title: "影像体验",
            body: "夜景与人像成为满意度提升的主要原因",
            value: "78分",
          },
          {
            title: "续航表现",
            body: "全天使用的安心感得到改善",
            value: "86分",
          },
          { title: "品牌推荐", body: "推荐意愿持续提升", value: "+12分" },
        ],
      },
      options: {
        layout: "bento",
        focusIndex: 1,
        focusAt: 2,
        focusHold: 1.8,
        dimTo: 0.22,
      },
    },
    "poll-results-bars": {
      title: "购买手机时，哪些因素最重要？",
      data: {
        options: [
          { label: "系统体验", value: 72 },
          { label: "影像表现", value: 65 },
          { label: "电池续航", value: 58 },
          { label: "外观设计", value: 36 },
        ],
      },
      options: {
        questionType: "multiple",
        inputMode: "percent",
        totalVotes: 200,
        highlight: 0,
        winnerLabel: "",
        order: "input",
        stagger: 0.18,
      },
    },
    "sankey-flow": {
      title: "品牌迁移 · 上一部到本次购买",
      data: {
        links: [
          { from: "品牌甲", to: "品牌甲", value: 60 },
          { from: "品牌甲", to: "品牌乙", value: 40 },
          { from: "品牌乙", to: "品牌甲", value: 20 },
          { from: "品牌乙", to: "品牌乙", value: 80 },
        ],
      },
      options: {
        highlight: "",
        nodeColors: {},
        showValues: true,
        linkOpacity: 0.5,
      },
    },
    "funnel-conversion": {
      title: "购买路径 · 从认知到下订",
      data: {
        stages: [
          { label: "听说", value: 1000 },
          { label: "考虑", value: 600 },
          { label: "进店", value: 360 },
          { label: "试驾", value: 180 },
          { label: "下订", value: 90 },
        ],
      },
      options: { rateMode: "previous", showConversion: true },
    },
    "bubble-scatter-grow": {
      title: "体验优先级 · 重视与满意",
      data: {
        records: [
          { name: "系统", importance: 85, satisfaction: 78, people: 200 },
          { name: "影像", importance: 78, satisfaction: 65, people: 150 },
          { name: "续航", importance: 92, satisfaction: 82, people: 250 },
          { name: "外观", importance: 58, satisfaction: 88, people: 100 },
        ],
      },
      options: {
        xMin: 0,
        xMax: 100,
        yMin: 0,
        yMax: 100,
        xLabel: "重视程度",
        yLabel: "满意度",
        sizeLabel: "气泡面积 = 涉及人数",
        xUnit: "分",
        yUnit: "分",
        referenceX: 70,
        referenceY: 75,
        highlight: "影像",
      },
    },
    "heatmap-calendar": {
      title: "功能使用 · 日历追踪",
      data: {
        records: [
          { date: "2026-10-01", value: 0 },
          { date: "2026-10-02", value: 5 },
          { date: "2026-10-03", value: 8 },
          { date: "2026-10-05", value: 3 },
          { date: "2026-10-08", value: 12 },
          { date: "2026-10-12", value: 7 },
          { date: "2026-10-16", value: 9 },
          { date: "2026-10-20", value: 2 },
          { date: "2026-10-25", value: 6 },
        ],
      },
      options: {
        startDate: "2026-10-01",
        endDate: "2026-10-31",
        levels: 5,
        maxValue: 12,
        highlight: "2026-10-08",
        showLegend: true,
      },
    },
    "testimonial-card-carousel": {
      title: "用户原声 · 真实体验片段",
      data: {
        testimonials: [
          {
            quote:
              "我最看重的是每天都能顺手使用。系统升级之后，常用功能更好找了，不需要在几个页面之间来回切换。",
            name: "受访者 P01",
            role: "重度通勤用户",
          },
          {
            quote:
              "拍照清晰当然重要，但我也希望电池能撑到晚上。对我来说，稳定的日常体验比某一个参数更有说服力。",
            name: "受访者 P02",
            role: "家庭影像记录者",
          },
        ],
      },
      options: {
        holdSeconds: 2,
        moveSeconds: 0.5,
        showAvatar: false,
        showRating: false,
      },
    },
    "timeline-ruler": {
      title: "追踪研究 · 关键节点",
      data: {
        events: [
          { date: "2026-09-01", title: "首周回访", body: "记录初次使用体验" },
          { date: "2026-09-20", title: "OTA 升级", body: "系统更新后补充回访" },
          {
            date: "2026-10-01",
            title: "首月回访",
            body: "关注习惯形成与新鲜感变化",
          },
          {
            date: "2026-12-01",
            title: "首季回访",
            body: "观察推荐意愿与长期满意度",
          },
        ],
      },
      options: { scale: "linear", highlight: 1 },
    },
    "split-compare": {
      title: "升级前后 · 操作路径对比",
      data: {
        left: { label: "升级前", desc: "三步进入设置", src: "", kind: "image" },
        right: {
          label: "升级后",
          desc: "一步打开常用功能",
          src: "",
          kind: "image",
        },
      },
      options: { divider: 0.5, syncStart: 0 },
    },
    "stacked-area-flow": {
      title: "品牌构成 · 随时间变化",
      data: {
        xLabels: ["首周", "首月", "首季", "半年"],
        series: [
          { name: "品牌甲", values: [40, 42, 46, 50] },
          { name: "品牌乙", values: [35, 34, 32, 30] },
          { name: "其他品牌", values: [25, 24, 22, 20] },
        ],
      },
      options: {
        stackMode: "percent",
        denominator: "各时点有效样本总数",
        highlight: "",
        showLegend: true,
      },
    },
  };
  for (const [id, x] of Object.entries(RESEARCH)) OPTIONS[id] = x.options;

  const ADVANCED = {
    "cohort-regroup": {
      title: "同一批用户 · 连续重新分组",
      data: {
        users: Array.from({ length: 48 }, (_, i) => ({
          id: `P${String(i + 1).padStart(3, "0")}`,
          brand: ["品牌甲", "品牌乙", "品牌丙"][i % 3],
          age: ["18–29岁", "30–44岁", "45岁及以上"][Math.floor(i / 4) % 3],
          label: `匿名受访者 ${i + 1}`,
          quote:
            i === 0
              ? "我更关注系统是否顺手，日常使用是否稳定。"
              : "日常体验比单一参数更重要。",
          weight: 1,
        })),
        aggregates: [],
      },
      options: {
        mode: "individual",
        sort: "id",
        fromLabel: "原有品牌",
        toLabel: "年龄分组",
        highlight: "30–44岁",
        selectedId: "P005",
        icon: "person",
        finalLayout: "grid",
        transitionSeconds: 1.5,
        colors: { 品牌甲: "#227F77", 品牌乙: "#5A7DBC", 品牌丙: "#B58458" },
      },
    },
    "sample-scale-reveal": {
      title: "从一个人 · 看到整组样本",
      data: {
        total: 1200,
        subgroup: 240,
        target: 360,
        person: {
          id: "P001",
          label: "受访者 P001",
          quote: "希望一天使用下来，手机仍然稳定、顺手。",
        },
      },
      options: {
        individualLabel: "个体",
        subgroupLabel: "核心用户群",
        totalLabel: "整体样本",
        targetLabel: "重度通勤用户",
        perMarker: 10,
        arrangement: "grid",
        cameraRoute: "zoom-out",
        individualHold: 1.5,
        subgroupHold: 1.5,
        highlightColor: "#227F77",
      },
    },
    "kinetic-narration": {
      title: "用户原声 · 转换为数据",
      data: {
        cues: [
          {
            start: 0.3,
            end: 2,
            text: "日常体验比单一参数更重要。",
            keywords: ["日常体验"],
            emphasis: "color",
          },
          {
            start: 2,
            end: 4,
            text: "有68%的受访者，优先考虑系统体验。",
            keywords: ["68%", "系统体验"],
            emphasis: "scale",
          },
          {
            start: 4,
            end: 7,
            text: "稳定与顺手，是购买决策的重要因素。",
            keywords: ["稳定", "顺手"],
            emphasis: "position",
          },
        ],
        chart: {
          templateId: "poll-results-bars",
          labels: ["优先考虑系统体验", "其他人群"],
          values: [68, 32],
          unit: "%",
          value: 68,
        },
      },
      options: {
        chartAt: 4,
        chartLabel: "优先考虑系统体验",
        conclusion: "日常体验，是持续使用与推荐的基础",
        conclusionAt: 8,
        minReadSeconds: 1.5,
      },
    },
    "research-map-journey": {
      title: "样本分布 · 城市研究之旅",
      data: {
        cities: [
          {
            id: "sh",
            name: "上海",
            lon: 121.4737,
            lat: 31.2304,
            sample: 300,
            value: 82,
            label: "满意度",
          },
          {
            id: "bj",
            name: "北京",
            lon: 116.4074,
            lat: 39.9042,
            sample: 260,
            value: 78,
            label: "满意度",
          },
          {
            id: "gz",
            name: "广州",
            lon: 113.2644,
            lat: 23.1291,
            sample: 240,
            value: 85,
            label: "满意度",
          },
        ],
        links: [],
      },
      options: {
        holdSeconds: 1.5,
        moveSeconds: 0.8,
        zoom: 2.4,
        pointStyle: "dot",
        mapColor: "#DDDCCF",
        highlightColor: "#227F77",
        order: ["sh", "bj", "gz"],
      },
    },
    "decision-path-explainer": {
      title: "购买决策 · 从推荐到购买",
      data: {
        nodes: [
          {
            id: "recommend",
            label: "看到推荐",
            icon: "message",
            x: 0.1,
            y: 0.25,
            at: 0.5,
            count: 1000,
            body: "朋友与社交媒体推荐",
          },
          {
            id: "search",
            label: "搜索资料",
            icon: "phone",
            x: 0.37,
            y: 0.25,
            at: 2,
            count: 650,
            body: "查阅参数、口碑与体验",
          },
          {
            id: "store",
            label: "线下体验",
            icon: "store",
            x: 0.64,
            y: 0.25,
            at: 4,
            count: 320,
            body: "体验手感、影像与系统",
          },
          {
            id: "buy",
            label: "比较后购买",
            icon: "person",
            x: 0.88,
            y: 0.25,
            at: 6,
            count: 180,
            body: "形成最终选择",
          },
          {
            id: "exit",
            label: "暂缓购买",
            icon: "exit",
            x: 0.64,
            y: 0.75,
            at: 5,
            count: 140,
            body: "等待降价或继续比较",
          },
        ],
        links: [
          { from: "recommend", to: "search", value: 650, at: 1, duration: 1 },
          { from: "search", to: "store", value: 320, at: 3, duration: 1 },
          { from: "store", to: "buy", value: 180, at: 5.5, duration: 1 },
          { from: "store", to: "exit", value: 140, at: 5, duration: 1 },
          { from: "exit", to: "search", value: 40, at: 7, duration: 1 },
        ],
      },
      options: { highlight: "", showCounts: true, markerIcon: "person" },
    },
    "product-scene-focus": {
      title: "操作位置 · 体验数据聚焦",
      data: {
        scene: "phone",
        regions: [
          {
            id: "camera",
            label: "影像入口",
            x: 0.25,
            y: 0.25,
            value: 78,
            unit: "分",
            body: "用户认为拍照入口更容易找到",
          },
          {
            id: "system",
            label: "系统交互",
            x: 0.7,
            y: 0.5,
            value: 82,
            unit: "分",
            body: "常用任务的完成路径更短",
          },
          {
            id: "battery",
            label: "续航状态",
            x: 0.55,
            y: 0.85,
            value: 86,
            unit: "分",
            body: "一天使用后的剩余电量更安心",
          },
        ],
      },
      options: {
        focusId: "system",
        focusAt: 3,
        moveSeconds: 1.2,
        holdSeconds: 2.5,
        returnAt: 7.5,
        asset: "",
      },
    },
  };
  Object.assign(RESEARCH, ADVANCED);
  for (const [id, x] of Object.entries(ADVANCED)) OPTIONS[id] = x.options;
  const ADVANCED_IDS = Object.keys(ADVANCED);
  const PRESETS = {
    "preset-cohort-story": {
      name: "用户重新分组",
      templateId: "cohort-regroup",
      phases: ["brand", "dimension", "highlight", "quote"],
    },
    "preset-sample-story": {
      name: "从一个人看到整组样本",
      templateId: "sample-scale-reveal",
      phases: ["individual", "subgroup", "total", "target"],
    },
    "preset-quote-data": {
      name: "原声变成数据",
      templateId: "kinetic-narration",
      phases: ["quote", "keyword", "number", "chart", "conclusion"],
    },
  };
  function preset(id) {
    const p = PRESETS[id];
    if (!p) fail("未知预设");
    const c = defaults(p.templateId);
    c.style.title = p.name;
    c.sequence = p.phases.map((phase) => ({
      phase,
      duration: phase === "conclusion" ? 3 : 2.5,
    }));
    c.timeline.duration = c.sequence.reduce((a, s) => a + s.duration, 0);
    c.timeline.hold = 0;
    return validate(c);
  }
  function validateAdvanced(c) {
    const {
      templateId: id,
      data: d,
      options: o,
      fieldMappings: m,
      timeline: t,
      camera,
    } = c;
    keys(camera, ["from", "to", "zoom", "route"], "camera");
    for (const k of ["from", "to"]) {
      arr(camera[k], `camera.${k}`, 2, 3);
      camera[k].forEach((v) => num(v, `camera.${k}`, -10000, 10000));
    }
    num(camera.zoom, "camera.zoom", 0.1, 20);
    enumOf(camera.route, ["smooth", "linear"], "camera.route");
    const unique = (rs, name) => {
      const seen = new Set();
      rs.forEach((r, i) => {
        str(r.id, `${name}[${i}].id`, 64);
        if (!r.id || seen.has(r.id)) fail(`${name}[${i}].id 为空或重复`);
        seen.add(r.id);
      });
    };
    if (id === "cohort-regroup") {
      keys(d, ["users", "aggregates"], "data");
      arr(d.users, "data.users", 0, 2000);
      arr(d.aggregates, "data.aggregates", 0, 16);
      enumOf(o.mode, ["individual", "aggregate"], "options.mode");
      enumOf(o.sort, ["id", "input"], "options.sort");
      enumOf(o.icon, ["dot", "person"], "options.icon");
      enumOf(o.finalLayout, ["grid", "bars"], "options.finalLayout");
      num(o.transitionSeconds, "options.transitionSeconds", 0.2, t.duration);
      obj(o.colors, "options.colors");
      for (const [k, v] of Object.entries(o.colors))
        color(v, `options.colors.${k}`);
      if (o.mode === "individual") {
        for (const k of ["id", "from", "to", "label", "quote", "weight"]) {
          str(m[k], `fieldMappings.${k}`, 64);
          if (!m[k]) fail(`fieldMappings.${k} 不能为空`);
        }
        const ids = new Set();
        d.users.forEach((r, i) => {
          obj(r, `data.users[${i}]`);
          for (const k of ["id", "from", "to", "label", "quote"])
            str(r[m[k]], `data.users[${i}].${m[k]}`, k === "quote" ? 500 : 80);
          if (!r[m.id] || ids.has(r[m.id]))
            fail(`data.users[${i}].${m.id} 为空或重复`);
          ids.add(r[m.id]);
          num(r[m.weight], `data.users[${i}].${m.weight}`, 0.000001, 1e9);
        });
        for (const dim of ["from", "to"])
          if (new Set(d.users.map((r) => r[m[dim]])).size > 8)
            fail(`fieldMappings.${dim}: 每维最多8组`);
        if (o.selectedId && !ids.has(o.selectedId))
          fail("options.selectedId: 没有此对象ID");
      } else {
        if (d.users.length)
          fail("data.users: 汇总模式请移除个体记录，只填写 aggregates");
        d.aggregates.forEach((r, i) => {
          keys(r, ["label", "value"], `data.aggregates[${i}]`);
          str(r.label, "label", 80);
          num(r.value, "value", 0);
        });
      }
    } else if (id === "sample-scale-reveal") {
      keys(d, ["total", "subgroup", "target", "person"], "data");
      num(d.total, "data.total", 0, 1e9, true);
      num(d.subgroup, "data.subgroup", 0, d.total, true);
      num(d.target, "data.target", 0, d.total, true);
      keys(d.person, ["id", "label", "quote"], "data.person");
      str(d.person.id, "data.person.id", 64);
      str(d.person.label, "data.person.label", 80);
      str(d.person.quote, "data.person.quote", 600);
      num(o.perMarker, "options.perMarker", 1, 1e8, true);
      if (Math.ceil(d.total / o.perMarker) > 2000)
        fail("options.perMarker: 最多2000个显示标记，请增加每标记人数");
      enumOf(o.arrangement, ["grid", "rows"], "options.arrangement");
      enumOf(o.cameraRoute, ["zoom-out", "pan-zoom"], "options.cameraRoute");
      num(o.individualHold, "options.individualHold", 0, t.duration);
      num(o.subgroupHold, "options.subgroupHold", 0, t.duration);
      if (o.individualHold + o.subgroupHold + 2 > t.duration)
        fail(
          "timeline.duration: 个体与子群停留之后须保留至少2秒展示整体与比例",
        );
      color(o.highlightColor, "options.highlightColor");
    } else if (id === "kinetic-narration") {
      keys(d, ["cues", "chart"], "data");
      arr(d.cues, "data.cues", 0, 120);
      let prev = -1;
      d.cues.forEach((r, i) => {
        keys(
          r,
          ["start", "end", "text", "keywords", "emphasis"],
          `data.cues[${i}]`,
        );
        num(r.start, `data.cues[${i}].start`, 0, t.duration);
        num(r.end, `data.cues[${i}].end`, r.start + 0.05, t.duration);
        if (r.start < prev) fail(`data.cues[${i}].start: 字幕不允许重叠或倒序`);
        prev = r.end;
        str(r.text, "text", 500);
        arr(r.keywords, "keywords", 0, 20);
        r.keywords.forEach((k) => {
          str(k, "keyword", 50);
          if (!r.text.includes(k)) fail(`keywords: “${k}” 不在该句中`);
        });
        enumOf(r.emphasis, ["color", "scale", "position"], "emphasis");
      });
      keys(
        d.chart,
        ["templateId", "labels", "values", "unit", "value"],
        "data.chart",
      );
      enumOf(
        d.chart.templateId,
        ["poll-results-bars", "number-counter"],
        "data.chart.templateId",
      );
      arr(d.chart.labels, "chart.labels", 1, 8);
      arr(
        d.chart.values,
        "chart.values",
        d.chart.labels.length,
        d.chart.labels.length,
      );
      d.chart.labels.forEach((x) => str(x, "chart.label", 80));
      d.chart.values.forEach((v) => num(v, "chart.value", 0));
      num(d.chart.value, "chart.value", 0);
      str(d.chart.unit, "chart.unit", 20);
      num(o.chartAt, "options.chartAt", 0, t.duration);
      num(o.conclusionAt, "options.conclusionAt", o.chartAt, t.duration);
      num(o.minReadSeconds, "options.minReadSeconds", 0.5, 30);
      if (t.duration - o.conclusionAt < o.minReadSeconds)
        fail("timeline.duration: 结论停留时间不足");
      if (
        d.chart.templateId === "poll-results-bars" &&
        d.chart.unit === "%" &&
        d.chart.values.some((v) => v > 100)
      )
        fail("data.chart.values: 百分比不能超过100");
      if (!d.chart.values.includes(d.chart.value))
        fail("data.chart.value 必须对应图表中的同一数值");
      if (
        d.cues.length &&
        !d.cues.some((r) =>
          r.text.replace(/\s/g, "").includes(`${d.chart.value}${d.chart.unit}`),
        )
      )
        fail(
          "data.chart.value: 字幕必须包含相同的数字与单位，修改数据时请同步修改对应短句",
        );
    } else if (id === "research-map-journey") {
      keys(d, ["cities", "links"], "data");
      arr(d.cities, "data.cities", 0, 30);
      unique(d.cities, "data.cities");
      d.cities.forEach((r, i) => {
        keys(
          r,
          ["id", "name", "lon", "lat", "sample", "value", "label"],
          `data.cities[${i}]`,
        );
        str(r.name, "name", 40);
        str(r.label, "label", 60);
        num(r.lon, "lon", -180, 180);
        num(r.lat, "lat", -85, 85);
        num(r.sample, "sample", 0, 1e9, true);
        num(r.value, "value");
      });
      arr(d.links, "data.links", 0, 60);
      const ids = d.cities.map((r) => r.id);
      d.links.forEach((r) => {
        keys(r, ["from", "to"], "link");
        enumOf(r.from, ids, "link.from");
        enumOf(r.to, ids, "link.to");
      });
      arr(o.order, "options.order", d.cities.length, d.cities.length);
      if (
        new Set(o.order).size !== ids.length ||
        o.order.some((v) => !ids.includes(v))
      )
        fail("options.order 必须完整且不重复地包含所有城市ID");
      num(o.holdSeconds, "holdSeconds", 0.1, 60);
      num(o.moveSeconds, "moveSeconds", 0.1, 10);
      num(o.zoom, "zoom", 1, 8);
      enumOf(o.pointStyle, ["dot", "pin"], "pointStyle");
      color(o.mapColor, "mapColor");
      color(o.highlightColor, "highlightColor");
      if (d.cities.length * (o.holdSeconds + o.moveSeconds) > t.duration)
        fail("timeline.duration: 不足以走完所有城市与停留");
    } else if (id === "decision-path-explainer") {
      keys(d, ["nodes", "links"], "data");
      arr(d.nodes, "data.nodes", 0, 20);
      unique(d.nodes, "data.nodes");
      const ids = d.nodes.map((r) => r.id);
      d.nodes.forEach((r, i) => {
        keys(
          r,
          ["id", "label", "icon", "x", "y", "at", "count", "body"],
          `data.nodes[${i}]`,
        );
        str(r.label, "label", 80);
        str(r.body, "body", 240);
        enumOf(r.icon, ["person", "phone", "message", "store", "exit"], "icon");
        num(r.x, "x", 0, 1);
        num(r.y, "y", 0, 1);
        num(r.at, "at", 0, t.duration);
        if (r.count !== undefined) num(r.count, "count", 0);
      });
      arr(d.links, "data.links", 0, 40);
      d.links.forEach((r, i) => {
        keys(r, ["from", "to", "value", "at", "duration"], `data.links[${i}]`);
        enumOf(r.from, ids, "from");
        enumOf(r.to, ids, "to");
        if (r.value !== undefined) num(r.value, "value", 0);
        num(r.at, "at", 0, t.duration);
        num(r.duration, "duration", 0.1, t.duration - r.at);
      });
    } else if (id === "product-scene-focus") {
      keys(d, ["scene", "regions"], "data");
      enumOf(d.scene, ["phone", "cockpit", "store"], "data.scene");
      arr(d.regions, "data.regions", 0, 12);
      unique(d.regions, "data.regions");
      d.regions.forEach((r, i) => {
        keys(
          r,
          ["id", "label", "x", "y", "value", "unit", "body"],
          `data.regions[${i}]`,
        );
        str(r.label, "label", 80);
        str(r.body, "body", 240);
        str(r.unit, "unit", 20);
        num(r.x, "x", 0, 1);
        num(r.y, "y", 0, 1);
        num(r.value, "value");
      });
      if (d.regions.length && !d.regions.some((r) => r.id === o.focusId))
        fail("options.focusId: 没有此区域");
      num(o.focusAt, "focusAt", 0, t.duration);
      num(o.moveSeconds, "moveSeconds", 0.1, t.duration);
      num(o.holdSeconds, "holdSeconds", 0, t.duration);
      num(
        o.returnAt,
        "returnAt",
        o.focusAt + o.moveSeconds + o.holdSeconds,
        t.duration - o.moveSeconds,
      );
      if (o.asset) media(o.asset);
    }
    if (c.sequence.length) {
      const allowed =
        id === "cohort-regroup"
          ? ["brand", "dimension", "highlight", "quote"]
          : id === "sample-scale-reveal"
            ? ["individual", "subgroup", "total", "target"]
            : id === "kinetic-narration"
              ? ["quote", "keyword", "number", "chart", "conclusion"]
              : [];
      arr(c.sequence, "sequence", 1, 20);
      let sum = 0;
      for (const [i, r] of c.sequence.entries()) {
        keys(r, ["phase", "duration"], `sequence[${i}]`);
        enumOf(r.phase, allowed, `sequence[${i}].phase`);
        num(r.duration, `sequence[${i}].duration`, 0.3, 120);
        sum += r.duration;
      }
      if (Math.abs(sum - t.duration) > 0.001)
        fail("sequence: 各阶段时长之和必须等于 timeline.duration");
    }
  }
  function advancedTable(c) {
    const d = c.data,
      id = c.templateId;
    if (id === "cohort-regroup") {
      if (c.options.mode === "aggregate")
        return [
          ["label", "value"],
          ...d.aggregates.map((r) => [r.label, r.value]),
        ];
      const m = c.fieldMappings,
        head = ["id", "from", "to", "label", "quote", "weight"].map(
          (k) => m[k],
        );
      return [head, ...d.users.map((r) => head.map((k) => r[k]))];
    }
    if (id === "sample-scale-reveal")
      return [
        ["total", "subgroup", "target", "id", "label", "quote"],
        [
          d.total,
          d.subgroup,
          d.target,
          d.person.id,
          d.person.label,
          d.person.quote,
        ],
      ];
    const spec = {
      "kinetic-narration": [
        "cues",
        ["start", "end", "text", "keywords", "emphasis"],
      ],
      "research-map-journey": [
        "cities",
        ["id", "name", "lon", "lat", "sample", "value", "label"],
      ],
      "decision-path-explainer": [
        "nodes",
        ["id", "label", "icon", "x", "y", "at", "count", "body"],
      ],
      "product-scene-focus": [
        "regions",
        ["id", "label", "x", "y", "value", "unit", "body"],
      ],
    }[id];
    return [
      spec[1],
      ...d[spec[0]].map((r) =>
        spec[1].map((k) =>
          Array.isArray(r[k]) ? r[k].join("|") : (r[k] ?? ""),
        ),
      ),
    ];
  }
  function importAdvanced(c, head, rows, n) {
    const expected = advancedTable(c)[0];
    if (JSON.stringify(head) !== JSON.stringify(expected))
      fail(`表头应为 ${expected.join(",")}`);
    const id = c.templateId,
      d = clone(c.data);
    if (id === "sample-scale-reveal") {
      if (rows.length !== 1) fail("样本层级只能一行");
      const r = rows[0];
      return {
        total: n(r[0]),
        subgroup: n(r[1]),
        target: n(r[2]),
        person: { id: r[3], label: r[4], quote: r[5] },
      };
    }
    const numerical = new Set(
      id === "cohort-regroup" && c.options.mode === "individual"
        ? [c.fieldMappings.weight]
        : [
            "value",
            "start",
            "end",
            "lon",
            "lat",
            "sample",
            "x",
            "y",
            "at",
            "count",
          ],
    );
    const rs = rows.map((r) =>
      Object.fromEntries(
        head.flatMap((k, i) =>
          k === "count" && r[i] === ""
            ? []
            : [
                [
                  k,
                  k === "keywords"
                    ? r[i].split("|").filter(Boolean)
                    : numerical.has(k)
                      ? n(r[i])
                      : r[i],
                ],
              ],
        ),
      ),
    );
    const key =
      id === "cohort-regroup"
        ? c.options.mode === "individual"
          ? "users"
          : "aggregates"
        : {
            "kinetic-narration": "cues",
            "research-map-journey": "cities",
            "decision-path-explainer": "nodes",
            "product-scene-focus": "regions",
          }[id];
    d[key] = rs;
    return d;
  }
  function importSubtitles(config, text) {
    const c = clone(config);
    if (c.templateId !== "kinetic-narration") fail("只有动态解说支持字幕");
    const clock = (s) => {
      const a = s.replace(",", ".").split(":").map(Number);
      return a.reduce((v, n) => v * 60 + n, 0);
    };
    const cues = [];
    for (const chunk of text
      .replace(/^\uFEFF/, "")
      .replace(/\r/g, "")
      .split(/\n\s*\n/)) {
      const ls = chunk.split("\n"),
        i = ls.findIndex((l) => l.includes("-->"));
      if (i < 0) continue;
      const match = ls[i].match(/([\d:. ,]+)\s*-->\s*([\d:.,]+)/);
      if (!match) fail("字幕时间格式不正确");
      cues.push({
        start: clock(match[1].trim()),
        end: clock(match[2].trim()),
        text: ls
          .slice(i + 1)
          .join("\n")
          .replace(/<[^>]*>/g, ""),
        keywords: [],
        emphasis: "color",
      });
    }
    if (!cues.length) fail("未找到 SRT/VTT 时间戳");
    c.data.cues = cues;
    c.timeline.duration = Math.max(
      c.timeline.duration,
      cues[cues.length - 1].end + c.options.minReadSeconds + 3,
    );
    c.options.chartAt = Math.max(
      c.options.chartAt,
      cues[cues.length - 1].start,
    );
    c.options.conclusionAt = Math.max(
      c.options.conclusionAt,
      cues[cues.length - 1].end,
    );
    return validate(c);
  }

  function defaults(id) {
    if (!IDS.includes(id)) fail(`未知模板 ${id}`);
    const data =
      {
        "comparison-dumbbell": {
          rows: [
            { label: "品牌甲", before: 42, after: 58 },
            { label: "品牌乙", before: 55, after: 63 },
            { label: "品牌丙", before: 61, after: 54 },
          ],
        },
        "dot-tally": {
          groups: [{ label: "购买时优先考虑产品体验", count: 100, marked: 68 }],
        },
        "bar-race": {
          names: ["品牌甲", "品牌乙", "品牌丙", "品牌丁"],
          frames: [
            { label: "2024", values: [32, 28, 20, 20] },
            { label: "2025", values: [29, 31, 24, 16] },
            { label: "2026", values: [35, 27, 26, 12] },
          ],
        },
        "number-counter": {
          keyframes: [
            [0, 12],
            [0.2, 12],
            [0.8, 46],
            [1, 46],
          ],
        },
      }[id] || clone(RESEARCH[id].data);
    const title =
      {
        "comparison-dumbbell": "品牌满意度 · 前后对比",
        "dot-tally": "购买决策 · 人群占比",
        "bar-race": "品牌偏好 · 年度追踪",
        "number-counter": "净推荐值 · 持续提升",
      }[id] || RESEARCH[id].title;
    const result = {
      schemaVersion: 1,
      templateId: id,
      templateVersion: VERSION,
      data,
      style: {
        title,
        subtitle: "重构调研 · 演示数据，非真实研究结论",
        background: "#F7F1E8",
        ink: "#243449",
        accent: "#227F77",
        beforeColor: "#9AA7B7",
        afterColor: "#227F77",
        goodColor: "#227F77",
        badColor: "#C65064",
        fontFamily: "local-gothic",
        fontSize: 30,
        titleSize: 58,
        numberSize: 220,
        unit: ["bar-race", "poll-results-bars"].includes(id)
          ? "%"
          : id === "research-map-journey"
            ? "分"
            : "",
        prefix: "",
        decimals: 0,
        colors: [
          "#227F77",
          "#5A7DBC",
          "#B58458",
          "#9E77B4",
          "#C65064",
          "#4B92A6",
        ],
      },
      camera: ADVANCED_IDS.includes(id)
        ? { from: [0, 0], to: [0, 0], zoom: 2, route: "smooth" }
        : {},
      sequence: [],
      fieldMappings:
        id === "cohort-regroup"
          ? {
              id: "id",
              from: "brand",
              to: "age",
              label: "label",
              quote: "quote",
              weight: "weight",
            }
          : id === "bubble-scatter-grow"
            ? {
                label: "name",
                x: "importance",
                y: "satisfaction",
                size: "people",
              }
            : {},
      metadata: {
        source: "演示研究，非真实结论",
        sampleSize: 200,
        researchTime: "2026年10月",
        showSource: true,
        showSampleSize: true,
        showResearchTime: true,
        showTitle: true,
        showSubtitle: true,
      },
      options: clone(OPTIONS[id]),
      timeline: {
        duration: ADVANCED_IDS.includes(id) ? 12 : 6,
        entrance: 0.3,
        hold: 1,
        inPoint: 0,
        outPoint: 1,
        currentTime: 0,
      },
      output: { width: 1920, height: 1080, fps: 60 },
      demo: true,
    };
    result.metadata.sampleSize =
      {
        "cohort-regroup": 48,
        "sample-scale-reveal": 1200,
        "research-map-journey": 800,
        "funnel-conversion": 1000,
      }[id] ?? 200;
    return result;
  }
  function validate(c) {
    keys(
      c,
      [
        "schemaVersion",
        "templateId",
        "templateVersion",
        "data",
        "style",
        "options",
        "timeline",
        "output",
        "demo",
        "fieldMappings",
        "metadata",
        "camera",
        "sequence",
      ],
      "config",
    );
    if (c.schemaVersion !== 1) fail("schemaVersion 必须是 1");
    enumOf(c.templateId, IDS, "templateId");
    if (c.templateVersion !== VERSION)
      fail("templateVersion 不匹配，请显式迁移后再打开");
    const id = c.templateId,
      d = c.data,
      s = c.style,
      o = c.options,
      t = c.timeline,
      out = c.output;
    keys(s, STYLE, "style");
    for (const k of ["title", "subtitle", "unit", "prefix"])
      str(s[k], `style.${k}`, k === "subtitle" ? 240 : 100);
    enumOf(
      s.fontFamily,
      ["local-gothic", "system-sans", "system-serif"],
      "fontFamily",
    );
    for (const [k, lo, hi] of [
      ["fontSize", 16, 46],
      ["titleSize", 24, 80],
      ["numberSize", 60, 280],
      ["decimals", 0, 3],
    ])
      num(s[k], k, lo, hi, true);
    for (const k of colors)
      if (!/^#[0-9a-f]{6}$/i.test(s[k])) fail(`${k} 需要 #RRGGBB`);
    arr(s.colors, "style.colors", 1, 12);
    s.colors.forEach((v) => {
      if (!/^#[0-9a-f]{6}$/i.test(v)) fail("colors 需要 #RRGGBB");
    });
    keys(o, Object.keys(OPTIONS[id]), "options");
    for (const [k, v] of Object.entries(OPTIONS[id])) {
      if (typeof v === "boolean" && typeof o[k] !== "boolean")
        fail(`${k} 必须为布尔值`);
      else if (typeof v === "string") str(o[k], k);
    }
    keys(
      t,
      ["duration", "entrance", "hold", "inPoint", "outPoint", "currentTime"],
      "timeline",
    );
    num(t.entrance, "timeline.entrance", 0, 299);
    num(t.hold, "timeline.hold", 0, 299);
    if (t.entrance + t.hold >= t.duration)
      fail("timeline: 入场与停留之和须小于持续时间");
    keys(
      c.metadata,
      [
        "source",
        "sampleSize",
        "researchTime",
        "showSource",
        "showSampleSize",
        "showResearchTime",
        "showTitle",
        "showSubtitle",
      ],
      "metadata",
    );
    str(c.metadata.source, "metadata.source", 180);
    str(c.metadata.researchTime, "metadata.researchTime", 80);
    num(c.metadata.sampleSize, "metadata.sampleSize", 0, 1e9, true);
    for (const k of [
      "showSource",
      "showSampleSize",
      "showResearchTime",
      "showTitle",
      "showSubtitle",
    ])
      if (typeof c.metadata[k] !== "boolean")
        fail(`metadata.${k} 必须为布尔值`);
    keys(
      c.fieldMappings,
      id === "cohort-regroup"
        ? ["id", "from", "to", "label", "quote", "weight"]
        : id === "bubble-scatter-grow"
          ? ["label", "x", "y", "size"]
          : [],
      "fieldMappings",
    );
    num(t.duration, "duration", 0.5, 300);
    num(t.inPoint, "inPoint", 0, 1);
    num(t.outPoint, "outPoint", 0, 1);
    if (t.outPoint <= t.inPoint) fail("outPoint 必须大于 inPoint");
    num(t.currentTime, "currentTime", 0, t.duration);
    keys(out, ["width", "height", "fps"], "output");
    for (const k of ["width", "height"]) {
      num(out[k], k, 240, 3840, true);
      if (out[k] % 2) fail(`${k} 必须为偶数`);
    }
    if (out.width / out.height < 0.5 || out.width / out.height > 2.4)
      fail("画面比例支持 1:2 至 2.4:1");
    enumOf(out.fps, [24, 25, 30, 50, 60], "fps");
    if (typeof c.demo !== "boolean") fail("demo 必须为布尔值");
    if (id === "comparison-dumbbell") {
      keys(d, ["rows"], "data");
      arr(d.rows, "rows", 1, 8);
      d.rows.forEach((r, i) => {
        keys(r, ["label", "before", "after"], `rows[${i}]`);
        str(r.label, "label", 40);
        num(r.before, "before");
        num(r.after, "after");
      });
      enumOf(o.sort, ["none", "delta", "after", "before"], "sort");
      enumOf(o.deltaMode, ["absolute", "percent"], "deltaMode");
      enumOf(o.goodDirection, ["up", "down"], "goodDirection");
    } else if (id === "dot-tally") {
      keys(d, ["groups"], "data");
      arr(d.groups, "groups", 1, 4);
      d.groups.forEach((g) => {
        keys(g, ["label", "count", "marked"], "group");
        str(g.label, "label", 40);
        num(g.count, "count", 1, 400, true);
        num(g.marked, "marked", 0, g.count, true);
      });
      if (d.groups.reduce((a, g) => a + g.count, 0) > 600)
        fail("点阵总人数上限 600");
      num(o.cols, "cols", 4, 40, true);
      num(o.seed, "seed", 0, 1e9, true);
      enumOf(o.markStyle, ["fill", "ring", "cross"], "markStyle");
      arr(o.legend, "legend", 2, 2);
      o.legend.forEach((x) => str(x, "legend", 24));
    } else if (id === "bar-race") {
      keys(d, ["names", "frames"], "data");
      arr(d.names, "names", 1, 10);
      d.names.forEach((n) => str(n, "name", 40));
      if (new Set(d.names).size !== d.names.length) fail("品牌名称不能重复");
      arr(d.frames, "frames", 1, 120);
      d.frames.forEach((f) => {
        keys(f, ["label", "values"], "frame");
        str(f.label, "period", 30);
        arr(f.values, "values", d.names.length, d.names.length);
        f.values.forEach((v) => num(v, "value", 0));
      });
      num(o.topN, "topN", 1, 10, true);
      enumOf(o.scale, ["fixed", "dynamic"], "scale");
    } else if (id === "number-counter") {
      keys(d, ["keyframes"], "data");
      arr(d.keyframes, "keyframes", 2, 120);
      let prev = -1;
      d.keyframes.forEach((k) => {
        arr(k, "keyframe", 2, 2);
        num(k[0], "keyframe progress", 0, 1);
        num(k[1], "keyframe value");
        if (k[0] <= prev) fail("关键帧进度必须严格递增");
        prev = k[0];
      });
      enumOf(o.mode, ["tick", "roll"], "mode");
      if (
        o.mode === "roll" &&
        (s.decimals > 0 || d.keyframes.some((k) => k[1] < 0))
      )
        fail("滚动数字仅支持非负整数；负值 NPS 或小数请选 tick");
    }
    if (ADVANCED_IDS.includes(id)) validateAdvanced(c);
    else {
      keys(c.camera, [], "camera");
      arr(c.sequence, "sequence", 0, 0);
      if (RESEARCH[id]) validateResearch(c);
    }
    return clone(c);
  }
  // RFC 4180 quoted cells, BOM, CRLF and spreadsheet tabs; no Number('') coercion.
  function parseTable(text) {
    str(text, "CSV", 200000);
    text = text.replace(/^\uFEFF/, "");
    let headerQuoted = false,
      tabs = 0,
      commas = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') {
        if (headerQuoted && text[i + 1] === '"') {
          i++;
          continue;
        }
        headerQuoted = !headerQuoted;
      } else if (!headerQuoted) {
        if (ch === "\r" || ch === "\n") break;
        if (ch === "\t") tabs++;
        if (ch === ",") commas++;
      }
    }
    const sep = tabs > 0 && commas === 0 ? "\t" : ",";
    const rows = [],
      row = [];
    let cell = "",
      quote = false,
      ended = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quote) {
        if (ch === '"' && text[i + 1] === '"') {
          cell += '"';
          i++;
        } else if (ch === '"') {
          quote = false;
          ended = true;
        } else cell += ch;
      } else if (ch === '"') {
        if (cell || ended) fail("CSV 引号位置不正确");
        quote = true;
      } else if (ch === sep || ch === "\n" || ch === "\r") {
        row.push(cell.trim());
        cell = "";
        ended = false;
        if (ch !== sep) {
          if (row.some(Boolean)) rows.push(row.splice(0));
          else row.length = 0;
          if (ch === "\r" && text[i + 1] === "\n") i++;
        }
      } else {
        if (ended && ch.trim()) fail("CSV 引号后只能是分隔符");
        cell += ch;
      }
    }
    if (quote) fail("CSV 引号没有闭合");
    row.push(cell.trim());
    if (row.some(Boolean)) rows.push(row);
    if (rows.length < 2) fail("表格需要表头和至少一行数据");
    if (rows.some((r) => r.length !== rows[0].length))
      fail("每行列数必须与表头一致");
    return rows;
  }
  function table(c) {
    const d = c.data;
    if (c.templateId === "comparison-dumbbell")
      return [
        ["label", "before", "after"],
        ...d.rows.map((r) => [r.label, r.before, r.after]),
      ];
    if (c.templateId === "dot-tally")
      return [
        ["label", "count", "marked"],
        ...d.groups.map((g) => [g.label, g.count, g.marked]),
      ];
    if (c.templateId === "bar-race")
      return [
        ["period", ...d.names],
        ...d.frames.map((f) => [f.label, ...f.values]),
      ];
    if (c.templateId === "number-counter")
      return [["progress", "value"], ...d.keyframes];
    return researchTable(c);
  }
  const csv = (c) =>
    table(c)
      .map((r) =>
        r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(","),
      )
      .join("\n");
  function importTable(config, text) {
    const c = clone(config),
      [head, ...rs] = parseTable(text);
    const n = (v) => {
      if (!v || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(v)) {
        const id = c.templateId,
          columns =
            {
              "comparison-dumbbell": ["before", "after"],
              "dot-tally": ["count", "marked"],
              "number-counter": ["progress", "value"],
              "poll-results-bars": ["value"],
              "sankey-flow": ["value"],
              "funnel-conversion": ["value"],
              "heatmap-calendar": ["value"],
              "testimonial-card-carousel": ["rating"],
              "sample-scale-reveal": ["total", "subgroup", "target"],
              "kinetic-narration": ["start", "end"],
              "decision-path-explainer": ["x", "y", "at", "count"],
              "product-scene-focus": ["x", "y", "value"],
              "bubble-scatter-grow": [
                c.fieldMappings.x,
                c.fieldMappings.y,
                c.fieldMappings.size,
              ],
              "cohort-regroup": [
                c.options.mode === "aggregate"
                  ? "value"
                  : c.fieldMappings.weight,
              ],
            }[id] || [];
        for (let i = 0; i < rs.length; i++)
          for (let j = 0; j < head.length; j++)
            if (
              rs[i][j] === v &&
              (columns.includes(head[j]) ||
                (["bar-race", "stacked-area-flow"].includes(id) && j > 0))
            )
              fail(
                `CSV 第${i + 2}行.${head[j]}：“${v}” 不是数字，请填写数值（百分号写在单位中）`,
              );
        fail(`“${v}” 不是数字，请填写数值（百分号写在单位中）`);
      }
      return Number(v);
    };
    const id = c.templateId,
      expected = {
        "comparison-dumbbell": ["label", "before", "after"],
        "dot-tally": ["label", "count", "marked"],
        "number-counter": ["progress", "value"],
      }[id];
    if (expected && JSON.stringify(head) !== JSON.stringify(expected))
      fail(`表头应为 ${expected.join(",")}`);
    if (id === "comparison-dumbbell")
      c.data = {
        rows: rs.map((r) => ({ label: r[0], before: n(r[1]), after: n(r[2]) })),
      };
    else if (id === "dot-tally")
      c.data = {
        groups: rs.map((r) => ({
          label: r[0],
          count: n(r[1]),
          marked: n(r[2]),
        })),
      };
    else if (id === "bar-race") {
      if (head[0] !== "period" || head.length < 2)
        fail("第一列表头为 period，之后为各品牌名称");
      c.data = {
        names: head.slice(1),
        frames: rs.map((r) => ({ label: r[0], values: r.slice(1).map(n) })),
      };
    } else if (id === "number-counter")
      c.data = { keyframes: rs.map((r) => r.map(n)) };
    else c.data = importResearch(c, head, rs, n);
    return validate(c);
  }
  function toProps(config) {
    const c = validate(config),
      s = c.style,
      o = c.options,
      d = c.data;
    const p = {
      ...o,
      title: s.title,
      subtitle: s.subtitle,
      background: s.background,
      ink: s.ink,
      accent: s.accent,
      fontFamily: s.fontFamily,
      prefix: s.prefix,
      suffix: s.unit,
      decimals: s.decimals,
    };
    if (c.templateId === "comparison-dumbbell")
      Object.assign(p, {
        data: d.rows,
        beforeColor: s.beforeColor,
        afterColor: s.afterColor,
        goodColor: s.goodColor,
        badColor: s.badColor,
        startAt: 10,
        speed: 1,
      });
    if (c.templateId === "dot-tally")
      Object.assign(p, {
        groups: d.groups,
        total: "",
        markStart: 30,
        stagger: 1,
        groupGap: 14,
      });
    if (c.templateId === "bar-race")
      Object.assign(p, {
        names: d.names,
        frames: d.frames,
        colors: s.colors,
        startAt: 8,
        stepFrames: 34,
        speed: 1,
      });
    if (c.templateId === "number-counter")
      Object.assign(p, {
        keyframes: d.keyframes.map((k) => [k[0] * 180, k[1]]),
        unit: s.unit,
        size: s.numberSize,
        labelSize: s.fontSize,
        labelColor: s.ink,
        numberColor: s.accent,
        readouts: [],
        backdrop: "ink",
      });
    return p;
  }
  function dateNumber(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
      fail(`日期 “${value}” 应为 YYYY-MM-DD`);
    const n = Date.parse(value + "T00:00:00Z");
    if (!Number.isFinite(n) || new Date(n).toISOString().slice(0, 10) !== value)
      fail(`日期 “${value}” 不存在`);
    return n;
  }
  const color = (v, name) => {
    if (v !== undefined && !/^#[0-9a-f]{6}$/i.test(v))
      fail(`${name} 需要 #RRGGBB`);
  };
  const media = (v, kind = "image") => {
    if (typeof v !== "string" || v.length > 150000000)
      fail("素材必须是小于100MB的本地文件");
    if (
      v &&
      !(
        kind === "video"
          ? /^data:video\/(mp4|webm|quicktime);base64,/
          : /^data:image\/(png|jpeg|webp);base64,/
      ).test(v)
    )
      fail("素材需导入本地 PNG/JPEG/WebP 或 MP4/WebM 视频（随项目内嵌保存）");
  };
  function validateResearch(c) {
    const { templateId: id, data: d, options: o, fieldMappings: m } = c;
    const list = (name, max, fields, check) => {
      keys(d, [name], "data");
      arr(d[name], `data.${name}`, 0, max);
      d[name].forEach((r, i) => {
        const path = `data.${name}[${i}]`;
        keys(r, fields, path);
        try {
          check(r, i);
        } catch (e) {
          fail(`${path}: ${e.message}`);
        }
      });
    };
    if (id === "card-stack-cascade") {
      list("cards", 8, ["title", "body", "value", "color"], (r) => {
        str(r.title, "title", 60);
        str(r.body, "body", 300);
        str(r.value, "value", 32);
        color(r.color, "color");
      });
      enumOf(o.layout, ["bento", "row", "stack"], "options.layout");
      num(
        o.focusIndex,
        "options.focusIndex",
        0,
        Math.max(0, d.cards.length - 1),
        true,
      );
      num(o.focusAt, "options.focusAt", 0, c.timeline.duration);
      num(o.focusHold, "options.focusHold", 0, c.timeline.duration);
      num(o.dimTo, "options.dimTo", 0, 1);
      if (o.focusAt + o.focusHold > c.timeline.duration)
        fail("options.focusHold: 聚焦结束不能晚于片段结束");
    } else if (id === "poll-results-bars") {
      list("options", 8, ["label", "value"], (r) => {
        str(r.label, "label", 80);
        num(r.value, "value", 0, 1e9);
      });
      enumOf(o.questionType, ["single", "multiple"], "options.questionType");
      enumOf(o.inputMode, ["count", "percent"], "options.inputMode");
      enumOf(o.order, ["input", "descending", "ascending"], "options.order");
      num(o.totalVotes, "options.totalVotes", 0, 1e9, true);
      num(
        o.highlight,
        "options.highlight",
        -1,
        Math.max(0, d.options.length - 1),
        true,
      );
      num(o.stagger, "options.stagger", 0, 1);
      if (o.inputMode === "count" && d.options.length && o.totalVotes === 0)
        fail("options.totalVotes: 输入人数时有效样本数必须大于零");
      d.options.forEach((r, i) => {
        if (r.value > (o.inputMode === "percent" ? 100 : o.totalVotes))
          fail(
            `data.options[${i}].value: 超过${o.inputMode === "percent" ? "100%" : "有效样本数"}`,
          );
      });
      const sum = d.options.reduce((a, r) => a + r.value, 0);
      if (
        o.questionType === "single" &&
        sum > (o.inputMode === "percent" ? 100 : o.totalVotes) + 1e-8
      )
        fail("data.options: 单选题合计不能超过有效样本数或100%");
    } else if (id === "sankey-flow") {
      list("links", 40, ["from", "to", "value", "color"], (r) => {
        str(r.from, "from", 36);
        str(r.to, "to", 36);
        if (!r.from || !r.to) fail("from/to 不能为空");
        num(r.value, "value", 0);
        color(r.color, "color");
      });
      if (
        new Set(d.links.map((r) => r.from)).size > 8 ||
        new Set(d.links.map((r) => r.to)).size > 8
      )
        fail("data.links: 每侧最多8个品牌");
      num(o.linkOpacity, "options.linkOpacity", 0.1, 1);
      obj(o.nodeColors, "options.nodeColors");
      for (const [k, v] of Object.entries(o.nodeColors)) {
        str(k, "node", 36);
        color(v, `nodeColors.${k}`);
      }
    } else if (id === "funnel-conversion") {
      let prev = Infinity;
      list("stages", 8, ["label", "value", "color"], (r) => {
        str(r.label, "label", 40);
        num(r.value, "value", 0);
        if (r.value > prev) fail("value: 后一阶段人数不能超过上一阶段");
        prev = r.value;
        color(r.color, "color");
      });
      enumOf(o.rateMode, ["previous", "first"], "options.rateMode");
    } else if (id === "bubble-scatter-grow") {
      keys(d, ["records"], "data");
      arr(d.records, "data.records", 0, 40);
      for (const k of ["label", "x", "y", "size"]) {
        str(m[k], `fieldMappings.${k}`, 60);
        if (!m[k]) fail(`fieldMappings.${k} 不能为空`);
      }
      d.records.forEach((r, i) => {
        obj(r, `data.records[${i}]`);
        str(r[m.label], `data.records[${i}].${m.label}`, 40);
        for (const k of ["x", "y", "size"])
          num(r[m[k]], `data.records[${i}].${m[k]}`, k === "size" ? 0 : -1e9);
        color(r.color, `data.records[${i}].color`);
        if (
          r[m.x] < o.xMin ||
          r[m.x] > o.xMax ||
          r[m.y] < o.yMin ||
          r[m.y] > o.yMax
        )
          fail(`data.records[${i}]: 坐标超出设定范围`);
      });
      for (const k of [
        "xMin",
        "xMax",
        "yMin",
        "yMax",
        "referenceX",
        "referenceY",
      ])
        num(o[k], `options.${k}`);
      if (o.xMax <= o.xMin || o.yMax <= o.yMin)
        fail("options: 坐标上限必须大于下限");
      for (const k of ["xLabel", "yLabel", "sizeLabel", "xUnit", "yUnit"])
        str(o[k], `options.${k}`, 60);
    } else if (id === "heatmap-calendar") {
      const start = dateNumber(o.startDate),
        end = dateNumber(o.endDate);
      if (end < start || end - start > 370 * 86400000)
        fail("options.endDate: 时间范围最多371天且不能早于开始日期");
      num(o.levels, "options.levels", 3, 8, true);
      num(o.maxValue, "options.maxValue", 0.000001, 1e9);
      if (o.highlight) dateNumber(o.highlight);
      const seen = new Set();
      list("records", 371, ["date", "value"], (r) => {
        const at = dateNumber(r.date);
        if (at < start || at > end) fail("date 超出时间范围");
        if (seen.has(r.date)) fail("date 重复");
        seen.add(r.date);
        num(r.value, "value", 0, o.maxValue);
      });
    } else if (id === "testimonial-card-carousel") {
      list("testimonials", 10, ["quote", "name", "role", "rating"], (r) => {
        str(r.quote, "quote", 1200);
        str(r.name, "name", 60);
        str(r.role, "role", 120);
        if (r.rating !== undefined) num(r.rating, "rating", 0, 5);
      });
      num(o.holdSeconds, "options.holdSeconds", 0.3, 120);
      num(o.moveSeconds, "options.moveSeconds", 0.1, 5);
      const need =
        d.testimonials.length * o.holdSeconds +
        Math.max(0, d.testimonials.length - 1) * o.moveSeconds +
        c.timeline.entrance;
      if (d.testimonials.length && c.timeline.duration + 1e-6 < need)
        fail(
          `timeline.duration: 至少 ${need.toFixed(1)} 秒才能按停留时长完整展示所有原声`,
        );
    } else if (id === "timeline-ruler") {
      let prev = -Infinity;
      list("events", 10, ["date", "title", "body", "image"], (r) => {
        const at = dateNumber(r.date);
        if (at < prev) fail("date: 事件必须按时间先后排列");
        prev = at;
        str(r.title, "title", 60);
        str(r.body, "body", 240);
        if (r.image) media(r.image);
      });
      enumOf(o.scale, ["linear", "even"], "options.scale");
      num(
        o.highlight,
        "options.highlight",
        -1,
        Math.max(0, d.events.length - 1),
        true,
      );
    } else if (id === "split-compare") {
      keys(d, ["left", "right"], "data");
      for (const k of ["left", "right"]) {
        keys(d[k], ["label", "desc", "src", "kind"], `data.${k}`);
        str(d[k].label, `data.${k}.label`, 80);
        str(d[k].desc, `data.${k}.desc`, 240);
        enumOf(d[k].kind, ["image", "video"], `data.${k}.kind`);
        media(d[k].src, d[k].kind);
      }
      num(o.divider, "options.divider", 0.2, 0.8);
      num(o.syncStart, "options.syncStart", 0, 36000);
    } else if (id === "stacked-area-flow") {
      keys(d, ["xLabels", "series"], "data");
      arr(d.xLabels, "data.xLabels", 0, 120);
      d.xLabels.forEach((x) => str(x, "xLabel", 40));
      arr(d.series, "data.series", 0, 8);
      d.series.forEach((r, i) => {
        keys(r, ["name", "values", "color"], `data.series[${i}]`);
        str(r.name, "name", 40);
        arr(
          r.values,
          `data.series[${i}].values`,
          d.xLabels.length,
          d.xLabels.length,
        );
        r.values.forEach((v, j) => num(v, `data.series[${i}].values[${j}]`, 0));
        color(r.color, "color");
      });
      enumOf(o.stackMode, ["absolute", "percent"], "options.stackMode");
      str(o.denominator, "options.denominator", 100);
      if (o.stackMode === "percent" && !o.denominator)
        fail("options.denominator: 百分比堆叠必须说明分母");
      if (new Set(d.series.map((r) => r.name)).size !== d.series.length)
        fail("data.series: 名称不能重复");
    }
  }
  function researchTable(c) {
    const d = c.data,
      id = c.templateId;
    if (ADVANCED_IDS.includes(id)) return advancedTable(c);
    if (id === "split-compare")
      return [
        ["side", "label", "desc", "src", "kind"],
        ...["left", "right"].map((k) => [
          k,
          d[k].label,
          d[k].desc,
          d[k].src,
          d[k].kind,
        ]),
      ];
    if (id === "stacked-area-flow")
      return [
        ["period", ...d.series.map((s) => s.name)],
        ...d.xLabels.map((l, i) => [l, ...d.series.map((s) => s.values[i])]),
      ];
    const spec = {
      "card-stack-cascade": ["cards", ["title", "body", "value", "color"]],
      "poll-results-bars": ["options", ["label", "value"]],
      "sankey-flow": ["links", ["from", "to", "value", "color"]],
      "funnel-conversion": ["stages", ["label", "value", "color"]],
      "bubble-scatter-grow": [
        "records",
        [
          c.fieldMappings.label,
          c.fieldMappings.x,
          c.fieldMappings.y,
          c.fieldMappings.size,
          "color",
        ],
      ],
      "heatmap-calendar": ["records", ["date", "value"]],
      "testimonial-card-carousel": [
        "testimonials",
        ["quote", "name", "role", "rating"],
      ],
      "timeline-ruler": ["events", ["date", "title", "body", "image"]],
    }[id];
    return [spec[1], ...d[spec[0]].map((r) => spec[1].map((k) => r[k] ?? ""))];
  }
  function importResearch(c, head, rows, n) {
    const id = c.templateId;
    if (ADVANCED_IDS.includes(id)) return importAdvanced(c, head, rows, n);
    if (id === "split-compare") {
      if (JSON.stringify(head) !== JSON.stringify(researchTable(c)[0]))
        fail("表头必须为 side,label,desc,src,kind");
      const out = {};
      rows.forEach((r) => {
        enumOf(r[0], ["left", "right"], "side");
        if (out[r[0]]) fail("side 重复");
        out[r[0]] = { label: r[1], desc: r[2], src: r[3], kind: r[4] };
      });
      return out;
    }
    if (id === "stacked-area-flow") {
      if (head[0] !== "period" || head.length < 2)
        fail("表头第一列为 period，之后为系列名");
      return {
        xLabels: rows.map((r) => r[0]),
        series: head
          .slice(1)
          .map((name, i) => ({ name, values: rows.map((r) => n(r[i + 1])) })),
      };
    }
    const [expected] = researchTable(c);
    if (JSON.stringify(head) !== JSON.stringify(expected))
      fail(`表头应为 ${expected.join(",")}`);
    const numerical = new Set(
      id === "bubble-scatter-grow"
        ? [c.fieldMappings.x, c.fieldMappings.y, c.fieldMappings.size]
        : id === "testimonial-card-carousel"
          ? ["rating"]
          : [
                "poll-results-bars",
                "sankey-flow",
                "funnel-conversion",
                "heatmap-calendar",
              ].includes(id)
            ? ["value"]
            : [],
    );
    const records = rows.map((r) =>
      Object.fromEntries(
        head.flatMap((k, i) =>
          r[i] === "" && ["color", "rating", "image"].includes(k)
            ? []
            : [[k, numerical.has(k) ? n(r[i]) : r[i]]],
        ),
      ),
    );
    const key = {
      "card-stack-cascade": "cards",
      "poll-results-bars": "options",
      "sankey-flow": "links",
      "funnel-conversion": "stages",
      "bubble-scatter-grow": "records",
      "heatmap-calendar": "records",
      "testimonial-card-carousel": "testimonials",
      "timeline-ruler": "events",
    }[id];
    return { [key]: records };
  }
  // Numeric semantics are shared with tests and AI, rather than hiding calculations in paint code.
  function researchValues(c) {
    validate(c);
    const { templateId: id, data: d, options: o } = c;
    if (id === "poll-results-bars")
      return d.options.map((r, i) => ({
        ...r,
        index: i,
        percent:
          o.inputMode === "percent" ? r.value : (100 * r.value) / o.totalVotes,
      }));
    if (id === "funnel-conversion")
      return d.stages.map((r, i) => ({
        ...r,
        denominator:
          o.rateMode === "first"
            ? d.stages[0].value
            : i
              ? d.stages[i - 1].value
              : r.value,
        rate:
          (o.rateMode === "first"
            ? d.stages[0].value
            : i
              ? d.stages[i - 1].value
              : r.value) === 0
            ? null
            : (100 * r.value) /
              (o.rateMode === "first"
                ? d.stages[0].value
                : i
                  ? d.stages[i - 1].value
                  : r.value),
      }));
    if (id === "bubble-scatter-grow")
      return d.records.map((r) => ({
        label: r[c.fieldMappings.label],
        x: r[c.fieldMappings.x],
        y: r[c.fieldMappings.y],
        size: r[c.fieldMappings.size],
        color: r.color,
      }));
    if (id === "heatmap-calendar") {
      const map = new Map(d.records.map((r) => [r.date, r.value]));
      return Array.from(
        {
          length:
            Math.round(
              (dateNumber(o.endDate) - dateNumber(o.startDate)) / 86400000,
            ) + 1,
        },
        (_, i) => {
          const date = new Date(dateNumber(o.startDate) + i * 86400000)
            .toISOString()
            .slice(0, 10);
          return { date, value: map.has(date) ? map.get(date) : null };
        },
      );
    }
    if (id === "stacked-area-flow")
      return d.xLabels.map((label, i) => {
        const total = d.series.reduce((a, s) => a + s.values[i], 0);
        return {
          label,
          total,
          values: d.series.map((s) =>
            o.stackMode === "percent"
              ? total > 0
                ? (100 * s.values[i]) / total
                : 0
              : s.values[i],
          ),
          missingDenominator: o.stackMode === "percent" && total === 0,
        };
      });
    return clone(d);
  }

  function fromAI(id, input, line = "") {
    keys(
      input,
      [
        "data",
        "style",
        "options",
        "metadata",
        "timeline",
        "output",
        "fieldMappings",
        "camera",
        "sequence",
      ],
      "motionInput",
    );
    if (!input.data)
      fail("motionInput.data: 必须提供真实原始数据，不自动填演示数据");
    const c = PRESETS[id] ? preset(id) : defaults(id);
    c.data = clone(input.data);
    c.demo = false;
    c.style.title = line || "调研数据";
    c.style.subtitle = "";
    c.metadata = {
      source: "",
      sampleSize: 0,
      researchTime: "",
      showSource: false,
      showSampleSize: false,
      showResearchTime: false,
      showTitle: true,
      showSubtitle: false,
    };
    if (c.templateId === "cohort-regroup") {
      c.options.selectedId = "";
      c.options.highlight = "";
    }
    if (c.templateId === "research-map-journey")
      c.options.order = (input.data.cities || []).map((r) => r.id);
    if (c.templateId === "card-stack-cascade") c.options.focusIndex = 0;
    if (c.templateId === "poll-results-bars") c.options.totalVotes = 0;
    for (const key of [
      "style",
      "options",
      "metadata",
      "timeline",
      "output",
      "fieldMappings",
      "camera",
    ])
      if (input[key] !== undefined) {
        obj(input[key], `motionInput.${key}`);
        Object.assign(c[key], clone(input[key]));
      }
    if (input.sequence !== undefined) c.sequence = clone(input.sequence);
    return validate(c);
  }
  function dataNumbers(c) {
    const d = c.data,
      id = c.templateId;
    if (id === "comparison-dumbbell")
      return d.rows.flatMap((r) => [r.before, r.after]);
    if (id === "dot-tally") return d.groups.flatMap((r) => [r.count, r.marked]);
    if (id === "bar-race") return d.frames.flatMap((r) => r.values);
    if (id === "number-counter") return d.keyframes.map((r) => r[1]);
    if (id === "card-stack-cascade")
      return d.cards.flatMap((r) =>
        (r.value.match(/[+-]?\d+(?:\.\d+)?/g) || []).map(Number),
      );
    if (id === "poll-results-bars")
      return [
        ...d.options.map((r) => r.value),
        ...(c.options.inputMode === "count" ? [c.options.totalVotes] : []),
      ];
    if (id === "sankey-flow") return d.links.map((r) => r.value);
    if (id === "funnel-conversion") return d.stages.map((r) => r.value);
    if (id === "bubble-scatter-grow")
      return d.records.flatMap((r) => [
        r[c.fieldMappings.x],
        r[c.fieldMappings.y],
        r[c.fieldMappings.size],
      ]);
    if (id === "heatmap-calendar") return d.records.map((r) => r.value);
    if (id === "stacked-area-flow") return d.series.flatMap((r) => r.values);
    if (id === "sample-scale-reveal") return [d.total, d.subgroup, d.target];
    if (id === "kinetic-narration") return d.chart.values;
    if (id === "research-map-journey")
      return d.cities.flatMap((r) => [r.sample, r.value, r.lon, r.lat]);
    if (id === "decision-path-explainer")
      return [
        ...d.nodes.map((r) => r.count),
        ...d.links.map((r) => r.value),
      ].filter((v) => v !== undefined);
    if (id === "product-scene-focus") return d.regions.map((r) => r.value);
    if (id === "cohort-regroup" && c.options.mode === "aggregate")
      return d.aggregates.map((r) => r.value);
    return [];
  }
  function row(config, id = 1) {
    const c = validate(config);
    return {
      id,
      no: String(id).padStart(3, "0"),
      ch: "重构调研 · 数据动效",
      kind: "B",
      cat: "数据动效",
      tpl: c.templateId,
      line: c.style.title,
      visual: c.style.subtitle,
      motion: c,
    };
  }
  return {
    VERSION,
    IDS,
    fromAI,
    dataNumbers,
    defaults,
    validate,
    importTable,
    parseTable,
    table,
    csv,
    toProps,
    row,
    researchValues,
    dateNumber,
    ADVANCED_IDS,
    PRESETS,
    preset,
    importSubtitles,
  };
});
