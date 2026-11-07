// 实验与叙事系：涨势折线、三组方阵、三组柱、退出实验、死循环、搜索对 AI、错答揭晓、糖果隔板。
(function (root) {
  'use strict';
  const D = root.DM;
  const TEXT = D.TEXT;
  const {clamp, lerp, progress, smooth, outExpo, outCubic, outQuint, wobble, springTo, hash, hex, mix, css, textEm, bezier} = D;
  const clear = (c, S, color) => D.clearFrame(c, S, color);
  const themeOf = (row, def = 'black') => {
    const id = row.theme || def;
    return id === 'paper'
      ? {id, bg: '#F1EFE8', ink: '#141416', mute: '#6F6C64', dim: '#CFCCC2', accent: '#EE3A17', primary: '#141416'}
      : {id, bg: '#0A0A0B', ink: '#F4F1EA', mute: '#8E8B85', dim: '#363639', accent: '#FF5C1E', primary: '#FF5C1E'};
  };
  const plainNum = (c, text, x, y, size, color, align = 'left') => {
    c.font = D.numFont(size);
    c.fillStyle = color;
    c.textAlign = align;
    c.textBaseline = 'alphabetic';
    c.fillText(text, x, y);
  };

  // ---------- 涨势折线：线画出来，顶破天花板，坐标轴被迫重标（shotcraft axis-rescale-shock） ----------
  D.register('trend', {
    name: '涨势爆轴', family: '数据', custom: true, desc: '随时间变化的数：折线画出来，新值顶破上限，坐标轴被迫重标。可加一条参照线。', source: 'shotcraft axis-rescale-shock + motion-showreel 画出来的折线', colors: {},
    accepts: (r) => r.points && r.points.length > 1,
    create(row, S) {
      const T = themeOf(row);
      const INKC = hex(T.ink);
      const pts = row.points;
      const sp = D.speechOf(row);
      let cursor = 0;
      const times = pts.map((p, i) => {
        const f = sp.find(`${p.v}%`, cursor);
        if (f) {
          cursor = f.stop;
          return f.end;
        }
        return 1 + i * 2.5;
      });
      const refT = row.ref ? (sp.find(`${row.ref.v}%`) || {end: times[times.length - 1] + 1}).end : 0;
      const lastT = Math.max(times[times.length - 1], refT);
      const dur = Math.max(sp.dur, lastT) + (row.hold != null ? +row.hold : 2.6);
      const ceil0 = row.ceil || 100;
      const shockV = pts.find((p) => p.v > ceil0);
      const shockT = shockV ? times[pts.indexOf(shockV)] : Infinity;
      const X0 = 220;
      const X1 = 1560;
      const YB = 900;
      const YT = 220;
      const xOf = (i) => (pts.length === 1 ? X0 : X0 + ((X1 - X0) * i) / (pts.length - 1));
      const yMaxAt = (t) => (t < shockT + 0.35 ? ceil0 : lerp(ceil0, 100, bezier(0.2, 0.9, 0.2, 1)(progress(t, shockT + 0.35, shockT + 1.05))));
      const draw = (c, t) => {
        clear(c, S, T.bg);
        const yMax = yMaxAt(t);
        const yOf = (v) => YB - ((YB - YT) * v) / yMax;
        const shake = t > shockT + 0.35 ? Math.exp(-8 * (t - shockT - 0.35)) * 10 * Math.sin((t - shockT) * 60) : 0;
        c.translate(0, shake);
        const T0 = t;
        if (row.title) {
          t = c.el('title', row.title, TEXT);
          D.reveal(c, row.title, 60, 48, 58, T.ink, t, 0.1);
        }
        // 网格与刻度：刻度值固定，上限变了它们自己滑动，还原重标的感觉
        t = c.el('grid', '网格与刻度', {group: true});
        const axisIn = outCubic(progress(t, 0.05, 0.5));
        for (let v = 0; v <= 100; v += 10) {
          const y = yOf(v);
          if (y < YT - 60) continue;
          const inHere = outCubic(progress(c.push(`gl:${v}`, `${v} 的网格线`), 0.05, 0.5));
          const a = inHere * clamp((y - (YT - 60)) / 60);
          c.fillStyle = css(INKC, (v === 0 ? 0.5 : 0.13) * a);
          c.fillRect(X0, y, (X1 - X0 + 120) * inHere, v === 0 ? 2 : 1.5);
          c.globalAlpha = a;
          c.font = `32px ${D.FONT_TICK}`;
          c.fillStyle = T.mute;
          c.textAlign = 'right';
          c.fillText(String(v), X0 - 22, y + 11);
          c.globalAlpha = 1;
          c.pop();
        }
        // 天花板线：顶破时裂开
        if (shockV) {
          t = c.el('ceil', '天花板线');
          const y = yOf(ceil0);
          const a = 1 - smooth(progress(t, shockT, shockT + 0.5));
          if (a > 0) {
            c.fillStyle = css(INKC, 0.5 * a);
            c.fillRect(X0, y - 1, X1 - X0 + 120, 2);
          }
        }
        // 参照线
        t = T0;
        if (row.ref && t > refT - 0.7) {
          t = c.el('ref', '参照线');
          const p = outExpo(progress(t, refT - 0.7, refT + 0.1));
          const y = yOf(row.ref.v);
          c.strokeStyle = css(INKC, 0.85);
          c.lineWidth = 2.5;
          c.setLineDash([14, 12]);
          c.beginPath();
          c.moveTo(X0, y);
          c.lineTo(X0 + (X1 - X0 + 120) * p, y);
          c.stroke();
          c.setLineDash([]);
          t = c.el('refLabel', row.ref.label, TEXT);
          D.reveal(c, row.ref.label, X0 + 16, y - 66, 44, T.ink, t, refT - 0.45);
          t = c.el('refNum', `${row.ref.v}%`, TEXT);
          plainNum(c, `${row.ref.v}%`, X0 + 16 + textEm(row.ref.label) * 44 + 18, y - 16, 72, css(INKC, outCubic(progress(t, refT - 0.2, refT))));
        }
        // 折线
        t = c.el('line', '折线');
        c.lineJoin = 'round';
        c.lineCap = 'round';
        c.strokeStyle = T.primary;
        c.lineWidth = 8;
        c.beginPath();
        c.moveTo(xOf(0), yOf(pts[0].v));
        let head = [xOf(0), yOf(pts[0].v)];
        let headShow = t >= times[0] - 0.3;
        for (let i = 1; i < pts.length; i++) {
          const a = Math.max(times[i - 1] + 0.1, times[i] - 1.1);
          const p = bezier(0.55, 0, 0.2, 1)(progress(t, a, times[i]));
          if (p <= 0) break;
          const x = lerp(xOf(i - 1), xOf(i), p);
          const y = lerp(yOf(pts[i - 1].v), yOf(pts[i].v), p);
          c.lineTo(x, y);
          head = [x, y];
        }
        if (headShow) c.stroke();
        // 数据点与读数
        pts.forEach((p, i) => {
          t = c.el(`pt:${i}`, `第 ${i + 1} 个数据点`);
          if (t < times[i] - 0.15) return;
          const big = i === pts.length - 1;
          const age = t - times[i];
          const pop = age < 0 ? 0 : 1 + 0.35 * wobble(age, 3.4, 7);
          const x = xOf(i);
          const y = yOf(p.v);
          c.fillStyle = T.primary;
          c.beginPath();
          c.arc(x, y, Math.max(0.01, 13 * pop), 0, Math.PI * 2);
          c.fill();
          const size = big ? 168 : 104;
          t = c.el(`ptn:${i}`, `${p.v}%`, TEXT);
          const a = smooth(progress(t, times[i] - 0.15, times[i] + 0.05));
          const label = `${p.v}%`;
          const nx = big ? Math.min(x + 26, 1880 - textEm(label) * size * 0.5) : x;
          const inTop = Math.max(y - 30, YT - 74 + size * 0.7);
          plainNum(c, label, big ? x + 30 : x, big ? Math.max(inTop, 40 + size * 0.7) : y - 28, size, css(INKC, a), big ? 'left' : 'center');
          void nx;
          t = c.el(`ptl:${i}`, p.label, TEXT);
          D.reveal(c, p.label, x, YB + 26, 44, T.ink, t, times[i] - 0.8, 0.02, 0.4, 'center');
        });
        void head;
        c.main();
        c.translate(0, -shake);
      };
      return {duration: dur, draw};
    },
  });

  // ---------- 三组方阵：一个点一个孩子（shotcraft unit-dot-swarm-regroup） ----------
  D.register('cohort', {
    name: '三组方阵', family: 'B', custom: true, desc: '分组实验专用：一个点一个人，每组数到几个就亮几个；第二层用红色。', source: 'shotcraft unit-dot-swarm-regroup', colors: {},
    accepts: (r) => r.cohort && r.cohort.length > 0,
    create(row, S) {
      const T = themeOf(row, 'paper');
      const groups = row.cohort;
      const size = row.size || 10;
      const sp = D.speechOf(row);
      const events = row.events || [];
      let cursor = 0;
      let tick = 0.6;
      const ev = events.map((e) => {
        const f = e.find ? sp.find(e.find, cursor) : null;
        if (f) cursor = f.stop;
        const at = f ? f.end : tick;
        tick = at + 0.9;
        return Object.assign({}, e, {at});
      });
      const lastAt = ev.length ? ev[ev.length - 1].at : 0;
      const dur = Math.max(sp.dur, lastAt) + (row.hold != null ? +row.hold : 2.4);
      const ROW_H = Math.min(250, 760 / groups.length);
      const Y0 = groups.length >= 3 ? 240 : 560 - (groups.length * ROW_H) / 2;
      const X0 = 560;
      const PITCH = 96;
      const INK = hex(T.ink);
      const RED = hex(T.accent);
      const BG = hex(T.bg);
      const GRAY = mix(BG, INK, 0.16);
      const posIntro = (gi, k, t) => {
        const home = [X0 + (k + 0.5) * PITCH, Y0 + gi * ROW_H + ROW_H / 2 - 10];
        if (!row.intro) return home;
        const id = gi * size + k;
        const a = id * 2.39996;
        const r = 400 * Math.sqrt((id + 0.5) / (size * groups.length));
        const sc = [960 + r * 1.5 * Math.cos(a), 560 + r * Math.sin(a)];
        const f = sp.find(groups[gi].name);
        const at = (f ? f.start : 1 + gi) + hash(id * 3.3) * 0.25;
        const e = springTo(t - at, 1.5, 6.5);
        return [lerp(sc[0], home[0], e), lerp(sc[1], home[1], e)];
      };
      const draw = (c, t) => {
        clear(c, S, T.bg);
        if (row.caption) {
          t = c.el('caption', row.caption, TEXT);
          const w = D.wrapText(row.caption, 1780, 56, 34, 2);
          D.revealLines(c, w, 60, 62, T.ink, t, 0.1);
        }
        groups.forEach((g, gi) => {
          const y = Y0 + gi * ROW_H + ROW_H / 2 - 10;
          const f = row.intro ? sp.find(g.name) : null;
          const at = f ? f.start : 0.15 + gi * 0.08;
          t = c.el(`gname:${gi}`, g.name, TEXT);
          D.reveal(c, g.name, 60, y - (g.rule ? 76 : 44), 72, T.ink, t, at);
          if (g.rule) {
            t = c.el(`grule:${gi}`, g.rule, TEXT);
            const w = D.wrapText(g.rule, 450, 34, 24, 2);
            D.revealLines(c, w, 62, y + 14, T.ink, t, at + 0.1);
          }
          t = c.el(`gdots:${gi}`, `${g.name}的方阵`, {group: true});
          const tierA = ev.filter((e) => e.g === g.id && !e.tier && t >= e.at - 0.5).pop();
          const tierB = ev.filter((e) => e.g === g.id && e.tier === 1 && t >= e.at - 0.5).pop();
          for (let k = 0; k < size; k++) {
            t = c.push(`gdot:${gi}:${k}`, `第 ${k + 1} 个点`);
            const [x, yy] = posIntro(gi, k, t);
            const inP = row.intro ? 1 : outCubic(progress(t, 0.1 + gi * 0.06 + k * 0.012, 0.5 + gi * 0.06 + k * 0.012));
            let col = GRAY;
            let r = PITCH * 0.3;
            if (tierA) {
              const bt = tierA.at - 0.5 + (k / Math.max(1, tierA.n)) * 0.5;
              const lit = k < tierA.n ? clamp((t - bt) * 16) : 0;
              col = mix(col, INK, lit);
              const pop = lit > 0 ? wobble(t - bt, 3.6, 7.5) * 0.1 : 0;
              r = PITCH * (0.3 + 0.08 * lit + pop);
            }
            if (tierB) {
              const bt = tierB.at - 0.5 + (k / Math.max(1, tierB.n)) * 0.5;
              const hot = k < tierB.n ? clamp((t - bt) * 16) : 0;
              col = mix(col, RED, hot);
            }
            c.fillStyle = css(col);
            c.beginPath();
            c.arc(x, yy, Math.max(0.01, r * inP), 0, Math.PI * 2);
            c.fill();
            t = c.pop();
          }
          // 右侧数字
          t = c.el(`gnum:${gi}`, `${g.name}的人数`, TEXT);
          if (tierA && t >= tierA.at - 0.1) {
            const a = smooth(progress(t, tierA.at - 0.1, tierA.at + 0.1));
            const unit = row.unit == null ? '位' : row.unit;
            plainNum(c, String(tierA.n), X0 + PITCH * size + 34, y + 44, 124, css(INK, a));
            c.font = `44px ${D.FONT_CN}`;
            c.fillStyle = css(INK, a);
            c.fillText(unit, X0 + PITCH * size + 34 + (tierA.n >= 10 ? 112 : 66), y + 44);
            t = c.el(`gnum2:${gi}`, `${g.name}的第二层人数`, TEXT);
            if (tierB && t >= tierB.at - 0.1) {
              const b = smooth(progress(t, tierB.at - 0.1, tierB.at + 0.1));
              plainNum(c, String(tierB.n), X0 + PITCH * size + 34 + 180, y + 44, 124, css(RED, b));
              c.font = `44px ${D.FONT_CN}`;
              c.fillStyle = css(RED, b);
              c.fillText(unit, X0 + PITCH * size + 34 + 180 + (tierB.n >= 10 ? 112 : 66), y + 44);
            }
          }
        });
        if (row.legend) {
          c.textAlign = 'left';
          let lx = 60;
          row.legend.forEach((l, i) => {
            t = c.el(`legend:${i}`, l, TEXT);
            const a = smooth(progress(t, 0.5, 0.9));
            c.globalAlpha = a;
            c.fillStyle = i === 0 ? T.ink : T.accent;
            c.beginPath();
            c.arc(lx + 14, 1016, 14, 0, Math.PI * 2);
            c.fill();
            c.font = `34px ${D.FONT_CN}`;
            c.fillStyle = T.ink;
            c.fillText(l, lx + 40, 1028);
            lx += 40 + textEm(l) * 34 + 60;
            c.globalAlpha = 1;
          });
        }
      };
      return {duration: dur, draw};
    },
  });

  // ---------- 三组柱：分数、分钟这种带单位的对比 ----------
  D.register('groupBars', {
    name: '三组对比柱', family: '数据', custom: true, desc: '带单位的分组数字（分、分钟）：柱子长出来，数字跟着顶上去。', source: 'motion-showreel 长出来的柱子', colors: {},
    accepts: (r) => r.sets && r.sets.length > 0,
    create(row, S) {
      const T = themeOf(row);
      const INK = hex(T.ink);
      const sp = D.speechOf(row);
      let cursor = 0;
      const sets = row.sets.map((s, si) => {
        const keys = Object.keys(s.values);
        const times = keys.map((k, ki) => {
          const f = s.find && s.find[ki] ? sp.find(s.find[ki], cursor) : null;
          if (f) cursor = f.stop;
          return f ? f.end : 0.9 + si * 3 + ki * 0.9;
        });
        return Object.assign({}, s, {keys, times});
      });
      const last = Math.max(...sets.flatMap((s) => s.times));
      const dur = Math.max(sp.dur, last) + (row.hold != null ? +row.hold : 2.6);
      const YB = 880;
      const YT = 300;
      const draw = (c, t) => {
        clear(c, S, T.bg);
        const panelW = 1800 / sets.length;
        sets.forEach((s, si) => {
          const px = 60 + si * panelW;
          const at0 = s.times[0] - 1.2;
          t = c.el(`cap:${si}`, s.caption || '说明文字', TEXT);
          if (t < at0) return;
          const wrap = D.wrapText(s.caption || '', panelW - 60, 52, 30, 2);
          D.revealLines(c, wrap, px, 96, T.ink, t, at0);
          const maxV = Math.max(...s.keys.map((k) => s.values[k])) * 1.02;
          const bw = (panelW - 120) / s.keys.length;
          s.keys.forEach((k, ki) => {
            const bx = px + ki * bw;
            const v = s.values[k];
            const start = s.times[ki] - 0.8;
            const valueAt = (u) => D.runCurve(progress(u, start, s.times[ki])) * v;
            t = c.el(`bar:${si}:${ki}`, `${k}的柱子`);
            const h = ((YB - YT) * valueAt(t)) / maxV;
            const hl = s.highlight === k;
            c.fillStyle = hl ? T.accent : T.primary;
            c.beginPath();
            c.roundRect(bx + bw * 0.14, YB - Math.max(1, h), bw * 0.72, Math.max(1, h), 6);
            c.fill();
            t = c.el(`base:${si}:${ki}`, `${k}的底线`);
            c.fillStyle = css(INK, 0.5);
            c.fillRect(bx, YB, bw, 2);
            t = c.el(`key:${si}:${ki}`, k, TEXT);
            D.reveal(c, k, bx + bw / 2, YB + 22, 62, T.ink, t, start - 0.2, 0.02, 0.4, 'center');
            t = c.el(`val:${si}:${ki}`, `${k}的数字`, TEXT);
            if (t >= start) {
              const f = valueAt(t);
              const label = String(Math.round(f));
              const y = YB - ((YB - YT) * f) / maxV - 22;
              plainNum(c, label, bx + bw / 2 - (s.unit ? 22 : 0), y, 118, T.ink, 'center');
              if (s.unit) {
                const nw = c.measureText(label).width;
                c.font = `38px ${D.FONT_CN}`;
                c.fillStyle = T.ink;
                c.textAlign = 'left';
                c.fillText(s.unit, bx + bw / 2 - 22 + nw / 2 + 6, y);
              }
            }
          });
        });
      };
      return {duration: dur, draw};
    },
  });

  // ---------- 退出实验：50 个点，一天走一批 ----------
  D.register('attrition', {
    name: '一批批离开', family: 'B', custom: true, desc: '有人陆续退出、或只有其中几位做了某事：一个点一个人，退出的掉下去，最后盖章。', source: 'shotcraft unit-dot + rhythm-interrupt', colors: {},
    accepts: (r) => r.total > 0 && (r.steps || r.highlight),
    create(row, S) {
      const T = themeOf(row, 'paper');
      const INK = hex(T.ink);
      const BG = hex(T.bg);
      const RED = hex(T.accent);
      const GRAY = mix(BG, INK, 0.16);
      const total = row.total;
      const cols = 10;
      const rows = Math.ceil(total / cols);
      const P = Math.min(108, 860 / rows);
      const GX = 90;
      const GY = 540 - (rows * P) / 2;
      const order = Array.from({length: total}, (_, i) => i).sort((a, b) => hash(a * 9.1) - hash(b * 9.1));
      const sp = D.speechOf(row);
      let cursor = 0;
      const steps = (row.steps || []).map((s, i) => {
        const f = s.find ? sp.find(s.find, cursor) : null;
        if (f) cursor = f.stop;
        return Object.assign({}, s, {at: f ? f.end : 1 + i * 2.2});
      });
      let removed = 0;
      const leaveAt = new Array(total).fill(Infinity);
      steps.forEach((s) => {
        for (let k = 0; k < (s.out || 0); k++) {
          leaveAt[order[removed + k]] = s.at + (k / Math.max(1, s.out)) * 0.55;
        }
        removed += s.out || 0;
      });
      const hl = row.highlight;
      const hlF = hl ? sp.find(hl.find || `${hl.n}位`) : null;
      const hlAt = hl ? (hlF ? hlF.end : 1.2) : 0;
      const last = Math.max(steps.length ? steps[steps.length - 1].at : 0, hlAt);
      const dur = Math.max(sp.dur, last) + (row.hold != null ? +row.hold : 2.6);
      const draw = (c, t) => {
        clear(c, S, T.bg);
        let cur = -1;
        steps.forEach((s, i) => {
          if (t >= s.at - 0.5) cur = i;
        });
        t = c.el('dots', '全部圆点', {group: true});
        for (let i = 0; i < total; i++) {
          t = c.push(`dot:${i}`, `第 ${i + 1} 个点`);
          const x = GX + ((i % cols) + 0.5) * P;
          const y = GY + (Math.floor(i / cols) + 0.5) * P;
          const inP = outCubic(progress(t, 0.1 + i * 0.008, 0.45 + i * 0.008));
          let col = hl ? GRAY : INK;
          let r = P * 0.32;
          let dy = 0;
          let alpha = 1;
          if (t >= leaveAt[i]) {
            const age = t - leaveAt[i];
            dy = 900 * age * age + 60 * age;
            alpha = clamp(1 - age * 1.6);
            col = mix(INK, BG, 0.3);
          }
          if (hl) {
            const rank = order.indexOf(i);
            if (rank < hl.n) {
              const lt = hlAt - 0.6 + (rank / hl.n) * 0.6;
              const lit = clamp((t - lt) * 16);
              col = mix(GRAY, RED, lit);
              if (lit > 0) r = P * (0.32 + 0.1 * wobble(t - lt, 3.6, 7.5));
            }
          }
          if (alpha > 0) {
            // 留下的空位
            if (t >= leaveAt[i]) {
              c.fillStyle = css(GRAY, 0.45);
              c.beginPath();
              c.arc(x, y, r * 0.5, 0, Math.PI * 2);
              c.fill();
            }
            c.fillStyle = css(col, alpha);
            c.beginPath();
            c.arc(x, y + dy, Math.max(0.01, r * inP), 0, Math.PI * 2);
            c.fill();
          } else {
            c.fillStyle = css(GRAY, 0.45);
            c.beginPath();
            c.arc(x, y, r * 0.5, 0, Math.PI * 2);
            c.fill();
          }
          t = c.pop();
        }
        const RX = 1240;
        if (row.caption) {
          t = c.el('caption', row.caption, TEXT);
          const w = D.wrapText(row.caption, 620, 46, 28, 3);
          D.revealLines(c, w, RX, 90, T.ink, t, 0.15);
        }
        if (hl) {
          t = c.el('hlNum', `${hl.n} 位`, TEXT);
          const a = smooth(progress(t, hlAt - 0.2, hlAt));
          plainNum(c, String(hl.n), RX, 620, 300, css(RED, a));
          c.font = `64px ${D.FONT_CN}`;
          c.fillStyle = css(INK, a);
          c.textAlign = 'left';
          c.fillText('位', RX + (hl.n >= 10 ? 270 : 150), 620);
          if (hl.text) {
            t = c.el('hlText', hl.text, TEXT);
            const w = D.wrapText(hl.text, 620, 40, 26, 3);
            D.revealLines(c, w, RX, 650, T.ink, t, hlAt);
          }
        }
        if (cur >= 0) {
          const s = steps[cur];
          t = c.el(`step:${cur}`, s.label, TEXT);
          const pIn = outQuint(progress(t, s.at - 0.5, s.at - 0.2));
          c.globalAlpha = pIn;
          c.font = `90px ${D.FONT_CN}`;
          c.fillStyle = T.ink;
          c.textAlign = 'left';
          c.fillText(s.label, RX, 400 + (1 - pIn) * 30);
          if (s.out) {
            t = c.el(`out:${cur}`, `${s.out} 位退出`, TEXT);
            plainNum(c, String(s.out), RX, 690, 300, T.ink);
            c.font = `64px ${D.FONT_CN}`;
            c.fillStyle = T.ink;
            c.fillText('位退出', RX + (s.out >= 10 ? 270 : 150), 690);
          }
          if (s.stamp) {
            t = c.el(`stamp:${cur}`, s.stamp, TEXT);
            const p = outQuint(progress(t, s.at - 0.15, s.at + 0.1));
            const sc = lerp(1.5, 1, p);
            c.save();
            c.translate(RX + 280, 610);
            c.rotate(-0.06);
            c.scale(sc, sc);
            c.globalAlpha = p;
            c.strokeStyle = T.accent;
            c.lineWidth = 8;
            const w = textEm(s.stamp) * 120 + 70;
            c.strokeRect(-w / 2, -90, w, 180);
            c.fillStyle = T.accent;
            c.font = `120px ${D.FONT_CN}`;
            c.textAlign = 'center';
            c.fillText(s.stamp, 0, 44);
            c.restore();
          }
          c.globalAlpha = 1;
        }
      };
      return {duration: dur, draw};
    },
  });

  // ---------- 死循环：节点围成一圈，光点越转越快 ----------
  D.register('cycle', {
    name: '死循环', family: '数据', custom: true, desc: '因果连成一圈：念到哪个节点亮哪个，念完后光点越转越快。', source: 'motion-showreel 连续叙事 + shotcraft speed-ramp', colors: {},
    accepts: (r) => r.nodes && r.nodes.length > 2,
    create(row, S) {
      const T = themeOf(row);
      const INK = hex(T.ink);
      const P = hex(T.accent);
      const sp = D.speechOf(row);
      const nodes = row.nodes;
      const n = nodes.length;
      let cursor = 0;
      const times = nodes.map((nd, i) => {
        const needle = nd.find || nd.label;
        const f = sp.find(needle, cursor);
        if (f) cursor = f.stop;
        return f ? f.end : 0.8 + i * 1.3;
      });
      const last = times[n - 1];
      const dur = Math.max(sp.dur, last) + (row.hold != null ? +row.hold : 3.2);
      const CX = 960;
      const CY = 540;
      const R = 340;
      const angleOf = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const headAngle = (t) => {
        if (t >= last) {
          const d = t - last;
          // 越转越快
          return angleOf(n - 1) + 2 * Math.PI * (0.35 * d + 0.28 * d * d) + 0;
        }
        let i = 0;
        times.forEach((tt, k) => {
          if (t >= tt) i = k;
        });
        const a = times[i];
        const b = times[i + 1] == null ? a + 1 : times[i + 1];
        const e = t < times[0] ? 0 : smooth(progress(t, a, b));
        return angleOf(i) + (e * 2 * Math.PI) / n;
      };
      const draw = (c, t) => {
        clear(c, S, T.bg);
        // 底环
        t = c.el('ring', '底环');
        const ringAt = (u) => outCubic(progress(u, 0.05, 0.9));
        const ringIn = ringAt(t);
        c.strokeStyle = css(INK, 0.16);
        c.lineWidth = 3;
        c.beginPath();
        c.arc(CX, CY, R, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * ringIn);
        c.stroke();
        // 走过的弧
        t = c.el('arc', '走过的弧');
        const start = angleOf(0);
        const end = Math.min(headAngle(t), start + 2 * Math.PI);
        if (t >= times[0]) {
          c.strokeStyle = css(P);
          c.lineWidth = 8;
          c.lineCap = 'round';
          c.beginPath();
          c.arc(CX, CY, R, start, end);
          c.stroke();
        }
        // 光点拖尾
        t = c.el('head', '光点');
        const a = headAngle(t);
        if (t >= times[0]) {
          for (let k = 0; k < 14; k++) {
            const ta = a - k * 0.045 * clamp(1 + (t - last) * 0.5, 1, 3);
            c.fillStyle = css(mix(P, [255, 240, 220], 0.6), (1 - k / 14) * 0.9);
            c.beginPath();
            c.arc(CX + R * Math.cos(ta), CY + R * Math.sin(ta), 12 - k * 0.6, 0, Math.PI * 2);
            c.fill();
          }
        }
        // 节点
        nodes.forEach((nd, i) => {
          const th = angleOf(i);
          const x = CX + R * Math.cos(th);
          const y = CY + R * Math.sin(th);
          t = c.el(`node:${i}`, `${nd.label}的节点`);
          const on = smooth(progress(t, times[i] - 0.25, times[i]));
          const pop = t >= times[i] ? 0.3 * wobble(t - times[i], 3.2, 7) : 0;
          c.fillStyle = css(mix(mix(hex(T.bg), INK, 0.3), P, on));
          c.beginPath();
          c.arc(x, y, Math.max(0.01, 17 * (1 + pop) * ringAt(t)), 0, Math.PI * 2);
          c.fill();
          t = c.el(`nodeLabel:${i}`, nd.label, TEXT);
          const cos = Math.cos(th);
          const sin = Math.sin(th);
          const tx = x + cos * 44;
          const ty = y + sin * 44;
          const align = Math.abs(cos) < 0.2 ? 'center' : cos > 0 ? 'left' : 'right';
          const size = n >= 7 ? 40 : 50;
          const yy = Math.abs(cos) < 0.2 ? (sin < 0 ? ty - size * 1.25 : ty) : ty - size * 0.62;
          c.globalAlpha = lerp(0.35, 1, smooth(progress(t, times[i] - 0.25, times[i])));
          D.reveal(c, nd.label, tx, yy, size, T.ink, t, times[i] - 0.5, 0.02, 0.4, align);
          c.globalAlpha = 1;
        });
        if (row.center) {
          t = c.el('center', row.center, TEXT);
          const w = D.wrapText(row.center, 460, 62, 34, 3);
          const y = CY - D.linesH(w) / 2;
          w.lines.forEach((l, li) => D.reveal(c, l, CX, y + li * w.size * 1.25, w.size, T.ink, t, last + 0.3 + li * 0.1, 0.03, 0.5, 'center'));
        }
      };
      return {duration: dur, draw};
    },
  });

  // ---------- 前后对比：滑杆把一边换成另一边（shotcraft before-after-slider-scrub） ----------
  D.register('split', {
    name: '左右对比', family: '文字', custom: true, desc: '两种东西的对比：滑杆扫过，一边换成另一边，再回拉一下。', source: 'shotcraft before-after-slider-scrub', colors: {},
    accepts: (r) => r.left && r.right,
    create(row, S) {
      const sp = D.speechOf(row);
      const dur = sp.dur + (row.hold != null ? +row.hold : 1.8);
      const rf = sp.find(row.right.find || row.right.title);
      const rightAt = rf ? rf.start : sp.dur * 0.5;
      const panel = (c, side, t, at, dark) => {
        const tag = dark ? 'right' : 'left';
        const ink = dark ? '#F4F1EA' : '#141416';
        t = c.el(`${tag}Bg`, dark ? '右半屏底色' : '左半屏底色', {kind: 'fx', pick: false});
        c.fillStyle = dark ? '#0A0A0B' : '#F1EFE8';
        c.fillRect(0, 0, 1920, 1080);
        const title = side.title;
        t = c.el(`${tag}Title`, title, TEXT);
        c.font = `168px ${D.FONT_CN}`;
        c.fillStyle = ink;
        c.textAlign = 'center';
        c.textBaseline = 'alphabetic';
        const cx = dark ? 1440 : 480;
        c.fillText(title, cx, 300);
        const lines = side.lines || [];
        let y = 410;
        lines.forEach((l, i) => {
          t = c.el(`${tag}Line:${i}`, l, TEXT);
          const w = D.wrapText(l, 780, 50, 30, 3);
          w.lines.forEach((tx, li) => {
            D.reveal(c, tx, cx, y, w.size, ink, t, at + 0.2 + i * 0.5 + li * 0.08, 0.02, 0.4, 'center');
            y += w.size * 1.3;
          });
          y += 24;
        });
      };
      const draw = (c, t) => {
        clear(c, S, '#0A0A0B');
        // 滑杆：从左边走到中线，再回拉一下
        const xAt = (u) => {
          const go = bezier(0.65, 0, 0.25, 1)(progress(u, rightAt - 0.25, rightAt + 0.55));
          const scrub = Math.exp(-2.5 * Math.max(0, u - rightAt - 0.55)) * Math.sin(Math.max(0, u - rightAt - 0.55) * 4.2) * 110;
          return u < rightAt - 0.25 ? 1920 : lerp(1920, 960, go) + scrub;
        };
        let x = xAt(t);
        c.main();
        c.save();
        c.beginPath();
        c.rect(0, 0, x, 1080);
        c.clip();
        panel(c, row.left, t, 0.15, false);
        c.restore();
        c.main();
        c.save();
        c.beginPath();
        c.rect(x, 0, 1920 - x, 1080);
        c.clip();
        panel(c, row.right, t, rightAt, true);
        c.restore();
        x = xAt(c.el('slider', '滑杆'));
        if (x < 1920) {
          c.fillStyle = '#FF5C1E';
          c.fillRect(x - 3, 0, 6, 1080);
          c.beginPath();
          c.arc(x, 540, 34, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = '#FFFFFF';
          c.beginPath();
          c.moveTo(x - 20, 540);
          c.lineTo(x - 8, 530);
          c.lineTo(x - 8, 550);
          c.closePath();
          c.moveTo(x + 20, 540);
          c.lineTo(x + 8, 530);
          c.lineTo(x + 8, 550);
          c.closePath();
          c.fill();
        }
      };
      return {duration: dur, draw};
    },
  });

  // ---------- 错答揭晓：错的数被划掉，真答案盖上去，再翻开十张一样的答卷 ----------
  D.register('reveal', {
    name: '错答揭晓', family: '文字', custom: true, desc: '反转专用：错答案被划掉，正确答案盖上去，再翻开所有人写错的答卷。', source: 'shotcraft rhythm-interrupt + document-typewriter', colors: {},
    accepts: (r) => r.wrong && r.right,
    create(row, S) {
      const T = themeOf(row);
      const sp = D.speechOf(row);
      const rf = sp.find(row.right);
      const rightAt = rf ? rf.end : sp.dur * 0.55;
      const wf = sp.find(row.wrong, rf ? rf.stop : 0);
      const sheetAt = wf ? wf.start : rightAt + 1.6;
      const dur = Math.max(sp.dur, sheetAt + 1.2) + (row.hold != null ? +row.hold : 2.4);
      const n = row.sheets || 10;
      const draw = (c, t) => {
        clear(c, S, T.bg);
        const T0 = t;
        if (row.caption) {
          t = c.el('caption', row.caption, TEXT);
          D.reveal(c, row.caption, 60, 60, 52, T.ink, t, 0.1);
        }
        t = T0;
        const up = bezier(0.7, 0, 0.2, 1)(progress(t, sheetAt - 0.3, sheetAt + 0.4));
        const y = lerp(620, 330, up);
        const size = lerp(320, 170, up);
        const lx = lerp(520, 480, up);
        const rx = lerp(1400, 1440, up);
        // 错的
        t = c.el('wrong', row.wrong, TEXT);
        c.globalAlpha = smooth(progress(t, 0.2, 0.5));
        c.font = D.numFont(size);
        c.textAlign = 'center';
        c.fillStyle = css(hex(T.ink), rightAt < t ? 0.5 : 1);
        c.fillText(row.wrong, lx, y);
        c.globalAlpha = 1;
        t = c.el('strike', '划掉的线');
        const strike = outExpo(progress(t, rightAt - 0.6, rightAt - 0.2));
        if (strike > 0) {
          const w = c.measureText(row.wrong).width;
          c.fillStyle = T.accent;
          c.fillRect(lx - w / 2 - 20, y - size * 0.34, (w + 40) * strike, Math.max(8, size * 0.04));
        }
        // 对的：盖章
        t = c.el('right', row.right, TEXT);
        const p = outQuint(progress(t, rightAt - 0.15, rightAt + 0.08));
        if (p > 0) {
          const sc = lerp(1.6, 1, p);
          c.save();
          c.translate(rx, y);
          c.scale(sc, sc);
          c.globalAlpha = p;
          c.font = D.numFont(size);
          c.fillStyle = T.accent;
          c.textAlign = 'center';
          c.fillText(row.right, 0, 0);
          c.restore();
          c.globalAlpha = 1;
        }
        // 十张答卷
        if (T0 > sheetAt - 0.1) {
          const cols = 5;
          const W = 300;
          const H = 170;
          const gx = (1920 - cols * W - (cols - 1) * 36) / 2;
          for (let i = 0; i < n; i++) {
            t = c.el(`sheet:${i}`, `第 ${i + 1} 张答卷`, TEXT);
            const at = sheetAt + i * 0.11;
            const q = outCubic(progress(t, at, at + 0.32));
            if (q <= 0) continue;
            const x = gx + (i % cols) * (W + 36);
            const yy = 470 + Math.floor(i / cols) * (H + 36);
            const flip = Math.abs(Math.cos((1 - q) * Math.PI * 0.5 + Math.PI / 2 - Math.PI / 2)) * q;
            c.save();
            c.translate(x + W / 2, yy + H / 2);
            c.scale(Math.max(0.02, flip), 1);
            c.fillStyle = T.id === 'paper' ? '#FFFFFF' : '#F4F1EA';
            c.beginPath();
            c.roundRect(-W / 2, -H / 2, W, H, 8);
            c.fill();
            c.fillStyle = '#141416';
            c.font = `28px ${D.FONT_CN}`;
            c.textAlign = 'left';
            c.fillText(`${row.group || ''}${i + 1}号`, -W / 2 + 18, -H / 2 + 40);
            c.font = D.numFont(82);
            c.textAlign = 'center';
            c.fillStyle = '#EE3A17';
            c.fillText(row.wrong, 0, H / 2 - 34);
            c.restore();
          }
        }
      };
      return {duration: dur, draw};
    },
  });

  // ---------- 糖果隔板：把例题画出来 ----------
  D.register('candy', {
    name: '例题演示', family: '数据', custom: true, desc: '插板法例题：10 颗糖排成一排，9 个空隙，插 2 块隔板，得 36 种。', source: 'motion-showreel 连续叙事', colors: {},
    accepts: (r) => r.candy,
    create(row, S) {
      const T = themeOf(row);
      const INK = hex(T.ink);
      const sp = D.speechOf(row);
      const at = (s, fb) => {
        const f = sp.find(s);
        return f ? f.start : fb;
      };
      const tRow = at('把10颗糖', 2);
      const tGap = at('9个空隙', 4);
      const tBoard = at('插2块隔板', 5.5);
      const tSplit = at('分成了3份', 6.5);
      const tFormula = at('9×8', 9);
      const dur = sp.dur + (row.hold != null ? +row.hold : 2.4);
      const N = 10;
      const P = 150;
      const X0 = 960 - ((N - 1) * P) / 2;
      const Y = 480;
      const boards = [2, 6];
      const draw = (c, t) => {
        clear(c, S, T.bg);
        if (row.caption) {
          t = c.el('caption', row.caption, TEXT);
          D.reveal(c, row.caption, 60, 70, 56, T.ink, t, 0.15);
        }
        t = c.el('candies', '十颗糖', {group: true});
        const splitE = outCubic(progress(t, tSplit, tSplit + 0.5));
        for (let i = 0; i < N; i++) {
          t = c.push(`candy:${i}`, `第 ${i + 1} 颗糖`);
          const inAt = tRow + i * 0.05;
          const p = wobble(t - inAt, 2.6, 6);
          const e = t < inAt ? 0 : 1 - p;
          let gap = 0;
          boards.forEach((b) => {
            if (i > b) gap += 60 * splitE;
          });
          const x = X0 + i * P + gap - (60 * splitE * boards.length) / 2;
          const y = lerp(Y - 300, Y, clamp(e));
          if (e <= 0) {
            t = c.pop();
            continue;
          }
          const g = i <= boards[0] ? 0 : i <= boards[1] ? 1 : 2;
          const col = mix(hex(T.accent), [[255, 92, 30], [255, 210, 120], [255, 244, 226]][g], splitE);
          c.fillStyle = css(col, clamp(e));
          c.beginPath();
          c.arc(x, y, 52, 0, Math.PI * 2);
          c.fill();
          t = c.pop();
        }
        // 空隙编号
        t = c.el('gaps', '空隙编号', {group: true});
        for (let i = 0; i < N - 1; i++) {
          const a = smooth(progress(t, tGap + i * 0.07, tGap + i * 0.07 + 0.3));
          if (a <= 0) continue;
          c.push(`gap:${i}`, `空隙 ${i + 1}`);
          let gap = 0;
          boards.forEach((b) => {
            if (i >= b) gap += 60 * splitE;
          });
          const x = X0 + (i + 0.5) * P + gap - (60 * splitE * boards.length) / 2 - (boards.includes(i) ? 30 * splitE : 0);
          c.globalAlpha = a;
          c.fillStyle = css(INK, 0.6);
          c.font = `34px ${D.FONT_TICK}`;
          c.textAlign = 'center';
          c.fillText(String(i + 1), x, Y + 106);
          c.fillRect(x - 1, Y + 60, 2, 18);
          c.globalAlpha = 1;
          c.pop();
        }
        // 隔板
        boards.forEach((b, k) => {
          t = c.el(`board:${k}`, `第 ${k + 1} 块隔板`);
          const d = tBoard + k * 0.3;
          const e = outQuint(progress(t, d, d + 0.35));
          if (e <= 0) return;
          let gap = 0;
          boards.forEach((bb) => {
            if (b >= bb) gap += 60 * splitE;
          });
          const x = X0 + (b + 0.5) * P + gap - (60 * splitE * boards.length) / 2 - 30 * splitE;
          c.fillStyle = T.ink;
          c.fillRect(x - 5, lerp(Y - 300, Y - 92, e), 10, 184);
        });
        // 算式
        t = c.el('formula', '9×8÷2 = 36 种', TEXT);
        if (t > tFormula) {
          const a = smooth(progress(t, tFormula, tFormula + 0.3));
          c.globalAlpha = a;
          c.font = D.numFont(150);
          c.fillStyle = T.ink;
          c.textAlign = 'center';
          c.fillText('9×8÷2 = 36', 880, 880);
          c.font = `90px ${D.FONT_CN}`;
          c.fillText('种', 1340, 880);
          c.globalAlpha = 1;
        }
      };
      return {duration: dur, draw};
    },
  });

  void outQuint;
})(window);
