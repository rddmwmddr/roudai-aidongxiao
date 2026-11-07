// CSS 放映机：把一段写好 CSS 动画的小组件放进看不见的影子 DOM，用 Web Animations 把时间拨到 t，
// 读出每个元素此刻的计算样式，自己画到 Canvas 上。这样纯 CSS 的动效也能逐帧导出，同一时刻永远同一帧。
// 伪元素在一开始换成真元素（x-b、x-a），文字节点包进 x-t，这样才拿得到不受变形影响的版面位置。
// 没有用 ctx.filter（WebKit 没有）：模糊、调色都自己做，Chrome 和 App 里走同一条路。
(function (root) {
  'use strict';
  const D = root.DM;

  const num = (v, d = 0) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : d;
  };

  // 长度：百分比相对 base，也认 calc(100% - 36px)
  const lengthOf = (v, base) => {
    const text = String(v).trim();
    if (/^calc\(/.test(text)) {
      let total = 0;
      const re = /([+-]?)\s*(-?[\d.]+)(%|px)?/g;
      let m;
      const body = text.slice(5, -1);
      while ((m = re.exec(body))) {
        const value = (m[1] === '-' ? -1 : 1) * parseFloat(m[2]);
        total += m[3] === '%' ? (value / 100) * base : value;
      }
      return total;
    }
    return /%$/.test(text) ? (parseFloat(text) / 100) * base : parseFloat(text) || 0;
  };

  // ---------- 字符串解析 ----------
  // 按顶层逗号或空格切开，括号里的不切
  const splitTop = (text, sep = ',') => {
    const out = [];
    let depth = 0;
    let cur = '';
    for (const ch of String(text)) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (depth === 0 && (sep === ' ' ? /\s/.test(ch) : ch === sep)) {
        if (cur.trim()) out.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  };

  // color-mix 算出来是 color(srgb r g b / a)，画布的影子颜色不认，统一转成 rgba
  const rgbaOf = (c) => {
    const m = /^color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.e-]+))?\)$/.exec(String(c).trim());
    if (!m) return c;
    const v = (x) => Math.round(Math.min(1, Math.max(0, +x)) * 255);
    return `rgba(${v(m[1])},${v(m[2])},${v(m[3])},${m[4] === undefined ? 1 : +m[4]})`;
  };
  const isColorWord = (w) => /^(rgb|hsl|hwb|lab|lch|oklab|oklch|color|#|transparent|currentcolor|[a-z]+$)/i.test(w) && !/^(inset|none|at|from|circle|ellipse|to|closest|farthest)/i.test(w);

  // text-shadow、box-shadow：颜色、x、y、模糊、扩展、inset
  const parseShadows = (text) => {
    if (!text || text === 'none') return [];
    return splitTop(text).map((part) => {
      const out = {color: 'rgba(0,0,0,0)', x: 0, y: 0, blur: 0, spread: 0, inset: false};
      const lens = [];
      splitTop(part, ' ').forEach((w) => {
        if (w === 'inset') out.inset = true;
        else if (/^-?[\d.]/.test(w)) lens.push(num(w));
        else out.color = rgbaOf(w);
      });
      [out.x, out.y, out.blur, out.spread] = [lens[0] || 0, lens[1] || 0, lens[2] || 0, lens[3] || 0];
      return out;
    });
  };

  const parseStops = (parts) => {
    const stops = [];
    parts.forEach((p) => {
      const words = splitTop(p, ' ');
      const color = words.find((w) => !/^-?[\d.]+(%|px|deg|turn|rad|grad)?$/.test(w));
      const places = words.filter((w) => /^-?[\d.]+(%|px|deg|turn|rad|grad)?$/.test(w));
      if (!color) return; // 颜色提示，忽略
      if (places.length === 0) stops.push({color: rgbaOf(color), at: null});
      places.forEach((w) => stops.push({color: rgbaOf(color), at: w}));
    });
    return stops;
  };

  const angleOf = (w) => {
    if (/turn$/.test(w)) return num(w) * Math.PI * 2;
    if (/rad$/.test(w)) return num(w);
    if (/grad$/.test(w)) return (num(w) / 400) * Math.PI * 2;
    return (num(w) * Math.PI) / 180;
  };

  // 把位置值换成 0..1。px 要知道渐变线长度
  const placeStops = (stops, length) => {
    const out = stops.map((s) => {
      if (s.at == null) return {color: s.color, at: null};
      if (/%$/.test(s.at)) return {color: s.color, at: num(s.at) / 100};
      if (/(deg|turn|rad|grad)$/.test(s.at)) return {color: s.color, at: angleOf(s.at) / (Math.PI * 2)};
      return {color: s.color, at: length ? num(s.at) / length : 0};
    });
    if (!out.length) return out;
    if (out[0].at == null) out[0].at = 0;
    if (out[out.length - 1].at == null) out[out.length - 1].at = Math.max(1, ...out.map((s) => s.at || 0));
    for (let i = 1; i < out.length; i++) {
      if (out[i].at == null) {
        let j = i;
        while (out[j].at == null) j++;
        const from = out[i - 1].at;
        const step = (out[j].at - from) / (j - i + 1);
        for (let n = i; n < j; n++) out[n].at = from + step * (n - i + 1);
      }
      if (out[i].at < out[i - 1].at) out[i].at = out[i - 1].at;
    }
    return out;
  };

  const addStops = (grad, stops, from, span, repeat) => {
    if (!stops.length) return;
    const first = stops[0].at;
    const last = stops[stops.length - 1].at;
    const put = (at, color) => {
      const k = (at - from) / span;
      if (k >= 0 && k <= 1) grad.addColorStop(k, color);
    };
    if (!repeat || last <= first) {
      stops.forEach((s) => {
        const k = Math.max(0, Math.min(1, (s.at - from) / span));
        grad.addColorStop(k, s.color);
      });
      return;
    }
    const size = last - first;
    const start = Math.floor((from - first) / size);
    const end = Math.ceil((from + span - first) / size);
    for (let n = start; n <= Math.min(end, start + 400); n++) {
      stops.forEach((s) => put(s.at + n * size, s.color));
    }
  };

  // 在 w×h 的盒子里造渐变。不认识的返回 null
  const makeGradient = (g, text, w, h) => {
    const m = /^(repeating-)?(linear|radial|conic)-gradient\((.*)\)$/s.exec(text.trim());
    if (!m) return null;
    const repeat = !!m[1];
    const kind = m[2];
    const parts = splitTop(m[3]);
    if (kind === 'linear') {
      let angle = Math.PI;
      if (/(deg|turn|rad|grad)$/.test(parts[0]) || /^to /.test(parts[0])) {
        const head = parts.shift();
        if (/^to /.test(head)) {
          const side = head.slice(3);
          const dx = /left/.test(side) ? -1 : /right/.test(side) ? 1 : 0;
          const dy = /top/.test(side) ? -1 : /bottom/.test(side) ? 1 : 0;
          angle = Math.atan2(dx * h, -dy * w);
          if (dx === 0) angle = dy < 0 ? 0 : Math.PI;
          if (dy === 0) angle = dx > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else angle = angleOf(head);
      }
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      const len = Math.abs(w * sin) + Math.abs(h * cos);
      const cx = w / 2;
      const cy = h / 2;
      const x0 = cx - (sin * len) / 2;
      const y0 = cy + (cos * len) / 2;
      const stops = placeStops(parseStops(parts), len);
      if (!repeat) {
        const grad = g.createLinearGradient(x0, y0, x0 + sin * len, y0 - cos * len);
        addStops(grad, stops, 0, 1, false);
        return grad;
      }
      // 重复：把渐变线拉长到盖住，起点不变
      const span = Math.max(1, stops[stops.length - 1].at);
      const grad = g.createLinearGradient(x0, y0, x0 + sin * len, y0 - cos * len);
      addStops(grad, stops, 0, 1, true);
      return span ? grad : grad;
    }
    if (kind === 'radial') {
      let cx = w / 2;
      let cy = h / 2;
      let shape = 'ellipse';
      let rx = null;
      let ry = null;
      let size = 'farthest-corner';
      const head = parts[0];
      if (/^(circle|ellipse|closest-|farthest-|at\b)/.test(head) || /^-?[\d.]+(px|%|em)?(\s|$)/.test(head)) {
        parts.shift();
        const [left, at] = head.split(/\bat\b/).map((v) => (v || '').trim());
        if (at !== undefined) {
          const pos = splitTop(at, ' ');
          cx = pos[0] === 'left' ? 0 : pos[0] === 'right' ? w : pos[0] === 'center' ? w / 2 : lengthOf(pos[0], w);
          const py = pos[1] || 'center';
          cy = py === 'top' ? 0 : py === 'bottom' ? h : py === 'center' ? h / 2 : lengthOf(py, h);
        }
        const words = splitTop(left, ' ');
        words.forEach((v) => {
          if (v === 'circle' || v === 'ellipse') shape = v;
          else if (/^(closest|farthest)/.test(v)) size = v;
        });
        const plain = words.filter((v) => /^(-?[\d.]|calc)/.test(v));
        if (plain.length) {
          rx = lengthOf(plain[0], w);
          const second = plain[1] || plain[0];
          ry = lengthOf(second, plain[1] ? h : w);
          if (plain.length === 1) shape = 'circle';
        }
      }
      if (rx == null) {
        const dxs = [Math.abs(cx), Math.abs(w - cx)];
        const dys = [Math.abs(cy), Math.abs(h - cy)];
        const fx = /closest/.test(size) ? Math.min(...dxs) : Math.max(...dxs);
        const fy = /closest/.test(size) ? Math.min(...dys) : Math.max(...dys);
        if (shape === 'circle') {
          rx = /side/.test(size) ? (/closest/.test(size) ? Math.min(fx, fy) : Math.max(fx, fy)) : Math.hypot(fx, fy);
          ry = rx;
        } else {
          const stretch = /side/.test(size) ? 1 : Math.SQRT2;
          rx = fx * stretch;
          ry = fy * stretch;
        }
      }
      const r = Math.max(0.001, rx);
      const stops = placeStops(parseStops(parts), r);
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
      addStops(grad, stops, 0, 1, repeat);
      return {radial: true, grad, cx, cy, sx: 1, sy: Math.max(0.001, ry) / r};
    }
    // conic
    let from = 0;
    let cx = w / 2;
    let cy = h / 2;
    const head = parts[0];
    if (/^(from|at)\b/.test(head)) {
      parts.shift();
      const fm = /from\s+(\S+)/.exec(head);
      if (fm) from = angleOf(fm[1]);
      const am = /at\s+(.+)$/.exec(head);
      if (am) {
        const pos = splitTop(am[1], ' ');
        cx = pos[0] === 'center' ? w / 2 : lengthOf(pos[0], w);
        const py = pos[1] || 'center';
        cy = py === 'center' ? h / 2 : lengthOf(py, h);
      }
    }
    const grad = g.createConicGradient(from - Math.PI / 2, cx, cy);
    addStops(grad, placeStops(parseStops(parts), 1), 0, 1, repeat);
    return grad;
  };

  const roundedRect = (g, x, y, w, h, r) => {
    const [tl, tr, br, bl] = r.map((c) => ({x: Math.max(0, c.x), y: Math.max(0, c.y)}));
    g.moveTo(x + tl.x, y);
    g.lineTo(x + w - tr.x, y);
    if (tr.x || tr.y) g.ellipse(x + w - tr.x, y + tr.y, tr.x, tr.y, 0, -Math.PI / 2, 0);
    g.lineTo(x + w, y + h - br.y);
    if (br.x || br.y) g.ellipse(x + w - br.x, y + h - br.y, br.x, br.y, 0, 0, Math.PI / 2);
    g.lineTo(x + bl.x, y + h);
    if (bl.x || bl.y) g.ellipse(x + bl.x, y + h - bl.y, bl.x, bl.y, 0, Math.PI / 2, Math.PI);
    g.lineTo(x, y + tl.y);
    if (tl.x || tl.y) g.ellipse(x + tl.x, y + tl.y, tl.x, tl.y, 0, Math.PI, Math.PI * 1.5);
    g.closePath();
  };

  // ---------- 模糊和调色：自己做，WebKit 没有 ctx.filter ----------
  const blurLayer = (canvas, radius, pool) => {
    if (radius < 0.4) return null;
    // 缩小再放大几次，等效高斯。半径越大缩得越多
    const w = canvas.width;
    const h = canvas.height;
    const steps = Math.max(1, Math.min(5, Math.ceil(Math.log2(radius / 1.5 + 1))));
    let src = canvas;
    let sw = w;
    let sh = h;
    const used = [];
    for (let i = 0; i < steps; i++) {
      const dw = Math.max(1, Math.ceil(sw / 2));
      const dh = Math.max(1, Math.ceil(sh / 2));
      const next = pool.take(w, h);
      used.push(next);
      next.g.setTransform(1, 0, 0, 1, 0, 0);
      next.g.clearRect(0, 0, w, h);
      next.g.imageSmoothingEnabled = true;
      next.g.imageSmoothingQuality = 'high';
      next.g.drawImage(src, 0, 0, sw, sh, 0, 0, dw, dh);
      src = next.canvas;
      sw = dw;
      sh = dh;
    }
    for (let i = steps - 2; i >= 0; i--) {
      const dw = Math.ceil(w / 2 ** (i + 1));
      const dh = Math.ceil(h / 2 ** (i + 1));
      const next = pool.take(w, h);
      used.push(next);
      next.g.setTransform(1, 0, 0, 1, 0, 0);
      next.g.clearRect(0, 0, w, h);
      next.g.imageSmoothingQuality = 'high';
      next.g.drawImage(src, 0, 0, sw, sh, 0, 0, dw, dh);
      src = next.canvas;
      sw = dw;
      sh = dh;
    }
    const out = pool.take(w, h);
    out.g.setTransform(1, 0, 0, 1, 0, 0);
    out.g.clearRect(0, 0, w, h);
    out.g.imageSmoothingQuality = 'high';
    out.g.drawImage(src, 0, 0, sw, sh, 0, 0, w, h);
    used.forEach((u) => pool.give(u));
    return out;
  };

  const colorMatrix = (data, m) => {
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const r = data[i];
      const gg = data[i + 1];
      const b = data[i + 2];
      data[i] = r * m[0] + gg * m[1] + b * m[2] + m[9];
      data[i + 1] = r * m[3] + gg * m[4] + b * m[5] + m[10];
      data[i + 2] = r * m[6] + gg * m[7] + b * m[8] + m[11];
    }
  };
  const FILTER_MATRIX = {
    hue(a) {
      const c = Math.cos(a);
      const s = Math.sin(a);
      return [
        0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
        0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
        0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
        0, 0, 0,
      ];
    },
    saturate(k) {
      return [
        0.213 + 0.787 * k, 0.715 - 0.715 * k, 0.072 - 0.072 * k,
        0.213 - 0.213 * k, 0.715 + 0.285 * k, 0.072 - 0.072 * k,
        0.213 - 0.213 * k, 0.715 - 0.715 * k, 0.072 + 0.928 * k,
        0, 0, 0,
      ];
    },
    brightness: (k) => [k, 0, 0, 0, k, 0, 0, 0, k, 0, 0, 0],
    contrast(k) {
      const o = 127.5 * (1 - k);
      return [k, 0, 0, 0, k, 0, 0, 0, k, o, o, o];
    },
    invert(k) {
      const s = 1 - 2 * k;
      const o = 255 * k;
      return [s, 0, 0, 0, s, 0, 0, 0, s, o, o, o];
    },
    sepia(k) {
      const q = 1 - k;
      return [
        0.393 + 0.607 * q, 0.769 - 0.769 * q, 0.189 - 0.189 * q,
        0.349 - 0.349 * q, 0.686 + 0.314 * q, 0.168 - 0.168 * q,
        0.272 - 0.272 * q, 0.534 - 0.534 * q, 0.131 + 0.869 * q,
        0, 0, 0,
      ];
    },
  };

  const parseFilter = (text) => {
    if (!text || text === 'none') return [];
    const out = [];
    const re = /([a-z-]+)\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g;
    let m;
    while ((m = re.exec(text))) out.push([m[1], m[2].trim()]);
    return out;
  };

  class Pool {
    constructor() {
      this.free = [];
    }

    take(w, h) {
      const i = this.free.findIndex((s) => s.canvas.width === w && s.canvas.height === h);
      if (i >= 0) return this.free.splice(i, 1)[0];
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      return {canvas, g: canvas.getContext('2d', {willReadFrequently: false})};
    }

    give(slot) {
      if (this.free.length < 24) this.free.push(slot);
    }
  }
  const pool = new Pool();

  // ---------- 4×4 矩阵：3D 变形投影到屏幕 ----------
  const ID = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const mul = (a, b) => {
    const o = new Array(16);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
    }
    return o;
  };
  const translate3 = (x, y, z = 0) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
  const parseMatrix = (text) => {
    if (!text || text === 'none') return null;
    const m = /matrix(3d)?\(([^)]+)\)/.exec(text);
    if (!m) return null;
    const v = m[2].split(',').map(Number);
    if (m[1]) return v;
    return [v[0], v[1], 0, 0, v[2], v[3], 0, 0, 0, 0, 1, 0, v[4], v[5], 0, 1];
  };
  const project = (m, x, y) => {
    const w = m[3] * x + m[7] * y + m[15];
    const k = w > 0.001 ? 1 / w : 1000;
    return [(m[0] * x + m[4] * y + m[12]) * k, (m[1] * x + m[5] * y + m[13]) * k, (m[2] * x + m[6] * y + m[14]) * k];
  };

  // ---------- 放映机 ----------
  const SEL_PSEUDO = /::?(before|after)\b/g;
  const rewriteCss = (css) => css.replace(SEL_PSEUDO, (_, which) => ` > x-${which === 'before' ? 'b' : 'a'}`);
  const stripQuotes = (s) => s.replace(/^["']|["']$/g, '');
  // 影子偏移不跟画布变形走。把图形在设备坐标里挪到画布外，只让影子落回来，旋转、透视才对得上
  const farShadow = (g, s, draw) => {
    const m = g.getTransform();
    const far = 20000;
    g.shadowColor = s.color;
    g.shadowBlur = s.blur * Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
    g.shadowOffsetX = m.a * s.x + m.c * s.y + far;
    g.shadowOffsetY = m.b * s.x + m.d * s.y;
    g.fillStyle = '#000';
    g.setTransform(m.a, m.b, m.c, m.d, m.e - far, m.f);
    draw();
    g.setTransform(m);
  };

  // @property 写在影子树里 WebKit 不认，提到文档上。名字是全局的，注册一次就够
  const hoisted = new Set();
  const hoistProperties = (css) => {
    (css.match(/@property\s+--[\w-]+\s*\{[^}]*\}/g) || []).forEach((rule) => {
      const name = /--[\w-]+/.exec(rule)[0];
      if (hoisted.has(name)) return;
      hoisted.add(name);
      const style = document.createElement('style');
      style.textContent = rule;
      document.head.appendChild(style);
    });
  };

  // content: counter(n, decimal-leading-zero) "%"：数字逐帧从 counter-reset 读
  const counterOf = (value) => {
    const m = /counter\(\s*([\w-]+)\s*(?:,\s*([\w-]+)\s*)?\)/.exec(value || '');
    return m ? {name: m[1], pad: m[2] === 'decimal-leading-zero'} : null;
  };

  const contentOf = (value, el) => {
    if (!value || value === 'none' || value === 'normal') return null;
    let out = '';
    const re = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|attr\(([^)]+)\)/g;
    let m;
    while ((m = re.exec(value))) {
      if (m[3]) out += el.getAttribute(m[3].trim()) || '';
      else out += (m[1] !== undefined ? m[1] : m[2]).replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/\\(.)/g, '$1');
    }
    return out;
  };

  // @keyframes 里写 content 的：逐帧换字
  const contentFrames = (css) => {
    const out = {};
    const re = /@keyframes\s+([\w-]+)\s*\{/g;
    let m;
    while ((m = re.exec(css))) {
      let depth = 1;
      let i = re.lastIndex;
      while (i < css.length && depth) {
        if (css[i] === '{') depth++;
        if (css[i] === '}') depth--;
        i++;
      }
      const body = css.slice(re.lastIndex, i - 1);
      if (!/content\s*:/.test(body)) continue;
      const frames = [];
      const fr = /([\d.%,\s]+|from|to)\{([^}]*)\}/g;
      let f;
      while ((f = fr.exec(body))) {
        const c = /content\s*:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/.exec(f[2]);
        if (!c) continue;
        f[1].split(',').forEach((pct) => {
          const p = pct.trim() === 'from' ? 0 : pct.trim() === 'to' ? 1 : parseFloat(pct) / 100;
          if (Number.isFinite(p)) frames.push({p, text: contentOf(c[1], {getAttribute: () => ''})});
        });
      }
      frames.sort((a, b) => a.p - b.p);
      if (frames.length) out[m[1]] = frames;
    }
    return out;
  };

  const BASE_CSS = `
    :host{all:initial}
    .film-root{position:absolute;left:0;top:0;display:inline-block;white-space:nowrap}
    x-b,x-a,x-t{display:inline}
    .film-still,.film-still *,.film-still x-b,.film-still x-a{transition:none !important}
  `;

  class Film {
    constructor({css, html, vars = {}, font, width = 1400, height = 800, setup, stateAt = null}) {
      hoistProperties(css);
      this.host = document.createElement('div');
      this.host.setAttribute('aria-hidden', 'true');
      this.host.style.cssText = `position:fixed;left:-40000px;top:0;width:${width}px;height:${height}px;overflow:hidden;pointer-events:none`;
      document.documentElement.appendChild(this.host);
      this.shadow = this.host.attachShadow({mode: 'open'});
      const varCss = Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';');
      const fontCss = font ? `.film-root,.film-root *{font-family:${font} !important}` : '';
      this.shadow.innerHTML = `<style>${BASE_CSS}${css}${fontCss}</style><div class="film-root" style="${varCss}">${html}</div>`;
      this.root = this.shadow.querySelector('.film-root');
      if (setup) setup(this.root);
      // 先用原样式读出伪元素的 content，再换成真元素
      const adds = [];
      this.counterTracks = [];
      this.root.querySelectorAll('*').forEach((el) => {
        if (el.namespaceURI !== 'http://www.w3.org/1999/xhtml' || el.localName === 'input') return;
        [['::before', 'x-b'], ['::after', 'x-a']].forEach(([pseudo, tag]) => {
          const raw = getComputedStyle(el, pseudo).content;
          const text = contentOf(raw, el);
          if (text !== null) adds.push([el, tag, text, counterOf(raw)]);
        });
      });
      const rootBefore = contentOf(getComputedStyle(this.root, '::before').content, this.root);
      if (rootBefore !== null) adds.push([this.root, 'x-b', rootBefore]);
      adds.forEach(([el, tag, text, counter]) => {
        const node = document.createElement(tag);
        node.textContent = text;
        if (counter) this.counterTracks.push(Object.assign({node, tail: text}, counter));
        if (tag === 'x-b') el.insertBefore(node, el.firstChild);
        else el.appendChild(node);
      });
      this.shadow.querySelector('style').textContent = BASE_CSS + rewriteCss(css) + fontCss;
      // 文字节点包起来
      const wrap = (el) => {
        if (el.namespaceURI !== 'http://www.w3.org/1999/xhtml') return;
        [...el.childNodes].forEach((n) => {
          if (n.nodeType === 3) {
            if (!n.nodeValue.trim() && !/\S/.test(n.nodeValue) && n.nodeValue.length !== 1) return;
            if (!n.nodeValue.length) return;
            const t = document.createElement('x-t');
            t.textContent = n.nodeValue;
            el.replaceChild(t, n);
          } else if (n.nodeType === 1) wrap(n);
        });
      };
      wrap(this.root);
      this.animations = this.shadow.getAnimations();
      this.animations.forEach((a) => a.pause());
      const frames = contentFrames(css);
      this.contentTracks = [];
      this.animations.forEach((a) => {
        if (a.animationName && frames[a.animationName]) {
          const owner = a.effect.target;
          const text = owner && owner.querySelector && owner.querySelector(':scope > x-t');
          if (text) this.contentTracks.push({a, text, frames: frames[a.animationName]});
          else if (owner) {
            const t = document.createElement('x-t');
            owner.appendChild(t);
            this.contentTracks.push({a, text: t, frames: frames[a.animationName]});
          }
        }
      });
      // 悬停、选中这类状态：到 stateAt 这一秒切过去，过渡动画也归时间管
      this.stateAt = stateAt;
      this.stateOn = false;
      this.transitions = [];
      this.seek(0);
    }

    setState(on) {
      if (on === this.stateOn) return;
      this.stateOn = on;
      if (on) {
        // 先确定起点，再切过去，过渡才会产生
        void this.root.offsetWidth;
        this.root.querySelectorAll('[data-state]').forEach((el) => el.classList.add('is-on'));
        if (this.root.hasAttribute('data-state')) this.root.classList.add('is-on');
        this.shadow.querySelectorAll('input').forEach((el) => {
          el.checked = true;
        });
        void this.root.offsetWidth;
        const known = new Set(this.animations);
        this.transitions = this.shadow.getAnimations().filter((a) => !known.has(a));
        this.transitions.forEach((a) => a.pause());
      } else {
        this.transitions.forEach((a) => a.cancel());
        this.transitions = [];
        this.host.classList.add('still');
        this.root.classList.add('film-still');
        this.root.querySelectorAll('[data-state]').forEach((el) => el.classList.remove('is-on'));
        this.root.classList.remove('is-on');
        this.shadow.querySelectorAll('input').forEach((el) => {
          el.checked = false;
        });
        void this.root.offsetWidth;
        this.root.classList.remove('film-still');
        void this.root.offsetWidth;
      }
    }

    // 一个循环多长：最长的那个动画的 延迟 + 一轮
    get cycle() {
      let best = 0;
      this.animations.forEach((a) => {
        const t = a.effect.getComputedTiming();
        const finite = Number.isFinite(t.iterations);
        const len = finite ? t.activeDuration + t.delay : t.duration + Math.max(0, t.delay);
        if (len > best && Number.isFinite(len)) best = len;
      });
      return best / 1000;
    }

    seek(t) {
      const ms = t * 1000;
      this.animations.forEach((a) => {
        a.currentTime = ms;
      });
      if (this.stateAt !== null) {
        this.setState(t >= this.stateAt);
        const since = (t - this.stateAt) * 1000;
        this.transitions.forEach((a) => {
          a.currentTime = since;
        });
        // 子元素写了 transition: inherit 时，父元素的值一变，它又自己起一段实时过渡。
        // 那段不归时间管（WebKit 里字色会一直停在旧值），走到头让它跟着父元素
        if (this.stateOn) {
          const owned = new Set([...this.animations, ...this.transitions]);
          for (let pass = 0; pass < 3; pass++) {
            void this.root.offsetWidth;
            const extra = this.shadow.getAnimations().filter((a) => !owned.has(a) && a.transitionProperty);
            if (!extra.length) break;
            extra.forEach((a) => a.finish());
          }
        }
      }
      this.counterTracks.forEach((track) => {
        const m = new RegExp(`${track.name}\\s+(-?\\d+)`).exec(getComputedStyle(track.node).counterReset || '');
        const value = m ? m[1] : '0';
        const text = `${track.pad ? value.padStart(2, '0') : value}${track.tail}`;
        const label = track.node.querySelector(':scope > x-t');
        if (label && label.textContent !== text) label.textContent = text;
      });
      this.contentTracks.forEach((track) => {
        const timing = track.a.effect.getComputedTiming();
        const p = timing.progress === null ? 0 : timing.progress;
        let text = track.frames[0].text;
        track.frames.forEach((f) => {
          if (f.p <= p + 1e-6) text = f.text;
        });
        if (track.text.textContent !== text) track.text.textContent = text;
      });
    }

    size() {
      const r = this.root;
      return {w: r.offsetWidth, h: r.offsetHeight};
    }

    dispose() {
      this.host.remove();
    }

    // 把内容实际画到哪：含绝对定位子元素。用来算放大倍数
    bounds() {
      const base = this.root.getBoundingClientRect();
      let x0 = 0;
      let y0 = 0;
      let x1 = base.width;
      let y1 = base.height;
      this.root.querySelectorAll('*').forEach((el) => {
        if (el.namespaceURI !== 'http://www.w3.org/1999/xhtml') return;
        const b = this.layoutBox(el);
        if (b.w <= 0 && b.h <= 0) return;
        x0 = Math.min(x0, b.x);
        y0 = Math.min(y0, b.y);
        x1 = Math.max(x1, b.x + b.w);
        y1 = Math.max(y1, b.y + b.h);
      });
      return {x: x0, y: y0, w: x1 - x0, h: y1 - y0};
    }

    layoutBox(el) {
      let x = 0;
      let y = 0;
      let n = el;
      let guard = 0;
      while (n && n !== this.root && guard++ < 60) {
        x += n.offsetLeft;
        y += n.offsetTop;
        const p = n.offsetParent;
        if (!p || p === this.host) break;
        if (p !== this.root) {
          x += p.clientLeft;
          y += p.clientTop;
        }
        n = p;
      }
      return {x, y, w: el.offsetWidth, h: el.offsetHeight};
    }

    // ---------- 画一帧。ctx 已经放好变形：1 个 CSS 像素对应 k 个输出像素 ----------
    paint(ctx) {
      const tr = ctx.getTransform();
      this.px = Math.hypot(tr.a, tr.b) || 1;
      this.paintNode(ctx, this.root, tr, null, 1);
    }

    radiiOf(cs, w, h) {
      const one = (v) => {
        const [a, b] = v.split(/\s+/);
        const rx = /%$/.test(a) ? (num(a) / 100) * w : num(a);
        const second = b === undefined ? a : b;
        const ry = /%$/.test(second) ? (num(second) / 100) * h : num(second);
        return {x: rx, y: ry};
      };
      const r = [one(cs.borderTopLeftRadius), one(cs.borderTopRightRadius), one(cs.borderBottomRightRadius), one(cs.borderBottomLeftRadius)];
      const f = Math.min(1, w / (r[0].x + r[1].x || 1), w / (r[2].x + r[3].x || 1), h / (r[0].y + r[3].y || 1), h / (r[1].y + r[2].y || 1));
      if (f < 1) r.forEach((c) => {
        c.x *= f;
        c.y *= f;
      });
      return r;
    }

    clipPathOf(g, text, b) {
      if (!text || text === 'none') return;
      const m = /^(inset|polygon|circle|ellipse)\((.*)\)/s.exec(text);
      if (!m) return;
      const lenX = (v) => lengthOf(v, b.w);
      const lenY = (v) => lengthOf(v, b.h);
      g.beginPath();
      if (m[1] === 'inset') {
        const body = m[2].split(/\bround\b/);
        const p = splitTop(body[0], ' ');
        const top = lenY(p[0]);
        const right = lenX(p[1] === undefined ? p[0] : p[1]);
        const bottom = lenY(p[2] === undefined ? p[0] : p[2]);
        const left = lenX(p[3] === undefined ? (p[1] === undefined ? p[0] : p[1]) : p[3]);
        const w = b.w - left - right;
        const h = b.h - top - bottom;
        if (body[1]) {
          const r = num(body[1]);
          g.roundRect(b.x + left, b.y + top, Math.max(0, w), Math.max(0, h), r);
        } else g.rect(b.x + left, b.y + top, Math.max(0, w), Math.max(0, h));
      } else if (m[1] === 'polygon') {
        splitTop(m[2]).forEach((pt, i) => {
          const [x, y] = splitTop(pt, ' ');
          const px = b.x + lenX(x);
          const py = b.y + lenY(y);
          if (i) g.lineTo(px, py);
          else g.moveTo(px, py);
        });
        g.closePath();
      } else {
        const [size, at] = m[2].split(/\bat\b/).map((v) => (v || '').trim());
        const pos = at ? splitTop(at, ' ') : ['50%', '50%'];
        const cx = b.x + lenX(pos[0]);
        const cy = b.y + lenY(pos[1] || '50%');
        if (m[1] === 'circle') {
          const r = /%$/.test(size) ? (num(size) / 100) * Math.hypot(b.w, b.h) / Math.SQRT2 : num(size) || Math.hypot(b.w, b.h) / 2;
          g.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2);
        } else {
          const [rx, ry] = splitTop(size, ' ');
          g.ellipse(cx, cy, Math.max(0, lenX(rx || '50%')), Math.max(0, lenY(ry || rx || '50%')), 0, 0, Math.PI * 2);
        }
      }
      g.clip();
    }

    // 背景的一层：颜色或渐变，按 size、position、repeat 铺到盒子里
    paintBackgroundLayer(g, image, size, position, repeat, box) {
      const bw = box.w;
      const bh = box.h;
      if (bw <= 0 || bh <= 0) return;
      let tw = bw;
      let th = bh;
      const sizes = splitTop(size, ' ');
      if (sizes[0] && sizes[0] !== 'auto' && sizes[0] !== 'cover' && sizes[0] !== 'contain') {
        tw = lengthOf(sizes[0], bw);
      }
      if (sizes[1] && sizes[1] !== 'auto') {
        th = lengthOf(sizes[1], bh);
      }
      if (tw <= 0 || th <= 0) return;
      const pos = splitTop(position, ' ');
      const place = (v, room, keyword) => {
        if (v === undefined) return room / 2;
        if (v === keyword[0]) return 0;
        if (v === keyword[1]) return room;
        if (v === 'center') return room / 2;
        return lengthOf(v, room);
      };
      const ox = place(pos[0], bw - tw, ['left', 'right']);
      const oy = place(pos[1], bh - th, ['top', 'bottom']);
      const grad = makeGradient(g, image, tw, th);
      if (!grad) return;
      const rep = repeat.split(/\s+/);
      const rx = rep[0] !== 'no-repeat';
      const ry = (rep[1] || rep[0]) !== 'no-repeat' && rep[0] !== 'repeat-x' && !(rep[0] === 'no-repeat' && !rep[1]);
      const startX = rx ? ox - Math.ceil(ox / tw) * tw : ox;
      const startY = ry ? oy - Math.ceil(oy / th) * th : oy;
      const countX = rx ? Math.min(240, Math.ceil((bw - startX) / tw)) : 1;
      const countY = ry ? Math.min(240, Math.ceil((bh - startY) / th)) : 1;
      g.save();
      g.beginPath();
      g.rect(box.x, box.y, bw, bh);
      g.clip();
      for (let iy = 0; iy < countY; iy++) {
        for (let ix = 0; ix < countX; ix++) {
          const x = box.x + startX + ix * tw;
          const y = box.y + startY + iy * th;
          g.save();
          g.beginPath();
          g.rect(x, y, tw, th);
          g.clip();
          g.translate(x, y);
          if (grad.radial) {
            g.translate(grad.cx, grad.cy);
            g.scale(grad.sx, grad.sy);
            g.fillStyle = grad.grad;
            g.fillRect(-tw * 4, -th * 4 / grad.sy, tw * 8, (th * 8) / grad.sy);
          } else {
            g.fillStyle = grad;
            g.fillRect(0, 0, tw, th);
          }
          g.restore();
        }
      }
      g.restore();
    }

    paintBackground(g, cs, box, radii) {
      const hasColor = !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor);
      const images = cs.backgroundImage === 'none' ? [] : splitTop(cs.backgroundImage);
      if (!hasColor && !images.length) return;
      g.save();
      g.beginPath();
      roundedRect(g, box.x, box.y, box.w, box.h, radii);
      g.clip();
      if (hasColor) {
        g.fillStyle = rgbaOf(cs.backgroundColor);
        g.fillRect(box.x, box.y, box.w, box.h);
      }
      const sizes = splitTop(cs.backgroundSize);
      const posX = splitTop(cs.backgroundPositionX || '');
      const posY = splitTop(cs.backgroundPositionY || '');
      const repeats = splitTop(cs.backgroundRepeat);
      const blends = splitTop(cs.backgroundBlendMode || 'normal');
      for (let i = images.length - 1; i >= 0; i--) {
        const pos = `${posX[i % posX.length] || '0%'} ${posY[i % posY.length] || '0%'}`;
        const mode = blends[i % blends.length];
        g.globalCompositeOperation = mode && mode !== 'normal' ? mode : 'source-over';
        this.paintBackgroundLayer(g, images[i], sizes[i % sizes.length] || 'auto', pos, repeats[i % repeats.length] || 'repeat', box);
      }
      g.globalCompositeOperation = 'source-over';
      g.restore();
    }

    paintBorder(g, cs, box, radii) {
      const sides = [
        {w: num(cs.borderTopWidth), c: rgbaOf(cs.borderTopColor), s: cs.borderTopStyle},
        {w: num(cs.borderRightWidth), c: rgbaOf(cs.borderRightColor), s: cs.borderRightStyle},
        {w: num(cs.borderBottomWidth), c: rgbaOf(cs.borderBottomColor), s: cs.borderBottomStyle},
        {w: num(cs.borderLeftWidth), c: rgbaOf(cs.borderLeftColor), s: cs.borderLeftStyle},
      ];
      if (sides.every((s) => s.w === 0 || s.s === 'none' || s.s === 'hidden')) return;
      const [t, r, b, l] = sides.map((s) => (s.s === 'none' || s.s === 'hidden' ? 0 : s.w));
      const {x, y, w, h} = box;
      // border-image 是渐变：把渐变铺满盒子，只露出边框那一圈（border-image 不跟圆角走）
      const borderImage = cs.borderImageSource || 'none';
      if (/gradient\(/.test(borderImage)) {
        g.save();
        g.beginPath();
        g.rect(x, y, w, h);
        g.rect(x + l, y + t, w - l - r, h - t - b);
        g.clip('evenodd');
        this.paintBackgroundLayer(g, borderImage, 'auto', '0% 0%', 'no-repeat', box);
        g.restore();
        return;
      }
      const inner = radii.map((c, i) => ({
        x: Math.max(0, c.x - (i === 0 || i === 3 ? l : r)),
        y: Math.max(0, c.y - (i === 0 || i === 1 ? t : b)),
      }));
      const ring = () => {
        g.beginPath();
        roundedRect(g, x, y, w, h, radii);
        roundedRect(g, x + l, y + t, Math.max(0, w - l - r), Math.max(0, h - t - b), inner);
      };
      const same = sides.every((s) => s.c === sides[0].c && s.s === sides[0].s);
      const dashed = sides.some((s) => s.s === 'dashed' || s.s === 'dotted');
      if (dashed && t === r && r === b && b === l) {
        g.save();
        g.strokeStyle = sides[0].c;
        g.lineWidth = t;
        g.setLineDash(sides[0].s === 'dotted' ? [t, t] : [t * 2, t * 1.4]);
        g.lineCap = sides[0].s === 'dotted' ? 'round' : 'butt';
        g.beginPath();
        roundedRect(g, x + t / 2, y + t / 2, w - t, h - t, radii.map((c) => ({x: Math.max(0, c.x - t / 2), y: Math.max(0, c.y - t / 2)})));
        g.stroke();
        g.restore();
        return;
      }
      if (same) {
        ring();
        g.fillStyle = sides[0].c;
        g.fill('evenodd');
        return;
      }
      // 每条边一个楔形，转角处斜接，和浏览器一样（转圈的加载动画靠这个）
      const wedges = [
        [[x, y], [x + w, y], [x + w - r, y + t], [x + l, y + t]],
        [[x + w, y], [x + w, y + h], [x + w - r, y + h - b], [x + w - r, y + t]],
        [[x + w, y + h], [x, y + h], [x + l, y + h - b], [x + w - r, y + h - b]],
        [[x, y + h], [x, y], [x + l, y + t], [x + l, y + h - b]],
      ];
      // 圆角大时楔形要一直伸到中心
      const cx = x + l + (w - l - r) / 2;
      const cy = y + t + (h - t - b) / 2;
      sides.forEach((side, i) => {
        if (!side.w || side.s === 'none' || side.s === 'hidden') return;
        g.save();
        g.beginPath();
        const q = wedges[i];
        g.moveTo(q[0][0], q[0][1]);
        g.lineTo(q[1][0], q[1][1]);
        g.lineTo(cx, cy);
        g.closePath();
        g.clip();
        ring();
        g.fillStyle = side.c;
        g.fill('evenodd');
        g.restore();
      });
    }

    paintOutline(g, cs, box, radii) {
      const w = num(cs.outlineWidth);
      if (!w || cs.outlineStyle === 'none') return;
      const off = num(cs.outlineOffset) + w / 2;
      g.save();
      g.strokeStyle = rgbaOf(cs.outlineColor);
      g.lineWidth = w;
      if (cs.outlineStyle === 'dashed') g.setLineDash([w * 3, w * 2]);
      if (cs.outlineStyle === 'dotted') g.setLineDash([w, w]);
      g.beginPath();
      roundedRect(g, box.x - off, box.y - off, box.w + off * 2, box.h + off * 2, radii.map((c) => ({x: c.x ? c.x + off : 0, y: c.y ? c.y + off : 0})));
      g.stroke();
      g.restore();
    }

    paintBoxShadow(g, cs, box, radii, inset) {
      const list = parseShadows(cs.boxShadow).filter((s) => s.inset === inset);
      for (let i = list.length - 1; i >= 0; i--) {
        const s = list[i];
        g.save();
        if (inset) {
          g.beginPath();
          roundedRect(g, box.x, box.y, box.w, box.h, radii);
          g.clip();
          const sp = s.spread;
          farShadow(g, s, () => {
            g.beginPath();
            g.rect(box.x - 4000, box.y - 4000, box.w + 8000, box.h + 8000);
            roundedRect(g, box.x + sp, box.y + sp, box.w - sp * 2, box.h - sp * 2, radii.map((c) => ({x: Math.max(0, c.x - sp), y: Math.max(0, c.y - sp)})));
            g.fill('evenodd');
          });
        } else {
          // 影子只画在盒子外面
          g.beginPath();
          g.rect(box.x - 6000, box.y - 6000, box.w + 12000, box.h + 12000);
          roundedRect(g, box.x, box.y, box.w, box.h, radii);
          g.clip('evenodd');
          const sp = s.spread;
          farShadow(g, s, () => {
            g.beginPath();
            roundedRect(g, box.x - sp, box.y - sp, box.w + sp * 2, box.h + sp * 2, radii.map((c) => ({x: c.x ? c.x + sp : 0, y: c.y ? c.y + sp : 0})));
            g.fill();
          });
        }
        g.restore();
      }
    }

    fontOf(cs) {
      return `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    }

    drawRun(g, text, x, y, spacing, how) {
      if (!spacing) {
        g[how](text, x, y);
        return;
      }
      let cx = x;
      for (const ch of text) {
        g[how](ch, cx, y);
        cx += g.measureText(ch).width + spacing;
      }
    }

    // 文字位置：x-t 的版面框，基线按字体度量算
    textPlace(g, node, cs) {
      const b = this.layoutBox(node);
      g.font = this.fontOf(cs);
      const m = g.measureText('国');
      const asc = m.fontBoundingBoxAscent || num(cs.fontSize) * 0.88;
      const desc = m.fontBoundingBoxDescent || num(cs.fontSize) * 0.12;
      const y = b.y + (b.h - (asc + desc)) / 2 + asc;
      return {x: b.x, y, w: b.w};
    }

    paintText(g, node, cs, clipOnly, skipFill) {
      const text = node.textContent;
      if (!text) return;
      const {x, y} = this.textPlace(g, node, cs);
      g.textAlign = 'left';
      g.textBaseline = 'alphabetic';
      const spacing = cs.letterSpacing === 'normal' ? 0 : num(cs.letterSpacing);
      if (clipOnly) {
        g.fillStyle = '#000';
        this.drawRun(g, text, x, y, spacing, 'fillText');
        return;
      }
      const cur = g.getTransform();
      const k = Math.hypot(cur.a, cur.b) || this.px;
      const fill = rgbaOf(cs.webkitTextFillColor || cs.color);
      const shadows = parseShadows(cs.textShadow);
      for (let i = shadows.length - 1; i >= 0; i--) {
        const s = shadows[i];
        g.save();
        farShadow(g, s, () => this.drawRun(g, text, x, y, spacing, 'fillText'));
        g.restore();
      }
      const strokeW = num(cs.webkitTextStrokeWidth);
      const paintFill = () => {
        if (!skipFill && !/rgba\(0, ?0, ?0, ?0\)|transparent/.test(fill)) {
          g.fillStyle = fill;
          this.drawRun(g, text, x, y, spacing, 'fillText');
        }
      };
      const paintStroke = () => {
        if (strokeW > 0) {
          g.save();
          g.lineWidth = strokeW;
          g.lineJoin = 'round';
          g.strokeStyle = rgbaOf(cs.webkitTextStrokeColor || cs.color);
          this.drawRun(g, text, x, y, spacing, 'strokeText');
          g.restore();
        }
      };
      if (/^stroke/.test(cs.paintOrder || '')) {
        paintStroke();
        paintFill();
      } else {
        paintFill();
        paintStroke();
      }
    }

    // 把一棵子树里的字画成遮罩（background-clip:text）
    paintTextMask(g, el) {
      el.childNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        const cs = getComputedStyle(n);
        if (n.localName === 'x-t') this.paintText(g, n, getComputedStyle(el), true);
        else if (cs.display !== 'none') this.withTransform(g, n, cs, () => this.paintTextMask(g, n));
      });
    }

    withTransform(g, el, cs, fn) {
      const m = cs.transform;
      if (!m || m === 'none') {
        fn();
        return;
      }
      const v = /matrix\(([^)]+)\)/.exec(m);
      if (!v) {
        fn();
        return;
      }
      const a = v[1].split(',').map(Number);
      const b = this.layoutBox(el);
      const o = splitTop(cs.transformOrigin, ' ');
      const ox = b.x + num(o[0]);
      const oy = b.y + num(o[1]);
      g.save();
      g.translate(ox, oy);
      g.transform(a[0], a[1], a[2], a[3], a[4], a[5]);
      g.translate(-ox, -oy);
      fn();
      g.restore();
    }

    // svg 没有 offset 系列。它的父元素可以量，svg 自己按父元素内容区的位置算
    svgBox(svg) {
      const parent = svg.parentElement;
      const pb = parent === this.root ? {x: 0, y: 0} : this.layoutBox(parent);
      const w = svg.clientWidth || svg.getBoundingClientRect().width;
      const h = svg.clientHeight || svg.getBoundingClientRect().height;
      const cs = getComputedStyle(svg);
      if (cs.position === 'absolute') {
        return {x: pb.x + num(cs.left), y: pb.y + num(cs.top), w, h};
      }
      return {x: pb.x + num(cs.marginLeft), y: pb.y + num(cs.marginTop), w, h};
    }

    paintSvg(g, svg, box) {
      const walk = (n) => {
        [...n.children].forEach((el) => {
          const cs = getComputedStyle(el);
          if (cs.display === 'none') return;
          const ctm = el.getCTM && el.getCTM();
          g.save();
          if (ctm) g.transform(ctm.a, ctm.b, ctm.c, ctm.d, ctm.e, ctm.f);
          g.globalAlpha *= num(cs.opacity, 1) * num(cs.fillOpacity, 1);
          const dash = cs.strokeDasharray && cs.strokeDasharray !== 'none' ? cs.strokeDasharray.split(/[\s,]+/).map(num) : null;
          const stroke = () => {
            if (cs.stroke === 'none' || !num(cs.strokeWidth)) return;
            g.strokeStyle = cs.stroke;
            g.lineWidth = num(cs.strokeWidth);
            g.lineCap = cs.strokeLinecap;
            g.lineJoin = cs.strokeLinejoin;
            if (dash) {
              // 总长写成 pathLength 时要换算
              const len = el.getTotalLength ? el.getTotalLength() : 0;
              const pl = el.getAttribute('pathLength');
              const f = pl && len ? len / num(pl) : 1;
              g.setLineDash(dash.map((d) => d * f));
              g.lineDashOffset = num(cs.strokeDashoffset) * f;
            }
          };
          if (el.localName === 'text') {
            g.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
            g.textAlign = cs.textAnchor === 'middle' ? 'center' : cs.textAnchor === 'end' ? 'right' : 'left';
            g.textBaseline = /central|middle/.test(cs.dominantBaseline) ? 'middle' : 'alphabetic';
            const bb = el.getBBox();
            const x = g.textAlign === 'center' ? bb.x + bb.width / 2 : g.textAlign === 'right' ? bb.x + bb.width : bb.x;
            const y = g.textBaseline === 'middle' ? bb.y + bb.height / 2 : bb.y + bb.height * 0.8;
            if (cs.fill !== 'none') {
              g.fillStyle = cs.fill;
              g.fillText(el.textContent, x, y);
            }
            stroke();
            if (cs.stroke !== 'none') g.strokeText(el.textContent, x, y);
          } else if (el.localName === 'g') {
            walk(el);
          } else {
            let p = null;
            if (el.localName === 'path') p = new Path2D(el.getAttribute('d'));
            else if (el.localName === 'circle') {
              p = new Path2D();
              p.arc(num(cs.cx), num(cs.cy), num(cs.r), 0, Math.PI * 2);
            } else if (el.localName === 'rect') {
              p = new Path2D();
              p.rect(num(cs.x), num(cs.y), num(cs.width), num(cs.height));
            } else if (el.localName === 'line') {
              p = new Path2D();
              p.moveTo(num(el.getAttribute('x1')), num(el.getAttribute('y1')));
              p.lineTo(num(el.getAttribute('x2')), num(el.getAttribute('y2')));
            } else if (el.localName === 'polyline' || el.localName === 'polygon') {
              p = new Path2D();
              const pts = (el.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number);
              for (let i = 0; i + 1 < pts.length; i += 2) {
                if (i) p.lineTo(pts[i], pts[i + 1]);
                else p.moveTo(pts[i], pts[i + 1]);
              }
              if (el.localName === 'polygon') p.closePath();
            } else if (el.localName === 'ellipse') {
              p = new Path2D();
              p.ellipse(num(cs.cx), num(cs.cy), num(cs.rx), num(cs.ry), 0, 0, Math.PI * 2);
            }
            if (p) {
              if (cs.fill !== 'none') {
                g.fillStyle = cs.fill;
                g.fill(p);
              }
              stroke();
              if (cs.stroke !== 'none') g.stroke(p);
            }
          }
          g.restore();
        });
      };
      g.save();
      g.translate(box.x, box.y);
      // getCTM 含 svg 自己的 viewBox，不含外面的 CSS 变形
      walk(svg);
      g.restore();
    }

    applyFilters(slot, filters, mainG, tr) {
      let canvas = slot.canvas;
      const w = canvas.width;
      const h = canvas.height;
      const extra = [];
      const matrices = [];
      filters.forEach(([name, arg]) => {
        if (name === 'blur') {
          const soft = blurLayer(canvas, num(arg) * this.px, pool);
          if (soft) {
            canvas = soft.canvas;
            extra.push(soft);
          }
        } else if (name === 'drop-shadow') {
          const words = splitTop(arg, ' ');
          const color = words.find((v) => !/^-?[\d.]/.test(v)) || 'rgba(0,0,0,.5)';
          const lens = words.filter((v) => /^-?[\d.]/.test(v)).map(num);
          const tint = pool.take(w, h);
          tint.g.setTransform(1, 0, 0, 1, 0, 0);
          tint.g.globalCompositeOperation = 'source-over';
          tint.g.clearRect(0, 0, w, h);
          tint.g.drawImage(canvas, 0, 0);
          tint.g.globalCompositeOperation = 'source-in';
          tint.g.fillStyle = color;
          tint.g.fillRect(0, 0, w, h);
          tint.g.globalCompositeOperation = 'source-over';
          const soft = blurLayer(tint.canvas, (lens[2] || 0) * this.px, pool);
          const out = pool.take(w, h);
          out.g.setTransform(1, 0, 0, 1, 0, 0);
          out.g.clearRect(0, 0, w, h);
          out.g.drawImage(soft ? soft.canvas : tint.canvas, (lens[0] || 0) * this.px, (lens[1] || 0) * this.px);
          out.g.drawImage(canvas, 0, 0);
          if (soft) pool.give(soft);
          pool.give(tint);
          canvas = out.canvas;
          extra.push(out);
        } else if (name === 'hue-rotate') matrices.push(FILTER_MATRIX.hue(angleOf(arg)));
        else if (name === 'saturate') matrices.push(FILTER_MATRIX.saturate(/%$/.test(arg) ? num(arg) / 100 : num(arg, 1)));
        else if (name === 'brightness') matrices.push(FILTER_MATRIX.brightness(/%$/.test(arg) ? num(arg) / 100 : num(arg, 1)));
        else if (name === 'contrast') matrices.push(FILTER_MATRIX.contrast(/%$/.test(arg) ? num(arg) / 100 : num(arg, 1)));
        else if (name === 'grayscale') matrices.push(FILTER_MATRIX.saturate(1 - (/%$/.test(arg) ? num(arg) / 100 : num(arg, 1))));
        else if (name === 'invert') matrices.push(FILTER_MATRIX.invert(/%$/.test(arg) ? num(arg) / 100 : num(arg, 1)));
        else if (name === 'sepia') matrices.push(FILTER_MATRIX.sepia(/%$/.test(arg) ? num(arg) / 100 : num(arg, 1)));
      });
      if (matrices.length) {
        const out = pool.take(w, h);
        out.g.setTransform(1, 0, 0, 1, 0, 0);
        out.g.clearRect(0, 0, w, h);
        out.g.drawImage(canvas, 0, 0);
        const img = out.g.getImageData(0, 0, w, h);
        matrices.forEach((m) => colorMatrix(img.data, m));
        out.g.putImageData(img, 0, 0);
        canvas = out.canvas;
        extra.push(out);
      }
      return {canvas, extra};
    }

    paintMask(slot, cs, box, tr) {
      const image = cs.webkitMaskImage || cs.maskImage;
      if (!image || image === 'none') return;
      const g = slot.g;
      const images = splitTop(image).filter((v) => /gradient\(/.test(v));
      if (!images.length) return;
      const sizes = splitTop(cs.webkitMaskSize || cs.maskSize || 'auto');
      const positions = splitTop(cs.webkitMaskPosition || cs.maskPosition || '0% 0%');
      const repeats = splitTop(cs.webkitMaskRepeat || cs.maskRepeat || 'repeat');
      const clips = splitTop(cs.webkitMaskClip || cs.maskClip || 'border-box');
      const composite = String(cs.webkitMaskComposite || cs.maskComposite || 'add');
      const boxFor = (i) => {
        const clip = clips[i % clips.length];
        if (clip !== 'content-box' && clip !== 'padding-box') return box;
        const bw = [num(cs.borderTopWidth), num(cs.borderRightWidth), num(cs.borderBottomWidth), num(cs.borderLeftWidth)];
        const pad = clip === 'content-box' ? [num(cs.paddingTop), num(cs.paddingRight), num(cs.paddingBottom), num(cs.paddingLeft)] : [0, 0, 0, 0];
        return {x: box.x + bw[3] + pad[3], y: box.y + bw[0] + pad[0], w: box.w - bw[1] - bw[3] - pad[1] - pad[3], h: box.h - bw[0] - bw[2] - pad[0] - pad[2]};
      };
      // 多层遮罩先合成一张
      const m = pool.take(slot.canvas.width, slot.canvas.height);
      m.g.setTransform(1, 0, 0, 1, 0, 0);
      m.g.globalCompositeOperation = 'source-over';
      m.g.clearRect(0, 0, m.canvas.width, m.canvas.height);
      m.g.setTransform(tr);
      for (let i = images.length - 1; i >= 0; i--) {
        const layer = i < images.length - 1 && /exclude|xor/.test(composite) ? 'xor' : i < images.length - 1 && /intersect|source-in/.test(composite) ? 'source-in' : 'source-over';
        m.g.globalCompositeOperation = layer;
        const pos = positions[i % positions.length] || '0% 0%';
        this.paintBackgroundLayer(m.g, images[i], sizes[i % sizes.length] || 'auto', pos, repeats[i % repeats.length] || 'repeat', boxFor(i));
      }
      m.g.globalCompositeOperation = 'source-over';
      m.g.setTransform(1, 0, 0, 1, 0, 0);
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(m.canvas, 0, 0);
      g.restore();
      pool.give(m);
    }

    // -webkit-box-reflect：把层翻下来，再按渐变淡掉
    paintReflection(slot, text, box, tr) {
      const m = /^(below|above|left|right)\s+(?:(-?[\d.]+)px\s*)?(.*)$/s.exec(text);
      if (!m || m[1] !== 'below') return;
      const gap = num(m[2]);
      const copy = pool.take(slot.canvas.width, slot.canvas.height);
      copy.g.setTransform(1, 0, 0, 1, 0, 0);
      copy.g.globalCompositeOperation = 'source-over';
      copy.g.clearRect(0, 0, copy.canvas.width, copy.canvas.height);
      copy.g.setTransform(tr);
      copy.g.setTransform(tr);
      copy.g.translate(0, box.y + box.h + gap / 2);
      copy.g.scale(1, -1);
      copy.g.translate(0, -(box.y + box.h + gap / 2));
      const inv = copy.g.getTransform().multiply(tr.inverse());
      copy.g.setTransform(inv);
      copy.g.drawImage(slot.canvas, 0, 0);
      copy.g.setTransform(tr);
      const grad = /gradient\(/.test(m[3]) ? m[3].trim() : null;
      if (grad) {
        copy.g.globalCompositeOperation = 'destination-in';
        copy.g.translate(box.x, box.y + box.h + gap);
        const fill = makeGradient(copy.g, grad, box.w, box.h);
        if (fill && !fill.radial) {
          // 渐变的方向是从盒子底往下翻的，所以上下颠倒
          copy.g.translate(0, box.h);
          copy.g.scale(1, -1);
          copy.g.fillStyle = fill;
          copy.g.fillRect(0, 0, box.w, box.h);
        }
      }
      copy.g.globalCompositeOperation = 'source-over';
      copy.g.setTransform(1, 0, 0, 1, 0, 0);
      slot.g.save();
      slot.g.setTransform(1, 0, 0, 1, 0, 0);
      slot.g.globalAlpha = 1;
      slot.g.drawImage(copy.canvas, 0, 0);
      slot.g.restore();
      pool.give(copy);
    }

    paintNode(g, el, tr, m3, inheritedAlpha) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') {
        // 子元素可能单独 visible，少见，不管
        return;
      }
      const opacity = num(cs.opacity, 1);
      if (opacity <= 0.001) return;
      const isSvg = el.localName === 'svg';
      const b = el === this.root ? {x: 0, y: 0, w: el.offsetWidth, h: el.offsetHeight} : isSvg ? this.svgBox(el) : this.layoutBox(el);
      // 算这个元素的变形
      let mine = tr;
      const origin = splitTop(cs.transformOrigin, ' ');
      const ox = b.x + num(origin[0]);
      const oy = b.y + num(origin[1]);
      const oz = num(origin[2]);
      let list = [];
      if (cs.translate && cs.translate !== 'none') {
        const t = splitTop(cs.translate, ' ');
        const tx = /%$/.test(t[0]) ? (num(t[0]) / 100) * b.w : num(t[0]);
        const ty = t[1] === undefined ? 0 : /%$/.test(t[1]) ? (num(t[1]) / 100) * b.h : num(t[1]);
        list.push(translate3(tx, ty, num(t[2])));
      }
      if (cs.rotate && cs.rotate !== 'none') {
        const a = angleOf(cs.rotate.split(' ').pop());
        list.push([Math.cos(a), Math.sin(a), 0, 0, -Math.sin(a), Math.cos(a), 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      }
      if (cs.scale && cs.scale !== 'none') {
        const s = cs.scale.split(' ').map(Number);
        list.push([s[0], 0, 0, 0, 0, s[1] === undefined ? s[0] : s[1], 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      }
      if (cs.offsetPath && cs.offsetPath !== 'none') {
        const pm = /path\("([^"]+)"\)/.exec(cs.offsetPath);
        if (pm) {
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', pm[1]);
          const total = path.getTotalLength();
          const dist = lengthOf(cs.offsetDistance, total);
          const p = path.getPointAtLength(dist);
          const q = path.getPointAtLength(Math.min(total, dist + 0.5));
          const parent = el.parentElement === this.root || !el.parentElement ? {x: 0, y: 0} : this.layoutBox(el.parentElement);
          const rot = /auto/.test(cs.offsetRotate) ? Math.atan2(q.y - p.y, q.x - p.x) : 0;
          list.push(translate3(parent.x + p.x - ox, parent.y + p.y - oy));
          list.push([Math.cos(rot), Math.sin(rot), 0, 0, -Math.sin(rot), Math.cos(rot), 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        }
      }
      const matrix = parseMatrix(cs.transform);
      if (matrix) list.push(matrix);
      // 父元素的 perspective
      const parentCs = el.parentElement ? getComputedStyle(el.parentElement) : null;
      const persp = parentCs && parentCs.perspective !== 'none' ? num(parentCs.perspective) : 0;
      const in3d = !!m3 || persp > 0 || (matrix && matrix.length === 16 && (Math.abs(matrix[2]) > 1e-6 || Math.abs(matrix[6]) > 1e-6 || Math.abs(matrix[8]) > 1e-6 || Math.abs(matrix[9]) > 1e-6 || Math.abs(matrix[14]) > 1e-6));
      let m3Here = null;
      if (in3d) {
        let base = m3 || ID;
        if (persp > 0) {
          const po = parentCs.perspectiveOrigin ? splitTop(parentCs.perspectiveOrigin, ' ') : [0, 0];
          const pb = this.layoutBox(el.parentElement);
          const px = pb.x + num(po[0]);
          const py = pb.y + num(po[1]);
          base = mul(mul(mul(base, translate3(px, py)), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -1 / persp, 0, 0, 0, 1]), translate3(-px, -py));
        }
        let cur = mul(base, translate3(ox, oy, oz));
        list.forEach((t) => {
          cur = mul(cur, t);
        });
        cur = mul(cur, translate3(-ox, -oy, -oz));
        m3Here = cur;
        // 背面不画
        const p0 = project(cur, b.x, b.y);
        const p1 = project(cur, b.x + Math.max(b.w, 1), b.y);
        const p2 = project(cur, b.x, b.y + Math.max(b.h, 1));
        const cross = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]);
        if (cross < 0 && cs.backfaceVisibility === 'hidden') return;
        // 用三个角拟合一个仿射。透视的梯形近似成平行四边形，小角度看不出来
        const w = Math.max(b.w, 1);
        const h = Math.max(b.h, 1);
        const a = (p1[0] - p0[0]) / w;
        const bb = (p1[1] - p0[1]) / w;
        const c = (p2[0] - p0[0]) / h;
        const d = (p2[1] - p0[1]) / h;
        const e = p0[0] - a * b.x - c * b.y;
        const f = p0[1] - bb * b.x - d * b.y;
        mine = tr.multiply(new DOMMatrix([a, bb, c, d, e, f]));
      } else if (list.length) {
        let t2 = new DOMMatrix();
        t2 = t2.translate(ox, oy);
        list.forEach((t) => {
          t2 = t2.multiply(new DOMMatrix([t[0], t[1], t[4], t[5], t[12], t[13]]));
        });
        t2 = t2.translate(-ox, -oy);
        mine = tr.multiply(t2);
      }
      const keep3 = in3d && (cs.transformStyle === 'preserve-3d') ? m3Here : null;
      if (isSvg) {
        g.save();
        g.setTransform(mine);
        g.globalAlpha *= opacity;
        this.paintSvg(g, el, b);
        g.restore();
        return;
      }

      const filters = parseFilter(cs.filter).filter(([n]) => n !== 'url');
      const maskImage = cs.webkitMaskImage || cs.maskImage;
      const hasMask = maskImage && maskImage !== 'none' && /gradient\(/.test(maskImage);
      const blend = cs.mixBlendMode && cs.mixBlendMode !== 'normal' ? cs.mixBlendMode : null;
      const clipText = /\btext\b/.test(cs.webkitBackgroundClip || cs.backgroundClip || '');
      const realKids = [...el.children].filter((c) => c.localName !== 'x-t');
      const groupAlpha = opacity < 1 && realKids.length > 0;
      const reflect = cs.webkitBoxReflect && cs.webkitBoxReflect !== 'none' ? cs.webkitBoxReflect : null;
      const useLayer = filters.length > 0 || hasMask || blend || groupAlpha || clipText || !!reflect;

      let out = g;
      let slot = null;
      if (useLayer) {
        slot = pool.take(g.canvas.width, g.canvas.height);
        slot.g.setTransform(1, 0, 0, 1, 0, 0);
        slot.g.globalAlpha = 1;
        slot.g.globalCompositeOperation = 'source-over';
        slot.g.clearRect(0, 0, slot.canvas.width, slot.canvas.height);
        out = slot.g;
      }
      out.save();
      out.setTransform(mine);
      if (!useLayer) out.globalAlpha *= opacity;
      if (cs.clipPath && cs.clipPath !== 'none') this.clipPathOf(out, cs.clipPath, b);

      const radii = this.radiiOf(cs, b.w, b.h);
      const box = {x: b.x, y: b.y, w: b.w, h: b.h};

      // 负 z-index 的子元素在最后面
      const kids = [...el.children].map((c, i) => ({c, i, z: c.localName === 'x-t' ? 0 : (getComputedStyle(c).zIndex === 'auto' ? 0 : +getComputedStyle(c).zIndex)}));
      const behind = kids.filter((k) => k.z < 0).sort((a, c) => a.z - c.z || a.i - c.i);
      const rest = kids.filter((k) => k.z >= 0).sort((a, c) => a.z - c.z || a.i - c.i);
      if (keep3) {
        // 3D 里的子元素按前后排
        rest.sort((a, c) => {
          const za = a.c.localName === 'x-t' ? 0 : this.depthOf(a.c, keep3);
          const zc = c.c.localName === 'x-t' ? 0 : this.depthOf(c.c, keep3);
          return za - zc;
        });
      }
      const stacking = el === this.root || opacity < 1 || (cs.transform && cs.transform !== 'none') || (cs.position !== 'static' && cs.zIndex !== 'auto') || cs.isolation === 'isolate' || !!blend || filters.length > 0 || hasMask || (cs.clipPath && cs.clipPath !== 'none');
      if (!stacking && !clipText) behind.forEach((k) => this.paintChild(out, k.c, cs, el, mine, keep3));

      this.paintBoxShadow(out, cs, box, radii, false);
      if (clipText) {
        // 文字镂空背景：背景画到层上，再用字扣出来
        this.paintBackground(out, cs, box, radii);
        out.save();
        out.globalCompositeOperation = 'destination-in';
        const maskLayer = pool.take(out.canvas.width, out.canvas.height);
        maskLayer.g.setTransform(1, 0, 0, 1, 0, 0);
        maskLayer.g.clearRect(0, 0, maskLayer.canvas.width, maskLayer.canvas.height);
        maskLayer.g.setTransform(mine);
        this.paintTextMask(maskLayer.g, el);
        out.setTransform(1, 0, 0, 1, 0, 0);
        out.drawImage(maskLayer.canvas, 0, 0);
        out.restore();
        pool.give(maskLayer);
      } else {
        this.paintBackground(out, cs, box, radii);
      }
      this.paintBoxShadow(out, cs, box, radii, true);
      this.paintBorder(out, cs, box, radii);
      if (stacking || clipText) behind.forEach((k) => this.paintChild(out, k.c, cs, el, mine, keep3));

      const clipKids = cs.overflow !== 'visible' && cs.overflowX !== 'visible';
      if (clipKids) {
        const inset = {x: b.x + num(cs.borderLeftWidth), y: b.y + num(cs.borderTopWidth), w: el.clientWidth, h: el.clientHeight};
        out.save();
        out.beginPath();
        roundedRect(out, inset.x, inset.y, inset.w, inset.h, radii.map((c) => ({x: Math.max(0, c.x - num(cs.borderLeftWidth)), y: Math.max(0, c.y - num(cs.borderTopWidth))})));
        out.clip();
      }
      rest.forEach((k) => {
        if (k.c.localName === 'x-t') {
          this.paintText(out, k.c, cs, false, clipText);
        } else this.paintChild(out, k.c, cs, el, mine, keep3);
      });
      if (clipKids) out.restore();
      this.paintOutline(out, cs, box, radii);
      out.restore();

      if (useLayer) {
        if (hasMask) this.paintMask(slot, cs, box, mine);
        if (reflect) this.paintReflection(slot, reflect, box, mine);
        const done = filters.length ? this.applyFilters(slot, filters, g, mine) : {canvas: slot.canvas, extra: []};
        g.save();
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalAlpha *= opacity;
        if (blend) g.globalCompositeOperation = blend;
        g.drawImage(done.canvas, 0, 0);
        g.restore();
        done.extra.forEach((s) => pool.give(s));
        pool.give(slot);
      }
    }

    depthOf(el, m) {
      const cs = getComputedStyle(el);
      const t = parseMatrix(cs.transform);
      if (!t) return 0;
      const full = mul(m, t);
      return full[14];
    }

    paintChild(g, el, parentCs, parent, tr, m3) {
      if (el.localName === 'x-t') {
        g.save();
        this.paintText(g, el, parentCs, false);
        g.restore();
        return;
      }
      if (el.namespaceURI !== 'http://www.w3.org/1999/xhtml' && el.localName !== 'svg') return;
      if (el.localName === 'input' && getComputedStyle(el).appearance !== 'none') return;
      this.paintNode(g, el, tr, m3, 1);
    }
  }

  D.CssFilm = Film;
})(window);
