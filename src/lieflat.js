// Lieflat Charts 的图表（PolyForm Noncommercial，见 vendor/lieflat-charts/LICENSE）。
// 原来是手写 SVG 加 CSS 动画。这里把 SVG 指令记下来，再按时间画到 Canvas 上：同一个时刻永远画出同一帧，导出才稳。
// 动画照原来的三种：pop（弹出）、fade（淡入）、draw（描线）。
// 数据在 row.lf 里，字段名就是原来代码里的常量名。没写的用样例
(function (root) {
  'use strict';
  const D = root.DM;
  const TEXT = D.TEXT;
  const {clamp, progress, bezier, hex, css, mix, luma} = D;
  const SRC = root.DMLieflatSource;

  // 中文名和说明。id 是原来图里的名字
  const NAMES = {
    fan: ['扇形发布图', '每个对象一根辐条，大点是起点，小点是之后每一期'], cascade: ['点阵瀑布', '一个点代表一个单位，按大小排开'], barcode: ['条码棒棒糖', '逐日读数排成条码'],
    arcmatrix: ['弧形矩阵', '两个类目交叉，弧的大小是数量'], converge: ['径向汇聚', '很多条汇向几个主题，明细不丢'], clusters: ['星团分布', '中心和卫星组成一团团'],
    spectrum: ['双极量表', '两端都是合法位置，看落在哪'], dotty: ['等距点阵', '多组数据堆成等距的立体方阵'], almanac: ['年历气泡', '类目乘年份，气泡大小是数量'],
    patchwork: ['径向拼布', '一天 24 小时里每件事叠上去'], lineage: ['生命线', '每个对象一条线：出现、重做、休眠、存活'], colonnade: ['名字列柱', '多对一归属，逐条列名字'],
    hourglass: ['沙漏流', '分阶段递减，一层层漏下来'], hundredfield: ['百人方阵', '一百个点分成几拨'], ballottally: ['选票计数', '多选题的百分比，一票一票数'],
    matheat: ['细读热力', '两个维度交叉，圈出重点格'], calheat: ['全年热力', '52 周乘 7 天，一年每天一格'], ridge: ['山脊图', '几组分布叠成山脊'], parallel: ['平行坐标', '同一批对象跨几个维度，一条线一个对象'],
    rungs: ['刻度柱', '柱子由一格一格组成，可以数'], dayline: ['发丝折线', '逐日读数，线细到只留形状'], hairarea: ['发丝面积', '几十天的形态，用细竖线填满'], tickdonut: ['刻度环', '环由一格一格组成'],
    tickrows: ['刻度横条', '横向排名，每格一个单位'], pairrungs: ['对照刻度柱', '每类两根，今年和去年'], stackrungs: ['堆叠刻度柱', '一根柱分几段，每段可数'], plumb: ['垂线散点', '每个点垂一条线到底'],
    fall: ['刻度瀑布', '从总数一步步加减到结果'], dotheat: ['点状热力', '星期乘小时，点的大小是数量'], gauge: ['刻度仪表', '单个进度，一格一格走到'], dumbbell: ['串珠对比', '前后两点之间用珠子连'],
    histo: ['刻度直方图', '每段多少个，可以数'], boxplot: ['刻度箱线', '中位数和上下范围'], stream: ['河流带', '几条带子随时间变粗变细'], candle: ['细线 K 线', '空心涨，实心跌'],
    violin: ['小提琴图', '分布的轮廓，宽的地方最多'], gheat: ['矩阵热力卡', '每格直接写数'], rankstrip: ['排名带', '名次随时间上下换'], sankey: ['流向带', '从左到右，带宽是数量'],
  };

  // 文案说到这些才匹配
  const WORDS = {
    fan: ['发布时间', '上线时间'], cascade: ['根本原因', '一个点代表'], barcode: ['九十天', '每天一个'], arcmatrix: ['几个城市', '两两'], converge: ['归到', '汇聚', '都指向'],
    clusters: ['聚集', '抱团', '生态'], spectrum: ['两个极端', '更偏向', '定位'], dotty: ['四个团队', '立体'], almanac: ['这些年', '八年'], patchwork: ['一天 24 小时', '一天之中', '几点'],
    lineage: ['生命周期', '起起落落', '死而复生'], colonnade: ['名单', '归属'], hourglass: ['一层层', '最后只剩', '筛掉', '流失'], hundredfield: ['每一百个人', '一百个人里', '100 个人'], ballottally: ['多选', '投票', '选票'],
    matheat: ['一起用', '交叉'], calheat: ['一整年', '每一天'], ridge: ['节奏不同', '分布形状'], parallel: ['多个维度', '几个维度'],
    rungs: ['一格一格', '数得清'], dayline: ['三十天', '每天的'], hairarea: ['几十天'], tickdonut: ['来源', '构成', '占比'], tickrows: ['团队排名', '谁最多'], pairrungs: ['今年和去年', '和去年比'],
    stackrungs: ['分成几块'], plumb: ['价格和', '和满意度'], fall: ['毛利', '从总收入', '扣除'], dotheat: ['星期几', '什么时候最'], gauge: ['离目标', '完成进度'], dumbbell: ['之前和之后', '改版前后'],
    histo: ['集中在', '多数在'], boxplot: ['中位数'], stream: ['此消彼长', '互相抢'], candle: ['K线', 'K 线', '价格走势'], violin: ['分布轮廓'], gheat: ['版本'], rankstrip: ['名次', '排名变化', '爬到第一'], sankey: ['从哪来', '流向', '渠道'],
  };

  // 原图的字都是英文的。样例和坐标翻成中文；图注是这一镜的字段（row.caption），写了才画
  const ZH = SRC.ZH;
  const MONTHS = {JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12};
  const isCaption = (s) => / = /.test(s) || /\b(EVERY|CLOCKWISE)\b/.test(s);
  const zhOf = (s, id) => {
    const per = ZH.perChart[id] || {};
    if (per[s]) return per[s];
    if (ZH.labels[s]) return ZH.labels[s];
    let m = /^([A-Z]{3}) (\d+)$/.exec(s);
    if (m && MONTHS[m[1]]) return `${MONTHS[m[1]]}月${m[2]}日`;
    m = /^W(\d+)$/.exec(s);
    if (m) return `第 ${m[1]} 周`;
    if (s.includes(' · ')) return s.split(' · ').map((part) => zhOf(part, id)).join(' · ');
    m = /^([a-z]+)-([a-z]+)(-v2)?$/.exec(s);
    if (m && ZH.labels[m[1]] && ZH.labels[m[2]]) return `${ZH.labels[m[1]]}${ZH.labels[m[2]]}${m[3] ? ' 二代' : ''}`;
    return s;
  };
  const zhDeep = (v, id) => {
    if (typeof v === 'string') return zhOf(v, id);
    if (Array.isArray(v)) return v.map((x) => zhDeep(x, id));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [zhOf(k, id), zhDeep(x, id)]));
    return v;
  };

  const NS = 'http://www.w3.org/2000/svg';
  let measureRoot = null;
  const measure = (d) => {
    if (!measureRoot) {
      measureRoot = document.createElementNS(NS, 'svg');
      measureRoot.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
      document.documentElement.appendChild(measureRoot);
    }
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    measureRoot.appendChild(p);
    let length = 0;
    let box = {x: 0, y: 0, width: 0, height: 0};
    try {
      length = p.getTotalLength();
      box = p.getBBox();
    } catch (e) {
      // 退化路径量不了，当作 0
    }
    p.remove();
    return {length, box};
  };

  // 跑一张图的代码，记下所有 SVG 指令
  const made = {};
  const record = (gallery, id, overrides, defaults) => {
    const rootNode = {t: 'root', a: {}, kids: []};
    const node = (t, a) => {
      const n = {
        t, a: Object.assign({}, a), kids: [], text: '',
        setAttribute(k, v) { this.a[k] = v; },
        appendChild(k) { this.kids.push(k); },
        addEventListener() {},
        style: {},
      };
      Object.defineProperty(n, 'textContent', {set(v) { this.text = String(v); }, get() { return this.text; }});
      return n;
    };
    const el = (p, t, a) => {
      const n = node(t, a);
      p.kids.push(n);
      return n;
    };
    const txt = (p, a, s) => {
      const n = el(p, 'text', a);
      n.text = String(s);
      return n;
    };
    const tip = () => {};
    const obsReveal = (cid, fn) => {
      if (cid === id) fn(rootNode);
    };
    const data = (name, value) => {
      if (defaults) defaults[name] = value;
      if (name === 'N' && overrides && Array.isArray(overrides.values)) return overrides.values.length;
      return overrides && overrides[name] !== undefined ? overrides[name] : value;
    };
    // 原来用公式造的逐日样例：有真实数组就用数组
    const fn = (name, formula) => {
      if (defaults) defaults[`${name}Formula`] = formula;
      const given = overrides && overrides[name];
      return Array.isArray(given) ? (d) => +given[d] || 0 : formula;
    };
    // 二维的样例：热力图的每一格
    const cell = (name, i, j, value) => {
      if (defaults) {
        defaults[name] = defaults[name] || [];
        defaults[name][i] = defaults[name][i] || [];
        defaults[name][i][j] = value;
      }
      const given = overrides && overrides[name] && overrides[name][i] && overrides[name][i][j];
      return given === undefined || given === null ? value : given;
    };
    const set = SRC.CHARTS[gallery](el, txt, tip, obsReveal, data, fn, cell);
    set[id]();
    return rootNode;
  };

  const number = (v, d = 0) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : d;
  };

  const parseTransform = (text) => {
    const out = [];
    const re = /(translate|rotate|scale)\(([^)]*)\)/g;
    let m;
    while ((m = re.exec(String(text || '')))) out.push([m[1], m[2].trim().split(/[\s,]+/).map(Number)]);
    return out;
  };
  const applyTransform = (c, list) => {
    list.forEach(([kind, a]) => {
      if (kind === 'translate') c.translate(a[0] || 0, a[1] || 0);
      else if (kind === 'scale') c.scale(a[0], a[1] === undefined ? a[0] : a[1]);
      else if (a.length >= 3) {
        c.translate(a[1], a[2]);
        c.rotate((a[0] * Math.PI) / 180);
        c.translate(-a[1], -a[2]);
      } else c.rotate((a[0] * Math.PI) / 180);
    });
  };

  // 把 SVG 树压平：每条指令带上累计的变形和透明度
  const flatten = (n, transforms, opacity, out, say) => {
    n.kids.forEach((k) => {
      const a = k.a;
      const words = k.t === 'text' ? say(k.text) : '';
      if (k.t === 'text' && !words) return;
      const t2 = a.transform && k.t === 'g' ? transforms.concat(parseTransform(a.transform)) : transforms;
      const op = opacity * (a.opacity === undefined ? 1 : number(a.opacity, 1));
      if (k.t === 'g') {
        flatten(k, t2, op, out, say);
        return;
      }
      const own = a.transform ? parseTransform(a.transform) : [];
      const style = String(a.style || '');
      const delay = /animation-delay:\s*(-?[\d.]+)s/.exec(style);
      const duration = /animation-duration:\s*([\d.]+)s/.exec(style);
      const cls = String(a.class || '');
      const kind = /\bpop\b/.test(cls) ? 'pop' : /\bdraw\b/.test(cls) ? 'draw' : /\bfade\b/.test(cls) ? 'fade' : null;
      const item = {t: k.t, a, text: words, transforms: transforms.concat(own), opacity: op, kind, delay: delay ? parseFloat(delay[1]) : 0, dur: duration ? parseFloat(duration[1]) : kind === 'pop' ? 0.5 : kind === 'draw' ? 1 : 0.9};
      if (k.t === 'path' && a.d) {
        item.path = new Path2D(a.d);
        const m = measure(a.d);
        item.len = m.length;
        item.box = m.box;
      } else if (k.t === 'line') {
        item.len = Math.hypot(number(a.x2) - number(a.x1), number(a.y2) - number(a.y1));
      }
      out.push(item);
    });
    return out;
  };

  const popCurve = bezier(0.2, 0.7, 0.3, 1.3);
  const easeFade = bezier(0.25, 0.1, 0.25, 1);
  const drawCurve = bezier(0.4, 0, 0.2, 1);

  // 反色：这套图原来画在纸上，选黑底时把灰阶翻过来，有色相的颜色不动
  const flipColor = (v) => {
    if (typeof v !== 'string' || v[0] !== '#' || (v.length !== 7 && v.length !== 4)) return v;
    const rgb = hex(v.length === 4 ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}` : v);
    if (Math.max(...rgb) - Math.min(...rgb) > 24) return v;
    const k = 1 - luma(rgb) / 255;
    const g = Math.round(14 + k * 228);
    return `rgb(${g},${g},${g - 4})`;
  };

  const drawItem = (c, it, t, pace, tone) => {
    const at = it.delay * pace;
    const dur = it.dur * pace;
    const u = it.kind ? clamp((t - at) / dur) : 1;
    if (it.kind === 'pop' && u <= 0) return;
    if (it.kind === 'fade' && u <= 0) return;
    const a = it.a;
    c.save();
    applyTransform(c, it.transforms);
    let alpha = it.opacity;
    if (it.kind === 'fade') alpha *= easeFade(u);
    c.globalAlpha = clamp(alpha);
    const fill = a.fill === undefined ? (it.t === 'line' ? 'none' : '#000000') : a.fill;
    const stroke = a.stroke === undefined ? 'none' : a.stroke;
    const width = number(a['stroke-width'], 1);
    const fillA = a['fill-opacity'] === undefined ? 1 : number(a['fill-opacity'], 1);
    const strokeA = a['stroke-opacity'] === undefined ? 1 : number(a['stroke-opacity'], 1);
    const base = alpha;
    const paint = (build) => {
      if (fill !== 'none') {
        c.globalAlpha = clamp(base * fillA);
        c.fillStyle = tone(fill);
        build('fill');
      }
      if (stroke !== 'none' && width > 0) {
        c.globalAlpha = clamp(base * strokeA);
        c.strokeStyle = tone(stroke);
        c.lineWidth = width;
        c.lineCap = a['stroke-linecap'] || 'butt';
        c.lineJoin = a['stroke-linejoin'] || 'miter';
        if (it.kind === 'draw') {
          const len = it.len || 1;
          c.setLineDash([len * drawCurve(u), len]);
        } else if (a['stroke-dasharray']) {
          c.setLineDash(String(a['stroke-dasharray']).trim().split(/[\s,]+/).map(Number));
        } else c.setLineDash([]);
        build('stroke');
        c.setLineDash([]);
      }
    };
    const popAround = (cx, cy) => {
      if (it.kind !== 'pop') return;
      const s = Math.max(0, popCurve(u));
      c.translate(cx, cy);
      c.scale(s, s);
      c.translate(-cx, -cy);
    };
    if (it.t === 'circle') {
      const cx = number(a.cx);
      const cy = number(a.cy);
      popAround(cx, cy);
      paint((how) => {
        c.beginPath();
        c.arc(cx, cy, Math.max(0, number(a.r)), 0, Math.PI * 2);
        c[how]();
      });
    } else if (it.t === 'rect') {
      const x = number(a.x);
      const y = number(a.y);
      const w = number(a.width);
      const h = number(a.height);
      popAround(x + w / 2, y + h / 2);
      const r = Math.min(number(a.rx), w / 2, h / 2);
      paint((how) => {
        c.beginPath();
        c.roundRect(x, y, w, h, r);
        c[how]();
      });
    } else if (it.t === 'line') {
      const x1 = number(a.x1);
      const y1 = number(a.y1);
      const x2 = number(a.x2);
      const y2 = number(a.y2);
      popAround((x1 + x2) / 2, (y1 + y2) / 2);
      if (stroke !== 'none') {
        paint((how) => {
          if (how !== 'stroke') return;
          c.beginPath();
          c.moveTo(x1, y1);
          c.lineTo(x2, y2);
          c.stroke();
        });
      }
    } else if (it.t === 'path' && it.path) {
      const b = it.box;
      popAround(b.x + b.width / 2, b.y + b.height / 2);
      c.beginPath();
      c.mark(b.x, b.y, Math.max(1, b.width), Math.max(1, b.height));
      paint((how) => c[how](it.path));
    } else if (it.t === 'text') {
      const size = number(a['font-size'], 10);
      const weight = a['font-weight'] || 400;
      const italic = a['font-style'] === 'italic' ? 'italic ' : '';
      const x = number(a.x);
      const y = number(a.y);
      popAround(x, y);
      c.font = `${italic}${weight} ${size}px ${D.FONT_CN}`;
      c.textAlign = a['text-anchor'] === 'middle' ? 'center' : a['text-anchor'] === 'end' ? 'right' : 'left';
      const base2 = a['dominant-baseline'];
      c.textBaseline = base2 === 'middle' || base2 === 'central' ? 'middle' : base2 === 'hanging' ? 'top' : 'alphabetic';
      c.globalAlpha = clamp(base * fillA);
      c.fillStyle = tone(fill === 'none' ? '#000000' : fill);
      c.fillText(it.text, x, y);
    }
    c.restore();
  };

  const nameFor = (it) => {
    const shape = {circle: '圆点', line: '线', rect: '方块', path: '图形'}[it.t] || it.t;
    return shape;
  };

  const LF_KEYS = (id) => (SRC.META[id] && SRC.META[id].names) || [];
  const sampleCache = {};
  const sampleOf = (id) => {
    if (sampleCache[id]) return sampleCache[id];
    const meta = SRC.META[id];
    const defaults = {};
    try {
      record(meta.gallery, id, null, defaults);
    } catch (e) {
      // 样例跑不出来时不给样例，测试会报出来
    }
    if (defaults.valuesFormula && defaults.N) {
      defaults.values = Array.from({length: defaults.N}, (_, d) => Math.round(defaults.valuesFormula(d) * 10) / 10);
      delete defaults.N;
    }
    delete defaults.valuesFormula;
    // 字段名不翻：SAT、MON 是代码里的名字，不是星期
    sampleCache[id] = {lf: Object.fromEntries(Object.entries(JSON.parse(JSON.stringify(defaults))).map(([k, v]) => [k, zhDeep(v, id)]))};
    if (ZH.captions[id]) sampleCache[id].caption = ZH.captions[id];
    return sampleCache[id];
  };

  // 百分比和一串数直接能用的几张图：这一镜已有的数据填进去，不用手写 lf
  const fromSeries = {
    rungs: (s) => ({D: s.map((d) => [d.label, d.value])}),
    tickrows: (s) => ({D: s.map((d) => [d.label, d.value])}),
    tickdonut: (s, ink) => ({D: s.map((d, i) => [d.label, d.value, ink[i % ink.length]])}),
    ballottally: (s) => ({ASK: s.map((d) => [d.label, d.value])}),
    hourglass: (s) => ({STAGE: s.map((d) => [d.label, d.value])}),
    gauge: (s) => (s.length === 1 ? {GOAL: s[0].value} : null),
  };
  // 时间序列：逐日的三张图直接吃 points
  const fromPoints = new Set(['dayline', 'hairarea', 'barcode']);
  const INKS = ['#1C1C1A', '#55554F', '#8F8E88', '#B0AFA9', '#C6C5BF', '#DEDDD6'];
  const seriesFrom = (row) => {
    if (row.series && row.series.length) return row.series;
    return (row.groups || []).flatMap((g) => g.metrics || []).filter((m) => m.value != null).map((m) => ({label: m.caption || '', value: +m.value}));
  };
  const dataFor = (id, row) => {
    if (row.lf) return row.lf;
    if (fromPoints.has(id) && row.points && row.points.length >= 7 && row.points[0].v != null) return {values: row.points.map((p) => +p.v)};
    const make = fromSeries[id];
    if (!make) return null;
    const s = seriesFrom(row);
    return s.length >= (id === 'gauge' ? 1 : 2) ? make(s, INKS) : null;
  };

  Object.keys(NAMES).forEach((id) => {
    const meta = SRC.META[id];
    if (!meta) return;
    const tid = `lf_${id}`;
    const [name, desc] = NAMES[id];
    const def = {
      name, family: '细读图表', cat: 'fine', custom: true, chart: true, lieflat: true, desc, keywords: WORDS[id] || [], colors: {},
      source: 'Lieflat Charts（非商用授权）',
      accepts: (row) => !!dataFor(id, row),
      create(row, S) {
        const over = dataFor(id, row);
        if (!over) throw new Error('这一镜还缺数据');
        const tree = record(meta.gallery, id, over, null);
        // 这一镜自己写的字原样画，只翻原图代码里写死的
        const own = new Set();
        const collect = (v) => {
          if (typeof v === 'string') own.add(v);
          else if (Array.isArray(v)) v.forEach(collect);
          else if (v && typeof v === 'object') Object.values(v).forEach(collect);
        };
        collect(over);
        const say = (text) => {
          if (text.split(' · ').some((part) => own.has(part))) return text;
          const shown = zhOf(text, id);
          if (shown !== text || !isCaption(text)) return shown;
          return row.caption || '';
        };
        const items = flatten(tree, [], 1, [], say);
        const [, , vw, vh] = meta.viewBox;
        const title = row.title || '';
        const top = title ? 170 : 50;
        const k = Math.min((1920 - 120) / vw, (1080 - top - 50) / vh);
        const ox = (1920 - vw * k) / 2;
        const oy = top + (1080 - top - 50 - vh * k) / 2;
        // 底色：默认照原图，选了黑底或纸底就跟着换
        const wantDark = row.theme === 'black' ? true : row.theme === 'paper' ? false : meta.dark;
        const flip = wantDark !== meta.dark;
        const bg = wantDark ? '#1C1C1A' : '#F0EFEB';
        const titleInk = wantDark ? '#F0EFEB' : '#1C1C1A';
        const memo = new Map();
        const tone = (v) => {
          if (!flip) return v;
          if (!memo.has(v)) memo.set(v, flipColor(v));
          return memo.get(v);
        };
        const reveal = items.reduce((m, it) => Math.max(m, it.kind ? it.delay + it.dur : 0), 0.5);
        const speech = D.speechOf(row).dur;
        // 念得慢就把进场拉长，最多拉到 2.5 倍，念到最后一个元素刚好出完
        const pace = clamp(speech / reveal, 1, 2.5);
        const dur = Math.max(speech, reveal * pace) + (row.hold != null ? +row.hold : 2.2);
        // 元素：每段字一个；图形按形状和颜色分组，几百个点也只是一个元素
        const groups = new Map();
        const paperOnly = (it) => [it.a.fill, it.a.stroke].every((v) => v === undefined || v === 'none' || v === '#F0EFEB');
        items.forEach((it) => {
          const key = it.t === 'text' ? `t${groups.size}` : `${it.t}|${it.a.fill || ''}|${it.a.stroke || ''}`;
          // 跟底色一样的形状是用来遮挡后面的，单独看不出来
          const meta = it.t === 'text' ? TEXT : paperOnly(it) ? {kind: 'fx'} : undefined;
          if (!groups.has(key)) groups.set(key, {id: `e${groups.size}`, label: it.t === 'text' ? it.text : nameFor(it), meta, list: []});
          groups.get(key).list.push(it);
        });
        const list = [...groups.values()];
        const draw = (c) => {
          D.clearFrame(c, S, bg);
          if (title) {
            const t = c.el('title', title, TEXT);
            c.globalAlpha = progress(t, 0.05, 0.4);
            c.font = `${D.fitSize(title, 1700, 62, 34)}px ${D.FONT_CN}`;
            c.fillStyle = titleInk;
            c.textAlign = 'left';
            c.textBaseline = 'alphabetic';
            c.fillText(title, 110, 120);
            c.globalAlpha = 1;
          }
          list.forEach((g) => {
            const t = c.el(g.id, g.label, g.meta);
            c.save();
            c.translate(ox, oy);
            c.scale(k, k);
            g.list.forEach((it) => drawItem(c, it, t, pace, tone));
            c.restore();
          });
        };
        return {duration: dur, draw};
      },
    };
    Object.defineProperty(def, 'sample', {get: () => sampleOf(id), enumerable: false});
    D.register(tid, def);
    // register 用 Object.assign 复制，getter 要重新挂上
    Object.defineProperty(D.TEMPLATES[tid], 'sample', {get: () => sampleOf(id), configurable: true});
  });

  // 给 AI 的清单
  const basePrompt = D.libraryPrompt;
  const shape = (id) => {
    const sample = sampleOf(id).lf;
    const brief = Object.keys(sample).filter((k) => k !== 'SHADE' && k !== 'SH').map((k) => {
      const v = sample[k];
      const first = Array.isArray(v) ? `[${JSON.stringify(v[0]).slice(0, 40)},…]` : JSON.stringify(v).slice(0, 40);
      return `${k}:${first}`;
    });
    return `lf_${id} ${NAMES[id][0]} {${brief.join(' ')}}`;
  };
  D.libraryPrompt = () => `${basePrompt()}\n编辑部风格图表（一个点或一格就是一个单位，适合慢慢读）。数据写在 lf 字段，字段名照下面的样子；图注写在 caption，不写就没有。lf_rungs、lf_tickrows、lf_tickdonut、lf_ballottally、lf_hourglass 写 series 也行：\n${Object.keys(NAMES).filter((id) => SRC.META[id]).map(shape).join('\n')}`;
  D.lieflatKeys = LF_KEYS;
})(window);
