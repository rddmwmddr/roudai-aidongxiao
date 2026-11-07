// 核心：缓动、字体、时间轴、读数、逐字进场。所有模板共用。每一帧只由 t 决定（Remotion 的逐帧纯函数思路）。
(function (root) {
  'use strict';

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const progress = (t, a, b) => clamp((t - a) / (b - a));
  const smooth = (x) => {
    const k = clamp(x);
    return k * k * (3 - 2 * k);
  };
  const outExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(x)));
  const outCubic = (x) => 1 - Math.pow(1 - clamp(x), 3);
  const outQuint = (x) => 1 - Math.pow(1 - clamp(x), 5);
  const wobble = (t, f = 5.2, d = 7) => (t < 0 ? 1 : Math.exp(-d * t) * Math.cos(2 * Math.PI * f * t));
  const springTo = (t, f = 2.1, d = 6.5) => (t <= 0 ? 0 : 1 - wobble(t, f, d));
  const hash = (n) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const noise1 = (x) => {
    const i = Math.floor(x);
    const f = x - i;
    return lerp(hash(i), hash(i + 1), f * f * (3 - 2 * f));
  };
  const bezier = (x1, y1, x2, y2) => {
    const cx = 3 * x1;
    const bx = 3 * (x2 - x1) - cx;
    const ax = 1 - cx - bx;
    const cy = 3 * y1;
    const by = 3 * (y2 - y1) - cy;
    const ay = 1 - cy - by;
    return (x) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 22; i++) {
        const m = (lo + hi) / 2;
        if (((ax * m + bx) * m + cx) * m < x) lo = m;
        else hi = m;
      }
      const t = (lo + hi) / 2;
      return ((ay * t + by) * t + cy) * t;
    };
  };
  const runCurve = bezier(0.62, 0.02, 0.1, 1);
  const hex = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
  const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const luma = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;

  // ---------- 字体 ----------
  // 换字体的办法：同一个字体名换一份字体文件，所有模板不用改。界面用 DMUI，不跟着变
  const FAMILY = {cn: 'DMGothic', num: 'DMNumBold', tick: 'DMNumMedium', title: 'DMTitle'};
  const FONT_CN = 'DMGothic,DMGothicFull,"PingFang SC",sans-serif';
  const FONT_NUM = 'DMNumBold,DMGothic,sans-serif';
  const FONT_TICK = 'DMNumMedium,DMGothic,sans-serif';
  const FONT_TITLE = 'DMTitle,"Songti SC","STSong",serif';
  let PCT_EM = 0.52;
  let SLOT = 0.435;
  let DOT = 0.2;
  let NUM_SCALE = 1; // 不同字体的数字高度不同，统一缩放到 0.7em，版面不用动
  const measure = document.createElement('canvas').getContext('2d');
  const widths = new Map();
  const charEm = (ch) => {
    let v = widths.get(ch);
    if (v === undefined) {
      measure.font = `100px ${FONT_CN}`;
      v = measure.measureText(ch).width / 100;
      widths.set(ch, v);
    }
    return v;
  };
  const textEm = (s) => Array.from(s).reduce((a, c) => a + charEm(c), 0);
  const numFont = (size) => `${size * NUM_SCALE}px ${FONT_NUM}`;
  const refreshMetrics = () => {
    widths.clear();
    measure.font = `100px ${FONT_NUM}`;
    const cap = measure.measureText('0').actualBoundingBoxAscent / 100;
    NUM_SCALE = cap > 0.3 ? clamp(0.7 / cap, 0.6, 1.5) : 1;
    const adv = (c) => (measure.measureText(c).width / 100) * NUM_SCALE;
    SLOT = Math.max(0.3, Math.max(...'0123456789'.split('').map(adv)) + 0.008);
    PCT_EM = adv('%');
    DOT = Math.max(0.2, adv('.') + 0.02);
  };
  const faces = {};
  const swapFace = async (family, source) => {
    if (faces[family]) {
      document.fonts.delete(faces[family]);
      delete faces[family];
    }
    if (!source) return;
    const face = new FontFace(family, typeof source === 'string' ? `url(${source})` : source);
    await face.load();
    document.fonts.add(face);
    faces[family] = face;
  };
  // slot：cn 中文、num 数字、title 诗句。source 传字体文件内容；null 恢复默认
  const setFont = async (slot, source) => {
    const src = root.DM_FONTS;
    if (slot === 'cn') await swapFace(FAMILY.cn, source || src.gothic);
    else if (slot === 'num') {
      await swapFace(FAMILY.num, source || src.numBold);
      await swapFace(FAMILY.tick, source || src.numMedium);
    } else if (slot === 'title') await swapFace(FAMILY.title, source || null);
    refreshMetrics();
  };
  // 服务器版默认只有常用字。这一镜用到别的字时，下载完整字体再画
  let fullFace = null;
  const ensureGlyphs = async (text) => {
    const src = root.DM_FONTS;
    if (!src.gothicFull || !src.commonChars) return false;
    if (!root.DM_COMMON_SET) root.DM_COMMON_SET = new Set(Array.from(src.commonChars));
    const rare = Array.from(String(text)).some((c) => c.codePointAt(0) > 0x2e7f && !root.DM_COMMON_SET.has(c));
    if (!rare || (fullFace && fullFace.status === 'loaded')) return false;
    if (!fullFace) {
      fullFace = new FontFace('DMGothicFull', `url(${src.gothicFull})`);
      document.fonts.add(fullFace);
    }
    await fullFace.load();
    widths.clear();
    return true;
  };
  const loadFonts = async () => {
    const src = root.DM_FONTS;
    const ui = new FontFace('DMUI', `url(${src.gothic})`);
    const uiNum = new FontFace('DMUINum', `url(${src.numMedium})`);
    await Promise.all([ui, uiNum].map((f) => f.load().then((x) => document.fonts.add(x))));
    await swapFace(FAMILY.cn, src.gothic);
    await swapFace(FAMILY.num, src.numBold);
    await swapFace(FAMILY.tick, src.numMedium);
    refreshMetrics();
  };

  // ---------- 模板注册表 ----------
  const TEMPLATES = {};
  const register = (id, def) => {
    TEMPLATES[id] = Object.assign({id}, def);
  };

  // ---------- 配置 ----------
  const themeColors = (template, theme) => {
    const inkFirst = template === 'dots' || template === 'survey';
    if (theme === 'paper') return inkFirst ? {bg: '#F1EFE8', primary: '#141416', secondary: '#EE3A17'} : {bg: '#F1EFE8', primary: '#EE3A17', secondary: '#141416'};
    if (theme === 'black') return inkFirst ? {bg: '#0A0A0B', primary: '#F4F1EA', secondary: '#FF5C1E'} : {bg: '#0A0A0B', primary: '#FF5C1E', secondary: '#FFF4E2'};
    return {};
  };
  const normalize = (raw) => {
    const template = TEMPLATES[raw.template] ? raw.template : raw.style && TEMPLATES[raw.style] ? raw.style : 'comb';
    const d = TEMPLATES[template];
    const themed = raw.theme ? themeColors(template, raw.theme) : {};
    const own = raw.colors || {};
    const colors = {bg: HEX.test(own.bg || '') ? own.bg : themed.bg, primary: HEX.test(own.primary || '') ? own.primary : themed.primary, secondary: HEX.test(own.secondary || '') ? own.secondary : themed.secondary};
    const groups = [];
    (raw.groups || []).forEach((g) => {
      const metrics = (g.metrics || []).map((m) => ({
        caption: String(m.caption == null ? '' : m.caption),
        value: Math.round(parseFloat(m.value) * 10) / 10,
        land: m.land === '' || m.land == null ? null : +m.land,
        prefix: m.prefix || '',
        emphasis: !!m.emphasis,
        answer: m.answer || '',
        note: m.note && m.note.text ? {text: String(m.note.text), base: m.note.base || '', sAt: m.note.sAt, sEnd: m.note.sEnd} : null,
        sLand: m.sLand == null ? null : +m.sLand,
        sCap: m.sCap == null ? null : +m.sCap,
      }));
      const relation = metrics.length < 2 ? 'single' : g.relation === 'opposing' ? 'opposing' : g.relation === 'parallel' || g.relation === 'chain' ? 'parallel' : 'nested';
      if (relation === 'parallel') {
        metrics.forEach((m, i) => groups.push({title: i === 0 ? String(g.title || '') : '', sTitle: i === 0 ? g.sTitle : null, relation: 'single', metrics: [m]}));
      } else {
        groups.push({title: String(g.title || ''), sTitle: g.sTitle == null ? null : +g.sTitle, relation, metrics});
      }
    });
    return {
      template,
      speed: raw.speed > 0 ? +raw.speed : 1,
      hold: raw.hold != null && raw.hold !== '' ? +raw.hold : 3.3,
      colors: {bg: colors.bg || d.colors.bg, primary: colors.primary || d.colors.primary, secondary: colors.secondary || d.colors.secondary},
      groups,
    };
  };

  // 能换的颜色：模板自己声明（组件、CSS 动效），没有声明的数据模板用底色、主色、辅色。
  // 文件里存 row.colors = {键: '#RRGGBB'}，没存的用模板默认
  const HEX = /^#[0-9a-f]{6}$/i;
  const pickColors = (row, keys) => {
    const out = {};
    const given = (row && row.colors) || {};
    keys.forEach((k) => {
      if (HEX.test(given[k] || '')) out[k] = given[k];
    });
    return out;
  };
  const colorRoles = (row) => {
    const t = TEMPLATES[row.tpl || row.template];
    if (!t) return [];
    if (t.colorRoles) {
      const base = t.colorDefaults(row);
      const set = pickColors(row, t.colorRoles.map((r) => r.key));
      return t.colorRoles.map((r) => ({key: r.key, name: r.name, value: set[r.key] || base[r.key], custom: !!set[r.key]}));
    }
    if (t.colors && t.colors.bg) {
      const spec = normalize(Object.assign({}, row, {template: t.id}));
      const set = pickColors(row, ['bg', 'primary', 'secondary']);
      return [['bg', '底色'], ['primary', '主色'], ['secondary', '辅色']].map(([key, name]) => ({key, name, value: set[key] || spec.colors[key], custom: !!set[key]}));
    }
    return [];
  };

  const validate = (raw) => {
    const spec = normalize(raw);
    const errors = [];
    const warnings = [];
    const tpl = TEMPLATES[spec.template];
    if (!spec.groups.length) errors.push('至少要有一个数');
    if (tpl.maxGroups && spec.groups.length > tpl.maxGroups) errors.push(`「${tpl.name}」最多放 ${tpl.maxGroups} 组，现在是 ${spec.groups.length} 组`);
    const total = spec.groups.reduce((a, g) => a + g.metrics.length, 0);
    if (tpl.maxMetrics && total > tpl.maxMetrics) errors.push(`「${tpl.name}」最多放 ${tpl.maxMetrics} 个数，现在是 ${total} 个`);
    let prev = 0;
    spec.groups.forEach((g, gi) => {
      const name = g.title || `第 ${gi + 1} 组`;
      if (!g.metrics.length) errors.push(`${name}没有数字`);
      if (g.metrics.length > 2) errors.push(`${name}有 ${g.metrics.length} 个数，一组最多两个`);
      g.metrics.forEach((m, mi) => {
        if (!Number.isFinite(m.value) || m.value <= 0 || m.value > 100) errors.push(`${name}的第 ${mi + 1} 个数要大于 0、不超过 100`);
        if (m.land != null) {
          if (!Number.isFinite(m.land) || m.land <= prev) errors.push(`${name}的第 ${mi + 1} 个数，落定时间要晚于上一个数（${prev.toFixed(1)} 秒）`);
          else prev = m.land;
        }
      });
      if (g.relation === 'nested' && g.metrics.length === 2 && g.metrics[1].value > g.metrics[0].value) errors.push(`${name}：里层 ${g.metrics[1].value}% 大于外层 ${g.metrics[0].value}%，请对调，或把关系改成「并列」`);
      if (g.relation === 'opposing' && g.metrics.length === 2 && g.metrics[0].value + g.metrics[1].value > 100) errors.push(`${name}：相反的两拨人加起来超过 100%，请把关系改成「并列」`);
    });
    return {errors, warnings, spec};
  };

  // ---------- 时间轴 ----------
  const buildTimeline = (spec) => {
    const sp = spec.speed;
    let prevEnd = 0;
    const beats = [];
    spec.groups.forEach((g, gi) => {
      g.metrics.forEach((m, mi) => {
        const need = mi > 0 ? 3.5 : 5.1;
        const manual = m.land != null;
        let land = manual ? m.land : m.sLand != null ? m.sLand / sp : prevEnd + need / sp;
        if (land < prevEnd + 0.4) land = prevEnd + 0.4;
        const u = clamp((land - prevEnd) / need, 0.3, 1.6);
        const runLen = (mi > 0 ? 2.1 : gi === 0 ? 2.2 : 1.8) * u;
        const run = [Math.max(prevEnd + 0.05, land - runLen), land];
        let capAt = !manual && m.sCap != null ? m.sCap / sp : land - (mi > 0 ? 2.9 : gi === 0 ? 3.1 : 2.8) * u;
        capAt = Math.max(prevEnd + 0.08, capAt);
        const numAt = Math.min(capAt + (mi > 0 ? 0.2 : 0.1), run[0]);
        const mirror = g.relation === 'opposing' && mi === 1;
        const beat = {g: gi, m: mi, land, u, run, capAt, numAt, value: m.value, caption: m.caption, mirror, prefix: m.prefix, emphasis: m.emphasis, title: g.title, relation: g.relation};
        if (mi === 0) {
          let titleAt = !manual && g.sTitle != null ? g.sTitle / sp : land - (gi === 0 ? 4.7 : 4.2) * u;
          titleAt = Math.max(prevEnd + 0.05, titleAt);
          beat.titleAt = titleAt;
          beat.splitAt = gi > 0 ? Math.max(prevEnd + 0.1, Math.min(titleAt, capAt, run[0]) - 0.35) : null;
        }
        beat.lit = Array.from({length: 100}, (_, n) => {
          if (n >= m.value) return Infinity;
          let lo = run[0];
          let hi = run[1];
          for (let k = 0; k < 22; k++) {
            const mid = (lo + hi) / 2;
            if (runCurve(progress(mid, run[0], run[1])) * m.value > n) hi = mid;
            else lo = mid;
          }
          return hi;
        });
        if (m.note) {
          const at = !manual && m.note.sAt != null ? m.note.sAt / sp : land + 0.5;
          const end = !manual && m.note.sEnd != null ? m.note.sEnd / sp : at + Array.from(m.note.text).length / 5.2;
          beat.note = {text: m.note.text, base: m.note.base, at, end};
          prevEnd = Math.max(land, end);
        } else {
          prevEnd = land;
        }
        m.beat = beat;
        beats.push(beat);
      });
    });
    return {beats, end: prevEnd + spec.hold};
  };

  const frontOf = (b, t) => runCurve(progress(t, b.run[0], b.run[1])) * b.value;
  const posOf = (b, t) => (b.mirror ? 100 - frontOf(b, t) : frontOf(b, t));
  const speedOf = (b, t) => Math.abs(frontOf(b, t + 1 / 60) - frontOf(b, t)) * 60;
  const colLit = (b, i) => b.lit[b.mirror ? 99 - i : i];
  const colFrac = (b, i) => clamp(b.value - (b.mirror ? 99 - i : i));
  const landPulse = (t, land, amount = 0.022) => {
    const d = t - land + 0.05;
    return d <= 0 ? 1 : 1 + amount * Math.exp(-6.5 * d) * Math.sin(2 * Math.PI * 2.6 * d);
  };
  // 「只有 37%」这种强调：落定后其余元素退后
  const focusOf = (beats, t) => {
    let focus = null;
    beats.forEach((b) => {
      if (b.emphasis && t > b.land) focus = b;
    });
    return focus ? {beat: focus, e: smooth(progress(t, focus.land + 0.15, focus.land + 0.7))} : {beat: null, e: 0};
  };

  // ---------- 文字 ----------
  const reveal = (ctx, text, x, top, size, color, t0, at, stagger = 0.022, dur = 0.5, align = 'left') => {
    if (!text) return;
    const own = ctx.textIn(text, t0);
    const t = own == null ? t0 : own;
    if (t < at) {
      if (own != null) ctx.pop();
      return;
    }
    const chars = Array.from(text);
    const lh = size * 1.25;
    const base = top + size * 1.0055;
    const w = textEm(text) * size;
    const x0 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    ctx.save();
    ctx.font = `${size}px ${FONT_CN}`;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.beginPath();
    ctx.rect(x0 - 2, top, w + 4, lh + size * 0.04);
    ctx.clip();
    let cx = x0;
    chars.forEach((c, i) => {
      const p = outQuint(progress(t, at + i * stagger, at + i * stagger + dur));
      if (p > 0) ctx.fillText(c, cx, base + (1 - p) * lh * 1.1);
      cx += charEm(c) * size;
    });
    ctx.restore();
    if (own != null) ctx.pop();
  };
  const leave = (ctx, text, x, top, size, color, p) => {
    if (!text || p >= 1) return;
    const own = ctx.textIn(text, ctx.T);
    const lh = size * 1.25;
    ctx.save();
    ctx.font = `${size}px ${FONT_CN}`;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.beginPath();
    ctx.rect(x - 2, top, textEm(text) * size + 4, lh + size * 0.04);
    ctx.clip();
    let cx = x;
    const y = top + size * 1.0055 - p * lh * 1.15;
    Array.from(text).forEach((c) => {
      ctx.fillText(c, cx, y);
      cx += charEm(c) * size;
    });
    ctx.restore();
    if (own != null) ctx.pop();
  };
  // 按宽度折行：优先在逗号顿号后断开，不把标点放到行首，不拆英文词
  const breakLines = (text, maxEm) => {
    const chars = Array.from(text);
    const lines = [];
    let line = '';
    let w = 0;
    let lastBreak = -1;
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      const cw = charEm(c);
      if (w + cw > maxEm && line.length) {
        const arr = Array.from(line);
        let cut = lastBreak >= arr.length * 0.4 ? lastBreak + 1 : arr.length;
        if (/[，。、；：,.]/.test(c)) {
          line += c;
          lines.push(line);
          line = '';
          w = 0;
          lastBreak = -1;
          continue;
        }
        while (cut > 1 && /[A-Za-z0-9%]/.test(arr[cut - 1]) && /[A-Za-z0-9%]/.test(arr[cut] || c)) cut--;
        lines.push(arr.slice(0, cut).join(''));
        const rest = arr.slice(cut).join('');
        line = rest;
        w = textEm(rest);
        lastBreak = -1;
      }
      line += c;
      w += cw;
      if (/[，、；,]/.test(c)) lastBreak = Array.from(line).length - 1;
    }
    if (line) lines.push(line);
    return lines;
  };
  const wrapText = (text, maxW, size, floor = 24, maxLines = 3) => {
    if (!text) return {lines: [], size, w: 0};
    for (let s = size; s >= floor; s -= 1) {
      const lines = breakLines(text, maxW / s);
      if (lines.length <= maxLines) return {lines, size: s, w: Math.max(...lines.map((l) => textEm(l) * s))};
    }
    const lines = breakLines(text, maxW / floor).slice(0, maxLines);
    return {lines, size: floor, w: Math.max(...lines.map((l) => textEm(l) * floor))};
  };
  const revealLines = (ctx, wrap, x, top, color, t, at, align = 'left') => {
    wrap.lines.forEach((line, i) => reveal(ctx, line, x, top + i * wrap.size * 1.25, wrap.size, color, t, at + i * 0.1, 0.022, 0.5, align));
  };
  const linesH = (wrap) => wrap.lines.length * wrap.size * 1.25;
  const fitSize = (text, maxW, size, floor) => {
    const em = textEm(text);
    return em * size <= maxW ? size : Math.max(floor, maxW / em);
  };

  // ---------- 读数 ----------
  const intDigits = (target) => (target >= 100 ? 3 : target >= 10 ? 2 : 1);
  const numEm = (target) => intDigits(target) * SLOT + (Number.isInteger(target) ? 0 : DOT + SLOT) + 0.03 + PCT_EM;

  const makeReadout = (S) => {
    const scratch = document.createElement('canvas');
    scratch.width = Math.ceil(0.5 * 640 * S) + 4;
    scratch.height = Math.ceil(640 * S) + 4;
    const sc = scratch.getContext('2d');

    const drum = (ctx, x, top, size, pos, blurEm, color, alpha) => {
      const px = size * S;
      const settled = Math.abs(pos - Math.round(pos)) < 1e-4;
      ctx.globalAlpha = alpha;
      if (settled) {
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.font = numFont(size);
        ctx.fillText(String(((Math.round(pos) % 10) + 10) % 10), x + (SLOT * size) / 2, top + size * 0.8);
        return;
      }
      const cw = Math.ceil(SLOT * px) + 2;
      const ch = Math.ceil(px) + 2;
      sc.setTransform(1, 0, 0, 1, 0, 0);
      sc.globalCompositeOperation = 'source-over';
      sc.globalAlpha = 1;
      sc.clearRect(0, 0, cw, ch);
      sc.globalCompositeOperation = 'lighter';
      sc.font = numFont(px);
      sc.textAlign = 'center';
      sc.textBaseline = 'alphabetic';
      sc.fillStyle = color;
      const N = blurEm > 0.012 ? Math.min(8, Math.max(2, Math.ceil(blurEm / 0.03))) : 1;
      sc.globalAlpha = 1 / N;
      const base = Math.floor(pos);
      const frac = pos - base;
      for (let n = 0; n < N; n++) {
        const off = N === 1 ? 0 : (n / (N - 1) - 0.5) * blurEm;
        for (let k = -1; k <= 2; k++) {
          const d = (((base + k) % 10) + 10) % 10;
          sc.fillText(String(d), (SLOT * px) / 2, (k - frac + off + 0.8) * px);
        }
      }
      sc.globalCompositeOperation = 'destination-in';
      sc.globalAlpha = 1;
      const g = sc.createLinearGradient(0, 0, 0, px);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.09, '#000');
      g.addColorStop(0.84, '#000');
      g.addColorStop(0.98, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      sc.fillStyle = g;
      sc.fillRect(0, 0, cw, ch);
      ctx.drawImage(scratch, 0, 0, cw, ch, x, top, cw / S, ch / S);
    };

    return (ctx, {x, baseline, size, value, target, speed = 0, color, alpha = 1, pulse = 1}) => {
      if (alpha <= 0) return;
      const top = baseline - size * 0.8;
      const ints = intDigits(target);
      const dec = !Number.isInteger(target);
      const v = Math.min(value, target);
      ctx.save();
      const parentAlpha = ctx.globalAlpha;
      ctx.translate(x, baseline);
      ctx.scale(pulse, pulse);
      ctx.translate(-x, -baseline);
      const blurLow = Math.min(0.22, (speed / 60) * 0.5 * (dec ? 3 : 1));
      let cx = x;
      for (let p = ints - 1; p >= 0; p--) {
        const unit = Math.pow(10, p);
        let pos;
        if (!dec && p === 0) pos = v;
        else {
          const w = dec ? 0.1 : 1;
          pos = Math.floor(v / unit) + smooth(((v % unit) - (unit - w)) / w);
        }
        const lead = p === 1 ? lerp(0.28, 1, smooth(progress(v, 9, 10))) : p === 2 ? (v >= 99.5 ? 1 : 0.28) : 1;
        drum(ctx, cx, top, size, pos, !dec && p === 0 ? blurLow : blurLow * 0.15, color, parentAlpha * alpha * lead);
        cx += SLOT * size;
      }
      ctx.globalAlpha = parentAlpha * alpha;
      ctx.fillStyle = color;
      ctx.font = numFont(size);
      ctx.textBaseline = 'alphabetic';
      if (dec) {
        ctx.textAlign = 'center';
        ctx.fillText('.', cx + (DOT * size) / 2, baseline);
        cx += DOT * size;
        drum(ctx, cx, top, size, v * 10, blurLow, color, parentAlpha * alpha);
        cx += SLOT * size;
        ctx.globalAlpha = parentAlpha * alpha;
        ctx.fillStyle = color;
        ctx.font = numFont(size);
      }
      ctx.textAlign = 'left';
      ctx.fillText('%', cx + 0.03 * size, baseline);
      ctx.restore();
    };
  };

  // Safari 和 WKWebView 没有 ctx.filter。逐级缩小再逐级放大，每级双线性插值，叠起来接近高斯模糊。
  // 返回两张和原图一样大的结果：近处的光（约 11 设计像素）和远处的光（约 35 设计像素）
  const makeSoftBlur = (src) => {
    const layer = (w, h) => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const g = canvas.getContext('2d');
      g.imageSmoothingQuality = 'high';
      return {canvas, g, w, h};
    };
    const W = src.width;
    const H = src.height;
    const scale = (k) => layer(Math.max(2, Math.round(W / k)), Math.max(2, Math.round(H / k)));
    const down = [scale(2), scale(4), scale(8), scale(16)];
    const nearUp = [scale(2), scale(1)];
    const farUp = [scale(8), scale(4), scale(2), scale(1)];
    const put = (to, from) => {
      to.g.clearRect(0, 0, to.w, to.h);
      to.g.drawImage(from, 0, 0, to.w, to.h);
    };
    return () => {
      down.reduce((from, to) => {
        put(to, from);
        return to.canvas;
      }, src);
      const near = nearUp.reduce((from, to) => {
        put(to, from);
        return to.canvas;
      }, down[1].canvas);
      const far = farUp.reduce((from, to) => {
        put(to, from);
        return to.canvas;
      }, down[3].canvas);
      return [near, far];
    };
  };

  const makeGrain = () => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const img = g.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = hash(i * 0.25 + 0.5) * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  };
  const drawGrain = (c, pattern, S, opacity = 0.05) => {
    c.save();
    c.setTransform(Math.max(1, S), 0, 0, Math.max(1, S), 0, 0);
    c.globalCompositeOperation = 'overlay';
    c.globalAlpha = opacity;
    c.fillStyle = c.createPattern(pattern, 'repeat');
    c.fillRect(0, 0, 3840, 2160);
    c.restore();
  };

  // 从口播原文里找到每个数念到的时刻
  const timeGroups = (raw) => {
    if (!raw.line || !root.DMParser) return raw;
    const P = root.DMParser;
    const text = P.normalizeText(raw.line);
    const timeAt = (i) => P.syllables(text.slice(0, i)) / P.RATE + 0.25;
    let cursor = 0;
    const groups = (raw.groups || []).map((g) => {
      let sTitle = g.sTitle;
      const metrics = (g.metrics || []).map((m) => {
        const nm = Object.assign({}, m);
        const needle = `${m.value}%`;
        const idx = text.indexOf(needle, cursor);
        if (idx < 0) return nm;
        const end = idx + needle.length;
        let cs = idx;
        while (cs > cursor && !/[，。；！？,.;!?：:\s]/.test(text[cs - 1])) cs--;
        const head = text.slice(cs, idx);
        const lead = !m.answer && /^(有|约|近|只有|仅有|其中|其中有|超过|高达|仅)?$/.test(head) && /^(的|表示|认为|觉得|说|称|[\u4e00-\u9fa5])/.test(text.slice(end, end + 1));
        let start = cursor;
        while (start < text.length && /[，。；！？,.;!?：:\s]/.test(text[start])) start++;
        nm.sLand = m.sLand != null ? m.sLand : timeAt(end);
        nm.sCap = m.sCap != null ? m.sCap : lead ? timeAt(end) + 0.05 : timeAt(start);
        if (sTitle == null) sTitle = timeAt(start);
        if (m.note && m.note.text) {
          const ni = text.indexOf(P.normalizeText(m.note.text), end);
          if (ni >= 0) nm.note = Object.assign({}, m.note, {sAt: timeAt(ni), sEnd: timeAt(ni + P.normalizeText(m.note.text).length)});
        }
        cursor = end;
        return nm;
      });
      return Object.assign({}, g, {metrics, sTitle});
    });
    return Object.assign({}, raw, {groups});
  };

  // ---------- 场景 ----------
  const layersOf = (raw, template) => (raw.layers && raw.layers[template]) || null;
  // 速度和延后都把一个元素的结束时间往后推，这一镜的时长要够放完
  const fitDuration = (duration, layers) => {
    let d = duration;
    Object.values(layers || {}).forEach((o) => {
      if (!o.speed && !o.delay) return;
      const a = o.anchor || 0;
      const end = o.end == null ? duration : o.end;
      d = Math.max(d, a + (end - a) / (o.speed || 1) + (o.delay || 0) + 0.4);
    });
    return d;
  };
  const staged = (scene, raw, template, S) => {
    const stage = new root.DMStage.Stage(S, layersOf(raw, template));
    const inner = scene.draw;
    const base = scene.duration;
    // 时间线上拖出来的秒数，也就是速率：拉长整段放慢，缩短整段加快，动画跟着总时长走，内容不会被切掉
    const want = +raw.dur > 0 ? +raw.dur : 0;
    const natural = () => fitDuration(base, stage.layers);
    const timed = (t) => {
      const n = natural();
      return want ? (t * n) / want : t;
    };
    const out = Object.assign(scene, {
      stage,
      baseDuration: base,
      // 动效本身的时长和现在的速率：2 是两倍快
      naturalDuration: () => natural(),
      rate: () => (want ? natural() / want : 1),
      edited: !!stage.layers,
      duration: want || natural(),
      draw(ctx, t) {
        const u = timed(t);
        stage.begin(ctx, u);
        inner(stage, u);
        stage.end();
      },
      setLayers(layers) {
        stage.setLayers(layers);
        out.edited = !!stage.layers;
        out.duration = want || natural();
      },
      // 画一帧，同时收集每个元素这一帧的矩形
      inspect(ctx, t, registry) {
        const u = timed(t);
        stage.rec = [];
        stage.reg = registry || null;
        stage.begin(ctx, u);
        inner(stage, u);
        stage.end();
        const rec = stage.rec;
        stage.rec = null;
        stage.reg = null;
        return rec;
      },
    });
    return out;
  };
  const createScene = (raw1, width = 1920) => {
    // 文件里写的动效已经删了（旧的出镜镜头、删掉的分类）：按重音字幕画，字不丢
    const raw0 = TEMPLATES[raw1.template] || !TEMPLATES.statement ? raw1 : Object.assign({}, raw1, {template: 'statement'});
    const tplDef = TEMPLATES[raw0.template];
    const S0 = width / 1920;
    if (tplDef && tplDef.custom) {
      const made = tplDef.create(raw0, S0);
      return staged({spec: raw0, duration: made.duration, beats: [], draw: made.draw, probes: null, palette: null, custom: true}, raw0, raw0.template, S0);
    }
    const raw = timeGroups(raw0);
    const {errors, spec} = validate(raw);
    if (errors.length) throw new Error(errors.join('；'));
    const tl = buildTimeline(spec);
    const S = width / 1920;
    const scene = TEMPLATES[spec.template].create(spec, tl, S);
    return staged({spec, duration: tl.end, beats: tl.beats, draw: scene.draw, probes: scene.probes || null, palette: scene.palette || null}, raw0, spec.template, S);
  };

  // 平铺成一列：每个数一行，给不分组的模板用
  const flatMetrics = (spec) => spec.groups.flatMap((g) => g.metrics.map((m, mi) => ({m, b: m.beat, title: g.title, showTitle: mi === 0 || !!g.title, relation: g.relation, mi})));

  root.DM = Object.assign(root.DM || {}, {
    clamp, lerp, progress, smooth, outExpo, outCubic, outQuint, wobble, springTo, hash, noise1, bezier, runCurve, hex, mix, css, luma,
    colorRoles, pickColors, FONT_CN, FONT_NUM, FONT_TICK, FONT_TITLE, numFont, setFont, ensureGlyphs, charEm, textEm, loadFonts, TEMPLATES, register, normalize, validate, buildTimeline,
    frontOf, posOf, speedOf, colLit, colFrac, landPulse, focusOf, reveal, leave, wrapText, revealLines, linesH, fitSize,
    numEm, makeReadout, makeGrain, makeSoftBlur, drawGrain, createScene, flatMetrics, themeColors, timeGroups, TEXT: root.DMStage.TEXT,
  });
})(window);
