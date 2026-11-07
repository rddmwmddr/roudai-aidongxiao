// 界面小组件动效。效果清单参考 Kinetics（kinetics.colorion.co，仓库没有开源授权），代码全部自己写，没有复制。
// 原作是网页里的交互：鼠标放上去、拖一下。视频里没有鼠标，所以每个都排成一段自动演示，指针也是画的。
// 字和数字都从这一镜的文稿来：lines 或 line 拆成短句，第一个数字当数值。
(function (root) {
  'use strict';
  const D = root.DM;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const out = (u) => 1 - (1 - u) ** 3;
  const io = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
  // 弹簧：冲过头再回来
  const spring = (u, bounce = 3.2, damp = 5.5) => (u <= 0 ? 0 : u >= 1 ? 1 : 1 - Math.exp(-damp * u) * Math.cos(bounce * Math.PI * u));
  const rnd = (i, k = 1) => {
    const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  const PAL = {
    black: {bg: '#0A0A0B', card: '#18181B', line: '#2C2C31', ink: '#F4F1EA', mute: '#85858C', a: '#FF6A1F', b: '#4CC9F0', ok: '#3CC765', bad: '#FF5A4F', on: '#0A0A0B'},
    paper: {bg: '#F0EFEB', card: '#FFFFFF', line: '#D9D8D1', ink: '#141416', mute: '#77777C', a: '#E8501A', b: '#1B7FA8', ok: '#1F9A4A', bad: '#D8352A', on: '#FFFFFF'},
  };

  // ---------- 画图小件 ----------
  const rr = (c, x, y, w, h, r, fill, stroke, lw = 2) => {
    c.beginPath();
    c.roundRect(x, y, Math.max(0, w), Math.max(0, h), Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = lw;
      c.stroke();
    }
  };
  const dot = (c, x, y, r, fill) => {
    c.beginPath();
    c.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
    c.fillStyle = fill;
    c.fill();
  };
  const ln = (c, x1, y1, x2, y2, color, lw = 2) => {
    c.strokeStyle = color;
    c.lineWidth = lw;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
  };
  const arc = (c, x, y, r, a0, a1, color, lw) => {
    c.strokeStyle = color;
    c.lineWidth = lw;
    c.lineCap = 'round';
    c.beginPath();
    c.arc(x, y, r, a0, a1);
    c.stroke();
  };
  // 文稿的字比组件留的位置长：先缩字，缩到一半还放不下才截断。不能把一句话拦腰切开
  const budgets = new Map();
  const clip = (s, n) => {
    if (s === undefined || s === null) return '';
    const letters = [...String(s)];
    const kept = letters.slice(0, n * 2).join('');
    if (letters.length > n) budgets.set(kept, n);
    return kept;
  };
  // 打字效果要的是前 n 个字，真截
  const head = (s, n) => [...String(s === undefined || s === null ? '' : s)].slice(0, n).join('');
  const sizeFor = (c, s, size, weight) => {
    const n = budgets.get(s);
    if (n === undefined) return size;
    c.font = `${weight} ${size}px ${D.FONT_CN}`;
    const full = c.measureText(s).width;
    return full > n * size ? (size * n * size) / full : size;
  };
  const tx = (c, s, x, y, size0, color, align = 'center', weight = 500) => {
    const size = sizeFor(c, s, size0, weight);
    c.font = `${weight} ${size}px ${D.FONT_CN}`;
    c.textAlign = align;
    c.textBaseline = 'middle';
    c.fillStyle = color;
    c.fillText(String(s), x, y);
  };
  const widthOf = (c, s, size0, weight = 500) => {
    const size = sizeFor(c, s, size0, weight);
    c.font = `${weight} ${size}px ${D.FONT_CN}`;
    return c.measureText(String(s)).width;
  };
  const fit = (c, s, maxW, size, floor = 28, weight = 500) => {
    let z = size;
    while (z > floor && widthOf(c, s, z, weight) > maxW) z -= 2;
    return z;
  };
  const glow = (c, x, y, r, color, a = 0.5) => {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.save();
    c.globalAlpha *= a;
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
    c.restore();
  };
  const alpha = (c, a, fn) => {
    c.save();
    c.globalAlpha *= clamp(a);
    fn();
    c.restore();
  };
  const at = (c, x, y, s, fn, rot = 0, sy = s) => {
    c.save();
    c.translate(x, y);
    if (rot) c.rotate(rot);
    c.scale(s, sy);
    fn();
    c.restore();
  };
  // 画一个指针。视频里没有鼠标，交互的动效靠它讲明白
  let measuring = false;
  const cursor = (c, x, y, press = 0) => {
    if (measuring) return;
    const s = 3.1 * (1 - press * 0.14);
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(0, 17);
    c.lineTo(4.2, 13);
    c.lineTo(7.2, 19.6);
    c.lineTo(9.9, 18.4);
    c.lineTo(6.9, 12);
    c.lineTo(12.4, 12);
    c.closePath();
    c.fillStyle = '#FFFFFF';
    c.fill();
    c.strokeStyle = '#111';
    c.lineWidth = 1;
    c.stroke();
    c.restore();
  };
  // 关键帧路径：[[秒, x, y], ...]
  const path = (t, keys) => {
    if (t <= keys[0][0]) return [keys[0][1], keys[0][2]];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const k = io(seg(t, keys[i - 1][0], keys[i][0]));
        return [lerp(keys[i - 1][1], keys[i][1], k), lerp(keys[i - 1][2], keys[i][2], k)];
      }
    }
    const last = keys[keys.length - 1];
    return [last[1], last[2]];
  };
  const check = (c, x, y, s, u, color, lw = 12) => {
    const p = [[-0.5, 0.05], [-0.12, 0.42], [0.55, -0.4]];
    const a = Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]);
    const b = Math.hypot(p[2][0] - p[1][0], p[2][1] - p[1][1]);
    const d = (a + b) * u;
    c.strokeStyle = color;
    c.lineWidth = lw;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(x + p[0][0] * s, y + p[0][1] * s);
    if (d < a) {
      c.lineTo(x + lerp(p[0][0], p[1][0], d / a) * s, y + lerp(p[0][1], p[1][1], d / a) * s);
    } else {
      c.lineTo(x + p[1][0] * s, y + p[1][1] * s);
      c.lineTo(x + lerp(p[1][0], p[2][0], (d - a) / b) * s, y + lerp(p[1][1], p[2][1], (d - a) / b) * s);
    }
    c.stroke();
  };
  const heart = (c, x, y, s, fill) => {
    c.beginPath();
    c.moveTo(x, y + s * 0.34);
    c.bezierCurveTo(x - s * 0.9, y - s * 0.3, x - s * 0.42, y - s * 0.86, x, y - s * 0.34);
    c.bezierCurveTo(x + s * 0.42, y - s * 0.86, x + s * 0.9, y - s * 0.3, x, y + s * 0.34);
    c.fillStyle = fill;
    c.fill();
  };
  const star = (c, x, y, r, fill, stroke) => {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const q = i % 2 ? r * 0.44 : r;
      c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
    }
    c.closePath();
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = 4;
      c.stroke();
    }
  };

  // ---------- 从文稿取内容 ----------
  const clean = (s) => String(s || '').replace(/[“”"「」《》]/g, '').trim();
  const phrases = (row) => {
    const lines = (row.lines && row.lines.length ? row.lines : [row.line]).map(clean).filter(Boolean);
    const out2 = [];
    lines.forEach((l) => l.split(/[。！？!?，,、；;：:\n]/).map((x) => x.trim()).filter(Boolean).forEach((x) => out2.push(x)));
    return out2;
  };
  const NUMBER = /-?\d+(?:\.\d+)?/;
  const numbersOf = (text) => (String(text).match(new RegExp(NUMBER.source, 'g')) || []).map(parseFloat);
  const percentOf = (text) => {
    const m = /(-?\d+(?:\.\d+)?)\s*(?:%|％)/.exec(String(text));
    return m ? parseFloat(m[1]) : null;
  };
  const textOfRow = (row) => `${(row.lines || []).join(' ')} ${row.line || ''}`;
  // 这些组件是数值组件：文稿没有对应数字就不能画，不能拿默认数充数
  const NEEDS = {
    kxi_knob: 'percent', kxs_elasticbar: 'percent', kxs_ring: 'percent', kxs_battery: 'percent', kxs_confidence: 'percent',
    kxs_diff: 'two', kxs_stale: 'two', kxs_merge: 'two',
    kxi_counter: 'any', kxi_like: 'any', kxi_stars: 'stars', kxi_stepper: 'any', kxi_pin: 'any', kxi_scrubber: 'any',
    kxs_odometer: 'any', kxs_countdown: 'any', kxs_badgering: 'any', kxs_badgecount: 'any', kxs_presence: 'any', kxs_rollback: 'any',
  };
  const hasNumbers = (id, row) => {
    const need = NEEDS[id];
    if (!need) return true;
    const text = textOfRow(row);
    const nums = numbersOf(text);
    if (need === 'percent') return percentOf(text) !== null;
    if (need === 'two') return nums.length >= 2;
    if (need === 'stars') return nums.length >= 1 && nums[0] >= 1 && nums[0] <= 5;
    return nums.length >= 1;
  };
  // 把数字从标签里拿掉，不然「5000 位用户」下面还写一遍 5000
  const stripNumber = (w) => String(w).replace(/-?\d+(?:\.\d+)?\s*(?:%|％)?/g, '').replace(/^[\s的是有了]+|[\s的]+$/g, '').trim();

  const LIST = [];
  // id、中文名、原名、说明、匹配词、默认字（第一个是主句）、默认数、基础时长、画法
  const add = (cat, key, name, en, desc, keywords, words, num, base, draw) => {
    LIST.push({cat, key, name, en, desc, keywords, words, num, base, draw});
  };
  const I = (...a) => add('kxi', ...a);
  const S = (...a) => add('kxs', ...a);
  const M = (...a) => add('kxm', ...a);
  const CX = 960;
  const CY = 540;

  // ================= 交互 =================
  I('cardresize', '卡片展开', 'Card Resize', '卡片高度弹开，下面的内容露出来', ['展开'], ['展开看看', '这里还有更多内容', '第二行内容'], 0, 3.6, (c, t, x) => {
    const u = spring(seg(t, 0.7, 1.7), 2.2, 5);
    const h = lerp(150, 400, u);
    rr(c, 560, CY - h / 2, 800, h, 28, x.p.card, x.p.line);
    tx(c, clip(x.W[0], 14), 610, CY - h / 2 + 75, 50, x.p.ink, 'left', 600);
    alpha(c, seg(t, 1.1, 1.6), () => {
      tx(c, clip(x.W[1], 18), 610, CY - h / 2 + 180, 40, x.p.mute, 'left');
      tx(c, clip(x.W[2], 18), 610, CY - h / 2 + 250, 40, x.p.mute, 'left');
    });
  });
  I('magnetic', '磁吸按钮', 'Magnetic Button', '指针靠近，按钮被吸过去', ['吸引过去'], ['点这里'], 0, 3.6, (c, t, x) => {
    const [mx, my] = path(t, [[0, 400, 820], [1.4, 1090, 610], [2.4, 840, 480], [3.2, 1300, 800]]);
    const dx = mx - CX;
    const dy = my - CY;
    const near = clamp(1 - Math.hypot(dx, dy) / 340);
    const k = near * 0.36;
    rr(c, CX - 230 + dx * k, CY - 70 + dy * k, 460, 140, 70, x.p.ink);
    tx(c, clip(x.W[0], 8), CX + dx * k * 1.15, CY + dy * k * 1.15, 54, x.p.on, 'center', 600);
    cursor(c, mx, my);
  });
  I('counter', '数字跳动', 'Number Counter', '每加一个数，数字弹一下', ['加一'], ['累计'], 12, 3.2, (c, t, x) => {
    const n = Math.round(x.N);
    const steps = Math.min(8, Math.max(3, n));
    const u = t / 2.4;
    const i = Math.min(steps, Math.floor(u * steps));
    const local = u * steps - i;
    const s = i >= steps ? 1 : 1 + 0.22 * Math.sin(Math.min(1, local * 2) * Math.PI);
    at(c, CX, CY - 20, s, () => tx(c, n - steps + i, 0, 0, 240, x.p.ink, 'center', 700));
    tx(c, clip(x.W[0], 12), CX, CY + 170, 50, x.p.mute);
  });
  I('toast', '弹出通知', 'Toast Overshoot', '通知滑过头，再弹回原位', ['通知'], ['已保存到草稿'], 0, 3.2, (c, t, x) => {
    const u = spring(seg(t, 0.4, 1.3), 1.6, 4.6);
    const size = fit(c, x.W[0], 760, 46);
    const w = widthOf(c, x.W[0], size) + 170;
    const y = lerp(1150, 690, u);
    rr(c, CX - w / 2, y - 60, w, 120, 60, x.p.card, x.p.line);
    dot(c, CX - w / 2 + 62, y, 22, x.p.ok);
    check(c, CX - w / 2 + 62, y, 28, seg(t, 0.8, 1.2), x.p.on, 5);
    tx(c, x.W[0], CX - w / 2 + 104, y, size, x.p.ink, 'left');
  });
  I('tabs', '标签滑块', 'Tab Pill Glide', '底色胶囊滑到选中的标签', ['切换标签'], ['全部', '图片', '视频', '文件'], 0, 4, (c, t, x) => {
    const words = x.W.slice(0, 4);
    const size = 44;
    const widths = words.map((w) => widthOf(c, clip(w, 6), size) + 90);
    const total = widths.reduce((a, b) => a + b, 0);
    const lefts = [];
    let px = CX - total / 2;
    widths.forEach((w) => {
      lefts.push(px);
      px += w;
    });
    rr(c, CX - total / 2 - 12, CY - 62, total + 24, 124, 62, x.p.card, x.p.line);
    const per = 1;
    const f = t / per;
    const i = Math.floor(f) % words.length;
    const j = (i + 1) % words.length;
    const k = spring(seg(f - Math.floor(f), 0.45, 1), 1.8, 5);
    const pl = lerp(lefts[i], lefts[j], k);
    const pw = lerp(widths[i], widths[j], k);
    rr(c, pl, CY - 50, pw, 100, 50, x.p.ink);
    words.forEach((w, n) => {
      const on = (n === i && k < 0.5) || (n === j && k >= 0.5);
      tx(c, clip(w, 6), lefts[n] + widths[n] / 2, CY, size, on ? x.p.on : x.p.mute);
    });
  });
  I('accordion', '手风琴', 'Accordion Spring', '一行展开，箭头转过去', ['折叠'], ['第一项', '第二项', '第三项', '展开的内容在这里'], 0, 3.8, (c, t, x) => {
    const open = spring(seg(t, 0.8, 1.6), 1.6, 5);
    let y = 300;
    [0, 1, 2].forEach((i) => {
      const extra = i === 1 ? open * 120 : 0;
      rr(c, 560, y, 800, 110 + extra, 22, x.p.card, x.p.line);
      tx(c, clip(x.W[i], 14), 610, y + 55, 44, x.p.ink, 'left');
      at(c, 1305, y + 55, 1, () => {
        ln(c, -14, -7, 0, 7, x.p.mute, 5);
        ln(c, 0, 7, 14, -7, x.p.mute, 5);
      }, i === 1 ? open * Math.PI : 0);
      if (i === 1) alpha(c, seg(t, 1.2, 1.7), () => tx(c, clip(x.W[3], 18), 610, y + 150, 38, x.p.mute, 'left'));
      y += 130 + extra;
    });
  });
  I('dismiss', '拖走卡片', 'Drag to Dismiss', '拖过界线就飞走，没过就弹回', ['划走'], ['这条可以划走', '下一条'], 0, 4.2, (c, t, x) => {
    const drag1 = t < 1.6 ? Math.sin(seg(t, 0.5, 1.6) * Math.PI) * 220 : 0;
    const fly = out(seg(t, 2.6, 3.3)) * 1400;
    const hold = seg(t, 1.9, 2.6) * 340;
    const dx = t < 1.8 ? drag1 : hold + fly;
    const next = spring(seg(t, 2.9, 3.6), 1.2, 5);
    if (next > 0) {
      alpha(c, next, () => {
        rr(c, CX - 380, CY - 110 + (1 - next) * 60, 760, 220, 30, x.p.card, x.p.line);
        tx(c, clip(x.W[1] || '下一条', 14), CX, CY + (1 - next) * 60, 54, x.p.ink);
      });
    }
    rr(c, CX - 380 + dx, CY - 110, 760, 220, 30, x.p.card, x.p.line);
    tx(c, clip(x.W[0], 14), CX + dx, CY, 54, x.p.ink);
    const [mx, my] = [CX + dx + 80, CY + 40];
    if (t < 2.7) cursor(c, mx, my, t > 0.5 ? 1 : 0);
  });
  I('ripple', '水波反馈', 'Ripple Feedback', '从点中的位置荡开一圈', ['点击'], ['确认'], 0, 3, (c, t, x) => {
    const u = seg(t, 1, 1.9);
    c.save();
    rr(c, CX - 300, CY - 100, 600, 200, 40, x.p.card, x.p.line);
    c.beginPath();
    c.roundRect(CX - 300, CY - 100, 600, 200, 40);
    c.clip();
    if (u > 0 && u < 1) alpha(c, 0.32 * (1 - u), () => dot(c, CX + 90, CY + 30, out(u) * 520, x.p.a));
    c.restore();
    tx(c, clip(x.W[0], 8), CX, CY, 60, x.p.ink, 'center', 600);
    const [mx, my] = path(t, [[0, 1400, 860], [0.9, CX + 90, CY + 30]]);
    cursor(c, mx, my, t > 0.95 && t < 1.15 ? 1 : 0);
  });
  I('hold', '长按确认', 'Hold to Confirm', '按住，圆环走满才算数', ['按住', '长按'], ['按住确认', '已确认'], 0, 4, (c, t, x) => {
    const u = seg(t, 0.8, 2.8);
    const done = t > 2.8;
    arc(c, CX, CY, 150, 0, Math.PI * 2, x.p.line, 16);
    arc(c, CX, CY, 150, -Math.PI / 2, -Math.PI / 2 + u * Math.PI * 2, done ? x.p.ok : x.p.a, 16);
    const pop = done ? spring(seg(t, 2.8, 3.3)) : 0;
    if (done) at(c, CX, CY, pop, () => check(c, 0, 0, 120, 1, x.p.ok, 16));
    else dot(c, CX, CY, 96 - u * 10, x.p.card);
    tx(c, done ? x.W[1] || '已确认' : clip(x.W[0], 10), CX, CY + 240, 48, x.p.ink);
    cursor(c, CX + 30, CY + 26, t > 0.8 && !done ? 1 : 0);
  });
  I('rubber', '橡皮筋滑块', 'Rubber-band Slider', '拉过头会拉长，松手弹回', ['拉满'], ['音量'], 0, 3.6, (c, t, x) => {
    const left = 560;
    const w = 800;
    const raw = t < 1.8 ? lerp(0.2, 1.22, io(seg(t, 0.3, 1.8))) : lerp(1.22, 1, spring(seg(t, 2, 2.8)));
    const over = Math.max(0, raw - 1);
    const fill = clamp(raw);
    rr(c, left, CY - 13, w + over * 240, 26, 13, x.p.line);
    rr(c, left, CY - 13, w * fill + over * 240, 26, 13, x.p.a);
    dot(c, left + w * fill + over * 240, CY, 34 - over * 22, x.p.ink);
    tx(c, clip(x.W[0], 10), left, CY - 90, 50, x.p.ink, 'left');
    tx(c, `${Math.round(fill * 100)}%`, left + w, CY - 90, 50, x.p.mute, 'right');
  });
  I('like', '点赞迸发', 'Like Burst', '心弹起来，碎片四散', ['点赞'], ['已喜欢'], 128, 3, (c, t, x) => {
    const u = seg(t, 0.8, 1.5);
    const on = t > 0.8;
    const s = on ? 0.4 + spring(u, 2.4, 5) * 0.6 + 0.0 : 1;
    if (on) {
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const r = out(u) * 250;
        alpha(c, 1 - u, () => dot(c, CX + Math.cos(a) * r, CY - 30 + Math.sin(a) * r, 11 * (1 - u * 0.6), i % 2 ? x.p.a : x.p.b));
      }
    }
    at(c, CX, CY - 30, s, () => heart(c, 0, 20, 150, on ? x.p.a : x.p.line));
    tx(c, Math.round(x.N) + (on ? 1 : 0), CX, CY + 170, 66, x.p.ink, 'center', 600);
  });
  I('trail', '指针拖尾', 'Cursor Trail', '一串点跟在指针后面', ['跟随'], [''], 0, 3.6, (c, t) => {
    const pos = (q) => [CX + Math.cos(q * 1.5) * 520, CY + Math.sin(q * 2.3) * 270];
    for (let i = 16; i >= 0; i--) {
      const [a, b] = pos(t - i * 0.045);
      alpha(c, 1 - i / 17, () => dot(c, a, b, 26 - i * 1.2, i % 2 ? '#FF6A1F' : '#F4F1EA'));
    }
    const [a, b] = pos(t);
    cursor(c, a, b);
  });
  I('push', '实体按键', 'Push Button', '按下去，下边沿真的在', ['按下去'], ['开始'], 0, 3, (c, t, x) => {
    const p = (t % 1.6) > 0.8 && (t % 1.6) < 1.05 ? 1 : 0;
    const k = out(p ? 1 : 0);
    rr(c, CX - 240, CY - 60, 480, 150, 34, '#B8400D');
    rr(c, CX - 240, CY - 90 + k * 26, 480, 150, 34, x.p.a);
    tx(c, clip(x.W[0], 8), CX, CY - 15 + k * 26, 60, x.p.on, 'center', 700);
  });
  I('stars', '星级评分', 'Star Rating', '一颗一颗亮起来', ['评分', '几颗星', '打分'], ['用户评分'], 4, 3.2, (c, t, x) => {
    const n = clamp(Math.round(x.N), 1, 5);
    for (let i = 0; i < 5; i++) {
      const u = seg(t, 0.4 + i * 0.28, 0.9 + i * 0.28);
      const lit = i < n;
      const px = CX + (i - 2) * 170;
      star(c, px, CY - 30, 66, null, x.p.line);
      if (lit && u > 0) at(c, px, CY - 30, spring(u), () => star(c, 0, 0, 68, x.p.a));
    }
    tx(c, clip(x.W[0], 14), CX, CY + 110, 50, x.p.mute);
  });
  I('floatlabel', '浮动标签', 'Floating Label', '占位字升上去变成标题', ['填写'], ['邮箱地址', '正在输入的内容'], 0, 3.4, (c, t, x) => {
    const u = io(seg(t, 0.6, 1.1));
    const typed = head(x.W[1], Math.floor(seg(t, 1.2, 2.6) * [...x.W[1]].length));
    rr(c, 560, CY - 80, 800, 160, 24, x.p.card, u > 0 ? x.p.a : x.p.line, 4);
    tx(c, clip(x.W[0], 12), 610, lerp(CY, CY - 42, u), lerp(50, 32, u), u > 0.5 ? x.p.a : x.p.mute, 'left');
    tx(c, typed, 610, CY + 24, 50, x.p.ink, 'left');
  });
  I('copy', '复制反馈', 'Copy Button', '图标换成对勾，字也换了', ['复制链接'], ['复制链接', '已复制'], 0, 3.2, (c, t, x) => {
    const on = t > 1 && t < 2.6;
    const k = on ? seg(t, 1, 1.25) : t > 2.6 ? 1 - seg(t, 2.6, 2.85) : 0;
    rr(c, CX - 260, CY - 80, 520, 160, 40, x.p.card, on ? x.p.ok : x.p.line, 3);
    alpha(c, 1 - k, () => {
      rr(c, CX - 195, CY - 34, 50, 58, 10, null, x.p.ink, 5);
      rr(c, CX - 178, CY - 18, 50, 58, 10, x.p.card, x.p.ink, 5);
      tx(c, clip(x.W[0], 8), CX - 90, CY, 50, x.p.ink, 'left');
    });
    alpha(c, k, () => {
      check(c, CX - 165, CY, 56, k, x.p.ok, 9);
      tx(c, x.W[1] || '已复制', CX - 90, CY, 50, x.p.ok, 'left');
    });
    const [mx, my] = path(t, [[0, 1300, 800], [0.9, CX + 60, CY + 20]]);
    cursor(c, mx, my);
  });
  I('stepper', '数量加减', 'Quantity Stepper', '每按一下，数字弹一下', ['数量'], ['数量'], 3, 3.4, (c, t, x) => {
    const n = Math.max(1, Math.round(x.N));
    const steps = Math.min(n, 5);
    const f = seg(t, 0.5, 2.6) * steps;
    const i = Math.floor(f);
    const s = i < steps ? 1 + 0.2 * Math.sin(Math.min(1, (f - i) * 3) * Math.PI) : 1;
    rr(c, CX - 300, CY - 90, 600, 180, 90, x.p.card, x.p.line);
    tx(c, '−', CX - 215, CY, 70, x.p.mute);
    tx(c, '+', CX + 215, CY, 70, x.p.ink);
    at(c, CX, CY, s, () => tx(c, n - steps + Math.min(i, steps), 0, 0, 96, x.p.ink, 'center', 700));
    tx(c, clip(x.W[0], 10), CX, CY - 150, 44, x.p.mute);
  });
  I('chips', '筛选标签', 'Choice Chips', '选中时弹一下', ['筛选条件'], ['手机', '电脑', '平板', '耳机'], 0, 3.6, (c, t, x) => {
    const words = x.W.slice(0, 4);
    const widths = words.map((w) => widthOf(c, clip(w, 6), 44) + 90);
    let px = CX - (widths.reduce((a, b) => a + b, 0) + 30 * (words.length - 1)) / 2;
    words.forEach((w, i) => {
      const u = seg(t, 0.6 + i * 0.55, 1.05 + i * 0.55);
      const on = i % 2 === 0 && u > 0;
      const s = on ? 1 + 0.14 * Math.sin(u * Math.PI) : 1;
      at(c, px + widths[i] / 2, CY, s, () => {
        rr(c, -widths[i] / 2, -52, widths[i], 104, 52, on ? x.p.a : x.p.card, on ? null : x.p.line);
        tx(c, clip(w, 6), 0, 0, 44, on ? x.p.on : x.p.ink);
      });
      px += widths[i] + 30;
    });
  });
  I('pin', '验证码', 'PIN Input', '一个数字弹一下，光标往后走', ['验证码'], ['输入验证码'], 2026, 3.6, (c, t, x) => {
    const digits = String(Math.abs(Math.round(x.N))).padStart(4, '0').slice(-6).split('');
    const w = 140;
    const left = CX - (digits.length * (w + 22) - 22) / 2;
    digits.forEach((d, i) => {
      const u = seg(t, 0.5 + i * 0.4, 0.9 + i * 0.4);
      const active = t > 0.5 + i * 0.4 && t < 0.9 + i * 0.4;
      rr(c, left + i * (w + 22), CY - 90, w, 180, 26, x.p.card, active ? x.p.a : x.p.line, 4);
      if (u > 0) at(c, left + i * (w + 22) + w / 2, CY, spring(u), () => tx(c, d, 0, 0, 92, x.p.ink, 'center', 700));
    });
    tx(c, clip(x.W[0], 12), CX, CY - 160, 46, x.p.mute);
  });
  I('password', '密码强度', 'Password Meter', '段落一格格亮，颜色变绿', ['密码', '强度'], ['密码强度'], 0, 3.4, (c, t, x) => {
    const u = seg(t, 0.4, 2.6);
    const n = Math.floor(u * 12);
    rr(c, 560, CY - 110, 800, 120, 22, x.p.card, x.p.line);
    tx(c, '•'.repeat(n), 600, CY - 50, 64, x.p.ink, 'left');
    const color = u < 0.4 ? x.p.bad : u < 0.75 ? '#F5A524' : x.p.ok;
    for (let i = 0; i < 4; i++) {
      const on = u > (i + 0.2) / 4;
      rr(c, 560 + i * 205, CY + 50, 185, 18, 9, on ? color : x.p.line);
    }
    tx(c, clip(x.W[0], 10), 560, CY + 120, 42, x.p.mute, 'left');
  });
  I('ptooltip', '跟随提示', 'Pointer Tooltip', '提示跟着指针慢半拍', ['指到哪'], ['指到哪说到哪'], 0, 3.6, (c, t, x) => {
    const p = (q) => path(q, [[0, 500, 700], [1.2, 1100, 400], [2.4, 700, 450], [3.4, 1300, 700]]);
    const [mx, my] = p(t);
    const [lx, ly] = p(t - 0.14);
    const size = fit(c, x.W[0], 600, 42);
    const w = widthOf(c, x.W[0], size) + 60;
    rr(c, lx + 30, ly - 90, w, 76, 20, x.p.ink);
    tx(c, x.W[0], lx + 30 + w / 2, ly - 52, size, x.p.on);
    cursor(c, mx, my);
  });
  I('swipe', '滑动操作', 'Swipe to Reveal', '往左一拖，操作按钮露出来', ['滑动'], ['这条消息', '删除', '置顶'], 0, 3.6, (c, t, x) => {
    const open = spring(seg(t, 0.7, 1.7), 1.4, 5) * 340;
    rr(c, 1020, CY - 80, 170, 160, 26, x.p.b);
    tx(c, clip(x.W[2] || '置顶', 4), 1105, CY, 42, x.p.on, 'center', 600);
    rr(c, 1200, CY - 80, 170, 160, 26, x.p.bad);
    tx(c, clip(x.W[1] || '删除', 4), 1285, CY, 42, '#fff', 'center', 600);
    rr(c, 550 - open, CY - 80, 820, 160, 26, x.p.card, x.p.line);
    tx(c, clip(x.W[0], 16), 610 - open, CY, 50, x.p.ink, 'left');
    if (t > 0.3 && t < 2) cursor(c, 1200 - open, CY + 20, t > 0.7 ? 1 : 0);
  });
  I('knob', '旋钮', 'Rotary Knob', '转一圈，松手吸到刻度上', ['旋钮'], ['亮度'], 72, 3.6, (c, t, x) => {
    const goal = clamp(x.N, 0, 100) / 100;
    const u = spring(seg(t, 0.4, 2.2), 1.2, 4.6);
    const a = lerp(-Math.PI * 1.25, Math.PI * 0.25, u * goal);
    for (let i = 0; i <= 20; i++) {
      const q = lerp(-Math.PI * 1.25, Math.PI * 0.25, i / 20);
      const on = q <= a;
      ln(c, CX + Math.cos(q) * 195, CY + Math.sin(q) * 195, CX + Math.cos(q) * 225, CY + Math.sin(q) * 225, on ? x.p.a : x.p.line, 6);
    }
    dot(c, CX, CY, 165, x.p.card);
    ln(c, CX + Math.cos(a) * 90, CY + Math.sin(a) * 90, CX + Math.cos(a) * 145, CY + Math.sin(a) * 145, x.p.ink, 12);
    tx(c, Math.round(u * goal * 100), CX, CY - 8, 84, x.p.ink, 'center', 700);
    tx(c, clip(x.W[0], 8), CX, CY + 300, 46, x.p.mute);
  });
  I('reorder', '拖动排序', 'Reorderable List', '拖一项上去，别的让开', ['排序', '排第一'], ['第一项', '第二项', '第三项', '第四项'], 0, 4, (c, t, x) => {
    const items = x.W.slice(0, 4);
    while (items.length < 4) items.push(`第 ${items.length + 1} 项`);
    const u = io(seg(t, 0.8, 2.4));
    const pos = (i) => {
      if (i === 2) return lerp(2, 0, u);
      if (i < 2) return i + seg(u, (1 - i) / 2, (2 - i) / 2);
      return i;
    };
    [0, 1, 3, 2].forEach((i) => {
      const y = 260 + pos(i) * 145;
      const held = i === 2 && t > 0.6 && t < 2.6;
      at(c, CX, y + 58, held ? 1.05 : 1, () => {
        rr(c, -390, -60, 780, 120, 24, held ? x.p.a : x.p.card, x.p.line);
        tx(c, clip(items[i], 16), -340, 0, 46, held ? x.p.on : x.p.ink, 'left');
        for (let k = 0; k < 3; k++) ln(c, 320, -16 + k * 16, 350, -16 + k * 16, held ? x.p.on : x.p.mute, 4);
      });
    });
    if (t > 0.3 && t < 2.8) cursor(c, CX + 300, 260 + pos(2) * 145 + 70, t > 0.6 ? 1 : 0);
  });
  I('search', '展开搜索', 'Expanding Search', '搜索框一下长出来', ['搜索框'], ['搜索全部内容'], 0, 3.4, (c, t, x) => {
    const u = spring(seg(t, 0.5, 1.2), 1.2, 5);
    const w = lerp(150, 980, u);
    rr(c, CX - w / 2, CY - 75, w, 150, 75, x.p.card, u > 0.01 ? x.p.a : x.p.line, 3);
    const ix = CX - w / 2 + 75;
    arc(c, ix - 6, CY - 6, 24, 0, Math.PI * 2, x.p.ink, 7);
    ln(c, ix + 12, CY + 12, ix + 32, CY + 32, x.p.ink, 7);
    const typed = head(x.W[0], Math.floor(seg(t, 1.2, 2.7) * [...x.W[0]].length));
    c.save();
    c.beginPath();
    c.rect(CX - w / 2, CY - 75, w, 150);
    c.clip();
    tx(c, typed, ix + 62, CY, 50, x.p.ink, 'left');
    c.restore();
  });
  I('squish', '压扁按钮', 'Squish Button', '按下压扁，松手弹回', ['压扁'], ['试试看'], 0, 3, (c, t, x) => {
    const f = t % 1.8;
    const d = f > 0.7 && f < 0.95 ? out(seg(f, 0.7, 0.85)) : f >= 0.95 ? 1 - spring(seg(f, 0.95, 1.6), 2.5, 4.5) : 0;
    at(c, CX, CY, 1 + d * 0.1, () => {
      rr(c, -250, -80, 500, 160, 80, x.p.ink);
      tx(c, clip(x.W[0], 8), 0, 0, 56, x.p.on, 'center', 600);
    }, 0, 1 - d * 0.22);
  });
  I('togglepills', '单选胶囊', 'Toggle Pills', '选中的胶囊弹一下', ['选一个'], ['会', '不会', '看情况'], 0, 3.8, (c, t, x) => {
    const words = x.W.slice(0, 3);
    const per = 1.1;
    const i = Math.floor(t / per) % words.length;
    const u = seg(t % per, 0, 0.4);
    words.forEach((w, n) => {
      const px = CX + (n - (words.length - 1) / 2) * 340;
      const on = n === i;
      const s = on ? 1 + 0.12 * Math.sin(u * Math.PI) : 1;
      at(c, px, CY, s, () => {
        rr(c, -150, -70, 300, 140, 70, on ? x.p.a : x.p.card, on ? null : x.p.line);
        tx(c, clip(w, 5), 0, 0, 52, on ? x.p.on : x.p.ink, 'center', on ? 600 : 500);
      });
    });
  });
  I('scrubber', '拖动改数', 'Value Scrubber', '左右拖，数字跟着走', ['拖动'], ['价格'], 5999, 3.4, (c, t, x) => {
    const u = io(seg(t, 0.5, 2.5));
    const v = Math.round(lerp(x.N * 0.2, x.N, u));
    tx(c, clip(x.W[0], 8), CX, CY - 130, 46, x.p.mute);
    tx(c, v.toLocaleString('en-US'), CX, CY, 180, x.p.ink, 'center', 700);
    for (let i = -12; i <= 12; i++) ln(c, CX + i * 40 - (u * 40 * 8) % 40, CY + 130, CX + i * 40 - (u * 40 * 8) % 40, CY + (i % 4 ? 150 : 165), x.p.line, 4);
    ln(c, CX, CY + 115, CX, CY + 180, x.p.a, 6);
    cursor(c, lerp(600, 1320, u), CY + 200, t > 0.5 && t < 2.5 ? 1 : 0);
  });
  I('fab', '扇形菜单', 'Speed-Dial FAB', '加号一转，选项依次弹出', ['更多选项'], ['写文案', '做图表', '剪视频'], 0, 3.2, (c, t, x) => {
    const u = seg(t, 0.8, 1.2);
    const px = CX;
    const py = 800;
    x.W.slice(0, 3).forEach((w, i) => {
      const k = spring(seg(t, 0.9 + i * 0.12, 1.5 + i * 0.12), 1.6, 5);
      if (k <= 0) return;
      const y = py - (i + 1) * 160 * k;
      alpha(c, k, () => {
        dot(c, px, y, 62, x.p.card);
        c.strokeStyle = x.p.line;
        tx(c, clip(w, 8), px + 90, y, 44, x.p.ink, 'left');
      });
    });
    dot(c, px, py, 84, x.p.a);
    at(c, px, py, 1, () => {
      ln(c, -32, 0, 32, 0, x.p.on, 10);
      ln(c, 0, -32, 0, 32, x.p.on, 10);
    }, out(u) * Math.PI * 0.75);
  });
  I('swatch', '选颜色', 'Swatch Picker', '选中的颜色弹起来带个勾', ['配色'], ['选一个颜色'], 0, 3.4, (c, t, x) => {
    const colors = ['#FF6A1F', '#F5C04A', '#3CC765', '#4CC9F0', '#8B6CFF'];
    const pick = Math.floor(seg(t, 0.4, 2.8) * 2.999) + 1;
    colors.forEach((col, i) => {
      const px = CX + (i - 2) * 190;
      const on = i === pick;
      const y = on ? CY - 24 : CY;
      if (on) arc(c, px, y, 92, 0, Math.PI * 2, x.p.ink, 5);
      dot(c, px, y, on ? 76 : 66, col);
      if (on) check(c, px, y, 60, 1, '#0A0A0B', 9);
    });
    tx(c, clip(x.W[0], 12), CX, CY + 150, 46, x.p.mute);
  });
  I('unlock', '滑动解锁', 'Slide to Unlock', '拖过门闩才打开，不到就弹回', ['解锁'], ['滑动解锁', '已解锁'], 0, 4, (c, t, x) => {
    const w = 900;
    const left = CX - w / 2;
    const first = t < 1.6 ? Math.sin(seg(t, 0.4, 1.6) * Math.PI) * 0.4 : 0;
    const second = io(seg(t, 1.8, 2.8));
    const k = t < 1.7 ? first : second;
    const done = t > 2.85;
    rr(c, left, CY - 80, w, 160, 80, done ? x.p.ok : x.p.card, done ? null : x.p.line);
    alpha(c, 1 - k * 1.6, () => tx(c, clip(x.W[0], 10), CX + 40, CY, 50, x.p.mute));
    if (done) alpha(c, seg(t, 2.85, 3.1), () => tx(c, x.W[1] || '已解锁', CX, CY, 54, x.p.on, 'center', 600));
    else {
      const px = left + 80 + k * (w - 160);
      dot(c, px, CY, 66, x.p.ink);
      ln(c, px - 10, CY - 18, px + 10, CY, x.p.on, 7);
      ln(c, px + 10, CY, px - 10, CY + 18, x.p.on, 7);
    }
  });
  I('tags', '标签输入', 'Tag Input', '按回车弹出一个标签', ['加标签'], ['用户', '留存', '增长'], 0, 3.4, (c, t, x) => {
    rr(c, 460, CY - 90, 1000, 180, 26, x.p.card, x.p.line);
    let px = 500;
    x.W.slice(0, 4).forEach((w, i) => {
      const u = seg(t, 0.5 + i * 0.6, 0.9 + i * 0.6);
      const width = widthOf(c, clip(w, 6), 42) + 100;
      if (u > 0) {
        at(c, px + width / 2, CY, spring(u), () => {
          rr(c, -width / 2, -44, width, 88, 44, x.p.a);
          tx(c, `${clip(w, 6)} ×`, 0, 0, 42, x.p.on, 'center', 600);
        });
      }
      px += width + 20;
    });
  });
  I('keycap', '机械键帽', 'Keycap Press', '键帽压到影子上', ['回车', '按键盘'], ['回车'], 0, 3, (c, t, x) => {
    const f = t % 1.5;
    const d = f > 0.6 && f < 0.85 ? 1 : 0;
    const w = Math.max(280, widthOf(c, clip(x.W[0], 6), 64) + 120);
    rr(c, CX - w / 2, CY - 60, w, 180, 30, '#050505');
    rr(c, CX - w / 2, CY - 100 + d * 26, w, 180, 30, '#2A2A2F', '#3A3A40');
    tx(c, clip(x.W[0], 6), CX, CY - 12 + d * 26, 64, '#F4F1EA', 'center', 600);
  });
  I('orbital', '轨道菜单', 'Orbital Action Menu', '选项从中心被甩到周围', ['几个选项'], ['复制', '分享', '编辑', '删除', '收藏'], 0, 3.2, (c, t, x) => {
    const words = x.W.slice(0, 5);
    const n = words.length;
    words.forEach((w, i) => {
      const k = spring(seg(t, 0.6 + i * 0.07, 1.4 + i * 0.07), 1.8, 5);
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2 + t * 0.06;
      const px = CX + Math.cos(a) * 300 * k;
      const py = CY + Math.sin(a) * 300 * k;
      ln(c, CX, CY, px, py, x.p.line, 3);
      dot(c, px, py, 80 * k, x.p.card);
      alpha(c, k, () => tx(c, clip(w, 3), px, py, 40, x.p.ink));
    });
    dot(c, CX, CY, 72, x.p.a);
    dot(c, CX, CY, 20, x.p.on);
  });
  I('dock', '放大程序坞', 'Contextual Dock', '指针附近的图标鼓起来', ['程序坞', '工具栏'], [''], 0, 3.6, (c, t, x) => {
    const n = 7;
    const [mx] = path(t, [[0, 500, 0], [1.6, 1400, 0], [3.2, 760, 0]]);
    let px = CX - 500;
    const sizes = [];
    for (let i = 0; i < n; i++) {
      const base = CX - 420 + i * 140;
      const near = clamp(1 - Math.abs(mx - base) / 260);
      sizes.push(100 + 60 * near ** 2);
    }
    const total = sizes.reduce((a, b) => a + b, 0) + 22 * (n - 1);
    px = CX - total / 2;
    rr(c, px - 26, CY + 40 - 40, total + 52, 190, 50, x.p.card, x.p.line);
    sizes.forEach((s, i) => {
      const hue = ['#FF6A1F', '#F5C04A', '#3CC765', '#4CC9F0', '#8B6CFF', '#FF5A8A', '#F4F1EA'][i];
      rr(c, px, CY + 165 - s, s, s, s * 0.24, hue);
      px += s + 22;
    });
    cursor(c, mx, CY + 130);
  });
  I('inertial', '惯性表盘', 'Inertial Dial', '环转了，指针晚一点才跟上', ['仪表'], ['转速'], 0, 3.6, (c, t, x) => {
    const ring = io(seg(t, 0.3, 1.6)) * Math.PI * 1.5;
    const needle = spring(seg(t, 0.6, 2.8), 1.6, 3.4) * Math.PI * 1.5;
    arc(c, CX, CY, 250, 0, Math.PI * 2, x.p.line, 12);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2 + ring;
      ln(c, CX + Math.cos(a) * 225, CY + Math.sin(a) * 225, CX + Math.cos(a) * 250, CY + Math.sin(a) * 250, i % 6 ? x.p.mute : x.p.ink, 5);
    }
    const a = needle - Math.PI / 2;
    ln(c, CX, CY, CX + Math.cos(a) * 200, CY + Math.sin(a) * 200, x.p.a, 10);
    dot(c, CX, CY, 24, x.p.ink);
    tx(c, clip(x.W[0], 8), CX, CY + 330, 44, x.p.mute);
  });
  I('lasso', '框选', 'Elastic Lasso', '拖一个框，把一群点选中', ['框选', '圈出来'], [''], 0, 3.6, (c, t, x) => {
    const [ax, ay] = [620, 300];
    const [bx, by] = path(t, [[0.4, 620, 300], [2.2, 1240, 760]]);
    for (let i = 0; i < 60; i++) {
      const px = 480 + rnd(i, 1) * 960;
      const py = 200 + rnd(i, 2) * 680;
      const inside = px > ax && px < bx && py > ay && py < by;
      dot(c, px, py, inside ? 13 : 9, inside ? x.p.a : x.p.mute);
    }
    if (t > 0.4) {
      rr(c, ax, ay, bx - ax, by - ay, 14, 'rgba(255,106,31,.12)', x.p.a, 3);
    }
    cursor(c, bx, by, t > 0.4 && t < 2.2 ? 1 : 0);
  });
  I('hoverintent', '停留解锁', 'Hover Intent Gate', '指针停够久，按钮才亮', ['停留'], ['继续'], 0, 3.8, (c, t, x) => {
    const u = seg(t, 1.1, 2.6);
    const on = u >= 1;
    rr(c, CX - 240, CY - 80, 480, 160, 80, on ? x.p.a : x.p.card, x.p.line);
    tx(c, clip(x.W[0], 8), CX, CY, 56, on ? x.p.on : x.p.mute, 'center', 600);
    arc(c, CX, CY, 150, -Math.PI / 2, -Math.PI / 2 + u * Math.PI * 2, x.p.a, 4);
    const [mx, my] = path(t, [[0, 1500, 820], [1, CX + 90, CY + 30]]);
    cursor(c, mx, my);
  });
  I('chord', '组合键', 'Gesture Chord', '按对顺序才启动', ['快捷键'], ['⌘', 'K', '已启动'], 0, 3.6, (c, t, x) => {
    const keys = ['⌘', 'K'];
    keys.forEach((k, i) => {
      const u = seg(t, 0.6 + i * 0.7, 0.9 + i * 0.7);
      const d = u > 0 && u < 1 ? 1 : 0;
      const px = CX + (i - 0.5) * 240;
      rr(c, px - 100, CY - 70, 200, 170, 28, '#050505');
      rr(c, px - 100, CY - 100 + d * 22, 200, 170, 28, u >= 1 ? x.p.a : '#2A2A2F', '#3A3A40');
      tx(c, k, px, CY - 15 + d * 22, 72, u >= 1 ? '#0A0A0B' : '#F4F1EA', 'center', 600);
    });
    alpha(c, seg(t, 2.2, 2.6), () => tx(c, x.W[2] || '已启动', CX, CY + 190, 50, x.p.a));
  });
  I('glasspress', '液态玻璃按下', 'Liquid Glass Press', '磨砂玻璃被按得发亮', ['玻璃按钮'], ['按一下'], 0, 3, (c, t, x) => {
    for (let i = 0; i < 26; i++) ln(c, 300 + i * 52, 220, 300 + i * 52 + 120, 860, i % 3 ? x.p.line : x.p.a, 10);
    const f = t % 1.8;
    const d = f > 0.7 && f < 1 ? 1 : 0;
    at(c, CX, CY, 1 + d * 0.05, () => {
      rr(c, -310, -110, 620, 220, 110, 'rgba(255,255,255,.16)', 'rgba(255,255,255,.5)', 2);
      const g = c.createLinearGradient(0, -110, 0, 110);
      g.addColorStop(0, 'rgba(255,255,255,.35)');
      g.addColorStop(0.5, 'rgba(255,255,255,0)');
      rr(c, -304, -104, 608, 208, 104, g);
      glow(c, 90, -30, 170, '#FFFFFF', d ? 0.5 : 0.15);
      tx(c, clip(x.W[0], 8), 0, 0, 60, '#FFFFFF', 'center', 600);
    });
  });
  I('bento', '便当格聚焦', 'Bento Expand', '一格放大，别的退后', ['几个方面'], ['用户', '数据', '模型', '成本'], 0, 3.8, (c, t, x) => {
    const f = Math.floor(t / 1.2) % 4;
    const words = x.W.slice(0, 4);
    words.forEach((w, i) => {
      const col = i % 2;
      const row = i >> 1;
      const on = i === f;
      const u = spring(seg(t % 1.2, 0, 0.5), 1.4, 5);
      const s = on ? 1 + 0.08 * u : 1;
      alpha(c, on ? 1 : 0.42, () => at(c, 660 + col * 600, 330 + row * 420 - 0, s, () => {
        rr(c, -285, -195, 570, 390, 34, x.p.card, on ? x.p.a : x.p.line, 3);
        tx(c, clip(w, 8), 0, 0, 62, x.p.ink, 'center', 600);
      }));
    });
  });
  I('snaprail', '吸附选择', 'Snap Rail', '底色胶囊弹到指针那一项', ['选项'], ['今天', '本周', '本月', '全年'], 0, 3.8, (c, t, x) => {
    const words = x.W.slice(0, 4);
    const w = 280;
    const left = CX - (words.length * w) / 2;
    const f = t / 1.1;
    const i = Math.floor(f) % words.length;
    const j = (i + 1) % words.length;
    const k = spring(seg(f - Math.floor(f), 0.5, 1), 1.6, 5);
    rr(c, left + lerp(i, j, k) * w + 10, CY - 56, w - 20, 112, 56, x.p.a);
    words.forEach((word, n) => tx(c, clip(word, 5), left + n * w + w / 2, CY, 46, x.p.ink));
    cursor(c, left + lerp(i, j, io(seg(f - Math.floor(f), 0.3, 0.7))) * w + w / 2 + 40, CY + 60);
  });
  I('xypad', '双轴面板', 'Kinetic XY Pad', '圆点跟着指针，松手弹回中心', ['坐标'], ['速度', '力度'], 0, 3.8, (c, t, x) => {
    rr(c, CX - 330, 210, 660, 660, 36, x.p.card, x.p.line);
    ln(c, CX, 230, CX, 850, x.p.line, 2);
    ln(c, CX - 310, CY, CX + 310, CY, x.p.line, 2);
    const [mx, my] = path(t, [[0, CX, CY], [0.9, CX + 220, CY - 180], [1.8, CX - 170, CY + 200], [2.3, CX + 90, CY - 60]]);
    const back = t > 2.4 ? spring(seg(t, 2.4, 3.3), 2, 4.5) : 0;
    const [px, py] = [lerp(mx, CX, back), lerp(my, CY, back)];
    dot(c, px, py, 44, x.p.a);
    if (t < 2.4) cursor(c, mx + 30, my + 30, 1);
    tx(c, clip(x.W[0], 6), CX + 310, CY - 30, 34, x.p.mute, 'right');
    tx(c, clip(x.W[1] || '', 6), CX + 16, 250, 34, x.p.mute, 'left');
  });
  I('cmdk', '命令面板', 'Command Palette Bloom', '小按钮展开成一列操作', ['命令面板'], ['搜索命令', '新建分镜', '导出全片', '接入 AI'], 0, 3.4, (c, t, x) => {
    const u = spring(seg(t, 0.6, 1.3), 1, 5);
    const w = lerp(280, 900, u);
    const h = lerp(110, 520, u);
    rr(c, CX - w / 2, 240, w, h, 34, x.p.card, x.p.line);
    tx(c, clip(x.W[0], 14), CX - w / 2 + 50, 295, 44, x.p.mute, 'left');
    x.W.slice(1, 4).forEach((word, i) => {
      const k = seg(t, 1 + i * 0.14, 1.4 + i * 0.14);
      alpha(c, k, () => {
        const y = 400 + i * 115 + (1 - k) * 24;
        if (i === 0) rr(c, CX - w / 2 + 24, y - 50, w - 48, 100, 22, x.p.line);
        tx(c, clip(word, 14), CX - w / 2 + 60, y, 46, x.p.ink, 'left');
      });
    });
  });
  I('picker', '滚轮选择', 'Momentum Picker', '滚轮带着惯性停到下一格', ['滚轮'], ['2023', '2024', '2025', '2026', '2027'], 0, 3.6, (c, t, x) => {
    const words = x.W;
    const f = spring(seg(t, 0.4, 2.6), 0.6, 3.6) * (words.length - 1);
    rr(c, CX - 280, CY - 62, 560, 124, 22, x.p.line);
    words.forEach((w, i) => {
      const d = i - f;
      if (Math.abs(d) > 2.6) return;
      alpha(c, 1 - Math.abs(d) * 0.35, () => tx(c, clip(w, 10), CX, CY + d * 125, 62 - Math.abs(d) * 8, Math.abs(d) < 0.5 ? x.p.ink : x.p.mute, 'center', 600));
    });
  });
  I('prompt', 'AI 输入框', 'Prompt Composer', '字打进去，框跟着长，然后发送', ['问 AI', '问AI', '提问'], ['附近哪家咖啡馆有手冲？'], 0, 4.6, (c, t, x) => {
    const full = x.lineFull;
    const n = Math.floor(seg(t, 0.4, 2.8) * [...full].length);
    const typed = head(full, n);
    const size = 46;
    const wrap = D.wrapText(typed || ' ', 860, size, size, 5);
    const h = Math.max(1, wrap.lines.length) * size * 1.36 + 120;
    const send = t > 3;
    rr(c, 480, CY + 150 - h, 960, h, 38, x.p.card, x.p.line);
    wrap.lines.forEach((l, i) => tx(c, l, 530, CY + 150 - h + 60 + i * size * 1.36, size, x.p.ink, 'left'));
    const bx = 1370;
    const by = CY + 150 - 56;
    dot(c, bx, by, 38, n > 0 ? x.p.a : x.p.line);
    if (send) rr(c, bx - 12, by - 12, 24, 24, 5, x.p.on);
    else {
      ln(c, bx, by + 16, bx, by - 14, x.p.on, 6);
      ln(c, bx - 14, by, bx, by - 14, x.p.on, 6);
      ln(c, bx + 14, by, bx, by - 14, x.p.on, 6);
    }
    if (send) arc(c, bx, by, 50, t * 6, t * 6 + 1.6, x.p.a, 5);
  });
  I('filmstrip', '胶片定位', 'Filmstrip Scrubber', '播放头吸到最近的一帧', ['胶片', '逐帧'], [''], 0, 3.6, (c, t, x) => {
    const n = 8;
    const w = 150;
    const left = CX - (n * w) / 2;
    const raw = (Math.sin(t * 1.4 - 1.5) * 0.5 + 0.5) * (n - 1);
    const snapped = lerp(Math.floor(raw), Math.round(raw), clamp((raw % 1) * 2));
    for (let i = 0; i < n; i++) {
      const on = i === Math.round(raw);
      rr(c, left + i * w + 6, CY - 80, w - 12, 160, 12, on ? x.p.a : x.p.card, x.p.line);
      tx(c, i + 1, left + i * w + w / 2, CY, 44, on ? x.p.on : x.p.mute);
    }
    const px = left + snapped * w + w / 2;
    ln(c, px, CY - 120, px, CY + 120, x.p.ink, 6);
    dot(c, px, CY - 120, 14, x.p.ink);
  });
  I('collect', '收拢成堆', 'Drag Stack Collect', '散落的卡片被收成一摞', ['收拢', '汇总'], ['调研', '数据', '报告', '访谈', '问卷'], 0, 3.6, (c, t, x) => {
    const words = x.W.slice(0, 5);
    const u = io(seg(t, 0.9, 2.2));
    words.forEach((w, i) => {
      const a = (i / words.length) * Math.PI * 2 + 0.6;
      const px = lerp(CX + Math.cos(a) * 560, CX + i * 10 - 20, u);
      const py = lerp(CY + Math.sin(a) * 300, CY - i * 8, u);
      at(c, px, py, 1, () => {
        rr(c, -150, -95, 300, 190, 22, x.p.card, x.p.line);
        tx(c, clip(w, 5), 0, 0, 46, x.p.ink);
      }, lerp(rnd(i) * 0.4 - 0.2, (i - 2) * 0.05, u));
    });
    cursor(c, CX + 120, CY + 70, u > 0 && u < 1 ? 1 : 0);
  });
  I('focusrelay', '焦点接力', 'Focus Relay', '一个光圈在几个输入框间跳', ['下一个'], ['姓名', '电话', '地址'], 0, 3.6, (c, t, x) => {
    const words = x.W.slice(0, 3);
    const ys = words.map((_, i) => 340 + i * 180);
    const f = t / 1.1;
    const i = Math.floor(f) % words.length;
    const j = (i + 1) % words.length;
    const k = spring(seg(f - Math.floor(f), 0.5, 1), 1.6, 5);
    words.forEach((w, n) => {
      rr(c, 580, ys[n] - 65, 760, 130, 24, x.p.card, x.p.line);
      tx(c, clip(w, 12), 630, ys[n], 44, n === i ? x.p.ink : x.p.mute, 'left');
    });
    rr(c, 570, lerp(ys[i], ys[j], k) - 75, 780, 150, 30, null, x.p.a, 6);
  });
  I('holdtalk', '按住说话', 'Hold to Talk', '按住时波形长出来，松手发出去', ['语音输入', '按住说话'], ['帮我写一段文案'], 0, 4, (c, t, x) => {
    const holding = t > 0.6 && t < 2.8;
    const u = holding ? seg(t, 0.6, 1) : 1 - seg(t, 2.8, 3.1);
    for (let i = 0; i < 25; i++) {
      const h = (20 + 110 * Math.abs(Math.sin(t * 6 + i * 0.8) * Math.sin(i * 0.5 + 1))) * u;
      rr(c, CX - 400 + i * 33, CY - 110 - h / 2, 16, h + 4, 8, x.p.a);
    }
    dot(c, CX, CY + 110, holding ? 92 : 80, holding ? x.p.a : x.p.card);
    rr(c, CX - 20, CY + 72, 40, 64, 20, holding ? x.p.on : x.p.ink);
    alpha(c, seg(t, 3, 3.3), () => {
      const size = fit(c, x.W[0], 800, 46);
      const w = widthOf(c, x.W[0], size) + 70;
      rr(c, CX - w / 2, CY - 170, w, 110, 40, x.p.a);
      tx(c, x.W[0], CX, CY - 115, size, x.p.on, 'center', 600);
    });
  });
  I('lattice', '吸附网格', 'Lattice Snap', '方块跟手，松手吸到格子上', ['网格'], [''], 0, 3.6, (c, t, x) => {
    const cell = 150;
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) rr(c, CX - 375 + i * cell + 8, CY - 300 + j * cell + 8, cell - 16, cell - 16, 16, null, x.p.line);
    const [mx, my] = path(t, [[0, CX - 300, CY - 225], [1.2, CX + 130, CY + 60], [2.2, CX + 240, CY - 110]]);
    const gx = CX - 300 + Math.round((mx - (CX - 300)) / cell) * cell;
    const gy = CY - 225 + Math.round((my - (CY - 225)) / cell) * cell;
    const k = t > 2.3 ? spring(seg(t, 2.3, 3), 2, 5) : 0;
    rr(c, lerp(mx, gx, k) - 66, lerp(my, gy, k) - 66, 132, 132, 18, x.p.a);
    if (t < 2.3) cursor(c, mx + 30, my + 30, 1);
  });
  I('velocity', '速度拉伸', 'Velocity Button', '移动越快，按钮拉得越长', ['越来越快'], ['立即开始'], 0, 3.4, (c, t, x) => {
    const q = (v) => CX + Math.sin(v * 1.8) * 420;
    const px = q(t);
    const speed = Math.abs(q(t + 0.02) - q(t - 0.02)) / 0.04;
    const stretch = 1 + clamp(speed / 900) * 0.5;
    at(c, px, CY, stretch, () => {
      rr(c, -220, -70, 440, 140, 70, x.p.a);
    }, 0, 1 / Math.sqrt(stretch));
    tx(c, clip(x.W[0], 8), px, CY, 50, x.p.on, 'center', 600);
  });
  I('directional', '方向填充', 'Directional Hover', '填充从指针进来的那条边进来', ['从左边'], ['查看详情'], 0, 3.6, (c, t, x) => {
    const f = t % 1.8;
    const from = Math.floor(t / 1.8) % 2 ? 1 : -1;
    const u = io(seg(f, 0.2, 0.8)) * (1 - io(seg(f, 1.2, 1.7)));
    c.save();
    c.beginPath();
    c.roundRect(CX - 340, CY - 110, 680, 220, 32);
    c.clip();
    c.fillStyle = x.p.card;
    c.fillRect(CX - 340, CY - 110, 680, 220);
    c.fillStyle = x.p.a;
    const w = 680 * u;
    c.fillRect(from < 0 ? CX - 340 : CX + 340 - w, CY - 110, w, 220);
    c.restore();
    tx(c, clip(x.W[0], 10), CX, CY, 60, u > 0.5 ? x.p.on : x.p.ink, 'center', 600);
    cursor(c, from < 0 ? lerp(CX - 460, CX - 100, u) : lerp(CX + 460, CX + 100, u), CY + 40);
  });
  I('compass', '手势罗盘', 'Gesture Compass', '从中心往哪拖，就选哪个', ['往哪走'], ['左转', '前进', '右转', '后退'], 0, 3.6, (c, t, x) => {
    const words = x.W.slice(0, 4);
    const pts = [[-1, 0], [0, -1], [1, 0], [0, 1]];
    const [mx, my] = path(t, [[0.4, CX, CY], [1.6, CX + 230, CY]]);
    pts.forEach(([a, b], i) => {
      const on = i === 2 && t > 1.3;
      dot(c, CX + a * 300, CY + b * 300, on ? 100 : 86, on ? x.p.a : x.p.card);
      tx(c, clip(words[i], 3), CX + a * 300, CY + b * 300, 40, on ? x.p.on : x.p.ink, 'center', 600);
    });
    ln(c, CX, CY, mx, my, x.p.a, 8);
    dot(c, CX, CY, 34, x.p.ink);
    dot(c, mx, my, 26, x.p.a);
    if (t < 2.2) cursor(c, mx + 20, my + 20, 1);
  });

  // ================= 状态 =================
  S('scramble', '乱码揭晓', 'Scramble Reveal', '乱字跳动，从左往右定下来', ['揭晓答案'], ['答案是九成九'], 0, 3, (c, t, x) => {
    const letters = [...x.W[0]];
    const noise = '有无是否真假对错一二三零百千万亿#%&*';
    const size = fit(c, x.W[0], 1500, 110, 40, 700);
    const out2 = letters.map((ch, i) => (t > 0.3 + i * (1.5 / letters.length) ? ch : [...noise][Math.floor(rnd(i, Math.floor(t * 18)) * [...noise].length)])).join('');
    tx(c, out2, CX, CY, size, x.p.ink, 'center', 700);
  });
  S('marquee', '惯性跑马灯', 'Momentum Marquee', '一直滚，中途放慢再走', ['跑起来'], ['用户', '数据', '增长', '留存', '转化'], 0, 4, (c, t, x) => {
    const words = x.W.concat(x.W).concat(x.W);
    const speed = (q) => q * 260 - Math.sin(q * 1.4) * 130;
    const off = speed(t);
    let total = 0;
    const widths = words.map((w) => widthOf(c, clip(w, 8), 86, 600) + 110);
    widths.forEach((w) => (total += w));
    let px = -(off % (total / 3));
    for (let k = 0; k < 2; k++) {
      words.forEach((w, i) => {
        tx(c, clip(w, 8), px, CY, 86, i % 2 ? x.p.mute : x.p.ink, 'left', 600);
        dot(c, px + widths[i] - 55, CY, 8, x.p.a);
        px += widths[i];
      });
    }
  });
  S('stagger', '依次出现', 'Stagger Entrance', '一行行升上来', ['依次', '一个接一个'], ['第一', '第二', '第三', '第四'], 0, 2.8, (c, t, x) => {
    const words = x.W.slice(0, 5);
    words.forEach((w, i) => {
      const u = out(seg(t, 0.2 + i * 0.16, 0.8 + i * 0.16));
      const y = CY + (i - (words.length - 1) / 2) * 130 + (1 - u) * 50;
      alpha(c, u, () => {
        rr(c, 560, y - 52, 800, 104, 22, x.p.card, x.p.line);
        dot(c, 615, y, 12, x.p.a);
        tx(c, clip(w, 16), 650, y, 44, x.p.ink, 'left');
      });
    });
  });
  S('iconswap', '图标变形', 'Icon Morph Swap', '旧图标转走，新图标落定', ['切换'], ['已开启'], 0, 2.8, (c, t, x) => {
    const u = seg(t, 0.9, 1.5);
    alpha(c, 1 - u, () => at(c, CX, CY - 40, 1 - u * 0.5, () => {
      arc(c, 0, 0, 96, 0, Math.PI * 2, x.p.mute, 14);
      ln(c, -68, -68, 68, 68, x.p.mute, 14);
    }, u * 2));
    alpha(c, u, () => at(c, CX, CY - 40, 0.5 + spring(u) * 0.5, () => {
      dot(c, 0, 0, 104, x.p.ok);
      check(c, 0, 0, 110, 1, x.p.on, 15);
    }, (1 - u) * -1));
    tx(c, clip(x.W[0], 10), CX, CY + 130, 52, x.p.ink);
  });
  S('underline', '下划线', 'Underline Draw', '线从左画到右', ['强调这句'], ['这才是重点'], 0, 2.6, (c, t, x) => {
    const size = fit(c, x.W[0], 1500, 110, 44, 700);
    const w = widthOf(c, x.W[0], size, 700);
    tx(c, x.W[0], CX, CY - 20, size, x.p.ink, 'center', 700);
    rr(c, CX - w / 2, CY + size * 0.58, w * io(seg(t, 0.5, 1.2)), 14, 7, x.p.a);
  });
  S('elasticbar', '弹性进度条', 'Elastic Progress', '冲过目标一点，再回来', ['进度条'], ['完成进度'], 72, 3, (c, t, x) => {
    const goal = clamp(x.N / 100);
    const u = spring(seg(t, 0.3, 1.7), 1.3, 4.4);
    rr(c, 460, CY - 26, 1000, 52, 26, x.p.line);
    rr(c, 460, CY - 26, 1000 * goal * u, 52, 26, x.p.a);
    tx(c, clip(x.W[0], 14), 460, CY - 90, 48, x.p.mute, 'left');
    tx(c, `${Math.round(x.N * Math.min(1, u))}%`, 1460, CY - 95, 72, x.p.ink, 'right', 700);
  });
  S('delaytip', '延迟提示', 'Delayed Tooltip', '停一会儿才出现，走开马上消失', ['悬停提示'], ['放这里', '停一下才出现'], 0, 3.4, (c, t, x) => {
    const in1 = seg(t, 1.3, 1.5);
    const gone = t > 2.8;
    rr(c, CX - 170, CY - 50, 340, 100, 50, x.p.card, x.p.line);
    tx(c, clip(x.W[0], 6), CX, CY, 46, x.p.ink);
    if (!gone) {
      alpha(c, in1, () => {
        const w = widthOf(c, x.W[1] || '', 40) + 60;
        rr(c, CX - w / 2, CY - 170, w, 84, 20, x.p.ink);
        tx(c, x.W[1] || '', CX, CY - 128, 40, x.p.on);
      });
    }
    const [mx, my] = path(t, [[0, 1400, 800], [0.8, CX + 30, CY + 15], [2.7, CX + 30, CY + 15], [3.1, 1400, 820]]);
    cursor(c, mx, my);
  });
  S('switch', '弹簧开关', 'Switch Spring', '圆钮冲过头再回来', ['打开开关'], ['联网搜索'], 0, 2.8, (c, t, x) => {
    const u = spring(seg(t, 0.8, 1.5), 2, 4.6);
    const stretch = 1 + Math.sin(clamp(seg(t, 0.8, 1.1)) * Math.PI) * 0.3;
    rr(c, CX - 170, CY - 90, 340, 180, 90, u > 0.5 ? x.p.a : x.p.line);
    at(c, lerp(CX - 80, CX + 80, u), CY, stretch, () => dot(c, 0, 0, 72, x.p.ink), 0, 1 / stretch);
    tx(c, clip(x.W[0], 12), CX, CY + 170, 52, x.p.ink);
  });
  S('checkbox', '勾选框', 'Checkbox Draw', '对勾一笔画出来', ['勾上', '打钩'], ['我已阅读并同意'], 0, 2.6, (c, t, x) => {
    const u = seg(t, 0.8, 1.3);
    const size = fit(c, x.W[0], 900, 56);
    const w = widthOf(c, x.W[0], size) + 170;
    const left = CX - w / 2;
    rr(c, left, CY - 55, 110, 110, 24, u > 0 ? x.p.a : null, u > 0 ? null : x.p.mute, 6);
    check(c, left + 55, CY, 76, u, x.p.on, 11);
    tx(c, x.W[0], left + 150, CY, size, x.p.ink, 'left');
  });
  S('typewriter', '打字删字', 'Typewriter', '打一句删一句，光标在闪', ['一句一句'], ['写一份方案', '改一下文案', '出一个大纲'], 0, 4.8, (c, t, x) => {
    const words = x.W.slice(0, 3);
    const per = 2.2;
    const i = Math.floor(t / per) % words.length;
    const f = (t % per) / per;
    const letters = [...words[i]];
    const n = f < 0.5 ? Math.ceil((f / 0.5) * letters.length) : f < 0.8 ? letters.length : Math.ceil(((1 - f) / 0.2) * letters.length);
    const s = letters.slice(0, n).join('');
    const size = fit(c, words[i], 1400, 96, 40, 600);
    const w = widthOf(c, s, size, 600);
    tx(c, s, CX - widthOf(c, words[i], size, 600) / 2, CY, size, x.p.ink, 'left', 600);
    if (Math.floor(t * 2.4) % 2 === 0) rr(c, CX - widthOf(c, words[i], size, 600) / 2 + w + 8, CY - size * 0.55, 8, size * 1.1, 2, x.p.a);
  });
  S('odometer', '里程表', 'Odometer Count-up', '从 0 滚到目标数', ['累计'], ['位用户'], 5000, 2.8, (c, t, x) => {
    const v = Math.round(x.N * io(seg(t, 0.2, 2)));
    const digits = String(Math.round(x.N)).length;
    const shown = String(v).padStart(digits, '0').split('');
    const w = Math.min(170, 1300 / digits);
    shown.forEach((d, i) => {
      const px = CX + (i - (digits - 1) / 2) * w;
      rr(c, px - w * 0.44, CY - 150, w * 0.88, 230, 20, x.p.card, x.p.line);
      tx(c, d, px, CY - 35, w * 1.05, x.p.ink, 'center', 700);
    });
    tx(c, clip(x.W[0], 14), CX, CY + 170, 54, x.p.mute);
  });
  S('statuspill', '状态胶囊', 'Status Pill', '等待、加载、完成，一个胶囊变三次', ['状态'], ['待发送', '发送中', '已送达'], 0, 3.6, (c, t, x) => {
    const words = x.W.length ? x.W : [''];
    const s = t < 1 ? 0 : t < 2.2 ? 1 : 2;
    const u = spring(seg(t, s === 2 ? 2.2 : 1, s === 2 ? 2.7 : 1.5), 1.2, 5);
    const label = clip(words[Math.min(s, words.length - 1)], 8);
    const w = widthOf(c, label, 54, 600) + 170;
    const color = s === 0 ? x.p.card : s === 1 ? x.p.b : x.p.ok;
    at(c, CX, CY, s ? 0.94 + u * 0.06 : 1, () => {
      rr(c, -w / 2, -80, w, 160, 80, color, s ? null : x.p.line);
      const ink = s ? x.p.on : x.p.ink;
      if (s === 1) arc(c, -w / 2 + 75, 0, 24, t * 7, t * 7 + 4, ink, 7);
      else if (s === 2) check(c, -w / 2 + 75, 0, 44, u, ink, 8);
      else dot(c, -w / 2 + 75, 0, 13, x.p.mute);
      tx(c, label, -w / 2 + 120, 0, 54, ink, 'left', 600);
    });
  });
  S('pulsebadge', '脉冲红点', 'Pulse Badge', '红点一圈圈往外扩', ['新消息', '提醒'], [''], 0, 3, (c, t, x) => {
    for (let i = 0; i < 3; i++) {
      const u = ((t + i * 0.6) % 1.8) / 1.8;
      alpha(c, 1 - u, () => arc(c, CX, CY, 40 + u * 260, 0, Math.PI * 2, x.p.a, 7));
    }
    dot(c, CX, CY, 56, x.p.a);
  });
  S('successcheck', '完成动画', 'Success Check', '圆圈和对勾自己画出来', ['搞定了', '任务完成'], ['完成'], 0, 2.6, (c, t, x) => {
    const a = io(seg(t, 0.2, 1));
    arc(c, CX, CY - 40, 130, -Math.PI / 2, -Math.PI / 2 + a * Math.PI * 2, x.p.ok, 16);
    check(c, CX, CY - 40, 130, seg(t, 0.9, 1.4), x.p.ok, 18);
    alpha(c, seg(t, 1.2, 1.6), () => tx(c, clip(x.W[0], 12), CX, CY + 160, 56, x.p.ink, 'center', 600));
  });
  S('segmentload', '分段加载', 'Segment Loader', '一段接一段填满', ['分几步'], ['正在生成'], 0, 3, (c, t, x) => {
    const n = 8;
    const u = seg(t, 0.2, 2.4) * n;
    for (let i = 0; i < n; i++) {
      const k = spring(clamp(u - i), 1, 5);
      rr(c, 470 + i * 125, CY - 44, 105, 88, 14, x.p.line);
      if (k > 0) rr(c, 470 + i * 125, CY - 44, 105 * Math.min(1, k), 88, 14, x.p.a);
    }
    tx(c, clip(x.W[0], 12), CX, CY - 120, 48, x.p.mute);
  });
  S('orbitspin', '轨道转圈', 'Orbit Spinner', '两段弧反着转', ['运行中'], ['正在运行'], 0, 2.6, (c, t, x) => {
    arc(c, CX, CY - 30, 130, t * 5, t * 5 + 2.1, x.p.a, 14);
    arc(c, CX, CY - 30, 92, -t * 4, -t * 4 + 2.1, x.p.ink, 14);
    tx(c, clip(x.W[0], 12), CX, CY + 170, 50, x.p.mute);
  });
  S('ring', '进度环', 'Progress Ring', '圆环走到目标值', ['占比'], ['占比'], 86, 2.8, (c, t, x) => {
    const goal = clamp(x.N / 100);
    const u = io(seg(t, 0.2, 1.8));
    arc(c, CX, CY - 20, 250, 0, Math.PI * 2, x.p.line, 44);
    arc(c, CX, CY - 20, 250, -Math.PI / 2, -Math.PI / 2 + u * goal * Math.PI * 2, x.p.a, 44);
    tx(c, `${Math.round(x.N * u)}%`, CX, CY - 40, 130, x.p.ink, 'center', 700);
    tx(c, clip(x.W[0], 8), CX, CY + 60, 46, x.p.mute);
  });
  S('notify', '顶部通知', 'Notification Slide-in', '从顶上落下来，弹一下停住', ['弹窗'], ['你有一条新消息', '刚刚'], 0, 3, (c, t, x) => {
    const u = spring(seg(t, 0.3, 1.2), 1.6, 4.8);
    const y = lerp(-180, 400, u);
    rr(c, 460, y - 95, 1000, 190, 44, x.p.card, x.p.line);
    rr(c, 500, y - 55, 110, 110, 26, x.p.a);
    tx(c, clip(x.W[0], 18), 640, y - 22, 46, x.p.ink, 'left', 600);
    tx(c, clip(x.W[1] || '刚刚', 20), 640, y + 36, 36, x.p.mute, 'left');
  });
  S('steps', '步骤条', 'Step Progress', '连线走过去，下一个点亮起', ['分三步', '三个步骤'], ['提问', '思考', '回答', '复查'], 0, 3.6, (c, t, x) => {
    const words = x.W.slice(0, 4);
    const left = 460;
    const gap = 1000 / Math.max(1, words.length - 1);
    const last = Math.max(1, words.length - 1);
    const u = seg(t, 0.4, 3) * (last + 0.4);
    ln(c, left, CY, left + gap * last, CY, x.p.line, 12);
    ln(c, left, CY, left + gap * Math.min(u, last), CY, x.p.a, 12);
    words.forEach((w, i) => {
      const on = u >= i;
      const k = on ? spring(seg(u, i, i + 0.4)) : 0;
      dot(c, left + i * gap, CY, 40, x.p.card);
      if (on) dot(c, left + i * gap, CY, 40 * k, x.p.a);
      tx(c, i + 1, left + i * gap, CY, 40, on ? x.p.on : x.p.mute, 'center', 700);
      tx(c, clip(w, 6), left + i * gap, CY + 100, 58, on ? x.p.ink : x.p.mute, 'center', 600);
    });
  });
  S('snackbar', '限时撤销', 'Undo Snackbar', '进度条走完就撤不回了', ['撤销', '撤回'], ['已删除一条记录', '撤销'], 0, 3.6, (c, t, x) => {
    const u = spring(seg(t, 0.2, 0.9), 1.2, 5);
    const y = lerp(1100, 680, u);
    rr(c, 480, y - 70, 960, 140, 28, x.p.card, x.p.line);
    tx(c, clip(x.W[0], 16), 530, y, 44, x.p.ink, 'left');
    tx(c, clip(x.W[1] || '撤销', 4), 1390, y, 44, x.p.a, 'right', 600);
    rr(c, 480, y + 60, 960 * (1 - seg(t, 0.8, 3.4)), 10, 5, x.p.a);
  });
  S('submit', '提交状态', 'Submit States', '字变成跳动的点，再变成勾', ['提交', '发送'], ['提交'], 0, 3.2, (c, t, x) => {
    const w = t < 0.8 ? 460 : t < 1 ? lerp(460, 180, seg(t, 0.8, 1)) : t < 2.2 ? 180 : 180;
    const done = t > 2.2;
    rr(c, CX - w / 2, CY - 90, w, 180, 90, done ? x.p.ok : x.p.a);
    if (t < 0.8) tx(c, clip(x.W[0], 6), CX, CY, 60, x.p.on, 'center', 600);
    else if (!done) for (let i = 0; i < 3; i++) dot(c, CX + (i - 1) * 40, CY - Math.max(0, Math.sin(t * 7 - i)) * 22, 13, x.p.on);
    else check(c, CX, CY, 84, seg(t, 2.2, 2.6), x.p.on, 12);
  });
  S('countdown', '倒计时环', 'Countdown Ring', '圆环一秒一秒退', ['倒计时', '还剩'], ['秒'], 10, 3.4, (c, t, x) => {
    const n = Math.max(1, Math.round(x.N));
    const u = seg(t, 0.2, 3.2);
    arc(c, CX, CY, 230, 0, Math.PI * 2, x.p.line, 30);
    arc(c, CX, CY, 230, -Math.PI / 2, -Math.PI / 2 + (1 - u) * Math.PI * 2, x.p.a, 30);
    tx(c, Math.ceil(n * (1 - u)), CX, CY - 20, 150, x.p.ink, 'center', 700);
    tx(c, clip(x.W[0], 6), CX, CY + 90, 44, x.p.mute);
  });
  S('skeleton2content', '骨架变内容', 'Skeleton to Content', '占位条闪一会儿，真内容出来', ['加载出来'], ['这就是 AI 给的答案', '只要等几秒'], 0, 3.4, (c, t, x) => {
    const u = seg(t, 1.9, 2.3);
    alpha(c, 1 - u, () => {
      const sweep = ((t * 700) % 1600) + 200;
      [0, 1, 2].forEach((i) => {
        const y = 380 + i * 110;
        const w = [820, 640, 720][i];
        const g = c.createLinearGradient(sweep - 200, 0, sweep + 200, 0);
        g.addColorStop(0, x.p.card);
        g.addColorStop(0.5, x.p.line);
        g.addColorStop(1, x.p.card);
        rr(c, 550, y, w, 64, 16, g);
      });
    });
    alpha(c, u, () => {
      tx(c, clip(x.W[0], 16), 550, 430, 70, x.p.ink, 'left', 700);
      tx(c, clip(x.W[1] || '', 20), 550, 560, 46, x.p.mute, 'left');
    });
  });
  S('toaststack', '通知堆叠', 'Toast Stack', '一条条叠上去，再依次消失', ['一条接一条', '接连'], ['第一条消息', '又来一条', '还有一条'], 0, 3.8, (c, t, x) => {
    x.W.slice(0, 3).forEach((w, i) => {
      const u = spring(seg(t, 0.3 + i * 0.55, 0.9 + i * 0.55), 1.2, 5);
      const gone = i === 2 ? 0 : seg(t, 2.6 + i * 0.3, 3 + i * 0.3);
      const y = 680 - i * 130 + (1 - u) * 160;
      alpha(c, u * (1 - gone), () => {
        rr(c, 560 + gone * 90, y - 56, 800, 112, 30, x.p.card, x.p.line);
        dot(c, 615 + gone * 90, y, 14, x.p.a);
        tx(c, clip(w, 16), 650 + gone * 90, y, 42, x.p.ink, 'left');
      });
    });
  });
  S('indeterminate', '无限进度条', 'Indeterminate Bar', '不知道要多久，就来回跑', ['不知道要多久'], ['请稍候'], 0, 2.6, (c, t, x) => {
    const u = (t % 1.4) / 1.4;
    const a = io(clamp(u * 1.4));
    const b = io(clamp(u * 1.4 - 0.4));
    rr(c, 460, CY - 16, 1000, 32, 16, x.p.line);
    c.save();
    c.beginPath();
    c.roundRect(460, CY - 16, 1000, 32, 16);
    c.clip();
    c.fillStyle = x.p.a;
    c.fillRect(460 + b * 1000, CY - 16, (a - b) * 1000, 32);
    c.restore();
    tx(c, clip(x.W[0], 12), CX, CY - 90, 46, x.p.mute);
  });
  S('badgering', '数字角标', 'Pulse Badge Ring', '角标上一圈光环', ['未读'], ['消息'], 3, 3, (c, t, x) => {
    rr(c, CX - 130, CY - 130, 260, 260, 60, x.p.card, x.p.line);
    tx(c, clip(x.W[0], 4), CX, CY, 56, x.p.mute);
    const u = (t % 1.6) / 1.6;
    alpha(c, 1 - u, () => arc(c, CX + 130, CY - 130, 50 + u * 90, 0, Math.PI * 2, x.p.a, 6));
    dot(c, CX + 130, CY - 130, 52, x.p.a);
    tx(c, Math.round(x.N), CX + 130, CY - 132, 56, x.p.on, 'center', 700);
  });
  S('shimmer', '闪光骨架', 'Shimmer Skeleton', '占位线上有光扫过', ['还在加载'], [''], 0, 2.6, (c, t, x) => {
    const sweep = ((t * 800) % 1700) + 100;
    const g = c.createLinearGradient(sweep - 220, 0, sweep + 220, 0);
    g.addColorStop(0, x.p.card);
    g.addColorStop(0.5, x.p.line);
    g.addColorStop(1, x.p.card);
    dot(c, 620, 400, 80, g);
    rr(c, 740, 340, 620, 50, 14, g);
    rr(c, 740, 420, 430, 50, 14, g);
    rr(c, 540, 540, 820, 50, 14, g);
    rr(c, 540, 620, 820, 50, 14, g);
    rr(c, 540, 700, 520, 50, 14, g);
  });
  S('typing', '对方正在输入', 'Typing Indicator', '三个点依次跳', ['对方正在输入', '正在回复'], [''], 0, 2.6, (c, t, x) => {
    rr(c, CX - 210, CY - 90, 420, 180, 70, x.p.card, x.p.line);
    for (let i = 0; i < 3; i++) dot(c, CX + (i - 1) * 90, CY - Math.max(0, Math.sin(t * 6 - i * 0.9)) * 34, 24, x.p.ink);
  });
  S('ekg', '心电监护', 'Heartbeat Monitor', '亮点沿心电线走', ['心电', '监护', '生命'], [''], 0, 3, (c, t, x) => {
    const y = (p) => {
      const q = p % 1;
      if (q > 0.4 && q < 0.46) return lerp(0, -210, (q - 0.4) / 0.06);
      if (q >= 0.46 && q < 0.52) return lerp(-210, 150, (q - 0.46) / 0.06);
      if (q >= 0.52 && q < 0.58) return lerp(150, 0, (q - 0.52) / 0.06);
      return 0;
    };
    const head = (t * 0.55) % 1;
    c.lineWidth = 7;
    c.lineCap = 'round';
    for (let i = 0; i < 200; i++) {
      const p = head - i / 300;
      if (p < 0) break;
      const a = 1 - i / 200;
      c.strokeStyle = `rgba(255,106,31,${a})`;
      c.beginPath();
      c.moveTo(260 + p * 1400, CY + y(p * 2));
      c.lineTo(260 + (p - 1 / 300) * 1400, CY + y((p - 1 / 300) * 2));
      c.stroke();
    }
    glow(c, 260 + head * 1400, CY + y(head * 2), 90, '#FF6A1F', 0.8);
    dot(c, 260 + head * 1400, CY + y(head * 2), 13, '#FFF');
  });
  S('battery', '电池充电', 'Battery Charge', '电量上涨，闪电在跳', ['电量', '续航', '充电'], ['电量'], 80, 3, (c, t, x) => {
    const u = io(seg(t, 0.2, 2.2)) * clamp(x.N / 100);
    rr(c, CX - 300, CY - 130, 600, 260, 44, null, x.p.ink, 10);
    rr(c, CX + 312, CY - 50, 28, 100, 10, x.p.ink);
    rr(c, CX - 280, CY - 110, 560 * u, 220, 28, u > 0.2 ? x.p.ok : x.p.bad);
    alpha(c, 0.7 + Math.sin(t * 6) * 0.3, () => {
      c.beginPath();
      [[20, -80], [-50, 12], [-4, 12], [-20, 80], [50, -14], [6, -14]].forEach(([a, b], i) => (i ? c.lineTo(CX + a, CY + b) : c.moveTo(CX + a, CY + b)));
      c.closePath();
      c.fillStyle = x.p.ink;
      c.fill();
    });
    tx(c, `${clip(x.W[0], 6)} ${Math.round(u * 100)}%`, CX, CY + 210, 56, x.p.ink, 'center', 600);
  });
  S('signal', '信号格', 'Signal Bars', '信号一格格亮', ['信号', '连接中'], ['正在连接'], 0, 2.8, (c, t, x) => {
    const n = 5;
    const on = Math.floor((t * 2.4) % (n + 2));
    for (let i = 0; i < n; i++) rr(c, CX - 200 + i * 86, CY + 70 - (i + 1) * 58, 62, (i + 1) * 58, 12, i < on ? x.p.a : x.p.line);
    tx(c, clip(x.W[0], 10), CX, CY + 170, 48, x.p.mute);
  });
  S('badgecount', '计数角标', 'Badge Counter', '加一个，角标弹一下', ['加入购物车', '购物车'], ['购物车'], 3, 3, (c, t, x) => {
    const n = Math.max(1, Math.round(x.N));
    const f = seg(t, 0.5, 2.3) * n;
    const i = Math.floor(f);
    const s = i < n ? 1 + 0.5 * Math.sin(Math.min(1, (f - i) * 3) * Math.PI) : 1;
    rr(c, CX - 120, CY - 110, 240, 220, 40, x.p.card, x.p.line);
    tx(c, clip(x.W[0], 4), CX, CY, 48, x.p.ink);
    at(c, CX + 120, CY - 110, s, () => {
      dot(c, 0, 0, 56, x.p.a);
      tx(c, Math.min(i, n), 0, -2, 60, x.p.on, 'center', 700);
    });
  });
  S('bookmark', '收藏', 'Bookmark Toggle', '书签填满，落下来', ['收藏', '存下来'], ['已收藏'], 0, 2.6, (c, t, x) => {
    const u = spring(seg(t, 0.8, 1.4), 1.8, 5);
    const on = t > 0.8;
    const y = CY - 60 + (on ? (1 - u) * -50 : 0);
    c.beginPath();
    c.moveTo(CX - 90, y - 130);
    c.lineTo(CX + 90, y - 130);
    c.lineTo(CX + 90, y + 130);
    c.lineTo(CX, y + 70);
    c.lineTo(CX - 90, y + 130);
    c.closePath();
    if (on) {
      c.fillStyle = x.p.a;
      c.fill();
    } else {
      c.strokeStyle = x.p.mute;
      c.lineWidth = 10;
      c.stroke();
    }
    alpha(c, seg(t, 1.1, 1.5), () => tx(c, clip(x.W[0], 8), CX, CY + 170, 52, x.p.ink));
  });
  S('packet', '数据包路由', 'Packet Trace', '数据包挑一条路穿过网络', ['路由', '传输'], ['手机', '网关', '云端', '模型'], 0, 3.2, (c, t, x) => {
    const nodes = [[360, CY], [800, CY - 190], [800, CY + 190], [1230, CY - 90], [1560, CY]];
    const edges = [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [2, 4]];
    edges.forEach(([a, b]) => ln(c, nodes[a][0], nodes[a][1], nodes[b][0], nodes[b][1], x.p.line, 5));
    const routes = [[0, 1, 3, 4], [0, 2, 3, 4], [0, 2, 4]];
    routes.forEach((r, i) => {
      const u = ((t * 0.6 + i * 0.33) % 1) * (r.length - 1);
      const s = Math.floor(u);
      const k = u - s;
      const a = nodes[r[s]];
      const b = nodes[r[Math.min(s + 1, r.length - 1)]];
      dot(c, lerp(a[0], b[0], k), lerp(a[1], b[1], k), 15, i ? x.p.b : x.p.a);
    });
    nodes.forEach((n, i) => {
      dot(c, n[0], n[1], 40, x.p.card);
      tx(c, clip((x.W[Math.min(i, x.W.length - 1)] || ''), 3), n[0], n[1] + 80, 34, x.p.mute);
    });
  });
  S('phaselock', '相位锁定', 'Phase Lock', '三条信号慢慢对齐', ['同步', '对齐'], ['已同步'], 0, 3.6, (c, t, x) => {
    const u = io(seg(t, 0.6, 2.6));
    const colors = [x.p.a, x.p.b, x.p.ink];
    colors.forEach((col, i) => {
      const off = (1 - u) * (i + 1) * 1.7;
      const amp = 90;
      c.strokeStyle = col;
      c.lineWidth = 6;
      c.beginPath();
      for (let p = 0; p <= 1; p += 0.01) {
        const px = 300 + p * 1320;
        const py = CY + (i - 1) * 150 * (1 - u) + Math.sin(p * 14 + t * 3 + off) * amp;
        if (p === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.stroke();
    });
    alpha(c, seg(t, 2.6, 3), () => tx(c, clip(x.W[0], 10), CX, 860, 50, x.p.ink, 'center', 600));
  });
  S('checksum', '校验通过', 'Checksum Bloom', '乱码慢慢变成可信的校验串', ['校验通过'], ['校验通过'], 0, 3.2, (c, t, x) => {
    const target = '9F3A-77C1-E20B-44D8';
    const u = seg(t, 0.3, 2.2);
    const shown = [...target].map((ch, i) => (ch === '-' ? '-' : i / target.length < u ? ch : '0123456789ABCDEF'[Math.floor(rnd(i, Math.floor(t * 20)) * 16)])).join('');
    tx(c, shown, CX, CY - 40, 100, u >= 1 ? x.p.ok : x.p.mute, 'center', 600);
    alpha(c, seg(t, 2.2, 2.6), () => {
      check(c, CX - 130, CY + 110, 54, seg(t, 2.2, 2.6), x.p.ok, 9);
      tx(c, clip(x.W[0], 8), CX - 80, CY + 110, 52, x.p.ok, 'left', 600);
    });
  });
  S('receipt', '回执扩散', 'Echo Receipt', '确认一层层传出去', ['回执', '已读'], ['本机', '服务器', '对方'], 0, 3.2, (c, t, x) => {
    const words = x.W.slice(0, 3);
    words.forEach((w, i) => {
      const u = spring(seg(t, 0.4 + i * 0.7, 1 + i * 0.7));
      const r = 110 + i * 110;
      arc(c, CX, CY, r, 0, Math.PI * 2, u > 0 ? x.p.ok : x.p.line, 7);
      alpha(c, u, () => {
        tx(c, clip(w, 5), CX, CY - r - 8, 36, x.p.ink);
      });
    });
    dot(c, CX, CY, 58, x.p.ok);
    check(c, CX, CY, 54, 1, x.p.on, 8);
  });
  S('diff', '新旧值', 'State Diff', '旧值让开，新值进来', ['从原来的', '变成了'], ['原来', '现在'], 88, 3, (c, t, x) => {
    const u = io(seg(t, 0.9, 1.7));
    const old = Math.round(x.N2);
    alpha(c, 1 - u * 0.65, () => at(c, lerp(CX, CX - 330, u), CY, 1 - u * 0.4, () => {
      tx(c, old, 0, 0, 200, x.p.mute, 'center', 700);
      if (u > 0.3) ln(c, -130, 0, 130, 0, x.p.bad, 12);
    }));
    alpha(c, u, () => at(c, lerp(CX + 200, CX + 170, u), CY, 0.7 + spring(u) * 0.3, () => tx(c, Math.round(x.N), 0, 0, 260, x.p.a, 'center', 700)));
    tx(c, clip(x.W[0], 8), CX - 330, CY + 170, 42, x.p.mute);
    tx(c, clip(x.W[1] || '', 8), CX + 170, CY + 170, 42, x.p.ink);
  });
  S('braille', '点阵信号', 'Signal Braille', '一块点阵不断变化', ['系统状态'], ['运行中'], 0, 3, (c, t, x) => {
    for (let i = 0; i < 14; i++) {
      for (let j = 0; j < 6; j++) {
        const on = rnd(i * 7 + j, Math.floor(t * 4) + i) > 0.55;
        dot(c, CX - 390 + i * 60, CY - 180 + j * 60, on ? 20 : 8, on ? x.p.a : x.p.line);
      }
    }
    tx(c, clip(x.W[0], 8), CX, CY + 240, 46, x.p.mute);
  });
  S('tokens', '逐词流式', 'Token Stream', '字一小段一小段流出来，像 AI 在答', ['AI 回答', 'AI回答', 'AI 生成', 'AI生成'], ['这一句话正在一小段一小段流出来'], 0, 4.4, (c, t, x) => {
    const full = x.lineFull;
    const letters = [...full];
    const size = letters.length > 44 ? 50 : 64;
    const wrap = D.wrapText(full, 1320, size, size, 6);
    const lh = size * 1.46;
    const top = CY - (wrap.lines.length * lh) / 2 + lh / 2;
    let count = 0;
    const longest = Math.max(...wrap.lines.map((l) => widthOf(c, l, size)));
    wrap.lines.forEach((line, li) => {
      let px = CX - longest / 2;
      [...line].forEach((ch) => {
        const at0 = 0.2 + (count / letters.length) * Math.max(2.8, x.T - 0.8);
        const u = out(seg(t, at0, at0 + 0.25));
        alpha(c, u, () => tx(c, ch, px, top + li * lh + (1 - u) * 14, size, x.p.ink, 'left'));
        px += widthOf(c, ch, size);
        count++;
      });
    });
  });
  S('presence', '在线头像', 'Presence Stack', '头像散开，绿点在跳', ['在线', '同时在线'], ['人在线'], 12, 2.8, (c, t, x) => {
    const n = 5;
    const u = spring(seg(t, 0.3, 1.2), 1.4, 5);
    for (let i = 0; i < n; i++) {
      const px = CX + (i - 2) * lerp(60, 150, u);
      dot(c, px, CY - 20, 78, x.p.bg);
      dot(c, px, CY - 20, 70, ['#FF6A1F', '#F5C04A', '#3CC765', '#4CC9F0', '#8B6CFF'][i]);
    }
    const r = (Math.sin(t * 4) * 0.5 + 0.5) * 8;
    dot(c, CX + lerp(120, 300, u) + 50, CY + 30, 18 + r, x.p.ok);
    tx(c, `${Math.round(x.N)} ${clip(x.W[0], 6)}`, CX, CY + 140, 50, x.p.ink);
  });
  S('confidence', '置信度', 'Confidence Settle', '分数冲过头，再落到真值', ['置信', '可信度'], ['置信度'], 86, 3, (c, t, x) => {
    const u = spring(seg(t, 0.3, 2), 1.1, 3.6);
    const v = x.N * u;
    // 条可以冲过头，数字不能：片子里不能闪过一个不是真值的数
    tx(c, `${Math.round(Math.min(v, x.N))}%`, CX, CY - 40, 240, x.p.ink, 'center', 700);
    rr(c, 560, CY + 120, 800, 20, 10, x.p.line);
    rr(c, 560, CY + 120, 800 * clamp(v / 100), 20, 10, x.p.a);
    ln(c, 560 + (800 * x.N) / 100, CY + 104, 560 + (800 * x.N) / 100, CY + 156, x.p.ink, 5);
    tx(c, clip(x.W[0], 8), CX, CY + 210, 44, x.p.mute);
  });
  S('rollback', '乐观回滚', 'Optimistic Rollback', '先改了，被拒绝后又退回去', ['被拒绝', '退回', '回滚'], ['已点赞', '操作失败'], 128, 3.6, (c, t, x) => {
    const on = t > 0.6 && t < 2;
    const u = t < 2 ? seg(t, 0.6, 0.9) : 1 - seg(t, 2, 2.5);
    if (t > 2 && t < 2.5) c.translate(Math.sin(t * 50) * 8 * (1 - seg(t, 2, 2.5)), 0);
    rr(c, CX - 220, CY - 90, 440, 180, 90, u > 0.5 ? x.p.a : x.p.card, x.p.line);
    tx(c, Math.round(x.N) + (on ? 1 : 0), CX, CY, 76, u > 0.5 ? x.p.on : x.p.ink, 'center', 700);
    alpha(c, seg(t, 2, 2.3) * (1 - seg(t, 3.2, 3.5)), () => tx(c, x.W[1] || '操作失败', CX, CY + 170, 46, x.p.bad));
  });
  S('merge', '多值合并', 'Reconciliation Merge', '几个不同的值收成一个', ['合并结果'], ['最终结果'], 86, 3.2, (c, t, x) => {
    const u = io(seg(t, 0.8, 2));
    const n = Math.round(x.nums[x.nums.length - 1]);
    const vals = x.nums.slice(0, 3).map(Math.round);
    vals.forEach((v, i) => {
      const a = (i - (vals.length - 1) / 2) * 420;
      const px = lerp(CX + a, CX, u);
      const py = lerp(CY - 40, CY - 40, u);
      alpha(c, 1 - seg(t, 1.8, 2.1) * (i === vals.length - 1 ? 0 : 1), () => {
        rr(c, px - 150, py - 110, 300, 220, 28, x.p.card, x.p.line);
        tx(c, u > 0.95 ? n : v, px, py, 100, u > 0.95 ? x.p.a : x.p.ink, 'center', 700);
      });
    });
    alpha(c, seg(t, 2, 2.4), () => tx(c, clip(x.W[0], 8), CX, CY + 150, 50, x.p.ink));
  });
  S('ledger', '活动流水', 'Activity Ledger', '新记录进来，旧的收紧', ['记录', '流水'], ['提交了报告', '更新了问卷', '导出了成片', '接入了模型'], 0, 3.8, (c, t, x) => {
    const words = x.W.slice(0, 5);
    let y = 240;
    words.forEach((w, i) => {
      const k = words.length - 1 - i;
      const u = out(seg(t, 0.3 + k * 0.6, 0.8 + k * 0.6));
      if (u <= 0) return;
      const fresh = seg(t, 0.3 + k * 0.6, 1.2 + k * 0.6) < 1;
      const h = lerp(70, 110, fresh ? 1 : 0.2);
      alpha(c, u * (fresh ? 1 : 0.6), () => {
        rr(c, 520, y, 880, h, 18, x.p.card, fresh ? x.p.a : x.p.line);
        tx(c, clip(w, 20), 560, y + h / 2, fresh ? 42 : 34, x.p.ink, 'left');
      });
      y += h + 14;
    });
  });
  S('handoff', '智能体接力', 'Agent Handoff', '上下文从一个智能体传到下一个', ['智能体接力'], ['调研', '写作', '审校'], 0, 3.4, (c, t, x) => {
    const words = x.W.slice(0, 3);
    const xs = words.length < 3 ? [640, 1280, 1280] : [480, 960, 1440];
    ln(c, xs[0], CY, xs[Math.max(1, words.length - 1)], CY, x.p.line, 6);
    const u = seg(t, 0.4, 2.8) * Math.max(1, words.length - 1);
    const i = Math.min(Math.max(0, words.length - 2), Math.floor(u));
    const k = io(u - i);
    dot(c, lerp(xs[i], xs[i + 1], k), CY, 22, x.p.a);
    words.forEach((w, n) => {
      const on = Math.round(u) === n;
      dot(c, xs[n], CY, 96, on ? x.p.a : x.p.card);
      tx(c, clip(w, 3), xs[n], CY, 48, on ? x.p.on : x.p.ink, 'center', 600);
    });
    tx(c, '上下文', lerp(xs[i], xs[i + 1], k), CY - 90, 34, x.p.mute);
  });
  S('ratelimit', '限流冷却', 'Rate Limit Cooldown', '令牌很快用光，再一滴滴回来', ['额度', '限流', '用完了'], ['剩余额度'], 0, 3.6, (c, t, x) => {
    const drain = seg(t, 0.3, 1);
    const refill = seg(t, 1.2, 3.4);
    const level = 1 - drain + refill * 0.7;
    const n = 12;
    for (let i = 0; i < n; i++) {
      const on = (i + 1) / n <= level;
      rr(c, CX - 340 + i * 58, CY - 60, 44, 120, 12, on ? x.p.a : x.p.line);
    }
    tx(c, `${clip(x.W[0], 6)} ${Math.round(level * n)}/${n}`, CX, CY + 130, 46, x.p.mute);
  });
  S('recall', '向量召回', 'Vector Recall', '查询一扫，最近的点飘过来', ['知识库', '向量检索'], ['最相关的结果'], 0, 3.2, (c, t, x) => {
    const r = out(seg(t, 0.3, 1.6)) * 300;
    arc(c, CX, CY, r, 0, Math.PI * 2, x.p.a, 3);
    for (let i = 0; i < 70; i++) {
      const a = rnd(i, 1) * Math.PI * 2;
      const d = 80 + rnd(i, 2) * 480;
      const near = d < 300;
      const k = near ? io(seg(t, 1.4 + i * 0.004, 2.4)) : 0;
      const q = d * (1 - k * 0.55);
      dot(c, CX + Math.cos(a) * q, CY + Math.sin(a) * q * 0.72, near && t > 1.4 ? 11 : 7, near && t > 1.4 ? x.p.a : x.p.line);
    }
    dot(c, CX, CY, 18, x.p.ink);
    alpha(c, seg(t, 2.2, 2.6), () => tx(c, clip(x.W[0], 10), CX, 900, 46, x.p.ink));
  });
  S('stale', '旧值换新值', 'Stale While Revalidate', '旧值先淡着，新值弹进来', ['刷新', '更新了'], ['最新数据'], 88, 3, (c, t, x) => {
    const u = spring(seg(t, 1.3, 1.9));
    alpha(c, t < 1.3 ? 0.45 : 0.45 * (1 - seg(t, 1.3, 1.6)), () => tx(c, Math.round(x.N2), CX, CY - 20, 240, x.p.mute, 'center', 700));
    if (t > 1.3) at(c, CX, CY - 20, 0.8 + u * 0.2, () => tx(c, Math.round(x.N), 0, 0, 240, x.p.ink, 'center', 700));
    if (t < 1.3) arc(c, CX, CY + 160, 24, t * 7, t * 7 + 4, x.p.a, 7);
    else tx(c, clip(x.W[0], 8), CX, CY + 160, 46, x.p.mute);
  });
  S('breaker', '断路器', 'Circuit Breaker', '闸刀合上、断开、半开试探', ['断开', '熔断'], ['关闭', '断开', '半开'], 0, 3.8, (c, t, x) => {
    const states = [0.05, 0.9, 0.45];
    const f = Math.min(2, Math.floor(t / 1.15));
    const prev = states[Math.max(0, f - 1)];
    const a = lerp(prev, states[f], spring(seg(t % 1.15, 0, 0.6), 2, 5));
    ln(c, 480, CY, 840, CY, x.p.ink, 12);
    ln(c, 1120, CY, 1440, CY, x.p.ink, 12);
    dot(c, 840, CY, 20, x.p.ink);
    dot(c, 1120, CY, 20, x.p.ink);
    ln(c, 840, CY, 840 + Math.cos(-a) * 280, CY + Math.sin(-a) * 280, f === 1 ? x.p.bad : f === 2 ? '#F5A524' : x.p.ok, 16);
    const words = x.W;
    tx(c, clip(words[Math.min(f, words.length - 1)], 6), CX, CY + 180, 54, x.p.ink, 'center', 600);
  });
  S('flame', '调用链', 'Trace Flame', '一次请求画成层层色块', ['耗时', '调用'], ['请求', '检索', '排序', '生成'], 0, 3.2, (c, t, x) => {
    const spans = [[0, 1, 0], [0.05, 0.3, 1], [0.32, 0.55, 1], [0.58, 0.97, 1], [0.1, 0.24, 2], [0.62, 0.8, 2], [0.82, 0.94, 2], [0.65, 0.74, 3]];
    const colors = [x.p.ink, x.p.a, x.p.b, x.p.ok];
    spans.forEach(([a, b, d], i) => {
      const u = seg(t, 0.2 + a * 2, 0.2 + b * 2);
      const px = 360 + a * 1200;
      const w = (b - a) * 1200 * u;
      const y = 340 + d * 104;
      if (w > 0) {
        rr(c, px, y, w, 90, 12, colors[d]);
        if (u > 0.6 && (b - a) > 0.15) tx(c, clip(x.W[Math.min(d, x.W.length - 1)] || '', 5), px + 22, y + 45, 34, d === 0 ? x.p.on : '#0A0A0B', 'left', 600);
      }
    });
  });
  S('retry', '重试绕圈', 'Retry Orbit', '失败的掉下去，最后一次落稳', ['重试'], ['第三次成功'], 0, 3.8, (c, t, x) => {
    for (let i = 0; i < 3; i++) {
      const u = seg(t, 0.2 + i * 1, 1.1 + i * 1);
      if (u <= 0) continue;
      const fail = i < 2;
      const a = -Math.PI + u * Math.PI * 1.2;
      const px = CX + Math.cos(a) * 280;
      const py = CY + Math.sin(a) * 200 + (fail && u > 0.8 ? (u - 0.8) * 1600 : 0);
      if (u < 1) dot(c, px, py, 26, fail ? x.p.bad : x.p.a);
    }
    dot(c, CX, CY, 70, t > 3.1 ? x.p.ok : x.p.card);
    if (t > 3.1) check(c, CX, CY, 66, seg(t, 3.1, 3.4), x.p.on, 10);
    alpha(c, seg(t, 3.2, 3.5), () => tx(c, clip(x.W[0], 10), CX, CY + 170, 46, x.p.ink));
  });
  S('race', '竞速', 'Speculative Race', '两个结果赛跑，赢的留下', ['赛跑', '比谁快'], ['方案甲', '方案乙'], 0, 3.2, (c, t, x) => {
    const a = io(seg(t, 0.3, 2));
    const b = io(seg(t, 0.3, 2.6)) * 0.84;
    const lose = seg(t, 2, 2.3);
    [[a, x.W[0], x.p.a, -90, 1], [b, x.W[1] || '方案乙', x.p.mute, 90, 1 - lose * 0.75]].forEach(([u, w, col, dy, al]) => {
      alpha(c, al, () => {
        rr(c, 460, CY + dy - 40, 1000, 80, 40, x.p.card, x.p.line);
        rr(c, 460, CY + dy - 40, 1000 * u, 80, 40, col);
        tx(c, clip(w, 8), 500, CY + dy, 40, x.p.ink, 'left', 600);
      });
    });
    if (t > 2.05) check(c, 1530, CY - 90, 66, seg(t, 2.05, 2.4), x.p.ok, 11);
  });
  S('matrix', '任务矩阵', 'Partial Success Matrix', '每格各自完成，有一格失败', ['部分成功', '其中一个失败'], ['12 项里 11 项通过'], 0, 3.4, (c, t, x) => {
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 3; j++) {
        const id = i * 3 + j;
        const u = seg(t, 0.3 + rnd(id, 3) * 1.8, 0.7 + rnd(id, 3) * 1.8);
        const fail = id === 7;
        const px = CX - 330 + i * 220;
        const py = CY - 240 + j * 170;
        rr(c, px - 90, py - 70, 180, 140, 22, u > 0 ? (fail ? x.p.bad : x.p.ok) : x.p.card, x.p.line);
        if (u <= 0) arc(c, px, py, 26, t * 6 + id, t * 6 + id + 4, x.p.mute, 6);
        else if (fail) {
          ln(c, px - 24, py - 24, px + 24, py + 24, '#fff', 10);
          ln(c, px + 24, py - 24, px - 24, py + 24, '#fff', 10);
        } else check(c, px, py, 56, u, x.p.on, 10);
      }
    }
    alpha(c, seg(t, 2.6, 3), () => tx(c, clip(x.W[0], 16), CX, CY + 310, 46, x.p.ink));
  });

  // ================= 质感 =================
  M('shake', '错误抖动', 'Error Shake', '左右抖几下，越抖越小', ['答错了', '失败了'], ['答案不对'], 0, 2.6, (c, t, x) => {
    const u = seg(t, 0.7, 1.5);
    const dx = u > 0 && u < 1 ? Math.sin(u * 28) * 44 * (1 - u) : 0;
    const bad = t > 0.7;
    rr(c, 560 + dx, CY - 90, 800, 180, 28, x.p.card, bad ? x.p.bad : x.p.line, 5);
    tx(c, clip(x.W[0], 14), 610 + dx, CY, 60, bad ? x.p.bad : x.p.ink, 'left', 600);
  });
  M('confetti', '撒彩纸', 'Confetti Burst', '彩纸炸开，转着落下', ['恭喜', '庆祝', '成功了'], ['恭喜'], 0, 3, (c, t, x) => {
    const u = t - 0.4;
    if (u > 0) {
      for (let i = 0; i < 90; i++) {
        const a = rnd(i, 1) * Math.PI * 2;
        const v = 300 + rnd(i, 2) * 900;
        const px = CX + Math.cos(a) * v * u * 0.8;
        const py = CY + Math.sin(a) * v * u * 0.8 + 620 * u * u;
        at(c, px, py, 1, () => rr(c, -10, -16, 20, 32, 4, ['#FF6A1F', '#F5C04A', '#3CC765', '#4CC9F0', '#F4F1EA', '#8B6CFF'][i % 6]), u * (rnd(i, 3) * 14 - 7));
      }
    }
    tx(c, clip(x.W[0], 8), CX, CY, 130, x.p.ink, 'center', 700);
  });
  M('tilt', '视差倾斜', 'Parallax Tilt', '卡片跟着指针歪，光也跟着走', ['倾斜'], ['这张卡片'], 0, 3.6, (c, t, x) => {
    const [mx, my] = path(t, [[0, 500, 300], [1.2, 1400, 760], [2.4, 1400, 300], [3.4, 560, 740]]);
    const rx = (mx - CX) / 500;
    const ry = (my - CY) / 300;
    c.save();
    c.translate(CX, CY);
    c.transform(1 - Math.abs(rx) * 0.1, ry * 0.08, rx * 0.1, 1 - Math.abs(ry) * 0.1, 0, 0);
    rr(c, -390, -240, 780, 480, 40, x.p.card, x.p.line);
    glow(c, rx * 300, ry * 200, 420, '#FF6A1F', 0.35);
    tx(c, clip(x.W[0], 10), rx * 26, ry * 26, 80, x.p.ink, 'center', 700);
    c.restore();
    cursor(c, mx, my);
  });
  M('waveload', '波浪三点', 'Wave Loader', '三个点错开跳', ['等一下'], [''], 0, 2.4, (c, t, x) => {
    for (let i = 0; i < 3; i++) dot(c, CX + (i - 1) * 130, CY - Math.sin(t * 5 - i * 0.9) * 62, 38, i === 1 ? x.p.a : x.p.ink);
  });
  M('sweep', '骨架扫光', 'Skeleton Sweep', '一块占位，光从左到右', ['占位'], [''], 0, 2.4, (c, t, x) => {
    const sweep = 360 + ((t * 700) % 1400);
    const g = c.createLinearGradient(sweep - 260, 0, sweep + 260, 0);
    g.addColorStop(0, x.p.card);
    g.addColorStop(0.5, x.p.line);
    g.addColorStop(1, x.p.card);
    rr(c, 460, 280, 1000, 520, 34, g);
  });
  M('peel', '翻页', 'Page Peel', '上面一页绕左边翻走', ['翻页', '下一页'], ['第一页', '第二页'], 0, 3, (c, t, x) => {
    const u = io(seg(t, 0.8, 1.8));
    rr(c, 560, 260, 800, 560, 26, x.p.card, x.p.line);
    tx(c, clip(x.W[1] || '第二页', 8), CX, CY, 76, x.p.ink, 'center', 600);
    const k = Math.cos(u * Math.PI * 0.5);
    if (k > 0.02) {
      c.save();
      c.translate(560, 0);
      c.transform(k, -0.12 * (1 - k), 0, 1, 0, 0);
      rr(c, 0, 260, 800, 560, 26, x.p.line, x.p.mute);
      tx(c, clip(x.W[0], 8), 400, CY, 76, x.p.ink, 'center', 600);
      c.restore();
    }
  });
  M('spotlight', '光照字', 'Cursor Spotlight', '字只有在光圈里才看得见', ['看不见', '照亮'], ['藏在暗处的真相'], 0, 3.6, (c, t, x) => {
    const [mx, my] = path(t, [[0, 400, 500], [1.4, 1100, 580], [2.2, 760, 500], [3.2, CX, CY]]);
    const size = fit(c, x.W[0], 1500, 120, 40, 700);
    tx(c, x.W[0], CX, CY, size, x.p.line, 'center', 700);
    // 光圈走完再张开，整句都要看得清
    const r = 230 + out(seg(t, 3.1, 3.6)) * 800;
    c.save();
    c.beginPath();
    c.arc(mx, my, r, 0, Math.PI * 2);
    c.clip();
    glow(c, mx, my, r + 50, '#FFFFFF', 0.12);
    tx(c, x.W[0], CX, CY, size, x.p.ink, 'center', 700);
    c.restore();
  });
  M('flipcard', '翻转卡片', 'Flip Card', '正反两面，一转就换', ['翻过来', '反面', '另一面'], ['你以为', '其实'], 0, 3, (c, t, x) => {
    const u = io(seg(t, 1, 1.8));
    const k = Math.cos(u * Math.PI);
    const front = k > 0;
    at(c, CX, CY, 1, () => {
      rr(c, -380, -240, 760, 480, 36, front ? x.p.card : x.p.a, x.p.line);
      tx(c, clip(front ? x.W[0] : x.W[1] || x.W[0], 8), 0, 0, 92, front ? x.p.ink : x.p.on, 'center', 700);
    }, 0, 1);
    c.fillStyle = x.p.bg;
    const w = 400 * (1 - Math.abs(k));
    c.fillRect(CX - 400, CY - 260, w, 520);
    c.fillRect(CX + 400 - w, CY - 260, w, 520);
  });
  M('glitchtext', '错位文字', 'Glitch Text', 'RGB 三份错开，闪一下', ['系统崩了'], ['系统错误'], 0, 2.6, (c, t, x) => {
    const size = fit(c, x.W[0], 1500, 160, 50, 800);
    const f = Math.floor(t * 14);
    const j = rnd(f, 1) > 0.65 ? rnd(f, 2) * 16 - 8 : 0;
    alpha(c, 0.9, () => {
      c.globalCompositeOperation = 'lighter';
      tx(c, x.W[0], CX - 4 - j, CY, size, '#FF2A4D', 'center', 800);
      tx(c, x.W[0], CX + 4 + j, CY, size, '#2AD6FF', 'center', 800);
      tx(c, x.W[0], CX, CY, size, '#3FFF8A', 'center', 800);
    });
    if (rnd(f, 3) > 0.7) {
      c.fillStyle = x.p.bg;
      c.fillRect(0, CY - 60 + rnd(f, 4) * 100, 1920, 8 + rnd(f, 5) * 16);
    }
  });
  M('beam', '边框光束', 'Border Beam', '一束光沿边框走', ['框住'], ['重点内容'], 0, 3, (c, t, x) => {
    const w = 800;
    const h = 320;
    const per = (w + h) * 2;
    rr(c, CX - w / 2, CY - h / 2, w, h, 34, x.p.card, x.p.line);
    const point = (d) => {
      let q = ((d % per) + per) % per;
      if (q < w) return [CX - w / 2 + q, CY - h / 2];
      q -= w;
      if (q < h) return [CX + w / 2, CY - h / 2 + q];
      q -= h;
      if (q < w) return [CX + w / 2 - q, CY + h / 2];
      q -= w;
      return [CX - w / 2, CY + h / 2 - q];
    };
    for (let i = 0; i < 60; i++) {
      const [a, b] = point(t * 900 - i * 12);
      alpha(c, 1 - i / 60, () => dot(c, a, b, 7, x.p.a));
    }
    tx(c, clip(x.W[0], 10), CX, CY, 70, x.p.ink, 'center', 700);
  });
  M('aurora', '极光底', 'Aurora Drift', '柔和色块慢慢漂', ['极光底'], ['未来'], 0, 3.6, (c, t, x) => {
    [['#FF6A1F', 0], ['#4CC9F0', 2], ['#8B6CFF', 4], ['#3CC765', 1]].forEach(([col, s]) => {
      glow(c, CX + Math.cos(t * 0.5 + s) * 520, CY + Math.sin(t * 0.7 + s) * 260, 620, col, 0.55);
    });
    tx(c, clip(x.W[0], 8), CX, CY, 130, '#FFFFFF', 'center', 700);
  });
  M('shine', '斜光扫过', 'Shine Sweep', '一道斜光从按钮上扫过', ['扫过'], ['立即体验'], 0, 2.6, (c, t, x) => {
    c.save();
    c.beginPath();
    c.roundRect(CX - 340, CY - 110, 680, 220, 44);
    c.clip();
    c.fillStyle = x.p.a;
    c.fillRect(CX - 340, CY - 110, 680, 220);
    const px = lerp(CX - 600, CX + 600, (t % 1.8) / 1.8);
    c.fillStyle = 'rgba(255,255,255,.45)';
    c.beginPath();
    c.moveTo(px - 60, CY - 130);
    c.lineTo(px + 40, CY - 130);
    c.lineTo(px - 40, CY + 130);
    c.lineTo(px - 140, CY + 130);
    c.closePath();
    c.fill();
    c.restore();
    tx(c, clip(x.W[0], 8), CX, CY, 70, x.p.on, 'center', 700);
  });
  M('orb', '呼吸光球', 'Breathing Orb', '发光的球一涨一缩', ['呼吸'], [''], 0, 3, (c, t) => {
    const k = 0.5 + Math.sin(t * 1.8) * 0.5;
    glow(c, CX, CY, 340 + k * 120, '#FF6A1F', 0.7);
    dot(c, CX, CY, 120 + k * 34, '#FF8C4D');
  });
  M('floatbob', '漂浮卡片', 'Float Bob', '卡片上下飘，影子跟着变', ['漂浮', '悬浮'], ['悬浮在空中'], 0, 3, (c, t, x) => {
    const k = Math.sin(t * 2);
    alpha(c, 0.5 - k * 0.2, () => {
      c.beginPath();
      c.ellipse(CX, 830, 330 + k * 40, 34, 0, 0, Math.PI * 2);
      c.fillStyle = '#000';
      c.fill();
    });
    rr(c, CX - 360, CY - 210 + k * 34 - 30, 720, 420, 36, x.p.card, x.p.line);
    tx(c, clip(x.W[0], 10), CX, CY + k * 34 - 30, 70, x.p.ink, 'center', 600);
  });
  M('blob', '液态色块', 'Liquid Blob', '形状一直在变', ['变形'], [''], 0, 3, (c, t) => {
    c.beginPath();
    for (let i = 0; i <= 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const r = 260 + Math.sin(a * 3 + t * 1.6) * 44 + Math.sin(a * 5 - t * 1.1) * 26;
      const px = CX + Math.cos(a) * r;
      const py = CY + Math.sin(a) * r;
      if (i) c.lineTo(px, py);
      else c.moveTo(px, py);
    }
    c.closePath();
    const g = c.createLinearGradient(CX - 300, CY - 300, CX + 300, CY + 300);
    g.addColorStop(0, '#FF6A1F');
    g.addColorStop(1, '#F5C04A');
    c.fillStyle = g;
    c.fill();
  });
  M('shimmertext', '流光字', 'Gradient Shimmer Text', '一条亮带穿过字', ['流光'], ['正在思考'], 0, 2.8, (c, t, x) => {
    const size = fit(c, x.W[0], 1500, 140, 50, 700);
    const px = lerp(300, 1620, (t % 1.6) / 1.6);
    const g = c.createLinearGradient(px - 240, 0, px + 240, 0);
    g.addColorStop(0, x.p.mute);
    g.addColorStop(0.5, '#FFFFFF');
    g.addColorStop(1, x.p.mute);
    c.font = `700 ${size}px ${D.FONT_CN}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = g;
    c.fillText(x.W[0], CX, CY);
  });
  M('neonpulse', '霓虹呼吸', 'Neon Glow Pulse', '字和边框一起呼吸发光', ['呼吸灯'], ['营业中'], 0, 3, (c, t, x) => {
    const k = 0.6 + Math.sin(t * 2.4) * 0.4;
    glow(c, CX, CY, 620, '#FF6A1F', 0.4 * k);
    rr(c, CX - 380, CY - 140, 760, 280, 40, null, `rgba(255,140,80,${0.5 + k * 0.5})`, 8);
    tx(c, clip(x.W[0], 8), CX, CY, 110, `rgba(255,190,150,${0.6 + k * 0.4})`, 'center', 700);
  });
  M('equalizer', '音量柱', 'Equalizer Bars', '几根柱子错开跳', ['音频', '声音'], [''], 0, 2.6, (c, t, x) => {
    for (let i = 0; i < 9; i++) {
      const h = 80 + Math.abs(Math.sin(t * 4 + i * 0.9) * Math.cos(t * 2.3 + i)) * 340;
      rr(c, CX - 400 + i * 96, CY + 200 - h, 64, h, 18, i % 3 ? x.p.ink : x.p.a);
    }
  });
  M('radarpulse', '雷达波', 'Radar Pulse', '同心圆一圈圈扩', ['扩散'], [''], 0, 3, (c, t, x) => {
    for (let i = 0; i < 4; i++) {
      const u = ((t + i * 0.55) % 2.2) / 2.2;
      alpha(c, 1 - u, () => arc(c, CX, CY, u * 420, 0, Math.PI * 2, x.p.a, 5));
    }
    dot(c, CX, CY, 20, x.p.ink);
  });
  M('cradle', '牛顿摆', 'Newton\'s Cradle', '两头的球传递力量', ['传导'], [''], 0, 3, (c, t, x) => {
    const s = Math.sin(t * 3.2);
    ln(c, CX - 330, 260, CX + 330, 260, x.p.mute, 8);
    for (let i = 0; i < 5; i++) {
      let a = 0;
      if (i === 0 && s < 0) a = s * 0.6;
      if (i === 4 && s > 0) a = s * 0.6;
      const ox = CX + (i - 2) * 120;
      const bx = ox + Math.sin(a) * 340;
      const by = 260 + Math.cos(a) * 340;
      ln(c, ox, 260, bx, by, x.p.line, 4);
      dot(c, bx, by, 58, i % 4 ? x.p.ink : x.p.a);
    }
  });
  M('bounce', '弹跳小球', 'Bouncing Ball', '落地压扁，影子跟着变', ['弹回', '触底反弹'], [''], 0, 2.6, (c, t, x) => {
    const u = (t % 1.1) / 1.1;
    const h = 4 * u * (1 - u);
    const y = 760 - h * 460;
    const squash = h < 0.08 ? 1 - (0.08 - h) * 4 : 1;
    alpha(c, 0.25 + (1 - h) * 0.5, () => {
      c.beginPath();
      c.ellipse(CX, 830, 100 - h * 40, 18, 0, 0, Math.PI * 2);
      c.fillStyle = x.p.mute;
      c.fill();
    });
    at(c, CX, y, 2 - squash, () => dot(c, 0, 0, 70, x.p.a), 0, squash);
  });
  M('marqueecards', '卡片滚动', 'Marquee Reveal', '一排卡片横着滚', ['一张张'], ['用户说', '数据说', '市场说', '模型说'], 0, 3.6, (c, t, x) => {
    const words = x.W.concat(x.W).concat(x.W);
    const off = (t * 220) % (words.length * 200);
    words.concat(words).forEach((w, i) => {
      const px = i * 400 - off;
      if (px < -400 || px > 2300) return;
      rr(c, px, CY - 170, 360, 340, 30, x.p.card, x.p.line);
      tx(c, clip(w, 5), px + 180, CY, 54, x.p.ink, 'center', 600);
    });
  });
  M('gradborder', '渐变边框', 'Gradient Border Morph', '渐变绕着边框转', ['彩色边框'], ['特别版'], 0, 3, (c, t, x) => {
    const a = t * 1.6;
    const g = c.createLinearGradient(CX - Math.cos(a) * 480, CY - Math.sin(a) * 480, CX + Math.cos(a) * 480, CY + Math.sin(a) * 480);
    ['#FF6A1F', '#F5C04A', '#3CC765', '#4CC9F0', '#8B6CFF', '#FF6A1F'].forEach((col, i) => g.addColorStop(i / 5, col));
    rr(c, CX - 400, CY - 170, 800, 340, 44, g);
    rr(c, CX - 390, CY - 160, 780, 320, 36, x.p.bg);
    tx(c, clip(x.W[0], 8), CX, CY, 90, x.p.ink, 'center', 700);
  });
  M('splitreveal', '逐字升起', 'Text Split Reveal', '每个字弹上来', ['一个字一个字'], ['这才刚刚开始'], 0, 2.6, (c, t, x) => {
    const letters = [...x.W[0]];
    const size = fit(c, x.W[0], 1500, 130, 50, 700);
    let px = CX - widthOf(c, x.W[0], size, 700) / 2;
    c.save();
    c.beginPath();
    c.rect(0, CY - size, 1920, size * 2);
    c.clip();
    letters.forEach((ch, i) => {
      const u = spring(seg(t, 0.2 + i * 0.06, 0.8 + i * 0.06), 1.4, 5);
      const w = widthOf(c, ch, size, 700);
      tx(c, ch, px + w / 2, CY + (1 - u) * size * 1.6, size, x.p.ink, 'center', 700);
      px += w;
    });
    c.restore();
  });
  M('lift', '悬浮抬升', 'Hover Lift', '卡片抬起，影子变大', ['抬起来'], ['当前选中'], 0, 2.8, (c, t, x) => {
    const u = spring(seg(t, 0.8, 1.5), 1.2, 5);
    alpha(c, 0.35 + u * 0.4, () => rr(c, CX - 350 + u * 4, CY - 180 + 30 + u * 40, 700, 380, 40, '#000'));
    rr(c, CX - 360, CY - 200 - u * 30, 720, 400, 36, x.p.card, u > 0.2 ? x.p.a : x.p.line, 3);
    tx(c, clip(x.W[0], 10), CX, CY - u * 30, 72, x.p.ink, 'center', 600);
  });
  M('sheen', '高光滑过', 'Sheen Sweep', '一层反光滑过卡片', ['反光'], ['高级感'], 0, 2.8, (c, t, x) => {
    c.save();
    c.beginPath();
    c.roundRect(CX - 400, CY - 240, 800, 480, 40);
    c.clip();
    c.fillStyle = x.p.card;
    c.fillRect(CX - 400, CY - 240, 800, 480);
    const px = lerp(CX - 800, CX + 800, (t % 2.1) / 2.1);
    const g = c.createLinearGradient(px - 240, 0, px + 240, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,.2)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(CX - 400, CY - 240, 800, 480);
    c.restore();
    tx(c, clip(x.W[0], 10), CX, CY, 80, x.p.ink, 'center', 700);
  });
  M('clipwipe', '裁切擦除', 'Clip Wipe', '盖着的一层从左往右揭开', ['擦掉', '盖住'], ['真实的数字'], 0, 2.8, (c, t, x) => {
    const size = fit(c, x.W[0], 1400, 120, 50, 700);
    tx(c, x.W[0], CX, CY, size, x.p.ink, 'center', 700);
    const u = io(seg(t, 0.8, 1.7));
    c.fillStyle = x.p.a;
    c.fillRect(260 + u * 1400, CY - 130, 1400 * (1 - u), 260);
  });
  M('cube', '3D 方块', '3D Cube Rotate', '方块滚过去换一面', ['换一面', '立方体'], ['第一面', '第二面'], 0, 3, (c, t, x) => {
    const u = io(seg(t, 0.9, 1.8));
    const a = u * Math.PI * 0.5;
    const R = 220;
    const face = (ang, text, fill) => {
      const k = Math.cos(ang);
      if (k <= 0.01) return;
      const y = CY + Math.sin(ang) * R;
      at(c, CX, y, 1, () => {
        rr(c, -340, -R, 680, R * 2, 30, fill, x.p.line);
        tx(c, clip(text, 8), 0, 0, 86, x.p.ink, 'center', 700);
      }, 0, k);
    };
    face(a, x.W[0], x.p.card);
    face(a - Math.PI / 2, x.W[1] || x.W[0], '#2A1A10');
  });
  M('jelly', '果冻', 'Jelly Wobble', '压扁再拉长，晃着停下', ['晃'], ['软软的'], 0, 3, (c, t, x) => {
    const u = seg(t, 0.6, 2.2);
    const k = u > 0 && u < 1 ? Math.sin(u * 18) * (1 - u) * 0.22 : 0;
    at(c, CX, CY, 1 + k, () => {
      rr(c, -300, -150, 600, 300, 90, x.p.a);
      tx(c, clip(x.W[0], 6), 0, 0, 84, x.p.on, 'center', 700);
    }, 0, 1 - k);
  });
  M('doors', '对开门', 'Folding Doors', '两扇门向两边打开', ['打开门', '大门'], ['欢迎', '里面的内容'], 0, 3, (c, t, x) => {
    const u = io(seg(t, 0.9, 1.9));
    tx(c, clip(x.W[1] || x.W[0], 10), CX, CY, 90, x.p.a, 'center', 700);
    const k = Math.cos(u * Math.PI * 0.48);
    const w = 420 * k;
    rr(c, CX - 420, 230, w, 620, 12, x.p.card, x.p.line);
    rr(c, CX + 420 - w, 230, w, 620, 12, x.p.card, x.p.line);
    alpha(c, 1 - u * 2, () => tx(c, clip(x.W[0], 8), CX, CY, 80, x.p.ink, 'center', 600));
  });
  M('beforeafter', '前后对比', 'Before / After', '拖动分割线，前后两面', ['前后对比', '使用前后'], ['之前', '之后'], 0, 3.6, (c, t, x) => {
    const u = 0.5 + Math.sin(t * 1.5 - 1.2) * 0.35;
    const px = 400 + u * 1120;
    rr(c, 400, 240, 1120, 600, 26, x.p.card, x.p.line);
    tx(c, clip(x.W[1] || '之后', 6), 1250, CY, 90, x.p.ink, 'center', 700);
    c.save();
    c.beginPath();
    c.roundRect(400, 240, px - 400, 600, 26);
    c.clip();
    c.fillStyle = x.p.a;
    c.fillRect(400, 240, 1120, 600);
    tx(c, clip(x.W[0], 6), 670, CY, 90, x.p.on, 'center', 700);
    c.restore();
    ln(c, px, 220, px, 860, x.p.ink, 6);
    dot(c, px, CY, 44, x.p.ink);
  });
  M('depthstack', '卡片叠层', 'Depth Stack', '一摞卡片一张张散开', ['层层', '一层层'], ['表层', '中层', '底层'], 0, 3, (c, t, x) => {
    const u = spring(seg(t, 0.8, 1.6), 1.2, 5);
    const words = x.W.slice(0, 3);
    [2, 1, 0].forEach((i) => {
      at(c, CX + i * u * 120, CY - i * u * 90, 1 - i * 0.06, () => {
        rr(c, -340, -180, 680, 360, 34, ['#26262B', '#1F1F24', '#18181B'][2 - i], x.p.line);
        tx(c, clip(words[i], 6), -280, -120, 44, x.p.ink, 'left', 600);
      }, i * u * 0.05);
    });
  });
  M('textwave', '文字波', 'Text Wave', '一个波峰穿过所有字', ['一波'], ['一波接一波'], 0, 2.8, (c, t, x) => {
    const letters = [...x.W[0]];
    const size = fit(c, x.W[0], 1500, 120, 50, 700);
    let px = CX - widthOf(c, x.W[0], size, 700) / 2;
    const crest = ((t * 1.1) % 1.4) * letters.length;
    letters.forEach((ch, i) => {
      const d = i - crest;
      const k = Math.exp(-d * d * 0.4);
      const w = widthOf(c, ch, size, 700);
      tx(c, ch, px + w / 2, CY - k * 70, size, k > 0.4 ? x.p.a : x.p.ink, 'center', 700);
      px += w;
    });
  });
  M('caustic', '焦散玻璃', 'Caustic Glass', '磨砂玻璃底下有光池在动', ['光影'], ['通透'], 0, 3.2, (c, t, x) => {
    [['#4CC9F0', 0], ['#FF6A1F', 2.2], ['#F4F1EA', 4.4]].forEach(([col, s]) => {
      for (let i = 0; i < 3; i++) glow(c, CX + Math.cos(t * 0.8 + s + i * 2) * 380, CY + Math.sin(t * 0.6 + s + i) * 200, 260, col, 0.5);
    });
    rr(c, CX - 460, CY - 240, 920, 480, 44, 'rgba(255,255,255,.1)', 'rgba(255,255,255,.35)');
    tx(c, clip(x.W[0], 8), CX, CY, 96, '#FFFFFF', 'center', 700);
  });
  M('chromatic', '色散', 'Chromatic Split', '字分成三色，再合回来', ['分裂', '重影'], ['同一件事'], 0, 2.8, (c, t, x) => {
    const size = fit(c, x.W[0], 1500, 140, 50, 700);
    const k = Math.max(0, Math.sin(t * 2.2)) * 12;
    c.save();
    c.globalCompositeOperation = 'lighter';
    tx(c, x.W[0], CX - k, CY, size, '#FF3030', 'center', 700);
    tx(c, x.W[0], CX, CY, size, '#30FF60', 'center', 700);
    tx(c, x.W[0], CX + k, CY, size, '#3060FF', 'center', 700);
    c.restore();
  });
  M('warp', '弯曲网格', 'Warp Grid', '平面朝一个点陷下去', ['引力', '陷下去'], [''], 0, 3, (c, t, x) => {
    const fx = CX + Math.cos(t) * 200;
    const fy = CY + Math.sin(t * 1.3) * 120;
    const warp = (px, py) => {
      const dx = px - fx;
      const dy = py - fy;
      const d = Math.hypot(dx, dy) || 1;
      const k = 1 - 90 / (d + 90) * 0.75;
      return [fx + dx * k, fy + dy * k];
    };
    c.strokeStyle = x.p.mute;
    c.lineWidth = 2;
    for (let i = 0; i <= 24; i++) {
      c.beginPath();
      for (let j = 0; j <= 40; j++) {
        const [a, b] = warp(260 + i * 58, 120 + j * 21);
        if (j) c.lineTo(a, b);
        else c.moveTo(a, b);
      }
      c.stroke();
    }
    for (let j = 0; j <= 14; j++) {
      c.beginPath();
      for (let i = 0; i <= 48; i++) {
        const [a, b] = warp(260 + i * 29, 120 + j * 60);
        if (i) c.lineTo(a, b);
        else c.moveTo(a, b);
      }
      c.stroke();
    }
  });
  M('moire', '摩尔纹镜片', 'Moiré Lens', '两组线反着转，叠出深度', ['叠加'], [''], 0, 3, (c, t, x) => {
    [1, -1].forEach((dir, n) => {
      c.save();
      c.translate(CX + n * 60, CY);
      c.rotate(t * 0.2 * dir);
      c.strokeStyle = n ? x.p.a : x.p.ink;
      c.lineWidth = 3;
      for (let i = -60; i <= 60; i++) {
        c.beginPath();
        c.moveTo(i * 14, -700);
        c.lineTo(i * 14, 700);
        c.stroke();
      }
      c.restore();
    });
  });
  M('foil', '偏振箔', 'Polarized Foil', '斜着看才有彩虹', ['镭射'], ['限量'], 0, 3.2, (c, t, x) => {
    const px = lerp(460, 1460, (Math.sin(t * 1.2) + 1) / 2);
    const g = c.createLinearGradient(px - 500, 300, px + 500, 800);
    ['#2A2A2F', '#FF6A1F', '#F5C04A', '#3CC765', '#4CC9F0', '#8B6CFF', '#2A2A2F'].forEach((col, i) => g.addColorStop(i / 6, col));
    rr(c, CX - 460, CY - 280, 920, 560, 40, g);
    tx(c, clip(x.W[0], 6), CX, CY, 130, '#FFFFFF', 'center', 800);
  });
  M('metaball', '液滴搭桥', 'Metaball Bridge', '两团液体连在一起又分开', ['连接', '连在一起'], [''], 0, 3, (c, t, x) => {
    const d = 170 + Math.sin(t * 1.6) * 170;
    const a = CX - d;
    const b = CX + d;
    const r1 = 120 + Math.sin(t * 1.6) * 30;
    const r2 = 120 - Math.sin(t * 1.6) * 30;
    dot(c, a, CY, r1, x.p.a);
    dot(c, b, CY, r2, x.p.a);
    if (d < 240) {
      const neck = (1 - d / 240) * 90;
      c.fillStyle = x.p.a;
      c.beginPath();
      c.moveTo(a, CY - r1 * 0.72);
      c.quadraticCurveTo(CX, CY - neck * 0.5, b, CY - r2 * 0.72);
      c.lineTo(b, CY + r2 * 0.72);
      c.quadraticCurveTo(CX, CY + neck * 0.5, a, CY + r1 * 0.72);
      c.closePath();
      c.fill();
    }
  });
  M('weight', '字重变化', 'Variable Weight', '字从细到粗', ['越来越重', '变粗'], ['分量越来越重'], 0, 2.8, (c, t, x) => {
    const u = io(seg(t, 0.4, 1.9));
    const size = fit(c, x.W[0], 1500, 130, 50, 800);
    tx(c, x.W[0], CX, CY, size, lerp(0, 1, u) > 0.5 ? x.p.ink : x.p.mute, 'center', 800);
    c.strokeStyle = x.p.ink;
    c.lineWidth = 0.1 + u * 3.5;
    c.font = `800 ${size}px ${D.FONT_CN}`;
    c.strokeText(x.W[0], CX, CY);
  });
  M('specular', '拉丝高光', 'Specular Orbit', '一点高光绕着金属面转', ['拉丝', '金属质感'], ['Pro'], 0, 3, (c, t, x) => {
    rr(c, CX - 440, CY - 270, 880, 540, 40, '#1A1A1C');
    for (let i = 0; i < 90; i++) ln(c, CX - 440, CY - 270 + i * 6, CX + 440, CY - 270 + i * 6, 'rgba(255,255,255,.03)', 2);
    glow(c, CX + Math.cos(t) * 360, CY + Math.sin(t) * 200, 320, '#FFFFFF', 0.45);
    tx(c, clip(x.W[0], 6), CX, CY, 130, '#F4F1EA', 'center', 700);
  });
  M('noisedissolve', '噪点消融', 'Noise Dissolve', '颗粒退去，露出一片色', ['慢慢显露'], ['水落石出'], 0, 3, (c, t, x) => {
    rr(c, CX - 460, CY - 270, 920, 540, 30, x.p.a);
    tx(c, clip(x.W[0], 8), CX, CY, 110, x.p.on, 'center', 700);
    const u = seg(t, 0.5, 2.2);
    for (let i = 0; i < 46; i++) {
      for (let j = 0; j < 27; j++) {
        if (rnd(i * 31 + j, 4) > u) {
          c.fillStyle = x.p.bg;
          c.fillRect(CX - 460 + i * 20, CY - 270 + j * 20, 20.5, 20.5);
        }
      }
    }
  });
  M('dither', '抖动绽放', 'Dither Bloom', '低比特点阵长成一朵光', ['绽放'], [''], 0, 3, (c, t, x) => {
    const r = out(seg(t, 0.2, 2)) * 360;
    for (let i = 0; i < 64; i++) {
      for (let j = 0; j < 40; j++) {
        const px = 320 + i * 20;
        const py = 140 + j * 20;
        const d = Math.hypot(px - CX, py - CY);
        const k = clamp(1 - d / Math.max(1, r));
        if (k > ((i * 7 + j * 13) % 16) / 16) {
          c.fillStyle = k > 0.65 ? '#F5C04A' : k > 0.3 ? '#FF6A1F' : '#8B3A10';
          c.fillRect(px, py, 11, 11);
        }
      }
    }
  });
  M('ferro', '铁磁流体', 'Ferrofluid Crown', '磁力拉起一圈液态金属刺', ['磁场'], [''], 0, 3, (c, t, x) => {
    const k = 0.5 + Math.sin(t * 1.5) * 0.5;
    dot(c, CX, CY, 150, '#1C1C20');
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + t * 0.2;
      const h = 60 + k * 150 + Math.sin(i * 2.1 + t * 3) * 30;
      c.beginPath();
      c.moveTo(CX + Math.cos(a - 0.11) * 150, CY + Math.sin(a - 0.11) * 150);
      c.lineTo(CX + Math.cos(a) * (150 + h), CY + Math.sin(a) * (150 + h));
      c.lineTo(CX + Math.cos(a + 0.11) * 150, CY + Math.sin(a + 0.11) * 150);
      c.closePath();
      c.fillStyle = i % 2 ? '#2C2C31' : '#3A3A40';
      c.fill();
    }
    glow(c, CX - 40, CY - 50, 110, '#FFFFFF', 0.3);
  });
  M('lenticular', '光栅换字', 'Lenticular Shift', '换个角度，字就换了', ['换个角度'], ['你以为', '其实是'], 0, 3.2, (c, t, x) => {
    const u = (Math.sin(t * 1.7) + 1) / 2;
    const size = 120;
    for (let i = 0; i < 90; i++) {
      const px = 460 + i * 11.2;
      const showB = (i % 2 === 0 ? u > 0.35 : u > 0.65);
      c.save();
      c.beginPath();
      c.rect(px, CY - 150, 11.4, 300);
      c.clip();
      tx(c, clip(showB ? x.W[1] || x.W[0] : x.W[0], 8), CX, CY, size, showB ? x.p.a : x.p.ink, 'center', 700);
      c.restore();
    }
  });
  M('shaft', '体积光', 'Volumetric Shaft', '光从缝里打下来，灰尘在飘', ['一束光'], [''], 0, 3.2, (c, t, x) => {
    const g = c.createLinearGradient(0, 100, 0, 980);
    g.addColorStop(0, 'rgba(255,230,190,.5)');
    g.addColorStop(1, 'rgba(255,230,190,0)');
    c.beginPath();
    c.moveTo(CX - 60, 100);
    c.lineTo(CX + 60, 100);
    c.lineTo(CX + 430, 980);
    c.lineTo(CX - 430, 980);
    c.closePath();
    c.fillStyle = g;
    c.fill();
    for (let i = 0; i < 70; i++) {
      const y = 120 + ((rnd(i, 1) * 860 + t * (14 + rnd(i, 2) * 30)) % 860);
      const span = 60 + ((y - 100) / 880) * 370;
      dot(c, CX + (rnd(i, 3) - 0.5) * 2 * span, y, 2 + rnd(i, 4) * 4, 'rgba(255,240,210,.7)');
    }
  });
  M('emboss', '压印字', 'Letterpress Emboss', '字压进纸里，光一动才看得出', ['压印'], ['一杯咖啡'], 0, 3, (c, t, x) => {
    c.fillStyle = '#E9E5DA';
    c.fillRect(0, 0, 1920, 1080);
    const a = t * 1.1;
    const lx = Math.cos(a) * 6;
    const ly = Math.sin(a) * 6;
    const size = fit(c, x.W[0], 1500, 170, 50, 800);
    tx(c, x.W[0], CX + lx, CY + ly, size, '#FFFFFF', 'center', 800);
    tx(c, x.W[0], CX - lx, CY - ly, size, '#8C8678', 'center', 800);
    tx(c, x.W[0], CX, CY, size, '#CFC9B9', 'center', 800);
  });
  M('rackfocus', '焦点转移', 'Rack Focus', '焦点从前面拉到后面', ['焦点转移', '其实重点'], ['前面这句', '后面这句'], 0, 3.2, (c, t, x) => {
    const u = io(seg(t, 1, 2));
    const soft = (s, px, py, size, col, blur) => {
      const n = Math.round(blur / 3);
      if (!n) {
        tx(c, s, px, py, size, col, 'center', 700);
        return;
      }
      const count = Math.ceil(((2 * n + 1) ** 2) / 2);
      alpha(c, Math.min(1, 1.5 / count), () => {
        for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) if ((i + j) % 2 === 0) tx(c, s, px + i * 3, py + j * 3, size, col, 'center', 700);
      });
    };
    soft(clip(x.W[1] || x.W[0], 10), CX + 120, CY + 130, 100, x.p.mute, (1 - u) * 15);
    soft(clip(x.W[0], 10), CX - 120, CY - 110, 130, x.p.ink, u * 15);
  });
  M('eink', '墨水屏刷新', 'E-ink Refresh', '整屏反色一闪，字才落定', ['刷新一下', '墨水屏'], ['新的一页'], 0, 2.8, (c, t, x) => {
    const f = t > 0.8 && t < 1.05;
    const g = t >= 1.05 && t < 1.25;
    c.fillStyle = f ? '#111' : g ? '#FFF' : '#E7E4DB';
    c.fillRect(0, 0, 1920, 1080);
    if (t > 1.25) alpha(c, seg(t, 1.25, 1.5), () => tx(c, clip(x.W[0], 10), CX, CY, 110, '#1C1C1A', 'center', 700));
    else if (!f && !g) tx(c, '旧的一页', CX, CY, 110, '#B5B1A6', 'center', 700);
  });
  M('flare', '变形光晕', 'Anamorphic Flare', '一个光点拉出横向长条光', ['电影感'], [''], 0, 3, (c, t, x) => {
    const px = lerp(400, 1520, (Math.sin(t * 0.9) + 1) / 2);
    const g = c.createLinearGradient(px - 900, 0, px + 900, 0);
    g.addColorStop(0, 'rgba(76,201,240,0)');
    g.addColorStop(0.5, 'rgba(120,220,255,.85)');
    g.addColorStop(1, 'rgba(76,201,240,0)');
    c.fillStyle = g;
    c.fillRect(px - 900, CY - 4, 1800, 8);
    glow(c, px, CY, 280, '#7FE0FF', 0.7);
    dot(c, px, CY, 20, '#FFF');
  });
  M('lidar', '激光雷达', 'LiDAR Sweep', '一条扫描面把点云照亮', ['激光雷达', '点云'], [''], 0, 3.2, (c, t, x) => {
    const sweep = ((t * 0.5) % 1) * 1400 + 260;
    for (let i = 0; i < 700; i++) {
      const px = 260 + rnd(i, 1) * 1400;
      const py = 200 + rnd(i, 2) * 680;
      const d = sweep - px;
      if (d < 0) continue;
      const k = clamp(1 - d / 900);
      const depth = (py - 200) / 680;
      c.fillStyle = `rgba(${Math.round(lerp(76, 255, depth))},${Math.round(lerp(201, 106, depth))},${Math.round(lerp(240, 31, depth))},${k})`;
      c.fillRect(px, py, 5, 5);
    }
    ln(c, sweep, 180, sweep, 900, '#FFF', 3);
  });
  M('contour', '等高线漂移', 'Topographic Drift', '等高线像地形在起伏', ['地形'], [''], 0, 3.2, (c, t, x) => {
    for (let k = 0; k < 11; k++) {
      c.strokeStyle = k % 3 ? x.p.line : x.p.a;
      c.lineWidth = 3;
      c.beginPath();
      for (let i = 0; i <= 80; i++) {
        const a = (i / 80) * Math.PI * 2;
        const r = 50 + k * 42 + Math.sin(a * 3 + t * 0.8 + k * 0.3) * (10 + k * 3) + Math.sin(a * 5 - t * 0.6) * 8;
        const px = CX + Math.cos(a) * r * 1.5;
        const py = CY + Math.sin(a) * r;
        if (i) c.lineTo(px, py);
        else c.moveTo(px, py);
      }
      c.closePath();
      c.stroke();
    }
  });
  M('pixelmelt', '像素融化', 'Pixel Sort Melt', '一列列色块往下滑，再回来', ['融掉'], [''], 0, 3.2, (c, t, x) => {
    const n = 60;
    for (let i = 0; i < n; i++) {
      const off = Math.max(0, Math.sin(t * 1.6 + rnd(i, 1) * 1.8)) * (rnd(i, 2) * 260);
      const hue = (i / n) * 60 + 10;
      for (let j = 0; j < 10; j++) {
        c.fillStyle = `hsl(${hue + j * 3},85%,${30 + j * 5}%)`;
        c.fillRect(360 + i * 20, 240 + j * 50 + off, 20.5, 50.5);
      }
    }
  });
  M('voronoi', '细胞脉冲', 'Voronoi Pulse', '光从一个核向外点亮细胞', ['细胞', '蔓延'], [''], 0, 3.2, (c, t, x) => {
    const n = 44;
    const pts = Array.from({length: n}, (_, i) => [320 + rnd(i, 1) * 1280, 160 + rnd(i, 2) * 760]);
    const core = [CX + Math.cos(t * 0.7) * 300, CY + Math.sin(t * 0.9) * 170];
    const wave = (t * 400) % 1100;
    pts.forEach((p) => {
      const d = Math.hypot(p[0] - core[0], p[1] - core[1]);
      const k = Math.exp(-(((d - wave) / 130) ** 2));
      dot(c, p[0], p[1], 34 + k * 26, k > 0.3 ? `rgba(255,106,31,${0.3 + k * 0.7})` : x.p.card);
      arc(c, p[0], p[1], 34 + k * 26, 0, Math.PI * 2, x.p.line, 2);
    });
    dot(c, core[0], core[1], 12, x.p.ink);
  });

  // ---------- 错位印刷。效果参考 Verse Text（Rajat Sethi，页面没有写开源授权），代码自己写 ----------
  const MP = {c: '#00E5FF', m: '#FF2BD6', y: '#FFE600', violet: '#7B5CFF', green: '#2BE88A', gold: '#FFC83D', red: '#FF3B30'};
  const TAIL = /^[，。！？、；：,.!?;:）)》」”’…%％]+$/;
  const wordsOf = (s) => {
    const raw = typeof Intl !== 'undefined' && Intl.Segmenter
      ? [...new Intl.Segmenter('zh', {granularity: 'word'}).segment(s)].map((g) => g.segment)
      : s.match(/[A-Za-z0-9.]+|[\s\S]/g) || [];
    const merged = [];
    raw.forEach((w) => {
      if (merged.length && TAIL.test(w)) merged[merged.length - 1] += w;
      else merged.push(w);
    });
    return merged;
  };
  // 按字号试排：放得下 5 行的最大字号。字体加载前后宽度不同，缓存跟着宽度走
  const misprintLayouts = new Map();
  const misprintLayout = (c, text) => {
    c.font = `800 100px ${D.FONT_CN}`;
    const key = `${text}|${c.measureText('一A').width}`;
    if (misprintLayouts.has(key)) return misprintLayouts.get(key);
    const words = wordsOf(text);
    let best = null;
    for (let size = 112; size >= 40; size -= 4) {
      c.font = `800 ${size}px ${D.FONT_CN}`;
      const lines = [[]];
      let used = 0;
      words.forEach((s) => {
        const w = c.measureText(s).width;
        if (used + w > 1480 && lines[lines.length - 1].length) {
          lines.push([]);
          used = 0;
        }
        if (!s.trim() && !lines[lines.length - 1].length) return;
        lines[lines.length - 1].push({s, w, x: used});
        used += w;
      });
      best = {size, lines};
      if (lines.length * size * 1.5 <= 880 && lines.length <= 5) break;
    }
    const lh = best.size * 1.5;
    const wide = Math.max(...best.lines.map((l) => l.reduce((a, w) => a + w.w, 0)));
    const left = CX - wide / 2;
    const top = CY - ((best.lines.length - 1) * lh) / 2;
    const list = [];
    best.lines.forEach((line, n) => line.forEach((w) => {
      if (w.s.trim()) list.push({s: w.s, w: w.w, x: left + w.x, y: top + n * lh, line: n, i: list.length});
    }));
    const out2 = {size: best.size, lh, list, left, wide, top, lineCount: best.lines.length};
    misprintLayouts.set(key, out2);
    return out2;
  };
  const inked = (c, w, dx, dy, size, color, weight) => {
    c.font = `${weight} ${size}px ${D.FONT_CN}`;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillStyle = color;
    c.fillText(w.s, w.x + dx, w.y + dy);
  };
  const misprintDebris = (c, w, u, size) => {
    const fade = 1 - seg(u, 0.25, 0.75);
    if (fade <= 0) return;
    alpha(c, fade, () => {
      const hx = w.x + rnd(w.i, 3) * w.w;
      const hy = w.y + (rnd(w.i, 4) - 0.5) * size * 1.5;
      const step = size * 0.16;
      for (let gx = -4; gx <= 4; gx++) {
        for (let gy = -4; gy <= 4; gy++) {
          const r = (1 - Math.hypot(gx, gy) / 5) * size * 0.06;
          if (r > 0) dot(c, hx + gx * step, hy + gy * step, r, MP.red);
        }
      }
      for (let k = 0; k < 7; k++) {
        const a = rnd(w.i, 10 + k) * Math.PI * 2;
        const d = size * (0.4 + rnd(w.i, 20 + k)) * out(u);
        dot(c, w.x + w.w / 2 + Math.cos(a) * d * 1.6, w.y + Math.sin(a) * d, size * 0.035, MP.gold);
      }
    });
  };
  const misprintShards = (c, w, u, size, ink) => {
    const n = 3 + Math.floor(rnd(w.i, 5) * 4);
    const push = (1 - out(u)) * size * 0.55;
    const h = size * 0.75;
    for (let k = 0; k < n; k++) {
      const a = w.x - 6 + ((w.w + 12) * k) / n;
      const b = w.x - 6 + ((w.w + 12) * (k + 1)) / n;
      const lean = (rnd(w.i, 30 + k) - 0.5) * size * 0.3;
      const dx = (k - (n - 1) / 2) * push * 0.7;
      const dy = (rnd(w.i, 40 + k) - 0.5) * push * 1.4;
      c.save();
      c.translate(dx, dy);
      c.translate(w.x + w.w / 2, w.y);
      c.rotate((rnd(w.i, 50 + k) - 0.5) * 0.35 * (1 - u));
      c.translate(-(w.x + w.w / 2), -w.y);
      c.beginPath();
      c.moveTo(a + lean, w.y - h);
      c.lineTo(b + lean, w.y - h);
      c.lineTo(b - lean, w.y + h);
      c.lineTo(a - lean, w.y + h);
      c.closePath();
      c.clip();
      inked(c, w, -size * 0.04, 0, size, MP.c, 800);
      inked(c, w, size * 0.04, 0, size, MP.m, 800);
      inked(c, w, 0, 0, size, ink, 800);
      c.restore();
    }
  };
  const misprintWord = (c, w, u, q, size, ink) => {
    misprintDebris(c, w, u, size);
    if (u < 0.55) {
      const colors = [MP.violet, MP.m, MP.green, MP.gold];
      const n = 1 + (w.i % 3);
      alpha(c, 1 - seg(u, 0.2, 0.55), () => {
        for (let k = 0; k < n; k++) {
          const side = k % 2 ? 1 : -1;
          inked(c, w, side * size * (0.25 + rnd(w.i + q, 60 + k) * 0.35) * (1 - u), (rnd(w.i + q, 70 + k) - 0.5) * size * 0.3, size, colors[(w.i + k) % 4], 800);
        }
      });
    }
    if (u < 0.32) {
      misprintShards(c, w, u / 0.32, size, ink);
      return;
    }
    const gap = (1 - out(seg(u, 0.32, 1))) * size * 0.2 + size * 0.018;
    inked(c, w, -gap, -gap * 0.45, size, MP.c, 800);
    inked(c, w, gap, gap * 0.35, size, MP.m, 800);
    inked(c, w, gap * 0.3, -gap * 0.75, size, MP.y, 800);
    inked(c, w, 0, 0, size, ink, 800);
  };
  const misprintComb = (c, w, amp, q, size, ink, bg) => {
    const strips = 7;
    const h = (size * 1.3) / strips;
    const top = w.y - size * 0.65;
    c.fillStyle = bg;
    c.fillRect(w.x - 4, top, w.w + 8, size * 1.3);
    for (let k = 0; k < strips; k++) {
      c.save();
      c.beginPath();
      c.rect(w.x - amp - 8, top + k * h, w.w + amp * 2 + 16, h + 0.5);
      c.clip();
      const pick = rnd(k + q, 80);
      inked(c, w, (k % 2 ? 1 : -1) * amp * (0.4 + rnd(k + q, 81) * 0.6), 0, size, pick > 0.82 ? MP.c : pick > 0.66 ? MP.m : ink, 800);
      c.restore();
    }
  };
  const misprintBand = (c, L, line, amp, sep, q, ink, bg) => {
    const y = L.top + line * L.lh;
    const h = L.size * (0.3 + rnd(q, 90) * 0.28);
    const top = y - h + rnd(q, 91) * h;
    c.fillStyle = bg;
    c.fillRect(L.left - 4, top, L.wide + 8, h);
    c.save();
    c.beginPath();
    c.rect(L.left - amp - sep - 8, top, L.wide + (amp + sep) * 2 + 16, h);
    c.clip();
    L.list.filter((w) => w.line === line).forEach((w) => {
      inked(c, w, amp - sep, 0, L.size, MP.c, 500);
      inked(c, w, amp + sep, 0, L.size, MP.m, 500);
      inked(c, w, amp, 0, L.size, ink, 500);
    });
    c.restore();
  };
  M('misprint', '错位印刷', 'Misprint', '错版漫画的印刷：三色版错开，碎片归位，字面撕裂闪动', ['错位', '印错', '重影'], ['一杯咖啡，一个选择，一段时光'], 0, 5, (c, t, x) => {
    const L = misprintLayout(c, x.lineFull);
    const {size, list} = L;
    const n = list.length;
    const ink = x.p.ink;
    const print = Math.min(Math.max(0.5, x.T - 2.2), Math.max(0.9, n * 0.16));
    const startOf = (i) => 0.15 + (print * i) / Math.max(1, n);
    const each = 0.55;
    const idle = 0.15 + print + each + 0.2;
    // 一拍二：12 格一秒，有手绘的顿挫
    const q = Math.floor(t * 12);
    // 印完之后的闪动。结尾留出干净的字
    const seed = [...x.lineFull].reduce((a, ch) => a + ch.codePointAt(0), 0) % 997;
    let burst = null;
    if (!measuring) {
      let at0 = idle;
      for (let k = 0; k < 24; k++) {
        at0 += 0.55 + rnd(seed + k, 1) * 0.9;
        const type = Math.floor(rnd(seed + k, 2) * 3);
        const len = [0.17, 0.4, 0.75][type];
        if (at0 + len > x.T + 0.2) break;
        if (t >= at0 && t < at0 + len) burst = {k, type, u: (t - at0) / len};
        at0 += len;
      }
    }
    c.save();
    if (burst && burst.type === 2) c.translate((rnd(q, 100) - 0.5) * 9, (rnd(q, 101) - 0.5) * 5);
    list.forEach((w) => {
      const u = seg(t, startOf(w.i), startOf(w.i) + each);
      if (u <= 0) return;
      if (u >= 1) inked(c, w, 0, 0, size, ink, 500);
    });
    list.forEach((w) => {
      const u = seg(t, startOf(w.i), startOf(w.i) + each);
      if (u > 0 && u < 1) misprintWord(c, w, u, q, size, ink);
    });
    if (burst) {
      const {k, type} = burst;
      const word = list[Math.floor(rnd(seed + k, 3) * n)];
      if (word && type !== 1) misprintComb(c, word, size * (type === 2 ? 0.34 : 0.2), q, size, ink, x.p.bg);
      if (type !== 0) {
        const line = Math.floor(rnd(seed + k, 4) * L.lineCount);
        misprintBand(c, L, line, size * (0.3 + rnd(q, 92) * 0.5) * (rnd(q, 93) > 0.5 ? 1 : -1), size * 0.05, q, ink, x.p.bg);
      }
    }
    c.restore();
  });

  // 量一下这个组件实际占多大，放大到画面里看得清。视频不是网页，组件不能只占中间一小块
  const OFF_W = 480;
  const OFF_H = 270;
  const zoomOf = (item, x) => {
    const off = document.createElement('canvas');
    off.width = OFF_W;
    off.height = OFF_H;
    const g = off.getContext('2d', {willReadFrequently: true});
    let dx = 1;
    let dy = 1;
    measuring = true;
    try {
      for (let i = 1; i <= 8; i++) {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, OFF_W, OFF_H);
        g.setTransform(0.25, 0, 0, 0.25, 0, 0);
        g.save();
        item.draw(g, (x.T * i) / 8, x);
        g.restore();
        const data = g.getImageData(0, 0, OFF_W, OFF_H).data;
        for (let py = 0; py < OFF_H; py += 2) {
          for (let px = 0; px < OFF_W; px += 2) {
            if (data[(py * OFF_W + px) * 4 + 3] > 24) {
              dx = Math.max(dx, Math.abs(px - OFF_W / 2) * 4);
              dy = Math.max(dy, Math.abs(py - OFF_H / 2) * 4);
            }
          }
        }
      }
    } finally {
      measuring = false;
    }
    return clamp(Math.min(830 / dx, 450 / dy), 1, 2);
  };

  const FAMILY = {kxi: '交互', kxs: '状态', kxm: '质感'};
  const zooms = new Map();
  LIST.forEach((item) => {
    const id = `${item.cat}_${item.key}`;
    const sampleWords = item.words.filter(Boolean);
    const sampleNumber = NEEDS[id] === 'percent' ? `${item.num}%` : NEEDS[id] === 'two' ? `${Math.round(item.num * 0.6)} ${item.num}` : NEEDS[id] ? `${item.num}` : '';
    D.register(id, {
      name: item.name, family: FAMILY[item.cat], cat: item.cat, custom: true, library: true, colors: {},
      desc: item.desc, en: item.en, keywords: item.keywords, takesText: true,
      source: '自写，效果清单参考 Kinetics（Colorion）',
      sample: {lines: sampleNumber ? [`${sampleWords[0] || ''} ${sampleNumber}`.trim()].concat(sampleWords.slice(1)) : sampleWords.length ? sampleWords : ['示例']},
      accepts: (row) => hasNumbers(id, row) && !!(textOfRow(row).trim() || !item.words.some(Boolean)),
      create(row) {
        const p = PAL[row.theme === 'paper' ? 'paper' : 'black'];
        const raw = phrases(row);
        const needs = NEEDS[id];
        const got = needs ? raw.map(stripNumber).filter(Boolean) : raw;
        // 文稿有字就只用文稿的字；一句话也没有才用样例的字。默认字绝不混进成片
        const W = raw.length ? got : item.words.slice();
        if (!W.length) W.push('');
        const text = textOfRow(row);
        const nums = numbersOf(text);
        const pct = percentOf(text);
        const N = needs === 'percent' && pct !== null ? pct : nums.length ? (needs === 'two' ? nums[1] : nums[0]) : item.num;
        const N2 = nums.length > 1 ? nums[0] : Math.round(N * 0.6);
        const sp = D.speechOf(row);
        const T = Math.max(item.base, sp.dur + 0.4);
        const duration = T + (row.hold != null ? +row.hold : 0.6);
        const x = {p, W, N, N2, nums: nums.length ? nums : [N], T, lineFull: clean((row.lines && row.lines.join(' ')) || row.line || W[0])};
        const key = `${id}|${p.bg}|${x.lineFull}|${W.join('/')}|${N}`;
        if (!zooms.has(key)) zooms.set(key, zoomOf(item, x));
        const zoom = zooms.get(key);
        return {
          duration,
          draw(c) {
            c.bg();
            c.fillStyle = p.bg;
            c.fillRect(0, 0, 1920, 1080);
            const t = Math.max(0, c.el('widget', item.name));
            c.pathSig = Math.floor(t * 30);
            c.save();
            c.translate(CX, CY);
            c.scale(zoom, zoom);
            c.translate(-CX, -CY);
            item.draw(c, t, x);
            c.restore();
            c.pathSig = 0;
          },
        };
      },
    });
  });
  // 错位印刷是文字效果，放在文字特效这一类，来源单独写
  Object.assign(D.TEMPLATES.kxm_misprint, {cat: 'texfx', family: '文字特效', source: '自写，效果参考 Verse Text（Rajat Sethi）'});
  D.kineticsCount = LIST.length;
})(window);
