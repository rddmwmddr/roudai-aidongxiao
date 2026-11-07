// 百分比系：把所有数平铺的模板。排行、问卷、整屏黑卡、这其中、仪表、滚带、字里填满。
(function (root) {
  'use strict';
  const D = root.DM;
  const TEXT = D.TEXT;
  const {clamp, lerp, progress, smooth, outExpo, outCubic, wobble, hash, hex, mix, css, numEm, textEm, runCurve, bezier} = D;

  const clear = (c, S, color) => {
    c.bg();
    c.setTransform(S, 0, 0, S, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.fillStyle = color;
    c.fillRect(0, 0, 1920, 1080);
    c.main();
  };
  const inkOf = (spec) => (D.luma(hex(spec.colors.bg)) < 0.5 ? '#F4F1EA' : '#141416');
  const flat = (spec) => D.flatMetrics(spec);
  const BLACK = {bg: '#0A0A0B', primary: '#FF5C1E', secondary: '#FFF4E2'};
  const PAPER = {bg: '#F1EFE8', primary: '#141416', secondary: '#EE3A17'};

  // ---------- 高亮排行：长出来的条，高亮一个，其余退灰（motion-showreel data-motion） ----------
  D.register('rank', {
    name: '高亮排行', family: '数据', desc: '多个并列的数，条形长出来，一个高亮其余退灰。', source: 'motion-showreel 长出来的柱子 + 高亮一个', colors: BLACK, maxMetrics: 8,
    create(spec, tl, S) {
      const rows = flat(spec);
      const INK = inkOf(spec);
      const P = hex(spec.colors.primary);
      const Q = hex(spec.colors.secondary);
      const BG = hex(spec.colors.bg);
      const TRACK = mix(BG, hex(INK), 0.14);
      const readout = D.makeReadout(S);
      const n = rows.length;
      const X0 = 720;
      const X1 = 1640;
      const top = n <= 3 ? 250 : 130;
      const rowH = Math.min(240, (1000 - top) / n);
      const X = (v) => X0 + ((X1 - X0) * v) / 100;
      const heads = rows.filter((r) => r.title && r.showTitle);
      const draw = (c, t) => {
        clear(c, S, spec.colors.bg);
        const {beat: focus, e} = D.focusOf(tl.beats, t);
        if (heads[0]) {
          t = c.el('title', heads[0].title, TEXT);
          D.reveal(c, heads[0].title, 60, 56, 56, INK, t, 0.1);
        }
        t = c.el('grid', '网格线', {group: true});
        for (let v = 0; v <= 100; v += 10) {
          t = c.push(`gl:${v}`, `${v} 的网格线`);
          const a = outCubic(progress(t, 0.1 + v * 0.004, 0.5 + v * 0.004));
          c.fillStyle = css(mix(BG, hex(INK), v % 50 === 0 ? 0.4 : 0.16), a);
          c.fillRect(X(v) - 0.75, top - 26, 1.5, n * rowH + 12);
          t = c.pop();
        }
        rows.forEach((r, i) => {
          const b = r.b;
          const y = top + i * rowH;
          const h = Math.min(70, rowH * 0.42);
          const by = y + (rowH - h) / 2 - 8;
          t = c.el(`track:${i}`, `第 ${i + 1} 行底槽`);
          const pIn = outCubic(progress(t, b.capAt - 0.1, b.capAt + 0.4));
          const fade = focus && focus !== b ? 1 - 0.55 * e : 1;
          c.globalAlpha = pIn;
          c.fillStyle = css(TRACK);
          c.beginPath();
          c.roundRect(X0, by, X1 - X0, h, 6);
          c.fill();
          c.globalAlpha = 1;
          t = c.el(`bar:${i}`, `${b.value}% 的条`);
          let f = D.frontOf(b, t);
          const barC = focus ? (focus === b ? Q : mix(P, BG, 0.62 * e)) : b.emphasis ? Q : P;
          if (f > 0.02) {
            c.fillStyle = css(barC);
            c.beginPath();
            c.roundRect(X0, by, Math.max(4, X(f) - X0), h, 6);
            c.fill();
            const heat = D.speedOf(b, t) / 60;
            if (heat > 0.02) {
              c.fillStyle = css([255, 240, 220], Math.min(0.75, heat));
              c.fillRect(X(f) - 3, by, 3, h);
            }
          }
          c.globalAlpha = fade;
          t = c.el(`cap:${i}`, b.caption, TEXT);
          const wrap = D.wrapText(b.caption, 610, Math.min(52, rowH * 0.34), 26, 3);
          D.revealLines(c, wrap, 60, y + (rowH - D.linesH(wrap)) / 2 - 8, INK, t, b.capAt);
          t = c.el(`num:${i}`, `${b.value}%`, TEXT);
          f = D.frontOf(b, t);
          const size = Math.min(100, rowH * 0.5);
          const nx = Math.min(X1 + 16, X(f) + 16);
          const fits = X(f) + 16 + numEm(b.value) * size <= 1880;
          const numX = fits ? nx : X(f) - 16 - numEm(b.value) * size;
          readout(c, {x: numX, baseline: by + h / 2 + size * 0.35, size, value: f, target: b.value, speed: D.speedOf(b, t), color: fits ? INK : spec.colors.bg, alpha: smooth(progress(t, b.numAt, b.numAt + 0.3)), pulse: D.landPulse(t, b.land)});
          c.globalAlpha = 1;
        });
      };
      return {draw};
    },
  });

  // ---------- 整屏黑卡：照《超体》的百分比卡，硬切出现，缓慢推近 ----------
  D.register('lucy', {
    name: '整屏黑卡', family: '文字', desc: '黑屏一个百分比，硬切进入，轻微闪动后缓慢推近。', source: '《超体》式百分比卡 + shotcraft rhythm-interrupt', colors: {bg: '#000000', primary: '#FFFFFF', secondary: '#FFFFFF'}, maxMetrics: 1,
    create(spec, tl, S) {
      const b = tl.beats[0];
      const INK = spec.colors.primary;
      const val = b.value;
      const label = `${val}%`;
      const draw = (c, t) => {
        clear(c, S, spec.colors.bg);
        t = c.el('num', label, TEXT);
        const at = Math.max(0.05, b.land - 0.2);
        if (t < at) return;
        const age = t - at;
        // 进场前几帧闪一下
        const flick = age < 0.14 ? (Math.floor(age * 60) % 3 === 1 ? 0.25 : 1) : 1;
        const push = 1 + 0.035 * outCubic(age / 3.5);
        const size = 560 * push;
        c.globalAlpha = flick;
        c.fillStyle = INK;
        c.font = D.numFont(size);
        c.textAlign = 'center';
        c.textBaseline = 'alphabetic';
        const jx = age < 0.25 ? (hash(Math.floor(age * 60)) - 0.5) * 6 : 0;
        c.fillText(label, 960 + jx, 540 + size * 0.35);
        c.globalAlpha = 1;
      };
      return {draw};
    },
  });

  // ---------- 这其中：亮的部分放大成新的 100%，基数一层层收窄（shotcraft axis-rescale + 一百根） ----------
  D.register('zoom', {
    name: '这其中', family: 'A', desc: '「这其中」专用：亮的那部分放大成新的 100%，基数一层层收窄。', source: 'shotcraft axis-rescale-shock + metalforge 前沿', colors: BLACK, maxMetrics: 4,
    create(spec, tl, S) {
      const rows = flat(spec);
      const INK = inkOf(spec);
      const P = hex(spec.colors.primary);
      const Q = hex(spec.colors.secondary);
      const BG = hex(spec.colors.bg);
      const DIM = mix(BG, hex(INK), 0.2);
      const readout = D.makeReadout(S);
      const X = (v) => 60 + 18 * v;
      const TOP = 560;
      const BOT = 948;
      const draw = (c, t) => {
        clear(c, S, spec.colors.bg);
        // 当前在第几层
        let lvl = 0;
        rows.forEach((r, i) => {
          if (i > 0 && t >= r.b.run[0] - 1.0) lvl = i;
        });
        const cur = rows[lvl];
        const prev = lvl > 0 ? rows[lvl - 1] : null;
        // 放大：上一层亮的条被拉满全宽，然后换成新的一百根
        const zoomAt = prev ? cur.b.run[0] - 1.0 : -1;
        const z = prev ? bezier(0.7, 0, 0.2, 1)(progress(t, zoomAt, zoomAt + 0.75)) : 1;
        const assemble = (i) => outExpo(progress(t, 0.08 + i * 0.006, 0.08 + i * 0.006 + 0.6));
        t = c.el('bars', '竖条', {group: true});
        if (prev && z < 1) {
          const v = prev.b.value;
          const scale = lerp(1, 100 / v, z);
          for (let i = 0; i < 100; i++) {
            const x = 60 + (i + 0.5) * 18 * scale;
            if (x > 1960) continue;
            c.push(`bar:${i}`, `第 ${i + 1} 根`);
            const lit = i < v;
            const w = lerp(8, lit ? 8 : 7, z);
            c.fillStyle = css(lit ? P : DIM, lit ? 1 : 1 - z);
            c.beginPath();
            c.roundRect(x - w / 2, TOP, w, BOT - TOP, w / 2);
            c.fill();
            c.pop();
          }
        } else {
          const f = D.frontOf(cur.b, t);
          const glowA = [];
          for (let i = 0; i < 100; i++) {
            t = c.push(`bar:${i}`, `第 ${i + 1} 根`);
            const lt = cur.b.lit[i];
            const lit = clamp((t - lt) * 22);
            const heat = lit > 0 ? Math.exp(-(t - lt) / 0.32) : 0;
            const enter = lvl === 0 ? assemble(i) : outCubic(progress(t, zoomAt + 0.7 + i * 0.002, zoomAt + 1.0 + i * 0.002));
            const d = (i + 0.5 - f) / 3.2;
            const spike = Math.exp(-d * d) * clamp(D.speedOf(cur.b, t) / 42) * 60;
            const bounce = lit > 0 ? wobble(t - lt, 5.5, 8) * 14 : 0;
            const top = BOT - (BOT - TOP) * enter - spike - bounce;
            const frac = clamp(cur.b.value - i);
            const accent = lvl === rows.length - 1 && rows.length > 1 ? Q : P;
            const col = mix(mix(DIM, accent, lit), [255, 220, 170], heat * 0.8);
            const w = lerp(7, 8, lit);
            c.fillStyle = css(frac > 0 && frac < 1 ? DIM : col);
            c.beginPath();
            c.roundRect(X(i + 0.5) - w / 2, top, w, BOT - top, w / 2);
            c.fill();
            if (frac > 0 && frac < 1 && lit > 0) {
              const h = (BOT - top) * frac;
              c.fillStyle = css(col);
              c.beginPath();
              c.roundRect(X(i + 0.5) - w / 2, BOT - h, w, h, w / 2);
              c.fill();
            }
            if (lit > 0) glowA.push(i);
            t = c.pop();
          }
          // 竖线与读数
          t = c.el(`hair:${lvl}`, `${cur.b.value}% 的竖线`);
          const hx = X(D.frontOf(cur.b, t));
          const o = smooth(progress(t, cur.b.numAt, cur.b.numAt + 0.3));
          c.fillStyle = INK;
          c.globalAlpha = o * 0.9;
          c.fillRect(hx - 0.75, 330, 1.5, BOT + 18 - 330);
          c.globalAlpha = 1;
          t = c.el(`num:${lvl}`, `${cur.b.value}%`, TEXT);
          const fn = D.frontOf(cur.b, t);
          const size = 220;
          const w = numEm(cur.b.value) * size;
          const right = X(fn) + 22 + w <= 1860;
          const nx = right ? X(fn) + 22 : Math.max(60, X(fn) - 22 - w);
          readout(c, {x: nx, baseline: 500, size, value: fn, target: cur.b.value, speed: D.speedOf(cur.b, t), color: INK, alpha: smooth(progress(t, cur.b.numAt, cur.b.numAt + 0.3)), pulse: D.landPulse(t, cur.b.land)});
          if (cur.b.prefix) {
            t = c.el(`prefix:${lvl}`, cur.b.prefix, TEXT);
            D.reveal(c, cur.b.prefix, nx + 2, 500 - size * 0.7 - 50, 38, INK, t, Math.max(cur.b.numAt, zoomAt + 0.75), 0.03);
          }
          t = c.el(`cap:${lvl}`, cur.b.caption, TEXT);
          const wrap = D.wrapText(cur.b.caption, right ? 1860 - nx : 1000, 40, 24, 2);
          D.revealLines(c, wrap, right ? nx + 4 : hx - 22, 508 - (wrap.lines.length > 1 ? 0 : 0), INK, t, Math.max(cur.b.capAt, zoomAt + 0.75), right ? 'left' : 'right');
        }
        // 面包屑：放大之后，上一层的数留在上方，读得出是「里面的里面」
        let cx = 60;
        rows.forEach((r, i) => {
          if (i >= lvl) return;
          t = c.el(`crumb:${i}`, `上一层的 ${r.b.value}%`, TEXT);
          const at = rows[i + 1].b.run[0] - 1.0;
          const a = smooth(progress(t, at + 0.1, at + 0.5));
          if (a <= 0) return;
          c.globalAlpha = a;
          c.fillStyle = INK;
          c.font = D.numFont(104);
          c.textAlign = 'left';
          c.textBaseline = 'alphabetic';
          const label = `${r.b.value}%`;
          c.fillText(label, cx, 146);
          const w = c.measureText(label).width;
          const capW = D.wrapText(r.b.caption, Math.max(w + 200, 380), 28, 22, 3);
          c.font = `${capW.size}px ${D.FONT_CN}`;
          capW.lines.forEach((l, li) => c.fillText(l, cx + 2, 188 + li * capW.size * 1.25));
          cx += Math.max(w, capW.w) + 34;
          c.fillStyle = css(hex(INK), 0.55);
          c.font = `38px ${D.FONT_CN}`;
          c.fillText('里面', cx, 132);
          cx += 112;
          c.globalAlpha = 1;
        });
        // 刻度
        c.el('ruler', '刻度尺', {group: true});
        for (let v = 0; v <= 100; v++) {
          c.push(`tick:${v}`, `刻度 ${v}`);
          const major = v % 10 === 0;
          c.fillStyle = css(mix(BG, hex(INK), major ? 0.45 : 0.25));
          c.fillRect(X(v) - 0.75, 966, 1.5, major ? 22 : v % 5 === 0 ? 14 : 8);
          if (major) {
            c.font = `30px ${D.FONT_TICK}`;
            c.textAlign = 'center';
            c.fillText(String(v), X(v), 1024);
          }
          c.pop();
        }
      };
      return {draw};
    },
  });

  // ---------- 答卷：问一题答一题，答过的留在上方，整张答卷慢慢累积（shotcraft scroll-brake） ----------
  D.register('survey', {
    name: '一张答卷', family: 'B', desc: '连问连答专用：问题打出来，答案和百分比落定，答过的题累积成一张答卷。', source: 'shotcraft scroll-brake + document-typewriter', colors: PAPER, maxMetrics: 10,
    create(spec, tl, S) {
      const rows = flat(spec);
      const INK = spec.colors.primary;
      const INKC = hex(INK);
      const RED = spec.colors.secondary;
      const REDC = hex(RED);
      const BG = hex(spec.colors.bg);
      const n = rows.length;
      const readout = D.makeReadout(S);
      const LIST_TOP = 60;
      const listH = Math.min(120, 620 / Math.max(1, n - 1));
      const FINAL_H = Math.min(190, 960 / n);
      const last = rows[n - 1].b;
      const draw = (c, t) => {
        clear(c, S, spec.colors.bg);
        const T = t;
        const finAt = (u) => smooth(progress(u, last.land + 1.1, last.land + 1.8));
        const fin = finAt(T);
        let cur = 0;
        rows.forEach((r, i) => {
          if (T >= r.b.capAt - 0.1) cur = i;
        });
        rows.forEach((r, i) => {
          const b = r.b;
          if (T < b.capAt - 0.1) return;
          const answer = r.m.answer || '';
          const isCur = i === cur && fin < 1;
          if (i < cur || (i === cur && fin >= 1) || (fin > 0 && i === cur)) {
            // 列表行
            const y = lerp(LIST_TOP + i * listH, 60 + i * FINAL_H, fin);
            const h = lerp(listH, FINAL_H, fin);
            // 列表行的每一块都能单独调快慢，所以淡入按各自的时间算
            const rowIn = (u) => (i === cur ? finAt(u) : smooth(progress(u, rows[i + 1] ? rows[i + 1].b.capAt - 0.1 : 1e9, (rows[i + 1] ? rows[i + 1].b.capAt : 1e9) + 0.4)));
            c.globalAlpha = rowIn(c.el(`lq:${i}`, b.caption, TEXT));
            const qs = Math.min(40, h * 0.32);
            const wrap = D.wrapText(b.caption, 1240, qs, 24, 2);
            wrap.lines.forEach((l, li) => {
              c.fillStyle = css(mix(BG, INKC, 0.78));
              c.font = `${wrap.size}px ${D.FONT_CN}`;
              c.textAlign = 'left';
              c.textBaseline = 'alphabetic';
              c.fillText(l, 60, y + wrap.size * 1.05 + li * wrap.size * 1.25);
            });
            const ns = Math.min(112, h * 0.68);
            c.globalAlpha = rowIn(c.el(`lv:${i}`, `${b.value}%`, TEXT));
            c.font = D.numFont(ns);
            c.fillStyle = RED;
            c.textAlign = 'right';
            c.fillText(`${b.value}%`, 1600, y + ns * 0.8);
            if (answer) {
              c.globalAlpha = rowIn(c.el(`la:${i}`, answer, TEXT));
              c.fillStyle = INK;
              c.font = `${Math.min(44, h * 0.34)}px ${D.FONT_CN}`;
              c.textAlign = 'left';
              c.fillText(answer, 1626, y + ns * 0.72);
            }
            c.globalAlpha = rowIn(c.el(`ll:${i}`, `第 ${i + 1} 题分隔线`));
            c.fillStyle = css(mix(BG, INKC, 0.18));
            c.fillRect(60, y + h - 8, 1800, 1.5);
            c.globalAlpha = 1;
          }
          if (isCur) {
            const top = LIST_TOP + cur * listH + 34;
            const room = 1040 - top;
            const hero = clamp(room / 760);
            const qs = lerp(40, 74, hero);
            const wrap = D.wrapText(b.caption, 1400, qs, 28, 3);
            t = c.el(`hq:${i}`, b.caption, TEXT);
            const pOut = 1 - finAt(t);
            c.globalAlpha = pOut;
            // 问题逐字打出
            const dur = Math.max(0.25, b.run[1] - b.capAt - 0.2);
            const total = wrap.lines.join('').length;
            const shown = Math.floor(total * clamp((t - b.capAt) / dur));
            let left = shown;
            wrap.lines.forEach((l, li) => {
              const arr = Array.from(l);
              const part = arr.slice(0, Math.max(0, left)).join('');
              left -= arr.length;
              c.fillStyle = INK;
              c.font = `${wrap.size}px ${D.FONT_CN}`;
              c.textAlign = 'left';
              c.textBaseline = 'alphabetic';
              c.fillText(part, 60, top + wrap.size * 1.05 + li * wrap.size * 1.3);
              if (left <= 0 && left > -arr.length && Math.floor(t * 3) % 2 === 0 && shown < total) {
                c.fillRect(60 + D.textEm(part) * wrap.size + 6, top + 4 + li * wrap.size * 1.3, 4, wrap.size * 1.1);
              }
            });
            const size = lerp(170, 300, hero);
            const baseline = Math.min(1000, top + D.linesH(wrap) + 40 + size * 0.7);
            t = c.el(`hn:${i}`, `${b.value}%`, TEXT);
            const f = D.frontOf(b, t);
            const o = smooth(progress(t, b.run[0] + 0.1, b.run[0] + 0.4));
            readout(c, {x: 60, baseline, size, value: f, target: b.value, speed: D.speedOf(b, t), color: RED, alpha: o, pulse: D.landPulse(t, b.land)});
            const ax = 60 + numEm(b.value) * size + 34;
            if (answer) {
              t = c.el(`ha:${i}`, answer, TEXT);
              D.reveal(c, answer, ax, baseline - size * 0.46, Math.min(100, size * 0.42), INK, t, b.land - 0.15);
            }
            // 右侧 100 格小方阵，数值的量感
            t = c.el(`hg:${i}`, `第 ${i + 1} 题的方阵`, {group: true});
            const cell = Math.min(34, (room - 60) / 10);
            const gx = 1860 - cell * 10;
            const gy = baseline - cell * 10 + 6;
            for (let k = 0; k < 100; k++) {
              t = c.push(`hd:${i}:${k}`, `第 ${k + 1} 格`);
              const lit = clamp((t - b.lit[k]) * 20);
              const col = k % 10;
              const row = Math.floor(k / 10);
              c.fillStyle = css(mix(mix(BG, INKC, 0.14), REDC, lit));
              c.beginPath();
              c.arc(gx + (col + 0.5) * cell, gy + (row + 0.5) * cell, cell * lerp(0.26, 0.36, lit), 0, Math.PI * 2);
              c.fill();
              t = c.pop();
            }
            c.globalAlpha = 1;
          }
        });
      };
      return {draw};
    },
  });

  // ---------- 仪表：点火自检，先甩满量程，再回落真值（shotcraft needle-sweep-selftest） ----------
  D.register('gauge', {
    name: '仪表自检', family: '数据', desc: '基数各不相同时用：一个表一个量程，指针先甩满全弧再回落到真值。', source: 'shotcraft needle-sweep-selftest', colors: {bg: '#0B0C0E', primary: '#F59E0B', secondary: '#FFF4E2'}, maxMetrics: 4,
    create(spec, tl, S) {
      const rows = flat(spec);
      const INK = inkOf(spec);
      const INKC = hex(INK);
      const P = hex(spec.colors.primary);
      const Q = hex(spec.colors.secondary);
      const n = rows.length;
      const R = [320, 300, 250, 200][n - 1];
      const CY = n === 1 ? 500 : 440;
      const stepX = 1800 / n;
      const readout = D.makeReadout(S);
      const WN = 10;
      const angleAt = (b, t) => {
        const target = (b.value / 100) * 270;
        const lead = Math.min(1.25, (b.land - b.run[0]));
        const s = b.land - lead;
        if (t <= s) return 0;
        const out = Math.min(0.4, lead * 0.35);
        if (t <= s + out) return 270 * outCubic((t - s) / out);
        const tau = t - s - out;
        const p = Math.min(0.5, 8 / Math.max(10, 270 - target));
        const lp = Math.log(p);
        const zeta = -lp / Math.sqrt(Math.PI * Math.PI + lp * lp);
        const wd = WN * Math.sqrt(1 - zeta * zeta);
        const env = Math.exp(-zeta * WN * tau);
        const k = 1 - env * (Math.cos(wd * tau) + ((zeta * WN) / wd) * Math.sin(wd * tau));
        return tau > 1.6 ? target : lerp(270, target, k);
      };
      const polar = (cx, cy, d, r) => {
        const a = ((135 + d) * Math.PI) / 180;
        return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
      };
      const draw = (c, t) => {
        clear(c, S, spec.colors.bg);
        rows.forEach((r, i) => {
          const b = r.b;
          const cx = 60 + stepX * (i + 0.5);
          const onAt = (u) => smooth(progress(u, b.capAt - 0.3, b.capAt + 0.2));
          t = c.el(`face:${i}`, `第 ${i + 1} 个表盘`);
          if (onAt(t) <= 0) return;
          const lead = Math.min(1.25, b.land - b.run[0]);
          const s = b.land - lead;
          const accent = b.emphasis ? Q : P;
          c.lineCap = 'round';
          // 表面与外环
          c.globalAlpha = onAt(t);
          const g = c.createRadialGradient(cx, CY, 0, cx, CY, R);
          g.addColorStop(0, css(mix(hex(spec.colors.bg), INKC, 0.1)));
          g.addColorStop(1, css(mix(hex(spec.colors.bg), INKC, 0.03)));
          c.fillStyle = g;
          c.beginPath();
          c.arc(cx, CY, R, 0, Math.PI * 2);
          c.fill();
          c.strokeStyle = css(INKC, 0.16);
          c.lineWidth = 2;
          c.stroke();
          // 跟随指针的亮弧
          t = c.el(`arc:${i}`, `第 ${i + 1} 个表的亮弧`);
          c.globalAlpha = onAt(t);
          let d = angleAt(b, t);
          c.strokeStyle = css(accent);
          c.lineWidth = R * 0.03;
          c.beginPath();
          c.arc(cx, CY, R - R * 0.06, ((135) * Math.PI) / 180, ((135 + Math.max(0.01, d)) * Math.PI) / 180);
          c.stroke();
          // 刻度：去程扫过时依次点亮，回程后回落
          t = c.el(`gt:${i}`, `第 ${i + 1} 个表的刻度`);
          c.globalAlpha = onAt(t);
          d = angleAt(b, t);
          const calm = smooth(progress(t, s + 0.4, s + 1.2));
          for (let k = 0; k <= 50; k++) {
            const dd = k * 5.4;
            const major = k % 5 === 0;
            const [x0, y0] = polar(cx, CY, dd, R * 0.87);
            const [x1, y1] = polar(cx, CY, dd, R * (major ? 0.77 : 0.82));
            const swept = (t < s + 0.4 ? d : 270) >= dd - 0.5 ? 1 - calm : 0;
            c.strokeStyle = css(INKC, 0.28 + 0.6 * swept);
            c.lineWidth = major ? 3 : 1.5;
            c.beginPath();
            c.moveTo(x0, y0);
            c.lineTo(x1, y1);
            c.stroke();
            if (major && R >= 200) {
              const [lx, ly] = polar(cx, CY, dd, R * 0.66);
              c.fillStyle = css(INKC, 0.55);
              c.font = `${R * 0.085}px ${D.FONT_TICK}`;
              c.textAlign = 'center';
              c.textBaseline = 'middle';
              c.fillText(String(k * 2), lx, ly);
            }
          }
          c.textBaseline = 'alphabetic';
          // 指针与拖影
          t = c.el(`needle:${i}`, `第 ${i + 1} 个表的指针`);
          c.globalAlpha = onAt(t);
          d = angleAt(b, t);
          const needle = (deg, alpha) => {
            const [tx, ty] = polar(cx, CY, deg, R * 0.9);
            const [bx, by] = polar(cx, CY, deg + 180, R * 0.14);
            const nx = -(ty - by);
            const ny = tx - bx;
            const l = Math.hypot(nx, ny) || 1;
            c.fillStyle = css(accent, alpha);
            c.beginPath();
            c.moveTo(bx + (nx / l) * 6, by + (ny / l) * 6);
            c.lineTo(tx, ty);
            c.lineTo(bx - (nx / l) * 6, by - (ny / l) * 6);
            c.closePath();
            c.fill();
          };
          const dv = d - angleAt(b, t - 1 / 60);
          if (Math.abs(dv) > 3) for (let g2 = 1; g2 <= 4; g2++) needle(d - (dv * g2) / 4, 0.16 * (1 - g2 / 5));
          needle(d, 1);
          t = c.el(`hub:${i}`, `第 ${i + 1} 个表的轴心`);
          c.globalAlpha = onAt(t);
          c.fillStyle = css(mix(hex(spec.colors.bg), INKC, 0.5));
          c.beginPath();
          c.arc(cx, CY, R * 0.055, 0, Math.PI * 2);
          c.fill();
          c.globalAlpha = 1;
          // 落定同帧弹出读数
          t = c.el(`num:${i}`, `${b.value}%`, TEXT);
          const pop = smooth(progress(t, b.land - 0.2, b.land + 0.05));
          const over = 1 + 0.12 * Math.exp(-7 * Math.max(0, t - b.land)) * Math.sin(Math.max(0, t - b.land) * 14);
          const size = R * 0.46;
          c.save();
          c.translate(cx, CY + R * 0.74);
          c.scale(over, over);
          c.translate(-cx, -(CY + R * 0.74));
          readout(c, {x: cx - (numEm(b.value) * size) / 2, baseline: CY + R * 0.74 + size * 0.35, size, value: b.value, target: b.value, color: INK, alpha: pop});
          c.restore();
          const wrap = D.wrapText(b.caption, stepX - 60, n >= 3 ? 34 : 42, 24, 3);
          const capY = CY + R + 70;
          t = c.el(`cap:${i}`, b.caption, TEXT);
          wrap.lines.forEach((l, li) => D.reveal(c, l, cx, capY + li * wrap.size * 1.25, wrap.size, INK, t, b.capAt + li * 0.1, 0.02, 0.5, 'center'));
          if (r.title && r.showTitle) {
            t = c.el(`title:${i}`, r.title, TEXT);
            D.reveal(c, r.title, cx, Math.max(30, CY - R - 74), n >= 3 ? 36 : 46, INK, t, b.capAt, 0.02, 0.5, 'center');
          }
          if (b.note) {
            t = c.el(`note:${i}`, b.note.text, TEXT);
            const w2 = D.wrapText(b.note.text, stepX - 60, 28, 22, 3);
            c.globalAlpha = 0.7;
            w2.lines.forEach((l, li) => D.reveal(c, l, cx, capY + D.linesH(wrap) + 12 + li * w2.size * 1.25, w2.size, INK, t, b.note.at, 0.016, 0.4, 'center'));
            c.globalAlpha = 1;
          }
        });
      };
      return {draw};
    },
  });

  // ---------- 滚带定针：世界在动，针不动；最后拉远看全（shotcraft tape-scroll-fixed-pointer） ----------
  D.register('tape', {
    name: '一把尺子', family: '数据', desc: '几个数连着说：指针不动，刻度带滚过去，最后拉远，几个数都留在同一把尺上。', source: 'shotcraft tape-scroll-fixed-pointer', colors: {bg: '#EEF1F5', primary: '#1D4ED8', secondary: '#E4572E'}, maxMetrics: 5,
    create(spec, tl, S) {
      const rows = flat(spec);
      const INK = '#0F1420';
      const INKC = hex(INK);
      const P = spec.colors.primary;
      const PC = hex(P);
      const QC = hex(spec.colors.secondary);
      const BG = hex(spec.colors.bg);
      const readout = D.makeReadout(S);
      const SPRINT = bezier(0.55, 0, 0.25, 1);
      const CY = 540;
      const TX = 1120;
      const n = rows.length;
      const valueAt = (t) => {
        let v = 0;
        rows.forEach((r, i) => {
          const b = r.b;
          const a = i === 0 ? 0 : rows[i - 1].b.value;
          const to = b.value;
          const s = b.land - Math.min(1.25, Math.max(0.5, b.land - (i ? rows[i - 1].b.land : 0)) * 0.8);
          if (t < s) return;
          const dir = to >= a ? 1 : -1;
          const over = Math.min(3, Math.abs(to - a) * 0.12);
          const pre = 0.1;
          const sprint = Math.max(0.3, b.land - s - 0.32);
          if (t < s + pre) v = lerp(a, a - dir * Math.min(2, Math.abs(to - a) * 0.08), smooth((t - s) / pre));
          else if (t < s + pre + sprint) v = lerp(a - dir * Math.min(2, Math.abs(to - a) * 0.08), to + dir * over, SPRINT((t - s - pre) / sprint));
          else {
            const tau = t - s - pre - sprint;
            v = tau > 1.5 ? to : to + dir * over * Math.exp(-5.5 * tau) * Math.cos(2 * Math.PI * 1.7 * tau);
          }
        });
        return v;
      };
      const last = rows[n - 1].b;
      const draw = (c, t) => {
        clear(c, S, spec.colors.bg);
        const T = t;
        const finAt = (u) => bezier(0.7, 0, 0.2, 1)(progress(u, last.land + 0.9, last.land + 1.8));
        t = c.el('tape', '刻度带', {group: true});
        const fin = finAt(t);
        const v = lerp(valueAt(t), 50, fin);
        const PX = lerp(16, 8.6, fin);
        const speed = Math.abs(valueAt(t) - valueAt(t - 1 / 60)) * 60 * PX;
        const yOf = (u) => CY + (v - u) * PX;
        // 刻度带
        const mask = c.createLinearGradient(0, 0, 0, 1080);
        const edge = lerp(0.2, 0.02, fin);
        c.save();
        const smear = Math.min(46, speed / 60);
        for (let u = 0; u <= 100; u += 2) {
          const tk = c.push(`tk:${u}`, `刻度 ${u}`);
          const y = tk === t ? yOf(u) : CY + (lerp(valueAt(tk), 50, finAt(tk)) - u) * PX;
          if (y < -40 || y > 1120) {
            c.pop();
            continue;
          }
          const major = u % 10 === 0;
          const a = clamp(Math.min(y / (1080 * edge + 1), (1080 - y) / (1080 * edge + 1)));
          c.fillStyle = css(INKC, (major ? 0.9 : 0.34) * a);
          const len = major ? 170 : 80;
          c.fillRect(TX + 500 - len, y - (major ? 2 : 1) - smear / 2, len, (major ? 4 : 2) + smear);
          if (major) {
            c.font = `${lerp(70, 40, fin)}px ${D.FONT_TICK}`;
            c.textAlign = 'right';
            c.textBaseline = 'middle';
            c.fillStyle = css(INKC, 0.85 * a * clamp((Math.abs(y - CY) - 44) / 24 + fin));
            c.fillText(String(u), TX + 300, y);
          }
          c.pop();
        }
        c.textBaseline = 'alphabetic';
        // 留在尺子上的旗标
        rows.forEach((r, i) => {
          const b = r.b;
          t = c.el(`flag:${i}`, `${b.value}% 的旗标`);
          if (t < b.land) return;
          const y = yOf(b.value);
          const a = smooth(progress(t, b.land, b.land + 0.3));
          const accent = b.emphasis ? QC : PC;
          c.fillStyle = css(accent, a);
          c.beginPath();
          c.moveTo(TX + 516, y);
          c.lineTo(TX + 548, y - 15);
          c.lineTo(TX + 548, y + 15);
          c.closePath();
          c.fill();
          c.font = D.numFont(lerp(34, 44, fin));
          c.textAlign = 'left';
          c.fillText(`${b.value}%`, TX + 560, y + 15);
        });
        c.restore();
        void mask;
        // 指针
        t = c.el('pointer', '指针');
        const pa = 1 - finAt(t);
        c.globalAlpha = pa;
        c.fillStyle = P;
        c.beginPath();
        c.moveTo(TX - 12, CY);
        c.lineTo(TX + 22, CY - 20);
        c.lineTo(TX + 22, CY + 20);
        c.closePath();
        c.fill();
        c.fillRect(TX + 22, CY - 1.5, 480, 3);
        c.globalAlpha = 1;
        // 左侧：当前的数最大，说过的数排在上方
        const rowsTop = 90;
        const listH = 142;
        let cur = 0;
        rows.forEach((r, i) => {
          if (T >= r.b.capAt - 0.1) cur = i;
        });
        const finalH = Math.min(320, 900 / n);
        rows.forEach((r, i) => {
          const b = r.b;
          if (T < b.capAt - 0.1) return;
          t = c.el(`num:${i}`, `${b.value}%`, TEXT);
          const leaveCur = i < cur ? smooth(progress(t, rows[i + 1].b.capAt - 0.15, rows[i + 1].b.capAt + 0.35)) : 0;
          const hero = rowsTop + cur * listH + (cur ? 60 : 180);
          const y0 = lerp(hero, rowsTop + i * listH, leaveCur);
          const y = lerp(y0, 80 + i * finalH, fin);
          const heroSize = n > 1 ? 280 : 400;
          const s = lerp(lerp(heroSize, 84, leaveCur), Math.min(150, finalH * 0.55), fin);
          const baseline = y + s * 0.72;
          const val = i === cur && fin < 1 ? clamp(valueAt(t), 0, 100) : b.value;
          const shown = t >= b.land ? b.value : Math.max(0, Math.min(99.9, val));
          readout(c, {x: 60, baseline, size: s, value: Math.min(shown, b.value), target: b.value, speed: i === cur ? D.speedOf(b, t) : 0, color: b.emphasis && t > b.land ? spec.colors.secondary : INK, alpha: smooth(progress(t, b.numAt, b.numAt + 0.2)), pulse: D.landPulse(t, b.land)});
          const capSize = lerp(lerp(46, 30, leaveCur), Math.min(36, finalH * 0.14), fin);
          const wrap = D.wrapText(b.caption, 930, capSize, 22, 3);
          t = c.el(`cap:${i}`, b.caption, TEXT);
          D.revealLines(c, wrap, 64, baseline + 12, INK, t, b.capAt);
          if (b.prefix) {
            t = c.el(`prefix:${i}`, b.prefix, TEXT);
            D.reveal(c, b.prefix, 64, y - capSize * 0.4, Math.max(30, s * 0.16), INK, t, b.numAt, 0.03);
          }
        });
      };
      return {draw};
    },
  });

  // ---------- 字里填满：数字本身是容器，液面高度就是百分比（shotcraft outline-word-fill） ----------
  D.register('fill', {
    name: '字里填满', family: '文字', desc: '一两个要记住的数：数字描边，里面的液面升到真值的高度。', source: 'shotcraft outline-word-fill + metalforge Slosh', colors: BLACK, maxMetrics: 4,
    create(spec, tl, S) {
      const rows = flat(spec);
      const INK = inkOf(spec);
      const INKC = hex(INK);
      const P = spec.colors.primary;
      const n = rows.length;
      const SIZE = [620, 430, 300, 224][n - 1];
      const stepX = 1800 / n;
      const BASE = n === 1 ? 700 : 660;
      const draw = (c, t) => {
        clear(c, S, spec.colors.bg);
        rows.forEach((r, i) => {
          const b = r.b;
          if (r.title && r.showTitle) {
            t = c.el(`title:${i}`, r.title, TEXT);
            D.reveal(c, r.title, 60 + stepX * (i + 0.5), n === 1 ? 70 : 90, n === 1 ? 64 : 42, INK, t, Math.min(0.2, b.capAt), 0.02, 0.5, 'center');
          }
          const onAt = (u) => smooth(progress(u, Math.min(b.numAt, 0.5), Math.min(b.numAt, 0.5) + 0.5));
          t = c.el(`outline:${i}`, `${b.value}% 的描边`, TEXT);
          const on = onAt(t);
          if (on <= 0) return;
          const label = `${b.value}%`;
          const cx = 60 + stepX * (i + 0.5);
          c.font = D.numFont(SIZE);
          c.textAlign = 'center';
          c.textBaseline = 'alphabetic';
          const f = D.frontOf(b, t) / 100;
          const cap = SIZE * 0.7;
          const yTop = BASE - cap;
          const level = BASE - cap * f;
          const w = c.measureText(label).width;
          const sp = D.speedOf(b, t);
          const settle = Math.exp(-3.2 * Math.max(0, t - b.land));
          const amp = Math.min(SIZE * 0.035, sp * 0.4) + SIZE * 0.012 * (t > b.land ? settle : 0);
          // 描边
          c.globalAlpha = on;
          c.strokeStyle = css(INKC, 0.7);
          c.lineWidth = Math.max(2, SIZE * 0.006);
          c.strokeText(label, cx, BASE);
          // 液面
          t = c.el(`liquid:${i}`, `${b.value}% 的液面`, TEXT);
          c.globalAlpha = onAt(t);
          c.save();
          c.beginPath();
          c.moveTo(cx - w / 2 - 20, BASE + 40);
          const steps = 40;
          for (let k = 0; k <= steps; k++) {
            const x = cx - w / 2 - 20 + ((w + 40) * k) / steps;
            const yy = level + amp * Math.sin(k * 0.55 + t * 9) * 0.6 + amp * Math.sin(k * 0.23 - t * 6) * 0.4;
            c.lineTo(x, yy);
          }
          c.lineTo(cx + w / 2 + 20, BASE + 40);
          c.closePath();
          c.clip();
          c.fillStyle = b.emphasis ? spec.colors.secondary : P;
          c.fillText(label, cx, BASE);
          c.restore();
          // 侧边标尺：高度就是百分比
          t = c.el(`scale:${i}`, `第 ${i + 1} 个侧边标尺`);
          c.globalAlpha = onAt(t);
          const rx = cx - w / 2 - 26;
          c.fillStyle = css(INKC, 0.5);
          c.fillRect(rx, yTop, 1.5, cap);
          [0, 50, 100].forEach((v) => {
            const y = BASE - (cap * v) / 100;
            c.fillRect(rx - 10, y - 0.75, 10, 1.5);
            if (SIZE >= 300) {
              c.font = `26px ${D.FONT_TICK}`;
              c.textAlign = 'right';
              c.fillText(String(v), rx - 14, y + 9);
            }
          });
          c.globalAlpha = 1;
          if (b.prefix) {
            t = c.el(`prefix:${i}`, b.prefix, TEXT);
            D.reveal(c, b.prefix, cx - w / 2, yTop - 72, n === 1 ? 54 : 40, INK, t, b.numAt, 0.03);
          }
          t = c.el(`cap:${i}`, b.caption, TEXT);
          const wrap = D.wrapText(b.caption, stepX - 50, n === 1 ? 54 : n === 2 ? 44 : 34, 24, 3);
          wrap.lines.forEach((l, li) => D.reveal(c, l, cx, BASE + 44 + li * wrap.size * 1.25, wrap.size, INK, t, b.capAt + li * 0.1, 0.02, 0.5, 'center'));
        });
      };
      return {draw};
    },
  });

  D.BLACK = BLACK;
  D.PAPER = PAPER;
  D.clearFrame = clear;
  void lerp;
  void outExpo;
  void runCurve;
  void textEm;
})(window);
