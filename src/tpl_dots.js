// B「一百人」：一个点 = 1%。
// 包含关系：涂黑的点里再涂红。相反的两拨：同一批人走出来分成两堆，剩下的人归拢到中间。基数不同：把这 100 个点框起来。
(function (root) {
  'use strict';
  const {clamp, lerp, progress, smooth, outExpo, outCubic, wobble, springTo, hash, hex, mix, css, numEm, textEm} = root.DM;
  const D = root.DM;
  const TEXT = D.TEXT;
  const DEFAULT = {bg: '#F1EFE8', primary: '#141416', secondary: '#EE3A17'};

  const create = (spec, tl, S) => {
    const groups = spec.groups;
    const INK = spec.colors.primary;
    const cInk = hex(INK);
    const RED = spec.colors.secondary;
    const cRed = hex(RED);
    const cBg = hex(spec.colors.bg);
    const cGray = spec.colors.bg === DEFAULT.bg && spec.colors.primary === DEFAULT.primary ? [207, 204, 194] : mix(cBg, cInk, 0.17);
    const MUTE = css(mix(cBg, cInk, 0.68));
    const maxEm = Math.max(...groups.flatMap((g) => g.metrics.map((m) => numEm(m.value))));
    const anyDecimal = maxEm > 1.7;
    const splits = groups.map((g) => g.metrics[0].beat.splitAt);

    const colLayout = (k, i) => {
      if (k === 1) {
        return {x0: 72, y0: 150, pitch: 78, colW: 1780, numX: 930, titleX: 930, titleY: 150, titleSize: 78, ruleX: 930, ruleY: 128, ruleW: 930, num: Math.min(470, 900 / maxEm), numInner: Math.min(420, 900 / maxEm), cap: 56, gridH: 780};
      }
      if (k === 2) {
        const pitch = anyDecimal ? 52 : 58;
        const colX = [60, 1000][i];
        const grid = pitch * 10;
        const s = Math.min(170, (860 - grid - 36) / maxEm);
        const line1 = 300 + s * 0.7 + 5;
        return {x0: colX, y0: 300, pitch, colW: 860, numX: colX + grid + 36, titleX: colX, titleY: 204, titleSize: 51.5, ruleX: colX, ruleY: 186, ruleW: 860, num: s, cap: 34, line1, line2: line1 + s * 0.7 + 111, capGap: 12, gridH: 580};
      }
      const pitch = anyDecimal ? 32 : 36;
      const colX = [60, 676, 1292][i];
      const grid = pitch * 10;
      const s = Math.min(124, (566 - grid - 24) / maxEm);
      const line1 = 370 + s * 0.7 + 4;
      return {x0: colX, y0: 370, pitch, colW: 566, numX: colX + grid + 24, titleX: colX, titleY: 290, titleSize: 42, ruleX: colX, ruleY: 272, ruleW: 566, num: s, cap: 28, line1, line2: line1 + s * 0.7 + 88, capGap: 10, gridH: 360};
    };

    const slot = (L, i) => [L.x0 + ((i % 10) + 0.5) * L.pitch, L.y0 + (Math.floor(i / 10) + 0.5) * L.pitch];
    const scatter = (i, cx, cy, r) => {
      const rr = r * Math.sqrt((i + 0.5) / 100);
      const a = i * 2.39996 + hash(i) * 0.4;
      return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
    };

    // 相反的两拨：每个点属于哪一堆、排第几
    const oppInfo = groups.map((gr) => {
      if (gr.relation !== 'opposing') return null;
      const order = Array.from({length: 100}, (_, i) => i).sort((a, b) => hash(a * 13.7) - hash(b * 13.7));
      const nA = Math.ceil(gr.metrics[0].value);
      const nB = Math.ceil(gr.metrics[1].value);
      const belong = new Array(100);
      order.forEach((dot, r) => {
        if (r < nA) belong[dot] = {side: 0, idx: r};
        else if (r < nA + nB) belong[dot] = {side: 1, idx: r - nA};
        else belong[dot] = {side: 2, idx: r - nA - nB};
      });
      return {belong, nA, nB, nRest: 100 - nA - nB};
    });

    // 三堆的位置：底边对齐，高度就是人数
    const blocksOf = (k, gi) => {
      const L = colLayout(k, gi);
      const info = oppInfo[gi];
      const cols = 5;
      const rowsMax = Math.ceil(Math.max(info.nA, info.nB, info.nRest) / cols);
      const headroom = k === 1 ? 300 : 210;
      const H = (k === 1 ? 930 : L.y0 + L.gridH) - (k === 1 ? 150 + headroom : L.y0 - 10 + headroom * 0.5);
      const p = Math.min((L.colW - 40) / (cols * 3 + 3.2), H / rowsMax);
      const W = p * (cols * 3 + 3.2);
      const x0 = k === 1 ? (1920 - W) / 2 : L.x0;
      const bottom = k === 1 ? 900 : L.y0 + L.gridH;
      const blockX = [x0, x0 + W - cols * p, x0 + cols * p + 1.6 * p];
      return {L, p, blockX, bottom, cols};
    };
    const blockSlot = (geo, side, idx) => [geo.blockX[side] + ((idx % geo.cols) + 0.5) * geo.p, geo.bottom - (Math.floor(idx / geo.cols) + 0.5) * geo.p];

    const crowdAt = (gi) => (gi === 0 ? 0.12 : groups[gi].metrics[0].beat.titleAt + 0.25);

    // 一个点在 t 时刻的位置
    const dotPos = (gi, i, t) => {
      const L0 = colLayout(gi + 1, gi);
      const info = oppInfo[gi];
      const gridL = info ? Object.assign({}, L0, {x0: L0.x0 + (L0.colW - L0.pitch * 10) / 2}) : L0;
      let p = slot(gridL, i);
      const at = crowdAt(gi);
      if (t < at + 3) {
        const grid = gridL.pitch * 10;
        const cx = gridL.x0 + grid / 2;
        const cy = gridL.y0 + grid / 2;
        const r = gi === 0 ? 410 : grid * 0.49;
        const burst = outExpo(progress(t, at + hash(i * 3) * 0.1, at + 0.9 + hash(i * 3) * 0.1));
        const home = at + 0.9 + hash(i * 5) * 0.55;
        const settle = springTo(t - home, 1.5, 6.2);
        const s = scatter(i, cx, cy, r);
        const drift = Math.sin(t * 1.3 + i) * 5 * (1 - clamp(settle));
        const x = lerp(cx, s[0], burst) + drift;
        const y = lerp(cy, s[1], burst) + drift * 0.7;
        p = [lerp(x, p[0], settle), lerp(y, p[1], settle)];
      }
      if (info) {
        const who = info.belong[i];
        const A = groups[gi].metrics[0].beat;
        const B = groups[gi].metrics[1].beat;
        const go = who.side === 0 ? A.lit[who.idx] : who.side === 1 ? B.lit[who.idx] : B.land + 0.1 + hash(i * 7) * 0.35;
        // 迁徙：弹簧落位（取自 shotcraft 点群重组的 stiffness150/damping13 手感）
        const e = springTo(t - go, 1.9, 6.5);
        if (e > 0) {
          const q = blockSlot(blocksOf(gi + 1, gi), who.side, who.idx);
          p = [lerp(p[0], q[0], e), lerp(p[1], q[1], e)];
        }
        for (let k = gi + 1; k < groups.length; k++) {
          const ee = smooth(progress(t, splits[k] + hash(i * 9) * 0.22, splits[k] + 0.62 + hash(i * 9) * 0.22));
          if (ee <= 0) break;
          const q = blockSlot(blocksOf(k + 1, gi), who.side, who.idx);
          p = [lerp(p[0], q[0], ee), lerp(p[1], q[1], ee)];
        }
        return p;
      }
      for (let k = gi + 1; k < groups.length; k++) {
        const e = smooth(progress(t, splits[k] + hash(i * 9) * 0.22, splits[k] + 0.62 + hash(i * 9) * 0.22));
        if (e <= 0) break;
        const q = slot(colLayout(k + 1, gi), i);
        p = [lerp(p[0], q[0], e), lerp(p[1], q[1], e)];
      }
      return p;
    };

    const pitchAt = (gi, t) => {
      const info = oppInfo[gi];
      if (info) {
        const b = groups[gi].metrics[0].beat;
        let v = lerp(colLayout(gi + 1, gi).pitch, blocksOf(gi + 1, gi).p, smooth(progress(t, b.run[0], b.run[0] + 0.5)));
        for (let k = gi + 1; k < groups.length; k++) {
          const e = outCubic(progress(t, splits[k], splits[k] + 0.8));
          if (e <= 0) break;
          v = lerp(v, blocksOf(k + 1, gi).p, e);
        }
        return v;
      }
      let v = colLayout(gi + 1, gi).pitch;
      for (let k = gi + 1; k < groups.length; k++) {
        const e = outCubic(progress(t, splits[k], splits[k] + 0.8));
        if (e <= 0) break;
        v = lerp(v, colLayout(k + 1, gi).pitch, e);
      }
      return v;
    };

    // 读数位置
    const oppNum = (k, gi, mi) => {
      const geo = blocksOf(k, gi);
      const info = oppInfo[gi];
      const count = mi === 0 ? info.nA : info.nB;
      const rows = Math.ceil(count / geo.cols);
      const blockTop = geo.bottom - rows * geo.p;
      const size = k === 1 ? 170 : k === 2 ? 104 : 76;
      const blockW = geo.cols * geo.p;
      const x = geo.blockX[mi === 0 ? 0 : 1];
      return {x, size, line: blockTop - 14, cap: k === 1 ? 36 : k === 2 ? 28 : 24, capGap: 0, below: geo.bottom + 12, blockW};
    };
    const numPlace = (gi, mi, t) => {
      const g = groups[gi];
      let cur;
      if (oppInfo[gi]) cur = oppNum(gi + 1, gi, mi);
      else if (gi === 0) {
        const H = colLayout(1, 0);
        if (mi === 0) {
          const inner = g.metrics[1] ? g.metrics[1].beat : null;
          const d = inner ? outCubic(progress(t, inner.capAt + 0.4, inner.capAt + 1.05)) : 0;
          cur = {x: H.numX, size: lerp(H.num, 190, d), line: lerp(700, 436, d), cap: lerp(56, 38, d), capGap: lerp(22, 12, d)};
        } else cur = {x: H.numX, size: H.numInner, line: 860, cap: 48, capGap: 16};
      } else {
        const L = colLayout(gi + 1, gi);
        cur = {x: L.numX, size: L.num, line: mi === 0 ? L.line1 : L.line2, cap: L.cap, capGap: L.capGap};
      }
      for (let k = Math.max(1, gi + 1); k < groups.length; k++) {
        const e = outCubic(progress(t, splits[k] + 0.26, splits[k] + 1.0));
        if (e <= 0) break;
        let q;
        if (oppInfo[gi]) q = oppNum(k + 1, gi, mi);
        else {
          const L = colLayout(k + 1, gi);
          q = {x: L.numX, size: L.num, line: mi === 0 ? L.line1 : L.line2, cap: L.cap, capGap: L.capGap};
        }
        cur = Object.assign({}, q, {x: lerp(cur.x, q.x, e), size: lerp(cur.size, q.size, e), line: lerp(cur.line, q.line, e), cap: lerp(cur.cap, q.cap, e), capGap: lerp(cur.capGap, q.capGap, e), below: q.below != null && cur.below != null ? lerp(cur.below, q.below, e) : q.below, blockW: q.blockW});
      }
      return cur;
    };

    const readout = D.makeReadout(S);

    const draw = (c, now) => {
      c.bg();
      c.setTransform(S, 0, 0, S, 0, 0);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
      c.fillStyle = spec.colors.bg;
      c.fillRect(0, 0, 1920, 1080);
      now = c.main();
      c.lineCap = 'round';
      const {beat: focus, e: focusE} = D.focusOf(tl.beats, now);

      const dot = (x, y, px, py, r, color) => {
        const dx = x - px;
        const dy = y - py;
        const len = Math.hypot(dx, dy);
        if (len < 0.6) {
          c.fillStyle = color;
          c.beginPath();
          c.arc(x, y, r, 0, Math.PI * 2);
          c.fill();
          return;
        }
        const k = Math.min(1, (r * 1.6) / len);
        c.strokeStyle = color;
        c.lineWidth = r * 2 * Math.max(0.62, 1 - len / 140);
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x - dx * k, y - dy * k);
        c.stroke();
      };
      const partial = (x, y, r, frac, color) => {
        c.save();
        c.beginPath();
        c.rect(x - r, y - r, 2 * r * frac, 2 * r);
        c.clip();
        c.fillStyle = color;
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.fill();
        c.restore();
      };
      const ring = (x, y, age, r, col) => {
        if (age < 0 || age > 0.42) return;
        const k = age / 0.42;
        c.strokeStyle = css(col, (1 - k) * 0.45);
        c.lineWidth = 2.2 * (1 - k) + 0.3;
        c.beginPath();
        c.arc(x, y, r + outCubic(k) * r * 1.3, 0, Math.PI * 2);
        c.stroke();
      };
      const toneFor = (col, inFocus) => (focus && !inFocus ? mix(col, cBg, 0.55 * focusE) : col);

      groups.forEach((gr, gi) => {
        now = c.el(`dots:${gi}`, `第 ${gi + 1} 组圆点`, {group: true});
        if (now < crowdAt(gi)) return;
        const A = gr.metrics[0].beat;
        const B = gr.metrics[1] ? gr.metrics[1].beat : null;
        const pitch = pitchAt(gi, now);
        const info = oppInfo[gi];
        for (let i = 0; i < 100; i++) {
          now = c.push(`dot:${gi}:${i}`, `第 ${gi + 1} 组第 ${i + 1} 个点`);
          const [x, y] = dotPos(gi, i, now);
          const [px, py] = dotPos(gi, i, now - 1 / 60);
          let tw = Infinity;
          let td = Infinity;
          let fo = 1;
          let fi = 1;
          if (info) {
            const who = info.belong[i];
            if (who.side === 0) {
              tw = A.lit[who.idx];
              fo = clamp(A.value - who.idx);
            } else if (who.side === 1) {
              td = B.lit[who.idx];
              fi = clamp(B.value - who.idx);
            }
          } else {
            tw = A.lit[i];
            fo = clamp(A.value - i);
            if (B) {
              td = B.lit[i];
              fi = clamp(B.value - i);
            }
          }
          const lit = clamp((now - tw) * 18);
          const hot = clamp((now - td) * 18);
          const popW = now >= tw ? wobble(now - tw, 3.6, 7.5) : 0;
          const popD = now >= td ? wobble(now - td, 3.6, 7.5) : 0;
          const base = lerp(0.235, 0.325, lit);
          const r = pitch * (lerp(base, info ? 0.34 : 0.385, hot) + popW * 0.11 * lit + popD * 0.1 * hot);
          const inFocus = focus && ((focus === A && lit > 0) || (focus === B && hot > 0));
          ring(x, y, now - tw, pitch * 0.325, cInk);
          ring(x, y, now - td, pitch * 0.385, cRed);
          if (lit > 0 && fo > 0 && fo < 1) {
            dot(x, y, px, py, r, css(toneFor(cGray, inFocus)));
            partial(x, y, r, fo, css(toneFor(cInk, inFocus)));
          } else if (hot > 0 && fi > 0 && fi < 1) {
            dot(x, y, px, py, r, css(toneFor(info ? cGray : cInk, inFocus)));
            partial(x, y, r, fi, css(toneFor(cRed, inFocus)));
          } else {
            dot(x, y, px, py, r, css(toneFor(mix(mix(cGray, cInk, lit), cRed, hot), inFocus)));
          }
          now = c.pop();
        }
      });

      // 粗线与标题：换版面时在原位收走，到新位置重新出现
      groups.forEach((gr, gi) => {
        const b0 = gr.metrics[0].beat;
        const noteBeat = gr.metrics.map((m) => m.beat).find((b) => b.note);
        for (let k = gi + 1; k <= groups.length; k++) {
          now = c.el(`rule:${gi}`, `第 ${gi + 1} 组粗线`);
          const L = colLayout(k, gi);
          const isFirst = k === gi + 1;
          const inAt = isFirst ? (gi === 0 ? 0.3 : b0.titleAt) : splits[k - 1] + 0.32;
          const titleIn = isFirst ? b0.titleAt : splits[k - 1] + 0.42;
          const outAt = k < groups.length ? splits[k] : Infinity;
          if (now < inAt && now < titleIn) continue;
          if (now > outAt + 0.55) continue;
          const pIn = outExpo(progress(now, inAt, inAt + 0.9));
          const pOut = outAt === Infinity ? 0 : outExpo(progress(now, outAt, outAt + 0.5));
          c.globalAlpha = focus && focus.g !== gi ? 1 - 0.45 * focusE : 1;
          c.fillStyle = INK;
          c.fillRect(L.ruleX + L.ruleW * pOut, L.ruleY, L.ruleW * pIn * (1 - pOut), 6);
          const line = gr.title;
          if (line) {
            now = c.el(`title:${gi}`, line, TEXT);
            const size = D.fitSize(line, L.ruleW, L.titleSize, 26);
            if (now < outAt) D.reveal(c, line, L.titleX, L.titleY, size, INK, now, titleIn);
            else D.leave(c, line, L.titleX, L.titleY, size, INK, outCubic(progress(now, outAt, outAt + 0.28)));
          }
          if (noteBeat && noteBeat.note) {
            const n = noteBeat.note;
            now = c.el(`note:${gi}`, n.text, TEXT);
            const wrap = D.wrapText(n.text, L.ruleW, line ? L.titleSize * 0.6 : L.titleSize * 0.8, 24, 2);
            const top = line ? L.titleY + L.titleSize * 1.25 : L.titleY;
            if (now < outAt) D.revealLines(c, wrap, L.titleX, top, INK, now, isFirst ? n.at : splits[k - 1] + 0.42);
            else wrap.lines.forEach((l, li) => D.leave(c, l, L.titleX, top + li * wrap.size * 1.25, wrap.size, INK, outCubic(progress(now, outAt, outAt + 0.28))));
          }
          c.globalAlpha = 1;
        }
      });

      // 基数说明：把这 100 个点框起来
      groups.forEach((gr, gi) => {
        now = c.el(`frame:${gi}`, `第 ${gi + 1} 组基数框`);
        const nb = gr.metrics.map((m) => m.beat).find((b) => b.note);
        if (!nb || now < nb.note.at) return;
        const pitch = pitchAt(gi, now);
        const tl0 = dotPos(gi, 0, now);
        const m = 0.62 * pitch;
        const x = tl0[0] - m;
        const y = tl0[1] - m;
        const w = pitch * 9 + 2 * m;
        const peri = 2 * (w + w);
        const p = outExpo(progress(now, nb.note.at + 0.1, nb.note.at + 1.1));
        c.save();
        c.strokeStyle = INK;
        c.lineWidth = 2.5;
        c.setLineDash([peri * p, peri]);
        c.beginPath();
        c.roundRect(x, y, w, w, 10);
        c.stroke();
        c.restore();
      });

      groups.forEach((gr, gi) => {
        now = c.main();
        if (gi > 0 && now <= splits[gi]) return;
        gr.metrics.forEach((m, mi) => {
          const b = m.beat;
          now = c.main();
          if (mi === 1 && now < Math.min(b.capAt, b.numAt)) return;
          const P = numPlace(gi, mi, now);
          const opp = !!oppInfo[gi];
          const fade = focus && focus !== b ? 1 - 0.45 * focusE : 1;
          c.globalAlpha = fade;
          const color = mi === 1 ? RED : INK;
          const at = gi > 0 ? Math.max(b.numAt, splits[gi] + 0.85) : b.numAt;
          now = c.el(`num:${gi}:${mi}`, `${b.value}%`, TEXT);
          readout(c, {x: P.x, baseline: P.line, size: P.size, value: D.frontOf(b, now), target: b.value, speed: D.speedOf(b, now), color, alpha: smooth(progress(now, at, at + 0.3)), pulse: D.landPulse(now, b.land)});
          if (b.prefix) {
            now = c.el(`prefix:${gi}:${mi}`, b.prefix, TEXT);
            const ps = Math.max(30, P.size * 0.17);
            D.reveal(c, b.prefix, P.x + 2, P.line - P.size * 0.7 - ps * 1.32, ps, color, now, at, 0.03);
          }
          const single = gr.metrics.length === 1;
          const maxW = opp ? Math.max(P.blockW * 1.5, 300) : groups.length === 1 ? 900 : Math.max(colLayout(groups.length, gi).ruleW * 0.3, 240);
          const wrap = D.wrapText(m.caption, maxW, P.cap, opp ? 22 : 26, single && !opp ? 7 : 3);
          const capTop = opp ? P.below : P.line + P.capGap;
          now = c.el(`cap:${gi}:${mi}`, m.caption, TEXT);
          D.revealLines(c, wrap, opp ? P.x : P.x + 4, capTop, INK, now, (gi > 0 ? Math.max(b.capAt, splits[gi] + 0.85) : b.capAt) + (mi === 1 ? 0.1 : 0));
          c.globalAlpha = 1;
        });
      });

      // 图例
      now = c.el('legend', '一个点代表1%', TEXT);
      const a = smooth(progress(now, tl.beats[0].land + 0.3, tl.beats[0].land + 0.8));
      if (a > 0 && !oppInfo[0]) {
        const L1 = colLayout(1, 0);
        let lx = L1.x0;
        let ly = L1.y0 + L1.pitch * 10 + 14;
        for (let k = 1; k < groups.length; k++) {
          const e = outCubic(progress(now, splits[k], splits[k] + 0.8));
          if (e <= 0) break;
          const L = colLayout(k + 1, 0);
          lx = lerp(lx, L.x0, e);
          ly = lerp(ly, L.y0 + L.pitch * 10 + 18, e);
        }
        c.globalAlpha = a;
        c.fillStyle = MUTE;
        c.font = `34px ${D.FONT_CN}`;
        c.textAlign = 'left';
        c.textBaseline = 'alphabetic';
        c.fillText('一个点代表1%', lx, ly + 34);
        c.globalAlpha = 1;
      }
    };

    const probes = () =>
      groups.map((gr, gi) => {
        const k = groups.length;
        const opp = oppInfo[gi];
        if (opp) {
          const geo = blocksOf(k, gi);
          const A = gr.metrics[0].value;
          const B = gr.metrics[1].value;
          const points = [];
          const expect = [];
          for (let i = 0; i < opp.nA; i++) {
            points.push(blockSlot(geo, 0, i));
            expect.push(i + 1 <= A ? 'primary' : null);
          }
          for (let i = 0; i < opp.nB; i++) {
            points.push(blockSlot(geo, 1, i));
            expect.push(i + 1 <= B ? 'secondary' : null);
          }
          for (let i = 0; i < opp.nRest; i++) {
            points.push(blockSlot(geo, 2, i));
            expect.push('dim');
          }
          return {title: gr.title || gr.metrics[0].caption, points, expect};
        }
        const L = colLayout(k, gi);
        const o = gr.metrics[0].value;
        const n = gr.metrics[1] ? gr.metrics[1].value : 0;
        return {
          title: gr.title || gr.metrics[0].caption,
          points: Array.from({length: 100}, (_, i) => slot(L, i)),
          expect: Array.from({length: 100}, (_, i) => {
            if (i + 1 <= n) return 'secondary';
            if (i < n) return null;
            if (i + 1 <= o) return 'primary';
            if (i < o) return null;
            return 'dim';
          }),
        };
      });

    return {draw, probes, palette: {primary: cInk, secondary: cRed, dim: cGray, bg: cBg}};
  };

  root.DM.register('dots', {
    name: '一百人',
    family: 'B',
    desc: '一个点是 1%。包含关系涂黑的点里再涂红；相反的两拨从人群里走出来分成两堆；基数不同把点框起来。',
    source: 'shotcraft unit-dot-swarm-regroup + motion-showreel 单位图',
    colors: DEFAULT,
    maxGroups: 3,
    create,
  });
})(window);
