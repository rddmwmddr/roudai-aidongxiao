// 图表：31 种通用图型。发丝线、可数单位、一个强调色，每根柱、每个点都是一个元素，都能在画面里调。
// 数据一律写在这一镜上：
//   series: [{label, value, value2?, find?}]    比较、构成、分布
//   points: [{label, v}]                        时间序列
//   其余见每个图型的 sample
// 百分比镜头（groups）也能直接用，会转成 series。
(function (root) {
  'use strict';
  const D = root.DM;
  const TEXT = D.TEXT;
  const {clamp, lerp, progress, smooth, outCubic, outExpo, hex, mix, css} = D;

  const themeOf = (row) => {
    const id = row.theme || 'black';
    return id === 'paper'
      ? {id, bg: '#F1EFE8', ink: '#141416', mute: '#6F6C64', dim: '#CFCCC2', line: '#141416', accent: '#EE3A17'}
      : {id, bg: '#0A0A0B', ink: '#F4F1EA', mute: '#8E8B85', dim: '#363639', line: '#F4F1EA', accent: '#FF5C1E'};
  };
  const shade = (T, i, n) => css(mix(hex(T.accent), hex(T.dim), n <= 1 ? 0 : i / (n - 1) * 0.85));
  const fmt = (v, unit = '') => `${Math.abs(v) >= 100 || Number.isInteger(v) ? Math.round(v) : v.toFixed(1)}${unit}`;

  const seriesOf = (row) => {
    if (row.series && row.series.length) return row.series;
    const metrics = (row.groups || []).flatMap((g) => g.metrics || []).filter((m) => m.value != null);
    return metrics.map((m) => ({label: m.caption || '', value: +m.value, find: m.find}));
  };
  const pointsOf = (row) => {
    if (row.points && row.points.length) return row.points.map((p) => ({label: p.label, v: +p.v}));
    return seriesOf(row).map((s) => ({label: s.label, v: +s.value}));
  };
  const unitOf = (row) => (row.unit != null ? row.unit : row.groups && row.groups.length ? '%' : '');

  const text = (c, s, x, y, size, color, align = 'left', base = 'alphabetic', num = false) => {
    c.font = num ? D.numFont(size) : `${size}px ${D.FONT_CN}`;
    c.fillStyle = color;
    c.textAlign = align;
    c.textBaseline = base;
    c.fillText(s, x, y);
  };
  const fitLabel = (s, w, size, floor = 22) => D.fitSize(s, w, size, floor);

  // 念到哪个，哪个出现；念不到就按顺序来
  const beats = (row, items, start = 0.5, gap = 0.34, key = (x) => x.find || x.label) => {
    const sp = D.speechOf(row);
    let cursor = 0;
    return items.map((it, i) => {
      const k = key(it);
      const f = k ? sp.find(String(k), cursor) : null;
      if (f) {
        cursor = f.stop;
        return Math.max(start, f.start - 0.1);
      }
      return start + i * gap;
    });
  };

  const CANVAS = {x0: 110, x1: 1810, y0: 250, y1: 900};

  const chart = (id, name, desc, keywords, sample, accepts, build) => {
    D.register(id, {
      name, family: '图表', cat: 'chart', custom: true, chart: true, desc, keywords, sample, colors: {},
      accepts,
      create(row, S) {
        if (!accepts(row)) throw new Error('这一镜还缺数据');
        const T = themeOf(row);
        const sp = D.speechOf(row);
        const made = build(row, T);
        const dur = Math.max(sp.dur, made.last || 0) + (row.hold != null ? +row.hold : 2.4);
        const title = row.title || '';
        const draw = (c, t0) => {
          D.clearFrame(c, S, T.bg);
          if (title) {
            const t = c.el('title', title, TEXT);
            c.globalAlpha = progress(t, 0.05, 0.4);
            const s = fitLabel(title, 1700, 62, 34);
            text(c, title, CANVAS.x0, 130, s, T.ink);
            c.globalAlpha = 1;
          }
          made.draw(c, t0);
        };
        return {duration: dur, draw};
      },
    });
  };

  const needsSeries = (min, max = 200) => (r) => {
    const n = seriesOf(r).length;
    return n >= min && n <= max;
  };
  const needsPoints = (min) => (r) => pointsOf(r).length >= min;
  const REAL = ['甲', '乙', '丙', '丁', '戊', '己'];
  const SAMPLE_SERIES = {title: '', unit: '%', series: [{label: '拿铁', value: 62}, {label: '美式', value: 48}, {label: '手冲', value: 35}, {label: '冷萃', value: 22}, {label: '摩卡', value: 14}]};
  const SAMPLE_POINTS = {title: '', unit: '%', points: [{label: '2022', v: 8}, {label: '2023', v: 14}, {label: '2024', v: 31}, {label: '2025', v: 47}, {label: '2026', v: 88}]};

  // ---------- 比较 ----------
  chart('chBars', '柱状图', '几个类目比高低：柱子长出来，数字跟着顶上去。', ['柱状图', '柱形图'], SAMPLE_SERIES, needsSeries(2, 12), (row, T) => {
    const items = seriesOf(row);
    const unit = unitOf(row);
    const times = beats(row, items);
    const max = Math.max(...items.map((d) => d.value)) * 1.05;
    const {x0, x1, y0, y1} = CANVAS;
    const bw = (x1 - x0) / items.length;
    const top = items.findIndex((d) => d.value === Math.max(...items.map((x) => x.value)));
    return {
      last: times[times.length - 1] + 1,
      draw(c) {
        let t = c.el('axis', '基线');
        c.fillStyle = T.line;
        c.fillRect(x0, y1, (x1 - x0) * smooth(progress(t, 0.1, 0.6)), 2);
        items.forEach((d, i) => {
          t = c.el(`bar:${i}`, `${d.label}的柱子`);
          const k = D.runCurve(progress(t, times[i], times[i] + 0.9));
          const h = ((y1 - y0) * d.value * k) / max;
          c.fillStyle = i === top ? T.accent : T.mute;
          c.fillRect(x0 + bw * (i + 0.2), y1 - h, bw * 0.6, Math.max(h, 0));
          t = c.el(`val:${i}`, `${d.label}的数字`, TEXT);
          if (t >= times[i]) text(c, fmt(d.value * k, unit), x0 + bw * (i + 0.5), y1 - h - 18, 68, T.ink, 'center', 'alphabetic', true);
          t = c.el(`key:${i}`, d.label, TEXT);
          c.globalAlpha = progress(t, times[i] - 0.1, times[i] + 0.2);
          text(c, d.label, x0 + bw * (i + 0.5), y1 + 54, fitLabel(d.label, bw * 0.92, 40), T.ink, 'center');
          c.globalAlpha = 1;
        });
      },
    };
  });

  chart('chHBars', '排名条形图', '从高到低一条条长出来，长标签也放得下。', ['排名', '排行', '榜单', '第一名', '条形图'], SAMPLE_SERIES, needsSeries(2, 12), (row, T) => {
    const items = [...seriesOf(row)].sort((a, b) => b.value - a.value);
    const unit = unitOf(row);
    const times = beats(row, items);
    const max = items[0].value * 1.02;
    const {x1, y0, y1} = CANVAS;
    const lx = 110;
    const bx = 500;
    const h = Math.min(92, (y1 - y0) / items.length);
    return {
      last: times[times.length - 1] + 1,
      draw(c) {
        items.forEach((d, i) => {
          const y = y0 + i * ((y1 - y0) / items.length);
          let t = c.el(`key:${i}`, d.label, TEXT);
          c.globalAlpha = progress(t, times[i] - 0.1, times[i] + 0.2);
          text(c, d.label, lx, y + h * 0.42, fitLabel(d.label, bx - lx - 30, 44), T.ink, 'left', 'middle');
          c.globalAlpha = 1;
          t = c.el(`bar:${i}`, `${d.label}的条`);
          const k = D.runCurve(progress(t, times[i], times[i] + 0.9));
          const w = ((x1 - bx - 180) * d.value * k) / max;
          c.fillStyle = i === 0 ? T.accent : T.mute;
          c.fillRect(bx, y + h * 0.1, Math.max(w, 0), h * 0.64);
          t = c.el(`val:${i}`, `${d.label}的数字`, TEXT);
          if (t >= times[i]) text(c, fmt(d.value * k, unit), bx + w + 18, y + h * 0.42, 54, T.ink, 'left', 'middle', true);
        });
      },
    };
  });

  chart('chLollipop', '棒棒糖图', '细线加圆点：类目多时比柱子干净。', ['棒棒糖'], SAMPLE_SERIES, needsSeries(3, 24), (row, T) => {
    const items = seriesOf(row);
    const unit = unitOf(row);
    const times = beats(row, items, 0.4, 0.2);
    const max = Math.max(...items.map((d) => d.value)) * 1.08;
    const {x0, x1, y0, y1} = CANVAS;
    const bw = (x1 - x0) / items.length;
    return {
      last: times[times.length - 1] + 1,
      draw(c) {
        items.forEach((d, i) => {
          const x = x0 + bw * (i + 0.5);
          let t = c.el(`stick:${i}`, `${d.label}的线`);
          const k = outCubic(progress(t, times[i], times[i] + 0.7));
          const y = y1 - ((y1 - y0) * d.value * k) / max;
          c.fillStyle = T.mute;
          c.fillRect(x - 1, y, 2, y1 - y);
          t = c.el(`dot:${i}`, `${d.label}的点`);
          const kd = outCubic(progress(t, times[i], times[i] + 0.7));
          const yd = y1 - ((y1 - y0) * d.value * kd) / max;
          c.fillStyle = T.accent;
          c.beginPath();
          c.arc(x, yd, 15 * clamp(kd * 3), 0, Math.PI * 2);
          c.fill();
          t = c.el(`val:${i}`, `${d.label}的数字`, TEXT);
          const kv = outCubic(progress(t, times[i], times[i] + 0.7));
          if (kv > 0.05) text(c, fmt(d.value * kv, unit), x, y1 - ((y1 - y0) * d.value * kv) / max - 34, 46, T.ink, 'center', 'alphabetic', true);
          t = c.el(`key:${i}`, d.label, TEXT);
          c.globalAlpha = progress(t, times[i], times[i] + 0.3);
          text(c, d.label, x, y1 + 50, fitLabel(d.label, bw * 0.94, 34), T.ink, 'center');
          c.globalAlpha = 1;
        });
      },
    };
  });

  const pairedSample = {unit: '分', legend: ['去年', '今年'], series: [{label: '语文', value: 62, value2: 78}, {label: '数学', value: 71, value2: 66}, {label: '英语', value: 55, value2: 83}]};
  chart('chPaired', '分组柱状图', '每个类目两根柱：今年和去年、A 组和 B 组。', ['今年和去年', '同比', '去年和今年'], pairedSample, (r) => seriesOf(r).length >= 2 && seriesOf(r).every((d) => d.value2 != null), (row, T) => {
    const items = seriesOf(row);
    const unit = unitOf(row);
    const legend = row.legend || ['', ''];
    const times = beats(row, items);
    const max = Math.max(...items.flatMap((d) => [d.value, d.value2])) * 1.08;
    const {x0, x1, y0, y1} = CANVAS;
    const bw = (x1 - x0) / items.length;
    return {
      last: times[times.length - 1] + 1.2,
      draw(c) {
        legend.forEach((name, li) => {
          if (!name) return;
          c.el(`legend:${li}`, name, TEXT);
          c.fillStyle = li ? T.accent : T.mute;
          c.fillRect(x0 + li * 220, 190, 28, 28);
          text(c, name, x0 + li * 220 + 40, 204, 36, T.ink, 'left', 'middle');
        });
        items.forEach((d, i) => {
          [d.value, d.value2].forEach((v, j) => {
            const t = c.el(`bar:${i}:${j}`, `${d.label}${legend[j] || ''}`);
            const k = D.runCurve(progress(t, times[i] + j * 0.2, times[i] + j * 0.2 + 0.9));
            const h = ((y1 - y0) * v * k) / max;
            const x = x0 + bw * (i + 0.14 + j * 0.37);
            c.fillStyle = j ? T.accent : T.mute;
            c.fillRect(x, y1 - h, bw * 0.34, h);
            const tv = c.el(`val:${i}:${j}`, `${d.label}${legend[j] || ''}的数字`, TEXT);
            const kv = D.runCurve(progress(tv, times[i] + j * 0.2, times[i] + j * 0.2 + 0.9));
            if (kv > 0) text(c, fmt(v * kv, unit), x + bw * 0.17, y1 - ((y1 - y0) * v * kv) / max - 12, 46, T.ink, 'center', 'alphabetic', true);
          });
          const t = c.el(`key:${i}`, d.label, TEXT);
          c.globalAlpha = progress(t, times[i], times[i] + 0.3);
          text(c, d.label, x0 + bw * (i + 0.5), y1 + 54, fitLabel(d.label, bw * 0.9, 42), T.ink, 'center');
          c.globalAlpha = 1;
        });
        c.el('axis', '基线');
        c.fillStyle = T.line;
        c.fillRect(x0, y1, x1 - x0, 2);
      },
    };
  });

  chart('chDiverge', '正负条形图', '有涨有跌：以零为界往两边长。', ['涨跌', '正负', '盈亏', '有涨有跌'], {unit: '%', series: [{label: '教育', value: 42}, {label: '医疗', value: 18}, {label: '零售', value: -12}, {label: '旅游', value: -31}]}, (r) => seriesOf(r).some((d) => d.value < 0), (row, T) => {
    const items = seriesOf(row);
    const unit = unitOf(row);
    const times = beats(row, items);
    const max = Math.max(...items.map((d) => Math.abs(d.value))) * 1.1;
    const {y0, y1} = CANVAS;
    const mid = 1120;
    const span = 540;
    const h = (y1 - y0) / items.length;
    return {
      last: times[times.length - 1] + 1,
      draw(c) {
        c.el('zero', '零线');
        c.fillStyle = T.line;
        c.fillRect(mid - 1, y0 - 10, 2, y1 - y0 + 20);
        items.forEach((d, i) => {
          const y = y0 + i * h;
          let t = c.el(`key:${i}`, d.label, TEXT);
          c.globalAlpha = progress(t, times[i], times[i] + 0.3);
          text(c, d.label, 110, y + h / 2, fitLabel(d.label, 400, 46), T.ink, 'left', 'middle');
          c.globalAlpha = 1;
          t = c.el(`bar:${i}`, `${d.label}的条`);
          const k = D.runCurve(progress(t, times[i], times[i] + 0.9));
          const w = (span * d.value * k) / max;
          c.fillStyle = d.value >= 0 ? T.accent : T.mute;
          c.fillRect(Math.min(mid, mid + w), y + h * 0.16, Math.abs(w), h * 0.62);
          t = c.el(`val:${i}`, `${d.label}的数字`, TEXT);
          if (t >= times[i]) text(c, `${d.value > 0 ? '+' : ''}${fmt(d.value * k, unit)}`, mid + w + (d.value >= 0 ? 16 : -16), y + h * 0.47, 50, T.ink, d.value >= 0 ? 'left' : 'right', 'middle', true);
        });
      },
    };
  });

  chart('chDumbbell', '前后对比图', '同一类目前后两个点：一条线从之前走到之后。', ['之前和之后', '前后对比', '从原来的', '变成了'], {unit: '分', legend: ['之前', '之后'], series: [{label: '写作', value: 72, value2: 44}, {label: '检索', value: 81, value2: 52}, {label: '判断', value: 66, value2: 30}]}, (r) => seriesOf(r).length >= 1 && seriesOf(r).every((d) => d.value2 != null), (row, T) => {
    const items = seriesOf(row);
    const unit = unitOf(row);
    const times = beats(row, items);
    const all = items.flatMap((d) => [d.value, d.value2]);
    const lo = Math.min(...all) * 0.85;
    const hi = Math.max(...all) * 1.08;
    const {y0, y1} = CANVAS;
    const X = (v) => 520 + ((v - lo) / (hi - lo)) * 1200;
    const h = (y1 - y0) / items.length;
    return {
      last: times[times.length - 1] + 1.3,
      draw(c) {
        items.forEach((d, i) => {
          const y = y0 + (i + 0.5) * h;
          let t = c.el(`key:${i}`, d.label, TEXT);
          c.globalAlpha = progress(t, times[i], times[i] + 0.3);
          text(c, d.label, 110, y, fitLabel(d.label, 380, 46), T.ink, 'left', 'middle');
          c.globalAlpha = 1;
          t = c.el(`from:${i}`, `${d.label}之前`);
          c.globalAlpha = progress(t, times[i], times[i] + 0.25);
          c.fillStyle = T.mute;
          c.beginPath();
          c.arc(X(d.value), y, 16, 0, Math.PI * 2);
          c.fill();
          text(c, fmt(d.value, unit), X(d.value), y - 34, 44, T.mute, 'center', 'alphabetic', true);
          c.globalAlpha = 1;
          t = c.el(`to:${i}`, `${d.label}之后`);
          const k = smooth(progress(t, times[i] + 0.3, times[i] + 1.1));
          if (k <= 0) return;
          const x = lerp(X(d.value), X(d.value2), k);
          c.strokeStyle = T.accent;
          c.lineWidth = 5;
          c.beginPath();
          c.moveTo(X(d.value), y);
          c.lineTo(x, y);
          c.stroke();
          c.fillStyle = T.accent;
          c.beginPath();
          c.arc(x, y, 20, 0, Math.PI * 2);
          c.fill();
          text(c, fmt(lerp(d.value, d.value2, k), unit), x, y + 66, 56, T.ink, 'center', 'alphabetic', true);
        });
      },
    };
  });

  chart('chRace', '排名赛跑', '排名随时间变化：条形互相超车。', ['超过了', '超车', '反超', '赶超'], {unit: '万', frames: [{label: '第一年', values: {拿铁: 1, 美式: 2, 手冲: 1.5, 冷萃: 0.5}}, {label: '第二年', values: {拿铁: 4, 美式: 3, 手冲: 2, 冷萃: 3.4}}, {label: '第三年', values: {拿铁: 7.2, 美式: 4.4, 手冲: 3, 冷萃: 8.1}}]}, (r) => r.frames && r.frames.length >= 2, (row, T) => {
    const unit = unitOf(row);
    const frames = row.frames;
    const names = Object.keys(frames[0].values);
    const step = Math.max(1.8, D.speechOf(row).dur / (frames.length - 1));
    const at = (name, u) => {
      const i = clamp(Math.floor(u), 0, frames.length - 2);
      return lerp(frames[i].values[name] || 0, frames[i + 1].values[name] || 0, smooth(clamp(u - i)));
    };
    const rankAt = (u) => [...names].sort((a, b) => at(b, u) - at(a, u));
    const {y0, y1} = CANVAS;
    const rowH = (y1 - y0) / names.length;
    const max = Math.max(...frames.flatMap((f) => Object.values(f.values))) * 1.05;
    return {
      last: 0.4 + step * (frames.length - 1),
      draw(c) {
        // 每个元素按自己的时间算名次和数值，调一个的速度不影响别的
        const stateAt = (t, name) => {
          const u = clamp((t - 0.4) / step, 0, frames.length - 1);
          const before = rankAt(Math.floor(u));
          const after = rankAt(Math.min(frames.length - 1, Math.floor(u) + 1));
          const f = smooth(clamp(u - Math.floor(u)));
          return {y: y0 + lerp(before.indexOf(name), after.indexOf(name), f) * rowH, v: at(name, u), lead: after[0] === name, u};
        };
        names.forEach((name, i) => {
          let t = c.el(`bar:${i}`, `${name}的条`);
          let s = stateAt(t, name);
          c.fillStyle = s.lead ? T.accent : T.mute;
          c.fillRect(420, s.y + rowH * 0.14, (1180 * s.v) / max, rowH * 0.66);
          t = c.el(`key:${i}`, name, TEXT);
          s = stateAt(t, name);
          text(c, name, 396, s.y + rowH * 0.47, 46, T.ink, 'right', 'middle');
          t = c.el(`val:${i}`, `${name}的数字`, TEXT);
          s = stateAt(t, name);
          text(c, fmt(s.v, unit), 420 + (1180 * s.v) / max + 16, s.y + rowH * 0.47, 54, T.ink, 'left', 'middle', true);
        });
        const t = c.el('year', '年份', TEXT);
        const u = clamp((t - 0.4) / step, 0, frames.length - 1);
        text(c, frames[clamp(Math.round(u), 0, frames.length - 1)].label, 1810, y1 - 10, 150, T.dim, 'right', 'alphabetic', true);
      },
    };
  });

  // ---------- 构成 ----------
  const arcChart = (row, T, opts) => {
    const items = seriesOf(row);
    const unit = unitOf(row);
    const sum = items.reduce((a, d) => a + d.value, 0) || 1;
    const times = beats(row, items, 0.4, 0.5);
    const cx = 600;
    const cy = 570;
    const R = 340;
    let acc = -Math.PI / 2;
    const arcs = items.map((d, i) => {
      const a0 = acc;
      acc += (d.value / sum) * Math.PI * 2;
      return {d, a0, a1: acc, at: times[i], i};
    });
    return {
      last: times[times.length - 1] + 1.1,
      draw(c) {
        arcs.forEach((s) => {
          let t = c.el(`arc:${s.i}`, `${s.d.label}的扇区`);
          const k = smooth(progress(t, s.at, s.at + 0.8));
          if (k > 0) {
            c.fillStyle = shade(T, s.i, items.length);
            c.beginPath();
            if (opts.pie) c.moveTo(cx, cy);
            c.arc(cx, cy, R, s.a0, lerp(s.a0, s.a1, k) - 0.008);
            if (!opts.pie) c.arc(cx, cy, R - opts.thick, lerp(s.a0, s.a1, k) - 0.008, s.a0, true);
            c.closePath();
            c.fill();
          }
          const y = 300 + s.i * (Math.min(120, 620 / items.length));
          t = c.el(`row:${s.i}`, s.d.label, TEXT);
          c.globalAlpha = progress(t, s.at, s.at + 0.3);
          c.fillStyle = shade(T, s.i, items.length);
          c.fillRect(1090, y - 16, 32, 32);
          text(c, s.d.label, 1140, y, fitLabel(s.d.label, 420, 46), T.ink, 'left', 'middle');
          text(c, fmt(s.d.value, unit), 1810, y, 62, T.ink, 'right', 'middle', true);
          c.globalAlpha = 1;
        });
        if (!opts.pie && items.length) {
          const t = c.el('center', '中间的数字', TEXT);
          const top = items.reduce((a, b) => (b.value > a.value ? b : a));
          c.globalAlpha = progress(t, 0.6, 1);
          text(c, fmt(unit === '%' ? top.value : (top.value / sum) * 100, '%'), cx, cy, 124, T.ink, 'center', 'middle', true);
          c.globalAlpha = 1;
        }
      },
    };
  };
  const compSample = {unit: '%', series: [{label: '工作', value: 46}, {label: '学习', value: 27}, {label: '生活', value: 18}, {label: '娱乐', value: 9}]};
  chart('chDonut', '环形图', '100% 分成几段：一段段画出来，中间写最大的那段。', ['环形图', '构成', '占比'], compSample, needsSeries(2, 7), (row, T) => arcChart(row, T, {thick: 110}));
  chart('chPie', '饼图', '几块加起来是整体。', ['饼图', '一块'], compSample, needsSeries(2, 7), (row, T) => arcChart(row, T, {pie: true}));

  chart('chWaffle', '百格图', '一百个格子一格一格涂：比饼图更容易数。', ['百格', '一百个格子', '每一百'], compSample, needsSeries(1, 6), (row, T) => {
    const items = seriesOf(row);
    const unit = unitOf(row);
    const sum = items.reduce((a, d) => a + d.value, 0);
    const scale = sum > 100 || sum <= 0 ? 100 / (sum || 1) : 1;
    const times = beats(row, items, 0.4, 0.7);
    const size = 62;
    const gap = 8;
    const x0 = 150;
    const y0 = 190;
    let cursor = 0;
    const owners = [];
    items.forEach((d, i) => {
      const n = Math.round(d.value * scale);
      for (let k = 0; k < n && cursor < 100; k++, cursor++) owners[cursor] = {i, k, n};
    });
    return {
      last: times[times.length - 1] + 1.3,
      draw(c) {
        c.el('grid', '空格子');
        c.fillStyle = T.dim;
        for (let n = 0; n < 100; n++) c.fillRect(x0 + (n % 10) * (size + gap), y0 + Math.floor(n / 10) * (size + gap), size, size);
        items.forEach((d, i) => {
          let t = c.el(`cells:${i}`, `${d.label}的格子`);
          c.fillStyle = shade(T, i, items.length);
          owners.forEach((o, n) => {
            if (!o || o.i !== i) return;
            const a = smooth(progress(t, times[i] + (o.k / o.n) * 0.7, times[i] + (o.k / o.n) * 0.7 + 0.2));
            if (a <= 0) return;
            const s = size * a;
            c.fillRect(x0 + (n % 10) * (size + gap) + (size - s) / 2, y0 + Math.floor(n / 10) * (size + gap) + (size - s) / 2, s, s);
          });
          t = c.el(`row:${i}`, d.label, TEXT);
          const y = 300 + i * 130;
          c.globalAlpha = progress(t, times[i], times[i] + 0.3);
          text(c, fmt(d.value, unit), 1000, y, 96, shade(T, i, items.length), 'left', 'middle', true);
          text(c, d.label, 1260, y, fitLabel(d.label, 550, 46), T.ink, 'left', 'middle');
          c.globalAlpha = 1;
        });
      },
    };
  });

  chart('chStack', '堆叠条', '一根条切成几段，看每段占多少。', ['堆叠', '分成几部分'], compSample, needsSeries(2, 7), (row, T) => {
    const items = seriesOf(row);
    const unit = unitOf(row);
    const sum = items.reduce((a, d) => a + d.value, 0) || 1;
    const times = beats(row, items, 0.4, 0.5);
    const x0 = 110;
    const W = 1700;
    let acc = 0;
    const seg = items.map((d, i) => {
      const s = {d, i, x: x0 + (acc / sum) * W, w: (d.value / sum) * W, at: times[i]};
      acc += d.value;
      return s;
    });
    return {
      last: times[times.length - 1] + 1,
      draw(c) {
        seg.forEach((s) => {
          let t = c.el(`seg:${s.i}`, `${s.d.label}这一段`);
          const k = outCubic(progress(t, s.at, s.at + 0.7));
          c.fillStyle = shade(T, s.i, items.length);
          c.fillRect(s.x, 470, Math.max(0, s.w * k - 4), 190);
          t = c.el(`val:${s.i}`, s.d.label, TEXT);
          c.globalAlpha = progress(t, s.at + 0.1, s.at + 0.4);
          const below = s.i % 2 === 1;
          text(c, fmt(s.d.value, unit), s.x, below ? 760 : 420, 84, T.ink, 'left', 'alphabetic', true);
          text(c, s.d.label, s.x, below ? 820 : 340, fitLabel(s.d.label, Math.max(s.w, 240), 40), T.mute, 'left');
          c.globalAlpha = 1;
        });
      },
    };
  });

  // 面积 = 数值。按比例一刀一刀切
  const squarify = (items, x, y, w, h) => {
    if (!items.length) return [];
    if (items.length === 1) return [{d: items[0], x, y, w, h}];
    const sum = items.reduce((a, d) => a + d.value, 0);
    let acc = 0;
    let split = 0;
    for (; split < items.length - 1; split++) {
      if (acc + items[split].value > sum / 2 && split > 0) break;
      acc += items[split].value;
    }
    const left = items.slice(0, split);
    const right = items.slice(split);
    const k = acc / sum;
    if (w >= h) return [...squarify(left, x, y, w * k, h), ...squarify(right, x + w * k, y, w * (1 - k), h)];
    return [...squarify(left, x, y, w, h * k), ...squarify(right, x, y + h * k, w, h * (1 - k))];
  };
  chart('chTreemap', '矩形树图', '面积就是数值：一眼看出谁占得多。', ['矩形树图', '版图', '盘子'], SAMPLE_SERIES, needsSeries(3, 30), (row, T) => {
    const items = [...seriesOf(row)].sort((a, b) => b.value - a.value);
    const unit = unitOf(row);
    const cells = squarify(items, 110, 200, 1700, 780);
    const times = beats(row, cells.map((x) => x.d), 0.4, 0.22);
    return {
      last: times[times.length - 1] + 1,
      draw(c) {
        cells.forEach((b, i) => {
          let t = c.el(`cell:${i}`, b.d.label);
          const k = outCubic(progress(t, times[i], times[i] + 0.6));
          if (k <= 0) return;
          c.fillStyle = shade(T, i, cells.length);
          c.fillRect(b.x + 3, b.y + 3, (b.w - 6) * k, (b.h - 6) * k);
          t = c.el(`txt:${i}`, `${b.d.label}的文字`, TEXT);
          c.globalAlpha = progress(t, times[i] + 0.2, times[i] + 0.5);
          if (b.w > 120 && b.h > 80) {
            const s = fitLabel(b.d.label, b.w - 40, Math.min(46, b.h / 3), 20);
            text(c, b.d.label, b.x + 20, b.y + 22 + s, s, T.bg);
            text(c, fmt(b.d.value, unit), b.x + 20, b.y + b.h - 26, Math.min(72, b.h / 2.4), T.bg, 'left', 'alphabetic', true);
          }
          c.globalAlpha = 1;
        });
      },
    };
  });

  // ---------- 趋势 ----------
  const lineChart = (row, T, opts) => {
    const pts = pointsOf(row);
    const unit = unitOf(row);
    const sp = D.speechOf(row);
    const dur = Math.max(1.6, Math.min(sp.dur, opts.fast ? 2.4 : sp.dur));
    const {x0, x1, y0, y1} = CANVAS;
    const vals = pts.map((p) => p.v);
    const hi = Math.max(...vals) * 1.1;
    const lo = Math.min(0, Math.min(...vals));
    const X = (i) => x0 + (i / Math.max(1, pts.length - 1)) * (x1 - x0 - 120);
    const Y = (v) => y1 - ((v - lo) / (hi - lo)) * (y1 - y0);
    return {
      last: 0.3 + dur,
      draw(c) {
        let t = c.el('axis', '基线');
        c.fillStyle = T.line;
        c.fillRect(x0, y1, x1 - x0, 2);
        t = c.el('line', '折线');
        const u = clamp(progress(t, 0.3, 0.3 + dur)) * (pts.length - 1);
        const n = Math.floor(u);
        const f = u - n;
        const headX = n >= pts.length - 1 ? X(pts.length - 1) : lerp(X(n), X(n + 1), f);
        const headV = n >= pts.length - 1 ? pts[pts.length - 1].v : lerp(pts[n].v, pts[n + 1].v, f);
        const path = () => {
          c.beginPath();
          c.moveTo(X(0), Y(pts[0].v));
          for (let i = 1; i <= Math.min(n, pts.length - 1); i++) c.lineTo(X(i), Y(pts[i].v));
          c.lineTo(headX, Y(headV));
        };
        if (opts.area) {
          path();
          c.lineTo(headX, y1);
          c.lineTo(X(0), y1);
          c.closePath();
          c.fillStyle = css(hex(T.accent), 0.28);
          c.fill();
        }
        path();
        c.strokeStyle = T.accent;
        c.lineWidth = opts.area ? 5 : 7;
        c.lineJoin = 'round';
        c.stroke();
        const at = (time) => {
          const v = clamp(progress(time, 0.3, 0.3 + dur)) * (pts.length - 1);
          const i = Math.min(Math.floor(v), pts.length - 1);
          const next = Math.min(i + 1, pts.length - 1);
          return {x: lerp(X(i), X(next), v - i), v: lerp(pts[i].v, pts[next].v, v - i)};
        };
        t = c.el('head', '线头的点');
        const h = at(t);
        c.fillStyle = T.accent;
        c.beginPath();
        c.arc(h.x, Y(h.v), 15, 0, Math.PI * 2);
        c.fill();
        if (opts.counter) {
          t = c.el('counter', '大数字', TEXT);
          text(c, fmt(at(t).v, unit), x0, y0 + 140, 240, T.ink, 'left', 'alphabetic', true);
        }
        pts.forEach((p, i) => {
          if (pts.length > 14 && i % Math.ceil(pts.length / 8)) return;
          const tk = c.el(`key:${i}`, p.label || `第 ${i + 1} 个`, TEXT);
          const on = progress(tk, 0.3 + (i / Math.max(1, pts.length - 1)) * dur - 0.1, 0.3 + (i / Math.max(1, pts.length - 1)) * dur + 0.15);
          c.globalAlpha = on;
          text(c, p.label || '', X(i), y1 + 50, 34, T.mute, 'center');
          if (!opts.counter && pts.length <= 14) text(c, fmt(p.v, unit), X(i), Y(p.v) - 28, 50, T.ink, 'center', 'alphabetic', true);
          c.globalAlpha = 1;
        });
      },
    };
  };
  chart('chLine', '折线图', '随时间变化的数：一条线画出来。', ['折线', '趋势', '这几年', '逐年', '每年'], SAMPLE_POINTS, needsPoints(3), (row, T) => lineChart(row, T, {}));
  chart('chArea', '面积图', '折线加面积：强调累积的量。', ['面积图', '累积'], SAMPLE_POINTS, needsPoints(3), (row, T) => lineChart(row, T, {area: true}));
  chart('chDraw', '一笔画加大数', '线一笔画完，大数字跟着跳：适合开场报一个累计数。', ['一路走高', '一路上涨', '累计增长'], SAMPLE_POINTS, needsPoints(3), (row, T) => lineChart(row, T, {counter: true, fast: true}));

  const manyPoints = {unit: '', points: Array.from({length: 60}, (_, i) => ({label: `${i + 1}`, v: Math.round(30 + 22 * Math.sin(i / 5) + i * 0.8 + ((i * 37) % 17))}))};
  chart('chBarcode', '逐日条码', '每天一根细条：几十上百天的序列排成条码。', ['每一天', '逐日', '这一百天', '每天'], manyPoints, needsPoints(20), (row, T) => {
    const pts = pointsOf(row);
    const {x0, x1, y0, y1} = CANVAS;
    const max = Math.max(...pts.map((p) => p.v));
    const peak = pts.findIndex((p) => p.v === max);
    const w = (x1 - x0) / pts.length;
    const lastT = Math.max(2, D.speechOf(row).dur * 0.7);
    return {
      last: lastT,
      draw(c) {
        const t = c.el('bars', '全部细条');
        const head = progress(t, 0.2, lastT);
        pts.forEach((p, i) => {
          const a = smooth(progress(head * pts.length, i, i + 6));
          if (a <= 0) return;
          const h = ((y1 - y0) * p.v * a) / max;
          c.fillStyle = i === peak ? T.accent : T.mute;
          c.fillRect(x0 + i * w, y1 - h, Math.max(1.5, w * 0.56), h);
        });
        const tp = c.el('peak', '最高的数', TEXT);
        if (tp >= lastT) text(c, fmt(max, unitOf(row)), x0 + peak * w, y0 - 14, 72, T.ink, peak > pts.length * 0.8 ? 'right' : 'left', 'alphabetic', true);
      },
    };
  });

  chart('chStream', '河流图', '几条支流一起流：看构成随时间怎么变。', ['河流图', '此消彼长', '份额变化'], {streams: [{name: '搜索', values: [60, 54, 46, 38, 30, 24]}, {name: 'AI 对话', values: [4, 10, 20, 32, 44, 58]}, {name: '短视频', values: [26, 28, 26, 22, 20, 14]}], labels: ['2021', '2022', '2023', '2024', '2025', '2026']}, (r) => r.streams && r.streams.length >= 2, (row, T) => {
    const layers = row.streams;
    const n = layers[0].values.length;
    const totals = Array.from({length: n}, (_, i) => layers.reduce((a, l) => a + l.values[i], 0));
    const max = Math.max(...totals);
    const {x0, x1, y0, y1} = CANVAS;
    const mid = (y0 + y1) / 2;
    const H = (y1 - y0) / max;
    const X = (i) => x0 + (i / (n - 1)) * (x1 - x0 - 240);
    const lastT = Math.max(2, D.speechOf(row).dur * 0.8);
    return {
      last: lastT,
      draw(c) {
        let t = 0;
        layers.forEach((l, li) => {
          t = c.el(`layer:${li}`, l.name);
          const k = progress(t, 0.2, lastT);
          const tops = [];
          const bots = [];
          for (let i = 0; i < n; i++) {
            let a = mid - (totals[i] * H) / 2;
            for (let j = 0; j < li; j++) a += layers[j].values[i] * H;
            tops.push(a);
            bots.push(a + l.values[i] * H);
          }
          c.save();
          c.beginPath();
          c.rect(x0 - 4, y0 - 40, (x1 - x0 - 240) * k + 8, y1 - y0 + 80);
          c.clip();
          c.fillStyle = shade(T, li, layers.length);
          c.beginPath();
          c.moveTo(X(0), tops[0]);
          for (let i = 1; i < n; i++) c.bezierCurveTo((X(i - 1) + X(i)) / 2, tops[i - 1], (X(i - 1) + X(i)) / 2, tops[i], X(i), tops[i]);
          c.lineTo(X(n - 1), bots[n - 1]);
          for (let i = n - 2; i >= 0; i--) c.bezierCurveTo((X(i + 1) + X(i)) / 2, bots[i + 1], (X(i + 1) + X(i)) / 2, bots[i], X(i), bots[i]);
          c.closePath();
          c.fill();
          c.restore();
          t = c.el(`name:${li}`, l.name, TEXT);
          c.globalAlpha = progress(t, lastT - 0.4, lastT);
          text(c, l.name, X(n - 1) + 24, (tops[n - 1] + bots[n - 1]) / 2, 44, T.ink, 'left', 'middle');
          c.globalAlpha = 1;
        });
        (row.labels || []).forEach((label, i) => {
          const tk = c.el(`key:${i}`, label, TEXT);
          c.globalAlpha = progress(tk, 0.2, 0.6);
          text(c, label, X(i), y1 + 50, 34, T.mute, 'center');
          c.globalAlpha = 1;
        });
      },
    };
  });

  chart('chWaterfall', '瀑布图', '从起点到终点，一步步加减。', ['瀑布', '加上', '减去', '扣掉', '最后剩下'], {unit: '万', series: [{label: '收入', value: 320}, {label: '成本', value: -140}, {label: '人工', value: -80}, {label: '补贴', value: 30}, {label: '利润', value: 130, total: true}]}, (r) => seriesOf(r).length >= 3 && seriesOf(r).some((d) => d.value < 0), (row, T) => {
    const items = seriesOf(row);
    const unit = unitOf(row);
    const times = beats(row, items);
    let run = 0;
    const steps = items.map((d) => {
      const from = d.total ? 0 : run;
      const to = d.total ? d.value : run + d.value;
      if (!d.total) run = to;
      return {d, from, to};
    });
    const max = Math.max(...steps.flatMap((s) => [s.from, s.to])) * 1.1;
    const {x0, x1, y0, y1} = CANVAS;
    const bw = (x1 - x0) / items.length;
    const Y = (v) => y1 - ((y1 - y0) * v) / max;
    return {
      last: times[times.length - 1] + 1,
      draw(c) {
        c.el('axis', '基线');
        c.fillStyle = T.line;
        c.fillRect(x0, y1, x1 - x0, 2);
        steps.forEach((s, i) => {
          let t = c.el(`bar:${i}`, `${s.d.label}的柱子`);
          const k = D.runCurve(progress(t, times[i], times[i] + 0.8));
          const cur = lerp(s.from, s.to, k);
          c.fillStyle = s.d.total ? T.ink : s.d.value >= 0 ? T.accent : T.mute;
          c.fillRect(x0 + bw * (i + 0.16), Math.min(Y(s.from), Y(cur)), bw * 0.68, Math.abs(Y(s.from) - Y(cur)));
          t = c.el(`val:${i}`, `${s.d.label}的数字`, TEXT);
          if (t >= times[i]) text(c, `${s.d.value > 0 && !s.d.total ? '+' : ''}${fmt(s.d.value * k, unit)}`, x0 + bw * (i + 0.5), Math.min(Y(s.from), Y(cur)) - 16, 54, T.ink, 'center', 'alphabetic', true);
          t = c.el(`key:${i}`, s.d.label, TEXT);
          c.globalAlpha = progress(t, times[i], times[i] + 0.3);
          text(c, s.d.label, x0 + bw * (i + 0.5), y1 + 54, fitLabel(s.d.label, bw * 0.9, 42), T.ink, 'center');
          c.globalAlpha = 1;
        });
      },
    };
  });

  chart('chCandle', 'K 线图', '开高低收四个价：涨跌一根根走出来。', ['K线', 'K 线', '股价', '行情'], {ohlc: Array.from({length: 26}, (_, i) => {
    const b = 40 + i * 1.6 + 8 * Math.sin(i / 2.6);
    const e = b + 6 * Math.sin(i * 1.7);
    return {o: +b.toFixed(1), c: +e.toFixed(1), h: +(Math.max(b, e) + 3).toFixed(1), l: +(Math.min(b, e) - 3).toFixed(1)};
  })}, (r) => r.ohlc && r.ohlc.length >= 3, (row, T) => {
    const list = row.ohlc;
    const {x0, x1, y0, y1} = CANVAS;
    const hi = Math.max(...list.map((d) => d.h));
    const lo = Math.min(...list.map((d) => d.l));
    const Y = (v) => y1 - ((v - lo) / (hi - lo)) * (y1 - y0);
    const w = (x1 - x0) / list.length;
    const lastT = Math.max(2, D.speechOf(row).dur * 0.75);
    return {
      last: lastT,
      draw(c) {
        const t = c.el('candles', '全部 K 线');
        const head = progress(t, 0.2, lastT) * list.length;
        list.forEach((d, i) => {
          const a = progress(head, i, i + 1);
          if (a <= 0) return;
          const up = d.c >= d.o;
          const x = x0 + (i + 0.5) * w;
          c.globalAlpha = a;
          c.strokeStyle = up ? T.accent : T.mute;
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(x, Y(d.h));
          c.lineTo(x, Y(d.l));
          c.stroke();
          c.fillStyle = up ? T.accent : T.mute;
          c.fillRect(x - w * 0.3, Math.min(Y(d.o), Y(d.c)), w * 0.6, Math.max(2, Math.abs(Y(d.o) - Y(d.c))));
        });
        c.globalAlpha = 1;
      },
    };
  });

  chart('chCalendar', '日历热力图', '一年 365 格：哪天多、哪天少。', ['一整年', '日历', '每天打卡', '365'], {days: Array.from({length: 364}, (_, i) => Math.round(((Math.sin(i / 40) + 1) * 3 + ((i * 53) % 11) / 3 + (i > 240 ? 3 : 0))))}, (r) => r.days && r.days.length >= 28, (row, T) => {
    const days = row.days;
    const weeks = Math.ceil(days.length / 7);
    const s = Math.min(1700 / weeks, 80);
    const x0 = 960 - (weeks * s) / 2;
    const y0 = 540 - (7 * s) / 2;
    const max = Math.max(...days) || 1;
    const lastT = Math.max(2, D.speechOf(row).dur * 0.7);
    return {
      last: lastT,
      draw(c) {
        const t = c.el('days', '全部日子');
        const head = progress(t, 0.2, lastT) * weeks;
        days.forEach((v, i) => {
          const w = Math.floor(i / 7);
          const a = smooth(progress(head, w, w + 3));
          c.fillStyle = a > 0 ? css(mix(hex(T.dim), hex(T.accent), (a * v) / max)) : T.dim;
          c.fillRect(x0 + w * s, y0 + (i % 7) * s, s - 3, s - 3);
        });
      },
    };
  });

  // ---------- 分布 ----------
  chart('chScatter', '散点图', '两个维度看关系：每个点是一个对象。', ['散点', '相关', '正相关', '两个维度'], {xLabel: '使用时长', yLabel: '信任程度', points: Array.from({length: 40}, (_, i) => ({x: 10 + ((i * 37) % 90), y: Math.round(12 + ((i * 37) % 90) * 0.7 + ((i * 53) % 24)), label: ''}))}, (r) => r.points && r.points.length >= 5 && r.points[0].x != null, (row, T) => {
    const pts = row.points;
    const {x0, x1, y0, y1} = CANVAS;
    const hx = Math.max(...pts.map((p) => p.x)) * 1.05;
    const hy = Math.max(...pts.map((p) => p.y)) * 1.05;
    const lastT = Math.max(1.6, D.speechOf(row).dur * 0.7);
    return {
      last: lastT,
      draw(c) {
        let t = c.el('axis', '坐标轴');
        c.fillStyle = T.mute;
        c.fillRect(x0, y1, x1 - x0, 2);
        c.fillRect(x0, y0, 2, y1 - y0);
        if (row.xLabel) text(c, row.xLabel, x1, y1 + 50, 36, T.mute, 'right');
        if (row.yLabel) text(c, row.yLabel, x0, y0 - 20, 36, T.mute);
        t = c.el('dots', '全部点');
        pts.forEach((p, i) => {
          const a = backOutSafe(progress(t, 0.2 + (i / pts.length) * lastT * 0.8, 0.2 + (i / pts.length) * lastT * 0.8 + 0.4));
          if (a <= 0) return;
          c.fillStyle = T.accent;
          c.beginPath();
          c.arc(x0 + (p.x / hx) * (x1 - x0), y1 - (p.y / hy) * (y1 - y0), 13 * a, 0, Math.PI * 2);
          c.fill();
        });
      },
    };
  });
  const backOutSafe = (x) => (x <= 0 ? 0 : 1 + 2.7 * (x - 1) ** 3 + 1.7 * (x - 1) ** 2);

  chart('chHist', '直方图', '落在每一段里有多少：看分布的形状。', ['直方图', '分布', '集中在'], {unit: '', series: [{label: '0–1', value: 8}, {label: '1–2', value: 21}, {label: '2–3', value: 46}, {label: '3–4', value: 62}, {label: '4–5', value: 38}, {label: '5–6', value: 17}, {label: '6–7', value: 6}]}, needsSeries(5, 40), (row, T) => {
    const items = seriesOf(row);
    const max = Math.max(...items.map((d) => d.value)) * 1.08;
    const {x0, x1, y0, y1} = CANVAS;
    const w = (x1 - x0) / items.length;
    const times = items.map((_, i) => 0.3 + i * 0.09);
    return {
      last: times[times.length - 1] + 1,
      draw(c) {
        items.forEach((d, i) => {
          const t = c.el(`bar:${i}`, `${d.label}这一段`);
          const k = outCubic(progress(t, times[i], times[i] + 0.7));
          const h = ((y1 - y0) * d.value * k) / max;
          c.fillStyle = d.value === Math.max(...items.map((x) => x.value)) ? T.accent : T.mute;
          c.fillRect(x0 + i * w, y1 - h, w - 2, h);
          const tk = c.el(`key:${i}`, d.label, TEXT);
          c.globalAlpha = progress(tk, times[i], times[i] + 0.3);
          text(c, d.label, x0 + (i + 0.5) * w, y1 + 44, fitLabel(d.label, w * 0.94, 30, 18), T.mute, 'center');
          c.globalAlpha = 1;
        });
      },
    };
  });

  chart('chBox', '箱线图', '每组的中位数和上下范围。', ['箱线', '中位数', '四分位'], {unit: '分', boxes: [{label: 'A 组', min: 24, q1: 41, med: 58, q3: 70, max: 92}, {label: 'B 组', min: 12, q1: 30, med: 44, q3: 61, max: 80}, {label: 'C 组', min: 36, q1: 55, med: 71, q3: 82, max: 98}]}, (r) => r.boxes && r.boxes.length >= 1, (row, T) => {
    const boxes = row.boxes;
    const unit = unitOf(row);
    const times = beats(row, boxes, 0.4, 0.5);
    const hi = Math.max(...boxes.map((b) => b.max)) * 1.05;
    const lo = Math.min(...boxes.map((b) => b.min)) * 0.9;
    const X = (v) => 460 + ((v - lo) / (hi - lo)) * 1300;
    const {y0, y1} = CANVAS;
    const h = (y1 - y0) / boxes.length;
    return {
      last: times[times.length - 1] + 1,
      draw(c) {
        boxes.forEach((b, i) => {
          const y = y0 + (i + 0.5) * h;
          let t = c.el(`key:${i}`, b.label, TEXT);
          c.globalAlpha = progress(t, times[i], times[i] + 0.3);
          text(c, b.label, 110, y, 46, T.ink, 'left', 'middle');
          c.globalAlpha = 1;
          t = c.el(`box:${i}`, `${b.label}的箱子`);
          const k = smooth(progress(t, times[i], times[i] + 0.7));
          const P2 = (v) => lerp(X(b.med), X(v), k);
          c.fillStyle = T.mute;
          c.fillRect(P2(b.min), y - 1, P2(b.max) - P2(b.min), 2);
          c.fillRect(P2(b.min) - 1, y - 16, 2, 32);
          c.fillRect(P2(b.max) - 1, y - 16, 2, 32);
          c.fillStyle = css(hex(T.accent), 0.3);
          c.fillRect(P2(b.q1), y - 38, P2(b.q3) - P2(b.q1), 76);
          c.fillStyle = T.accent;
          c.fillRect(X(b.med) - 3, y - 38, 6, 76);
          t = c.el(`val:${i}`, `${b.label}的中位数`, TEXT);
          if (k > 0.8) text(c, fmt(b.med, unit), X(b.med), y - 56, 46, T.ink, 'center', 'alphabetic', true);
        });
      },
    };
  });

  chart('chWave', '波浪柱', '几十根柱子像波浪一样依次长出来。', ['几十个', '这么多', '五十个', '所有市场'], {unit: '', series: Array.from({length: 48}, (_, i) => ({label: `${i + 1}`, value: Math.round(24 + 40 * Math.abs(Math.sin(i / 7)) + ((i * 29) % 21))}))}, needsSeries(20, 200), (row, T) => {
    const items = seriesOf(row);
    const max = Math.max(...items.map((d) => d.value));
    const {x0, x1, y0, y1} = CANVAS;
    const w = (x1 - x0) / items.length;
    const lastT = 2.6;
    return {
      last: lastT,
      draw(c) {
        const t = c.el('bars', '全部柱子');
        items.forEach((d, i) => {
          const at = 0.2 + (i / items.length) * 1.3;
          const a = D.runCurve(progress(t, at, at + 0.8));
          const h = ((y1 - y0) * d.value * a) / max;
          c.fillStyle = d.value === max ? T.accent : T.mute;
          c.fillRect(x0 + i * w, y1 - h, w * 0.66, h);
        });
      },
    };
  });

  chart('chHeat', '矩阵热力图', '两个维度交叉：颜色越深数越大。', ['热力', '矩阵', '交叉'], {rows: ['写作', '检索', '编程', '翻译'], cols: ['学生', '白领', '老师', '医生', '工程师'], cells: [[84, 62, 71, 30, 40], [66, 78, 55, 49, 72], [28, 34, 12, 8, 91], [58, 44, 39, 21, 33]]}, (r) => r.cells && r.rows && r.cols, (row, T) => {
    const {rows, cols, cells} = row;
    const max = Math.max(...cells.flat());
    const x0 = 360;
    const y0 = 240;
    const W = 1450 / cols.length;
    const H = 670 / rows.length;
    return {
      last: 2 + rows.length * 0.2,
      draw(c) {
        cols.forEach((name, j) => {
          const t = c.el(`col:${j}`, name, TEXT);
          c.globalAlpha = progress(t, 0.2, 0.5);
          text(c, name, x0 + (j + 0.5) * W, y0 - 22, fitLabel(name, W * 0.92, 38), T.mute, 'center');
          c.globalAlpha = 1;
        });
        rows.forEach((name, i) => {
          let t = c.el(`row:${i}`, name, TEXT);
          c.globalAlpha = progress(t, 0.2, 0.5);
          text(c, name, 110, y0 + (i + 0.5) * H, fitLabel(name, 230, 40), T.ink, 'left', 'middle');
          c.globalAlpha = 1;
          cells[i].forEach((v, j) => {
            t = c.el(`cell:${i}:${j}`, `${name}×${cols[j]}`);
            const a = smooth(progress(t, 0.3 + (i + j) * 0.1, 0.3 + (i + j) * 0.1 + 0.5));
            c.fillStyle = css(mix(hex(T.dim), hex(T.accent), (a * v) / max));
            c.fillRect(x0 + j * W + 2, y0 + i * H + 2, W - 4, H - 4);
            if (a > 0.6) text(c, fmt(v, unitOf(row)), x0 + (j + 0.5) * W, y0 + (i + 0.5) * H, Math.min(56, H / 2.2), T.ink, 'center', 'middle', true);
          });
        });
      },
    };
  });

  // ---------- 流向与关系 ----------
  chart('chFunnel', '漏斗图', '一层层变少：每层写清还剩多少。', ['漏斗', '转化', '流失', '留下来', '只剩下', '层层'], {unit: '人', series: [{label: '看到广告', value: 5000}, {label: '点进页面', value: 2100}, {label: '开始试用', value: 860}, {label: '付费', value: 240}]}, needsSeries(2, 8), (row, T) => {
    const items = [...seriesOf(row)];
    const unit = unitOf(row);
    const times = beats(row, items, 0.4, 0.6);
    const max = Math.max(...items.map((d) => d.value));
    const {y0, y1} = CANVAS;
    const h = (y1 - y0) / items.length;
    const mid = 760;
    const W = 1100;
    return {
      last: times[times.length - 1] + 1,
      draw(c) {
        items.forEach((d, i) => {
          const y = y0 + i * h;
          let t = c.el(`layer:${i}`, `${d.label}这一层`);
          const a = outCubic(progress(t, times[i], times[i] + 0.6));
          const w = (W * d.value * a) / max;
          const next = i + 1 < items.length ? (W * items[i + 1].value * a) / max : w * 0.86;
          c.fillStyle = shade(T, i, items.length);
          c.beginPath();
          c.moveTo(mid - w / 2, y);
          c.lineTo(mid + w / 2, y);
          c.lineTo(mid + next / 2, y + h - 5);
          c.lineTo(mid - next / 2, y + h - 5);
          c.closePath();
          c.fill();
          t = c.el(`row:${i}`, d.label, TEXT);
          c.globalAlpha = progress(t, times[i], times[i] + 0.3);
          text(c, fmt(d.value, unit), 1400, y + h * 0.36, 66, T.ink, 'left', 'middle', true);
          text(c, d.label, 1400, y + h * 0.76, fitLabel(d.label, 410, 34), T.mute, 'left', 'middle');
          c.globalAlpha = 1;
        });
      },
    };
  });

  chart('chSankey', '桑基图', '从哪来、到哪去：带子宽度就是数量。', ['桑基', '流向', '流入', '流到'], {links: [{from: '搜索', to: '网站', v: 40}, {from: '搜索', to: 'App', v: 20}, {from: 'AI', to: 'App', v: 35}, {from: 'AI', to: '小程序', v: 25}, {from: '短视频', to: '小程序', v: 30}, {from: '短视频', to: 'App', v: 10}]}, (r) => r.links && r.links.length >= 2 && r.links[0].from != null && r.links[0].v != null, (row, T) => {
    const links = row.links;
    const left = [...new Set(links.map((l) => l.from))];
    const right = [...new Set(links.map((l) => l.to))];
    const sumBy = (key, name) => links.filter((l) => l[key] === name).reduce((a, l) => a + l.v, 0);
    const total = links.reduce((a, l) => a + l.v, 0);
    const {y0, y1} = CANVAS;
    const pad = 22;
    const H = (y1 - y0 - pad * (Math.max(left.length, right.length) - 1)) / total;
    const col = (names, key) => {
      let y = y0;
      const pos = {};
      names.forEach((n) => {
        pos[n] = {y, used: 0, h: sumBy(key, n) * H};
        y += pos[n].h + pad;
      });
      return pos;
    };
    const L = col(left, 'from');
    const R = col(right, 'to');
    const X0 = 400;
    const X1 = 1500;
    const wired = links.map((l) => {
      const h = l.v * H;
      const a = L[l.from].y + L[l.from].used;
      const b = R[l.to].y + R[l.to].used;
      L[l.from].used += h;
      R[l.to].used += h;
      return {l, h, a, b};
    });
    return {
      last: 1 + links.length * 0.22 + 1,
      draw(c) {
        wired.forEach((w, i) => {
          const t = c.el(`link:${i}`, `${w.l.from}到${w.l.to}`);
          const k = smooth(progress(t, 0.4 + i * 0.2, 0.4 + i * 0.2 + 0.9));
          if (k <= 0) return;
          c.save();
          c.beginPath();
          c.rect(X0, 0, (X1 - X0) * k, 1080);
          c.clip();
          c.fillStyle = css(mix(hex(T.accent), hex(T.dim), left.indexOf(w.l.from) / Math.max(1, left.length - 1) * 0.7), 0.7);
          const m = (X0 + X1) / 2;
          c.beginPath();
          c.moveTo(X0, w.a);
          c.bezierCurveTo(m, w.a, m, w.b, X1, w.b);
          c.lineTo(X1, w.b + w.h);
          c.bezierCurveTo(m, w.b + w.h, m, w.a + w.h, X0, w.a + w.h);
          c.closePath();
          c.fill();
          c.restore();
        });
        left.forEach((n, i) => {
          const t = c.el(`from:${i}`, n, TEXT);
          c.globalAlpha = progress(t, 0.1, 0.4);
          c.fillStyle = T.ink;
          c.fillRect(X0 - 8, L[n].y, 8, L[n].h);
          text(c, n, X0 - 26, L[n].y + L[n].h / 2, 44, T.ink, 'right', 'middle');
          c.globalAlpha = 1;
        });
        right.forEach((n, i) => {
          const t = c.el(`to:${i}`, n, TEXT);
          c.globalAlpha = progress(t, 1, 1.4);
          c.fillStyle = T.ink;
          c.fillRect(X1, R[n].y, 8, R[n].h);
          text(c, n, X1 + 26, R[n].y + R[n].h / 2, 44, T.ink, 'left', 'middle');
          c.globalAlpha = 1;
        });
      },
    };
  });

  chart('chRadial', '径向条形图', '一圈一圈的进度：几个比例放在一起看。', ['一圈', '径向'], {unit: '%', series: [{label: '写作', value: 78}, {label: '搜索', value: 64}, {label: '编程', value: 41}, {label: '绘图', value: 26}]}, needsSeries(2, 6), (row, T) => {
    const items = seriesOf(row);
    const unit = unitOf(row);
    const times = beats(row, items, 0.4, 0.5);
    const max = unit === '%' ? 100 : Math.max(...items.map((d) => d.value)) * 1.05;
    const cx = 620;
    const cy = 560;
    const step = Math.min(70, 330 / items.length);
    return {
      last: times[times.length - 1] + 1.1,
      draw(c) {
        items.forEach((d, i) => {
          const r = 400 - i * step;
          let t = c.el(`track:${i}`, `${d.label}的底圈`);
          c.strokeStyle = T.dim;
          c.lineWidth = step * 0.58;
          c.beginPath();
          c.arc(cx, cy, r, 0, Math.PI * 2);
          c.stroke();
          t = c.el(`arc:${i}`, `${d.label}的弧`);
          const k = D.runCurve(progress(t, times[i], times[i] + 1));
          c.strokeStyle = shade(T, i, items.length);
          c.lineCap = 'round';
          c.beginPath();
          c.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + ((d.value * k) / max) * Math.PI * 2);
          c.stroke();
          c.lineCap = 'butt';
          t = c.el(`row:${i}`, d.label, TEXT);
          const y = 330 + i * Math.min(110, 480 / items.length);
          c.globalAlpha = progress(t, times[i], times[i] + 0.3);
          text(c, d.label, 1150, y, fitLabel(d.label, 400, 46), T.ink, 'left', 'middle');
          text(c, fmt(d.value * k, unit), 1810, y, 70, T.ink, 'right', 'middle', true);
          c.globalAlpha = 1;
        });
      },
    };
  });

  chart('chNetwork', '关系网络', '谁和谁有关系：节点一个个亮，连线一条条出现。', ['关系网', '网络', '互相连接', '人际'], {center: 'AI', nodes: ['写作', '搜索', '编程', '翻译', '绘图', '客服', '教育', '医疗'], links: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [0, 4], [2, 6]]}, (r) => r.nodes && r.nodes.length >= 3, (row, T) => {
    const nodes = row.nodes;
    const links = (row.links || []).filter(Array.isArray);
    const cx = 960;
    const cy = 590;
    const R = 340;
    const pos = nodes.map((_, i) => {
      const a = -Math.PI / 2 + (i / nodes.length) * Math.PI * 2;
      return [cx + Math.cos(a) * R * 1.5, cy + Math.sin(a) * R];
    });
    const times = nodes.map((_, i) => 0.3 + i * 0.16);
    return {
      last: times[times.length - 1] + links.length * 0.1 + 1,
      draw(c) {
        links.forEach(([a, b], i) => {
          const t = c.el(`link:${i}`, `${nodes[a]}和${nodes[b]}的连线`);
          const k = smooth(progress(t, times[times.length - 1] + i * 0.08, times[times.length - 1] + i * 0.08 + 0.5));
          if (k <= 0 || !pos[a] || !pos[b]) return;
          c.strokeStyle = T.mute;
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(pos[a][0], pos[a][1]);
          c.lineTo(lerp(pos[a][0], pos[b][0], k), lerp(pos[a][1], pos[b][1], k));
          c.stroke();
        });
        if (row.center) {
          nodes.forEach((n, i) => {
            const t = c.el(`spoke:${i}`, `${n}到中心`);
            const k = smooth(progress(t, times[i], times[i] + 0.4));
            c.strokeStyle = css(hex(T.accent), 0.5);
            c.lineWidth = 2;
            c.beginPath();
            c.moveTo(cx, cy);
            c.lineTo(lerp(cx, pos[i][0], k), lerp(cy, pos[i][1], k));
            c.stroke();
          });
          const t = c.el('center', row.center, TEXT);
          c.globalAlpha = progress(t, 0.1, 0.4);
          c.fillStyle = T.accent;
          c.beginPath();
          c.arc(cx, cy, 86, 0, Math.PI * 2);
          c.fill();
          text(c, row.center, cx, cy, fitLabel(row.center, 150, 62), T.bg, 'center', 'middle');
          c.globalAlpha = 1;
        }
        nodes.forEach((n, i) => {
          const t = c.el(`node:${i}`, n, TEXT);
          const a = backOutSafe(progress(t, times[i], times[i] + 0.4));
          if (a <= 0) return;
          c.fillStyle = T.ink;
          c.beginPath();
          c.arc(pos[i][0], pos[i][1], 13 * a, 0, Math.PI * 2);
          c.fill();
          text(c, n, pos[i][0], pos[i][1] + (pos[i][1] > cy ? 56 : -30), 42, T.ink, 'center');
        });
      },
    };
  });

  chart('chTree', '树状图', '从总到分，一层层展开。', ['树状', '层级', '分成', '下面有', '产品线'], {tree: {name: '咖啡', children: [{name: '热饮', children: [{name: '拿铁'}, {name: '美式'}, {name: '手冲'}]}, {name: '冷饮', children: [{name: '冷萃'}, {name: '冰滴'}]}]}}, (r) => r.tree && r.tree.name, (row, T) => {
    const levels = [];
    let leaves = 0;
    const walk = (n, depth) => {
      const item = {n, depth, kids: []};
      (levels[depth] = levels[depth] || []).push(item);
      const kids = n.children || [];
      if (!kids.length) item.y = leaves++;
      else {
        item.kids = kids.map((k) => walk(k, depth + 1));
        item.y = (item.kids[0].y + item.kids[item.kids.length - 1].y) / 2;
      }
      return item;
    };
    const rootItem = walk(row.tree, 0);
    const {y0, y1} = CANVAS;
    const Y = (v) => y0 + ((v + 0.5) / leaves) * (y1 - y0);
    const X = (d) => 150 + (d / Math.max(1, levels.length - 1)) * 1350;
    const all = levels.flat();
    return {
      last: 0.4 + levels.length * 0.6 + 0.8,
      draw(c) {
        all.forEach((item, i) => {
          const at = 0.4 + item.depth * 0.6;
          item.kids.forEach((k, ki) => {
            const t = c.el(`edge:${i}:${ki}`, `${item.n.name}到${k.n.name}`);
            const a = smooth(progress(t, at, at + 0.5));
            if (a <= 0) return;
            const xa = X(item.depth) + 8;
            const xb = lerp(xa, X(k.depth) - 8, a);
            const m = (xa + X(k.depth)) / 2;
            c.strokeStyle = T.mute;
            c.lineWidth = 2;
            c.beginPath();
            c.moveTo(xa, Y(item.y));
            c.bezierCurveTo(m, Y(item.y), m, Y(k.y), xb, lerp(Y(item.y), Y(k.y), a));
            c.stroke();
          });
          const t = c.el(`node:${i}`, item.n.name, TEXT);
          const a = progress(t, at - 0.55, at - 0.2);
          if (a <= 0 && item.depth > 0) return;
          c.globalAlpha = item.depth === 0 ? progress(t, 0.1, 0.4) : a;
          c.fillStyle = item === rootItem ? T.accent : T.ink;
          c.beginPath();
          c.arc(X(item.depth), Y(item.y), 10, 0, Math.PI * 2);
          c.fill();
          const leaf = !item.kids.length;
          text(c, item.n.name, X(item.depth) + (leaf ? 24 : 0), Y(item.y) + (leaf ? 0 : -30), 44, T.ink, leaf ? 'left' : 'center', leaf ? 'middle' : 'alphabetic');
          c.globalAlpha = 1;
        });
      },
    };
  });

  chart('chGauge', '进度环', '一个数走完一圈：离目标还有多远。', ['进度', '完成了', '离目标', '目标'], {unit: '%', series: [{label: '已完成', value: 72}]}, needsSeries(1, 1), (row, T) => {
    const d = seriesOf(row)[0];
    const unit = unitOf(row);
    const max = unit === '%' ? 100 : d.max || d.value * 1.25;
    const times = beats(row, [d], 0.4);
    return {
      last: times[0] + 1.6,
      draw(c) {
        const cx = 960;
        const cy = 560;
        const R = 350;
        let t = c.el('ticks', '刻度');
        for (let i = 0; i < 100; i++) {
          const a = -Math.PI / 2 + (i / 100) * Math.PI * 2;
          const long = i % 10 === 0;
          c.fillStyle = T.dim;
          c.save();
          c.translate(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
          c.rotate(a);
          c.fillRect(0, -1.5, long ? 34 : 18, 3);
          c.restore();
        }
        t = c.el('arc', '进度弧');
        const k = D.runCurve(progress(t, times[0], times[0] + 1.3));
        c.strokeStyle = T.accent;
        c.lineWidth = 26;
        c.lineCap = 'round';
        c.beginPath();
        c.arc(cx, cy, R - 34, -Math.PI / 2, -Math.PI / 2 + ((d.value * k) / max) * Math.PI * 2);
        c.stroke();
        c.lineCap = 'butt';
        t = c.el('val', '数字', TEXT);
        text(c, fmt(d.value * D.runCurve(progress(t, times[0], times[0] + 1.3)), unit), cx, cy - 10, 170, T.ink, 'center', 'middle', true);
        t = c.el('key', d.label, TEXT);
        c.globalAlpha = progress(t, times[0], times[0] + 0.4);
        text(c, d.label, cx, cy + 118, fitLabel(d.label, 480, 48), T.mute, 'center', 'middle');
        c.globalAlpha = 1;
      },
    };
  });

  // ---------- 下面 10 种的样子来自 Lieflat Charts（Glance 组和大图），原来用 ECharts 画，这里按帧重写 ----------
  chart('chPictorial', '符号柱', '一个符号代表固定数量，逐年摞起来。', ['种了', '一棵', '每个符号'], {unit: '棵', each: 100, series: [{label: '2022', value: 300}, {label: '2023', value: 500}, {label: '2024', value: 800}, {label: '2025', value: 1200}]}, needsSeries(2, 10), (row, T) => {
    const items = seriesOf(row);
    const each = row.each || Math.max(1, Math.ceil(Math.max(...items.map((d) => d.value)) / 12));
    const times = beats(row, items, 0.4, 0.45);
    const {x0, x1, y1} = CANVAS;
    const w = (x1 - x0) / items.length;
    return {
      last: times[times.length - 1] + 1.2,
      draw(c) {
        items.forEach((d, i) => {
          const n = Math.round(d.value / each);
          let t = c.el(`col:${i}`, `${d.label}的符号`);
          for (let k = 0; k < n; k++) {
            const a = backOutSafe(progress(t, times[i] + k * 0.05, times[i] + k * 0.05 + 0.35));
            if (a <= 0) continue;
            c.fillStyle = k === n - 1 ? T.accent : T.mute;
            c.beginPath();
            c.arc(x0 + w * (i + 0.5), y1 - 28 - k * 50, 20 * a, 0, Math.PI * 2);
            c.fill();
          }
          t = c.el(`key:${i}`, d.label, TEXT);
          c.globalAlpha = progress(t, times[i], times[i] + 0.3);
          text(c, d.label, x0 + w * (i + 0.5), y1 + 54, 40, T.ink, 'center');
          text(c, fmt(d.value, unitOf(row)), x0 + w * (i + 0.5), y1 + 106, 44, T.mute, 'center', 'alphabetic', true);
          c.globalAlpha = 1;
        });
      },
    };
  });

  chart('chRainfall', '雨量双面积', '投入从上往下落，产出从下往上涨。', ['投入和产出', '投了多少', '换来'], {topName: '投放', bottomName: '收入', labels: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月'], top: [8, 22, 14, 30, 12, 26, 18, 34], bottom: [10, 16, 28, 26, 40, 44, 58, 62]}, (r) => r.top && r.bottom && r.top.length >= 3, (row, T) => {
    const n = row.top.length;
    const {x0, x1, y0, y1} = CANVAS;
    const mid = (y0 + y1) / 2;
    const X = (i) => x0 + (i / (n - 1)) * (x1 - x0);
    const hiT = Math.max(...row.top);
    const hiB = Math.max(...row.bottom);
    const half = (y1 - y0) / 2 - 12;
    const lastT = Math.max(2, D.speechOf(row).dur * 0.8);
    const area = (c, values, hi, up, k) => {
      c.beginPath();
      c.moveTo(X(0), mid);
      const end = k * (n - 1);
      for (let i = 0; i <= Math.floor(end); i++) c.lineTo(X(i), mid + (up ? -1 : 1) * (values[i] / hi) * half);
      if (end < n - 1) {
        const i = Math.floor(end);
        const v = lerp(values[i], values[i + 1], end - i);
        c.lineTo(lerp(X(i), X(i + 1), end - i), mid + (up ? -1 : 1) * (v / hi) * half);
      }
      c.lineTo(lerp(X(0), X(n - 1), k), mid);
      c.closePath();
      c.fill();
    };
    return {
      last: lastT,
      draw(c) {
        let t = c.el('axis', '中线');
        c.fillStyle = T.line;
        c.fillRect(x0, mid - 1, x1 - x0, 2);
        t = c.el('rain', row.topName || '上面的面积');
        c.fillStyle = T.mute;
        area(c, row.top, hiT, false, progress(t, 0.2, lastT));
        t = c.el('rise', row.bottomName || '下面的面积');
        c.fillStyle = T.accent;
        area(c, row.bottom, hiB, true, progress(t, 0.2, lastT));
        t = c.el('names', '名称', TEXT);
        c.globalAlpha = progress(t, 0.2, 0.6);
        if (row.bottomName) text(c, row.bottomName, x0, y0 + 30, 46, T.accent);
        if (row.topName) text(c, row.topName, x0, y1 - 8, 46, T.mute);
        c.globalAlpha = 1;
      },
    };
  });

  chart('chMorph', '散点变形', '同一批点换三种排法：同一份数据看三个角度。', ['换个角度', '同一批', '三个角度'], {views: ['按地区', '按年龄', '按收入'], points: Array.from({length: 48}, (_, i) => ({a: i % 4, b: (i * 7) % 5, c: (i * 13) % 100}))}, (r) => r.views && r.points && r.points.length >= 6 && r.points[0].a != null, (row, T) => {
    const pts = row.points;
    const step = Math.max(2, D.speechOf(row).dur / Math.max(1, row.views.length));
    const {x0, x1, y0, y1} = CANVAS;
    const place = (p, view, i) => {
      if (view % 3 === 0) return [x0 + 150 + p.a * 460 + ((i * 37) % 9) * 40 - 160, y0 + 120 + ((i * 53) % 9) * 50];
      if (view % 3 === 1) return [x0 + 140 + p.b * 340 + ((i * 11) % 7) * 34 - 110, y1 - 40 - ((i * 29) % 11) * 46];
      return [x0 + (p.c / 100) * (x1 - x0), y1 - 40 - (p.c / 100) * (y1 - y0 - 80) + ((i * 17) % 5) * 12 - 24];
    };
    return {
      last: step * row.views.length,
      draw(c) {
        let t = c.el('dots', '全部点');
        const u = Math.max(0, t) / step;
        const v = Math.min(row.views.length - 1, Math.floor(u));
        const f = smooth(clamp((u - v - 0.7) / 0.3));
        const next = Math.min(row.views.length - 1, v + 1);
        pts.forEach((p, i) => {
          const a = place(p, v, i);
          const b = place(p, next, i);
          c.fillStyle = i % 5 === 0 ? T.accent : T.mute;
          c.beginPath();
          c.arc(lerp(a[0], b[0], f), lerp(a[1], b[1], f), 14, 0, Math.PI * 2);
          c.fill();
        });
        t = c.el('view', '当前角度', TEXT);
        text(c, row.views[Math.min(row.views.length - 1, Math.floor(Math.max(0, t) / step))], x0, 130, 62, T.ink);
      },
    };
  });

  chart('chBigSlice', '大切片', '角度是占比，半径是强度：一块又大又深。', ['又大又', '既多又'], {unit: '%', series: [{label: '工作', value: 46, weight: 90}, {label: '学习', value: 27, weight: 60}, {label: '生活', value: 18, weight: 40}, {label: '娱乐', value: 9, weight: 70}]}, (r) => seriesOf(r).length >= 2 && seriesOf(r).every((d) => d.weight != null), (row, T) => {
    const items = seriesOf(row);
    const sum = items.reduce((a, d) => a + d.value, 0) || 1;
    const maxW = Math.max(...items.map((d) => d.weight));
    const times = beats(row, items, 0.4, 0.5);
    const cx = 620;
    const cy = 570;
    let acc = -Math.PI / 2;
    const arcs = items.map((d, i) => {
      const a0 = acc;
      acc += (d.value / sum) * Math.PI * 2;
      return {d, i, a0, a1: acc, R: 170 + (d.weight / maxW) * 270};
    });
    return {
      last: times[times.length - 1] + 1.1,
      draw(c) {
        arcs.forEach((s) => {
          let t = c.el(`slice:${s.i}`, `${s.d.label}的切片`);
          const k = outCubic(progress(t, times[s.i], times[s.i] + 0.8));
          if (k > 0) {
            c.fillStyle = shade(T, s.i, items.length);
            c.beginPath();
            c.moveTo(cx, cy);
            c.arc(cx, cy, s.R * k, s.a0, s.a1 - 0.012);
            c.closePath();
            c.fill();
          }
          t = c.el(`row:${s.i}`, s.d.label, TEXT);
          const y = 300 + s.i * Math.min(120, 620 / items.length);
          c.globalAlpha = progress(t, times[s.i], times[s.i] + 0.3);
          text(c, s.d.label, 1140, y, 46, T.ink, 'left', 'middle');
          text(c, fmt(s.d.value, unitOf(row)), 1810, y, 62, T.ink, 'right', 'middle', true);
          c.globalAlpha = 1;
        });
      },
    };
  });

  chart('chSingleAxis', '单轴气泡', '每天一条轴，气泡大小是数量：一周的节奏。', ['每周', '周一到周日', '什么时段'], {rows: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'], cols: Array.from({length: 24}, (_, i) => `${i}`), cells: Array.from({length: 7}, (_, d) => Array.from({length: 24}, (_, h) => Math.round(Math.max(0, 12 * Math.sin(((h - 6) / 24) * Math.PI * 2) + 4 + ((d * 7 + h * 3) % 6) - (d > 4 ? 6 : 0)))))}, (r) => r.cells && r.rows && r.cols && r.cols.length >= 12, (row, T) => {
    const {rows, cols, cells} = row;
    const max = Math.max(...cells.flat()) || 1;
    const x0 = 280;
    const W = 1530 / cols.length;
    const y0 = 220;
    const H = 680 / rows.length;
    return {
      last: 0.4 + rows.length * 0.2 + 1,
      draw(c) {
        rows.forEach((name, i) => {
          let t = c.el(`key:${i}`, name, TEXT);
          c.globalAlpha = progress(t, 0.1 + i * 0.1, 0.4 + i * 0.1);
          text(c, name, 110, y0 + (i + 0.5) * H, 42, T.ink, 'left', 'middle');
          c.globalAlpha = 1;
          t = c.el(`row:${i}`, `${name}的气泡`);
          cells[i].forEach((v, j) => {
            const a = backOutSafe(progress(t, 0.3 + i * 0.1 + j * 0.02, 0.3 + i * 0.1 + j * 0.02 + 0.4));
            if (v <= 0 || a <= 0) return;
            c.fillStyle = v === max ? T.accent : T.mute;
            c.beginPath();
            c.arc(x0 + (j + 0.5) * W, y0 + (i + 0.5) * H, Math.sqrt(v / max) * Math.min(W, H) * 0.46 * a, 0, Math.PI * 2);
            c.fill();
          });
        });
      },
    };
  });

  chart('chJitter', '抖动分布', '分组摊开每一条记录：看散不散。', ['每一条记录', '抖动', '离散'], {unit: '分钟', groups2: [{label: '免费版', values: Array.from({length: 90}, (_, i) => 4 + ((i * 37) % 60))}, {label: '专业版', values: Array.from({length: 90}, (_, i) => 2 + ((i * 53) % 26))}, {label: '企业版', values: Array.from({length: 90}, (_, i) => 1 + ((i * 29) % 12))}]}, (r) => r.groups2 && r.groups2.length >= 1, (row, T) => {
    const list = row.groups2;
    const hi = Math.max(...list.flatMap((g) => g.values)) * 1.05;
    const X = (v) => 400 + (v / hi) * 1400;
    const {y0, y1} = CANVAS;
    const h = (y1 - y0) / list.length;
    const times = beats(row, list, 0.4, 0.7);
    return {
      last: times[times.length - 1] + 1.4,
      draw(c) {
        list.forEach((g, i) => {
          const y = y0 + (i + 0.5) * h;
          let t = c.el(`key:${i}`, g.label, TEXT);
          c.globalAlpha = progress(t, times[i], times[i] + 0.3);
          text(c, g.label, 110, y, 44, T.ink, 'left', 'middle');
          c.globalAlpha = 1;
          t = c.el(`dots:${i}`, `${g.label}的点`);
          g.values.forEach((v, k) => {
            const a = progress(t, times[i] + (k / g.values.length) * 0.9, times[i] + (k / g.values.length) * 0.9 + 0.3);
            if (a <= 0) return;
            c.fillStyle = css(hex(T.accent), 0.65 * a);
            c.beginPath();
            c.arc(X(v), y + (((k * 53) % 100) / 100 - 0.5) * h * 0.72, 7, 0, Math.PI * 2);
            c.fill();
          });
          const sorted = [...g.values].sort((a, b) => a - b);
          const med = sorted[sorted.length >> 1];
          t = c.el(`med:${i}`, `${g.label}的中位数`);
          const m = smooth(progress(t, times[i] + 0.9, times[i] + 1.3));
          c.fillStyle = T.ink;
          c.fillRect(X(med) - 2, y - h * 0.42 * m, 4, h * 0.84 * m);
        });
      },
    };
  });

  chart('chLive', '实时滚动线', '线一直往前走，旧数据滚出去：像直播大屏。', ['实时', '此刻', '正在', '同时在线'], {unit: '', values: Array.from({length: 120}, (_, i) => Math.round(60 + 26 * Math.sin(i / 7) + 12 * Math.sin(i / 2.3) + i * 0.18))}, (r) => r.values && r.values.length >= 30, (row, T) => {
    const list = row.values;
    const {x0, x1, y0, y1} = CANVAS;
    const span = Math.floor(list.length * 0.5);
    const hi = Math.max(...list) * 1.08;
    const lastT = Math.max(3, D.speechOf(row).dur * 0.9);
    return {
      last: lastT,
      draw(c) {
        // 走到哪、线头在哪：一个时间对应一个位置
        const headAt = (t) => lerp(span, list.length - 1, smooth(progress(t, 0.2, lastT)));
        const X = (i, head) => x0 + ((i - (head - span)) / span) * (x1 - x0 - 150);
        const valueAt = (head) => {
          const i = Math.floor(head);
          return lerp(list[i], list[Math.min(list.length - 1, i + 1)], head - i);
        };
        let t = c.el('line', '滚动的线');
        const head = headAt(t);
        c.strokeStyle = T.accent;
        c.lineWidth = 5;
        c.lineJoin = 'round';
        c.beginPath();
        for (let i = Math.ceil(head - span); i <= Math.floor(head); i++) {
          const px = X(i, head);
          const py = y1 - (list[i] / hi) * (y1 - y0);
          if (i === Math.ceil(head - span)) c.moveTo(px, py);
          else c.lineTo(px, py);
        }
        c.stroke();
        t = c.el('head', '线头的点');
        let at = headAt(t);
        let v = valueAt(at);
        c.fillStyle = T.accent;
        c.beginPath();
        c.arc(X(at, at), y1 - (v / hi) * (y1 - y0), 13, 0, Math.PI * 2);
        c.fill();
        t = c.el('val', '当前的数', TEXT);
        at = headAt(t);
        v = valueAt(at);
        text(c, fmt(v, unitOf(row)), X(at, at) + 24, y1 - (v / hi) * (y1 - y0), 72, T.ink, 'left', 'middle', true);
        t = c.el('axis', '基线');
        c.fillStyle = T.line;
        c.fillRect(x0, y1, x1 - x0, 2);
      },
    };
  });

  chart('chForce', '力导向星系', '节点被连线拉成一团一团：谁和谁更近。', ['星系', '抱团', '网络效应'], {center: 'AI', nodes: Array.from({length: 40}, (_, i) => `节点${i + 1}`), links: Array.from({length: 40}, (_, i) => [i, (i * 7 + 3) % 8])}, (r) => r.nodes && r.nodes.length >= 12, (row, T) => {
    // 先在这里把力算完，每一帧只是把结果放出来，同一时刻永远同一帧
    const n = row.nodes.length;
    const links = (row.links || []).filter(Array.isArray);
    const P = row.nodes.map((_, i) => {
      const a = i * 2.399963;
      const r = 40 + 16 * Math.sqrt(i) * 3;
      return {x: Math.cos(a) * r, y: Math.sin(a) * r, vx: 0, vy: 0};
    });
    for (let step = 0; step < 220; step++) {
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const dx = P[i].x - P[j].x;
          const dy = P[i].y - P[j].y;
          const d2 = dx * dx + dy * dy + 1;
          const f = 2400 / d2;
          P[i].vx += dx * f * 0.02;
          P[i].vy += dy * f * 0.02;
          P[j].vx -= dx * f * 0.02;
          P[j].vy -= dy * f * 0.02;
        }
      }
      links.forEach(([a, b]) => {
        if (!P[a] || !P[b]) return;
        const dx = P[b].x - P[a].x;
        const dy = P[b].y - P[a].y;
        P[a].vx += dx * 0.012;
        P[a].vy += dy * 0.012;
        P[b].vx -= dx * 0.012;
        P[b].vy -= dy * 0.012;
      });
      P.forEach((p) => {
        p.vx = (p.vx - p.x * 0.006) * 0.82;
        p.vy = (p.vy - p.y * 0.006) * 0.82;
        p.x += p.vx;
        p.y += p.vy;
      });
    }
    const hi = Math.max(...P.flatMap((p) => [Math.abs(p.x) / 860, Math.abs(p.y) / 400])) || 1;
    const X = (p) => 960 + p.x / hi;
    const Y = (p) => 570 + p.y / hi;
    const degree = row.nodes.map((_, i) => links.filter((l) => l.includes(i)).length);
    const maxD = Math.max(...degree, 1);
    return {
      last: 3,
      draw(c) {
        let t = c.el('links', '全部连线');
        const grow = smooth(progress(t, 0.2, 2.2));
        c.strokeStyle = css(hex(T.mute), 0.5);
        c.lineWidth = 2;
        links.forEach(([a, b]) => {
          if (!P[a] || !P[b]) return;
          c.beginPath();
          c.moveTo(lerp(960, X(P[a]), grow), lerp(570, Y(P[a]), grow));
          c.lineTo(lerp(960, X(P[b]), grow), lerp(570, Y(P[b]), grow));
          c.stroke();
        });
        t = c.el('nodes', '全部节点');
        const g2 = smooth(progress(t, 0.2, 2.2));
        P.forEach((p, i) => {
          c.fillStyle = degree[i] === maxD ? T.accent : T.ink;
          c.beginPath();
          c.arc(lerp(960, X(p), g2), lerp(570, Y(p), g2), 7 + (degree[i] / maxD) * 15, 0, Math.PI * 2);
          c.fill();
        });
      },
    };
  });

  chart('chThreads', '丝线流向', '每个对象一根丝线，穿过几列：可以看到每一条走向。', ['走向', '路径', '每一个人'], {columns: [['搜索', 'AI', '短视频'], ['官网', 'App'], ['试用', '付费', '流失']], threads: Array.from({length: 70}, (_, i) => [i % 3, (i * 7) % 2, (i * 11) % 3])}, (r) => r.columns && r.threads && r.columns.length >= 2, (row, T) => {
    const cols = row.columns;
    const threads = row.threads;
    const {y0, y1} = CANVAS;
    const X = (k) => 280 + (k / (cols.length - 1)) * 1360;
    const Y = (k, j) => y0 + ((j + 0.5) / cols[k].length) * (y1 - y0);
    const lastT = 3;
    return {
      last: lastT,
      draw(c) {
        let t = c.el('threads', '全部丝线');
        threads.forEach((path, i) => {
          const at = 0.2 + (i / threads.length) * 1.4;
          const k = smooth(progress(t, at, at + 1.2));
          if (k <= 0) return;
          c.save();
          c.beginPath();
          c.rect(0, 0, X(0) + (X(cols.length - 1) - X(0)) * k, 1080);
          c.clip();
          c.strokeStyle = path[path.length - 1] === 1 ? css(hex(T.accent), 0.7) : css(hex(T.mute), 0.4);
          c.lineWidth = 2;
          c.beginPath();
          path.forEach((j, col) => {
            const off = ((i * 37) % 60) - 30;
            const y = Y(col, j) + off;
            if (col === 0) c.moveTo(X(col), y);
            else {
              const m = (X(col - 1) + X(col)) / 2;
              c.bezierCurveTo(m, Y(col - 1, path[col - 1]) + off, m, y, X(col), y);
            }
          });
          c.stroke();
          c.restore();
        });
        cols.forEach((names, k) => {
          names.forEach((name, j) => {
            t = c.el(`node:${k}:${j}`, name, TEXT);
            c.globalAlpha = progress(t, 0.2 + k * 0.5, 0.5 + k * 0.5);
            text(c, name, X(k) + (k === cols.length - 1 ? 22 : k === 0 ? -22 : 0), Y(k, j) + (k > 0 && k < cols.length - 1 ? -56 : 0), 44, T.ink, k === cols.length - 1 ? 'left' : k === 0 ? 'right' : 'center', 'middle');
            c.globalAlpha = 1;
          });
        });
      },
    };
  });

  chart('chChord', '环形关系', '节点排成一圈，连线在圈内穿过：关系多的一眼看出。', ['环形', '互相之间', '两两之间'], {nodes: Array.from({length: 24}, (_, i) => `节点${i + 1}`), chords: Array.from({length: 46}, (_, i) => [(i * 5) % 24, (i * 11 + 3) % 24])}, (r) => r.nodes && r.chords && r.chords.length >= 3, (row, T) => {
    const n = row.nodes.length;
    const cx = 960;
    const cy = 560;
    const R = 400;
    const P = (i) => {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      return [cx + Math.cos(a) * R, cy + Math.sin(a) * R, a];
    };
    return {
      last: 3,
      draw(c) {
        let t = c.el('chords', '全部连线');
        row.chords.forEach(([a, b], i) => {
          const k = smooth(progress(t, 0.5 + (i / row.chords.length) * 1.6, 0.5 + (i / row.chords.length) * 1.6 + 0.6));
          if (k <= 0 || a === b) return;
          const [x1, y1] = P(a);
          const [x2, y2] = P(b);
          c.strokeStyle = i % 7 === 0 ? css(hex(T.accent), 0.8 * k) : css(hex(T.mute), 0.4 * k);
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(x1, y1);
          c.quadraticCurveTo(cx, cy, x2, y2);
          c.stroke();
        });
        t = c.el('nodes', '全部节点');
        for (let i = 0; i < n; i++) {
          const a = backOutSafe(progress(t, 0.1 + i * 0.02, 0.4 + i * 0.02));
          if (a <= 0) continue;
          const [x, y] = P(i);
          c.fillStyle = T.ink;
          c.beginPath();
          c.arc(x, y, 9 * a, 0, Math.PI * 2);
          c.fill();
        }
      },
    };
  });

  // ---------- 从文案里读出一串数：拿铁有3万杯，美式有12万杯。两个以上同单位才算 ----------
  const UNIT = '(万亿|亿|万|千|百|元|块|人|个|家|款|次|分钟|小时|分|秒|天|周|%|％)';
  D.parseSeries = (text) => {
    const clauses = String(text).split(/[，,。；;、！!？?\n]/).map((s) => s.trim()).filter(Boolean);
    const found = [];
    clauses.forEach((clause) => {
      const m = clause.match(new RegExp(`^(.*?)(?:有|是|为|达到|达|约|超过|占|增长到|涨到|跌到|降到|到了|卖了|花了|赚了)?\\s*(\\d+(?:\\.\\d+)?)\\s*${UNIT}`));
      if (!m) return;
      const label = m[1].replace(/^(其中|而|但|还有|以及|和|与|到了|到|在|今天|今年|如今)/, '').replace(/(有|是|为|的)$/, '').trim();
      if (!label || [...label].length > 12) return;
      found.push({label, value: +m[2], unit: m[3] === '％' ? '%' : m[3]});
    });
    if (found.length < 2) return null;
    const unit = found[0].unit;
    if (!found.every((f) => f.unit === unit)) return null;
    return {unit, series: found.map(({label, value}) => ({label, value}))};
  };

  D.fitChart = (tpl, row) => {
    const textAll = `${row.line || ''}`;
    const hit = D.keywordHit(tpl, textAll);
    if (hit) return {score: 84 + hit.length * 3, why: `说到「${hit}」：${tpl.desc}`};
    const n = (row.series || []).length;
    const yearly = (row.series || []).every((d) => /^\d{4}|月$|季度$|年$/.test(d.label || ''));
    const base = {chBars: n >= 2 && n <= 6 && !yearly ? 56 : 30, chHBars: n >= 3 && !yearly ? 50 : 28, chLine: yearly && n >= 3 ? 60 : 24, chDonut: 26, chFunnel: 26, chWaffle: 22};
    return {score: base[tpl.id] || 18, why: tpl.desc};
  };
})(window);
