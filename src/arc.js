// uiarc 的组件，按视频画面重写。效果参考 arc-library（Elia Kuratli，MIT），代码自己写：
// 原作是网页里的 React 组件，靠鼠标和弹簧动画；视频里没有鼠标，每个都排成一段自动演示。
// 字和数字只从这一镜的文稿来，样例只给缩略图用。
(function (root) {
  'use strict';
  const D = root.DM;
  if (!D.widgets) return;
  const {clamp, lerp, seg, out, io, spring, rnd, rr, dot, ln, arc, tx, widthOf, fit, alpha, at, check, cursor, clip, head, wordsOf, numbersOf, stripNumber, CX, CY} = D.widgets.tools;
  const SRC = '自写，效果参考 uiarc（arc-library，MIT）';
  const A = (o, draw) => D.widgets.add(Object.assign({source: SRC}, o, {key: o.key.replace(/-/g, '_')}), draw);

  // arc 的动效参数：落地不过冲，错开一点点
  const land = (u) => out(clamp(u));
  const soft = (u) => spring(clamp(u), 1.6, 7);
  const font = (c, size, weight = 600) => {
    c.font = `${weight} ${size}px ${D.FONT_CN}`;
  };
  const numSize = (size) => size * 0.92;
  const num = (c, s, x, y, size, color, align = 'center') => {
    c.font = `${numSize(size)}px ${D.FONT_NUM}`;
    c.textAlign = align;
    c.textBaseline = 'middle';
    c.fillStyle = color;
    c.fillText(String(s), x, y);
  };
  const numWidth = (c, s, size) => {
    c.font = `${numSize(size)}px ${D.FONT_NUM}`;
    return c.measureText(String(s)).width;
  };
  const tone = (p, i) => [p.a, p.b, p.ok, '#B98CFF', '#F2C14E', '#E86A92'][i % 6];
  const fmt = (v) => (Math.abs(v) >= 100 || Number.isInteger(v) ? String(Math.round(v)) : String(Math.round(v * 10) / 10));

  // 一句话按词换行，放得下的最大字号
  const wrapAt = (c, text, size, maxW, weight) => {
    font(c, size, weight);
    const lines = [[]];
    let used = 0;
    wordsOf(text).forEach((s) => {
      const w = c.measureText(s).width;
      if (used + w > maxW && lines[lines.length - 1].length) {
        lines.push([]);
        used = 0;
      }
      if (!s.trim() && !lines[lines.length - 1].length) return;
      lines[lines.length - 1].push({s, w, x: used});
      used += w;
    });
    return lines.map((l) => ({words: l, width: l.reduce((a, w) => a + w.w, 0)}));
  };
  const fitWrap = (c, text, maxW, maxH, from, floor, weight = 700, lh = 1.28) => {
    let size = from;
    let lines = wrapAt(c, text, size, maxW, weight);
    while (size > floor && (lines.length * size * lh > maxH || lines.length > 5)) {
      size -= 4;
      lines = wrapAt(c, text, size, maxW, weight);
    }
    return {size, lines, lh: size * lh};
  };
  const word = (c, s, x, y, size, color, weight) => {
    font(c, size, weight);
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillStyle = color;
    c.fillText(s, x, y);
  };
  // 这句里写出来的数字原样拿来：86%、3.5、12
  const tokenOf = (x, i = 0) => {
    const m = String(x.lineFull).match(/-?\d+(?:\.\d+)?\s*[%％]?/g) || [];
    return (m[i] || fmt(x.nums[i] != null ? x.nums[i] : x.N)).replace(/\s+/g, '');
  };
  const labelOf = (x, i = 0) => stripNumber(x.W[i] || '') || stripNumber(x.lineFull) || '';
  const unitOf = (x) => (/[%％]/.test(x.lineFull) ? '%' : '');

  // ================= 文字特效 =================
  const TEXT = {category: 'texfx', family: '文字特效'};

  A(Object.assign({key: 'text-reveal', name: '逐词升起', en: 'Text Reveal', desc: '每个词从自己的切口里升起，由虚变实', keywords: ['逐词'], words: ['一杯咖啡，一段时光'], base: 3}, TEXT), (c, t, x) => {
    const L = fitWrap(c, x.lineFull, 1500, 760, 120, 44, 800);
    const total = L.lines.reduce((a, l) => a + l.words.filter((w) => w.s.trim()).length, 0);
    const step = Math.min(0.09, 1.3 / Math.max(1, total));
    const top = CY - ((L.lines.length - 1) * L.lh) / 2;
    let i = 0;
    L.lines.forEach((line, n) => {
      const y = top + n * L.lh;
      const left = CX - line.width / 2;
      line.words.forEach((w) => {
        if (!w.s.trim()) return;
        const u = land(seg(t, 0.25 + step * i, 0.25 + step * i + 0.75));
        i++;
        if (u <= 0) return;
        c.save();
        c.beginPath();
        c.rect(left + w.x - 6, y - L.size * 0.64, w.w + 12, L.size * 1.28);
        c.clip();
        const dy = (1 - u) * L.size * 0.85;
        // 由虚变实：没清楚之前叠几层错开的淡字
        if (u < 0.85) {
          const spread = (1 - u) * 7;
          alpha(c, 0.28 * u, () => {
            word(c, w.s, left + w.x - spread, y + dy, L.size, x.p.ink, 800);
            word(c, w.s, left + w.x + spread, y + dy, L.size, x.p.ink, 800);
          });
        }
        alpha(c, u, () => word(c, w.s, left + w.x, y + dy, L.size, x.p.ink, 800));
        c.restore();
      });
    });
  });

  // 两段字之间：相同的字滑到新位置，多出来的淡入，少了的淡出
  const pairUp = (a, b) => {
    const m = a.length;
    const n = b.length;
    const L = Array.from({length: m + 1}, () => new Array(n + 1).fill(0));
    for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const map = new Map();
    let i = 0;
    let j = 0;
    while (i < m && j < n) {
      if (a[i] === b[j]) {
        map.set(i, j);
        i++;
        j++;
      } else if (L[i + 1][j] >= L[i][j + 1]) i++;
      else j++;
    }
    return map;
  };
  const charsAt = (c, s, size) => {
    const chars = [...s];
    font(c, size, 800);
    const total = c.measureText(s).width;
    let acc = 0;
    return chars.map((ch) => {
      const w = c.measureText(ch).width;
      const at0 = CX - total / 2 + acc + w / 2;
      acc += w;
      return {ch, x: at0};
    });
  };
  A(Object.assign({key: 'text-morph', name: '字形变换', en: 'Text Morph', desc: '一个词变成下一个词：相同的字滑过去，不同的字淡入淡出', keywords: ['字形变换'], words: ['拿铁', '冰拿铁', '燕麦拿铁'], base: 3.4}, TEXT), (c, t, x) => {
    const list = (x.W.length >= 2 ? x.W.slice(0, 4) : [x.lineFull]).map((s) => head(s, 16));
    let size = 150;
    list.forEach((s) => {
      size = Math.min(size, fit(c, s, 1500, 150, 60, 800));
    });
    const hold = Math.max(0.7, (x.T - 0.8) / list.length - 0.5);
    const enter = land(seg(t, 0.15, 0.6));
    let k = 0;
    let u = 0;
    for (let i = 0; i < list.length - 1; i++) {
      const start = 0.6 + hold + i * (hold + 0.55);
      if (t >= start) {
        k = i;
        u = io(seg(t, start, start + 0.55));
      }
    }
    const a = charsAt(c, list[k], size);
    if (list.length < 2 || (k === 0 && u === 0 && t < 0.6 + hold)) {
      alpha(c, enter, () => a.forEach((ch) => tx(c, ch.ch, ch.x, CY + (1 - enter) * 30, size, x.p.ink, 'center', 800)));
      return;
    }
    const b = charsAt(c, list[k + 1], size);
    const map = pairUp(a.map((q) => q.ch), b.map((q) => q.ch));
    const used = new Set(map.values());
    a.forEach((ch, i) => {
      if (map.has(i)) tx(c, ch.ch, lerp(ch.x, b[map.get(i)].x, u), CY, size, x.p.ink, 'center', 800);
      else alpha(c, 1 - u, () => tx(c, ch.ch, ch.x, CY - u * 26, size, x.p.ink, 'center', 800));
    });
    b.forEach((ch, j) => {
      if (!used.has(j)) alpha(c, u, () => tx(c, ch.ch, ch.x, CY + (1 - u) * 26, size, x.p.a, 'center', 800));
    });
  });

  A(Object.assign({key: 'text-shimmer', name: '流光字', en: 'Text Shimmer', desc: '一道光从字上扫过，像在加载', keywords: ['正在生成', '思考中'], words: ['正在冲一杯手冲'], base: 3.4}, TEXT), (c, t, x) => {
    const text = head(x.lineFull, 40);
    const L = fitWrap(c, text, 1500, 500, 110, 44, 700);
    const top = CY - ((L.lines.length - 1) * L.lh) / 2;
    const settle = seg(t, x.T - 0.9, x.T - 0.2);
    const sweep = ((t - 0.3) % 1.5) / 1.5;
    const band = lerp(CX - 1000, CX + 1000, sweep);
    L.lines.forEach((line, n) => {
      const y = top + n * L.lh;
      const left = CX - line.width / 2;
      line.words.forEach((w) => word(c, w.s, left + w.x, y, L.size, x.p.mute, 700));
      alpha(c, settle, () => line.words.forEach((w) => word(c, w.s, left + w.x, y, L.size, x.p.ink, 700)));
      if (t > 0.3 && settle < 1) {
        const g = c.createLinearGradient(band - 260, 0, band + 260, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.5, x.p.ink);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        alpha(c, 1 - settle, () => {
          font(c, L.size, 700);
          c.textAlign = 'left';
          c.textBaseline = 'middle';
          c.fillStyle = g;
          line.words.forEach((w) => c.fillText(w.s, left + w.x, y));
        });
      }
    });
  });

  A(Object.assign({key: 'slot-text', name: '老虎机字', en: 'Slot Text', desc: '字一个个转到位停下，数字从 0 滚到真值', keywords: ['老虎机'], words: ['拿铁 72%'], base: 3}, TEXT), (c, t, x) => {
    const text = head(x.W.find((w) => /\d/.test(w)) || x.W[0] || x.lineFull, 14);
    const size = Math.min(220, fit(c, text, 1500, 220, 70, 800));
    const m = text.match(/-?\d+(?:\.\d+)?\s*[%％]?/);
    const words = m ? text.slice(0, m.index).trim() : text;
    const token = m ? m[0].replace(/\s+/g, '') : '';
    const ww = words ? widthOf(c, words, size, 800) : 0;
    const nw = token ? numWidth(c, token, size) : 0;
    const gap = words && token ? size * 0.3 : 0;
    const left = CX - (ww + gap + nw) / 2;
    if (words) {
      const chars = [...words];
      const pool = [...new Set([...x.lineFull].filter((ch) => /[一-鿿]/.test(ch)))];
      font(c, size, 800);
      let px = left;
      chars.forEach((ch, i) => {
        const w = c.measureText(ch).width;
        const stop = 0.8 + i * 0.12;
        const spinning = t < stop;
        const pick = spinning && pool.length ? pool[Math.floor(rnd(i * 13 + Math.floor(t * 14), 3) * pool.length)] : ch;
        const k = land(seg(t, stop - 0.15, stop));
        c.save();
        c.beginPath();
        c.rect(px - 2, CY - size * 0.62, w + 4, size * 1.24);
        c.clip();
        if (t < 0.3) {
          c.restore();
          px += w;
          return;
        }
        if (spinning && k === 0) tx(c, pick, px + w / 2, CY + ((t * 14) % 1) * size * 0.4, size, x.p.mute, 'center', 800);
        else tx(c, ch, px + w / 2, CY + (1 - k) * size * 0.5, size, x.p.ink, 'center', 800);
        c.restore();
        px += w;
      });
    }
    if (token) rolling(c, token, left + ww + gap + nw / 2, CY, size, land(seg(t, 0.4, 1.8)), x.p.ink);
  });

  A(Object.assign({key: 'in-view-title', name: '标题入场', en: 'In-View Title', desc: '字距从紧到松打开，柔边从左往右揭开', keywords: ['标题入场'], words: ['第一章 一杯咖啡'], base: 2.8}, TEXT), (c, t, x) => {
    const text = head(x.W[0] || x.lineFull, 20);
    const size0 = fit(c, text, 1400, 150, 60, 800);
    const u = io(seg(t, 0.2, 1.6));
    const spacing = lerp(0.34, 0.04, u) * size0;
    const chars = [...text];
    font(c, size0, 800);
    const widths = chars.map((ch) => c.measureText(ch).width);
    const total = widths.reduce((a, w) => a + w, 0) + spacing * (chars.length - 1);
    let left = CX - total / 2;
    const wipe = lerp(CX - total / 2 - 60, CX + total / 2 + 200, io(seg(t, 0.2, 1.4)));
    chars.forEach((ch, i) => {
      const cx = left + widths[i] / 2;
      // 柔边：离揭开的边越近越淡
      const a = clamp((wipe - cx) / 160);
      alpha(c, a, () => tx(c, ch, cx, CY, size0, x.p.ink, 'center', 800));
      left += widths[i] + spacing;
    });
    alpha(c, seg(t, 1.2, 1.8), () => ln(c, CX - total / 2, CY + size0 * 0.75, CX - total / 2 + total * land(seg(t, 1.2, 2.2)), CY + size0 * 0.75, x.p.a, 6));
  });

  A(Object.assign({key: 'expandable-text', name: '展开全文', en: 'Expandable Text', desc: '先露两行，下沿渐隐；展开后整段出来', keywords: ['展开全文'], words: ['手冲的风味清爽，拿铁的风味醇厚。一杯咖啡，一个选择，一段时光。磨豆，注水，等待，品尝。'], base: 3.6}, TEXT), (c, t, x) => {
    const W = 1240;
    const L = fitWrap(c, x.lineFull, W - 120, 640, 52, 30, 500, 1.5);
    const full = L.lines.length * L.lh;
    const two = Math.min(full, L.lh * 2);
    const u = soft(seg(t, 1.3, 2.1));
    const h = lerp(two, full, u);
    const top = CY - (h + 140) / 2;
    alpha(c, land(seg(t, 0.1, 0.5)), () => {
      rr(c, CX - W / 2, top, W, h + 140, 36, x.p.card, x.p.line);
      c.save();
      c.beginPath();
      c.rect(CX - W / 2, top + 50, W, h + 10);
      c.clip();
      L.lines.forEach((line, n) => line.words.forEach((w) => word(c, w.s, CX - W / 2 + 60 + w.x, top + 50 + L.lh / 2 + n * L.lh, L.size, x.p.ink, 500)));
      c.restore();
      if (u < 1 && full > two) {
        const g = c.createLinearGradient(0, top + 50 + h - L.lh, 0, top + 60 + h);
        g.addColorStop(0, 'rgba(24,24,27,0)');
        g.addColorStop(1, x.p.card);
        alpha(c, 1 - u, () => {
          c.fillStyle = g;
          c.fillRect(CX - W / 2 + 2, top + 50 + h - L.lh, W - 4, L.lh + 10);
        });
      }
      // 展开箭头：转半圈
      const ay = top + h + 105;
      c.save();
      c.translate(CX, ay);
      c.rotate(Math.PI * u);
      c.strokeStyle = x.p.mute;
      c.lineWidth = 6;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(-16, -8);
      c.lineTo(0, 8);
      c.lineTo(16, -8);
      c.stroke();
      c.restore();
    });
    if (t > 0.9 && t < 1.5) cursor(c, CX + 40, top + h + 120, seg(t, 1.15, 1.3) - seg(t, 1.3, 1.45));
  });

  // ================= 状态 =================
  const STATE = {category: 'kxs', family: '状态'};

  // 数值从 0 滚到真值：只往上走，不超过真值。变了的那几位卷上去，没变的不动
  const rolling = (c, token, cx, cy, size, u, color) => {
    const m = String(token).match(/^(-?)(\d+)(?:\.(\d+))?(.*)$/);
    if (!m) {
      num(c, token, cx, cy, size, color);
      return;
    }
    const decimals = m[3] ? m[3].length : 0;
    const scale = 10 ** decimals;
    const target = Math.round(parseFloat(`${m[2]}.${m[3] || 0}`) * scale);
    const v = target * clamp(u);
    const k = Math.min(target, Math.floor(v));
    const frac = k >= target ? 0 : v - k;
    const width = String(target).length;
    const pad = (n) => String(n).padStart(Math.max(width, decimals + 1), '0');
    const now = pad(k);
    const next = pad(Math.min(target, k + 1));
    const show = (str) => {
      const intPart = decimals ? str.slice(0, -decimals) : str;
      return (intPart.replace(/^0+(?=\d)/, '') || '0') + (decimals ? `.${str.slice(-decimals)}` : '');
    };
    const a = `${m[1]}${show(now)}${m[4]}`;
    const b = `${m[1]}${show(next)}${m[4]}`;
    const chars = [...b];
    const before = [...a].length === chars.length ? [...a] : chars;
    const widths = chars.map((ch) => numWidth(c, /\d/.test(ch) ? '0' : ch, size));
    const total = widths.reduce((s2, w) => s2 + w, 0);
    let left = cx - total / 2;
    chars.forEach((ch, i) => {
      const w = widths[i];
      const from = before[i];
      if (from === ch || !/\d/.test(ch)) {
        num(c, ch, left + w / 2, cy, size, color);
      } else {
        c.save();
        c.beginPath();
        c.rect(left - 2, cy - size * 0.6, w + 4, size * 1.2);
        c.clip();
        num(c, from, left + w / 2, cy - frac * size, size, color);
        num(c, ch, left + w / 2, cy + (1 - frac) * size, size, color);
        c.restore();
      }
      left += w;
    });
    return total;
  };
  A(Object.assign({key: 'animated-counter', name: '里程表数字', en: 'Animated Counter', desc: '每一位是一个转盘，像里程表一样转到这个数', keywords: ['里程表'], words: ['杯咖啡卖出'], num: 2468, needs: 'any', base: 3}, STATE), (c, t, x) => {
    const text = tokenOf(x);
    const size = Math.min(300, (1400 / Math.max(2, [...text].length)) * 1.6);
    rolling(c, text, CX, CY - 40, size, land(seg(t, 0.3, 1.9)), x.p.ink);
    const label = labelOf(x);
    if (label) alpha(c, seg(t, 0.8, 1.3), () => tx(c, clip(label, 20), CX, CY + size * 0.55 + 20, 56, x.p.mute, 'center', 500));
  });

  A(Object.assign({key: 'metric-card', name: '指标卡', en: 'Metric Card', desc: '一张卡片一个指标，数字从下面升上来', keywords: ['指标卡'], words: ['本周手冲', '上周'], num: 128, needs: 'any', base: 3}, STATE), (c, t, x) => {
    const W = 980;
    const H = 460;
    const u = soft(seg(t, 0.1, 0.7));
    at(c, CX, CY, lerp(0.94, 1, u), () => alpha(c, u, () => {
      rr(c, -W / 2, -H / 2, W, H, 40, x.p.card, x.p.line);
      tx(c, clip(labelOf(x) || ' ', 16), -W / 2 + 70, -H / 2 + 90, 52, x.p.mute, 'left', 500);
      const v = land(seg(t, 0.5, 1.2));
      c.save();
      c.beginPath();
      c.rect(-W / 2, -60, W, 230);
      c.clip();
      num(c, tokenOf(x), -W / 2 + 60 + numWidth(c, tokenOf(x), 200) / 2, 55 + (1 - v) * 180, 200, x.p.ink);
      c.restore();
      if (x.nums.length > 1) {
        const k = land(seg(t, 1.2, 1.7));
        const chip = `${clip(labelOf(x, 1), 8)} ${tokenOf(x, 1)}`.trim();
        const cw = widthOf(c, chip, 40, 600) + 50;
        alpha(c, k, () => {
          rr(c, W / 2 - 70 - cw, -H / 2 + 60, cw, 64, 32, 'rgba(255,106,31,0.16)');
          tx(c, chip, W / 2 - 70 - cw / 2, -H / 2 + 92, 40, x.p.a, 'center', 600);
        });
      }
    }));
  });

  A(Object.assign({key: 'usage-meter', name: '用量分段条', en: 'Usage Meter', desc: '一根条分成几段，每段是一项占多少', keywords: ['分段条'], words: ['拿铁 72', '美式 10', '手冲 18'], needs: 'any', base: 3.4, series: [{label: '拿铁', value: 72}, {label: '美式', value: 10}, {label: '手冲', value: 18}]}, STATE), (c, t, x) => {
    const S = x.series.length ? x.series.slice(0, 6) : [{label: labelOf(x), value: x.pct != null ? x.pct : x.N}];
    const sum = S.reduce((a, s) => a + s.value, 0);
    const whole = sum <= 100 && (unitOf(x) || sum > 60) ? 100 : sum;
    const W = 1400;
    const left = CX - W / 2;
    const y = CY - 60;
    rr(c, left, y, W, 64, 32, x.p.line);
    let acc = 0;
    S.forEach((s, i) => {
      const u = soft(seg(t, 0.3 + i * 0.22, 1.1 + i * 0.22));
      const w = (s.value / whole) * W * u;
      if (w > 1) rr(c, left + acc, y, Math.max(0, w - 4), 64, 30, tone(x.p, i));
      acc += (s.value / whole) * W * u;
    });
    const cols = Math.min(S.length, 3);
    S.forEach((s, i) => {
      const k = land(seg(t, 0.9 + i * 0.15, 1.4 + i * 0.15));
      const lx = left + (i % cols) * (W / cols);
      const ly = y + 150 + Math.floor(i / cols) * 90;
      alpha(c, k, () => {
        rr(c, lx, ly - 16, 32, 32, 8, tone(x.p, i));
        tx(c, clip(s.label, 8), lx + 52, ly, 46, x.p.ink, 'left', 500);
        num(c, `${fmt(s.value)}${unitOf(x)}`, lx + 60 + widthOf(c, clip(s.label, 8), 46, 500) + 70, ly, 46, x.p.mute);
      });
    });
  });

  A(Object.assign({key: 'gauge', name: '半圆仪表', en: 'Gauge', desc: '半圆的表盘走到这个百分比，颜色跟着分档', keywords: ['仪表盘'], words: ['满意度'], num: 82, needs: 'percent', base: 3}, STATE), (c, t, x) => {
    const v = x.pct != null ? x.pct : x.N;
    const cy = CY + 170;
    const r = 380;
    const u = out(seg(t, 0.3, 1.9));
    const shown = v * u;
    const color = shown >= 80 ? x.p.a : shown >= 50 ? x.p.b : x.p.mute;
    arc(c, CX, cy, r, Math.PI, Math.PI * 2, x.p.line, 44);
    if (shown > 0.2) arc(c, CX, cy, r, Math.PI, Math.PI + (Math.PI * shown) / 100, color, 44);
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI + (Math.PI * i) / 10;
      ln(c, CX + Math.cos(a) * (r - 64), cy + Math.sin(a) * (r - 64), CX + Math.cos(a) * (r - (i % 5 ? 80 : 96)), cy + Math.sin(a) * (r - (i % 5 ? 80 : 96)), x.p.mute, i % 5 ? 3 : 5);
    }
    // 数字只在动画结束时是真值，中途不显示没有写过的数
    alpha(c, seg(t, 1.5, 2.1), () => num(c, `${tokenOf(x)}`, CX, cy - 110, 190, x.p.ink));
    const label = labelOf(x);
    if (label) alpha(c, seg(t, 0.8, 1.3), () => tx(c, clip(label, 14), CX, cy + 40, 52, x.p.mute, 'center', 500));
  });

  A(Object.assign({key: 'progress', name: '细进度条', en: 'Progress', desc: '一根细条走到这个百分比，头上带一点光', keywords: ['进度条'], words: ['下载进度'], num: 64, needs: 'percent', base: 2.8}, STATE), (c, t, x) => {
    const v = x.pct != null ? x.pct : x.N;
    const W = 1400;
    const left = CX - W / 2;
    const u = out(seg(t, 0.3, 1.8));
    tx(c, clip(labelOf(x) || ' ', 16), left, CY - 70, 56, x.p.ink, 'left', 600);
    alpha(c, seg(t, 1.4, 1.9), () => num(c, tokenOf(x), left + W - numWidth(c, tokenOf(x), 64) / 2, CY - 70, 64, x.p.ink));
    rr(c, left, CY, W, 18, 9, x.p.line);
    const w = (W * v * u) / 100;
    if (w > 2) {
      rr(c, left, CY, w, 18, 9, x.p.a);
      dot(c, left + w, CY + 9, 15, '#FFD2B8');
      alpha(c, 0.35, () => dot(c, left + w, CY + 9, 34, x.p.a));
    }
  });

  A(Object.assign({key: 'stats-band', name: '数据横幅', en: 'Stats Band', desc: '一排几个数，各自从下面升起，下面写着是什么', keywords: ['数据横幅'], words: ['拿铁 72%', '美式 10%', '手冲 18%'], needs: 'two', base: 3, series: [{label: '拿铁', value: 72}, {label: '美式', value: 10}, {label: '手冲', value: 18}]}, STATE), (c, t, x) => {
    const S = x.series.slice(0, 4);
    const W = 1600;
    const col = W / S.length;
    S.forEach((s, i) => {
      const cx = CX - W / 2 + col * (i + 0.5);
      const u = land(seg(t, 0.25 + i * 0.16, 0.95 + i * 0.16));
      if (i > 0) alpha(c, u, () => ln(c, cx - col / 2, CY - 120, cx - col / 2, CY + 120, x.p.line, 3));
      c.save();
      c.beginPath();
      c.rect(cx - col / 2, CY - 190, col, 200);
      c.clip();
      num(c, `${fmt(s.value)}${unitOf(x)}`, cx, CY - 70 + (1 - u) * 150, Math.min(150, col * 0.42), i === 0 ? x.p.a : x.p.ink);
      c.restore();
      alpha(c, u, () => tx(c, clip(s.label, 8), cx, CY + 70, 48, x.p.mute, 'center', 500));
    });
  });

  A(Object.assign({key: 'stepper', name: '步骤推进', en: 'Stepper', desc: '几步连成一条线，一步亮一步打勾', keywords: ['第一步'], words: ['磨豆', '注水', '等待', '品尝'], base: 3.6}, STATE), (c, t, x) => {
    const steps = x.W.slice(0, 6);
    const n = Math.max(2, steps.length);
    const W = 1500;
    const gap = W / (n - 1);
    const y = CY - 30;
    const per = Math.max(0.45, (x.T - 1) / n);
    ln(c, CX - W / 2, y, CX + W / 2, y, x.p.line, 8);
    const reached = clamp((t - 0.4) / per, 0, n - 1);
    ln(c, CX - W / 2, y, CX - W / 2 + gap * reached, y, x.p.a, 8);
    steps.forEach((s, i) => {
      const cx = CX - W / 2 + gap * i;
      const on = seg(t, 0.4 + per * i - 0.1, 0.4 + per * i + 0.2);
      dot(c, cx, y, 38, on > 0 ? x.p.a : x.p.card);
      arc(c, cx, y, 38, 0, Math.PI * 2, on > 0 ? x.p.a : x.p.line, 5);
      if (on > 0) check(c, cx, y, 40, on, '#fff', 7);
      tx(c, clip(s, 6), cx, y + 100, 46, on > 0 ? x.p.ink : x.p.mute, 'center', on > 0 ? 600 : 500);
    });
  });

  A(Object.assign({key: 'timeline', name: '时间轴', en: 'Timeline', desc: '竖线往下长，一个节点亮一条事', keywords: ['那一年'], words: ['2024年 开第一家店', '2025年 开第二家店', '2026年 开到十家'], base: 3.6}, STATE), (c, t, x) => {
    const items = x.W.slice(0, 5);
    const n = items.length;
    const rowH = Math.min(170, 760 / Math.max(1, n));
    const top = CY - ((n - 1) * rowH) / 2;
    const lx = CX - 520;
    const per = Math.max(0.4, (x.T - 1) / n);
    ln(c, lx, top - 40, lx, top - 40 + ((n - 1) * rowH + 80) * land(seg(t, 0.2, 0.4 + per * n)), x.p.line, 6);
    items.forEach((s, i) => {
      const y = top + i * rowH;
      const u = land(seg(t, 0.4 + per * i, 0.9 + per * i));
      if (u <= 0) return;
      dot(c, lx, y, 18 * soft(seg(t, 0.4 + per * i, 0.8 + per * i)), x.p.a);
      const yearish = (s.match(/\d{2,4}\s*年?/) || [''])[0];
      const rest = yearish ? s.replace(yearish, '').trim() : s;
      alpha(c, u, () => {
        let px = lx + 60 + (1 - u) * 24;
        if (yearish) {
          num(c, yearish.replace(/\s/g, ''), px + numWidth(c, yearish, 58) / 2, y, 58, x.p.a);
          px += numWidth(c, yearish, 58) + 30;
        }
        tx(c, clip(rest, 16), px, y, 54, x.p.ink, 'left', 500);
      });
    });
  });

  A(Object.assign({key: 'onboarding-checklist', name: '清单打勾', en: 'Onboarding Checklist', desc: '一张清单，一项一项打勾，上面的进度条跟着走', keywords: ['待办清单'], words: ['磨豆', '烧水', '称粉', '注水'], base: 3.6}, STATE), (c, t, x) => {
    const items = x.W.slice(0, 6);
    const n = items.length;
    const W = 1000;
    const rowH = 104;
    const H = 150 + n * rowH;
    const top = CY - H / 2;
    const per = Math.max(0.35, (x.T - 1.2) / n);
    alpha(c, land(seg(t, 0.1, 0.5)), () => {
      rr(c, CX - W / 2, top, W, H, 40, x.p.card, x.p.line);
      const done = clamp((t - 0.6) / per, 0, n);
      rr(c, CX - W / 2 + 60, top + 60, W - 120, 14, 7, x.p.line);
      rr(c, CX - W / 2 + 60, top + 60, ((W - 120) * soft(done / n)), 14, 7, x.p.ok);
      items.forEach((s, i) => {
        const y = top + 150 + i * rowH;
        const u = seg(t, 0.6 + per * i, 0.6 + per * i + 0.35);
        rr(c, CX - W / 2 + 60, y - 26, 52, 52, 14, u > 0 ? x.p.ok : 'rgba(0,0,0,0)', u > 0 ? x.p.ok : x.p.mute, 4);
        if (u > 0) check(c, CX - W / 2 + 86, y, 32, u, '#fff', 6);
        tx(c, clip(s, 14), CX - W / 2 + 150, y, 50, u > 0.5 ? x.p.mute : x.p.ink, 'left', 500);
      });
    });
  });

  A(Object.assign({key: 'toast-stack', name: '通知堆叠', en: 'Toast Stack', desc: '通知从下面一条条升上来，旧的缩到后面', keywords: ['通知栏'], words: ['订单已下单', '咖啡在制作', '咖啡做好了'], base: 3.6}, STATE), (c, t, x) => {
    const items = x.W.slice(0, 5);
    const per = Math.max(0.6, (x.T - 0.8) / items.length);
    const W = 1100;
    const H = 150;
    const base = CY + 160;
    items.forEach((s, i) => {
      const born = 0.3 + per * i;
      const u = soft(seg(t, born, born + 0.5));
      if (u <= 0) return;
      const depth = items.filter((_, j) => j > i && t > 0.3 + per * j).length;
      const lift = Math.min(depth, 3);
      const y = base - lift * 26 + (1 - u) * 260;
      const s2 = 1 - lift * 0.05;
      at(c, CX, y, s2, () => alpha(c, u * (depth > 2 ? 0 : 1 - lift * 0.18), () => {
        rr(c, -W / 2, -H / 2, W, H, 34, x.p.card, x.p.line);
        dot(c, -W / 2 + 80, 0, 22, i === items.length - 1 ? x.p.ok : x.p.a);
        tx(c, clip(s, 18), -W / 2 + 130, 0, 50, x.p.ink, 'left', 500);
      }));
    });
  });

  // ================= 图表 =================
  const CHART = {category: 'chart', family: '图表', needs: 'two'};
  const SERIES = [{label: '拿铁', value: 72}, {label: '美式', value: 10}, {label: '手冲', value: 18}, {label: '冷萃', value: 26}];
  const plot = {left: CX - 720, right: CX + 720, top: CY - 300, bottom: CY + 260};

  A(Object.assign({key: 'bar-chart', name: '柱子生长', en: 'Bar Chart', desc: '柱子依次长出来，最高的那根上色', keywords: ['柱子'], words: ['拿铁 72', '美式 10', '手冲 18', '冷萃 26'], base: 3.2, series: SERIES}, CHART), (c, t, x) => {
    const S = x.series.slice(0, 8);
    const max = Math.max(...S.map((s) => s.value), 1);
    const col = (plot.right - plot.left) / S.length;
    const bw = Math.min(150, col * 0.56);
    ln(c, plot.left, plot.bottom, plot.right, plot.bottom, x.p.line, 3);
    S.forEach((s, i) => {
      const cx = plot.left + col * (i + 0.5);
      const u = out(seg(t, 0.3 + i * 0.12, 1.2 + i * 0.12));
      const h = ((plot.bottom - plot.top - 60) * s.value) / max;
      const top = s.value === max;
      rr(c, cx - bw / 2, plot.bottom - h * u, bw, h * u, 14, top ? x.p.a : '#3A3A42');
      alpha(c, seg(t, 1.1 + i * 0.12, 1.4 + i * 0.12), () => num(c, `${fmt(s.value)}${unitOf(x)}`, cx, plot.bottom - h - 44, 58, top ? x.p.a : x.p.ink));
      tx(c, clip(s.label, 6), cx, plot.bottom + 52, 44, x.p.mute, 'center', 500);
    });
  });

  A(Object.assign({key: 'line-chart', name: '折线描绘', en: 'Line Chart', desc: '折线从左往右画出来，下面一层淡淡的面积', keywords: ['折线'], words: ['第一年 23', '第二年 47', '第三年 88'], base: 3.4, series: [{label: '第一年', value: 23}, {label: '第二年', value: 47}, {label: '第三年', value: 88}]}, CHART), (c, t, x) => {
    const S = x.series.slice(0, 12);
    const max = Math.max(...S.map((s) => s.value), 1) * 1.1;
    const px = (i) => plot.left + ((plot.right - plot.left) * i) / Math.max(1, S.length - 1);
    const py = (v) => plot.bottom - ((plot.bottom - plot.top) * v) / max;
    for (let g = 1; g <= 3; g++) ln(c, plot.left, plot.bottom - ((plot.bottom - plot.top) * g) / 4, plot.right, plot.bottom - ((plot.bottom - plot.top) * g) / 4, x.p.line, 2);
    const u = io(seg(t, 0.3, 2.0));
    const reach = u * (S.length - 1);
    const pts = [];
    for (let i = 0; i <= Math.floor(reach); i++) pts.push([px(i), py(S[i].value)]);
    const k = reach - Math.floor(reach);
    if (Math.floor(reach) < S.length - 1) {
      const i = Math.floor(reach);
      pts.push([lerp(px(i), px(i + 1), k), lerp(py(S[i].value), py(S[i + 1].value), k)]);
    }
    if (pts.length > 1) {
      const g = c.createLinearGradient(0, plot.top, 0, plot.bottom);
      g.addColorStop(0, 'rgba(255,106,31,0.28)');
      g.addColorStop(1, 'rgba(255,106,31,0)');
      c.beginPath();
      c.moveTo(pts[0][0], plot.bottom);
      pts.forEach(([a, b]) => c.lineTo(a, b));
      c.lineTo(pts[pts.length - 1][0], plot.bottom);
      c.closePath();
      c.fillStyle = g;
      c.fill();
      c.beginPath();
      pts.forEach(([a, b], i) => (i ? c.lineTo(a, b) : c.moveTo(a, b)));
      c.strokeStyle = x.p.a;
      c.lineWidth = 8;
      c.lineJoin = 'round';
      c.lineCap = 'round';
      c.stroke();
    }
    S.forEach((s, i) => {
      const on = seg(t, 0.3 + (1.7 * i) / Math.max(1, S.length - 1), 0.5 + (1.7 * i) / Math.max(1, S.length - 1));
      if (on <= 0) return;
      dot(c, px(i), py(s.value), 16 * soft(on), x.p.a);
      alpha(c, on, () => num(c, `${fmt(s.value)}${unitOf(x)}`, px(i), py(s.value) - 60, 56, i === S.length - 1 ? x.p.a : x.p.ink));
      tx(c, clip(s.label, 6), px(i), plot.bottom + 50, 42, x.p.mute, 'center', 500);
    });
  });

  A(Object.assign({key: 'donut-chart', name: '环形扫开', en: 'Donut Chart', desc: '圆环一段一段扫开，右边是每段是什么', keywords: ['环形图'], words: ['拿铁 72', '美式 10', '手冲 18'], base: 3.2, series: SERIES.slice(0, 3)}, CHART), (c, t, x) => {
    const S = x.series.slice(0, 6);
    const sum = S.reduce((a, s) => a + s.value, 0) || 1;
    const cx = CX - 330;
    const r = 260;
    let a0 = -Math.PI / 2;
    S.forEach((s, i) => {
      const span = (Math.PI * 2 * s.value) / sum;
      const u = io(seg(t, 0.3 + i * 0.25, 0.9 + i * 0.25));
      if (u > 0) arc(c, cx, CY, r, a0 + 0.02, a0 + Math.max(0.02, span * u - 0.02), tone(x.p, i), 90);
      a0 += span;
      const ly = CY - ((S.length - 1) * 100) / 2 + i * 100;
      alpha(c, land(seg(t, 0.6 + i * 0.2, 1.1 + i * 0.2)), () => {
        rr(c, CX + 120, ly - 18, 36, 36, 10, tone(x.p, i));
        tx(c, clip(s.label, 8), CX + 190, ly, 50, x.p.ink, 'left', 500);
        num(c, `${fmt(s.value)}${unitOf(x)}`, CX + 560, ly, 54, x.p.mute);
      });
    });
    const big = S.reduce((m, s) => (s.value > m.value ? s : m), S[0]);
    alpha(c, seg(t, 1.2, 1.7), () => {
      num(c, `${fmt(big.value)}${unitOf(x)}`, cx, CY - 10, 110, x.p.ink);
      tx(c, clip(big.label, 6), cx, CY + 70, 44, x.p.mute, 'center', 500);
    });
  });

  A(Object.assign({key: 'sparkline', name: '迷你走势卡', en: 'Sparkline', desc: '一张小卡：大数字加一条细细的走势线', keywords: ['迷你图'], words: ['周一 12', '周二 18', '周三 15', '周四 26'], base: 3, series: [{label: '周一', value: 12}, {label: '周二', value: 18}, {label: '周三', value: 15}, {label: '周四', value: 26}]}, CHART), (c, t, x) => {
    const S = x.series.slice(0, 16);
    const last = S[S.length - 1];
    const W = 1100;
    const H = 460;
    const top = CY - H / 2;
    alpha(c, land(seg(t, 0.1, 0.5)), () => {
      rr(c, CX - W / 2, top, W, H, 40, x.p.card, x.p.line);
      tx(c, clip(last.label, 10), CX - W / 2 + 70, top + 90, 50, x.p.mute, 'left', 500);
      alpha(c, seg(t, 1.4, 1.9), () => num(c, `${fmt(last.value)}${unitOf(x)}`, CX - W / 2 + 70 + numWidth(c, `${fmt(last.value)}${unitOf(x)}`, 170) / 2, top + 220, 170, x.p.ink));
      const max = Math.max(...S.map((s) => s.value));
      const min = Math.min(...S.map((s) => s.value));
      const sx = (i) => CX + 40 + (420 * i) / Math.max(1, S.length - 1);
      const sy = (v) => top + 330 - (200 * (v - min)) / Math.max(1e-6, max - min);
      const u = io(seg(t, 0.4, 1.8));
      const reach = u * (S.length - 1);
      c.beginPath();
      for (let i = 0; i <= Math.ceil(reach); i++) {
        const k = Math.min(1, reach - (i - 1));
        const xi = i === 0 ? sx(0) : lerp(sx(i - 1), sx(i), Math.min(1, k));
        const yi = i === 0 ? sy(S[0].value) : lerp(sy(S[i - 1].value), sy(S[i].value), Math.min(1, k));
        if (i === 0) c.moveTo(xi, yi);
        else c.lineTo(xi, yi);
      }
      c.strokeStyle = last.value >= S[0].value ? x.p.ok : x.p.bad;
      c.lineWidth = 7;
      c.lineJoin = 'round';
      c.stroke();
      if (u >= 1) dot(c, sx(S.length - 1), sy(last.value), 14, last.value >= S[0].value ? x.p.ok : x.p.bad);
    });
  });

  // 方块占比：按面积切
  const squarify = (items, x0, y0, w, h) => {
    const out2 = [];
    let rest = items.slice().sort((a, b) => b.value - a.value);
    let box = {x: x0, y: y0, w, h};
    while (rest.length) {
      const total = rest.reduce((a, s) => a + s.value, 0);
      const s = rest[0];
      const share = s.value / total;
      if (box.w >= box.h) {
        const ww = box.w * share;
        out2.push(Object.assign({}, s, {x: box.x, y: box.y, w: ww, h: box.h}));
        box = {x: box.x + ww, y: box.y, w: box.w - ww, h: box.h};
      } else {
        const hh = box.h * share;
        out2.push(Object.assign({}, s, {x: box.x, y: box.y, w: box.w, h: hh}));
        box = {x: box.x, y: box.y + hh, w: box.w, h: box.h - hh};
      }
      rest = rest.slice(1);
    }
    return out2;
  };
  A(Object.assign({key: 'treemap', name: '面积方块', en: 'Treemap', desc: '面积就是数值，方块一块块放大出来', keywords: ['矩形树图'], words: ['拿铁 72', '美式 10', '手冲 18', '冷萃 26'], base: 3.2, series: SERIES}, CHART), (c, t, x) => {
    const cells = squarify(x.series.slice(0, 8), CX - 760, CY - 400, 1520, 800);
    cells.forEach((q, i) => {
      const u = soft(seg(t, 0.3 + i * 0.14, 0.9 + i * 0.14));
      if (u <= 0) return;
      at(c, q.x + q.w / 2, q.y + q.h / 2, u, () => {
        rr(c, -q.w / 2 + 5, -q.h / 2 + 5, q.w - 10, q.h - 10, 18, tone(x.p, i));
        if (q.w > 140 && q.h > 120) {
          tx(c, clip(q.label, 6), -q.w / 2 + 34, -q.h / 2 + 56, Math.min(52, q.w / 5), '#111', 'left', 600);
          num(c, `${fmt(q.value)}${unitOf(x)}`, -q.w / 2 + 34 + numWidth(c, `${fmt(q.value)}${unitOf(x)}`, Math.min(64, q.w / 4)) / 2, -q.h / 2 + 124, Math.min(64, q.w / 4), '#111');
        }
      });
    });
  });

  A(Object.assign({key: 'waffle-chart', name: '华夫格', en: 'Waffle Chart', desc: '一百个格子，每格一份，按项涂色', keywords: ['华夫格'], words: ['拿铁 72', '美式 10', '手冲 18'], base: 3.2, series: SERIES.slice(0, 3)}, CHART), (c, t, x) => {
    const S = x.series.slice(0, 5);
    const sum = S.reduce((a, s) => a + s.value, 0) || 1;
    const whole = sum <= 100 && unitOf(x) ? 100 : sum;
    // 最大余数法：格子数加起来正好是 100
    const raw = S.map((s) => (s.value / whole) * 100);
    const counts = raw.map(Math.floor);
    let left = Math.min(100, Math.round(raw.reduce((a, v) => a + v, 0))) - counts.reduce((a, v) => a + v, 0);
    raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => {
      if (left > 0) {
        counts[i]++;
        left--;
      }
    });
    const owner = [];
    counts.forEach((n, i) => {
      for (let k = 0; k < n; k++) owner.push(i);
    });
    const cell = 62;
    const gx = CX - 620;
    const gy = CY - (cell * 10) / 2;
    for (let k = 0; k < 100; k++) {
      const col = k % 10;
      const row = Math.floor(k / 10);
      const u = soft(seg(t, 0.2 + (col + row) * 0.035, 0.6 + (col + row) * 0.035));
      const who = owner[k];
      if (u <= 0) continue;
      at(c, gx + col * cell + cell / 2, gy + row * cell + cell / 2, u, () => rr(c, -cell / 2 + 5, -cell / 2 + 5, cell - 10, cell - 10, 10, who != null ? tone(x.p, who) : x.p.line));
    }
    S.forEach((s, i) => {
      const ly = CY - ((S.length - 1) * 96) / 2 + i * 96;
      alpha(c, land(seg(t, 0.9 + i * 0.15, 1.3 + i * 0.15)), () => {
        rr(c, CX + 160, ly - 18, 36, 36, 10, tone(x.p, i));
        tx(c, clip(s.label, 8), CX + 230, ly, 50, x.p.ink, 'left', 500);
        num(c, `${fmt(s.value)}${unitOf(x)}`, CX + 600, ly, 54, x.p.mute);
      });
    });
  });

  A(Object.assign({key: 'brush-chart', name: '刷选走势', en: 'Brush Chart', desc: '下面一条总览，选框滑到最高的那一段，上面放大看', keywords: ['刷选'], words: ['一月 12', '二月 18', '三月 15', '四月 26', '五月 22', '六月 31'], base: 3.6, series: [12, 18, 15, 26, 22, 31].map((v, i) => ({label: `${i + 1}月`, value: v}))}, CHART), (c, t, x) => {
    const S = x.series.slice(0, 24);
    if (S.length < 3) return;
    const max = Math.max(...S.map((s) => s.value), 1) * 1.1;
    const peak = S.findIndex((s) => s.value === Math.max(...S.map((q) => q.value)));
    const span = Math.max(2, Math.round(S.length / 2));
    const from = clamp(peak - Math.floor(span / 2), 0, S.length - span);
    const pos = lerp(0, from, io(seg(t, 0.8, 2.0)));
    const line = (x0, x1, y0, y1, a, b, width, color) => {
      c.beginPath();
      for (let i = 0; i < S.length; i++) {
        const px = x0 + ((x1 - x0) * (i - a)) / Math.max(1e-6, b - a);
        const py = y1 - ((y1 - y0) * S[i].value) / max;
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.strokeStyle = color;
      c.lineWidth = width;
      c.lineJoin = 'round';
      c.stroke();
    };
    const ox0 = CX - 720;
    const ox1 = CX + 720;
    // 上面：选中的那段放大
    c.save();
    c.beginPath();
    c.rect(ox0 - 10, CY - 360, 1460, 460);
    c.clip();
    line(ox0, ox1, CY - 330, CY + 60, pos, pos + span - 1, 8, x.p.a);
    c.restore();
    ln(c, ox0, CY + 70, ox1, CY + 70, x.p.line, 3);
    // 下面：总览和选框
    line(ox0, ox1, CY + 160, CY + 320, 0, S.length - 1, 4, x.p.mute);
    const bx = ox0 + ((ox1 - ox0) * pos) / (S.length - 1);
    const bw = ((ox1 - ox0) * (span - 1)) / (S.length - 1);
    rr(c, bx, CY + 140, bw, 200, 14, 'rgba(255,106,31,0.16)', x.p.a, 4);
    alpha(c, seg(t, 1.9, 2.3), () => {
      const pk = S[peak];
      tx(c, clip(pk.label, 8), CX, CY - 380, 46, x.p.mute, 'center', 500);
    });
  });

  A(Object.assign({key: 'activity-heatmap', name: '活跃日历', en: 'Activity Heatmap', desc: '一格一天，连着的那些天一列一列亮起来', keywords: ['热力日历'], words: ['连续打卡 42 天'], num: 42, needs: 'any', base: 3.2}, Object.assign({}, CHART, {needs: 'any'})), (c, t, x) => {
    const days = clamp(Math.round(x.N), 1, 26 * 7);
    const cell = 46;
    const cols = 26;
    const gx = CX - (cols * cell) / 2;
    const gy = CY - (7 * cell) / 2 - 40;
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < 7; row++) {
        const k = col * 7 + row;
        const fromEnd = cols * 7 - 1 - k;
        const on = fromEnd < days;
        const u = land(seg(t, 0.2 + col * 0.04, 0.5 + col * 0.04));
        if (u <= 0) continue;
        const level = on ? 0.45 + 0.55 * rnd(k, 5) : 0;
        alpha(c, u, () => rr(c, gx + col * cell + 4, gy + row * cell + 4, cell - 8, cell - 8, 8, on ? `rgba(255,106,31,${level.toFixed(2)})` : x.p.line));
      }
    }
    alpha(c, seg(t, 1.4, 1.9), () => {
      tx(c, clip(labelOf(x) || ' ', 16), CX - 140, gy + 7 * cell + 90, 54, x.p.ink, 'right', 600);
      num(c, tokenOf(x), CX - 60, gy + 7 * cell + 90, 96, x.p.a);
    });
  });

  // ================= 交互 =================
  const INT = {category: 'kxi', family: '交互'};

  A(Object.assign({key: 'chat-thread', name: '对话串', en: 'Chat Thread', desc: '先有三个点在打字，然后一条消息弹出来，左右交替', keywords: ['对话串'], words: ['今天喝什么？', '一杯手冲。', '要等多久？', '三分钟。'], base: 3.8}, INT), (c, t, x) => {
    const msgs = x.W.slice(0, 6);
    const per = Math.max(0.6, (x.T - 0.6) / msgs.length);
    const rowH = 150;
    const shown = msgs.filter((_, i) => t > 0.3 + per * i + 0.35).length;
    const scroll = Math.max(0, shown - 4) * rowH;
    msgs.forEach((m, i) => {
      const born = 0.3 + per * i;
      if (t < born) return;
      const right = i % 2 === 1;
      const y = CY - 240 + i * rowH - scroll;
      const typing = t < born + 0.35;
      const w = typing ? 170 : Math.min(1100, widthOf(c, clip(m, 18), 50, 500) + 100);
      const bx = right ? CX + 600 - w : CX - 600;
      const u = soft(seg(t, born, born + 0.3));
      at(c, bx + (right ? w : 0), y, u, () => {
        rr(c, right ? -w : 0, -50, w, 100, 50, right ? x.p.a : x.p.card, right ? null : x.p.line);
        if (typing) {
          for (let k = 0; k < 3; k++) dot(c, (right ? -w : 0) + 55 + k * 30, 0 - Math.max(0, Math.sin((t * 8) - k)) * 8, 9, right ? '#fff' : x.p.mute);
        } else tx(c, clip(m, 18), (right ? -w : 0) + 50, 0, 50, right ? '#fff' : x.p.ink, 'left', 500);
      });
    });
  });

  A(Object.assign({key: 'card-stack', name: '卡片翻走', en: 'Card Stack', desc: '一叠卡片，最上面那张甩开，露出下一张', keywords: ['卡片堆'], words: ['拿铁', '美式', '手冲', '冷萃'], base: 3.6}, INT), (c, t, x) => {
    const cards = x.W.slice(0, 5);
    const n = cards.length;
    const per = Math.max(0.55, (x.T - 0.8) / n);
    for (let i = n - 1; i >= 0; i--) {
      const leave = io(seg(t, 0.6 + per * (i + 1) - 0.35, 0.6 + per * (i + 1)));
      if (i < n - 1 && leave >= 1) continue;
      const depth = i - cards.findIndex((_, j) => !(j < n - 1 && t >= 0.6 + per * (j + 1)));
      const d = clamp(depth, 0, 3);
      const dir = i % 2 ? -1 : 1;
      const lastCard = i === n - 1;
      const dx = lastCard ? 0 : dir * leave * 1300;
      const rot = lastCard ? 0 : dir * leave * 0.35 + (d ? dir * 0.03 * d : 0);
      at(c, CX + dx, CY + d * 34, 1 - d * 0.05, () => alpha(c, d > 2 ? 0 : 1 - d * 0.2, () => {
        rr(c, -380, -260, 760, 520, 44, d === 0 ? x.p.card : '#202024', x.p.line, 3);
        tx(c, clip(cards[i], 8), 0, 0, Math.min(110, fit(c, clip(cards[i], 8), 620, 110, 50, 700)), x.p.ink, 'center', 700);
      }, ), rot);
    }
  });

  A(Object.assign({key: 'segmented-control', name: '分段切换', en: 'Segmented Control', desc: '几个选项排成一条，亮块滑到下一个', keywords: ['分段控件'], words: ['拿铁', '美式', '手冲'], base: 3.2}, INT), (c, t, x) => {
    const opts = x.W.slice(0, 5).map((s) => clip(s, 6));
    const n = opts.length;
    const size = 52;
    const widths = opts.map((s) => Math.max(200, widthOf(c, s, size, 600) + 100));
    const total = widths.reduce((a, w) => a + w, 0) + 20;
    const left = CX - total / 2;
    const per = Math.max(0.5, (x.T - 0.8) / n);
    const k = clamp((t - 0.5) / per, 0, n - 1);
    const i0 = Math.floor(k);
    const f = io(clamp((k - i0) * 2.2));
    const xs = widths.map((_, i) => left + 10 + widths.slice(0, i).reduce((a, w) => a + w, 0));
    const hx = lerp(xs[i0], xs[Math.min(n - 1, i0 + 1)], f);
    const hw = lerp(widths[i0], widths[Math.min(n - 1, i0 + 1)], f);
    rr(c, left, CY - 70, total, 140, 70, x.p.card, x.p.line);
    rr(c, hx, CY - 58, hw, 116, 58, x.p.a);
    opts.forEach((s, i) => {
      const near = 1 - clamp(Math.abs(xs[i] - hx) / 120);
      tx(c, s, xs[i] + widths[i] / 2, CY, size, near > 0.5 ? '#fff' : x.p.mute, 'center', 600);
    });
  });

  A(Object.assign({key: 'expanding-search', name: '展开搜索', en: 'Expanding Search', desc: '一个放大镜按钮展开成搜索框，字一个个打进去', keywords: ['搜一下'], words: ['附近的手冲咖啡馆'], base: 3.4}, INT), (c, t, x) => {
    const q = head(x.W[0] || x.lineFull, 18);
    const u = soft(seg(t, 0.3, 0.9));
    const w = lerp(140, 1300, u);
    rr(c, CX - w / 2, CY - 70, w, 140, 70, x.p.card, u > 0.5 ? x.p.a : x.p.line, 4);
    const ix = CX - w / 2 + 70;
    arc(c, ix - 4, CY - 6, 22, 0, Math.PI * 2, x.p.ink, 7);
    ln(c, ix + 12, CY + 10, ix + 28, CY + 26, x.p.ink, 7);
    const typed = Math.floor([...q].length * clamp((t - 1.0) / Math.max(0.8, x.T - 1.8)));
    const shown = [...q].slice(0, typed).join('');
    if (u > 0.8) {
      tx(c, shown, ix + 70, CY, 54, x.p.ink, 'left', 500);
      if (Math.floor(t * 2.2) % 2 === 0 || typed < [...q].length) ln(c, ix + 76 + widthOf(c, shown, 54, 500), CY - 34, ix + 76 + widthOf(c, shown, 54, 500), CY + 34, x.p.a, 4);
    }
  });

  // ================= 按钮 =================
  const BTN = {category: 'button', family: '按钮'};

  A(Object.assign({key: 'hold-to-confirm', name: '长按确认', en: 'Hold to Confirm', desc: '按住不放，按钮从左往右灌满，满了打勾', keywords: [], words: ['按住下单'], base: 3.2}, BTN), (c, t, x) => {
    const label = clip(x.W[0] || 8);
    const W = Math.max(560, widthOf(c, label, 60, 600) + 220);
    const H = 150;
    const hold = io(seg(t, 0.8, 2.2));
    const done = seg(t, 2.2, 2.5);
    const press = seg(t, 0.6, 0.8) - seg(t, 2.2, 2.4);
    at(c, CX, CY, 1 - press * 0.03, () => {
      rr(c, -W / 2, -H / 2, W, H, 75, x.p.card, x.p.line, 3);
      c.save();
      c.beginPath();
      c.roundRect(-W / 2, -H / 2, W, H, 75);
      c.clip();
      c.fillStyle = done > 0 ? x.p.ok : x.p.a;
      c.fillRect(-W / 2, -H / 2, W * hold, H);
      c.restore();
      if (done > 0) check(c, 0, 0, 64, done, '#fff', 10);
      else tx(c, label, 0, 0, 60, hold > 0.5 ? '#fff' : x.p.ink, 'center', 600);
    });
    if (t > 0.3 && t < 2.6) cursor(c, CX + 60, CY + 30, press);
  });

  A(Object.assign({key: 'confirm-morph', name: '变形确认', en: 'Confirm Morph', desc: '点一下，按钮变成取消和确认两半，再点确认', keywords: [], words: ['删除这一镜'], base: 3.4}, BTN), (c, t, x) => {
    const label = clip(x.W[0] || 8);
    const W0 = Math.max(520, widthOf(c, label, 58, 600) + 200);
    const split = io(seg(t, 0.9, 1.4));
    const done = seg(t, 2.1, 2.5);
    const H = 140;
    if (split < 1) {
      alpha(c, 1 - split, () => {
        rr(c, CX - W0 / 2, CY - H / 2, W0, H, 70, x.p.card, x.p.line, 3);
        tx(c, label, CX, CY, 58, x.p.bad, 'center', 600);
      });
    }
    if (split > 0) {
      const gap = 30 * split;
      const half = lerp(W0 / 2, 200, split);
      alpha(c, split, () => {
        rr(c, CX - half - gap, CY - H / 2, half, H, 70, x.p.card, x.p.line, 3);
        ln(c, CX - half / 2 - gap - 22, CY - 22, CX - half / 2 - gap + 22, CY + 22, x.p.mute, 8);
        ln(c, CX - half / 2 - gap + 22, CY - 22, CX - half / 2 - gap - 22, CY + 22, x.p.mute, 8);
        rr(c, CX + gap, CY - H / 2, half, H, 70, done > 0 ? x.p.ok : x.p.bad);
        check(c, CX + gap + half / 2, CY, 52, done > 0 ? done : 1, '#fff', 9);
      });
    }
    const target = t < 1.6 ? [CX + 40, CY + 30] : [CX + 230, CY + 30];
    if (t > 0.4 && t < 2.6) cursor(c, target[0], target[1], seg(t, 0.7, 0.85) - seg(t, 0.85, 1) + seg(t, 1.9, 2.05) - seg(t, 2.05, 2.2));
  });

  D.arcCount = 30;
})(window);
