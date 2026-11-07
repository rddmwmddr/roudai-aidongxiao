// A「一百根」：一根竖条 = 1%。
// 包含关系：同一批竖条再烧白、变粗。相反的两拨：前沿从两头往中间走。基数不同：尺子上方拉一道括号。
(function (root) {
  'use strict';
  const {clamp, lerp, progress, smooth, outExpo, outCubic, wobble, springTo, hash, noise1, hex, mix, css, luma, textEm, numEm, FONT_TICK} = root.DM;
  const D = root.DM;
  const TEXT = D.TEXT;
  const DEFAULT = {bg: '#0A0A0B', primary: '#FF5C1E', secondary: '#FFF4E2'};

  const create = (spec, tl, S) => {
    const X = (v) => 60 + 18 * v;
    const groups = spec.groups;
    const INK = luma(hex(spec.colors.bg)) < 0.5 ? '#F4F1EA' : '#141416';
    const inkRGB = hex(INK);
    const BGC = hex(spec.colors.bg);
    const DIM = spec.colors.bg === DEFAULT.bg ? [54, 54, 58] : mix(BGC, inkRGB, 0.2);
    const WEEK = hex(spec.colors.primary);
    const WEEK_HOT = spec.colors.primary === DEFAULT.primary ? [255, 190, 120] : mix(WEEK, [255, 255, 255], 0.55);
    const DAY = hex(spec.colors.secondary);
    const TICK_ON = mix([120, 118, 112], WEEK, 0.75);
    const TICK_OFF = luma(BGC) < 0.5 ? [78, 77, 74] : mix(BGC, inkRGB, 0.35);
    const TICK_NUM = luma(BGC) < 0.5 ? '#8E8B85' : css(mix(BGC, inkRGB, 0.55));
    const splits = groups.map((g) => g.metrics[0].beat.splitAt);

    const rowLayout = (k, i) => {
      if (k === 1) return {y0: 52, titleY: 52, titleSize: 68, line: 402, num: 340, cap: 46, capGap: 12, top: 508, bottom: 948};
      if (k === 2) {
        return i === 0
          ? {y0: 44, titleY: 44, titleSize: 49, line: 226, num: 170, cap: 36, capGap: 12, top: 304, bottom: 458}
          : {y0: 514, titleY: 514, titleSize: 49, line: 726, num: 170, cap: 36, capGap: 12, top: 804, bottom: 948};
      }
      if (k === 3) {
        const y0 = 36 + i * 314;
        return {y0, titleY: y0, titleSize: 38, line: y0 + 136, num: 112, cap: 30, capGap: 8, top: y0 + 190, bottom: y0 + 284};
      }
      const y0 = 36 + i * 233;
      return {y0, titleY: y0, titleSize: 32, line: y0 + 97, num: 76, cap: 26, capGap: 6, top: y0 + 142, bottom: y0 + 213};
    };

    const oneLine = (m, cap, maxW) => ({lines: m.caption ? [m.caption] : [], size: D.fitSize(m.caption, maxW, cap, 22), get w() { return textEm(m.caption) * this.size; }});
    const blockW = (value, size, wrap) => Math.max(numEm(value) * size, wrap.w || 0);

    // 相反的两拨：数字面对面，都在竖线朝向中间的一侧
    const placeOpposing = (k, gi) => {
      const L = rowLayout(k, gi);
      const ms = groups[gi].metrics;
      const h0 = X(ms[0].value);
      const h1 = X(100 - ms[1].value);
      const free = h1 - h0 - 44 - 16;
      let s = L.num;
      while (s > L.num * 0.42 && (numEm(ms[0].value) + numEm(ms[1].value)) * s > free) s *= 0.95;
      const nw0 = numEm(ms[0].value) * s;
      const nw1 = numEm(ms[1].value) * s;
      const share0 = Math.max(nw0, free * 0.5);
      const share1 = Math.max(nw1, free - share0);
      const w0 = D.wrapText(ms[0].caption, share0, L.cap, 22, 2);
      const w1 = D.wrapText(ms[1].caption, share1, L.cap, 22, 2);
      const extra = Math.max(w0.lines.length, w1.lines.length) > 1 ? Math.max(D.linesH(w0), D.linesH(w1)) - w0.size * 1.25 : 0;
      const line = L.line - extra;
      return [
        {size: s, wrap: w0, capGap: L.capGap, line, w: Math.max(nw0, w0.w), nw: nw0, side: 'right', align: 'left'},
        {size: s, wrap: w1, capGap: L.capGap, line, w: Math.max(nw1, w1.w), nw: nw1, side: 'left', align: 'right'},
      ];
    };

    // 普通情况：优先贴竖线右侧，放不下翻左侧，再放不下靠右边距，两数相撞时缩小或后排
    const placeRow = (k, gi, heroInner) => {
      const L = rowLayout(k, gi);
      const ms = groups[gi].metrics;
      if (groups[gi].relation === 'opposing') return placeOpposing(k, gi);
      const outerV = ms[0].value;
      const capMax = L.cap >= 40 ? 900 : 760;
      if (ms.length === 1 || (k === 1 && !heroInner)) {
        const wrap = oneLine(ms[0], L.cap, capMax);
        const w = blockW(outerV, L.num, wrap);
        return [{size: L.num, wrap, capGap: L.capGap, line: L.line, w, nw: numEm(outerV) * L.num, side: X(outerV) + 22 + w <= 1860 ? 'right' : 'left', align: 'left', fx: 0}];
      }
      const outerSize = k === 1 ? 150 : L.num;
      const outerWrap = oneLine(ms[0], k === 1 ? 36 : L.cap, capMax);
      const innerBase = k === 1 ? 340 : L.num;
      const innerV = ms[1].value;
      const w1 = blockW(outerV, outerSize, outerWrap);
      const options = [];
      if (X(outerV) + 22 + w1 <= 1860) options.push({side: 'right', x0: X(outerV) + 22});
      if (X(outerV) - 22 - w1 >= 60) options.push({side: 'left', x0: X(outerV) - 22 - w1});
      options.push({side: 'free', x0: 1860 - w1, fx: 1860 - w1});
      const outerPl = (o) => ({size: outerSize, wrap: outerWrap, capGap: k === 1 ? 12 : L.capGap, line: L.line, w: w1, nw: numEm(outerV) * outerSize, side: o.side, fx: o.fx, align: 'left'});
      for (let s = innerBase; s >= innerBase * 0.46; s *= 0.9) {
        const wrap = oneLine(ms[1], Math.max((k === 1 ? 46 : L.cap) * (s / innerBase), Math.min(L.cap, 36)), capMax);
        const w2 = blockW(innerV, s, wrap);
        for (const o of options) {
          const o0 = o.x0;
          const o1 = o.x0 + w1;
          const clear = (a, b) => b + 12 <= o0 || a - 12 >= o1;
          const hairOK = (a, b) => o.side === 'free' || X(outerV) <= a - 8 || X(outerV) >= b + 8;
          const ra = X(innerV) + 22;
          if (ra + w2 <= 1860 && clear(ra, ra + w2) && hairOK(ra, ra + w2)) {
            return [outerPl(o), {size: s, wrap, capGap: L.capGap, line: L.line, w: w2, nw: numEm(innerV) * s, side: 'right', align: 'left', fx: 0}];
          }
          const la = X(innerV) - 22 - w2;
          if (la >= 60 && clear(la, la + w2)) {
            return [outerPl(o), {size: s, wrap, capGap: L.capGap, line: L.line, w: w2, nw: numEm(innerV) * s, side: 'left', align: 'left', fx: 0}];
          }
        }
      }
      const o = options[0];
      const s = innerBase * 0.5;
      const wrap = oneLine(ms[1], Math.min(k === 1 ? 46 : L.cap, L.cap), capMax);
      const w2 = blockW(innerV, s, wrap);
      return [outerPl(o), {size: s, wrap, capGap: L.capGap, line: L.line, w: w2, nw: numEm(innerV) * s, side: 'free', align: 'left', fx: Math.min(1860 - w2, o.x0 + w1 + 24)}];
    };

    const placeCache = new Map();
    const place = (k, gi, heroInner) => {
      const key = `${k}|${gi}|${heroInner ? 1 : 0}`;
      if (!placeCache.has(key)) placeCache.set(key, placeRow(k, gi, heroInner));
      return placeCache.get(key);
    };
    const numX = (pl, pos) => {
      if (pl.side === 'free') return pl.fx;
      if (pl.side === 'right') return X(pos) + 22;
      if (pl.align === 'right') return X(pos) - 22 - pl.nw;
      return Math.max(60, X(pos) - 22 - pl.w);
    };

    const ease = (t, at) => outCubic(progress(t, at, at + 0.75));
    const barEase = (t, at, col) => smooth(progress(t, at + col * 0.0035, at + 0.62 + col * 0.0035));

    const rowAt = (gi, t) => {
      const cur = Object.assign({}, rowLayout(gi + 1, gi));
      for (let s = gi + 1; s < groups.length; s++) {
        const e = ease(t, splits[s]);
        if (e <= 0) break;
        const L = rowLayout(s + 1, gi);
        for (const key of ['y0', 'titleY', 'titleSize', 'top', 'bottom']) cur[key] = lerp(cur[key], L[key], e);
      }
      return cur;
    };
    const barsAt = (gi, col, t) => {
      const L0 = rowLayout(gi + 1, gi);
      let top = L0.top;
      let bottom = L0.bottom;
      if (gi > 0) {
        const p = barEase(t, splits[gi], col);
        top = lerp(948, L0.top, p);
        bottom = lerp(948, L0.bottom, p);
      }
      for (let s = gi + 1; s < groups.length; s++) {
        const p = barEase(t, splits[s], col);
        if (p <= 0) break;
        const L = rowLayout(s + 1, gi);
        top = lerp(top, L.top, p);
        bottom = lerp(bottom, L.bottom, p);
      }
      return [top, bottom];
    };

    const metricAt = (gi, mi, t, pos) => {
      const g = groups[gi];
      const ms = g.metrics;
      let pl;
      const make = (p, x) => ({size: p.size, cap: p.wrap.size, capGap: p.capGap, line: p.line, x, wrap: p.wrap, align: p.align, nw: p.nw});
      if (gi === 0 && g.relation !== 'opposing') {
        const single = place(1, 0, false)[0];
        if (mi === 0 && ms.length > 1) {
          const demote = outCubic(progress(t, ms[1].beat.capAt + 0.4, ms[1].beat.capAt + 1.05));
          const both = place(1, 0, true)[0];
          pl = Object.assign(make(single, lerp(numX(single, pos), numX(both, pos), demote)), {size: lerp(single.size, both.size, demote), cap: lerp(single.wrap.size, both.wrap.size, demote), capGap: 12});
        } else if (mi === 0) {
          pl = make(single, numX(single, pos));
        } else {
          const inner = place(1, 0, true)[1];
          pl = make(inner, numX(inner, pos));
        }
      } else {
        const p0 = place(gi + 1, gi, true)[mi];
        pl = make(p0, numX(p0, pos));
      }
      for (let s = Math.max(1, gi + 1); s < groups.length; s++) {
        const e = ease(t, splits[s]);
        if (e <= 0) break;
        const q = place(s + 1, gi, true)[mi];
        pl = Object.assign({}, pl, {size: lerp(pl.size, q.size, e), cap: lerp(pl.cap, q.wrap.size, e), capGap: lerp(pl.capGap, q.capGap, e), line: lerp(pl.line, q.line, e), x: lerp(pl.x, numX(q, pos), e), wrap: q.wrap, nw: lerp(pl.nw, q.nw, e)});
      }
      return pl;
    };

    const readout = D.makeReadout(S);
    const grain = D.makeGrain();
    const glow = document.createElement('canvas');
    glow.width = 480;
    glow.height = 270;
    const g = glow.getContext('2d');
    const soft = D.makeSoftBlur(glow);

    const draw = (c, now) => {
      c.bg();
      c.setTransform(S, 0, 0, S, 0, 0);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
      c.fillStyle = spec.colors.bg;
      c.fillRect(0, 0, 1920, 1080);
      now = c.main();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, 480, 270);
      g.setTransform(0.25, 0, 0, 0.25, 0, 0);
      const {beat: focus, e: focusE} = D.focusOf(tl.beats, now);

      const assemble = (i) => outExpo(progress(now, 0.08 + i * 0.0075, 0.08 + i * 0.0075 + 0.7));
      const round = (x, y, w, h, color) => {
        c.fillStyle = color;
        c.beginPath();
        c.roundRect(x - w / 2, y, w, Math.max(0.01, h), w / 2);
        c.fill();
      };

      groups.forEach((gr, gi) => {
        now = c.el(`bars:${gi}`, `第 ${gi + 1} 组竖条`, {group: true});
        if (gi > 0 && now <= splits[gi]) return;
        const A = gr.metrics[0].beat;
        const B = gr.metrics[1] ? gr.metrics[1].beat : null;
        const active = B && now >= B.run[0] ? B : A;
        const fa = D.posOf(active, now);
        const sa = D.speedOf(active, now);
        for (let i = 0; i < 100; i++) {
          now = c.push(`bar:${gi}:${i}`, `第 ${gi + 1} 组第 ${i + 1} 根`);
          const [top, bottom] = barsAt(gi, i, now);
          const tw = D.colLit(A, i);
          const td = B ? D.colLit(B, i) : Infinity;
          const lit = clamp((now - tw) * 22);
          const heatW = lit > 0 ? Math.exp(-(now - tw) / 0.32) : 0;
          const hot = clamp((now - td) * 16);
          const heatD = hot > 0 ? Math.exp(-(now - td) / 0.3) : 0;
          const scaleB = Math.min(1, (bottom - top) / 150);
          const bounce = ((lit > 0 ? wobble(now - tw, 5.5, 8) * 14 : 0) + (hot > 0 ? wobble(now - td, 5.5, 8) * 12 : 0)) * scaleB;
          const d = (i + 0.5 - fa) / 3.2;
          const spike = Math.exp(-d * d) * clamp(sa / 42) * (0.45 + 0.55 * noise1(i * 1.7 + now * 26)) * scaleB;
          const height = bottom - top;
          const enter = gi === 0 ? assemble(i) : 1;
          const barTop = bottom - height * enter - spike * 74 - bounce;
          const full = bottom - barTop;
          const flash = enter > 0 && enter < 1 ? (1 - enter) * 0.9 : 0;
          const dimC = mix(DIM, [190, 188, 182], flash);
          const inFocus = focus && ((focus === A && lit > 0) || (focus === B && hot > 0));
          const fade = focus && !inFocus ? 0.5 * focusE : 0;
          const tone = (col) => css(mix(col, BGC, fade));
          const cx = X(i + 0.5);
          const fracA = D.colFrac(A, i);
          const fracB = B ? D.colFrac(B, i) : 0;
          if (lit > 0 && fracA > 0 && fracA < 1) {
            round(cx, barTop, 7, full, tone(dimC));
            round(cx, bottom - full * fracA, 8, full * fracA, tone(mix(mix(dimC, WEEK, lit), WEEK_HOT, heatW * 0.85)));
          } else if (hot > 0 && fracB > 0 && fracB < 1) {
            round(cx, barTop, lit > 0 ? 8 : 7, full, tone(lit > 0 ? WEEK : dimC));
            round(cx, bottom - full * fracB, lerp(8, 12.5, hot), full * fracB, tone(mix(WEEK, DAY, hot)));
          } else {
            const w = lerp(lerp(7, 8, lit), 12.5, hot);
            const warmed = mix(mix(dimC, WEEK, lit), WEEK_HOT, Math.max(heatW, B && B.mirror ? 0 : heatD) * 0.85);
            round(cx, barTop, w, full, tone(mix(warmed, DAY, hot)));
          }
          const intensity = (lit * (0.26 + heatW * 0.75) + hot * (0.32 + heatD * 0.5)) * (1 - fade);
          if (intensity > 0.01) {
            // 辉光画在另一张小画布上，要跟着这根竖条一起动
            const M = c.matrix;
            if (M) g.setTransform(M[0] * 0.25, M[1] * 0.25, M[2] * 0.25, M[3] * 0.25, M[4] * 0.25, M[5] * 0.25);
            else g.setTransform(0.25, 0, 0, 0.25, 0, 0);
            g.fillStyle = css(mix(WEEK, DAY, hot * 0.55), Math.min(1, intensity * c.opacity));
            g.fillRect(cx - 8, top - 16, 16, height + 16);
          }
          now = c.pop();
        }
      });

      now = c.el('glow', '辉光', {kind: 'fx', pick: false});
      c.save();
      c.globalCompositeOperation = 'lighter';
      if ('filter' in c) {
        c.filter = `blur(${11 * S}px)`;
        c.globalAlpha = 0.5;
        c.drawImage(glow, 0, 0, 1920, 1080);
        c.filter = `blur(${35 * S}px)`;
        c.globalAlpha = 0.38;
        c.drawImage(glow, 0, 0, 1920, 1080);
        c.filter = 'none';
      } else {
        const [near, far] = soft();
        c.imageSmoothingQuality = 'high';
        c.globalAlpha = 0.5;
        c.drawImage(near, 0, 0, 1920, 1080);
        c.globalAlpha = 0.38;
        c.drawImage(far, 0, 0, 1920, 1080);
      }
      c.restore();

      const sparks = (beat, gi, color) => {
        if (now < beat.run[0] || now > beat.run[1] + 0.8) return;
        const dir = beat.mirror ? -1 : 1;
        c.save();
        c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 100; i++) {
          const lt = D.colLit(beat, i);
          if (lt === Infinity) continue;
          const age = now - lt;
          const life = 0.28 + hash(i * 3.1) * 0.5;
          if (age < 0 || age > life || hash(i * 7.7) < 0.45) continue;
          const k = age / life;
          const x = X(i + 0.5) + dir * (90 + hash(i * 1.3) * 300) * age;
          const y = barsAt(gi, i, now)[0] - (180 + hash(i * 2.9) * 420) * age + 520 * age * age;
          const size = (1 - k) * (1.6 + hash(i * 5.1) * 2.6);
          c.fillStyle = css(mix(color, DAY, 0.4), (1 - k) * 0.95);
          c.fillRect(x - size / 2, y - size / 2, size, size);
        }
        c.restore();
      };
      groups.forEach((gr, gi) => {
        now = c.el(`sparks:${gi}`, `第 ${gi + 1} 组火花`, {kind: 'fx', pick: false});
        sparks(gr.metrics[0].beat, gi, WEEK_HOT);
        if (gr.metrics[1]) sparks(gr.metrics[1].beat, gi, DAY);
      });

      // 刻度尺
      now = c.el('ruler', '刻度尺', {group: true});
      const shown = groups.reduce((a, gr, gi) => (gi === 0 || now > splits[gi] ? gi : a), 0);
      const rb = groups[shown].metrics;
      const rulerIn = (i) => outCubic(progress(now, 0.05 + i * 0.006, 0.45 + i * 0.006));
      const shrink = groups.length >= 4 ? 0.5 : 1;
      for (let i = 0; i <= 100; i++) {
        now = c.push(`tick:${i}`, `刻度 ${i}`);
        const major = i % 10 === 0;
        const mid = i % 5 === 0;
        const len = major ? 22 : mid ? 14 : 8;
        const passed = rb.some((m) => now > m.beat.run[0] && (m.beat.mirror ? i >= D.posOf(m.beat, now) : i <= D.frontOf(m.beat, now)));
        let pop = 0;
        for (const b of tl.beats) {
          const tt = D.colLit(b, Math.min(i, 99));
          if (now >= tt) pop = Math.max(pop, wobble(now - tt, 4.5, 9) * Math.exp(-(now - tt) * 2));
        }
        c.fillStyle = css(passed ? TICK_ON : TICK_OFF);
        c.fillRect(X(i) - 0.75, 966, 1.5, (len + pop * 12) * rulerIn(i));
        for (let gi = 0; gi < shown; gi++) {
          const at = splits[gi + 1];
          const q = outCubic(progress(now, at + 0.3 + i * 0.004, at + 0.7 + i * 0.004));
          if (q <= 0) continue;
          const b = barsAt(gi, i, now);
          c.fillStyle = css(TICK_OFF);
          c.fillRect(X(i) - 0.75, b[1] + 8, 1.5, (major ? 12 : mid ? 8 : 5) * q * shrink);
        }
        now = c.pop();
      }

      // 标题与基数说明
      groups.forEach((gr, gi) => {
        now = c.main();
        if (gi > 0 && now <= splits[gi]) return;
        const R = rowAt(gi, now);
        c.globalAlpha = focus && focus.g !== gi ? 1 - 0.45 * focusE : 1;
        if (gr.title) {
          now = c.el(`title:${gi}`, gr.title, TEXT);
          D.reveal(c, gr.title, 60, R.titleY, R.titleSize, INK, now, gr.metrics[0].beat.titleAt);
        }
        gr.metrics.forEach((m, mi) => {
          if (!m.beat.note) return;
          const n = m.beat.note;
          const x = 60 + (gr.title ? textEm(gr.title) * R.titleSize + 28 : 0);
          const size = D.fitSize(n.text, 1860 - x, R.titleSize * 0.92, 24);
          now = c.el(`note:${gi}:${mi}`, n.text, TEXT);
          D.reveal(c, n.text, x, R.titleY + (R.titleSize - size) * 0.5, size, INK, now, n.at, 0.016);
          // 括号：整把尺子就是这群人
          now = c.el(`bracket:${gi}:${mi}`, '基数括号');
          const p = outExpo(progress(now, n.at + 0.1, n.at + 1.0));
          if (p > 0) {
            const y = R.top - 13;
            c.save();
            c.strokeStyle = css(inkRGB, 0.85);
            c.lineWidth = 2;
            c.lineJoin = 'round';
            c.beginPath();
            c.moveTo(X(0) + 1, y + 9);
            c.lineTo(X(0) + 1, y);
            c.lineTo(X(100 * p) - 1, y);
            if (p > 0.995) c.lineTo(X(100) - 1, y + 9);
            c.stroke();
            c.restore();
          }
        });
        c.globalAlpha = 1;
        if (gi > 0) {
          now = c.el(`divider:${gi}`, `第 ${gi + 1} 组分隔线`);
          c.fillStyle = css(inkRGB, 0.2);
          c.fillRect(60, R.titleY - (groups.length >= 3 ? 8 : 18), 1800 * outExpo(progress(now, splits[gi] + 0.1, splits[gi] + 1)), 1.5);
        }
      });

      // 读数：先算矩形，竖线碰到别的数就缩短
      now = c.main();
      const items = [];
      groups.forEach((gr, gi) => {
        if (gi > 0 && now <= splits[gi]) return;
        gr.metrics.forEach((m, mi) => {
          const b = m.beat;
          if (mi === 1 && now < Math.min(b.capAt, b.numAt) - 0.2) return;
          const pos = D.posOf(b, now);
          const pl = metricAt(gi, mi, now, pos);
          const R = rowAt(gi, now);
          const capH = pl.wrap.lines.length * pl.cap * 1.25;
          const capW = Math.max(0, ...pl.wrap.lines.map((l) => textEm(l) * pl.cap));
          const right = pl.align === 'right' ? pl.x + pl.nw : pl.x + Math.max(numEm(b.value) * pl.size, capW);
          const left = pl.align === 'right' ? pl.x + pl.nw - capW : pl.x;
          items.push({gi, mi, m, b, pos, pl, R, o: smooth(progress(now, b.numAt, b.numAt + 0.4)), rect: [Math.min(left, pl.x) - 4, pl.line + pl.capGap + capH, right], capTop: pl.line - pl.size * 0.7});
        });
      });
      items.forEach((it) => {
        const key = `${it.gi}:${it.mi}`;
        now = c.el(`hair:${key}`, `${it.b.value}% 的竖线`);
        const x = X(D.posOf(it.b, now));
        let top = it.capTop - 6;
        items.forEach((other) => {
          if (other === it || other.gi !== it.gi) return;
          if (x > other.rect[0] - 6 && x < other.rect[2] + 6 && other.o > 0) top = Math.max(top, other.rect[1] + 8);
        });
        if (x > it.rect[0] && x < it.rect[2]) top = Math.max(top, it.rect[1] + 8);
        const bottom = it.R.bottom + 18;
        const o = smooth(progress(now, it.b.numAt, it.b.numAt + 0.4));
        const fade = focus && focus !== it.b ? 1 - 0.45 * focusE : 1;
        if (o > 0) {
          c.fillStyle = INK;
          c.globalAlpha = o * 0.9 * fade;
          c.fillRect(x - 0.75, top, 1.5, (bottom - top) * o);
          c.globalAlpha = o * fade;
          c.beginPath();
          c.arc(x, top, 5 * springTo(o, 2, 6), 0, Math.PI * 2);
          c.fill();
          c.globalAlpha = 1;
          const age = now - it.b.land;
          if (age >= 0 && age <= 0.7) {
            const k = age / 0.7;
            c.strokeStyle = css(inkRGB, (1 - k) * 0.7);
            c.lineWidth = 1.6 * (1 - k) + 0.3;
            c.beginPath();
            c.arc(x, top, 5 + outCubic(k) * 30, 0, Math.PI * 2);
            c.stroke();
          }
        }
        c.globalAlpha = fade;
        now = c.el(`num:${key}`, `${it.b.value}%`, TEXT);
        const pl = now === c.T ? it.pl : metricAt(it.gi, it.mi, now, D.posOf(it.b, now));
        readout(c, {x: pl.x, baseline: pl.line, size: pl.size, value: D.frontOf(it.b, now), target: it.b.value, speed: D.speedOf(it.b, now), color: INK, alpha: smooth(progress(now, it.b.numAt, it.b.numAt + 0.4)), pulse: D.landPulse(now, it.b.land)});
        if (it.b.prefix) {
          now = c.el(`prefix:${key}`, it.b.prefix, TEXT);
          const ps = Math.max(30, pl.size * 0.17);
          const px = pl.align === 'right' ? pl.x + pl.nw : pl.x + 2;
          if (smooth(progress(now, it.b.numAt, it.b.numAt + 0.4)) > 0) D.reveal(c, it.b.prefix, px, it.capTop - ps * 1.32, ps, INK, now, it.b.numAt, 0.03, 0.5, pl.align === 'right' ? 'right' : 'left');
        }
        now = c.el(`cap:${key}`, it.m.caption, TEXT);
        const cx = pl.align === 'right' ? pl.x + pl.nw : pl.x + 4;
        pl.wrap.lines.forEach((line, li) => D.reveal(c, line, cx, pl.line + pl.capGap + li * pl.cap * 1.25, pl.cap, INK, now, it.b.capAt + (it.mi === 1 ? 0.05 : 0) + li * 0.1, 0.022, 0.5, pl.align === 'right' ? 'right' : 'left'));
        c.globalAlpha = 1;
      });

      now = c.el('grain', '颗粒', {kind: 'fx', pick: false});
      D.drawGrain(c, grain, S);

      now = c.el('rulerNum', '刻度数字', {group: true});
      c.font = `30px ${FONT_TICK}`;
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      c.fillStyle = TICK_NUM;
      for (let v = 0; v <= 100; v += 10) {
        now = c.push(`rn:${v}`, `刻度数字 ${v}`, TEXT);
        const p = outCubic(progress(now, 0.2 + v * 0.006, 0.7 + v * 0.006));
        c.globalAlpha = p;
        c.fillText(String(v), X(v), 1024 + (1 - p) * 10);
        now = c.pop();
      }
      c.globalAlpha = 1;
    };

    const probes = () =>
      groups.map((gr, gi) => {
        const L = rowLayout(groups.length, gi);
        const y = L.bottom - (L.bottom - L.top) * 0.35;
        const A = gr.metrics[0].value;
        const B = gr.metrics[1] ? gr.metrics[1].value : 0;
        const opp = gr.relation === 'opposing';
        return {
          title: gr.title || gr.metrics[0].caption,
          points: Array.from({length: 100}, (_, i) => [X(i + 0.5), y]),
          expect: Array.from({length: 100}, (_, i) => {
            if (opp) {
              if (i + 1 <= A) return 'primary';
              if (i < A) return null;
              if (100 - i <= B) return 'secondary';
              if (99 - i < B) return null;
              return 'dim';
            }
            if (i + 1 <= B) return 'secondary';
            if (i < B) return null;
            if (i + 1 <= A) return 'primary';
            if (i < A) return null;
            return 'dim';
          }),
        };
      });

    return {draw, probes, palette: {primary: WEEK, secondary: DAY, dim: DIM, bg: BGC}};
  };

  root.DM.register('comb', {
    name: '一百根',
    family: 'A',
    desc: '一根竖条是 1%。包含关系同一批竖条再烧白；相反的两拨从两头往中间走；基数不同拉括号。',
    source: 'metalforge Progress 前沿 + motion-showreel data-motion',
    colors: DEFAULT,
    maxGroups: 4,
    create,
  });
})(window);
