// 动效库：全部动效的分类、搜索词、自动匹配，以及 14 个文字动效（Motion Prompt，MIT，见 vendor/motion-prompt）。
// 每个命名动效画在一张离屏画布上，整张算一个元素；文字类动效把文案直接放进动作里，每一行是一个元素。
(function (root) {
  'use strict';
  const D = root.DM;
  const MP = root.DMMotionPrompt;
  const TEXT = D.TEXT;
  const {clamp, lerp, progress, smooth, outCubic, outExpo, mix, hex, css} = D;

  // ---------- 分类：用户挑动效时看到的就是这一层 ----------
  const CATEGORIES = [
    {id: 'percent', name: '百分比'},
    {id: 'chart', name: '图表'},
    {id: 'fine', name: '细读图表'},
    {id: 'text', name: '文字'},
    {id: 'texfx', name: '文字特效'},
    {id: 'kxs', name: '状态'},
    {id: 'kxi', name: '交互'},
    {id: 'kxm', name: '质感'},
    {id: 'loader', name: '加载'},
    {id: 'button', name: '按钮'},
    {id: 'toggle', name: '开关提示'},
  ];
  const nameOf = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.name]));

  // 已有模板归类
  const EXISTING = {
    comb: 'percent', dots: 'percent', zoom: 'percent', rank: 'percent', survey: 'percent', gauge: 'percent', tape: 'percent', fill: 'percent', lucy: 'percent', tubes: 'percent', hex: 'percent',
    trend: 'chart', groupBars: 'chart', cohort: 'chart', attrition: 'chart', cycle: 'chart', candy: 'chart',
    titleV: 'text', titleH: 'text', question: 'text', statement: 'text', relay: 'text', rapid: 'text', swap: 'text', split: 'text', reveal: 'text',
    input: 'text', chat: 'text', skip: 'text',
  };
  Object.entries(EXISTING).forEach(([id, cat]) => {
    if (D.TEMPLATES[id]) D.TEMPLATES[id].cat = cat;
  });

  // ---------- 文案里出现这些词，就把这个动效排到前面。写的是文稿会说的话，不是动效的术语 ----------
  const KEYWORDS = {
    5: ['揭开', '浮现', '显现', '露出'],
    6: ['打字', '输入', '敲下', '键入', '提问', '问AI', '问 AI'],
    7: ['涨到', '增长到', '累计', '数字', '翻倍'],
    8: ['节奏', '跳动的字', '动起来'],
    80: ['划重点', '重点', '标出来', '关键'],
    86: ['下划线', '画线', '强调'],
    94: ['滚动字幕', '跑马灯', '滚动播出', '一遍遍'],
    129: ['乱码', '解码', '破译', '密码'],
    130: ['波浪', '起伏', '浪潮'],
    131: ['沿着曲线', '环绕文字'],
    132: ['变粗', '加粗', '越来越重'],
    133: ['镂空', '透出'],
    146: ['逐字', '一字一句', '读下去'],
    156: ['翻滚', '切换文字'],
  };

  // ---------- 文字动作：把文案放进这个动作。没有文案时显示原动效的样子 ----------
  const rnd = (n) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const backOut = (x, s = 1.70158) => 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2;
  const GARBLE = '字数据动效调研用户分析比例模型算法人工智能0123456789%#@&';

  const linesOf = (row) => {
    if (row.lines && row.lines.length) return row.lines.filter(Boolean);
    return [];
  };

  const layout = (lines) => {
    const total = lines.reduce((a, l) => a + [...l].length, 0);
    let size = total <= 6 ? 220 : total <= 12 ? 170 : total <= 24 ? 124 : total <= 48 ? 92 : 72;
    const maxW = 1640;
    let rows;
    for (;;) {
      rows = lines.flatMap((l) => D.wrapText(l, maxW, size, size, 99).lines);
      if (rows.length * size * 1.36 <= 880 || size <= 44) break;
      size -= 6;
    }
    const lh = size * 1.36;
    const top = 540 - (rows.length * lh) / 2 + lh / 2;
    let gi = 0;
    const out = rows.map((text, li) => {
      const w = D.textEm(text) * size;
      let x = 960 - w / 2;
      const y = top + li * lh;
      const chars = [...text].map((ch, i) => {
        const cw = D.charEm(ch) * size;
        const item = {ch, i, gi: gi++, x: x + cw / 2, y, w: cw};
        x += cw;
        return item;
      });
      return {text, li, y, x0: 960 - w / 2, x1: 960 + w / 2, chars, n: chars.length};
    });
    return {rows: out, size, lh, total: gi};
  };

  // 每一行什么时候念到：找得到就跟口播走，找不到按字数排
  const timing = (row, L) => {
    const sp = D.speechOf(row);
    const spans = D.spansOf(row, L.rows.map((r) => r.text), sp);
    L.rows.forEach((r, i) => {
      r.at = spans[i].at;
      r.end = Math.max(spans[i].end, spans[i].at + 0.5);
    });
    return Math.max(sp.dur, L.rows[L.rows.length - 1].end);
  };

  const put = (c, ch, s, fill, size) => {
    c.save();
    c.translate(ch.x + (s.dx || 0), ch.y + (s.dy || 0));
    if (s.rot) c.rotate(s.rot);
    if (s.sx !== undefined || s.sy !== undefined) c.scale(s.sx === undefined ? 1 : s.sx, s.sy === undefined ? 1 : s.sy);
    c.globalAlpha = clamp(s.a === undefined ? 1 : s.a);
    c.fillStyle = s.color || fill;
    if (s.stroke) {
      c.strokeStyle = s.color || fill;
      c.lineWidth = s.stroke * (size / 100);
      c.lineJoin = 'round';
      c.strokeText(s.ch || ch.ch, 0, 0);
    }
    c.fillText(s.ch || ch.ch, 0, 0);
    c.restore();
  };

  // 大多数文字动作只是「每个字在 t 时刻的位置和透明度」
  const charMove = (fn, hooks = {}) => ({fn, hooks});
  const P = progress;
  const TEXT_MOVES = {
    5: charMove((ch, t, r, L) => ({dy: (1 - outExpo(P(t, r.at, r.at + 0.7))) * L.lh}), {clip: true}),
    6: charMove((ch, t, r) => {
      const at = r.at + (ch.i * (r.end - r.at)) / r.n;
      if (t < at) return null;
      const s = 1 + 0.32 * Math.exp(-(t - at) * 16);
      return {sx: s, sy: s};
    }, {
      after(c, t, r, T, L) {
        if (t < r.at || (t > r.end + 0.1 && Math.floor(t * 1.06) % 2)) return;
        const shown = clamp(Math.floor(((t - r.at) / (r.end - r.at)) * r.n), 0, r.n);
        const x = shown === 0 ? r.x0 : r.chars[shown - 1].x + r.chars[shown - 1].w / 2;
        c.fillStyle = T.accent;
        c.fillRect(x + 6, r.y - L.size * 0.5, Math.max(4, L.size * 0.05), L.size);
      },
    }),
    8: charMove((ch, t, r) => {
      const a = P(t, r.at + ch.i * 0.07, r.at + ch.i * 0.07 + 0.4);
      const e = a <= 0 ? 0 : backOut(a, 1.8);
      return {sx: lerp(2.4, 1, e), sy: lerp(2.4, 1, e), rot: (1 - e) * (ch.i % 2 ? -0.6 : 0.6), a: a * 3};
    }),
    80: charMove(() => ({}), {
      behind(c, t, r, T, L) {
        t = c.el(`mark:${r.li}`, '荧光笔');
        const a = smooth(P(t, r.at + 0.1, r.at + 0.75));
        if (a <= 0) return;
        c.fillStyle = css(hex(T.accent), 0.55);
        c.fillRect(r.x0 - 8, r.y - L.size * 0.22, (r.x1 - r.x0 + 16) * a, L.size * 0.62);
      },
    }),
    86: charMove(() => ({}), {
      behind(c, t, r, T, L) {
        t = c.el(`under:${r.li}`, '下划线');
        const a = outCubic(P(t, r.at + 0.1, r.at + 0.7));
        if (a <= 0) return;
        c.fillStyle = T.accent;
        c.fillRect(r.x0, r.y + L.size * 0.56, (r.x1 - r.x0) * a, Math.max(5, L.size * 0.05));
      },
    }),
    129: charMove((ch, t, r) => {
      const at = r.at + 0.15 + ch.i * 0.045;
      if (t < r.at) return null;
      if (t >= at + 0.2) return {};
      const f = Math.floor(t * 22);
      return {ch: GARBLE[Math.floor(rnd(f + ch.gi * 7) * GARBLE.length)], a: 0.7};
    }),
    130: charMove((ch, t, r) => ({dy: Math.sin(t * 4.2 - ch.i * 0.5) * 26, a: P(t, r.at, r.at + 0.3)})),
    131: charMove((ch, t, r) => {
      const a = outCubic(P(t, r.at, r.at + 1.1));
      const x = ch.x + (a - 1) * 1600;
      const y = Math.sin(x * 0.006 + t * 0.6) * 110;
      const slope = Math.cos(x * 0.006 + t * 0.6) * 110 * 0.006;
      return {dx: x - ch.x, dy: y, rot: Math.atan(slope), a: a * 3};
    }),
    132: charMove((ch, t, r) => {
      const w = 0.5 + 0.5 * Math.sin((t - r.at) * 2.2 - ch.i * 0.3);
      return {stroke: 1 + w * 9, a: P(t, r.at, r.at + 0.3)};
    }),
    133: charMove((ch, t, r, L, T) => {
      const k = 0.5 + 0.5 * Math.sin((ch.x - t * 420) / 120);
      return {color: mixHex(T.accent, T.ink, k), a: P(t, r.at, r.at + 0.3)};
    }),
    146: charMove((ch, t, r, L, T) => {
      const at = r.at + (ch.i * (r.end - r.at)) / r.n;
      return {color: mixHex(T.dim, T.ink, smooth(P(t, at, at + 0.22)))};
    }),
    156: charMove((ch, t, r, L) => {
      const a = outExpo(P(t, r.at + ch.i * 0.03, r.at + ch.i * 0.03 + 0.55));
      return {dy: (1 - a) * L.lh};
    }, {clip: true}),
  };

  const mixHex = (a, b, k) => css(mix(hex(a), hex(b), k));
  const NUMBER = /\d+(?:\.\d+)?/;

  // 数字递增、倒计时：念到时数字滚起来，其余的字不动
  const numberMove = (id) => (c, t, r, T, L) => {
    const m = r.text.match(NUMBER);
    const target = m ? parseFloat(m[0]) : 0;
    const dec = m && m[0].includes('.') ? m[0].split('.')[1].length : 0;
    const u = progress(t, r.at, r.at + (id === 164 ? Math.max(1.6, r.end - r.at) : 1.2));
    const v = id === 164 ? target * (1 - u) : target * outCubic(u);
    const text = m ? r.text.replace(m[0], v.toFixed(dec)) : r.text;
    c.fillStyle = T.ink;
    c.font = `${L.size}px ${D.FONT_CN}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.globalAlpha = progress(t, r.at - 0.1, r.at + 0.15);
    c.fillText(text, 960, r.y);
    c.globalAlpha = 1;
  };

  const marqueeDraw = (c, t, L, T) => {
    const text = `${L.rows.map((r) => r.text).join('  ·  ')}  ·  `;
    const size = 180;
    const w = D.textEm(text) * size;
    c.font = `${size}px ${D.FONT_CN}`;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillStyle = T.ink;
    const x = -((t * 260) % w);
    for (let i = 0; i < Math.ceil(1920 / w) + 1; i++) c.fillText(text, x + i * w, 540);
  };

  const themeOf = (row) => {
    const id = row.theme || 'black';
    return id === 'paper'
      ? {id, bg: '#F1EFE8', ink: '#141416', mute: '#6F6C64', dim: '#CFCCC2', accent: '#EE3A17'}
      : {id, bg: '#0A0A0B', ink: '#F4F1EA', mute: '#8E8B85', dim: '#363639', accent: '#FF5C1E'};
  };

  const createTextScene = (row, S, n) => {
    const T = themeOf(row);
    const L = layout(linesOf(row));
    const speech = timing(row, L);
    const dur = Math.max(speech, 1) + (row.hold != null ? +row.hold : 1.8);
    const move = TEXT_MOVES[n];
    const draw = (c, t0) => {
      D.clearFrame(c, S, T.bg);
      if (n === 94) {
        const t = c.el('marquee', '滚动文字', TEXT);
        marqueeDraw(c, t, L, T);
        return;
      }
      L.rows.forEach((r) => {
        if (move && move.hooks.behind) move.hooks.behind(c, t0, r, T, L);
        const t = c.el(`line:${r.li}`, r.text, TEXT);
        c.font = `${L.size}px ${D.FONT_CN}`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        if (n === 7 || n === 164) {
          numberMove(n)(c, t, r, T, L);
          return;
        }
        if (move.hooks.clip) {
          c.save();
          c.beginPath();
          c.rect(r.x0 - 40, r.y - L.lh / 2, r.x1 - r.x0 + 80, L.lh);
          c.clip();
        }
        r.chars.forEach((ch) => {
          const s = move.fn(ch, t, r, L, T);
          if (!s) return;
          if (move.hooks.trail) {
            for (let k = move.hooks.trail; k > 0; k--) {
              const g = move.fn(ch, t - k * 0.035, r, L, T);
              if (g) put(c, ch, Object.assign({}, g, {a: clamp(g.a === undefined ? 1 : g.a) * (0.32 / k)}), T.ink, L.size);
            }
          }
          if (move.hooks.split) {
            const off = s.dx ? 9 : 0;
            if (off) {
              put(c, ch, Object.assign({}, s, {dx: s.dx + off, color: '#FF2D55', a: 0.8}), T.ink, L.size);
              put(c, ch, Object.assign({}, s, {dx: s.dx - off, color: '#22E0FF', a: 0.8}), T.ink, L.size);
            }
          }
          put(c, ch, s, T.ink, L.size);
        });
        if (move.hooks.clip) c.restore();
        if (move.hooks.after) move.hooks.after(c, t, r, T, L);
      });
    };
    return {duration: dur, draw};
  };

  // ---------- WebKit 没有 ctx.filter（App 的预览和导出都走 WebKit），动效里的模糊要自己做 ----------
  // 办法和 core.js 的辉光一样：缩小再放大。缩放用的中间画布按尺寸留着，不用每帧新建
  const nativeFilter = 'filter' in CanvasRenderingContext2D.prototype && !root.DM_FORCE_NO_FILTER;
  const rawDraw = CanvasRenderingContext2D.prototype.drawImage;
  const scratch = new Map();
  const scratchOf = (w, h) => {
    const key = `${w}x${h}`;
    if (!scratch.has(key)) {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const g = canvas.getContext('2d');
      g.imageSmoothingQuality = 'high';
      scratch.set(key, {canvas, g});
    }
    return scratch.get(key);
  };
  const blurred = (src, radius) => {
    const W = src.width;
    const H = src.height;
    const levels = clamp(Math.round(Math.log2(Math.max(2, radius * 1.6))), 1, 5);
    const size = (i) => [Math.max(2, W >> i), Math.max(2, H >> i)];
    let cur = src;
    for (let i = 1; i <= levels; i++) {
      const [w, h] = size(i);
      const t = scratchOf(w, h);
      t.g.clearRect(0, 0, w, h);
      rawDraw.call(t.g, cur, 0, 0, w, h);
      cur = t.canvas;
    }
    for (let i = levels - 1; i >= 0; i--) {
      const [w, h] = size(i);
      const t = i === 0 ? scratchOf(W, H) : scratchOf(w + 1, h + 1);
      t.g.clearRect(0, 0, t.canvas.width, t.canvas.height);
      rawDraw.call(t.g, cur, 0, 0, t.canvas.width, t.canvas.height);
      cur = t.canvas;
    }
    return cur;
  };
  const blurOf = (v) => {
    const m = /blur\(([\d.]+)px\)/.exec(String(v || ''));
    return m ? +m[1] : 0;
  };
  if (!nativeFilter) {
    // 动效自己的离屏画布：它们只在贴图时用模糊
    const P = CanvasRenderingContext2D.prototype;
    Object.defineProperty(P, 'filter', {
      configurable: true,
      get() {
        return this.dmFilter || 'none';
      },
      set(v) {
        this.dmFilter = v;
      },
    });
    P.drawImage = function (img, ...a) {
      const b = blurOf(this.dmFilter);
      if (b <= 0) return rawDraw.call(this, img, ...a);
      return rawDraw.call(this, blurred(img, b), ...a);
    };
  }
  // 主画布上是矢量图形带模糊（焦点转移、深焦）。连续同样模糊的绘制先画到一层上，换模糊时一起糊完贴回来
  const FORWARD_BASE = new Set(['measureText', 'getTransform', 'createLinearGradient', 'createRadialGradient', 'createConicGradient', 'createPattern', 'getImageData', 'isPointInPath', 'isPointInStroke', 'getLineDash', 'createImageData']);
  const DRAWS = new Set(['fill', 'stroke', 'fillRect', 'strokeRect', 'fillText', 'strokeText', 'drawImage', 'clearRect', 'putImageData']);
  const blurContext = (base, makeLayer, k) => {
    const layerCanvas = makeLayer();
    const layer = scaledContext(layerCanvas, k);
    let blur = 0;
    let current = base;
    let inked = false;
    const stack = [];
    const flush = () => {
      if (!inked) return;
      inked = false;
      const soft = blurred(layerCanvas, blur * k);
      base.save();
      base.setTransform(1 / k, 0, 0, 1 / k, 0, 0);
      base.globalAlpha = 1;
      base.globalCompositeOperation = 'source-over';
      rawDraw.call(base, soft, 0, 0);
      base.restore();
      layer.save();
      layer.setTransform(1 / k, 0, 0, 1 / k, 0, 0);
      layer.clearRect(0, 0, layerCanvas.width, layerCanvas.height);
      layer.restore();
    };
    const setBlur = (b) => {
      if (b === blur) return;
      flush();
      blur = b;
      current = b > 0 ? layer : base;
    };
    const methods = new Map();
    const proxy = new Proxy(base, {
      get(_, prop) {
        if (prop === 'filter') return blur > 0 ? `blur(${blur}px)` : 'none';
        if (prop === 'dmFlush') return flush;
        const v = base[prop];
        if (typeof v !== 'function') return v;
        if (!methods.has(prop)) {
          let fn;
          if (FORWARD_BASE.has(prop)) fn = (...a) => base[prop](...a);
          else if (DRAWS.has(prop)) {
            fn = (...a) => {
              if (current === layer) inked = true;
              return prop === 'drawImage' ? rawDraw.apply(current, a) : current[prop](...a);
            };
          } else if (prop === 'save') {
            fn = () => {
              stack.push(blur);
              base.save();
              layer.save();
            };
          } else if (prop === 'restore') {
            fn = () => {
              if (stack.length) setBlur(stack.pop());
              base.restore();
              layer.restore();
            };
          } else {
            fn = (...a) => {
              layer[prop](...a);
              return base[prop](...a);
            };
          }
          methods.set(prop, fn);
        }
        return methods.get(prop);
      },
      set(_, prop, value) {
        if (prop === 'filter') {
          setBlur(blurOf(value));
          return true;
        }
        base[prop] = value;
        layer[prop] = value;
        return true;
      },
    });
    return proxy;
  };

  // ---------- 整张动效：画到离屏画布上，再贴到舞台 ----------
  // 动效作者写的是 539×208 这样的小卡片，这里按画面宽度放大。它们有的会 setTransform 回单位矩阵，所以替换这个方法，补上放大倍数
  const scaledContext = (canvas, k) => {
    const raw = canvas.getContext('2d');
    const set = raw.setTransform.bind(raw);
    raw.setTransform = (a, b, cc, d, e, f) => {
      if (typeof a !== 'number') return set(a);
      return set(a * k, b * k, cc * k, d * k, e * k, f * k);
    };
    raw.resetTransform = () => set(k, 0, 0, k, 0, 0);
    return raw;
  };

  const edgeColor = (el) => {
    // 网页和界面动效是一个窗口放在桌面上，留边用桌面的颜色；其余留黑边，就是宽银幕
    if (!['ui', 'lp', 'lp2'].includes(el.pack)) return '#0A0A0B';
    const probe = document.createElement('canvas');
    probe.width = el.width;
    probe.height = el.height;
    const g = probe.getContext('2d', {willReadFrequently: true});
    const cell = MP.get(el.pack).cells[+el.no - 1];
    g.save();
    cell(g, el.width, el.height, el.hero);
    g.restore();
    const d = g.getImageData(1, el.height >> 1, 1, 1).data;
    return d[3] < 200 ? '#000000' : `#${[d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  };

  const createCardScene = (row, S, el) => {
    const cell = MP.get(el.pack).cells[+el.no - 1];
    const lines = linesOf(row);
    const k = 1920 / el.width;
    const H = el.height * k;
    const wrap = lines.length ? D.wrapText(lines.join('  '), 1640, 88, 44, 2) : null;
    const y0 = wrap ? Math.max(30, (1080 - H - D.linesH(wrap) - 50) / 2) : (1080 - H) / 2;
    const off = document.createElement('canvas');
    off.width = Math.max(2, Math.round(1920 * S));
    off.height = Math.max(2, Math.round(H * S));
    const scale = off.width / el.width;
    const flat = scaledContext(off, scale);
    const g = nativeFilter
      ? flat
      : blurContext(flat, () => {
          const layer = document.createElement('canvas');
          layer.width = off.width;
          layer.height = off.height;
          return layer;
        }, scale);
    const bg = edgeColor(el);
    const ink = D.luma(D.hex(bg)) > 0.5 ? '#141416' : '#F4F1EA';
    const sp = D.speechOf(row);
    const cycle = el.cycle;
    // 成片停在这个动效最好看的一帧上：选中镜头时看到的就是它
    const need = Math.max(sp.dur + 0.4, el.hero);
    const loops = Math.ceil((need - el.hero) / cycle);
    const end = loops * cycle + el.hero;
    const dur = end + (row.hold != null ? +row.hold : 0);
    const draw = (c, t0) => {
      c.bg();
      c.fillStyle = bg;
      c.fillRect(0, 0, 1920, 1080);
      const t = c.el('card', el.name);
      const u = ((Math.min(Math.max(t, 0), end) % cycle) + cycle) % cycle;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
      g.clearRect(0, 0, el.width, el.height);
      g.save();
      cell(g, el.width, el.height, u);
      g.restore();
      if (g.dmFlush) g.dmFlush();
      // 换色：保留明暗，只换色相。整张动效是一张图，没法一块一块换
      const tint = c.tint;
      if (tint) {
        g.save();
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalCompositeOperation = 'color';
        g.globalAlpha = 1;
        g.fillStyle = `rgb(${tint[0]},${tint[1]},${tint[2]})`;
        g.fillRect(0, 0, el.width, el.height);
        g.restore();
      }
      // 贴图本身不变，告诉普查这张图一直在动，时间条才覆盖整段
      c.pathSig = Math.floor(u * 30);
      c.drawImage(off, 0, y0, 1920, H);
      c.pathSig = 0;
      if (wrap) {
        const tt = c.el('caption', lines.join(' '), TEXT);
        D.revealLines(c, wrap, 960, y0 + H + 40, ink, tt, 0.2, 'center');
      }
    };
    return {duration: dur, draw};
  };

  // ---------- 注册 ----------
  MP.catalog.forEach((el) => {
    const n = +el.id;
    const hasText = !!TEXT_MOVES[n] || n === 7 || n === 94;
    D.register(`mp${el.id}`, {
      name: el.name,
      family: nameOf.text,
      cat: 'text',
      custom: true,
      library: true,
      desc: el.meaning,
      en: el.en,
      keywords: KEYWORDS[n] || [],
      takesText: hasText,
      source: 'Motion Prompt（MIT）',
      colors: {},
      accepts: () => true,
      create(row, S) {
        const lines = linesOf(row);
        if (hasText && lines.length) {
          if (n === 7 && !lines.some((l) => NUMBER.test(l))) return createCardScene(row, S, el);
          return createTextScene(row, S, n);
        }
        return createCardScene(row, S, el);
      },
    });
  });

  // ---------- 目录和匹配：全部动效一个入口 ----------
  const textOf = (row) => `${row.line || ''} ${(row.lines || []).join(' ')}`;
  // 文案说到了什么。没说到就是 0 分，不瞎配
  const keywordHit = (tpl, text) => {
    let best = '';
    for (const w of tpl.keywords || []) if (w.length > best.length && text.includes(w)) best = w;
    return best;
  };
  D.keywordHit = keywordHit;

  // 界面小组件和特效字只配短句。长句里碰巧有「搜索」两个字，说的不是搜索框
  const SHORT_ONLY = new Set(['texfx', 'kxi', 'kxs', 'kxm', 'loader', 'button', 'toggle']);
  const SHORT_LINE = 20;
  const fitsLine = (tpl, text) => {
    if (!SHORT_ONLY.has(tpl.cat)) return true;
    if ([...text].length > SHORT_LINE) return false;
    return !tpl.accepts || tpl.accepts({line: text, lines: [text]});
  };

  D.fitLibrary = (tpl, row) => {
    const hit = keywordHit(tpl, textOf(row));
    if (!hit || !fitsLine(tpl, String(row.line || (row.lines || []).join('')))) return {score: 12, why: tpl.desc};
    return {score: 70 + hit.length * 4 + (tpl.takesText ? 6 : 0), why: `说到「${hit}」：${tpl.desc}`};
  };

  // 给一句文案挑动效：只在文案确实说到时才换，同一个动效全片最多用两次
  D.matchMotion = (text, used = {}) => {
    let best = null;
    Object.values(D.TEMPLATES).forEach((tpl) => {
      if (!tpl.library || !tpl.takesText) return;
      const hit = keywordHit(tpl, text);
      if (!hit || (used[tpl.id] || 0) >= 2 || !fitsLine(tpl, text)) return;
      const score = hit.length * 4 - (used[tpl.id] || 0) * 3;
      if (!best || score > best.score) best = {id: tpl.id, name: tpl.name, hit, score, cat: tpl.cat};
    });
    return best;
  };

  // 样例数据：缩略图用，选了缺数据的动效时也先用它让人看到样子（会标要确认，不能导出）
  const PERCENT_SAMPLE = {groups: [{title: '', relation: 'parallel', metrics: [{caption: '第一项', value: 62}, {caption: '第二项', value: 38}]}]};
  D.sampleOf = (id) => {
    const tpl = D.TEMPLATES[id];
    return (tpl && tpl.sample) || (D.SAMPLES && D.SAMPLES[id]) || (tpl && !tpl.custom ? PERCENT_SAMPLE : {});
  };
  // 有些动效最后一帧已经淡出，缩略图取中间
  ['titleV', 'titleH'].forEach((id) => {
    if (D.TEMPLATES[id]) D.TEMPLATES[id].thumbAt = 0.5;
  });
  D.thumbTime = (id, scene) => {
    const k = D.TEMPLATES[id] && D.TEMPLATES[id].thumbAt;
    return k ? scene.duration * k : Math.max(0, scene.duration - 0.05);
  };

  const canDraw = (row, id) => {
    try {
      D.createScene(Object.assign({}, row, {template: id, tpl: id}), 64);
      return true;
    } catch (e) {
      return false;
    }
  };
  const OWN = new Set(['id', 'no', 'ch', 'kind', 'cat', 'line', 'visual', 'tpl', 'note', 'pending', 'sampleData', 'layers', 'speed', 'hold', 'dur', 'theme']);
  const firstSentence = (text) => {
    const s = String(text || '').split(/[。！？!?\n]/).map((x) => x.trim()).filter(Boolean)[0] || '';
    return [...s].length <= 40 ? s : '';
  };
  // 给一镜换动效。数据够就直接换；不够就放样例，标要确认，改成真实数字之前不能导出
  const SAMPLE_NOTE = '这是样例数据，改成真实的再导出';
  D.adopt = (row, id) => {
    const next = Object.assign({}, row, {tpl: id});
    const tpl = D.TEMPLATES[id];
    if (!tpl) return next;
    delete next.template;
    // 上一个动效放的样例不留到下一个：样例字段、标记和那句说明都拿掉，原来的备注还在
    if (next.sampleData) {
      Object.keys(D.sampleOf(row.tpl)).forEach((k) => {
        if (!OWN.has(k)) delete next[k];
      });
      delete next.sampleData;
      const rest = String(next.note || '').replace(SAMPLE_NOTE, '').replace(/^；/, '');
      if (rest) next.note = rest;
      else delete next.note;
    }
    if (tpl.takesText && !(next.lines && next.lines.length)) {
      const s = firstSentence(next.line);
      if (s) next.lines = [s];
    }
    const ready = tpl.custom ? !tpl.accepts || tpl.accepts(next) : canDraw(next, id);
    if (ready) return next;
    const sample = D.sampleOf(id);
    Object.keys(sample).forEach((k) => {
      if (!OWN.has(k)) next[k] = sample[k];
    });
    next.sampleData = true;
    next.note = next.note ? `${SAMPLE_NOTE}；${next.note}` : SAMPLE_NOTE;
    return next;
  };

  D.CATEGORIES = CATEGORIES;
  D.catalog = () => {
    const order = Object.fromEntries(CATEGORIES.map((c, i) => [c.id, i]));
    return Object.values(D.TEMPLATES)
      .map((t) => ({id: t.id, name: t.name, category: t.cat || 'text', categoryName: nameOf[t.cat || 'text'], desc: t.desc || '', keywords: t.keywords || [], en: t.en || ''}))
      .sort((a, b) => order[a.category] - order[b.category]);
  };

  // 给 AI 的动效清单：写进分镜提示词
  D.libraryPrompt = () => {
    const by = {};
    Object.values(D.TEMPLATES).forEach((t) => {
      // 加载、按钮、开关几十个样子只差细节，靠人手选，不进提示词
      if (!t.library || ['loader', 'button', 'toggle'].includes(t.cat)) return;
      (by[t.cat] = by[t.cat] || []).push(`${t.id} ${t.name}${t.takesText ? '*' : ''}`);
    });
    const list = CATEGORIES.filter((c) => by[c.id]).map((c) => `${c.name}：${by[c.id].join('，')}`).join('\n');
    return `\n\n动效库（文案确实说到才用，tpl 写编号；带 * 的动效，data 里写 lines 就把文字放进动作，其余 lines 是字幕，可省略）：\n${list}`;
  };
})(window);
