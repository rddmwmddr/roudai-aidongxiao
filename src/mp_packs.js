// 生成文件，不要手改。由 tools/import_motion_prompt.py 从 vendor/motion-prompt 生成。改动：画面文字译成中文、字体换成工具字体、图形动效换成黑底。
/* Motion Prompt, https://github.com/showheyohtaki/motion-prompt
MIT License

Copyright (c) 2026 Shohei Ohtaki

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
(function (g) {
  const factories = {};
  const made = {};
  const MotionPrompt = {pack(id, factory) { factories[id] = factory; }};
MotionPrompt.pack('motion', function () {
  const CW = 539, CH = 208;
  const CYC = 4.7;
  const C = {
    navy: '#0A0A0B', navy2: '#1E1E20', navy3: '#38383B', dim: '#8E8B85',
    blue: '#3B7BFF', coral: '#FF6B5C', yel: '#FFC83D', mint: '#2EDBA8', white: '#FFFFFF', cream: '#FFF1D6'
  };
  const PAL = [C.blue, C.coral, C.yel, C.mint];
  const JP = 'DMGothic,DMGothicFull,"PingFang SC",sans-serif';
  const DISP = '"Avenir Next", "Helvetica Neue", system-ui, sans-serif';
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, x) => a + (b - a) * x;
  const P = (t, a, b) => clamp((t - a) / (b - a));
  const eIO = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const eIOs = x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  const eOut = x => 1 - Math.pow(1 - x, 3);
  const eOut5 = x => 1 - Math.pow(1 - x, 5);
  const eIn = x => x * x * x;
  const smooth = x => x * x * (3 - 2 * x);
  const mod = (a, n) => ((a % n) + n) % n;
  const backOut = (x, s = 1.70158) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
  const backIn = (x, s = 1.70158) => (s + 1) * x * x * x - s * x * x;
  const spring = (t, w = 14, d = 7) => t <= 0 ? 0 : 1 - Math.exp(-d * t) * Math.cos(w * t);
  function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function txt(ctx, s, x, y, font, col, align = 'left', base = 'alphabetic', ls = '0px') {
    ctx.font = font; ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = base; ctx.letterSpacing = ls; ctx.fillText(s, x, y); ctx.letterSpacing = '0px';
  }
  function rand(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function mix(a, b, t) { const A = hex(a), B = hex(b); return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`; }
  function bez(x1, y1, x2, y2) {
    const cx_ = 3 * x1, bx = 3 * (x2 - x1) - cx_, ax = 1 - cx_ - bx;
    const cy_ = 3 * y1, by = 3 * (y2 - y1) - cy_, ay = 1 - cy_ - by;
    const sx = t => ((ax * t + bx) * t + cx_) * t, sy = t => ((ay * t + by) * t + cy_) * t;
    return x => { if (x <= 0) return 0; if (x >= 1) return 1; let lo = 0, hi = 1, t = x; for (let i = 0; i < 40; i++) { if (sx(t) < x) lo = t; else hi = t; t = (lo + hi) / 2; } return sy(t); };
  }
  function star(k, x, y, R, rot = 0, inner = 0.5, n = 5) { k.beginPath(); for (let i = 0; i < n * 2; i++) { const r = i % 2 ? R * inner : R, a = rot - Math.PI / 2 + i * Math.PI / n; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; i ? k.lineTo(px, py) : k.moveTo(px, py); } k.closePath(); }
  function heartPath(k, s) { k.beginPath(); k.moveTo(0, s * 0.92); k.bezierCurveTo(-s * 1.75, -s * 0.12, -s * 0.85, -s * 1.2, 0, -s * 0.42); k.bezierCurveTo(s * 0.85, -s * 1.2, s * 1.75, -s * 0.12, 0, s * 0.92); k.closePath(); }
  const G0 = mkCanvas(CW, CH), GK0 = G0.getContext('2d', { willReadFrequently: true });
  const G1 = mkCanvas(CW, CH), GK1 = G1.getContext('2d', { willReadFrequently: true });
  function stage(k, col = C.navy) { k.fillStyle = col; k.fillRect(0, 0, CW, CH); }
  function goo(draw, blur, paint) {
    GK0.setTransform(1, 0, 0, 1, 0, 0); GK0.clearRect(0, 0, CW, CH); GK0.fillStyle = '#fff'; draw(GK0);
    GK1.setTransform(1, 0, 0, 1, 0, 0); GK1.globalCompositeOperation = 'source-over'; GK1.clearRect(0, 0, CW, CH);
    GK1.filter = `blur(${blur}px)`; GK1.drawImage(G0, 0, 0); GK1.filter = 'none';
    const im = GK1.getImageData(0, 0, CW, CH), d = im.data;
    for (let i = 3; i < d.length; i += 4) { const a = d[i]; d[i] = a < 112 ? 0 : a > 144 ? 255 : (a - 112) * 8; }
    GK1.putImageData(im, 0, 0);
    GK1.globalCompositeOperation = 'source-atop'; paint(GK1); GK1.globalCompositeOperation = 'source-over';
    return G1;
  }
  function chars(k, s, font, ls = 0) { k.font = font; const ws = [...s].map(ch => k.measureText(ch).width + ls); const tot = ws.reduce((a, b) => a + b, 0) - ls; let x = -tot / 2; return [...s].map((ch, i) => { const o = { ch, x: x + (ws[i] - ls) / 2, w: ws[i] - ls }; x += ws[i]; return o; }); }
  const CELLS = [];

  CELLS[0] = (k, w, h, u) => {
    stage(k);
    const T = CYC / 2, n = Math.floor(u / T), lu = u - n * T, X = w / 2, Y = h / 2 + 4, S = 116;
    const col = n % 2 ? C.blue : C.coral;
    const out = backIn(P(lu, 1.86, 2.12), 2.2);
    const sc = spring(lu - 0.28, 15, 6.5) * (1 - out);
    const rot = (1 - spring(lu - 0.28, 11, 6)) * -0.35;
    k.fillStyle = 'rgba(0,0,0,.28)'; k.beginPath(); k.ellipse(X, Y + 78, 62 * clamp(sc), 8 * clamp(sc), 0, 0, 7); k.fill();
    if (sc > 0.002) {
      k.save(); k.translate(X, Y); k.rotate(rot); k.scale(sc, sc);
      k.fillStyle = col; rr(k, -S / 2, -S / 2, S, S, 30); k.fill();
      k.fillStyle = 'rgba(255,255,255,.16)'; rr(k, -S / 2, -S / 2, S, S / 2, [30, 30, 0, 0]); k.fill();
      k.fillStyle = '#fff';
      if (n % 2) { k.save(); k.translate(0, 2); heartPath(k, 30); k.fill(); k.restore(); }
      else { star(k, 0, 2, 36, 0, 0.48); k.lineJoin = 'round'; k.strokeStyle = '#fff'; k.lineWidth = 6; k.stroke(); k.fill(); }
      k.restore();
      const bs = spring(lu - 0.62, 17, 7) * (1 - out);
      if (bs > 0.002) { k.save(); k.translate(X + 52 * sc, Y - 52 * sc); k.scale(bs, bs); k.fillStyle = C.yel; k.beginPath(); k.arc(0, 0, 25, 0, 7); k.fill(); k.strokeStyle = C.navy; k.lineWidth = 5; k.stroke(); txt(k, '1', 0, 2, `800 30px ${DISP}`, C.navy, 'center', 'middle'); k.restore(); }
    }
  };

  CELLS[1] = (k, w, h, u) => {
    stage(k);
    const N = 7, BW = 44, G = 20, x0 = (w - (N * BW + (N - 1) * G)) / 2, base = h - 30;
    const HS = [52, 84, 68, 112, 92, 136, 158];
    k.fillStyle = C.navy3; rr(k, x0 - 18, base, N * BW + (N - 1) * G + 36, 5, 2.5); k.fill();
    const lu = mod(u, CYC / 2);
    for (let i = 0; i < N; i++) {
      const t0 = 0.15 + i * 0.12, g = backOut(P(lu, t0, t0 + 0.5), 2.6) * (1 - eIn(P(lu, 1.78 + i * 0.045, 2.04 + i * 0.045)));
      if (g <= 0.001) continue;
      const hh = HS[i] * g, x = x0 + i * (BW + G);
      k.fillStyle = PAL[i % 4]; rr(k, x, base - hh, BW, hh, [12, 12, 3, 3]); k.fill();
      const d = spring(lu - t0 - 0.34, 16, 7) * (1 - eIn(P(lu, 1.7 + i * 0.045, 1.9 + i * 0.045)));
      if (d > 0.01) { k.fillStyle = '#fff'; k.beginPath(); k.arc(x + BW / 2, base - hh - 16, 6.5 * d, 0, 7); k.fill(); }
    }
  };

  CELLS[2] = (k, w, h, u) => {
    stage(k);
    const T = CYC / 2, lu = mod(u, T), X = w / 2, Y = h / 2 + 2, t0 = 0.5, tt = lu - t0;
    const ant = eIOs(P(lu, 0.3, t0)), off = P(lu, 1.92, 2.2);
    const sc = tt < 0 ? 1 - 0.3 * ant : 0.7 + 0.3 * spring(tt, 16, 6.5) + 0.0;
    if (tt > 0 && tt < 0.75) {
      const q = eOut5(tt / 0.6 > 1 ? 1 : tt / 0.6), fade = 1 - P(tt, 0.3, 0.72);
      k.strokeStyle = C.yel; k.lineWidth = Math.max(0.1, 16 * (1 - q)); k.beginPath(); k.arc(X, Y, 44 + 46 * q, 0, 7); if (q < 0.98) k.stroke();
      k.lineCap = 'round';
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * Math.PI * 2 - Math.PI / 2, r1 = 64 + 66 * q, len = 36 * (1 - P(tt, 0.22, 0.7));
        if (len > 0.5) { k.strokeStyle = i % 2 ? C.mint : C.yel; k.lineWidth = 9; k.beginPath(); k.moveTo(X + Math.cos(a) * (r1 - len), Y + Math.sin(a) * (r1 - len) * 0.82); k.lineTo(X + Math.cos(a) * r1, Y + Math.sin(a) * r1 * 0.82); k.stroke(); }
        const a2 = a + Math.PI / 10, r2 = 58 + 92 * q;
        k.fillStyle = i % 2 ? C.coral : C.blue; k.globalAlpha = fade; k.beginPath(); k.arc(X + Math.cos(a2) * r2 * 1.45, Y + Math.sin(a2) * r2 * 0.78, 8 * (1 - q * 0.4), 0, 7); k.fill(); k.globalAlpha = 1;
      }
    }
    k.save(); k.translate(X, Y - 2); k.scale(sc, sc);
    heartPath(k, 46); k.lineJoin = 'round'; k.lineWidth = 7; k.strokeStyle = C.navy3; k.stroke();
    const fa = tt < 0 ? 0 : 1 - off;
    if (fa > 0) { k.globalAlpha = fa; k.fillStyle = C.coral; k.strokeStyle = C.coral; k.fill(); k.stroke(); k.globalAlpha = 1; }
    k.restore();
  };

  function smoothPath(pts, n = 16) { const out = []; for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]; for (let j = 0; j < n; j++) { const t = j / n, t2 = t * t, t3 = t2 * t; out.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3), 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]); } } out.push(pts[pts.length - 1]); return out; }
  function pathLen(pts) { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return c; }
  function ptAt(pts, cum, f) { const L = cum[cum.length - 1] * clamp(f); let i = 1; while (i < cum.length - 1 && cum[i] < L) i++; const t = (L - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]); return [lerp(pts[i - 1][0], pts[i][0], t), lerp(pts[i - 1][1], pts[i][1], t), Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0])]; }
  function trim(k, pts, cum, f0, f1) { if (f1 - f0 <= 0.0005) return; const L = cum[cum.length - 1], a = L * f0, b = L * f1; k.beginPath(); const s = ptAt(pts, cum, f0); k.moveTo(s[0], s[1]); for (let i = 1; i < pts.length - 1; i++) if (cum[i] > a && cum[i] < b) k.lineTo(pts[i][0], pts[i][1]); const e = ptAt(pts, cum, f1); k.lineTo(e[0], e[1]); k.stroke(); }
  const LD = (() => { const a = smoothPath([[84, 158], [150, 126], [212, 146], [284, 86], [346, 108], [410, 60], [468, 34]]); const ax = [[70, 26], [70, 178], [486, 178]]; return { a, ac: pathLen(a), ax, axc: pathLen(ax) }; })();
  CELLS[3] = (k, w, h, u) => {
    stage(k);
    k.lineCap = 'round'; k.lineJoin = 'round';
    const er = eIO(P(u, 3.85, 4.55));
    k.strokeStyle = C.navy3; k.lineWidth = 6; trim(k, LD.ax, LD.axc, er, eIO(P(u, 0.08, 0.7)));
    const f1 = eIO(P(u, 0.4, 1.95)), f0 = eIO(P(u, 3.65, 4.45));
    k.strokeStyle = C.mint; k.lineWidth = 11; trim(k, LD.a, LD.ac, f0, f1);
    const ah = backOut(P(u, 1.9, 2.2), 2.5) * (1 - P(u, 4.3, 4.45));
    if (ah > 0.01) { const e = ptAt(LD.a, LD.ac, 1); k.save(); k.translate(e[0], e[1]); k.rotate(e[2]); k.beginPath(); k.moveTo(-26 * ah, -20 * ah); k.lineTo(4, 0); k.lineTo(-26 * ah, 20 * ah); k.stroke(); k.restore(); }
    if (f1 > 0 && f1 < 1) { const e = ptAt(LD.a, LD.ac, f1); k.fillStyle = C.yel; k.beginPath(); k.arc(e[0], e[1], 12, 0, 7); k.fill(); k.fillStyle = '#fff'; k.beginPath(); k.arc(e[0], e[1], 5, 0, 7); k.fill(); }
    const cf = eIO(P(u, 2.2, 2.8)), cb = eIO(P(u, 3.5, 4.0));
    if (cf > cb) { k.strokeStyle = C.coral; k.lineWidth = 7; k.beginPath(); k.arc(284, 86, 26, -Math.PI / 2 + cb * Math.PI * 2, -Math.PI / 2 + cf * Math.PI * 2); k.stroke(); }
  };

  CELLS[4] = (k, w, h, u) => {
    stage(k);
    const T = CYC / 2, lu = mod(u, T), X = w / 2, LY = 124;
    const lg = eIO(P(lu, 0.1, 0.5)) * (1 - eIO(P(lu, 2.05, 2.3)));
    const up = (1 - eOut5(P(lu, 0.35, 1.0))) * 120 + backIn(P(lu, 1.7, 2.05), 1.2) * -150;
    k.save(); k.beginPath(); k.rect(0, 8, w, LY - 8 - 5); k.clip();
    txt(k, 'Hello!', X, LY - 14 + up, `800 98px ${DISP}`, '#fff', 'center', 'alphabetic', '1px');
    k.restore();
    const dn = (1 - eOut5(P(lu, 0.55, 1.15))) * -60 + eIn(P(lu, 1.75, 2.05)) * 70;
    k.save(); k.beginPath(); k.rect(0, LY + 5, w, 52); k.clip();
    txt(k, '初次见面', X, LY + 44 + dn, `700 32px ${JP}`, C.yel, 'center', 'alphabetic', '6px');
    k.restore();
    if (lg > 0.005) { k.fillStyle = C.coral; rr(k, X - 190 * lg, LY - 3, 380 * lg, 6, 3); k.fill(); }
  };

  CELLS[5] = (k, w, h, u) => {
    stage(k);
    const S = '帮我做个猫咪视频', N = [...S].length, t0 = 0.3, dt = 0.24, done = t0 + N * dt;
    const BX = 34, BY = 58, BW = w - 68, BH = 92;
    const sendT = done + 0.55, clr = P(u, sendT + 0.12, sendT + 0.4);
    k.fillStyle = '#fff'; rr(k, BX, BY, BW, BH, 30); k.fill();
    const f = `600 36px ${JP}`; k.font = f;
    let n = clamp(Math.floor((u - t0) / dt) + 1, 0, N); if (u < t0) n = 0;
    let x = BX + 32; const y = BY + BH / 2 + 2;
    k.save(); rr(k, BX, BY, BW - 86, BH, 30); k.clip();
    [...S].slice(0, n).forEach((ch, i) => {
      const age = u - (t0 + i * dt), pop = 1 + 0.35 * Math.exp(-age * 16), cw = k.measureText(ch).width;
      k.save(); k.translate(x + cw / 2, y - clr * 70); k.scale(pop, pop); k.globalAlpha = 1 - clr;
      txt(k, ch, 0, 0, f, C.navy, 'center', 'middle'); k.restore(); k.font = f; x += cw + 1;
    });
    k.restore();
    if (clr > 0.5) x = BX + 32;
    const typing = u >= t0 - 0.05 && u < done + 0.1, blink = typing ? 1 : (mod(u, 0.94) < 0.5 ? 1 : 0);
    if (blink) { k.fillStyle = C.coral; rr(k, x + 4, y - 23, 5, 44, 2.5); k.fill(); }
    const on = spring(u - done - 0.12, 15, 6.5) * (1 - P(u, sendT + 0.5, sendT + 0.8)), press = 1 - 0.2 * Math.sin(Math.PI * P(u, sendT - 0.05, sendT + 0.2));
    const bx = BX + BW - 48, by = BY + BH / 2;
    k.fillStyle = '#DDE3F3'; k.beginPath(); k.arc(bx, by, 30, 0, 7); k.fill();
    if (on > 0.01) { k.fillStyle = C.blue; k.beginPath(); k.arc(bx, by, 30 * Math.min(on, 1.25) * press, 0, 7); k.fill(); }
    k.strokeStyle = '#fff'; k.lineWidth = 6; k.lineCap = 'round'; k.lineJoin = 'round'; k.beginPath(); k.moveTo(bx, by + 12); k.lineTo(bx, by - 12); k.moveTo(bx - 11, by - 2); k.lineTo(bx, by - 13); k.lineTo(bx + 11, by - 2); k.stroke();
  };

  CELLS[6] = (k, w, h, u) => {
    stage(k);
    const TARGET = 2480, a = P(u, 0.1, 0.4) * (1 - P(u, 4.0, 4.4));
    const p = P(u, 0.45, 2.9), v = Math.round(TARGET * (1 - Math.pow(1 - p, 4)));
    const s = v.toLocaleString('en-US'), f = `800 104px ${DISP}`;
    k.font = f; const dw = k.measureText('0').width + 2, cw = k.measureText(',').width;
    const full = TARGET.toLocaleString('en-US'); let tot = 0; for (const ch of full) tot += ch === ',' ? cw : dw;
    const land = u - 2.9, pop = 1 + (land > 0 ? 0.07 * Math.exp(-7 * land) * Math.cos(15 * land) : 0);
    const X = w / 2 + 42, Y = 96;
    k.save(); k.globalAlpha = a; k.translate(X, Y); k.scale(pop, pop);
    let x = tot / 2;
    const speed = p < 1 ? Math.pow(1 - p, 3) : 0;
    for (const ch of [...s].reverse()) {
      const cwid = ch === ',' ? cw : dw; x -= cwid;
      txt(k, ch, x + cwid / 2, 0, f, land > 0 ? C.yel : '#fff', 'center', 'middle');
    }
    k.restore();
    const ar = spring(u - 0.35, 14, 7) * (1 - P(u, 4.0, 4.3)), bob = speed * 6 * Math.sin(u * 30);
    if (ar > 0.01) { k.save(); k.translate(X - tot / 2 - 58, Y - 2 + bob); k.scale(ar, ar); k.fillStyle = C.mint; k.beginPath(); k.arc(0, 0, 34, 0, 7); k.fill(); k.strokeStyle = C.navy; k.lineWidth = 8; k.lineCap = 'round'; k.lineJoin = 'round'; k.beginPath(); k.moveTo(0, 15); k.lineTo(0, -14); k.moveTo(-13, -1); k.lineTo(0, -15); k.lineTo(13, -1); k.stroke(); k.restore(); }
    const bw = 330, bx = w / 2 - bw / 2, by = 168;
    k.globalAlpha = a; k.fillStyle = C.navy3; rr(k, bx, by, bw, 12, 6); k.fill();
    const g = k.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, C.blue); g.addColorStop(1, C.mint);
    k.fillStyle = g; rr(k, bx, by, Math.max(12, bw * (v / TARGET)), 12, 6); k.fill(); k.globalAlpha = 1;
  };

  CELLS[7] = (k, w, h, u) => {
    stage(k);
    const T = CYC / 4, n = Math.min(3, Math.floor(u / T)), lu = u - n * T, X = w / 2, Y = h / 2 + 6;
    const out = P(lu, T - 0.2, T - 0.02), oa = 1 - out, oy = -46 * eIn(out);
    const f = `800 88px ${JP}`;
    k.save(); k.translate(X, Y + oy); k.globalAlpha = oa;
    if (n === 0) {
      const sp = spring(lu - 0.05, 12, 4.2), sx = 0.3 + 0.7 * sp, sy = 1 / Math.sqrt(Math.max(0.75, sx));
      k.globalAlpha = oa * P(lu, 0.03, 0.12); k.scale(sx, sy); txt(k, '拉伸', 0, 0, f, C.blue, 'center', 'middle', '4px');
    } else if (n === 1) {
      chars(k, '弹跳', f, 6).forEach((c, i) => {
        const tt = lu - 0.06 - i * 0.1; if (tt < 0) return;
        const y = -78 * Math.abs(Math.sin(Math.PI * tt / 0.4)) * Math.exp(-2.6 * tt), near = Math.abs(Math.sin(Math.PI * tt / 0.4)) < 0.25 ? 1 : 0;
        const sq = 1 - 0.16 * near * Math.exp(-2.6 * tt), a = P(tt, 0, 0.08);
        k.save(); k.globalAlpha = oa * a; k.translate(c.x, y + 44); k.scale(2 - sq, sq); txt(k, c.ch, 0, -44, f, C.yel, 'center', 'middle'); k.restore();
      });
    } else if (n === 2) {
      chars(k, '旋转', f, 6).forEach((c, i) => {
        const tt = lu - 0.05 - i * 0.12; if (tt < 0) return;
        const q = backOut(P(tt, 0, 0.62), 1.3), sc = eOut(P(tt, 0, 0.25));
        k.save(); k.translate(c.x, 0); k.rotate((1 - q) * -Math.PI * 2); k.scale(sc, sc); txt(k, c.ch, 0, 0, f, C.mint, 'center', 'middle'); k.restore();
      });
    } else {
      const hit = 0.2, tt = lu - hit, sc = tt < 0 ? lerp(3.4, 1, eIn(P(lu, 0.02, hit))) : 1;
      const dx = tt > 0 ? 10 * Math.exp(-9 * tt) * Math.sin(38 * tt) : 0, sy = tt > 0 ? 1 - 0.2 * Math.exp(-11 * tt) : 1;
      k.globalAlpha = oa * P(lu, 0.02, 0.1);
      if (tt > 0 && tt < 0.4) { const q = eOut(tt / 0.4); k.strokeStyle = C.yel; k.lineWidth = 7 * (1 - q); k.lineCap = 'round'; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.2, r0 = 120 + 50 * q, r1 = r0 + 26; k.beginPath(); k.moveTo(Math.cos(a) * r0 * 1.35, Math.sin(a) * r0 * 0.5); k.lineTo(Math.cos(a) * r1 * 1.35, Math.sin(a) * r1 * 0.5); if (q < 0.97) k.stroke(); } }
      k.translate(dx, 44); k.scale(sc * (2 - sy), sc * sy); k.transform(1, 0, -0.14, 1, 0, 0); txt(k, '咚!', 0, -44, `800 100px ${JP}`, C.coral, 'center', 'middle');
    }
    k.restore();
  };

  const EZ = bez(.86, 0, .14, 1);
  const EZT = [0.2, 1.75, 2.55, 4.1];
  const ezPos = u => { if (u < EZT[0]) return 0; if (u < EZT[1]) return P(u, EZT[0], EZT[1]); if (u < EZT[2]) return 1; if (u < EZT[3]) return 1 - P(u, EZT[2], EZT[3]); return 0; };
  const ezE = u => { if (u < EZT[0]) return 0; if (u < EZT[1]) return EZ(P(u, EZT[0], EZT[1])); if (u < EZT[2]) return 1; if (u < EZT[3]) return 1 - EZ(P(u, EZT[2], EZT[3])); return 0; };
  CELLS[8] = (k, w, h, u) => {
    stage(k);
    const x0 = 162, x1 = 478, D = x1 - x0, y1 = 58, y2 = 150, S = 62;
    const lin = ezPos(u), mv = (u >= EZT[0] && u < EZT[1]) ? 1 : (u >= EZT[2] && u < EZT[3]) ? -1 : 0, pp = mv === 1 ? P(u, EZT[0], EZT[1]) : mv === -1 ? P(u, EZT[2], EZT[3]) : 0;
    const ez = mv === 1 ? EZ(pp) : mv === -1 ? 1 - EZ(pp) : lin;
    const vel = mv ? (EZ(Math.min(1, pp + 0.01)) - EZ(Math.max(0, pp - 0.01))) / 0.02 : 0, vn = clamp(vel / 3.6);
    txt(k, '匀速', 24, y1 + 1, `700 34px ${JP}`, C.dim, 'left', 'middle');
    txt(k, '缓急', 24, y2 + 1, `700 34px ${JP}`, C.yel, 'left', 'middle');
    [[y1, x => x, '#34489A'], [y2, EZ, '#34489A']].forEach(([y, f, col]) => {
      k.strokeStyle = C.navy2; k.lineWidth = 6; k.lineCap = 'round'; k.beginPath(); k.moveTo(x0, y); k.lineTo(x1, y); k.stroke();
      k.fillStyle = col; for (let i = 0; i <= 11; i++) { k.beginPath(); k.arc(x0 + f(i / 11) * D, y, 5, 0, 7); k.fill(); }
    });
    k.fillStyle = '#6677AD'; rr(k, x0 + lin * D - S / 2, y1 - S / 2, S, S, 16); k.fill();
    const X = x0 + ez * D;
    if (vn > 0.05) {
      k.lineCap = 'round';
      [[-20, C.yel, 1], [0, C.coral, 1.25], [20, C.yel, 0.8]].forEach(([dy, col, m]) => { k.strokeStyle = col; k.globalAlpha = 0.9 * vn; k.lineWidth = 10; k.beginPath(); k.moveTo(X - mv * (S / 2), y2 + dy); k.lineTo(X - mv * (S / 2 + 150 * vn * m), y2 + dy); k.stroke(); });
      k.globalAlpha = 1;
    }
    for (let g = 4; g >= 1; g--) { const gx = x0 + ezE(u - g * 0.035) * D; if (Math.abs(gx - X) > 3) { k.globalAlpha = 0.16 * (5 - g) / 4 + 0.06; k.fillStyle = C.coral; rr(k, gx - S / 2, y2 - S / 2, S, S, 16); k.fill(); } } k.globalAlpha = 1;
    const sx = 1 + 0.5 * vn, sy = 1 - 0.2 * vn;
    k.save(); k.translate(X, y2); k.scale(sx, sy); k.fillStyle = C.coral; rr(k, -S / 2, -S / 2, S, S, 16); k.fill(); k.fillStyle = 'rgba(255,255,255,.9)'; k.beginPath(); k.arc(S / 2 - 18, -S / 2 + 18, 6, 0, 7); k.fill(); k.restore();
  };

  CELLS[9] = (k, w, h, u) => {
    stage(k);
    const X = w / 2, Y = h - 26, R = 128, TG = 0.7;
    let v;
    if (u < 0.25) v = 0; else if (u < 3.7) { const t = u - 0.25; v = TG * (1 - Math.exp(-4.6 * t) * Math.cos(10.5 * t)); } else { const t = u - 3.7; v = TG * Math.exp(-7.5 * t) * Math.cos(8.5 * t); }
    const ang = x => Math.PI + x * Math.PI;
    k.lineCap = 'round';
    k.strokeStyle = C.navy2; k.lineWidth = 26; k.beginPath(); k.arc(X, Y, R, ang(0), ang(1)); k.stroke();
    if (v > 0.005) { const g = k.createLinearGradient(X - R, 0, X + R, 0); g.addColorStop(0, C.blue); g.addColorStop(1, C.mint); k.strokeStyle = g; k.beginPath(); k.arc(X, Y, R, ang(0), ang(v)); k.stroke(); }
    if (v > TG + 0.004) { k.strokeStyle = C.coral; k.lineCap = 'butt'; k.beginPath(); k.arc(X, Y, R, ang(TG), ang(v)); k.stroke(); k.lineCap = 'round'; }
    const ta = ang(TG);
    k.strokeStyle = C.yel; k.lineWidth = 7; k.beginPath(); k.moveTo(X + Math.cos(ta) * (R - 22), Y + Math.sin(ta) * (R - 22)); k.lineTo(X + Math.cos(ta) * (R + 30), Y + Math.sin(ta) * (R + 30)); k.stroke();
    k.fillStyle = C.yel; k.beginPath(); k.arc(X + Math.cos(ta) * (R + 38), Y + Math.sin(ta) * (R + 38), 8, 0, 7); k.fill();
    const a = ang(v);
    k.strokeStyle = '#fff'; k.lineWidth = 9; k.beginPath(); k.moveTo(X, Y); k.lineTo(X + Math.cos(a) * (R - 26), Y + Math.sin(a) * (R - 26)); k.stroke();
    k.fillStyle = '#fff'; k.beginPath(); k.arc(X, Y, 17, 0, 7); k.fill(); k.fillStyle = C.coral; k.beginPath(); k.arc(X, Y, 8, 0, 7); k.fill();
  };

  CELLS[10] = (k, w, h, u) => {
    stage(k);
    const T = CYC / 4, q = mod(u, T) / T, c = 0.1, floor = h - 28, R = 37, Hgt = 92;
    const X = w / 2 + 150 * Math.sin(u / CYC * Math.PI * 2);
    let sy, yb, grounded = false;
    if (q < c || q > 1 - c) { const d = (q < c ? q : 1 - q) / c; sy = lerp(0.52, 1.28, d * d); yb = floor; grounded = true; }
    else { const qq = (q - c) / (1 - 2 * c), sp = Math.abs(2 * qq - 1); yb = floor - Hgt * (1 - sp * sp); sy = 1 + 0.28 * Math.pow(sp, 3); }
    const sx = 1 / sy, hg = (floor - yb) / Hgt;
    k.fillStyle = C.navy3; rr(k, 40, floor, w - 80, 5, 2.5); k.fill();
    k.fillStyle = 'rgba(0,0,0,.32)'; k.beginPath(); k.ellipse(X, floor + 9, R * 1.2 * (1 - hg * 0.55) * Math.max(1, sx), 6 * (1 - hg * 0.5), 0, 0, 7); k.fill();
    const dq = q < 0.5 ? q : q - 1; if (Math.abs(dq) < 0.16 && dq > -0.02) { const t = (dq + 0.02) / 0.18; k.strokeStyle = C.yel; k.lineWidth = 5 * (1 - t); k.lineCap = 'round';[-1, 1].forEach(s => { k.beginPath(); k.moveTo(X + s * (50 + 28 * t), floor - 6 - 10 * t); k.lineTo(X + s * (62 + 40 * t), floor - 12 - 20 * t); if (t < 0.97) k.stroke(); }); }
    k.save(); k.translate(X, yb); k.scale(sx, sy);
    k.fillStyle = C.coral; k.beginPath(); k.arc(0, -R, R, 0, 7); k.fill();
    k.fillStyle = '#fff'; k.beginPath(); k.ellipse(-12, -R - 4, 7, 9.5, 0, 0, 7); k.ellipse(12, -R - 4, 7, 9.5, 0, 0, 7); k.fill();
    k.fillStyle = C.navy; k.beginPath(); k.arc(-10.5, -R - 3, 3.8, 0, 7); k.arc(13.5, -R - 3, 3.8, 0, 7); k.fill();
    k.restore();
  };

  const MN = 240;
  const SHAPES = (() => {
    const R = 64, mk = fn => { const a = []; for (let i = 0; i < MN; i++) a.push(fn(i / MN)); return a; };
    const circle = mk(t => { const a = t * Math.PI * 2 - Math.PI / 2; return [Math.cos(a) * R, Math.sin(a) * R]; });
    const sq = mk(t => { const a = t * Math.PI * 2 - Math.PI / 2; let r = R * 0.88 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))); r = Math.min(r, R * 1.13); return [Math.cos(a) * r, Math.sin(a) * r]; });
    const st = mk(t => { const seg = 1 / 10, j = Math.floor(t / seg), f = (t - j * seg) / seg, ro = R * 1.2, ri = R * 0.56; const a0 = j * Math.PI / 5 - Math.PI / 2, a1 = (j + 1) * Math.PI / 5 - Math.PI / 2, r0 = j % 2 ? ri : ro, r1 = j % 2 ? ro : ri; return [lerp(Math.cos(a0) * r0, Math.cos(a1) * r1, f), lerp(Math.sin(a0) * r0, Math.sin(a1) * r1, f)]; });
    const hp = mk(t => { const a = t * Math.PI * 2, s = R / 15.5; return [16 * Math.pow(Math.sin(a), 3) * s, -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * s - 4]; });
    return [circle, sq, st, hp];
  })();
  const MCOL = [C.blue, C.coral, C.yel, C.mint];
  CELLS[11] = (k, w, h, u) => {
    stage(k);
    const T = CYC / 4, i = Math.min(3, Math.floor(u / T)), lu = u - i * T;
    const pr = P(lu, T - 0.62, T - 0.04), p = backOut(pr, 1.6), pc = eIOs(pr);
    const A = SHAPES[i], B = SHAPES[(i + 1) % 4], X = w / 2, Y = h / 2 + 3;
    for (let j = 0; j < 4; j++) { const on = j === i ? 1 - pc : j === (i + 1) % 4 ? pc : 0; k.fillStyle = mix(C.navy3, MCOL[j], on); k.beginPath(); k.arc(X - 39 + j * 26, h - 16, 5 + 2 * on, 0, 7); k.fill(); }
    const pulse = 1 + 0.07 * Math.sin(Math.PI * pr);
    k.save(); k.translate(X, Y - 8); k.scale(pulse, pulse);
    k.fillStyle = mix(MCOL[i], MCOL[(i + 1) % 4], pc); k.beginPath();
    for (let j = 0; j < MN; j++) { const x = lerp(A[j][0], B[j][0], p), y = lerp(A[j][1], B[j][1], p); j ? k.lineTo(x, y) : k.moveTo(x, y); }
    k.closePath(); k.lineJoin = 'round'; k.strokeStyle = k.fillStyle; k.lineWidth = 8; k.stroke(); k.fill(); k.restore();
  };

  const LQ = bez(.7, 0, .2, 1);
  const lqPos = uu => { const u = mod(uu, CYC); let p; if (u < 0.35) p = 0; else if (u < 1.45) p = LQ(P(u, 0.35, 1.45)); else if (u < 2.7) p = 1; else if (u < 3.8) p = 1 - LQ(P(u, 2.7, 3.8)); else p = 0; const mvp = (u >= 0.35 && u < 1.45) ? P(u, 0.35, 1.45) : (u >= 2.7 && u < 3.8) ? P(u, 2.7, 3.8) : 0; return [lerp(120, 420, p), 104 - 34 * Math.sin(Math.PI * mvp)]; };
  CELLS[12] = (k, w, h, u) => {
    stage(k);
    const blobs = [];
    for (let i = 0; i < 8; i++) { const [x, y] = lqPos(u - i * 0.065); blobs.push([x, y + (i ? 6 * Math.sin(u * 2.67 + i) : 0), lerp(44, 15, i / 7)]); }
    for (let j = 0; j < 3; j++) { const [x, y] = lqPos(u - 0.1), a = j * 2.2 + 0.6, d = 34 + 30 * (0.5 - 0.5 * Math.cos(u / CYC * Math.PI * 4 + j * 2.1)); blobs.push([x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, 15 - j * 2]); }
    const L = goo(g => { for (const b of blobs) { g.beginPath(); g.arc(b[0], b[1], b[2], 0, 7); g.fill(); } }, 9, g => { const gr = g.createLinearGradient(60, 30, 480, 180); gr.addColorStop(0, C.mint); gr.addColorStop(0.55, C.blue); gr.addColorStop(1, '#7C5CFF'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    k.drawImage(L, 0, 0);
    const [hx, hy] = lqPos(u); k.fillStyle = 'rgba(255,255,255,.75)'; k.beginPath(); k.ellipse(hx - 14, hy - 17, 10, 6, -0.6, 0, 7); k.fill();
  };

  CELLS[13] = (k, w, h, u) => {
    stage(k);
    const X = w / 2, Y = h / 2 + 2, A = 196, B = 62, th = u / CYC * Math.PI * 2;
    const pt = a => [X + A * Math.sin(a), Y + B * Math.sin(2 * a)];
    const N = 15;
    for (let i = N; i >= 1; i--) {
      const [x, y] = pt(th - i * 0.105), f = i / N;
      k.globalAlpha = 0.9 * (1 - f) + 0.05; k.fillStyle = f < 0.5 ? mix(C.coral, C.yel, f * 2) : mix(C.yel, C.blue, (f - 0.5) * 2);
      k.beginPath(); k.arc(x, y, lerp(22, 6, f), 0, 7); k.fill();
    }
    k.globalAlpha = 1; const [x, y] = pt(th);
    k.fillStyle = C.coral; k.beginPath(); k.arc(x, y, 25, 0, 7); k.fill();
    k.fillStyle = '#fff'; k.beginPath(); k.arc(x, y, 11, 0, 7); k.fill();
  };

  const PARTS = (() => { const R = rand(15), a = []; for (let i = 0; i < 84; i++) { const n = R() < 0.5 ? 2 : 3; a.push({ T: CYC / n, ph: R() * CYC, vx: (R() - 0.5) * 2 * 190, vy: -(250 + R() * 150), sz: 5 + R() * 6, col: PAL[i % 4], kind: i % 3, spin: (R() - 0.5) * 9 }); } return a; })();
  CELLS[14] = (k, w, h, u) => {
    stage(k);
    const X = w / 2, Y = h - 20, G = 470;
    for (const p of PARTS) {
      const t = mod(u + p.ph, p.T), life = Math.min(p.T, 1.5); if (t > life) continue;
      const x = X + p.vx * t, y = Y + p.vy * t + 0.5 * G * t * t, a = Math.min(1, t / 0.06) * (1 - smooth(P(t, life * 0.7, life))), sc = lerp(1.15, 0.7, t / life);
      k.globalAlpha = a; k.fillStyle = p.col; k.save(); k.translate(x, y); k.rotate(t * p.spin); k.scale(sc, sc);
      if (p.kind === 0) { k.beginPath(); k.arc(0, 0, p.sz, 0, 7); k.fill(); }
      else if (p.kind === 1) { k.fillRect(-p.sz, -p.sz, p.sz * 2, p.sz * 2); }
      else { k.beginPath(); k.moveTo(0, -p.sz * 1.3); k.lineTo(p.sz * 1.2, p.sz); k.lineTo(-p.sz * 1.2, p.sz); k.closePath(); k.fill(); }
      k.restore();
    }
    k.globalAlpha = 1;
    k.fillStyle = C.navy3; rr(k, X - 70, h - 12, 140, 30, 10); k.fill();
    k.fillStyle = '#fff'; rr(k, X - 30, h - 22, 60, 30, 10); k.fill();
  };

  const PLX = (() => {
    const R = rand(16), ridge = (base, amp, step, seed) => { const r = rand(seed), pts = []; for (let x = -220; x <= CW + 220; x += step) pts.push([x, base - amp * (0.35 + 0.65 * r())], [x + step / 2, base + amp * 0.1 * r()]); return pts; };
    const stars = []; for (let i = 0; i < 16; i++) stars.push([R() * (CW + 80) - 40, 12 + R() * 80, 1.5 + R() * 2]);
    const trees = []; for (let i = 0; i < 9; i++) trees.push([-160 + i * 108 + R() * 30, 34 + R() * 24, i % 3]);
    return { far: ridge(150, 78, 120, 3), mid: ridge(172, 74, 92, 8), stars, trees };
  })();
  CELLS[15] = (k, w, h, u) => {
    const pan = 108 * Math.sin(u / CYC * Math.PI * 2);
    const g = k.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0A0A0B'); g.addColorStop(1, '#27408F'); k.fillStyle = g; k.fillRect(0, 0, w, h);
    k.fillStyle = '#fff'; for (const s of PLX.stars) { k.globalAlpha = 0.8; k.beginPath(); k.arc(s[0] - pan * 0.05, s[1], s[2], 0, 7); k.fill(); } k.globalAlpha = 1;
    k.fillStyle = C.yel; k.beginPath(); k.arc(390 - pan * 0.1, 56, 30, 0, 7); k.fill();
    const poly = (pts, m, col) => { k.fillStyle = col; k.beginPath(); k.moveTo(-260, h + 10); pts.forEach(p => k.lineTo(p[0] - pan * m, p[1])); k.lineTo(w + 260, h + 10); k.closePath(); k.fill(); };
    poly(PLX.far, 0.28, '#31499C');
    poly(PLX.mid, 0.6, C.blue);
    k.fillStyle = C.mint; k.beginPath(); k.moveTo(-300, h + 10); for (let x = -300; x <= w + 300; x += 20) k.lineTo(x - pan * 1.25, 176 + 12 * Math.sin(x * 0.012)); k.lineTo(w + 300, h + 10); k.closePath(); k.fill();
    for (const t of PLX.trees) { const x = t[0] - pan * 1.25, by = 180 + 12 * Math.sin(t[0] * 0.012), hh = t[1] * 1.45; k.fillStyle = C.navy; k.fillRect(x - 4, by - 16, 8, 22); k.fillStyle = t[2] === 0 ? C.coral : '#12A57B'; k.beginPath(); k.moveTo(x, by - hh); k.lineTo(x + 20, by - 12); k.lineTo(x - 20, by - 12); k.closePath(); k.fill(); }
    k.fillStyle = '#0A1230';[[-40, 60], [300, 44], [620, 66]].forEach(([x, r]) => { k.beginPath(); k.arc(x - pan * 2.1, h + 18, r, 0, 7); k.fill(); });
  };

  const SUN = [112, 104], MOON = [CW - 112, 104];
  function scrA(k, w, h) {
    k.fillStyle = C.cream; k.fillRect(0, 0, w, h);
    k.fillStyle = '#FFD9A8'; k.beginPath(); k.arc(SUN[0], SUN[1], 66, 0, 7); k.fill();
    k.fillStyle = C.coral; k.beginPath(); k.arc(SUN[0], SUN[1], 44, 0, 7); k.fill();
    txt(k, 'DAY', 214, h / 2 + 4, `800 96px ${DISP}`, C.navy, 'left', 'middle', '2px');
    k.fillStyle = '#fff'; rr(k, 400, 34, 96, 26, 13); k.fill(); rr(k, 430, 20, 50, 26, 13); k.fill();
  }
  function scrB(k, w, h) {
    k.fillStyle = '#16255A'; k.fillRect(0, 0, w, h);
    k.fillStyle = '#fff';[[40, 30, 3], [150, 170, 2.5], [250, 24, 2.5], [330, 180, 3], [500, 30, 2.5], [20, 150, 2], [300, 100, 0]].forEach(s => { k.beginPath(); k.arc(s[0], s[1], s[2], 0, 7); k.fill(); });
    k.fillStyle = C.yel; k.beginPath(); k.arc(MOON[0], MOON[1], 46, 0, 7); k.fill();
    k.fillStyle = '#16255A'; k.beginPath(); k.arc(MOON[0] + 22, MOON[1] - 14, 38, 0, 7); k.fill();
    txt(k, 'NIGHT', 40, h / 2 + 4, `800 88px ${DISP}`, '#fff', 'left', 'middle', '1px');
  }
  const SCR = [scrA, scrB];
  const SEG3 = CYC / 2;
  function abCell(trans) { return (k, w, h, u) => { const sgi = Math.min(1, Math.floor(u / SEG3)), uu = u - sgi * SEG3; trans(k, w, h, uu, sgi, 1 - sgi); }; }
  const TA = 0.5, TB = 1.5;

  CELLS[16] = abCell((k, w, h, u, a, b) => {
    const p = eIO(P(u, TA - 0.05, TB + 0.1));
    SCR[a](k, w, h);
    if (p > 0) {
      const c = a === 0 ? SUN : MOON, shape = () => { if (a === 0) { k.beginPath(); k.arc(c[0], c[1], lerp(0, 470, p), 0, 7); } else star(k, c[0], c[1], lerp(0, 1150, p), p * 1.2, 0.5); };
      k.save(); shape(); k.clip(); SCR[b](k, w, h); k.restore();
      if (p < 1) { k.strokeStyle = '#fff'; k.lineWidth = 7; k.lineJoin = 'round'; shape(); k.stroke(); }
    }
  });

  CELLS[17] = abCell((k, w, h, u, a, b) => {
    const p1 = P(u, TA - 0.12, TA + 0.5), p2 = P(u, TA + 0.62, TA + 1.25), N = 4, sk = 80;
    SCR[p1 >= 1 ? b : a](k, w, h);
    const cols = [C.blue, C.coral, C.yel, C.mint];
    for (let i = 0; i < N; i++) {
      const d = i * 0.14, e1 = eIO(clamp((p1 - d) / (1 - 0.42))), e2 = eIO(clamp((p2 - d) / (1 - 0.42)));
      if (e1 <= 0 || e2 >= 1) continue;
      const bh = h / N + 1, y = i * h / N, span = w + sk + 20, dir = a === 0 ? 1 : -1;
      let xa = -sk - 10 + e2 * span, xb = -sk - 10 + e1 * span;
      k.save(); if (dir < 0) { k.translate(w, 0); k.scale(-1, 1); }
      k.fillStyle = cols[i]; k.beginPath(); k.moveTo(xa + sk, y); k.lineTo(xb + sk, y); k.lineTo(xb, y + bh); k.lineTo(xa, y + bh); k.closePath(); k.fill(); k.restore();
    }
  });

  const DRIPS = [0, 1].map(s => { const R = rand(190 + s * 7), a = []; for (let i = 0; i < 7; i++) a.push({ x: 36 + i * 78 + (R() - 0.5) * 30, len: 30 + R() * 80, wd: 15 + R() * 12, ph: R() * 6 }); return a; });
  function liquidShape(g, w, h, p, set, u) {
    const base = lerp(-110, h + 130, p), amp = Math.sin(Math.PI * clamp(p * 1.1));
    g.beginPath(); g.moveTo(-20, -40);
    for (let x = -20; x <= w + 20; x += 10) g.lineTo(x, base + amp * (13 * Math.sin(x * 0.021 + u * 3 + set) + 8 * Math.sin(x * 0.05 + u * 4.3)));
    g.lineTo(w + 20, -40); g.closePath(); g.fill();
    for (const d of DRIPS[set]) { const L = d.len * (0.25 + amp * 0.9), y0 = base - 20; g.beginPath(); g.roundRect(d.x - d.wd, y0, d.wd * 2, L + 20, d.wd); g.fill(); g.beginPath(); g.arc(d.x, y0 + L + 18, d.wd * 1.25, 0, 7); g.fill(); }
  }
  CELLS[18] = abCell((k, w, h, u, a, b) => {
    const p1 = eIOs(P(u, TA - 0.15, TB)), p2 = eIOs(P(u, TA + 0.2, TB + 0.3));
    SCR[a](k, w, h);
    if (p1 > 0 && p2 < 1) k.drawImage(goo(g => liquidShape(g, w, h, p1, 0, u), 7, g => { g.fillStyle = a === 0 ? C.blue : C.coral; g.fillRect(0, 0, w, h); }), 0, 0);
    if (p2 >= 1) SCR[b](k, w, h);
    else if (p2 > 0) k.drawImage(goo(g => liquidShape(g, w, h, p2, 1, u + 1), 7, g => SCR[b](g, w, h)), 0, 0);
  });

  function ring(k, x, y, col) { k.strokeStyle = col; k.lineWidth = 21; k.beginPath(); k.arc(x, y, 35, 0, 7); k.stroke(); }
  const ZP = [{ x: 228, y: 106, r: 24.5 }, { x: 300, y: 106, r: 24.5 }];
  function scrX(k, w, h) { k.fillStyle = C.yel; k.fillRect(0, 0, w, h); const f = `800 118px ${DISP}`; txt(k, 'Z', 128, 110, f, C.navy, 'center', 'middle'); ring(k, 228, 106, C.navy); ring(k, 324, 106, C.navy); txt(k, 'M', 432, 110, f, C.navy, 'center', 'middle'); }
  function scrY(k, w, h) { k.fillStyle = C.blue; k.fillRect(0, 0, w, h); const f = `800 118px ${DISP}`; txt(k, 'G', 208, 110, f, '#fff', 'center', 'middle'); ring(k, 300, 106, '#fff'); txt(k, '!', 372, 110, f, C.yel, 'center', 'middle'); }
  const SCZ = [scrX, scrY], ZBG = [C.yel, C.blue];
  CELLS[19] = abCell((k, w, h, u, a, b) => {
    const po = ZP[a], Smax = Math.hypot(Math.max(po.x, w - po.x), Math.max(po.y, h - po.y)) / po.r * 1.08;
    const p = eIn(P(u, TA - 0.25, TB - 0.3)) * 0.8 + eOut(P(u, TB - 0.3, TB + 0.15)) * 0.2;
    if (p >= 1) return SCZ[b](k, w, h);
    const s = Math.pow(Smax, p), Z = (kk, sc) => { kk.translate(po.x, po.y); kk.scale(sc, sc); kk.translate(-po.x, -po.y); };
    k.save(); Z(k, s); SCZ[a](k, w, h);
    k.save(); k.beginPath(); k.arc(po.x, po.y, po.r, 0, 7); k.clip(); k.fillStyle = ZBG[b]; k.fillRect(0, 0, w, h); Z(k, 1 / Smax); SCZ[b](k, w, h); k.restore();
    k.restore();
  });

  const FW = 300, FH = 156, FC = mkCanvas(FW, FH), FK = FC.getContext('2d');
  function flipFace(i) {
    FK.setTransform(1, 0, 0, 1, 0, 0); FK.clearRect(0, 0, FW, FH);
    FK.fillStyle = i ? C.yel : C.blue; rr(FK, 0, 0, FW, FH, 22); FK.fill();
    FK.strokeStyle = i ? 'rgba(15,26,61,.18)' : 'rgba(255,255,255,.3)'; FK.lineWidth = 4; rr(FK, 12, 12, FW - 24, FH - 24, 13); FK.stroke();
    txt(FK, i ? 'A' : 'Q', 92, FH / 2 + 4, `800 112px ${DISP}`, i ? C.navy : '#fff', 'center', 'middle');
    FK.fillStyle = i ? C.navy : '#fff'; FK.globalAlpha = i ? 0.85 : 0.9; rr(FK, 164, 50, 100, 14, 7); FK.fill(); FK.globalAlpha = i ? 0.4 : 0.5; rr(FK, 164, 76, 76, 12, 6); FK.fill(); rr(FK, 164, 98, 90, 12, 6); FK.fill(); FK.globalAlpha = 1;
  }
  CELLS[20] = abCell((k, w, h, u, a, b) => {
    stage(k);
    const pr = P(u, TA - 0.05, TB), th = Math.PI * backOut(pr, 1.5), c = Math.cos(th), s = Math.sin(th), front = c >= 0;
    flipFace(front ? a : b);
    const X = w / 2, Y = h / 2 - 2, lift = Math.sin(Math.PI * pr), sc = 1 + 0.08 * lift, ww = FW * Math.abs(c) * sc, per = 0.2 * s * (front ? 1 : -1);
    k.fillStyle = 'rgba(0,0,0,.3)'; k.beginPath(); k.ellipse(X, h - 13, Math.max(8, ww / 2 * 0.9), 6, 0, 0, 7); k.fill();
    const STEP = 2;
    for (let sx = 0; sx < FW; sx += STEP) { const f = sx / FW, dx = X - ww / 2 + f * ww, hh = FH * sc * (1 + per * (f - 0.5) * 2); k.drawImage(FC, sx, 0, STEP, FH, dx, Y - hh / 2 - 6 * lift, ww / FW * STEP + 0.6, hh); }
    if (Math.abs(s) > 0.02) { k.fillStyle = `rgba(8,14,40,${0.34 * Math.abs(s)})`; k.beginPath(); const hl = FH * sc * (1 - per), hr = FH * sc * (1 + per), yy = Y - 6 * lift; k.moveTo(X - ww / 2, yy - hl / 2); k.lineTo(X + ww / 2, yy - hr / 2); k.lineTo(X + ww / 2, yy + hr / 2); k.lineTo(X - ww / 2, yy + hl / 2); k.closePath(); k.fill(); }
  });

  CELLS[21] = (k, w, h, u) => {
    stage(k);
    const T = CYC / 2, lu = mod(u, T), p = eIOs(P(lu, 0.45, 1.5));
    const BW = 400, BH = 112, X = w / 2 - BW / 2, Y = h / 2 - BH / 2;
    k.fillStyle = 'rgba(0,0,0,.3)'; rr(k, X + 3, Y + 9, BW, BH, 28); k.fill();
    const g = k.createLinearGradient(X, Y, X + BW, Y + BH); g.addColorStop(0, '#2B62E0'); g.addColorStop(1, '#4E8BFF'); k.fillStyle = g; rr(k, X, Y, BW, BH, 28); k.fill();
    k.fillStyle = C.yel; star(k, X + 64, Y + BH / 2, 30, 0, 0.5); k.lineJoin = 'round'; k.strokeStyle = C.yel; k.lineWidth = 5; k.stroke(); k.fill();
    txt(k, 'PREMIUM', X + 112, Y + BH / 2 + 3, `800 50px ${DISP}`, '#fff', 'left', 'middle', '3px');
    if (p > 0 && p < 1) {
      k.save(); rr(k, X, Y, BW, BH, 28); k.clip();
      k.translate(lerp(X - 130, X + BW + 130, p), Y + BH / 2); k.rotate(0.42);
      const gr = k.createLinearGradient(-58, 0, 58, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,.72)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      k.fillStyle = gr; k.fillRect(-58, -160, 116, 320); k.fillStyle = 'rgba(255,255,255,.5)'; k.fillRect(78, -160, 12, 320);
      k.restore();
    }
    const tt = lu - 1.38; if (tt > 0 && tt < 0.6) { const q = tt / 0.6, sc = Math.sin(Math.PI * q) * (1 + 0.2 * (1 - q)); k.save(); k.translate(X + BW - 8, Y + 6); k.rotate(q * 0.9); k.fillStyle = '#fff'; star(k, 0, 0, 30 * sc, 0, 0.22, 4); k.fill(); k.restore(); }
  };

  const TMP = mkCanvas(CW, CH), TK = TMP.getContext('2d');
  const GL = (() => { const R = rand(231), st = []; for (let s = 0; s < 12; s++) { const sl = [], n = 2 + Math.floor(R() * 3); for (let i = 0; i < n; i++) sl.push({ y: Math.floor(40 + R() * 110), h: 10 + Math.floor(R() * 26), dx: Math.round((R() < .5 ? -1 : 1) * (18 + R() * 46)) }); const bars = []; for (let i = 0; i < 3; i++) bars.push({ x: 30 + R() * 420, y: 30 + R() * 150, w: 30 + R() * 90, h: 5 + R() * 7, c: i }); st.push({ sl, bars, rgb: 7 + Math.round(R() * 9) }); } return st; })();
  const GLC = mkCanvas(CW, CH), GK = GLC.getContext('2d'), GLT = mkCanvas(CW, CH), GT = GLT.getContext('2d');
  CELLS[22] = (k, w, h, u) => {
    const content = kk => { txt(kk, 'GLITCH', w / 2, h / 2 + 4, `800 104px ${DISP}`, '#fff', 'center', 'middle', '2px'); };
    const step = 0.14; let si = -1;
    if (u >= 0.55 && u < 0.55 + step * 5) si = Math.floor((u - 0.55) / step);
    else if (u >= 2.9 && u < 2.9 + step * 6) si = 5 + Math.floor((u - 2.9) / step);
    stage(k);
    if (si < 0) { content(k); return; }
    const S = GL[si];
    TK.setTransform(1, 0, 0, 1, 0, 0); TK.clearRect(0, 0, w, h); content(TK);
    const tint = col => { GT.setTransform(1, 0, 0, 1, 0, 0); GT.globalCompositeOperation = 'source-over'; GT.clearRect(0, 0, w, h); GT.drawImage(TMP, 0, 0); GT.globalCompositeOperation = 'source-in'; GT.fillStyle = col; GT.fillRect(0, 0, w, h); GT.globalCompositeOperation = 'source-over'; return GLT; };
    GK.setTransform(1, 0, 0, 1, 0, 0); GK.fillStyle = C.navy; GK.fillRect(0, 0, w, h);
    GK.drawImage(tint(C.coral), -S.rgb, 2); GK.drawImage(tint('#22D3EE'), S.rgb, -2); GK.drawImage(TMP, 0, 0);
    k.drawImage(GLC, 0, 0);
    for (const sl of S.sl) { k.fillStyle = C.navy; k.fillRect(0, sl.y, w, sl.h); k.drawImage(GLC, 0, sl.y, w, sl.h, sl.dx, sl.y, w, sl.h); }
    for (const b of S.bars) { k.fillStyle = [C.coral, '#22D3EE', C.yel][b.c]; k.fillRect(b.x, b.y, b.w, b.h); }
  };

  CELLS[23] = (k, w, h, u) => {
    const T = CYC / 2, n = Math.floor(u / T), lu = u - n * T;
    const floor = h - 30, SW = 250, SH = 100, tI = 0.62, tau = lu - tI;
    let y = lu < 0.3 ? -SH - 20 : lu < tI ? lerp(-SH - 20, floor - SH, eIn(P(lu, 0.3, tI))) : floor - SH;
    y -= 300 * backIn(P(lu, 1.85, 2.2), 1.6);
    let dx = 0, dy = 0, rot = 0;
    if (tau > 0 && tau < 1.1) { const e = Math.exp(-5 * tau), ph = 2 * Math.PI * 5 * tau; dx = 15 * e * Math.sin(ph); dy = 11 * e * Math.cos(ph * 1.3); rot = 0.02 * e * Math.sin(ph + 0.6); }
    k.fillStyle = C.navy; k.fillRect(0, 0, w, h);
    k.save(); k.translate(w / 2 + dx, h / 2 + dy); k.rotate(rot); k.translate(-w / 2, -h / 2);
    k.fillStyle = C.navy; k.fillRect(-40, -40, w + 80, h + 80);
    [[34, 62, 86, C.navy2, 0.06], [104, 46, 54, C.navy3, 0.03], [w - 150, 50, 66, C.navy3, 0.03], [w - 90, 62, 104, C.navy2, 0.06]].forEach(([x, bw, bh, col, dl]) => { const t = tau - dl, hop = t > 0 && t < 0.5 ? -24 * Math.sin(Math.PI * t / 0.5) * (1 - t) : 0; k.fillStyle = col; rr(k, x, floor - bh + hop, bw, bh, [10, 10, 0, 0]); k.fill(); k.fillStyle = C.blue; k.globalAlpha = 0.55; rr(k, x + 10, floor - bh + 12 + hop, bw - 20, 8, 4); k.fill(); k.globalAlpha = 1; });
    k.fillStyle = C.navy3; k.fillRect(-40, floor, w + 80, 5);
    if (tau > 0 && tau < 0.55) {
      const q = eOut(tau / 0.55); k.strokeStyle = '#fff'; k.lineCap = 'round'; k.lineWidth = 7 * (1 - q);
      for (let i = 0; i < 6; i++) { const s = i % 2 ? 1 : -1, j = Math.floor(i / 2), a = -0.12 - j * 0.34, r0 = 140 + 46 * q, r1 = r0 + 32; k.beginPath(); k.moveTo(w / 2 + s * Math.cos(a) * r0, floor - 4 + Math.sin(a) * r0); k.lineTo(w / 2 + s * Math.cos(a) * r1, floor - 4 + Math.sin(a) * r1); if (q < 0.97) k.stroke(); }
      k.fillStyle = C.dim; k.globalAlpha = 0.8 * (1 - q); for (let i = 0; i < 6; i++) { const s = i % 2 ? 1 : -1, d = 130 + q * (50 + i * 14); k.beginPath(); k.arc(w / 2 + s * d, floor - 8 - q * (6 + i * 4), 9 + q * 8 - i, 0, 7); k.fill(); } k.globalAlpha = 1;
    }
    const sq = tau > 0 && tau < 0.3 ? 1 - 0.22 * Math.sin(tau / 0.3 * Math.PI) : (lu < tI && lu > 0.3 ? 1.12 : 1);
    k.save(); k.translate(w / 2, y + SH); k.scale(2 - sq, sq);
    k.fillStyle = n ? C.coral : C.yel; rr(k, -SW / 2, -SH, SW, SH, 18); k.fill();
    k.fillStyle = 'rgba(15,26,61,.14)'; rr(k, -SW / 2, -16, SW, 16, [0, 0, 18, 18]); k.fill();
    txt(k, n ? 'SALE' : 'NEW!', 0, -SH / 2 + 4, `800 74px ${DISP}`, n ? '#fff' : C.navy, 'center', 'middle', '2px');
    k.restore();
    k.restore();
  };

  return { width: CW, height: CH, cycle: CYC, cells: CELLS, fonts: [] };
});

MotionPrompt.pack('lp', function () {
  const CW = 539, CH = 208;
  const CYC = 4.8;
  const C = {
    desk: '#E7EAF0', win: '#FFFFFF', bar: '#F3F5F8', rule: '#E2E6ED', ink: '#1C2333', sub: '#7D879B',
    faint: '#DCE1EA', soft: '#F3F5F9', skel: '#E4E8EF', acc: '#FF5A2C', accL: '#FFE5DB', blue: '#3B64E8', blueL: '#E1E8FF'
  };
  const JP = 'DMGothic,DMGothicFull,"PingFang SC",sans-serif';
  const EN = '"Avenir Next", "Helvetica Neue", system-ui, sans-serif';
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, x) => a + (b - a) * x;
  const P = (t, a, b) => clamp((t - a) / (b - a));
  const eIO = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const eIOs = x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  const eOut = x => 1 - Math.pow(1 - x, 3);
  const eIn = x => x * x * x;
  const mod = (a, n) => ((a % n) + n) % n;
  const eEl = x => x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x - 0.075) * 2 * Math.PI / 0.3) + 1;
  function rr(k, x, y, w, h, r) { k.beginPath(); k.roundRect(x, y, w, h, r); }
  function txt(k, s, x, y, font, col, align = 'left', base = 'alphabetic', ls = '0px') {
    k.font = font; k.fillStyle = col; k.textAlign = align; k.textBaseline = base; k.letterSpacing = ls; k.fillText(s, x, y); k.letterSpacing = '0px';
  }
  function steps(keys, u) {
    u = mod(u, CYC);
    if (u <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) if (u < keys[i][0]) { const [t0, a] = keys[i - 1], [t1, b] = keys[i]; return lerp(a, b, eIO((u - t0) / (t1 - t0))); }
    return keys[keys.length - 1][1];
  }
  function path(keys, u) {
    u = mod(u, CYC);
    if (u <= keys[0][0]) return [keys[0][1], keys[0][2]];
    for (let i = 1; i < keys.length; i++) if (u < keys[i][0]) { const a = keys[i - 1], b = keys[i], f = eIO((u - a[0]) / (b[0] - a[0])); return [lerp(a[1], b[1], f), lerp(a[2], b[2], f)]; }
    const l = keys[keys.length - 1]; return [l[1], l[2]];
  }
  function trans(on, u, dur, ease = eOut) {
    const s = on(u);
    for (let i = 0, t = u; i < 600; i++, t -= 1 / 120) if (on(t - 1 / 120) !== s) { const q = ease(P(u, t, t + dur)); return s ? q : 1 - q; }
    return s ? 1 : 0;
  }
  const WIN = { x: 14, y: 8, w: 511, h: 192, r: 10, bar: 24 };
  const VW = WIN.w, VH = WIN.h - WIN.bar;
  function frame(k, url = 'example.com') {
    k.fillStyle = C.desk; k.fillRect(0, 0, CW, CH);
    k.save(); k.shadowColor = 'rgba(28,35,51,.16)'; k.shadowBlur = 16; k.shadowOffsetY = 4;
    k.fillStyle = C.win; rr(k, WIN.x, WIN.y, WIN.w, WIN.h, WIN.r); k.fill(); k.restore();
    k.save(); rr(k, WIN.x, WIN.y, WIN.w, WIN.h, WIN.r); k.clip();
    k.fillStyle = C.bar; k.fillRect(WIN.x, WIN.y, WIN.w, WIN.bar); k.fillStyle = C.rule; k.fillRect(WIN.x, WIN.y + WIN.bar - 1, WIN.w, 1); k.restore();
    for (let i = 0; i < 3; i++) { k.fillStyle = '#CDD3DD'; k.beginPath(); k.arc(WIN.x + 15 + i * 12, WIN.y + 12, 3.6, 0, 7); k.fill(); }
    k.fillStyle = '#E6E9EF'; rr(k, WIN.x + WIN.w / 2 - 110, WIN.y + 5, 220, 14, 7); k.fill();
    txt(k, url, WIN.x + WIN.w / 2, WIN.y + 12.5, `500 9.5px ${EN}`, C.sub, 'center', 'middle');
  }
  function view(k, fn) {
    k.save(); rr(k, WIN.x, WIN.y + WIN.bar, VW, VH, [0, 0, WIN.r, WIN.r]); k.clip(); k.translate(WIN.x, WIN.y + WIN.bar);
    k.fillStyle = '#fff'; k.fillRect(0, 0, VW, VH); fn(); k.restore();
  }
  function sbar(k, pos, ratio = 0.42) { const th = (VH - 8) * ratio; k.fillStyle = 'rgba(28,35,51,.38)'; rr(k, VW - 9, 4 + (VH - 8 - th) * clamp(pos), 5, th, 2.5); k.fill(); }
  function bars(k, x, y, w, n, col = C.faint, hh = 6, gap = 11, last = 0.62) {
    k.fillStyle = col; for (let i = 0; i < n; i++) { rr(k, x, y + i * gap, i === n - 1 && n > 1 ? w * last : w, hh, hh / 2); k.fill(); }
  }
  const PICS = [
    { sky: ['#A9C0FF', '#E4EBFF'], sun: '#FF5A2C', sx: .74, sy: .32, m1: '#7D9AF4', m2: '#4B6BDB' },
    { sky: ['#FFC7B2', '#FFEDE5'], sun: '#FFFFFF', sx: .28, sy: .34, m1: '#F4977A', m2: '#DD5F3B' },
    { sky: ['#3A4884', '#7484CC'], sun: '#FFE5DB', sx: .6, sy: .3, m1: '#2B3770', m2: '#1C2349' }
  ];
  const M1 = [[0, .62], [.22, .4], [.42, .56], [.66, .3], [.86, .5], [1, .42]], M2 = [[0, .8], [.28, .6], [.5, .76], [.76, .58], [1, .74]];
  function mount(k, w, h, pts, col, flip) { k.fillStyle = col; k.beginPath(); k.moveTo(flip ? w : 0, h + 1); pts.forEach(([a, b]) => k.lineTo((flip ? 1 - a : a) * w, b * h)); k.lineTo(flip ? 0 : w, h + 1); k.closePath(); k.fill(); }
  function pic(k, x, y, w, h, v = 0, r = 6, z = 1) {
    const p = PICS[v % PICS.length];
    k.save(); rr(k, x, y, w, h, r); k.clip();
    k.translate(x + w / 2, y + h / 2); k.scale(z, z); k.translate(-w / 2, -h / 2);
    const g = k.createLinearGradient(0, 0, 0, h); g.addColorStop(0, p.sky[0]); g.addColorStop(1, p.sky[1]); k.fillStyle = g; k.fillRect(-1, -1, w + 2, h + 2);
    k.fillStyle = p.sun; k.beginPath(); k.arc(w * p.sx, h * p.sy, Math.min(w, h) * 0.13, 0, 7); k.fill();
    mount(k, w, h, M1, p.m1, v % 2); mount(k, w, h, M2, p.m2, (v + 1) % 2);
    k.restore();
  }
  function btn(k, x, y, w, h, label, col = C.acc, tcol = '#fff', fs = 12) {
    k.fillStyle = col; rr(k, x, y, w, h, h / 2); k.fill(); txt(k, label, x + w / 2, y + h / 2 + 0.5, `700 ${fs}px ${JP}`, tcol, 'center', 'middle');
  }
  function logo(k, x, y, col = C.ink) { k.fillStyle = C.acc; rr(k, x, y - 7, 14, 14, 4); k.fill(); txt(k, 'SAMPLE', x + 20, y + 0.5, `800 12px ${EN}`, col, 'left', 'middle', '1px'); }
  const NAVX = [300, 346, 392];
  function header(k, y, active = -1) {
    k.fillStyle = '#fff'; k.fillRect(0, y, VW, 34); k.fillStyle = C.rule; k.fillRect(0, y + 33, VW, 1);
    logo(k, 18, y + 17);
    ['特点', '价格', 'FAQ'].forEach((s, i) => txt(k, s, NAVX[i], y + 17.5, `600 12px ${JP}`, active === i ? C.acc : C.ink, 'left', 'middle'));
    btn(k, 428, y + 7, 70, 20, '免费试用', C.acc, '#fff', 10.5);
  }
  function cursor(k, x, y, press = 0) {
    const s = 1.2 * (1 - 0.12 * press);
    k.save(); k.translate(x, y); k.scale(s, s); k.beginPath();
    [[0, 0], [0, 16.5], [4.2, 12.6], [7, 19], [9.8, 17.8], [7.1, 11.6], [12.6, 11.6]].forEach(([a, b], i) => i ? k.lineTo(a, b) : k.moveTo(a, b));
    k.closePath(); k.lineJoin = 'round'; k.lineWidth = 1.6; k.strokeStyle = '#fff'; k.fillStyle = C.ink; k.fill(); k.stroke(); k.restore();
  }
  function click(k, x, y, u, times) {
    let press = 0;
    for (const tc of times) {
      const d = mod(u - tc + 0.1, CYC) - 0.1;
      if (d > -0.1 && d < 0.12) press = Math.max(press, 1 - Math.abs(d - 0.01) / 0.11);
      if (d >= 0 && d < 0.35) { const q = d / 0.35; k.strokeStyle = `rgba(28,35,51,${0.45 * (1 - q)})`; k.lineWidth = 2; k.beginPath(); k.arc(x, y, 5 + 13 * eOut(q), 0, 7); k.stroke(); }
    }
    cursor(k, x, y, clamp(press));
  }
  function spinner(k, x, y, r, u, col = C.acc) {
    const a = u / 0.8 * Math.PI * 2;
    k.lineCap = 'round'; k.lineWidth = r * 0.28; k.strokeStyle = C.faint; k.beginPath(); k.arc(x, y, r, 0, 7); k.stroke();
    k.strokeStyle = col; k.beginPath(); k.arc(x, y, r, a, a + Math.PI * 0.6); k.stroke(); k.lineCap = 'butt';
  }
  function enteredAt(sy, top, line, u) {
    const dt = 1 / 120, y = t => top - sy(t);
    if (y(u) >= VH) return null;
    for (let t = u; t > u - CYC; t -= dt) {
      const a = y(t), b = y(t - dt);
      if (a >= VH) return null;
      if (a < line && b >= line) return t - dt + dt * (b - line) / (b - a);
    }
    return y(u) < line ? -1e9 : null;
  }
  const CELLS = [];

  CELLS[0] = (k, w, h, u) => {
    frame(k);
    const s = steps([[0.3, 0], [1.9, 1], [2.9, 1], [4.3, 0]], u), y = s * 120;
    view(k, () => {
      const g = k.createLinearGradient(0, 0, 0, 200); g.addColorStop(0, '#9DB6FB'); g.addColorStop(1, '#E6ECFF');
      k.save(); k.translate(0, -y * 0.15);
      k.fillStyle = g; k.fillRect(0, 0, VW, 260); k.fillStyle = C.acc; k.beginPath(); k.arc(392, 54, 25, 0, 7); k.fill(); k.restore();
      k.save(); k.translate(0, -y * 0.4); mount(k, VW, 190, M1, '#7D9AF4', 0); k.restore();
      k.save(); k.translate(0, -y * 0.7); mount(k, VW, 205, M2, '#4B6BDB', 1); k.restore();
      k.save(); k.translate(0, -y);
      txt(k, '去山里走走。', 34, 64, `800 28px ${JP}`, '#fff', 'left', 'alphabetic', '1px');
      bars(k, 34, 78, 160, 2, 'rgba(255,255,255,.85)');
      btn(k, 34, 106, 92, 26, '预订');
      k.fillStyle = '#fff'; k.fillRect(0, VH, VW, 200);
      txt(k, '热门路线', 34, VH + 34, `800 16px ${JP}`, C.ink);
      for (let i = 0; i < 3; i++) { pic(k, 34 + i * 152, VH + 50, 136, 58, i, 6); bars(k, 34 + i * 152, VH + 116, 110, 1, C.faint); }
      k.restore();
      sbar(k, s * 0.35, 0.4);
    });
  };

  CELLS[1] = (k, w, h, u) => {
    frame(k);
    const SY = t => steps([[0.35, 0], [1.0, 95], [1.5, 95], [2.1, 200], [3.2, 200], [4.4, 0]], t), y = SY(u);
    const LINE = VH * 0.85, DUR = 0.7, RISE = 28;
    view(k, () => {
      k.save(); k.translate(0, -y);
      txt(k, '让生活轻一点。', 34, 52, `800 24px ${JP}`, C.ink); bars(k, 34, 68, 190, 3); btn(k, 34, 108, 96, 26, '了解更多');
      pic(k, 286, 18, 196, 110, 0, 8);
      const items = [
        [172, () => txt(k, '选择我们的三个理由', VW / 2, 172 + 20, `800 18px ${JP}`, C.ink, 'center')],
        [206, () => { for (let i = 0; i < 3; i++) { const x = 34 + i * 152; k.fillStyle = C.soft; rr(k, x, 206, 136, 106, 8); k.fill(); pic(k, x + 8, 214, 120, 56, i, 5); bars(k, x + 10, 280, 112, 2, '#CBD2DE'); } }],
        [334, () => bars(k, 110, 334, 290, 3, C.faint, 7, 13)]
      ];
      for (const [top, draw] of items) {
        const t0 = enteredAt(SY, top, LINE, u); if (t0 === null) continue;
        const q = eOut(P(u, t0, t0 + DUR));
        k.save(); k.globalAlpha = q; k.translate(0, RISE * (1 - q)); draw(); k.restore();
      }
      k.restore();
      sbar(k, y / 200, 0.5);
    });
  };

  CELLS[2] = (k, w, h, u) => {
    frame(k);
    const y = steps([[0.4, 0], [1.3, 110], [1.9, 110], [2.8, 250], [3.4, 250], [4.4, 0]], u);
    const STRIP = 22;
    view(k, () => {
      k.save(); k.translate(0, -y);
      pic(k, 24, 70, 214, 112, 0, 8);
      txt(k, '开始新的每一天，', 262, 104, `800 22px ${JP}`, C.ink); bars(k, 262, 120, 210, 3); btn(k, 262, 160, 100, 26, '了解更多');
      k.fillStyle = C.soft; k.fillRect(0, 212, VW, 240);
      txt(k, '特点', VW / 2, 246, `800 18px ${JP}`, C.ink, 'center');
      for (let i = 0; i < 3; i++) { const x = 34 + i * 152; k.fillStyle = '#fff'; rr(k, x, 262, 136, 120, 8); k.fill(); pic(k, x + 8, 270, 120, 58, i, 5); bars(k, x + 10, 340, 110, 3, C.faint, 6, 11); }
      k.fillStyle = C.ink; k.fillRect(0, 0, VW, STRIP);
      txt(k, '限时活动进行中', VW / 2, STRIP / 2 + 0.5, `600 11px ${JP}`, '#fff', 'center', 'middle');
      k.restore();
      const hy = Math.max(STRIP - y, 0), sh = clamp((y - STRIP) / 24);
      if (sh > 0) { const g = k.createLinearGradient(0, hy + 34, 0, hy + 46); g.addColorStop(0, `rgba(28,35,51,${0.16 * sh})`); g.addColorStop(1, 'rgba(28,35,51,0)'); k.fillStyle = g; k.fillRect(0, hy + 34, VW, 12); }
      header(k, hy);
      sbar(k, y / 250, 0.42);
    });
  };

  CELLS[3] = (k, w, h, u) => {
    frame(k);
    const y = steps([[0.3, 0], [3.0, 500], [3.5, 500], [4.5, 0]], u);
    const PIN0 = 110, PD = 300;
    const top = y < PIN0 ? PIN0 - y : y < PIN0 + PD ? 0 : PIN0 + PD - y, p = clamp((y - PIN0) / PD);
    const f = eIO(P(p, 1 / 3 - 0.07, 1 / 3 + 0.07)) + eIO(P(p, 2 / 3 - 0.07, 2 / 3 + 0.07));
    view(k, () => {
      txt(k, '三步完成', 34, 56 - y, `800 22px ${JP}`, C.ink); bars(k, 34, 72 - y, 240, 2);
      k.save(); k.translate(0, top);
      k.fillStyle = C.ink; k.fillRect(0, 0, VW, VH);
      txt(k, 'STEP', 34, 40, `700 12px ${EN}`, 'rgba(255,255,255,.6)', 'left', 'alphabetic', '2px');
      k.save(); k.beginPath(); k.rect(30, 46, 120, 52); k.clip();
      for (let i = 0; i < 3; i++) txt(k, '0' + (i + 1), 32, 90 + (i - f) * 52, `800 46px ${EN}`, '#fff');
      k.restore();
      bars(k, 34, 110, 150, 3, 'rgba(255,255,255,.28)');
      k.fillStyle = 'rgba(255,255,255,.16)'; rr(k, 232, 22, 4, 124, 2); k.fill();
      k.fillStyle = C.acc; rr(k, 232, 22, 4, 124 * p, 2); k.fill();
      k.save(); rr(k, 256, 22, 226, 124, 8); k.clip();
      for (let i = 0; i < 3; i++) pic(k, 256, 22 + (i - f) * 124, 226, 124, i, 0);
      k.restore();
      k.fillStyle = '#fff'; k.fillRect(0, VH, VW, 200); bars(k, 34, VH + 30, 300, 3);
      k.restore();
      sbar(k, y / 500, 0.3);
    });
  };

  CELLS[4] = (k, w, h, u) => {
    frame(k);
    const y = steps([[0.3, 0], [3.0, 420], [3.5, 420], [4.5, 0]], u);
    const PIN0 = 40, PD = 380, N = 4, PWD = 200, GAP = 20;
    const top = y < PIN0 ? PIN0 - y : 0, p = clamp((y - PIN0) / PD);
    const travel = 34 * 2 + N * PWD + (N - 1) * GAP - VW;
    view(k, () => {
      txt(k, 'WORKS', 34, 30 - y, `800 20px ${EN}`, C.ink, 'left', 'alphabetic', '2px');
      k.save(); k.translate(0, top);
      k.fillStyle = C.soft; k.fillRect(0, 0, VW, VH + 40);
      for (let i = 0; i < N; i++) {
        const x = 34 + i * (PWD + GAP) - p * travel;
        pic(k, x, 18, PWD, 112, i % 3, 8);
        txt(k, '0' + (i + 1), x + 14, 118, `800 22px ${EN}`, '#fff');
        bars(k, x, 140, 120, 1, '#CBD2DE');
      }
      k.restore();
      sbar(k, y / 420, 0.36);
    });
  };

  CELLS[5] = (k, w, h, u) => {
    frame(k);
    const T = CYC / 2, lu = mod(u, T), dir = u < T ? 1 : -1, from = u < T ? 0 : VH, DRIFT = 34;
    const y = from + dir * (DRIFT * eOut(P(lu, 0.45, 0.85)) + (VH - DRIFT) * eOut(P(lu, 0.9, 1.5)));
    view(k, () => {
      k.save(); k.translate(0, -y);
      for (let i = 0; i < 2; i++) {
        const y0 = i * VH, dark = i === 1;
        k.fillStyle = dark ? C.ink : C.blueL; k.fillRect(0, y0, VW, VH);
        txt(k, '0' + (i + 1), 34, y0 + 70, `800 46px ${EN}`, C.acc);
        txt(k, dark ? '试一试' : '让更多人知道', 34, y0 + 102, `800 18px ${JP}`, dark ? '#fff' : C.ink);
        bars(k, 34, y0 + 118, 170, 2, dark ? 'rgba(255,255,255,.3)' : '#C3CDEA');
        pic(k, 262, y0 + 24, 220, 120, dark ? 2 : 0, 8);
      }
      k.restore();
      sbar(k, y / VH, 0.5);
    });
  };

  CELLS[6] = (k, w, h, u) => {
    frame(k);
    const MAX = 430;
    const y = steps([[0.3, 0], [0.75, 110], [1.15, 110], [1.6, 220], [2.0, 220], [2.45, 330], [2.85, 330], [3.3, MAX], [3.75, MAX], [4.55, 0]], u);
    view(k, () => {
      k.save(); k.translate(0, -y);
      txt(k, '第一次做网页设计', 70, 44, `800 20px ${JP}`, C.ink); bars(k, 70, 56, 120, 1, C.faint, 5);
      pic(k, 70, 74, 371, 112, 0, 8);
      for (let b = 0; b < 4; b++) { const y0 = 204 + b * 82; k.fillStyle = C.ink; rr(k, 70, y0, 140, 9, 4.5); k.fill(); bars(k, 70, y0 + 22, 371, 4, C.faint, 6, 12); }
      k.restore();
      k.fillStyle = C.faint; k.fillRect(0, 0, VW, 6);
      k.fillStyle = C.acc; k.fillRect(0, 0, VW * (y / MAX), 6);
      sbar(k, y / MAX, 0.3);
    });
  };

  CELLS[7] = (k, w, h, u) => {
    frame(k);
    const SY = t => steps([[0.35, 0], [1.0, 90], [1.6, 90], [2.2, 180], [3.3, 180], [4.4, 0]], t), y = SY(u);
    const LINE = VH * 0.8, DUR = 0.8, MARK = '#FFE36B', F = `800 20px ${JP}`;
    const rows = [[190, ['每天的饭菜', '只要十分钟', '就能做好。']], [290, ['新手也能', '不会失败的菜谱', '就够了。']]];
    view(k, () => {
      k.save(); k.translate(0, -y);
      txt(k, '给忙碌的人', 70, 50, `700 14px ${JP}`, C.sub); txt(k, '厨房的新搭档', 70, 80, `800 24px ${JP}`, C.ink);
      bars(k, 70, 96, 330, 4, C.faint, 6, 12, 0.8);
      for (const [base, parts] of rows) {
        k.font = F; const ws = parts.map(s => k.measureText(s).width); let x = (VW - ws.reduce((a, b) => a + b, 0)) / 2;
        const t0 = enteredAt(SY, base - 20, LINE, u), q = t0 === null ? 0 : eOut(P(u, t0, t0 + DUR));
        if (q > 0) { k.fillStyle = MARK; k.fillRect(x + ws[0], base - 8, ws[1] * q, 11); }
        parts.forEach((s, i) => { txt(k, s, x, base, F, i === 1 ? C.ink : '#4A5368'); x += ws[i]; });
        bars(k, 110, base + 22, 291, 2, C.faint, 6, 12, 0.7);
      }
      k.restore();
      sbar(k, y / 180, 0.5);
    });
  };

  CELLS[8] = (k, w, h, u) => {
    frame(k);
    const CX = [26, 192, 358], CY = 18, CWD = 146, CHT = 128, LIFT = 10;
    const cur = t => path([[0, 70, 160], [0.45, 96, 78], [1.4, 110, 86], [1.62, 262, 80], [2.5, 276, 88], [2.72, 428, 80], [3.6, 440, 88], [4.0, 470, 160], [4.8, 70, 160]], t);
    view(k, () => {
      k.fillStyle = C.soft; k.fillRect(0, 0, VW, VH);
      for (let i = 0; i < 3; i++) {
        const inside = t => { const [x, y] = cur(t); return x > CX[i] && x < CX[i] + CWD && y > CY && y < CY + CHT; };
        const q = trans(inside, u, 0.3), x = CX[i], y = CY - LIFT * q;
        k.save(); k.shadowColor = `rgba(28,35,51,${0.08 + 0.14 * q})`; k.shadowBlur = 6 + 16 * q; k.shadowOffsetY = 2 + 10 * q;
        k.fillStyle = '#fff'; rr(k, x, y, CWD, CHT, 10); k.fill(); k.restore();
        pic(k, x + 8, y + 8, CWD - 16, 66, i, 6);
        txt(k, ['山间民宿', '海边民宿', '观星民宿'][i], x + 12, y + 96, `800 13px ${JP}`, C.ink); bars(k, x + 12, y + 106, 100, 1);
      }
      const [cx, cy] = cur(u); cursor(k, cx, cy);
    });
  };

  CELLS[9] = (k, w, h, u) => {
    frame(k);
    const FX = [22, 267], FY = 16, FW = 222, FH = 118, ZOOM = 0.15;
    const cur = t => path([[0, 60, 160], [0.5, 120, 70], [1.8, 140, 84], [2.2, 370, 70], [3.4, 390, 84], [3.9, 470, 160], [4.8, 60, 160]], t);
    view(k, () => {
      for (let i = 0; i < 2; i++) {
        const inside = t => { const [x, y] = cur(t); return x > FX[i] && x < FX[i] + FW && y > FY && y < FY + FH; };
        const q = trans(inside, u, 0.5);
        pic(k, FX[i], FY, FW, FH, i, 8, 1 + ZOOM * q);
        txt(k, ['夏日山屋', '海边咖啡馆'][i], FX[i], FY + FH + 20, `800 13px ${JP}`, C.ink); bars(k, FX[i], FY + FH + 28, 150, 1);
      }
      const [cx, cy] = cur(u); cursor(k, cx, cy);
    });
  };

  CELLS[10] = (k, w, h, u) => {
    frame(k);
    const cur = t => [255 + 175 * Math.sin(2 * Math.PI * t / CYC), 86 + 46 * Math.sin(4 * Math.PI * t / CYC)];
    let t = u - 2, [fx, fy] = cur(t);
    for (let i = 0; i < 120; i++) { t += 1 / 60; const [tx, ty] = cur(t); fx += (tx - fx) * 0.12; fy += (ty - fy) * 0.12; }
    view(k, () => {
      txt(k, 'CREATIVE STUDIO', VW / 2, 74, `800 34px ${EN}`, C.ink, 'center', 'alphabetic', '3px');
      bars(k, VW / 2 - 120, 96, 240, 2, C.faint, 6, 12, 0.7);
      btn(k, VW / 2 - 50, 128, 100, 24, '查看作品', C.ink);
      k.fillStyle = C.acc; k.globalAlpha = 0.88; k.beginPath(); k.arc(fx, fy, 17, 0, 7); k.fill(); k.globalAlpha = 1;
      const [cx, cy] = cur(u); cursor(k, cx, cy);
    });
  };

  CELLS[11] = (k, w, h, u) => {
    frame(k);
    const BX = VW / 2, BY = 84, R = 110, PULL = 0.35;
    const cur = t => path([[0, -20, 130], [0.9, 170, 104], [1.5, 300, 62], [2.1, 318, 110], [2.7, 205, 66], [3.1, 250, 92], [3.6, 545, 120], [4.8, 545, 120]], t);
    const inside = t => { const [x, y] = cur(t); return Math.hypot(x - BX, y - BY) < R; };
    const pull = t => {
      let t0 = t; for (let i = 0; i < 600 && inside(t0 - 1 / 120); i++) t0 -= 1 / 120;
      let ox = 0, oy = 0; for (let s = t0; s <= t; s += 1 / 60) { const [x, y] = cur(s); ox += ((x - BX) * PULL - ox) * 0.18; oy += ((y - BY) * PULL - oy) * 0.18; }
      return [ox, oy];
    };
    let ox = 0, oy = 0;
    if (inside(u)) [ox, oy] = pull(u);
    else {
      let t1 = u; for (let i = 0; i < 600 && !inside(t1); i++) t1 -= 1 / 120;
      if (inside(t1)) { const [lx, ly] = pull(t1), e = 1 - eEl(P(u, t1, t1 + 1.1)); ox = lx * e; oy = ly * e; }
    }
    view(k, () => {
      k.fillStyle = C.soft; k.fillRect(0, 0, VW, VH);
      k.save(); k.translate(BX + ox, BY + oy);
      k.shadowColor = 'rgba(255,90,44,.35)'; k.shadowBlur = 16; k.shadowOffsetY = 6;
      k.fillStyle = C.acc; rr(k, -84, -26, 168, 52, 26); k.fill(); k.shadowColor = 'transparent';
      txt(k, '联系我们', 0, 1, `800 16px ${JP}`, '#fff', 'center', 'middle');
      k.restore();
      const [cx, cy] = cur(u); cursor(k, cx, cy);
    });
  };

  CELLS[12] = (k, w, h, u) => {
    frame(k);
    const B = { x: 115, y: 78, w: 280, h: 56 }, TAPS = [[0.7, 165, 110], [2.9, 345, 100]], DUR = 0.6;
    const [cx, cy] = path([[0, 430, 160], [0.55, 165, 110], [1.6, 165, 110], [2.7, 345, 100], [3.6, 345, 100], [4.4, 430, 160], [4.8, 430, 160]], u);
    view(k, () => {
      k.fillStyle = C.soft; k.fillRect(0, 0, VW, VH);
      txt(k, '报名', VW / 2, 38, `800 18px ${JP}`, C.ink, 'center'); bars(k, VW / 2 - 110, 50, 220, 1, C.faint, 6, 11, 1);
      k.save(); k.shadowColor = 'rgba(28,35,51,.18)'; k.shadowBlur = 8; k.shadowOffsetY = 3; k.fillStyle = C.acc; rr(k, B.x, B.y, B.w, B.h, 10); k.fill(); k.restore();
      k.save(); rr(k, B.x, B.y, B.w, B.h, 10); k.clip();
      for (const [tc, px, py] of TAPS) {
        const d = u - tc; if (d < 0 || d > 0.8) continue;
        const Rm = Math.max(Math.hypot(px - B.x, py - B.y), Math.hypot(px - B.x - B.w, py - B.y), Math.hypot(px - B.x, py - B.y - B.h), Math.hypot(px - B.x - B.w, py - B.y - B.h));
        k.fillStyle = `rgba(255,255,255,${0.4 * (1 - P(d, 0.3, 0.8))})`; k.beginPath(); k.arc(px, py, Rm * eOut(P(d, 0, DUR)), 0, 7); k.fill();
      }
      k.restore();
      txt(k, '提交', VW / 2, B.y + B.h / 2 + 1, `800 17px ${JP}`, '#fff', 'center', 'middle');
      click(k, cx, cy, u, TAPS.map(a => a[0]));
    });
  };

  CELLS[13] = (k, w, h, u) => {
    frame(k);
    const LINKS = ['服务', '案例', '公司简介'], F = `800 20px ${JP}`, GAP = 56, LY = 84, DUR = 0.3;
    const cur = t => path([[0, 120, 150], [0.45, 170, 80], [1.3, 186, 84], [1.55, 268, 80], [2.4, 282, 84], [2.65, 372, 80], [3.5, 390, 84], [3.95, 430, 150], [4.8, 120, 150]], t);
    view(k, () => {
      logo(k, 22, 28); bars(k, 90, 132, 331, 2, C.faint, 6, 12, 0.6);
      k.font = F; const ws = LINKS.map(s => k.measureText(s).width); let x = (VW - ws.reduce((a, b) => a + b, 0) - GAP * (LINKS.length - 1)) / 2;
      LINKS.forEach((s, i) => {
        const x0 = x, x1 = x + ws[i], inside = t => { const [a, b] = cur(t); return a > x0 - 6 && a < x1 + 6 && b > LY - 22 && b < LY + 14; };
        txt(k, s, x0, LY, F, C.ink);
        const on = inside(u); let tc = null; for (let j = 0, t = u; j < 600; j++, t -= 1 / 120) if (inside(t - 1 / 120) !== on) { tc = t; break; }
        if (tc !== null) {
          const q = eOut(P(u, tc, tc + DUR)), a = on ? 0 : q, b = on ? q : 1;
          if (b > a) { k.fillStyle = C.acc; k.fillRect(x0 + ws[i] * a, LY + 8, ws[i] * (b - a), 3); }
        }
        x += ws[i] + GAP;
      });
      const [cx, cy] = cur(u); cursor(k, cx, cy);
    });
  };

  CELLS[14] = (k, w, h, u) => {
    frame(k);
    const F = { x: 76, y: 14, w: 359, h: 140 };
    const pos = steps([[0.75, 0.5], [1.55, 0.2], [2.65, 0.82], [3.55, 0.5]], u), hx = F.x + F.w * pos, hy = F.y + F.h / 2;
    const drag = u > 0.68 && u < 3.62;
    const [cx, cy] = u < 0.7 ? path([[0, 430, 160], [0.62, hx, hy + 4]], u) : drag ? [hx, hy + 4] : path([[3.6, hx, hy + 4], [4.3, 430, 160], [4.8, 430, 160]], u);
    view(k, () => {
      k.fillStyle = C.soft; k.fillRect(0, 0, VW, VH);
      pic(k, F.x, F.y, F.w, F.h, 1, 10);
      k.save(); k.beginPath(); k.rect(F.x, F.y, hx - F.x, F.h); k.clip();
      pic(k, F.x, F.y, F.w, F.h, 1, 10);
      k.globalCompositeOperation = 'saturation'; k.fillStyle = '#888'; k.fillRect(F.x, F.y, F.w, F.h);
      k.globalCompositeOperation = 'source-over'; k.fillStyle = 'rgba(28,35,51,.18)'; k.fillRect(F.x, F.y, F.w, F.h);
      k.restore();
      const tag = (s, x, al) => { k.font = `800 11px ${EN}`; const tw = k.measureText(s).width + 16; const bx = al ? x - tw : x; k.fillStyle = 'rgba(28,35,51,.55)'; rr(k, bx, F.y + 10, tw, 20, 10); k.fill(); txt(k, s, bx + tw / 2, F.y + 20.5, `800 11px ${EN}`, '#fff', 'center', 'middle', '1px'); };
      k.save(); rr(k, F.x, F.y, F.w, F.h, 10); k.clip(); tag('BEFORE', F.x + 10, false); tag('AFTER', F.x + F.w - 10, true); k.restore();
      k.fillStyle = '#fff'; k.fillRect(hx - 1.5, F.y, 3, F.h);
      k.save(); k.shadowColor = 'rgba(28,35,51,.3)'; k.shadowBlur = 8; k.shadowOffsetY = 2; k.fillStyle = '#fff'; k.beginPath(); k.arc(hx, hy, 17, 0, 7); k.fill(); k.restore();
      k.fillStyle = C.ink; k.beginPath(); k.moveTo(hx - 4, hy - 6); k.lineTo(hx - 11, hy); k.lineTo(hx - 4, hy + 6); k.closePath(); k.moveTo(hx + 4, hy - 6); k.lineTo(hx + 11, hy); k.lineTo(hx + 4, hy + 6); k.closePath(); k.fill();
      cursor(k, cx, cy, drag ? 1 : 0);
    });
  };

  CELLS[15] = (k, w, h, u) => {
    frame(k);
    const OX = WIN.x, OY = WIN.y + WIN.bar;
    const [cx, cy] = path([[0, 440, 150], [0.7, 300, 120], [1.25, 360, -18], [1.9, 372, -20], [2.6, 366, 38], [3.3, 366, 38], [4.4, 440, 150], [4.8, 440, 150]], u);
    const CLOSE = 2.9;
    let TRIG = 0.7; while (TRIG < 1.3 && path([[0.7, 300, 120], [1.25, 360, -18]], TRIG)[1] >= 0) TRIG += 1 / 240;
    const m = eOut(P(u, TRIG + 0.05, TRIG + 0.45)) * (1 - P(u, CLOSE + 0.03, CLOSE + 0.25));
    const D = { x: 125.5, y: 18, w: 260, h: 132 };
    view(k, () => {
      header(k, 0);
      pic(k, 24, 46, 222, 110, 0, 8); txt(k, '新手指南', 264, 82, `800 19px ${JP}`, C.ink); bars(k, 264, 96, 210, 3); btn(k, 264, 132, 100, 24, '报名');
      if (m > 0) {
        k.fillStyle = `rgba(28,35,51,${0.5 * m})`; k.fillRect(0, 0, VW, VH);
        k.save(); k.globalAlpha = m; k.translate(D.x + D.w / 2, D.y + D.h / 2); const s = 0.9 + 0.1 * m; k.scale(s, s); k.translate(-D.w / 2, -D.h / 2);
        k.fillStyle = '#fff'; rr(k, 0, 0, D.w, D.h, 12); k.fill();
        txt(k, '等一下！', D.w / 2, 34, `800 17px ${JP}`, C.ink, 'center');
        txt(k, '现在首单 9 折', D.w / 2, 60, `800 15px ${JP}`, C.acc, 'center');
        btn(k, D.w / 2 - 75, 80, 150, 30, '领取优惠券', C.acc, '#fff', 12);
        k.strokeStyle = C.sub; k.lineWidth = 2; k.lineCap = 'round'; k.beginPath(); k.moveTo(D.w - 26, 14); k.lineTo(D.w - 14, 26); k.moveTo(D.w - 14, 14); k.lineTo(D.w - 26, 26); k.stroke();
        k.restore();
      }
    });
    k.save(); k.beginPath(); k.rect(0, 0, CW, CH); k.clip(); k.translate(OX, OY); click(k, cx, cy, u, [CLOSE]); k.restore();
  };

  CELLS[16] = (k, w, h, u) => {
    frame(k);
    const n = Math.round(100 * eOut(P(u, 0.25, 2.1)));
    const cy = u < 4.25 ? -VH * eIO(P(u, 2.3, 2.85)) : -VH * (1 - eIO(P(u, 4.25, 4.75)));
    const show = eOut(P(u, 2.35, 2.95));
    view(k, () => {
      header(k, 0);
      k.save(); k.globalAlpha = show; k.translate(0, 14 * (1 - show));
      txt(k, '欢迎。', 34, 82, `800 26px ${JP}`, C.ink); bars(k, 34, 98, 200, 3); btn(k, 34, 136, 96, 24, '开始');
      pic(k, 270, 46, 214, 112, 0, 8); k.restore();
      if (cy > -VH) {
        k.save(); k.translate(0, cy); k.fillStyle = C.ink; k.fillRect(0, 0, VW, VH);
        logo(k, VW / 2 - 40, 56, '#fff');
        txt(k, (u >= 4.25 ? 0 : n) + '%', VW / 2, 98, `800 28px ${EN}`, '#fff', 'center', 'middle');
        k.fillStyle = 'rgba(255,255,255,.15)'; rr(k, VW / 2 - 90, 122, 180, 4, 2); k.fill();
        k.fillStyle = C.acc; rr(k, VW / 2 - 90, 122, 180 * (u >= 4.25 ? 0 : n / 100), 4, 2); k.fill();
        k.restore();
      }
    });
  };

  CELLS[17] = (k, w, h, u) => {
    frame(k);
    const SY = t => steps([[0.35, 0], [1.1, 110], [1.7, 110], [2.5, 225], [3.5, 225], [4.5, 0]], t), y = SY(u);
    const COLX = [15, 180, 345], IW = 151, IH = 92, ROWS = [12, 168, 276], WAIT = 0.45, FADE = 0.35;
    view(k, () => {
      k.save(); k.translate(0, -y);
      txt(k, '作品集', 15, 140, `800 18px ${JP}`, C.ink); bars(k, 120, 128, 200, 1);
      ROWS.forEach((top, r) => COLX.forEach((x, c) => {
        const t0 = r === 0 ? -1e9 : enteredAt(SY, top, VH, u), age = t0 === null ? -1 : u - t0 - c * 0.12;
        k.fillStyle = C.skel; rr(k, x, top, IW, IH, 6); k.fill();
        if (age < WAIT + FADE) {
          k.save(); k.translate(x + IW / 2, top + IH / 2); k.strokeStyle = '#B9C1CF'; k.lineWidth = 2; k.lineJoin = 'round';
          if (age >= 0 && age < WAIT) spinner(k, 0, 0, 11, u, C.blue);
          else { rr(k, -15, -11, 30, 22, 3); k.stroke(); k.beginPath(); k.moveTo(-11, 7); k.lineTo(-3, -1); k.lineTo(3, 5); k.lineTo(7, 1); k.lineTo(11, 6); k.stroke(); }
          k.restore();
        }
        if (age >= WAIT) { k.save(); k.globalAlpha = eOut(P(age, WAIT, WAIT + FADE)); pic(k, x, top, IW, IH, (r + c) % 3, 6); k.restore(); }
      }));
      k.restore();
      sbar(k, y / 225, 0.45);
    });
  };

  CELLS[18] = (k, w, h, u) => {
    frame(k);
    const PITCH = 52, BATCH = 3, L0 = 6, TL = 2.6;
    const y = steps([[0.25, 38], [0.85, 116], [1.15, 116], [1.75, 194], [4.8, 194]], u);
    const n = u < TL ? L0 : L0 + BATCH, end = 10 + n * PITCH;
    view(k, () => {
      k.fillStyle = C.soft; k.fillRect(0, 0, VW, VH);
      k.save(); k.translate(0, -y);
      for (let i = 0; i < n; i++) {
        const top = 10 + i * PITCH, v = i % 3, fresh = i >= L0 ? eOut(P(u, TL, TL + 0.35)) : 1;
        if (top - y > VH || top + 44 - y < 0) continue;
        k.save(); k.globalAlpha = fresh; k.translate(0, 10 * (1 - fresh));
        k.fillStyle = '#fff'; rr(k, 90, top, 331, 44, 8); k.fill(); pic(k, 98, top + 6, 48, 32, v, 5);
        bars(k, 158, top + 12, [180, 140, 200][v], 1, C.ink, 7); bars(k, 158, top + 26, [120, 150, 100][v], 1, C.faint, 6);
        k.restore();
      }
      spinner(k, VW / 2, end + 18, 10, u);
      k.restore();
    });
  };

  CELLS[19] = (k, w, h, u) => {
    frame(k, u >= 1.3 && u < 3.5 ? 'example.com/works/02' : 'example.com/works');
    const CLK = [0.8, 3.0];
    const cover = t0 => eIO(P(u, t0, t0 + 0.4)), uncover = t0 => eIO(P(u, t0, t0 + 0.45));
    const xs = u < 1.4 ? -VW * (1 - cover(0.9)) : u < 3.1 ? VW * uncover(1.4) : u < 3.6 ? -VW * (1 - cover(3.1)) : VW * uncover(3.6);
    const pageB = u >= 1.3 && u < 3.5;
    const [cx, cy] = path([[0, 420, 150], [0.65, 255, 100], [2.6, 255, 100], [2.85, 46, 50], [3.3, 46, 50], [4.6, 420, 150], [4.8, 420, 150]], u);
    view(k, () => {
      header(k, 0);
      if (!pageB) {
        txt(k, 'WORKS', 34, 62, `800 18px ${EN}`, C.ink, 'left', 'alphabetic', '2px');
        for (let i = 0; i < 3; i++) { const x = 34 + i * 152; pic(k, x, 74, 136, 60, i, 6); bars(k, x, 142, 100, 1, C.ink, 7); }
      } else {
        txt(k, '← 返回列表', 34, 55, `700 12px ${JP}`, C.sub, 'left', 'middle');
        pic(k, 34, 68, 240, 90, 1, 8);
        txt(k, 'Project 02', 296, 96, `800 22px ${EN}`, C.ink); bars(k, 296, 110, 180, 3);
      }
      if (xs > -VW && xs < VW) { k.fillStyle = C.acc; k.fillRect(xs, 0, VW, VH); logo(k, xs + VW / 2 - 40, VH / 2, '#fff'); }
      click(k, cx, cy, u, CLK);
    });
  };

  CELLS[20] = (k, w, h, u) => {
    frame(k);
    const TO = 296;
    const y = TO * eIO(P(u, 0.95, 2.0)) * (1 - eIO(P(u, 3.15, 4.2)));
    const [cx, cy] = path([[0, 380, 132], [0.75, 360, 18], [1.0, 360, 18], [2.9, 478, 140], [3.25, 478, 140], [4.8, 380, 132]], u);
    view(k, () => {
      k.save(); k.translate(0, -y);
      pic(k, 24, 46, 222, 110, 0, 8); txt(k, '刚刚好的工具。', 264, 84, `800 19px ${JP}`, C.ink); bars(k, 264, 98, 210, 3);
      k.fillStyle = C.soft; k.fillRect(0, 170, VW, 160);
      txt(k, '特点', VW / 2, 206, `800 17px ${JP}`, C.ink, 'center');
      for (let i = 0; i < 3; i++) { const x = 100 + i * 155; k.fillStyle = C.blueL; k.beginPath(); k.arc(x, 252, 24, 0, 7); k.fill(); bars(k, x - 46, 288, 92, 2); }
      txt(k, '价格', VW / 2, 370, `800 17px ${JP}`, C.ink, 'center');
      ['¥0', '¥980', '¥2,980'].forEach((s, i) => {
        const x = 50 + i * 143, hi = i === 1; k.fillStyle = '#fff'; rr(k, x, 388, 125, 96, 8); k.fill();
        k.lineWidth = hi ? 2.5 : 1.5; k.strokeStyle = hi ? C.acc : C.faint; k.stroke();
        txt(k, s, x + 62.5, 428, `800 20px ${EN}`, hi ? C.acc : C.ink, 'center'); bars(k, x + 22, 444, 81, 2);
      });
      k.restore();
      header(k, 0, y > 250 ? 1 : -1);
      const tb = clamp((y - 60) / 40);
      if (tb > 0) { k.globalAlpha = tb; k.fillStyle = C.ink; k.beginPath(); k.arc(478, 140, 15, 0, 7); k.fill(); k.strokeStyle = '#fff'; k.lineWidth = 2.4; k.lineCap = 'round'; k.lineJoin = 'round'; k.beginPath(); k.moveTo(472, 143); k.lineTo(478, 136.5); k.lineTo(484, 143); k.stroke(); k.globalAlpha = 1; }
      sbar(k, y / TO * 0.7, 0.36);
      click(k, cx, cy, u, [0.9, 3.1]);
    });
  };

  CELLS[21] = (k, w, h, u) => {
    frame(k);
    const WORDS = ['WEB DESIGN', 'BRANDING', 'MOTION', 'UI/UX'], F = `800 30px ${EN}`, GAPW = 64;
    view(k, () => {
      bars(k, 34, 20, 180, 1, C.ink, 10); bars(k, 34, 38, 300, 1);
      k.fillStyle = C.ink; k.fillRect(0, 58, VW, 58);
      k.font = F; k.letterSpacing = '1px'; const ws = WORDS.map(s => k.measureText(s).width); k.letterSpacing = '0px';
      const unit = ws.reduce((a, b) => a + b + GAPW, 0);
      let x = -mod(u / CYC, 1) * unit;
      for (let rep = 0; x < VW; rep++) WORDS.forEach((s, i) => {
        txt(k, s, x, 88, F, '#fff', 'left', 'middle', '1px');
        k.fillStyle = C.acc; k.beginPath(); k.arc(x + ws[i] + GAPW / 2, 88, 6, 0, 7); k.fill();
        x += ws[i] + GAPW;
      });
      for (let i = 0; i < 3; i++) { k.fillStyle = C.soft; rr(k, 34 + i * 152, 130, 136, 30, 6); k.fill(); bars(k, 46 + i * 152, 142, 90, 1, C.faint); }
    });
  };

  CELLS[22] = (k, w, h, u) => {
    frame(k);
    const a = 2 * Math.PI * u / CYC;
    const BLOBS = [[C.acc, 150, 60, 230, 70, 30, 0], ['#FFB08F', 380, 40, 210, 60, 40, 2.1], [C.blue, 330, 150, 240, 80, 30, 4.2], ['#9DB6FB', 90, 170, 200, 50, 35, 1.0]];
    view(k, () => {
      k.fillStyle = '#FFF1EB'; k.fillRect(0, 0, VW, VH);
      for (const [col, x0, y0, r, ax, ay, ph] of BLOBS) {
        const x = x0 + ax * Math.cos(a + ph), y = y0 + ay * Math.sin(a + ph);
        const g = k.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,255,255,0)');
        k.globalAlpha = 0.85; k.fillStyle = g; k.fillRect(0, 0, VW, VH); k.globalAlpha = 1;
      }
      txt(k, 'Hello, Future.', 40, 82, `800 34px ${EN}`, '#fff', 'left', 'alphabetic', '1px');
      bars(k, 40, 100, 200, 2, 'rgba(255,255,255,.8)', 6, 12, 0.6);
      btn(k, 40, 128, 104, 26, '开始', '#fff', C.ink);
    });
  };

  CELLS[23] = (k, w, h, u) => {
    frame(k);
    const bob = (T, A, ph) => -A * Math.sin(2 * Math.PI * u / T + ph);
    const y1 = bob(2.4, 8, 0), y2 = bob(1.6, 6, 1.2), y3 = bob(2.4, 6, 2.4);
    view(k, () => {
      k.fillStyle = C.soft; k.fillRect(0, 0, VW, VH);
      txt(k, '用 App，', 34, 62, `800 24px ${JP}`, C.ink); txt(k, '更轻松。', 34, 94, `800 24px ${JP}`, C.ink);
      bars(k, 34, 108, 170, 2); btn(k, 34, 134, 112, 24, '下载');
      const sh = 1 + y1 / 40;
      k.fillStyle = `rgba(28,35,51,${0.16 * sh})`; k.beginPath(); k.ellipse(352, 160, 54 * sh, 6 * sh, 0, 0, 7); k.fill();
      k.save(); k.translate(0, y1);
      k.fillStyle = C.ink; rr(k, 306, 18, 92, 132, 16); k.fill(); k.fillStyle = '#fff'; rr(k, 312, 24, 80, 120, 11); k.fill();
      pic(k, 318, 32, 68, 52, 0, 6); bars(k, 318, 92, 68, 3, C.faint, 5, 10);
      k.restore();
      k.save(); k.translate(0, y2); k.shadowColor = 'rgba(28,35,51,.18)'; k.shadowBlur = 10; k.shadowOffsetY = 4;
      k.fillStyle = C.acc; k.beginPath(); k.arc(268, 54, 20, 0, 7); k.fill(); k.shadowColor = 'transparent';
      k.fillStyle = '#fff'; k.beginPath(); k.moveTo(268, 62); k.bezierCurveTo(254, 53, 260, 41, 268, 48); k.bezierCurveTo(276, 41, 282, 53, 268, 62); k.fill(); k.restore();
      k.save(); k.translate(0, y3); k.shadowColor = 'rgba(28,35,51,.16)'; k.shadowBlur = 10; k.shadowOffsetY = 4;
      k.fillStyle = '#fff'; rr(k, 410, 92, 76, 30, 15); k.fill(); k.shadowColor = 'transparent';
      txt(k, '★ 4.8', 448, 108, `800 13px ${EN}`, C.acc, 'center', 'middle'); k.restore();
    });
  };
  return { width: CW, height: CH, cycle: CYC, cells: CELLS, fonts: [] };
});

MotionPrompt.pack('motion2', function () {
  const CW = 539, CH = 208;
  const CYC = 4.7;
  const C = {
    navy: '#0A0A0B', navy2: '#1E1E20', navy3: '#38383B', dim: '#8E8B85',
    blue: '#3B7BFF', coral: '#FF6B5C', yel: '#FFC83D', mint: '#2EDBA8', white: '#FFFFFF', cream: '#FFF1D6'
  };
  const PAL = [C.blue, C.coral, C.yel, C.mint];
  const JP = 'DMGothic,DMGothicFull,"PingFang SC",sans-serif';
  const DISP = '"Avenir Next", "Helvetica Neue", system-ui, sans-serif';
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, x) => a + (b - a) * x;
  const P = (t, a, b) => clamp((t - a) / (b - a));
  const eIO = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const eIOs = x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  const eOut = x => 1 - Math.pow(1 - x, 3);
  const eOut5 = x => 1 - Math.pow(1 - x, 5);
  const eIn = x => x * x * x;
  const smooth = x => x * x * (3 - 2 * x);
  const mod = (a, n) => ((a % n) + n) % n;
  const backOut = (x, s = 1.70158) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
  const backIn = (x, s = 1.70158) => (s + 1) * x * x * x - s * x * x;
  const spring = (t, w = 14, d = 7) => t <= 0 ? 0 : 1 - Math.exp(-d * t) * Math.cos(w * t);
  function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function txt(ctx, s, x, y, font, col, align = 'left', base = 'alphabetic', ls = '0px') {
    ctx.font = font; ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = base; ctx.letterSpacing = ls; ctx.fillText(s, x, y); ctx.letterSpacing = '0px';
  }
  function tw(ctx, s, font, ls = '0px') { ctx.font = font; ctx.letterSpacing = ls; const w = ctx.measureText(s).width; ctx.letterSpacing = '0px'; return w; }
  function rand(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function mix(a, b, t) { const A = hex(a), B = hex(b); return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`; }
  function star(k, x, y, R, rot = 0, inner = 0.5, n = 5) { k.beginPath(); for (let i = 0; i < n * 2; i++) { const r = i % 2 ? R * inner : R, a = rot - Math.PI / 2 + i * Math.PI / n; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; i ? k.lineTo(px, py) : k.moveTo(px, py); } k.closePath(); }
  function heartPath(k, s) { k.beginPath(); k.moveTo(0, s * 0.92); k.bezierCurveTo(-s * 1.75, -s * 0.12, -s * 0.85, -s * 1.2, 0, -s * 0.42); k.bezierCurveTo(s * 0.85, -s * 1.2, s * 1.75, -s * 0.12, 0, s * 0.92); k.closePath(); }
  const snapU = u => mod(Math.round(u * 1e6) / 1e6, CYC);
  function H01(n) { n = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); n ^= n >>> 16; return (n >>> 0) / 4294967296; }
  const TMP = mkCanvas(CW, CH), TK = TMP.getContext('2d');
  function stage(k, col = C.navy) { k.fillStyle = col; k.fillRect(0, 0, CW, CH); }
  function chars(k, s, font, ls = 0) { k.font = font; const ws = [...s].map(ch => k.measureText(ch).width + ls); const tot = ws.reduce((a, b) => a + b, 0) - ls; let x = -tot / 2; return [...s].map((ch, i) => { const o = { ch, x: x + (ws[i] - ls) / 2, w: ws[i] - ls }; x += ws[i]; return o; }); }
  function pathLen(pts) { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return c; }
  function ptAt(pts, cum, f) { const L = cum[cum.length - 1] * clamp(f); let i = 1; while (i < cum.length - 1 && cum[i] < L) i++; const t = (L - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]); return [lerp(pts[i - 1][0], pts[i][0], t), lerp(pts[i - 1][1], pts[i][1], t), Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0])]; }
  const CELLS = [];

  CELLS[0] = (k, w, h, u) => {
    u = snapU(u);
    stage(k);
    const T = CYC / 2, n = Math.floor(u / T), lu = u - n * T, dir = n % 2 ? -1 : 1;
    const XL = 108, XR = w - 108, xs = dir > 0 ? XL : XR, xe = dir > 0 ? XR : XL, floor = h - 30, S = 86, BACK = 44;
    k.fillStyle = C.navy3; rr(k, 26, floor, w - 52, 5, 2.5); k.fill();
    const wind = eIOs(P(lu, 0.2, 0.95)), go = P(lu, 0.95, 1.38);
    let x, sx = 1, sy = 1, rot = 0;
    if (go <= 0) { x = xs - dir * BACK * wind; sx = 1 + 0.22 * wind; sy = 1 - 0.24 * wind; rot = -dir * 0.18 * wind; }
    else {
      x = lerp(xs - dir * BACK, xe, backOut(go, 1.1));
      const st = go < 0.6 ? Math.sin(Math.PI * go / 0.6) : 0;
      sx = 1 + 0.55 * st; sy = 1 - 0.28 * st; rot = dir * 0.08 * st;
      const land = lu - 1.38; if (land > 0) { const wob = 0.13 * Math.exp(-7 * land) * Math.sin(17 * land); sy = 1 - wob; sx = 1 + wob; }
    }
    if (go > 0 && go < 0.7) { const q = go / 0.7; k.fillStyle = C.dim; k.globalAlpha = 0.8 * (1 - q); for (let i = 0; i < 3; i++) { k.beginPath(); k.arc(xs - dir * (BACK + 30 + i * 22 + q * 30), floor - 8 - i * 6 - q * 10, 7 + q * 12 - i * 2, 0, 7); k.fill(); } k.globalAlpha = 1; }
    k.fillStyle = 'rgba(0,0,0,.3)'; k.beginPath(); k.ellipse(x, floor + 8, S * 0.62 * sx, 6, 0, 0, 7); k.fill();
    if (go > 0.02 && go < 0.8) { const a = 1 - go / 0.8; k.strokeStyle = C.yel; k.lineCap = 'round'; k.lineWidth = 8; k.globalAlpha = a;[0.28, 0.55, 0.8].forEach((f, i) => { const y = floor - S * sy * f, x0 = x - dir * (S * sx / 2 + 12), L = 120 * a + 20; k.beginPath(); k.moveTo(x0, y); k.lineTo(x0 - dir * L * (i === 1 ? 1 : 0.7), y); k.stroke(); }); k.globalAlpha = 1; }
    k.save(); k.translate(x, floor); k.rotate(rot); k.scale(sx, sy);
    k.fillStyle = C.coral; rr(k, -S / 2, -S, S, S, 24); k.fill();
    k.fillStyle = 'rgba(255,255,255,.16)'; rr(k, -S / 2, -S, S, S / 2, [24, 24, 0, 0]); k.fill();
    k.strokeStyle = '#fff'; k.lineWidth = 10; k.lineCap = 'round'; k.lineJoin = 'round';
    k.beginPath(); k.moveTo(-dir * 12, -S / 2 - 20); k.lineTo(dir * 12, -S / 2); k.lineTo(-dir * 12, -S / 2 + 20); k.stroke();
    k.restore();
  };

  const FTAB = (() => {
    const T = CYC / 2, dt = 1 / 600, N = Math.ceil(T / dt) + 2, D = CW - 2 * 118;
    const pos = lu => { const q = P(lu, 0.15, 0.85), c = 1 / 0.85; return (q < 0.3 ? q * q / 0.6 : 0.15 + (q - 0.3)) * c; };
    const A = new Float32Array(N), B = new Float32Array(N);
    let a = 0, va = 0, b = 0, vb = 0, xp = 0, vp = 0;
    for (let i = 0; i < N; i++) {
      const lu = i * dt, x = pos(lu) * D, v = (x - xp) / dt, acc = i ? (v - vp) / dt : 0; xp = x; vp = v;
      va += (-121 * a - 5.5 * va - acc * 0.0175) * dt; a += va * dt;
      vb += (-56 * b - 2.8 * vb - acc * 0.012) * dt; b += vb * dt;
      const fade = 1 - smooth(P(lu, T - 0.3, T)); A[i] = a * fade; B[i] = b * fade;
    }
    return { A, B, pos, D };
  })();
  CELLS[1] = (k, w, h, u) => {
    u = snapU(u);
    stage(k);
    const T = CYC / 2, n = Math.floor(u / T), lu = u - n * T, dir = n % 2 ? -1 : 1;
    const i = Math.min(FTAB.A.length - 1, Math.round(lu * 600)), q = FTAB.pos(lu);
    const xs = dir > 0 ? 118 : w - 118, x = xs + dir * q * FTAB.D;
    const floor = h - 26, R = 38, cy = floor - R, a = dir * FTAB.A[i];
    k.fillStyle = C.navy3; rr(k, 26, floor, w - 52, 5, 2.5); k.fill();
    k.fillStyle = 'rgba(0,0,0,.3)'; k.beginPath(); k.ellipse(x, floor + 8, R * 1.1, 6, 0, 0, 7); k.fill();
    const moving = lu > 0.2 && lu < 0.85;
    if (moving) { k.strokeStyle = C.dim; k.lineCap = 'round'; k.lineWidth = 6; k.globalAlpha = 0.7;[[-18, 70], [6, 100], [26, 56]].forEach(([dy, L]) => { const x0 = x - dir * (R + 30); k.beginPath(); k.moveTo(x0, cy + dy); k.lineTo(x0 - dir * L, cy + dy); k.stroke(); }); k.globalAlpha = 1; }
    let px = x - dir * (R - 8), py = cy + 10; const pts = [[px, py]];
    for (let j = 1; j <= 7; j++) {
      const ij = Math.max(0, i - j * 22), d = FTAB.B[ij] * (0.55 + j * 0.16), ang0 = Math.PI + 0.25 + d;
      const ang = dir > 0 ? ang0 : Math.PI - ang0; px += Math.cos(ang) * 14; py += Math.sin(ang) * 14; pts.push([px, py]);
    }
    k.lineCap = 'round'; k.lineJoin = 'round'; k.strokeStyle = C.coral;
    for (let j = 1; j < pts.length; j++) { k.lineWidth = lerp(14, 6, j / pts.length); k.beginPath(); k.moveTo(pts[j - 1][0], pts[j - 1][1]); k.lineTo(pts[j][0], pts[j][1]); k.stroke(); }
    k.fillStyle = C.coral; k.beginPath(); k.arc(px, py, 9, 0, 7); k.fill();
    k.fillStyle = C.mint; k.beginPath(); k.arc(x, cy, R, 0, 7); k.fill();
    k.fillStyle = 'rgba(255,255,255,.18)'; k.beginPath(); k.arc(x - 10, cy - 12, R * 0.55, 0, 7); k.fill();
    k.fillStyle = '#fff'; k.beginPath(); k.arc(x + dir * 16, cy - 6, 9, 0, 7); k.fill();
    k.fillStyle = C.navy; k.beginPath(); k.arc(x + dir * 19, cy - 6, 4.5, 0, 7); k.fill();
    const L = 58, top = cy - R + 4;
    k.save(); k.translate(x, top); k.rotate(a);
    k.strokeStyle = '#fff'; k.lineWidth = 5; k.beginPath(); k.moveTo(0, 0); k.lineTo(0, -L); k.stroke();
    k.rotate(a * 0.6);
    k.fillStyle = C.yel; k.beginPath(); k.moveTo(0, -L); k.quadraticCurveTo(-dir * 22, -L + 4 + 8 * a * dir, -dir * 44, -L + 12); k.lineTo(0, -L + 28); k.closePath(); k.fill();
    k.restore();
    k.fillStyle = '#fff'; k.beginPath(); k.arc(x + Math.sin(a) * L, top - Math.cos(a) * L, 6, 0, 7); k.fill();
  };

  const BNC = (() => { const g = 1900, e = 0.56, d = 190, t0 = Math.sqrt(2 * d / g), v0 = g * t0; const segs = []; let t = t0, v = v0 * e; while (v > 35) { segs.push({ t, v }); t += 2 * v / g; v *= e; } const imp = [{ t: t0, v: v0 }]; segs.forEach((s, i) => { if (i) imp.push({ t: s.t, v: segs[i - 1].v }); }); return { g, d, t0, segs, imp, end: t }; })();
  function bounceH(t) { const B = BNC; if (t < B.t0) return B.d - 0.5 * B.g * Math.max(0, t) * Math.max(0, t) * (t < 0 ? 0 : 1); for (const s of B.segs) { const tau = t - s.t; if (tau >= 0 && tau < 2 * s.v / B.g) return s.v * tau - 0.5 * B.g * tau * tau; } return 0; }
  CELLS[2] = (k, w, h, u) => {
    u = snapU(u);
    stage(k);
    const T = CYC / 2, n = Math.floor(u / T), lu = u - n * T, t = lu - 0.1;
    const floor = h - 26, R = 26, rest = floor - R, x = lerp(150, 390, eOut(P(lu, 0.1, 1.8)));
    const hg = t < 0 ? BNC.d : bounceH(t), out = 1 - backIn(P(lu, 1.95, 2.25), 2);
    k.fillStyle = C.navy3; rr(k, 26, floor, w - 52, 5, 2.5); k.fill();
    let sq = 0;
    for (const im of BNC.imp) {
      const dtI = t - im.t;
      if (Math.abs(dtI) < 0.045) sq = Math.max(sq, clamp(im.v / 850) * 0.4 * (1 - Math.abs(dtI) / 0.045));
      if (dtI > 0 && dtI < 0.3 && im.v > 200) { const q = dtI / 0.3, ix = lerp(150, 390, eOut(P(im.t + 0.1, 0.1, 1.8))); k.strokeStyle = '#fff'; k.globalAlpha = 1 - q; k.lineWidth = 5; k.lineCap = 'round';[-1, 1].forEach(s => { k.beginPath(); k.moveTo(ix + s * (34 + 14 * q), floor - 6 - 8 * q); k.lineTo(ix + s * (48 + 22 * q), floor - 16 - 14 * q); k.stroke(); }); k.globalAlpha = 1; }
    }
    const sh = clamp(1 - hg / BNC.d);
    k.fillStyle = 'rgba(0,0,0,.32)'; k.beginPath(); k.ellipse(x, floor + 7, R * (0.4 + 0.8 * sh) * out, 5 * (0.4 + 0.6 * sh) * out, 0, 0, 7); k.fill();
    if (out > 0.01) {
      k.save(); k.translate(x, rest - hg + R); k.scale((1 + sq) * out, (1 - sq) * out);
      k.fillStyle = n ? C.coral : C.yel; k.beginPath(); k.arc(0, -R, R, 0, 7); k.fill();
      k.fillStyle = 'rgba(255,255,255,.7)'; k.beginPath(); k.ellipse(-9, -R - 9, 8, 5, -0.6, 0, 7); k.fill();
      k.restore();
    }
  };

  const WGF = 2 * Math.PI / CYC;
  const wsum = (u, arr) => arr.reduce((s, [kk, am, ph]) => s + am * Math.sin(WGF * kk * u + ph), 0);
  CELLS[3] = (k, w, h, u) => {
    stage(k);
    const rot = wsum(u, [[23, 0.085, 0.3], [31, 0.065, 1.9], [43, 0.05, 4.2], [59, 0.035, 2.6]]);
    const dx = wsum(u, [[29, 4, 0.7], [47, 3, 3.1], [61, 2, 5.0]]), dy = wsum(u, [[37, 2.4, 2.2], [53, 1.8, 0.4]]);
    const X = w / 2 + dx, Y = 34 + dy;
    k.strokeStyle = '#fff'; k.lineCap = 'round'; k.lineWidth = 6;
    [[86, 0.85], [110, 0.5]].forEach(([r, al], j) => { const fl = 0.55 + 0.45 * Math.abs(Math.sin(WGF * (41 + j * 12) * u)); k.globalAlpha = al * fl;[0, Math.PI].forEach(base => { k.beginPath(); k.arc(w / 2, 104, r, base - 0.42, base + 0.42); k.stroke(); }); });
    k.globalAlpha = 1;
    k.save(); k.translate(X, Y); k.rotate(rot);
    k.fillStyle = C.coral; k.beginPath(); k.arc(-rot * 70, 128, 13, 0, 7); k.fill();
    k.fillStyle = C.yel;
    k.beginPath(); k.arc(0, 8, 10, 0, 7); k.fill();
    k.beginPath(); k.moveTo(-50, 112); k.quadraticCurveTo(-42, 100, -42, 76); k.bezierCurveTo(-42, 36, -22, 18, 0, 18); k.bezierCurveTo(22, 18, 42, 36, 42, 76); k.quadraticCurveTo(42, 100, 50, 112); k.closePath(); k.fill();
    rr(k, -60, 106, 120, 16, 8); k.fill();
    k.fillStyle = 'rgba(255,255,255,.35)'; rr(k, -28, 40, 12, 50, 6); k.fill();
    k.restore();
  };

  CELLS[4] = (k, w, h, u) => {
    stage(k);
    const T = CYC / 4, lu = mod(u, T), X = w / 2, Y = h / 2 + 10;
    const g = (c, s) => Math.exp(-Math.pow((lu - c) / s, 2));
    const b = 0.26 * g(0.2, 0.065) + 0.15 * g(0.44, 0.07) + 0.26 * Math.exp(-Math.pow((lu - T - 0.2) / 0.065, 2));
    for (const [t0, s] of [[0.16, 1], [0.4, 0.6]]) {
      const q = P(lu, t0, t0 + 0.8); if (q <= 0 || q >= 1) continue;
      k.save(); k.translate(X, Y); const sc = 1.2 + 1.2 * eOut(q); k.scale(sc, sc); heartPath(k, 44);
      k.strokeStyle = C.coral; k.globalAlpha = (1 - q) * 0.75 * s; k.lineWidth = (7 * (1 - q) + 1.5) / sc; k.stroke(); k.restore();
    }
    k.globalAlpha = 1;
    k.save(); k.translate(X, Y); k.scale(1 + b, 1 + b); heartPath(k, 44); k.fillStyle = C.coral; k.fill();
    k.fillStyle = 'rgba(255,255,255,.75)'; k.beginPath(); k.ellipse(-30, -28, 9, 6, -0.7, 0, 7); k.fill(); k.restore();
  };

  const MPX = th => 270 + 112 * th - 150 * Math.sin(th), MPY = th => 106 - 74 * Math.cos(th);
  const MP = (() => { const pts = []; for (let i = 0; i <= 400; i++) { const th = -Math.PI + 2 * Math.PI * i / 400; pts.push([MPX(th), MPY(th)]); } return pts; })();
  CELLS[5] = (k, w, h, u) => {
    stage(k);
    k.save(); k.setLineDash([2, 15]); k.lineCap = 'round'; k.strokeStyle = C.dim; k.lineWidth = 6; k.beginPath(); MP.forEach((p, i) => i ? k.lineTo(p[0], p[1]) : k.moveTo(p[0], p[1])); k.stroke(); k.restore();
    const th = -Math.PI + 2 * Math.PI * (u / CYC);
    k.lineCap = 'round';
    for (let j = 0; j < 24; j++) { const a = th - j * 0.03, b = th - (j + 1) * 0.03; k.strokeStyle = C.mint; k.globalAlpha = 0.9 * (1 - j / 24); k.lineWidth = 7 * (1 - j / 30); k.beginPath(); k.moveTo(MPX(a), MPY(a)); k.lineTo(MPX(b), MPY(b)); k.stroke(); }
    k.globalAlpha = 1;
    const x = MPX(th), y = MPY(th), ang = Math.atan2(74 * Math.sin(th), 112 - 150 * Math.cos(th));
    k.save(); k.translate(x, y); k.rotate(ang);
    k.fillStyle = '#fff'; k.beginPath(); k.moveTo(32, 0); k.lineTo(-22, -22); k.lineTo(-12, 0); k.closePath(); k.fill();
    k.fillStyle = '#C9D6FF'; k.beginPath(); k.moveTo(32, 0); k.lineTo(-22, 22); k.lineTo(-12, 0); k.closePath(); k.fill();
    k.fillStyle = '#9FB3F0'; k.beginPath(); k.moveTo(32, 0); k.lineTo(-12, 0); k.lineTo(-6, 9); k.closePath(); k.fill();
    k.restore();
  };

  CELLS[6] = (k, w, h, u) => {
    u = snapU(u);
    stage(k);
    const q = u / CYC, fwd = q < 0.5, g = fwd ? 2 * q : 2 - 2 * q, X0 = 92, X1 = w - 92, base = 136, S = 48;
    const pos = gg => [lerp(X0, X1, gg), base - 62 * Math.abs(Math.sin(3 * Math.PI * gg))];
    k.save(); k.setLineDash([2, 12]); k.lineCap = 'round'; k.strokeStyle = C.navy3; k.lineWidth = 5; k.beginPath();
    for (let i = 0; i <= 150; i++) { const [px, py] = pos(i / 150); i ? k.lineTo(px, py - S / 2) : k.moveTo(px, py - S / 2); } k.stroke(); k.restore();
    k.fillStyle = C.navy3; rr(k, X0 - 40, base + 2, X1 - X0 + 80, 5, 2.5); k.fill();
    [X0, X1].forEach(xx => { k.fillStyle = C.navy3; rr(k, xx - 4, base - 70, 8, 72, 4); k.fill(); });
    for (let j = 4; j >= 1; j--) { const qq = mod(u - j * 0.045, CYC) / CYC, gg = qq < 0.5 ? 2 * qq : 2 - 2 * qq, [gx, gy] = pos(gg); k.globalAlpha = 0.1 * (5 - j); k.fillStyle = C.mint; k.save(); k.translate(gx, gy - S / 2); k.rotate(gg * Math.PI * 2); rr(k, -S / 2, -S / 2, S, S, 13); k.fill(); k.restore(); }
    k.globalAlpha = 1;
    const [x, y] = pos(g);
    k.save(); k.translate(x, y - S / 2); k.rotate(g * Math.PI * 2);
    k.fillStyle = C.mint; rr(k, -S / 2, -S / 2, S, S, 13); k.fill();
    k.fillStyle = '#fff'; k.beginPath(); k.arc(S / 2 - 13, -S / 2 + 13, 6.5, 0, 7); k.fill();
    k.restore();
    const ty = 184, tx0 = 196, tx1 = w - 34;
    k.fillStyle = fwd ? C.blue : C.coral; rr(k, 22, ty - 20, 158, 40, 20); k.fill();
    txt(k, fwd ? '▶ 播放' : '◀ 倒放', 101, ty + 1, `800 25px ${JP}`, '#fff', 'center', 'middle');
    k.fillStyle = C.navy3; rr(k, tx0, ty - 5, tx1 - tx0, 10, 5); k.fill();
    k.fillStyle = fwd ? C.blue : C.coral; rr(k, tx0, ty - 5, Math.max(10, (tx1 - tx0) * g), 10, 5); k.fill();
    k.fillStyle = C.yel; k.beginPath(); k.arc(tx0 + (tx1 - tx0) * g, ty, 12, 0, 7); k.fill();
  };

  CELLS[7] = (k, w, h, u) => {
    u = snapU(u);
    stage(k);
    k.fillStyle = '#0A1230'; k.fillRect(0, 0, w, 26); k.fillRect(0, h - 26, w, 26);
    k.fillStyle = C.navy3; for (let x = 12; x < w; x += 34) { rr(k, x, 8, 18, 11, 3); k.fill(); rr(k, x, h - 19, 18, 11, 3); k.fill(); }
    const NS = 38, st = CYC / NS, fi = Math.floor(u / st), floor = h - 44;
    const pose = f => { const t = f / NS, j = i => H01(f * 7919 + i * 131 + 77) - 0.5; return { x: lerp(-44, w + 44, t) + j(1) * 10, y: floor - 36 - 54 * Math.abs(Math.sin(t * Math.PI * 3)) + j(2) * 9, r: t * Math.PI * 4 + j(3) * 0.3, s: 1 + j(4) * 0.1 }; };
    const draw = (p, a) => {
      k.globalAlpha = a;
      k.save(); k.translate(p.x + 5, p.y + 6); k.rotate(p.r); k.scale(p.s, p.s); k.fillStyle = 'rgba(0,0,0,.35)'; star(k, 0, 0, 38, 0, 0.5); k.fill(); k.restore();
      k.save(); k.translate(p.x, p.y); k.rotate(p.r); k.scale(p.s, p.s); k.fillStyle = C.yel; star(k, 0, 0, 38, 0, 0.5); k.fill();
      k.fillStyle = C.coral; k.beginPath(); k.arc(0, 2, 9, 0, 7); k.fill(); k.restore();
      k.globalAlpha = 1;
    };
    draw(pose(mod(fi - 2, NS)), 0.12); draw(pose(mod(fi - 1, NS)), 0.28);
    const p = pose(fi);
    k.fillStyle = 'rgba(0,0,0,.3)'; k.beginPath(); k.ellipse(p.x, floor + 6, 30, 5, 0, 0, 7); k.fill();
    draw(p, 1);
    txt(k, '8 帧/秒', w - 16, 50, `800 24px ${JP}`, C.dim, 'right', 'middle');
  };


  const SCR_GL = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#$%&@?';
  CELLS[8] = (k, w, h, u) => {
    u = snapU(u);
    stage(k);
    const T = CYC / 2, n = Math.floor(u / T), lu = u - n * T, word = n ? 'WORLD' : 'HELLO', N = 5;
    const f = `700 92px Menlo, "SF Mono", monospace`; k.font = f;
    const cw = k.measureText('M').width + 16, x0 = w / 2 - cw * (N - 1) / 2, Y = h / 2 - 8;
    const step = Math.floor(u / (CYC / 76));
    for (let i = 0; i < N; i++) {
      const tl = 0.45 + i * 0.18, tu = 1.85 + (N - 1 - i) * 0.08, locked = lu >= tl && lu < tu;
      let ch, col, sc = 1;
      if (locked) { ch = word[i]; const age = lu - tl; col = age < 0.22 ? C.yel : '#fff'; sc = 1 + 0.2 * Math.exp(-age * 14); }
      else { ch = SCR_GL[Math.floor(H01(step * 131 + i * 977 + n * 31) * SCR_GL.length)]; col = C.mint; }
      k.save(); k.translate(x0 + i * cw, Y); k.scale(sc, sc); k.globalAlpha = locked ? 1 : 0.75; txt(k, ch, 0, 0, f, col, 'center', 'middle'); k.restore();
      const next = !locked && lu < tl && (i === 0 || lu >= 0.45 + (i - 1) * 0.18);
      k.fillStyle = locked ? C.blue : next ? C.yel : C.navy3; rr(k, x0 + i * cw - cw / 2 + 8, Y + 58, cw - 16, 8, 4); k.fill();
    }
  };

  CELLS[9] = (k, w, h, u) => {
    stage(k);
    const f = `800 70px ${DISP}`, cs = chars(k, 'WAVE TEXT', f, 4), Y = h / 2 + 2, ph = 2 * Math.PI * 3 * u / CYC;
    cs.forEach((c, i) => {
      if (c.ch === ' ') return;
      const s = Math.sin(ph - i * 0.62), y = -28 * s;
      k.fillStyle = 'rgba(0,0,0,.3)'; k.beginPath(); k.ellipse(w / 2 + c.x, Y + 62, c.w * (0.42 - 0.12 * s), 4, 0, 0, 7); k.fill();
      k.save(); k.translate(w / 2 + c.x, Y + y); k.scale(1, 1 + 0.06 * s); txt(k, c.ch, 0, 0, f, mix('#FFFFFF', C.yel, clamp(s)), 'center', 'middle'); k.restore();
    });
  };

  const TOP = (() => { const pts = []; for (let x = -70; x <= CW + 70; x += 4) pts.push([x, 118 + 42 * Math.sin(x * 2 * Math.PI / 330 + 0.6)]); return { pts, cum: pathLen(pts) }; })();
  CELLS[10] = (k, w, h, u) => {
    stage(k);
    k.save(); k.setLineDash([14, 10]); k.strokeStyle = C.navy3; k.lineWidth = 5; k.lineCap = 'round'; k.beginPath(); TOP.pts.forEach((p, i) => i ? k.lineTo(p[0], p[1] + 6) : k.moveTo(p[0], p[1] + 6)); k.stroke(); k.restore();
    const f = `800 42px ${DISP}`, S = 'ALONG THE LINE • '; k.font = f;
    const ws = [...S].map(ch => k.measureText(ch).width + 2), run = ws.reduce((a, b) => a + b, 0), L = TOP.cum[TOP.cum.length - 1], shift = (u / CYC) * run;
    for (let r = -2; r * run + shift < L; r++) {
      let s = r * run + shift;
      [...S].forEach((ch, j) => {
        const c = s + ws[j] / 2; s += ws[j];
        if (c < 0 || c > L || ch === ' ') return;
        const p = ptAt(TOP.pts, TOP.cum, c / L);
        k.save(); k.translate(p[0], p[1]); k.rotate(p[2]); txt(k, ch, 0, 0, f, ch === '•' ? C.yel : '#fff', 'center', 'alphabetic'); k.restore();
      });
    }
  };

  CELLS[11] = (k, w, h, u) => {
    stage(k);
    const v = 0.5 - 0.5 * Math.cos(2 * Math.PI * 2 * u / CYC), wt = Math.round(100 + 800 * v);
    txt(k, 'MOTION', w / 2, 80, `${wt} 112px system-ui`, '#fff', 'center', 'middle', '2px');
    const x0 = 112, x1 = w - 112, y = 180, kx = x0 + (x1 - x0) * v;
    txt(k, '细', x0 - 34, y + 1, `300 30px ${JP}`, C.dim, 'center', 'middle');
    txt(k, '粗', x1 + 34, y + 1, `900 30px ${JP}`, C.dim, 'center', 'middle');
    k.fillStyle = C.navy3; rr(k, x0, y - 5, x1 - x0, 10, 5); k.fill();
    k.fillStyle = C.blue; rr(k, x0, y - 5, Math.max(10, kx - x0), 10, 5); k.fill();
    k.fillStyle = C.yel; k.beginPath(); k.arc(kx, y, 14, 0, 7); k.fill();
    txt(k, String(wt), kx, y - 30, `800 24px ${DISP}`, C.yel, 'center', 'middle');
  };

  const G0 = mkCanvas(CW, CH), GK0 = G0.getContext('2d', { willReadFrequently: true });
  function seaPattern(g, w, h, u) {
    g.fillStyle = C.coral; g.fillRect(0, 0, w, h);
    g.fillStyle = C.yel; g.beginPath(); g.arc(w * 0.6, 116 + 6 * Math.sin(2 * Math.PI * u / CYC), 60, 0, 7); g.fill();
    g.fillStyle = C.blue; g.fillRect(0, 116, w, h - 116);
    const off = (u / CYC) * 240; g.strokeStyle = '#fff'; g.lineWidth = 7; g.lineCap = 'round';
    for (let j = 0; j < 4; j++) { const y = 128 + j * 22, d = j % 2 ? -1 : 1; g.beginPath(); for (let x = -20; x <= w + 20; x += 6) { const yy = y + 5 * Math.sin((x + off * d + j * 40) * 2 * Math.PI / 120); x === -20 ? g.moveTo(x, yy) : g.lineTo(x, yy); } g.stroke(); }
    const bx = mod(u / CYC * (w + 160), w + 160) - 80;
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(bx, 46); g.lineTo(bx, 100); g.lineTo(bx + 40, 100); g.closePath(); g.fill();
    g.fillStyle = C.navy; g.beginPath(); g.moveTo(bx - 42, 104); g.lineTo(bx + 52, 104); g.lineTo(bx + 38, 122); g.lineTo(bx - 30, 122); g.closePath(); g.fill();
    g.fillStyle = '#fff';[[60, 40], [320, 30], [470, 56]].forEach(([x, y]) => { const xx = mod(x + u / CYC * 60, w + 80) - 40; g.beginPath(); g.ellipse(xx, y, 30, 11, 0, 0, 7); g.fill(); });
  }
  CELLS[12] = (k, w, h, u) => {
    stage(k);
    let fs = 172; while (fs > 90 && tw(k, 'OCEAN', `900 ${fs}px system-ui`, '2px') > 500) fs -= 2;
    const font = `900 ${fs}px system-ui`, Y = h / 2 + 6;
    const open = smooth(P(u, 3.45, 3.85)) * (1 - smooth(P(u, 4.25, 4.65)));
    TK.setTransform(1, 0, 0, 1, 0, 0); TK.globalCompositeOperation = 'source-over'; TK.clearRect(0, 0, w, h);
    txt(TK, 'OCEAN', w / 2, Y, font, '#fff', 'center', 'middle', '2px');
    GK0.setTransform(1, 0, 0, 1, 0, 0); GK0.globalCompositeOperation = 'source-over'; GK0.clearRect(0, 0, w, h); seaPattern(GK0, w, h, u);
    TK.globalCompositeOperation = 'source-in'; TK.drawImage(G0, 0, 0); TK.globalCompositeOperation = 'source-over';
    k.globalAlpha = 0.12 + 0.88 * open; seaPattern(k, w, h, u); k.globalAlpha = 1;
    k.drawImage(TMP, 0, 0);
    k.font = font; k.textAlign = 'center'; k.textBaseline = 'middle'; k.letterSpacing = '2px'; k.lineJoin = 'round';
    k.strokeStyle = '#fff'; k.lineWidth = 4; k.strokeText('OCEAN', w / 2, Y); k.letterSpacing = '0px';
  };

  CELLS[13] = (k, w, h, u) => {
    u = snapU(u);
    stage(k);
    const N = 12, X = w / 2, Y = h / 2, R = 58, spin = 2 * Math.PI * u / CYC;
    const cnt = 1 + (N - 1) * (eIOs(P(u, 0.35, 1.7)) - eIOs(P(u, 3.6, 4.45)));
    for (let i = N - 1; i >= 0; i--) {
      const vis = i === 0 ? 1 : clamp(cnt - i); if (vis <= 0) continue;
      const ang = spin + (i === 0 ? 0 : (i - 1 + eOut(vis))) * 2 * Math.PI / N;
      const pul = (1 + 0.22 * Math.sin(2 * Math.PI * 2 * u / CYC - i * 0.55)) * (0.55 + 0.45 * vis);
      k.save(); k.translate(X + Math.cos(ang) * R, Y + Math.sin(ang) * R); k.rotate(ang + Math.PI / 2); k.scale(pul, pul);
      k.fillStyle = PAL[i % 4]; rr(k, -12, -30, 24, 60, 12); k.fill();
      if (i === 0) { k.strokeStyle = '#fff'; k.lineWidth = 4; rr(k, -12, -30, 24, 60, 12); k.stroke(); }
      k.restore();
    }
    txt(k, '×' + Math.round(cnt), w - 34, 46, `800 40px ${DISP}`, C.yel, 'right', 'middle');
  };

  const KAL = (() => { const R = rand(1515), a = []; for (let i = 0; i < 13; i++) a.push({ r0: R() * 300, th: 0.06 + R() * 0.66, kind: i % 3, col: PAL[i % 4], sz: 0.7 + R() * 0.7, ph: R() * 6 }); return a; })();
  CELLS[14] = (k, w, h, u) => {
    stage(k);
    const X = w / 2, Y = h / 2, RM = 300, rot = (Math.PI / 2) * u / CYC, W8 = Math.PI / 4;
    for (let s = 0; s < 8; s++) {
      k.save(); k.translate(X, Y);
      if (s % 2) { k.rotate(rot + (s + 1) * W8); k.scale(1, -1); } else k.rotate(rot + s * W8);
      k.beginPath(); k.moveTo(0, 0); k.arc(0, 0, RM + 60, -0.006, W8 + 0.006); k.closePath(); k.clip();
      for (const it of KAL) {
        const r = mod(it.r0 + (u / CYC) * RM, RM), th = it.th + 0.08 * Math.sin(2 * Math.PI * u / CYC + it.ph), sz = (5 + r * 0.1) * it.sz;
        const a = smooth(P(r, 0, 30)) * (1 - smooth(P(r, RM - 70, RM))); if (a <= 0) continue;
        k.globalAlpha = a; k.fillStyle = it.col; k.save(); k.translate(Math.cos(th) * r, Math.sin(th) * r); k.rotate(r * 0.02);
        if (it.kind === 0) { k.beginPath(); k.arc(0, 0, sz, 0, 7); k.fill(); }
        else if (it.kind === 1) { k.beginPath(); k.moveTo(0, -sz * 1.2); k.lineTo(sz * 0.8, 0); k.lineTo(0, sz * 1.2); k.lineTo(-sz * 0.8, 0); k.closePath(); k.fill(); }
        else { k.beginPath(); k.moveTo(0, -sz); k.lineTo(sz * 0.95, sz * 0.7); k.lineTo(-sz * 0.95, sz * 0.7); k.closePath(); k.fill(); }
        k.restore();
      }
      k.globalAlpha = 1; k.restore();
    }
    k.fillStyle = '#fff'; star(k, X, Y, 20 + 4 * Math.sin(2 * Math.PI * 2 * u / CYC), rot, 0.5, 8); k.fill();
  };

  function densify(pts, closed, step) { const out = [], n = pts.length, m = closed ? n : n - 1; for (let i = 0; i < m; i++) { const a = pts[i], b = pts[(i + 1) % n], d = Math.hypot(b[0] - a[0], b[1] - a[1]), c = Math.max(1, Math.round(d / step)); for (let j = 0; j < c; j++) out.push([lerp(a[0], b[0], j / c), lerp(a[1], b[1], j / c)]); } if (!closed) out.push(pts[n - 1]); return out; }
  const LB = (() => {
    const st = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 30 : 70, a = -Math.PI / 2 + i * Math.PI / 5; st.push([150 + Math.cos(a) * r, 112 + Math.sin(a) * r]); }
    const CIR = [[318, 132, 26], [354, 104, 36], [408, 94, 42], [456, 122, 30]], O = [388, 130], cl = [];
    for (let i = 0; i < 96; i++) {
      const a = i / 96 * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a); let tm = 0;
      const tx = dx > 0 ? (470 - O[0]) / dx : dx < 0 ? (310 - O[0]) / dx : 1e9, ty = dy > 0 ? (150 - O[1]) / dy : dy < 0 ? (118 - O[1]) / dy : 1e9; tm = Math.min(tx, ty);
      for (const [ccx, ccy, r] of CIR) { const ox = O[0] - ccx, oy = O[1] - ccy, b = ox * dx + oy * dy, c2 = ox * ox + oy * oy - r * r, D = b * b - c2; if (D >= 0) { const t = -b + Math.sqrt(D); if (t > tm) tm = t; } }
      cl.push([O[0] + dx * tm, O[1] + dy * tm]);
    }
    return [
      { pts: densify(st, true, 13), col: C.yel, closed: true, w: 8 },
      { pts: cl, col: '#fff', closed: true, w: 8 },
      { pts: densify([[248, 44], [266, 62]], false, 6), col: C.mint, closed: false, w: 7 },
      { pts: densify([[254, 104], [280, 104]], false, 6), col: C.mint, closed: false, w: 7 },
      { pts: densify([[60, 34], [74, 52]], false, 6), col: C.mint, closed: false, w: 7 },
      { pts: densify([[318, 178], [460, 178]], false, 10), col: C.dim, closed: false, w: 6 },
    ];
  })();
  CELLS[15] = (k, w, h, u) => {
    u = snapU(u);
    stage(k);
    const fi = Math.floor(u / (CYC / 47));
    k.lineCap = 'round'; k.lineJoin = 'round';
    LB.forEach((sh, si) => {
      const q = sh.pts.map((p, j) => [p[0] + (H01(fi * 7919 + j * 131 + si * 17) - 0.5) * 7, p[1] + (H01(fi * 6007 + j * 97 + si * 29 + 5) - 0.5) * 7]);
      k.strokeStyle = sh.col; k.lineWidth = sh.w; k.beginPath();
      const n = q.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (sh.closed) { const m0 = mid(q[n - 1], q[0]); k.moveTo(m0[0], m0[1]); for (let j = 0; j < n; j++) { const m = mid(q[j], q[(j + 1) % n]); k.quadraticCurveTo(q[j][0], q[j][1], m[0], m[1]); } k.closePath(); }
      else { k.moveTo(q[0][0], q[0][1]); for (let j = 1; j < n - 1; j++) { const m = mid(q[j], q[j + 1]); k.quadraticCurveTo(q[j][0], q[j][1], m[0], m[1]); } k.lineTo(q[n - 1][0], q[n - 1][1]); }
      k.stroke();
    });
  };

  const SUN = [112, 104], MOON = [CW - 112, 104];
  function scrA(k, w, h) {
    k.fillStyle = C.cream; k.fillRect(0, 0, w, h);
    k.fillStyle = '#FFD9A8'; k.beginPath(); k.arc(SUN[0], SUN[1], 66, 0, 7); k.fill();
    k.fillStyle = C.coral; k.beginPath(); k.arc(SUN[0], SUN[1], 44, 0, 7); k.fill();
    txt(k, 'DAY', 214, h / 2 + 4, `800 96px ${DISP}`, C.navy, 'left', 'middle', '2px');
    k.fillStyle = '#fff'; rr(k, 400, 34, 96, 26, 13); k.fill(); rr(k, 430, 20, 50, 26, 13); k.fill();
  }
  function scrB(k, w, h) {
    k.fillStyle = '#16255A'; k.fillRect(0, 0, w, h);
    k.fillStyle = '#fff';[[40, 30, 3], [150, 170, 2.5], [250, 24, 2.5], [330, 180, 3], [500, 30, 2.5], [20, 150, 2]].forEach(s => { k.beginPath(); k.arc(s[0], s[1], s[2], 0, 7); k.fill(); });
    k.fillStyle = C.yel; k.beginPath(); k.arc(MOON[0], MOON[1], 46, 0, 7); k.fill();
    k.fillStyle = '#16255A'; k.beginPath(); k.arc(MOON[0] + 22, MOON[1] - 14, 38, 0, 7); k.fill();
    txt(k, 'NIGHT', 40, h / 2 + 4, `800 88px ${DISP}`, '#fff', 'left', 'middle', '1px');
  }
  function clipX(k, x0, x1, h) { k.beginPath(); k.rect(x0, 0, x1 - x0, h); k.clip(); }
  function pnSea(k, x0, x1, h, t, label) {
    const c = (x0 + x1) / 2; k.save(); clipX(k, x0, x1, h);
    k.fillStyle = '#CFE0FF'; k.fillRect(x0, 0, x1 - x0, h);
    k.fillStyle = C.yel; k.beginPath(); k.arc(c + 120, 54, 30, 0, 7); k.fill();
    k.fillStyle = C.blue; k.fillRect(x0, 126, x1 - x0, h - 126);
    const off = (t / CYC) * 200; k.strokeStyle = '#fff'; k.lineWidth = 6; k.lineCap = 'round';
    for (let j = 0; j < 3; j++) { const y = 146 + j * 22; k.beginPath(); for (let x = x0 - 10; x <= x1 + 10; x += 6) { const yy = y + 4 * Math.sin((x + off * (j % 2 ? -1 : 1) + j * 30) * 2 * Math.PI / 100); x === x0 - 10 ? k.moveTo(x, yy) : k.lineTo(x, yy); } k.stroke(); }
    const bx = c + 26 * Math.sin(2 * Math.PI * t / CYC) + (label ? 110 : 0), by = 124 + 3 * Math.sin(2 * Math.PI * 3 * t / CYC);
    k.fillStyle = '#fff'; k.beginPath(); k.moveTo(bx, by - 62); k.lineTo(bx, by - 8); k.lineTo(bx + 42, by - 8); k.closePath(); k.fill();
    k.fillStyle = C.coral; k.beginPath(); k.moveTo(bx - 40, by - 4); k.lineTo(bx + 50, by - 4); k.lineTo(bx + 36, by + 14); k.lineTo(bx - 28, by + 14); k.closePath(); k.fill();
    if (label) txt(k, 'SEA', x0 + 30, 82, `800 76px ${DISP}`, C.navy, 'left', 'middle', '2px');
    k.restore();
  }
  function pnMtn(k, x0, x1, h, t, label) {
    const c = (x0 + x1) / 2; k.save(); clipX(k, x0, x1, h);
    k.fillStyle = '#FFE1DA'; k.fillRect(x0, 0, x1 - x0, h);
    k.fillStyle = C.yel; k.beginPath(); k.arc(c - 30, 112, 34, 0, 7); k.fill();
    const tri = (a, px, py, b, col) => { k.fillStyle = col; k.beginPath(); k.moveTo(a, h); k.lineTo(px, py); k.lineTo(b, h); k.closePath(); k.fill(); };
    const snow = (a, px, py, b, f) => { const L = lerp(px, a, f), R = lerp(px, b, f), y = lerp(py, h, f); k.fillStyle = '#fff'; k.beginPath(); k.moveTo(px, py); k.lineTo(R, y); k.lineTo(lerp(px, R, 0.5), y + 10); k.lineTo(px, y - 2); k.lineTo(lerp(L, px, 0.5), y + 10); k.lineTo(L, y); k.closePath(); k.fill(); };
    tri(c - 330, c - 230, 104, c - 110, C.mint);
    tri(c - 110, c + 50, 30, c + 210, C.navy3); snow(c - 110, c + 50, 30, c + 210, 0.22);
    tri(c + 80, c + 190, 86, c + 330, C.blue); snow(c + 80, c + 190, 86, c + 330, 0.2);
    k.fillStyle = C.mint; k.fillRect(x0, h - 20, x1 - x0, 20);
    if (label) txt(k, 'MOUNTAIN', x0 + 26, 54, `800 44px ${DISP}`, C.navy, 'left', 'middle', '1px');
    k.restore();
  }
  const BLD = [[-250, 70, 116, 0], [-175, 62, 150, 1], [-108, 80, 96, 0], [-22, 64, 172, 1], [48, 92, 122, 0], [146, 58, 150, 1], [210, 80, 108, 0]];
  function pnCity(k, x0, x1, h, t, label) {
    const c = (x0 + x1) / 2; k.save(); clipX(k, x0, x1, h);
    k.fillStyle = C.navy2; k.fillRect(x0, 0, x1 - x0, h);
    k.fillStyle = '#fff'; k.beginPath(); k.arc(c + 150, 46, 22, 0, 7); k.fill();
    const stp = Math.floor(t / (CYC / 8));
    BLD.forEach(([dx, bw, bh, ci], bi) => {
      const bx = c + dx, by = h - bh; k.fillStyle = ci ? C.blue : C.navy3; k.fillRect(bx, by, bw, bh);
      let wi = 0; for (let y = by + 14; y < h - 16; y += 22) for (let x = bx + 10; x < bx + bw - 14; x += 18) { const on = H01(bi * 97 + wi * 13 + stp * 7) > 0.35; wi++; k.fillStyle = on ? C.yel : 'rgba(15,26,61,.45)'; k.fillRect(x, y, 9, 11); }
    });
    if (label) { k.fillStyle = 'rgba(15,26,61,.55)'; rr(k, x0 + 18, 28, 196, 70, 14); k.fill(); txt(k, 'CITY', x0 + 34, 64, `800 66px ${DISP}`, '#fff', 'left', 'middle', '2px'); }
    k.restore();
  }
  function pnField(k, x0, x1, h, t, label) {
    const c = (x0 + x1) / 2; k.save(); clipX(k, x0, x1, h);
    k.fillStyle = '#DDF6EC'; k.fillRect(x0, 0, x1 - x0, h);
    k.fillStyle = '#fff';[[-150, 40], [60, 30], [210, 52]].forEach(([dx, y]) => { const xx = c + dx + 14 * Math.sin(2 * Math.PI * t / CYC + dx); k.beginPath(); k.ellipse(xx, y, 34, 12, 0, 0, 7); k.ellipse(xx + 14, y - 8, 18, 12, 0, 0, 7); k.fill(); });
    k.fillStyle = C.mint; k.beginPath(); k.moveTo(x0, h); k.lineTo(x0, 150); for (let x = x0; x <= x1; x += 10) k.lineTo(x, 150 + 8 * Math.sin((x - c) * 0.02)); k.lineTo(x1, h); k.closePath(); k.fill();
    const mx = c + (label ? 120 : 0), my = 72;
    k.fillStyle = '#fff'; k.beginPath(); k.moveTo(mx - 10, my); k.lineTo(mx + 10, my); k.lineTo(mx + 18, 160); k.lineTo(mx - 18, 160); k.closePath(); k.fill();
    const ang = 2 * Math.PI * 2 * t / CYC + 0.3; k.fillStyle = C.coral;
    for (let i = 0; i < 4; i++) { k.save(); k.translate(mx, my); k.rotate(ang + i * Math.PI / 2); k.beginPath(); k.moveTo(0, -3); k.lineTo(58, -10); k.lineTo(58, 8); k.lineTo(0, 3); k.closePath(); k.fill(); k.restore(); }
    k.fillStyle = C.yel; k.beginPath(); k.arc(mx, my, 8, 0, 7); k.fill();
    [[-200, 176, 0], [-120, 186, 1], [-40, 172, 0], [40, 184, 1], [180, 178, 0], [230, 190, 1]].forEach(([dx, y, ci]) => { k.fillStyle = ci ? C.yel : C.coral; k.beginPath(); k.arc(c + dx, y, 7, 0, 7); k.fill(); });
    if (label) txt(k, 'FIELD', x0 + 28, 70, `800 70px ${DISP}`, C.navy, 'left', 'middle', '2px');
    k.restore();
  }
  const scSea = (k, w, h) => pnSea(k, 0, w, h, 0, true), scMtn = (k, w, h) => pnMtn(k, 0, w, h, 0, true);
  const scCity = (k, w, h) => pnCity(k, 0, w, h, 0, true), scField = (k, w, h) => pnField(k, 0, w, h, 0, true);
  const SEG3 = CYC / 2;
  function abCell(trans) { return (k, w, h, u) => { u = snapU(u); const sgi = Math.min(1, Math.floor(u / SEG3)), uu = u - sgi * SEG3; trans(k, w, h, uu, sgi, 1 - sgi); }; }
  const TA = 0.5, TB = 1.5;
  function polyPath(k, pts) { k.beginPath(); pts.forEach((p, i) => i ? k.lineTo(p[0], p[1]) : k.moveTo(p[0], p[1])); k.closePath(); }

  const SC17 = [scSea, scMtn];
  CELLS[16] = abCell((k, w, h, u, a, b) => {
    const p = eIO(P(u, TA - 0.05, TB + 0.1)), dir = a === 0 ? -1 : 1;
    if (p <= 0) return SC17[a](k, w, h);
    if (p >= 1) return SC17[b](k, w, h);
    k.save(); k.translate(dir * p * w, 0); SC17[a](k, w, h); k.restore();
    k.save(); k.translate(dir * (p - 1) * w, 0); SC17[b](k, w, h); k.restore();
    const ex = dir < 0 ? w * (1 - p) : w * p;
    k.fillStyle = C.navy; k.fillRect(ex - 3, 0, 6, h);
  });

  CELLS[17] = abCell((k, w, h, u, a, b) => {
    const p = eIOs(P(u, TA - 0.1, TB + 0.15)), N = 7, sh = h / N, S = [scrA, scrB];
    S[a](k, w, h);
    if (p <= 0) return;
    k.save(); k.beginPath(); for (let i = 0; i < N; i++) k.rect(0, i * sh, w, sh * p + (p > 0.999 ? 1 : 0)); k.clip(); S[b](k, w, h); k.restore();
  });

  const CFW = 250, CFH = 146, CF = [mkCanvas(CFW, CFH), mkCanvas(CFW, CFH)];
  function cubeFace(i) {
    const g = CF[i].getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, CFW, CFH);
    g.fillStyle = i ? C.mint : C.coral; g.fillRect(0, 0, CFW, CFH);
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 4; g.strokeRect(12, 12, CFW - 24, CFH - 24);
    txt(g, i ? 'B' : 'A', 78, CFH / 2 + 4, `800 104px ${DISP}`, i ? C.navy : '#fff', 'center', 'middle');
    g.fillStyle = i ? C.navy : '#fff'; g.globalAlpha = 0.8; rr(g, 140, 46, 78, 14, 7); g.fill(); g.globalAlpha = 0.45; rr(g, 140, 72, 60, 12, 6); g.fill(); rr(g, 140, 94, 70, 12, 6); g.fill(); g.globalAlpha = 1;
    return CF[i];
  }
  CELLS[18] = abCell((k, w, h, u, a, b) => {
    stage(k);
    const phi = (Math.PI / 2) * eIO(P(u, TA - 0.05, TB + 0.1)), c = Math.cos(phi), s = Math.sin(phi), HW = CFW / 2, D = 820, X = w / 2, Y = h / 2 - 4;
    const rot = (x, z) => [x * c - z * s, x * s + z * c];
    const FL = rot(-HW, HW), FR = rot(HW, HW), BR = rot(HW, -HW);
    const pj = p => { const f = D / (D - (p[1] - HW)); return [X + p[0] * f, f]; };
    k.fillStyle = 'rgba(0,0,0,.3)'; k.beginPath(); k.ellipse(X, h - 16, HW * (c + s) * 0.95, 7, 0, 0, 7); k.fill();
    const face = (img, P0, P1, shade) => {
      const A0 = pj(P0), A1 = pj(P1); if (A1[0] - A0[0] < 1) return;
      const STEP = 2;
      for (let sx = 0; sx < CFW; sx += STEP) {
        const t0 = sx / CFW, t1 = Math.min(1, (sx + STEP) / CFW);
        const q0 = pj([lerp(P0[0], P1[0], t0), lerp(P0[1], P1[1], t0)]), q1 = pj([lerp(P0[0], P1[0], t1), lerp(P0[1], P1[1], t1)]);
        const hh = CFH * q0[1]; k.drawImage(img, sx, 0, STEP, CFH, q0[0], Y - hh / 2, q1[0] - q0[0] + 0.7, hh);
      }
      if (shade > 0.01) { k.fillStyle = `rgba(8,14,40,${shade})`; k.beginPath(); k.moveTo(A0[0], Y - CFH * A0[1] / 2); k.lineTo(A1[0], Y - CFH * A1[1] / 2); k.lineTo(A1[0], Y + CFH * A1[1] / 2); k.lineTo(A0[0], Y + CFH * A0[1] / 2); k.closePath(); k.fill(); }
    };
    face(cubeFace(a), FL, FR, 0.55 * s);
    face(cubeFace(b), FR, BR, 0.55 * c);
  });

  function paper(k, w, h, i) {
    k.fillStyle = i ? C.cream : '#FFFFFF'; k.fillRect(0, 0, w, h);
    txt(k, i ? 'PAGE 2' : 'PAGE 1', 30, 58, `800 46px ${DISP}`, C.navy, 'left', 'middle', '1px');
    k.fillStyle = i ? '#EBD9B4' : '#D7DCEA';[[96, 230], [122, 250], [148, 200], [174, 236]].forEach(([y, ww]) => { rr(k, 30, y, ww, 12, 6); k.fill(); });
    k.fillStyle = i ? C.mint : C.coral; rr(k, 310, 26, 200, 156, 14); k.fill();
    k.fillStyle = '#fff'; k.beginPath(); k.arc(462, 66, 18, 0, 7); k.fill();
    k.beginPath(); k.moveTo(326, 168); k.lineTo(390, 92); k.lineTo(440, 150); k.lineTo(462, 126); k.lineTo(496, 168); k.closePath(); k.fill();
  }
  function clipHalf(poly, d, s0, keepLess) { const out = [], f = p => (p[0] - CW) * d[0] + (p[1] - CH) * d[1] - s0; for (let i = 0; i < poly.length; i++) { const A = poly[i], B = poly[(i + 1) % poly.length], fa = f(A), fb = f(B), ia = keepLess ? fa <= 0 : fa >= 0, ib = keepLess ? fb <= 0 : fb >= 0; if (ia) out.push(A); if (ia !== ib) { const t = fa / (fa - fb); out.push([lerp(A[0], B[0], t), lerp(A[1], B[1], t)]); } } return out; }
  CELLS[19] = abCell((k, w, h, u, a, b) => {
    const dl = Math.hypot(1, 0.42), d = [-1 / dl, -0.42 / dl], sM = 600 * eIOs(P(u, TA - 0.15, TB + 0.25));
    paper(k, w, h, b);
    if (sM >= 599) return;
    const rect = [[0, 0], [w, 0], [w, h], [0, h]], rest = clipHalf(rect, d, sM, false), corner = clipHalf(rect, d, sM, true);
    if (rest.length > 2) { k.save(); polyPath(k, rest); k.clip(); paper(k, w, h, a); k.restore(); }
    if (corner.length > 2 && sM > 0.5) {
      k.save(); polyPath(k, corner); k.clip();
      const mx = w + d[0] * sM, my = h + d[1] * sM, gr = k.createLinearGradient(mx, my, mx - d[0] * 50, my - d[1] * 50);
      gr.addColorStop(0, 'rgba(15,26,61,.35)'); gr.addColorStop(1, 'rgba(15,26,61,0)'); k.fillStyle = gr; k.fillRect(0, 0, w, h); k.restore();
      const flap = corner.map(p => { const s = (p[0] - w) * d[0] + (p[1] - h) * d[1], m = 2 * (sM - s); return [p[0] + m * d[0], p[1] + m * d[1]]; });
      k.save(); k.shadowColor = 'rgba(0,0,0,.35)'; k.shadowBlur = 14; k.shadowOffsetX = 4; k.shadowOffsetY = 4;
      polyPath(k, flap); k.fillStyle = a ? '#EADBB8' : '#E3E6EF'; k.fill(); k.restore();
      k.strokeStyle = 'rgba(255,255,255,.8)'; k.lineWidth = 2; polyPath(k, flap); k.stroke();
    }
  });

  const SMC = mkCanvas(CW, CH), SMK = SMC.getContext('2d');
  const BLV = [1, 2, 3, 4, 6, 8, 11, 15, 20, 27, 36];
  CELLS[20] = abCell((k, w, h, u, a, b) => {
    const S = [scField, scCity], p = P(u, TA - 0.3, TB + 0.4), tri = 1 - Math.abs(2 * p - 1), bs = BLV[Math.round(tri * (BLV.length - 1))];
    const scr = p < 0.5 ? a : b;
    if (bs <= 1) return S[scr](k, w, h);
    TK.setTransform(1, 0, 0, 1, 0, 0); TK.globalCompositeOperation = 'source-over'; TK.clearRect(0, 0, w, h); S[scr](TK, w, h);
    const sw = Math.ceil(w / bs), sh = Math.ceil(h / bs);
    SMK.setTransform(1, 0, 0, 1, 0, 0); SMK.clearRect(0, 0, CW, CH); SMK.imageSmoothingEnabled = true; SMK.imageSmoothingQuality = 'high'; SMK.drawImage(TMP, 0, 0, sw, sh);
    k.imageSmoothingEnabled = false; k.drawImage(SMC, 0, 0, sw, sh, 0, 0, sw * bs, sh * bs); k.imageSmoothingEnabled = true;
  });

  const SHARDS = (() => {
    const R = rand(2222), I = [304, 92], NA = 13, RAD = [0, 40, 98, 175, 360], V = [];
    const angs = []; for (let i = 0; i < NA; i++) angs.push((i + (R() - 0.5) * 0.6) / NA * Math.PI * 2);
    for (let r = 0; r < RAD.length; r++) { V.push([]); for (let i = 0; i < NA; i++) { const rr_ = r ? RAD[r] * (0.85 + R() * 0.3) : 0, a = angs[i] + (r ? (R() - 0.5) * 0.12 : 0); V[r].push([I[0] + Math.cos(a) * rr_, I[1] + Math.sin(a) * rr_]); } }
    const sh = [];
    for (let r = 0; r < RAD.length - 1; r++) for (let i = 0; i < NA; i++) {
      const j = (i + 1) % NA, poly = r ? [V[r][i], V[r][j], V[r + 1][j], V[r + 1][i]] : [I, V[1][j], V[1][i]];
      const cxp = poly.reduce((s, p) => s + p[0], 0) / poly.length, cyp = poly.reduce((s, p) => s + p[1], 0) / poly.length;
      const dx = cxp - I[0], dy = cyp - I[1], dd = Math.hypot(dx, dy) || 1, sp = 220 + R() * 260;
      sh.push({ poly, c: [cxp, cyp], vx: dx / dd * sp, vy: dy / dd * sp * 0.7 - 120 * R(), spin: (R() - 0.5) * 8, dl: r * 0.035 + R() * 0.03 });
    }
    return { I, V, RAD, NA, sh };
  })();
  CELLS[21] = abCell((k, w, h, u, a, b) => {
    const S = [scMtn, scrA], crack = eOut(P(u, TA - 0.2, TA + 0.15)) * 420, tb = TA + 0.32;
    if (u < tb) {
      S[a](k, w, h);
      if (crack > 0) {
        const { I, V, RAD, NA } = SHARDS; k.strokeStyle = '#fff'; k.lineWidth = 3; k.lineCap = 'round'; k.lineJoin = 'round'; k.globalAlpha = 0.95;
        for (let i = 0; i < NA; i++) { k.beginPath(); k.moveTo(I[0], I[1]); for (let r = 1; r < RAD.length; r++) { if (RAD[r] * 0.85 > crack) break; k.lineTo(V[r][i][0], V[r][i][1]); } k.stroke(); }
        for (let r = 1; r < RAD.length - 1; r++) { if (RAD[r] * 1.4 > crack) break; k.beginPath(); for (let i = 0; i <= NA; i++) { const p = V[r][i % NA]; i ? k.lineTo(p[0], p[1]) : k.moveTo(p[0], p[1]); } k.stroke(); }
        k.globalAlpha = 1;
        const fl = 1 - P(u, TA - 0.2, TA + 0.1); if (fl > 0) { k.fillStyle = '#fff'; star(k, I[0], I[1], 26 * fl + 6, 0.3, 0.3, 6); k.fill(); }
      }
      return;
    }
    S[b](k, w, h);
    TK.setTransform(1, 0, 0, 1, 0, 0); TK.globalCompositeOperation = 'source-over'; TK.clearRect(0, 0, w, h); S[a](TK, w, h);
    for (const s of SHARDS.sh) {
      const t = u - tb - s.dl; let al = 1, x = 0, y = 0, rt = 0, sc = 1;
      if (t > 0) { x = s.vx * t; y = s.vy * t + 0.5 * 1300 * t * t; rt = s.spin * t; sc = 1 - 0.35 * Math.min(1, t); al = 1 - P(t, 0.55, 1.0); }
      if (al <= 0) continue;
      k.save(); k.globalAlpha = al; k.translate(s.c[0] + x, s.c[1] + y); k.rotate(rt); k.scale(sc, sc); k.translate(-s.c[0], -s.c[1]);
      polyPath(k, s.poly); k.save(); k.clip(); k.drawImage(TMP, 0, 0); k.restore();
      k.strokeStyle = 'rgba(255,255,255,.85)'; k.lineWidth = 2.5; polyPath(k, s.poly); k.stroke();
      k.restore();
    }
  });

  const XL = [
    { name: '背板', o: [-27, -50, 54, 100, 10], side: '#B8483D', draw: g => { g.fillStyle = C.coral; rr(g, -27, -50, 54, 100, 10); g.fill(); g.fillStyle = C.navy; g.beginPath(); g.arc(-12, -34, 7, 0, 7); g.fill(); g.beginPath(); g.arc(2, -34, 5, 0, 7); g.fill(); } },
    { name: '电池', o: [-21, -40, 42, 68, 6], side: '#17946F', draw: g => { g.fillStyle = C.mint; rr(g, -21, -40, 42, 68, 6); g.fill(); g.fillStyle = '#fff'; g.fillRect(-3, -18, 6, 20); g.fillRect(-10, -11, 20, 6); } },
    { name: '主板', o: [-25, -48, 50, 96, 6], side: '#2550B5', draw: g => { g.fillStyle = C.blue; rr(g, -25, -48, 50, 96, 6); g.fill(); g.fillStyle = C.yel; g.fillRect(-16, -38, 16, 14); g.fillRect(4, -30, 12, 10); g.fillRect(-14, 8, 26, 14); g.fillStyle = C.mint; g.fillRect(-18, -14, 34, 3); g.fillRect(-4, 26, 3, 16); } },
    { name: '屏幕', o: [-27, -50, 54, 100, 10], side: '#AEB8D4', draw: g => { g.fillStyle = '#fff'; rr(g, -27, -50, 54, 100, 10); g.fill(); g.fillStyle = C.navy2; rr(g, -22, -44, 44, 88, 6); g.fill(); for (let i = 0; i < 6; i++) { g.fillStyle = PAL[i % 4]; rr(g, -16 + (i % 2) * 18, -36 + Math.floor(i / 2) * 18, 13, 13, 3); g.fill(); } } },
  ];
  const ISO = (px, py) => [(px - py) * 0.866, (px + py) * 0.5];
  CELLS[22] = (k, w, h, u) => {
    u = snapU(u);
    stage(k);
    const X = 200, Y = 156, SP = 30, SC = 0.85;
    const ex = i => backOut(P(u, 0.45 + i * 0.08, 1.2 + i * 0.08), 1.3) * (1 - eIO(P(u, 3.25 + (3 - i) * 0.07, 3.95 + (3 - i) * 0.07)));
    const E = XL.map((_, i) => ex(i)), zs = E.map((e, i) => i * 7 + e * i * SP + 3 * Math.sin(2 * Math.PI * 2 * u / CYC + i) * clamp(e));
    k.fillStyle = 'rgba(0,0,0,.3)'; k.beginPath(); k.ellipse(X, Y + 40, 64, 13, 0, 0, 7); k.fill();
    const e3 = clamp(E[3]); if (e3 > 0.03) { k.save(); k.setLineDash([4, 7]); k.strokeStyle = C.dim; k.lineWidth = 2; k.globalAlpha = e3;[[-27, -50], [27, 50], [-27, 50]].forEach(([px, py]) => { const [ix, iy] = ISO(px * SC, py * SC); k.beginPath(); k.moveTo(X + ix, Y + iy - zs[0]); k.lineTo(X + ix, Y + iy - zs[3]); k.stroke(); }); k.restore(); }
    XL.forEach((L, i) => {
      const z = zs[i];
      for (let dz = 6; dz >= 1; dz--) { k.save(); k.translate(X, Y - z + dz); k.scale(SC, SC); k.transform(0.866, 0.5, -0.866, 0.5, 0, 0); k.fillStyle = L.side; rr(k, ...L.o); k.fill(); k.restore(); }
      k.save(); k.translate(X, Y - z); k.scale(SC, SC); k.transform(0.866, 0.5, -0.866, 0.5, 0, 0); L.draw(k); k.restore();
      const a = clamp(E[i]); if (a > 0.03) {
        const [rx, ry] = ISO((L.o[0] + L.o[2]) * SC, L.o[1] * SC), sx = X + rx + 6, sy = Y + ry - z + 4, lx = 352, ly = Y + 8 - z - i * 2;
        k.globalAlpha = a; k.strokeStyle = C.dim; k.lineWidth = 2; k.beginPath(); k.moveTo(sx, sy); k.lineTo(lx - 10, ly); k.stroke();
        k.fillStyle = C.dim; k.beginPath(); k.arc(sx, sy, 4, 0, 7); k.fill();
        txt(k, L.name, lx, ly + 1, `800 26px ${JP}`, '#fff', 'left', 'middle'); k.globalAlpha = 1;
      }
    });
  };

  CELLS[23] = (k, w, h, u) => {
    u = snapU(u);
    const s2 = eIO(P(u, 0.45, 0.95)), s3 = eIO(P(u, 1.4, 1.9)), m = eIO(P(u, 3.75, 4.4));
    let b1 = lerp(lerp(w, w / 2, s2), w / 3, s3), b2 = lerp(w, 2 * w / 3, s3);
    b1 = lerp(b1, w, m); b2 = lerp(b2, w, m);
    pnSea(k, 0, b1, h, u, false);
    if (b1 < w - 0.5) pnCity(k, b1, Math.max(b1, b2), h, u, false);
    if (b2 < w - 0.5) pnField(k, b2, w, h, u, false);
    k.fillStyle = '#fff';[b1, b2].forEach(b => { if (b < w - 0.5) k.fillRect(b - 3, 0, 6, h); });
  };

  return { width: CW, height: CH, cycle: CYC, cells: CELLS, fonts: [] };
});

MotionPrompt.pack('lp2', function () {
  const CW = 539, CH = 208;
  const CYC = 4.7;
  const LOOP = CYC * 2;
  const C = {
    desk: '#E7EAF0', win: '#FFFFFF', bar: '#F3F5F8', rule: '#E2E6ED', ink: '#1C2333', sub: '#7D879B',
    faint: '#DCE1EA', soft: '#F3F5F9', skel: '#E4E8EF', acc: '#FF5A2C', accL: '#FFE5DB', blue: '#3B64E8', blueL: '#E1E8FF'
  };
  const JP = 'DMGothic,DMGothicFull,"PingFang SC",sans-serif';
  const EN = '"Avenir Next", "Helvetica Neue", system-ui, sans-serif';
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, x) => a + (b - a) * x;
  const P = (t, a, b) => clamp((t - a) / (b - a));
  const eIO = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const eIOs = x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  const eOut = x => 1 - Math.pow(1 - x, 3);
  const eIn = x => x * x * x;
  const mod = (a, n) => ((a % n) + n) % n;
  const snapU = u => mod(Math.round(u * 1e6) / 1e6, CYC);
  const eEl = x => x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x - 0.075) * 2 * Math.PI / 0.3) + 1;
  function rr(k, x, y, w, h, r) { k.beginPath(); k.roundRect(x, y, w, h, r); }
  function txt(k, s, x, y, font, col, align = 'left', base = 'alphabetic', ls = '0px') {
    k.font = font; k.fillStyle = col; k.textAlign = align; k.textBaseline = base; k.letterSpacing = ls; k.fillText(s, x, y); k.letterSpacing = '0px';
  }
  function steps(keys, u) {
    u = mod(u, CYC);
    if (u <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) if (u < keys[i][0]) { const [t0, a] = keys[i - 1], [t1, b] = keys[i]; return lerp(a, b, eIO((u - t0) / (t1 - t0))); }
    return keys[keys.length - 1][1];
  }
  function path(keys, u) {
    u = mod(u, CYC);
    if (u <= keys[0][0]) return [keys[0][1], keys[0][2]];
    for (let i = 1; i < keys.length; i++) if (u < keys[i][0]) { const a = keys[i - 1], b = keys[i], f = eIO((u - a[0]) / (b[0] - a[0])); return [lerp(a[1], b[1], f), lerp(a[2], b[2], f)]; }
    const l = keys[keys.length - 1]; return [l[1], l[2]];
  }
  function trans(on, u, dur, ease = eOut) {
    const s = on(u);
    for (let i = 0, t = u; i < 600; i++, t -= 1 / 120) if (on(t - 1 / 120) !== s) { const q = ease(P(u, t, t + dur)); return s ? q : 1 - q; }
    return s ? 1 : 0;
  }
  const WIN = { x: 14, y: 8, w: 511, h: 192, r: 10, bar: 24 };
  const VW = WIN.w, VH = WIN.h - WIN.bar;
  function frame(k, url = 'example.com') {
    k.fillStyle = C.desk; k.fillRect(0, 0, CW, CH);
    k.save(); k.shadowColor = 'rgba(28,35,51,.16)'; k.shadowBlur = 16; k.shadowOffsetY = 4;
    k.fillStyle = C.win; rr(k, WIN.x, WIN.y, WIN.w, WIN.h, WIN.r); k.fill(); k.restore();
    k.save(); rr(k, WIN.x, WIN.y, WIN.w, WIN.h, WIN.r); k.clip();
    k.fillStyle = C.bar; k.fillRect(WIN.x, WIN.y, WIN.w, WIN.bar); k.fillStyle = C.rule; k.fillRect(WIN.x, WIN.y + WIN.bar - 1, WIN.w, 1); k.restore();
    for (let i = 0; i < 3; i++) { k.fillStyle = '#CDD3DD'; k.beginPath(); k.arc(WIN.x + 15 + i * 12, WIN.y + 12, 3.6, 0, 7); k.fill(); }
    k.fillStyle = '#E6E9EF'; rr(k, WIN.x + WIN.w / 2 - 110, WIN.y + 5, 220, 14, 7); k.fill();
    txt(k, url, WIN.x + WIN.w / 2, WIN.y + 12.5, `500 9.5px ${EN}`, C.sub, 'center', 'middle');
  }
  function view(k, fn) {
    k.save(); rr(k, WIN.x, WIN.y + WIN.bar, VW, VH, [0, 0, WIN.r, WIN.r]); k.clip(); k.translate(WIN.x, WIN.y + WIN.bar);
    k.fillStyle = '#fff'; k.fillRect(0, 0, VW, VH); fn(); k.restore();
  }
  function sbar(k, pos, ratio = 0.42) { const th = (VH - 8) * ratio; k.fillStyle = 'rgba(28,35,51,.38)'; rr(k, VW - 9, 4 + (VH - 8 - th) * clamp(pos), 5, th, 2.5); k.fill(); }
  function bars(k, x, y, w, n, col = C.faint, hh = 6, gap = 11, last = 0.62) {
    k.fillStyle = col; for (let i = 0; i < n; i++) { rr(k, x, y + i * gap, i === n - 1 && n > 1 ? w * last : w, hh, hh / 2); k.fill(); }
  }
  const PICS = [
    { sky: ['#A9C0FF', '#E4EBFF'], sun: '#FF5A2C', sx: .74, sy: .32, m1: '#7D9AF4', m2: '#4B6BDB' },
    { sky: ['#FFC7B2', '#FFEDE5'], sun: '#FFFFFF', sx: .28, sy: .34, m1: '#F4977A', m2: '#DD5F3B' },
    { sky: ['#3A4884', '#7484CC'], sun: '#FFE5DB', sx: .6, sy: .3, m1: '#2B3770', m2: '#1C2349' }
  ];
  const M1 = [[0, .62], [.22, .4], [.42, .56], [.66, .3], [.86, .5], [1, .42]], M2 = [[0, .8], [.28, .6], [.5, .76], [.76, .58], [1, .74]];
  function mount(k, w, h, pts, col, flip) { k.fillStyle = col; k.beginPath(); k.moveTo(flip ? w : 0, h + 1); pts.forEach(([a, b]) => k.lineTo((flip ? 1 - a : a) * w, b * h)); k.lineTo(flip ? 0 : w, h + 1); k.closePath(); k.fill(); }
  function pic(k, x, y, w, h, v = 0, r = 6, z = 1) {
    const p = PICS[v % PICS.length];
    k.save(); rr(k, x, y, w, h, r); k.clip();
    k.translate(x + w / 2, y + h / 2); k.scale(z, z); k.translate(-w / 2, -h / 2);
    const g = k.createLinearGradient(0, 0, 0, h); g.addColorStop(0, p.sky[0]); g.addColorStop(1, p.sky[1]); k.fillStyle = g; k.fillRect(-1, -1, w + 2, h + 2);
    k.fillStyle = p.sun; k.beginPath(); k.arc(w * p.sx, h * p.sy, Math.min(w, h) * 0.13, 0, 7); k.fill();
    mount(k, w, h, M1, p.m1, v % 2); mount(k, w, h, M2, p.m2, (v + 1) % 2);
    k.restore();
  }
  function btn(k, x, y, w, h, label, col = C.acc, tcol = '#fff', fs = 12) {
    k.fillStyle = col; rr(k, x, y, w, h, h / 2); k.fill(); txt(k, label, x + w / 2, y + h / 2 + 0.5, `700 ${fs}px ${JP}`, tcol, 'center', 'middle');
  }
  function logo(k, x, y, col = C.ink) { k.fillStyle = C.acc; rr(k, x, y - 7, 14, 14, 4); k.fill(); txt(k, 'SAMPLE', x + 20, y + 0.5, `800 12px ${EN}`, col, 'left', 'middle', '1px'); }
  const NAVX = [300, 346, 392];
  function header(k, y, active = -1) {
    k.fillStyle = '#fff'; k.fillRect(0, y, VW, 34); k.fillStyle = C.rule; k.fillRect(0, y + 33, VW, 1);
    logo(k, 18, y + 17);
    ['特点', '价格', 'FAQ'].forEach((s, i) => txt(k, s, NAVX[i], y + 17.5, `600 12px ${JP}`, active === i ? C.acc : C.ink, 'left', 'middle'));
    btn(k, 428, y + 7, 70, 20, '免费试用', C.acc, '#fff', 10.5);
  }
  function cursor(k, x, y, press = 0) {
    const s = 1.2 * (1 - 0.12 * press);
    k.save(); k.translate(x, y); k.scale(s, s); k.beginPath();
    [[0, 0], [0, 16.5], [4.2, 12.6], [7, 19], [9.8, 17.8], [7.1, 11.6], [12.6, 11.6]].forEach(([a, b], i) => i ? k.lineTo(a, b) : k.moveTo(a, b));
    k.closePath(); k.lineJoin = 'round'; k.lineWidth = 1.6; k.strokeStyle = '#fff'; k.fillStyle = C.ink; k.fill(); k.stroke(); k.restore();
  }
  function click(k, x, y, u, times) {
    let press = 0;
    for (const tc of times) {
      const d = mod(u - tc + 0.1, CYC) - 0.1;
      if (d > -0.1 && d < 0.12) press = Math.max(press, 1 - Math.abs(d - 0.01) / 0.11);
      if (d >= 0 && d < 0.35) { const q = d / 0.35; k.strokeStyle = `rgba(28,35,51,${0.45 * (1 - q)})`; k.lineWidth = 2; k.beginPath(); k.arc(x, y, 5 + 13 * eOut(q), 0, 7); k.stroke(); }
    }
    cursor(k, x, y, clamp(press));
  }
  function spinner(k, x, y, r, u, col = C.acc) {
    const a = u / 0.8 * Math.PI * 2;
    k.lineCap = 'round'; k.lineWidth = r * 0.28; k.strokeStyle = C.faint; k.beginPath(); k.arc(x, y, r, 0, 7); k.stroke();
    k.strokeStyle = col; k.beginPath(); k.arc(x, y, r, a, a + Math.PI * 0.6); k.stroke(); k.lineCap = 'butt';
  }
  function enteredAt(sy, top, line, u) {
    const dt = 1 / 120, y = t => top - sy(t);
    if (y(u) >= VH) return null;
    for (let t = u; t > u - CYC; t -= dt) {
      const a = y(t), b = y(t - dt);
      if (a >= VH) return null;
      if (a < line && b >= line) return t - dt + dt * (b - line) / (b - a);
    }
    return y(u) < line ? -1e9 : null;
  }
  function hex(c) { if (c[0] === 'r') return c.match(/\d+/g).slice(0, 3).map(Number); return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function mix(a, b, t) { const A = hex(a), B = hex(b); return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`; }
  function heartPath(k, s) { k.beginPath(); k.moveTo(0, s * 0.92); k.bezierCurveTo(-s * 1.75, -s * 0.12, -s * 0.85, -s * 1.2, 0, -s * 0.42); k.bezierCurveTo(s * 0.85, -s * 1.2, s * 1.75, -s * 0.12, 0, s * 0.92); k.closePath(); }
  function check(k, x, y, s, col, lw, f = 1) {
    const pts = [[-0.5, 0.02], [-0.14, 0.38], [0.52, -0.34]], L1 = Math.hypot(0.36, 0.36), L2 = Math.hypot(0.66, 0.72), L = (L1 + L2) * clamp(f);
    k.save(); k.translate(x, y); k.strokeStyle = col; k.lineWidth = lw; k.lineCap = 'round'; k.lineJoin = 'round'; k.beginPath(); k.moveTo(pts[0][0] * s, pts[0][1] * s);
    if (L <= L1) { const q = L / L1; k.lineTo(lerp(pts[0][0], pts[1][0], q) * s, lerp(pts[0][1], pts[1][1], q) * s); }
    else { const q = (L - L1) / L2; k.lineTo(pts[1][0] * s, pts[1][1] * s); k.lineTo(lerp(pts[1][0], pts[2][0], q) * s, lerp(pts[1][1], pts[2][1], q) * s); }
    if (L > 0) k.stroke(); k.restore();
  }
  function lastSwitch(on, u) { const s = on(u); for (let i = 0, t = u; i < 600; i++, t -= 1 / 120) if (on(t - 1 / 120) !== s) return t; return null; }
  const GREEN = '#1E9E5A', RED = '#E5383B', HEART = '#F23D5C';
  const CELLS = [];

  CELLS[0] = (k, w, h, u) => {
    u = snapU(u);
    frame(k);
    const y = steps([[0.3, 0], [2.3, 190], [3.0, 190], [4.3, 0]], u);
    const ROWS = [[72, '2018', '创立'], [126, '2020', '第一家店开业'], [180, '2022', '会员一万人'], [234, '2024', 'App 上线'], [288, '2026', '走向海外']];
    const LX = 168, L = y + 126;
    view(k, () => {
      k.save(); k.translate(0, -y);
      txt(k, 'HISTORY', 34, 34, `800 11px ${EN}`, C.acc, 'left', 'alphabetic', '2px');
      txt(k, '历程', 34, 60, `800 20px ${JP}`, C.ink);
      pic(k, 34, 76, 100, 62, 0, 6); bars(k, 34, 148, 90, 2);
      k.fillStyle = C.faint; rr(k, LX - 1.5, 52, 3, 248, 1.5); k.fill();
      k.fillStyle = C.acc; rr(k, LX - 1.5, 52, 3, clamp(L - 52, 0, 248), 1.5); k.fill();
      for (const [iy, yr, lab] of ROWS) {
        const q = eOut(clamp((L - iy) / 22));
        k.fillStyle = '#fff'; k.beginPath(); k.arc(LX, iy, 7.5, 0, 7); k.fill();
        k.lineWidth = 2.5; k.strokeStyle = q > 0 ? C.acc : C.faint; k.stroke();
        if (q > 0) { k.fillStyle = C.acc; k.beginPath(); k.arc(LX, iy, 4 * q, 0, 7); k.fill(); }
        k.save(); k.globalAlpha = q; k.translate(16 * (1 - q), 0);
        txt(k, yr, LX + 22, iy + 6, `800 18px ${EN}`, C.acc);
        txt(k, lab, LX + 82, iy + 5, `700 15px ${JP}`, C.ink);
        bars(k, LX + 82, iy + 15, 190, 1, C.faint, 5);
        k.restore();
      }
      k.restore();
      sbar(k, y / 190, 0.45);
    });
  };

  CELLS[1] = (k, w, h, u) => {
    u = snapU(u);
    frame(k);
    const p = steps([[0.3, 0], [2.6, 1], [3.2, 1], [4.4, 0]], u), y = p * 40;
    const LINES = ['每天的一点小心思，', '让生活一点点', '改变。'], F = `800 27px ${JP}`;
    const total = LINES.join('').length;
    view(k, () => {
      k.save(); k.translate(0, -y);
      txt(k, 'ABOUT US', 40, 34, `800 11px ${EN}`, C.acc, 'left', 'alphabetic', '2px');
      let n = 0;
      LINES.forEach((s, li) => {
        let x = 40; k.font = F;
        for (const ch of s) {
          const f = clamp(p * (total + 2) - n);
          txt(k, ch, x, 72 + li * 38, F, mix('#D6DBE4', C.ink, f));
          k.font = F; x += k.measureText(ch).width; n++;
        }
      });
      bars(k, 40, 168, 300, 3, C.faint, 6, 12, 0.7);
      k.restore();
      sbar(k, p, 0.55);
    });
  };

  CELLS[2] = (k, w, h, u) => {
    u = snapU(u);
    frame(k);
    const s = steps([[0.3, 0], [1.1, 1], [1.6, 1], [2.4, 2], [3.2, 2], [4.4, 0]], u);
    const CARDS = [[C.blueL, C.ink, C.acc, '01', '策划', 0], [C.ink, '#fff', C.acc, '02', '制作', 2], [C.acc, '#fff', '#fff', '03', '交付', 1]];
    const X = 70, CWD = 371, CHT = 124, STEP = 170;
    view(k, () => {
      k.fillStyle = C.soft; k.fillRect(0, 0, VW, VH);
      CARDS.forEach(([bg, fg, nc, no, ttl, pv], i) => {
        const top = Math.max(14 + i * 12, 16 + i * STEP - s * STEP);
        const cov = clamp(s - i), sc = 1 - 0.045 * cov - 0.045 * clamp(s - i - 1);
        k.save(); k.translate(VW / 2, top); k.scale(sc, sc); k.translate(-VW / 2, 0);
        k.save(); k.shadowColor = 'rgba(28,35,51,.22)'; k.shadowBlur = 14; k.shadowOffsetY = -2; k.fillStyle = bg; rr(k, X, 0, CWD, CHT, 12); k.fill(); k.restore();
        txt(k, no, X + 24, 44, `800 26px ${EN}`, nc);
        txt(k, ttl, X + 24, 78, `800 20px ${JP}`, fg);
        bars(k, X + 24, 92, 140, 2, i === 0 ? '#C3CDEA' : 'rgba(255,255,255,.35)');
        pic(k, X + CWD - 160, 14, 144, CHT - 28, pv, 8);
        if (cov > 0) { k.fillStyle = `rgba(28,35,51,${0.16 * cov})`; rr(k, X, 0, CWD, CHT, 12); k.fill(); }
        k.restore();
      });
      sbar(k, s / 2, 0.4);
    });
  };

  CELLS[3] = (k, w, h, u) => {
    u = snapU(u);
    frame(k);
    const y = steps([[0.3, 0], [1.2, VH], [1.8, VH], [2.7, 2 * VH], [3.3, 2 * VH], [4.4, 0]], u), s = y / VH;
    const BG = ['#FFEBD9', '#1E2A4A', '#DDE6FF'], DK = [0, 1, 0];
    const i0 = Math.min(1, Math.floor(s)), t = eIOs(clamp((s - i0 - 0.05) / 0.9));
    const bg = mix(BG[i0], BG[i0 + 1], t), dk = lerp(DK[i0], DK[i0 + 1], t);
    const fg = mix(C.ink, '#FFFFFF', dk), bc = mix('#E3C9B4', '#45507A', dk);
    view(k, () => {
      k.fillStyle = bg; k.fillRect(0, 0, VW, VH);
      k.save(); k.translate(0, -y);
      const S = [['01  MORNING', '清晨时光'], ['02  NIGHT', '夜晚休憩'], ['03  HOLIDAY', '周末出游']];
      S.forEach(([no, ttl], i) => {
        const y0 = i * VH;
        txt(k, no, 40, y0 + 58, `800 12px ${EN}`, C.acc, 'left', 'alphabetic', '2px');
        txt(k, ttl, 40, y0 + 92, `800 24px ${JP}`, fg);
        k.fillStyle = bc; for (let j = 0; j < 2; j++) { rr(k, 40, y0 + 108 + j * 12, j ? 110 : 180, 6, 3); k.fill(); }
      });
      k.fillStyle = C.acc; k.beginPath(); k.arc(380, 84, 34, 0, 7); k.fill();
      k.strokeStyle = C.acc; k.lineWidth = 4; k.lineCap = 'round';
      for (let j = 0; j < 8; j++) { const a = j * Math.PI / 4; k.beginPath(); k.moveTo(380 + Math.cos(a) * 44, 84 + Math.sin(a) * 44); k.lineTo(380 + Math.cos(a) * 54, 84 + Math.sin(a) * 54); k.stroke(); }
      k.fillStyle = '#FFE5DB'; k.beginPath(); k.arc(380, VH + 84, 36, 0, 7); k.fill();
      k.fillStyle = bg; k.beginPath(); k.arc(396, VH + 72, 32, 0, 7); k.fill();
      k.fillStyle = '#FFE5DB';[[300, 50], [450, 40], [330, 130], [470, 120]].forEach(([a, b]) => { k.beginPath(); k.arc(a, VH + b, 2.5, 0, 7); k.fill(); });
      pic(k, 300, 2 * VH + 28, 180, 112, 0, 10);
      k.restore();
      sbar(k, s / 2, 0.34);
    });
  };

  CELLS[4] = (k, w, h, u) => {
    u = snapU(u);
    frame(k);
    const SY = t => steps([[0.3, 0], [1.1, 170], [1.5, 170], [1.9, 100], [2.4, 100], [2.9, 230], [3.3, 230], [4.3, 0]], t), y = SY(u);
    const hidden = t => { const yt = SY(t); if (yt < 34) return false; for (let i = 0, tt = t; i < 600; i++, tt -= 1 / 120) { const d = SY(tt) - SY(tt - 1 / 120); if (Math.abs(d) > 1e-4) return d > 0; } return false; };
    const q = trans(hidden, u, 0.3, eIOs);
    view(k, () => {
      k.save(); k.translate(0, -y);
      pic(k, 24, 48, 214, 110, 1, 8);
      txt(k, '旅行准备，', 262, 84, `800 22px ${JP}`, C.ink); txt(k, '一次搞定。', 262, 114, `800 22px ${JP}`, C.ink); bars(k, 262, 128, 200, 2); btn(k, 262, 152, 100, 24, '了解更多');
      k.fillStyle = C.soft; k.fillRect(0, 196, VW, 260);
      txt(k, '热门套餐', VW / 2, 232, `800 17px ${JP}`, C.ink, 'center');
      for (let r = 0; r < 2; r++) for (let i = 0; i < 3; i++) { const x = 34 + i * 152, y0 = 250 + r * 100; k.fillStyle = '#fff'; rr(k, x, y0, 136, 88, 8); k.fill(); pic(k, x + 8, y0 + 8, 120, 46, (i + r) % 3, 5); bars(k, x + 10, y0 + 64, 100, 2, C.faint, 5, 10); }
      k.restore();
      const hy = -36 * q;
      if (y > 0 && q < 1) { const g = k.createLinearGradient(0, hy + 34, 0, hy + 46); g.addColorStop(0, `rgba(28,35,51,${0.14 * clamp(y / 30)})`); g.addColorStop(1, 'rgba(28,35,51,0)'); k.fillStyle = g; k.fillRect(0, hy + 34, VW, 12); }
      header(k, hy);
      sbar(k, y / 230, 0.42);
    });
  };

  CELLS[5] = (k, w, h, u) => {
    u = snapU(u);
    frame(k);
    const y = steps([[0.3, 0], [0.9, 100], [1.35, 100], [1.95, 200], [2.4, 200], [3.0, 300], [3.5, 300], [4.4, 0]], u);
    const NAMES = ['前言', '用法', '价格', '常见问题'], TX = 160;
    const act = t => { const yy = steps([[0.3, 0], [0.9, 100], [1.35, 100], [1.95, 200], [2.4, 200], [3.0, 300], [3.5, 300], [4.4, 0]], t); let a = 0; for (let i = 0; i < 4; i++) if (i * 100 <= yy + 40) a = i; return a; };
    view(k, () => {
      k.save(); k.beginPath(); k.rect(TX - 10, 0, VW, VH); k.clip(); k.translate(0, -y);
      NAMES.forEach((s, i) => {
        const y0 = i * 100 + 14;
        txt(k, `${i + 1}. ${s}`, TX + 14, y0 + 22, `800 16px ${JP}`, C.ink);
        bars(k, TX + 14, y0 + 38, 300, 3, C.faint, 6, 12, 0.6);
      });
      k.restore();
      k.fillStyle = C.soft; k.fillRect(0, 0, TX - 10, VH);
      txt(k, '目录', 20, 30, `800 12px ${JP}`, C.sub);
      const a = act(u);
      NAMES.forEach((s, i) => {
        const q = trans(t => act(t) === i, u, 0.25), iy = 54 + i * 30;
        if (q > 0) { k.fillStyle = `rgba(255,229,219,${q})`; rr(k, 12, iy - 13, TX - 34, 26, 6); k.fill(); k.fillStyle = C.acc; k.globalAlpha = q; rr(k, 12, iy - 13, 4, 26, 2); k.fill(); k.globalAlpha = 1; }
        txt(k, s, 26, iy + 1, `${a === i ? 800 : 600} 13px ${JP}`, mix('#7D879B', C.acc, q), 'left', 'middle');
      });
      sbar(k, y / 300, 0.36);
    });
  };

  CELLS[6] = (k, w, h, u) => {
    u = snapU(u);
    frame(k);
    const CLK = 2.6, MAX = 300;
    const y = u < CLK + 0.02 ? steps([[0.2, 0], [1.7, MAX]], u) : MAX * (1 - eIO(P(u, CLK + 0.06, CLK + 0.66)));
    const cur = t => path([[0, 340, 205], [1.6, 340, 205], [2.35, 472, 138], [2.95, 472, 138], [3.6, 340, 205], [4.7, 340, 205]], t);
    const [cx, cy] = cur(u);
    view(k, () => {
      k.save(); k.translate(0, -y);
      txt(k, 'BLOG', 70, 32, `800 11px ${EN}`, C.acc, 'left', 'alphabetic', '2px');
      txt(k, '周末就能去的小旅行', 70, 58, `800 19px ${JP}`, C.ink);
      pic(k, 70, 72, 371, 100, 2, 8);
      for (let b = 0; b < 3; b++) { const y0 = 192 + b * 82; k.fillStyle = C.ink; rr(k, 70, y0, 150, 9, 4.5); k.fill(); bars(k, 70, y0 + 22, 371, 4, C.faint, 6, 12); }
      k.fillStyle = C.ink; k.fillRect(0, 438, VW, 80); logo(k, 70, 454, '#fff'); bars(k, 300, 451, 140, 1, 'rgba(255,255,255,.3)');
      k.restore();
      const tb = eOut(clamp((y - 80) / 60));
      if (tb > 0) {
        const hov = trans(t => { const [a, b] = cur(t); return Math.hypot(a - 472, b - 138) < 20; }, u, 0.2);
        k.save(); k.globalAlpha = tb; k.translate(0, 10 * (1 - tb));
        k.save(); k.shadowColor = 'rgba(28,35,51,.3)'; k.shadowBlur = 10; k.shadowOffsetY = 3; k.fillStyle = mix(C.acc, '#D9431C', hov); k.beginPath(); k.arc(472, 138, 19, 0, 7); k.fill(); k.restore();
        k.strokeStyle = '#fff'; k.lineWidth = 2.6; k.lineCap = 'round'; k.lineJoin = 'round'; k.beginPath(); k.moveTo(465, 142); k.lineTo(472, 134.5); k.lineTo(479, 142); k.stroke();
        k.restore();
      }
      sbar(k, y / MAX, 0.34);
      click(k, cx, cy, u, [CLK]);
    });
  };

  CELLS[7] = (k, w, h, u) => {
    u = snapU(u);
    frame(k);
    const p = steps([[0.3, 0], [2.3, 1], [3.0, 1], [4.4, 0]], u);
    const x = lerp(178, 0, p), y = lerp(58, 0, p), ww = lerp(155, VW, p), hh = lerp(90, VH, p);
    view(k, () => {
      const a = 1 - clamp(p * 2.2);
      k.save(); k.globalAlpha = a;
      txt(k, '走进风景', VW / 2, 38, `800 19px ${JP}`, C.ink, 'center');
      bars(k, 34, 66, 120, 4, C.faint, 6, 14); bars(k, 357, 66, 120, 4, C.faint, 6, 14);
      k.restore();
      pic(k, x, y, ww, hh, 0, lerp(8, 0, p));
      const b = clamp((p - 0.7) / 0.3);
      if (b > 0) { k.save(); k.globalAlpha = b; txt(k, '欢迎来到绝景', VW / 2, VH / 2 + 2, `800 26px ${JP}`, '#fff', 'center', 'middle', '2px'); k.restore(); }
      sbar(k, p * 0.6, 0.4);
    });
  };

  const TC = document.createElement('canvas'); TC.width = 220; TC.height = 132; const TCK = TC.getContext('2d');
  const TD = document.createElement('canvas'); TD.width = 300; TD.height = 190; const TDK = TD.getContext('2d');
  const TDW = 300, TDH = 190;
  CELLS[8] = (k, w, h, u) => {
    u = snapU(u);
    frame(k);
    const BX = VW / 2, BY = 82, BW = 220, BH = 132, MAXA = 0.32, D = 520;
    const cur = t => path([[0, 80, 190], [0.6, 190, 40], [1.2, 335, 50], [1.8, 330, 125], [2.4, 180, 122], [3.0, 258, 80], [3.6, 470, 190], [4.7, 80, 190]], t);
    const inside = t => { const [x, y] = cur(t); return Math.abs(x - BX) < BW / 2 && Math.abs(y - BY) < BH / 2; };
    const q = trans(inside, u, 0.4, eOut), [cx, cy] = cur(u);
    const nx = clamp((cx - BX) / (BW / 2), -1, 1), ny = clamp((cy - BY) / (BH / 2), -1, 1);
    const ry = nx * MAXA * q, rx = ny * MAXA * q;
    const m = k.getTransform(), S = Math.min(4, Math.max(1, Math.hypot(m.a, m.b)));
    const cw = Math.ceil(BW * S), ch = Math.ceil(BH * S), dw = Math.ceil(TDW * S), dh = Math.ceil(TDH * S);
    if (TC.width !== cw || TC.height !== ch) { TC.width = cw; TC.height = ch; }
    if (TD.width !== dw || TD.height !== dh) { TD.width = dw; TD.height = dh; }
    const g = TCK; g.clearRect(0, 0, TC.width, TC.height);
    g.save(); g.scale(S, S); rr(g, 0, 0, BW, BH, 14); g.clip();
    const gr = g.createLinearGradient(0, 0, BW, BH); gr.addColorStop(0, '#2B4FD6'); gr.addColorStop(1, '#7D9AF4'); g.fillStyle = gr; g.fillRect(0, 0, BW, BH);
    g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.arc(BW - 30, 20, 70, 0, 7); g.fill();
    logo(g, 18, 26, '#fff');
    g.fillStyle = '#FFD9C9'; rr(g, 18, 52, 34, 26, 5); g.fill();
    txt(g, 'MEMBER CARD', 18, 104, `700 11px ${EN}`, 'rgba(255,255,255,.8)', 'left', 'alphabetic', '2px');
    txt(g, '0123  4567  8910', 18, 122, `700 13px ${EN}`, '#fff', 'left', 'alphabetic', '1px');
    const gx = (nx * 0.5 + 0.5) * BW, gy = (ny * 0.5 + 0.5) * BH, gl = g.createRadialGradient(gx, gy, 0, gx, gy, 130);
    gl.addColorStop(0, `rgba(255,255,255,${0.42 * q})`); gl.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gl; g.fillRect(0, 0, BW, BH);
    g.restore();
    const d = TDK; d.clearRect(0, 0, TD.width, TD.height);
    const N = 44;
    for (let i = 0; i < N; i++) {
      const v0 = i / N - 0.5, v1 = (i + 1) / N - 0.5, z0 = v0 * BH * Math.sin(rx), z1 = v1 * BH * Math.sin(rx), s0 = D / (D + z0), s1 = D / (D + z1);
      const y0 = TDH / 2 + v0 * BH * Math.cos(rx) * s0, y1 = TDH / 2 + v1 * BH * Math.cos(rx) * s1, sw = BW * (s0 + s1) / 2;
      d.drawImage(TC, 0, i * BH / N * S, BW * S, (BH / N + 0.6) * S, (TDW / 2 - sw / 2) * S, y0 * S, sw * S, (y1 - y0 + 0.6) * S);
    }
    view(k, () => {
      k.fillStyle = C.soft; k.fillRect(0, 0, VW, VH);
      k.fillStyle = `rgba(28,35,51,${0.1 + 0.05 * q})`; k.beginPath(); k.ellipse(BX - nx * 10 * q, 158, 96, 7, 0, 0, 7); k.fill();
      for (let i = 0; i < N; i++) {
        const f0 = i / N - 0.5, f1 = (i + 1) / N - 0.5, z0 = f0 * TDW * Math.sin(ry), z1 = f1 * TDW * Math.sin(ry), s0 = D / (D + z0), s1 = D / (D + z1);
        const x0 = BX + f0 * TDW * Math.cos(ry) * s0, x1 = BX + f1 * TDW * Math.cos(ry) * s1, sh = TDH * (s0 + s1) / 2;
        k.drawImage(TD, i * TDW / N * S, 0, (TDW / N + 0.6) * S, TDH * S, x0, BY - sh / 2, x1 - x0 + 0.6, sh);
      }
      cursor(k, cx, cy);
    });
  };

  CELLS[9] = (k, w, h, u) => {
    u = snapU(u);
    frame(k);
    const cx = 255 + 190 * Math.sin(2 * Math.PI * u / CYC), cy = 92 + 40 * Math.sin(4 * Math.PI * u / CYC);
    view(k, () => {
      k.fillStyle = '#121828'; k.fillRect(0, 0, VW, VH);
      txt(k, 'FEATURES', VW / 2, 26, `800 11px ${EN}`, 'rgba(255,255,255,.45)', 'center', 'alphabetic', '3px');
      const LAB = ['简单', '安心', '快速'];
      for (let i = 0; i < 3; i++) {
        const x = 22 + i * 160, y = 40, cw = 147, ch = 116;
        k.fillStyle = '#1C2335'; rr(k, x, y, cw, ch, 10); k.fill();
        k.save(); rr(k, x, y, cw, ch, 10); k.clip();
        const g = k.createRadialGradient(cx, cy, 0, cx, cy, 115); g.addColorStop(0, 'rgba(255,255,255,.34)'); g.addColorStop(1, 'rgba(255,255,255,0)'); k.fillStyle = g; k.fillRect(x, y, cw, ch);
        k.restore();
        k.lineWidth = 1.5; k.strokeStyle = 'rgba(255,255,255,.08)'; rr(k, x + 0.75, y + 0.75, cw - 1.5, ch - 1.5, 10); k.stroke();
        const sg = k.createRadialGradient(cx, cy, 0, cx, cy, 120); sg.addColorStop(0, 'rgba(255,122,82,1)'); sg.addColorStop(1, 'rgba(255,122,82,0)');
        k.lineWidth = 2; k.strokeStyle = sg; rr(k, x + 1, y + 1, cw - 2, ch - 2, 10); k.stroke();
        k.strokeStyle = 'rgba(255,255,255,.75)'; k.lineWidth = 2; k.beginPath(); k.arc(x + 30, y + 32, 12, 0, 7); k.stroke();
        txt(k, LAB[i], x + 18, y + 72, `800 16px ${JP}`, 'rgba(255,255,255,.9)');
        bars(k, x + 18, y + 86, 110, 2, 'rgba(255,255,255,.16)', 5, 10);
      }
      cursor(k, cx, cy);
    });
  };

  function tee(k, x, y, s, col, back) {
    k.save(); k.translate(x, y); k.scale(s, s);
    k.fillStyle = col; k.beginPath();
    k.moveTo(-0.36, -0.5); k.quadraticCurveTo(0, back ? -0.44 : -0.3, 0.36, -0.5);
    [[0.66, -0.3], [0.52, -0.08], [0.38, -0.18], [0.38, 0.56], [-0.38, 0.56], [-0.38, -0.18], [-0.52, -0.08], [-0.66, -0.3]].forEach(([a, b]) => k.lineTo(a, b));
    k.closePath(); k.fill();
    k.strokeStyle = 'rgba(28,35,51,.18)'; k.lineWidth = 0.025; k.beginPath(); k.moveTo(-0.36, -0.5); k.quadraticCurveTo(0, back ? -0.44 : -0.3, 0.36, -0.5); k.stroke();
    k.restore();
  }
  CELLS[10] = (k, w, h, u) => {
    u = snapU(u);
    frame(k);
    const CX = [44, 271], CY = 10, CWD = 196, IH = 112;
    const PRODS = [['T 恤', '¥3,980', '#FFFFFF', C.blueL, C.blue], ['Logo T 恤', '¥4,280', C.acc, C.accL, '#fff']];
    const cur = t => path([[0, 60, 200], [0.4, 150, 70], [1.6, 160, 80], [2.0, 370, 70], [3.3, 380, 82], [3.8, 470, 200], [4.7, 60, 200]], t);
    view(k, () => {
      for (let i = 0; i < 2; i++) {
        const [nm, pr, col, bg, mark] = PRODS[i], x = CX[i];
        const inside = t => { const [a, b] = cur(t); return a > x && a < x + CWD && b > CY && b < CY + IH + 40; };
        const q = trans(inside, u, 0.3, eIOs);
        k.save(); rr(k, x, CY, CWD, IH, 8); k.clip(); k.fillStyle = bg; k.fillRect(x, CY, CWD, IH);
        k.globalAlpha = 1 - q; tee(k, x + CWD / 2, CY + IH / 2 + 4, 108, col, false);
        k.fillStyle = mark; k.beginPath(); k.arc(x + CWD / 2 + 18, CY + IH / 2 - 16, 7, 0, 7); k.fill();
        k.globalAlpha = q; tee(k, x + CWD / 2, CY + IH / 2 + 4, 108, col, true);
        { const sx = x + CWD / 2, sy = CY + IH / 2 + 12; k.fillStyle = mark; k.beginPath(); for (let j = 0; j < 10; j++) { const r = j % 2 ? 8 : 19, a = -Math.PI / 2 + j * Math.PI / 5; j ? k.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r) : k.moveTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); } k.closePath(); k.fill(); }
        k.globalAlpha = 1; k.restore();
        for (let j = 0; j < 2; j++) { k.fillStyle = (j ? q : 1 - q) > 0.5 ? C.ink : C.faint; k.beginPath(); k.arc(x + CWD / 2 - 6 + j * 12, CY + IH - 10, 3, 0, 7); k.fill(); }
        txt(k, nm, x + 4, CY + IH + 22, `800 14px ${JP}`, C.ink);
        txt(k, pr, x + CWD - 4, CY + IH + 22, `800 14px ${EN}`, C.ink, 'right');
        bars(k, x + 4, CY + IH + 32, 90, 1, C.faint, 5);
      }
      const [cx, cy] = cur(u); cursor(k, cx, cy);
    });
  };

  CELLS[11] = (k, w, h, u) => {
    u = snapU(u);
    frame(k);
    const LINKS = ['WORKS', 'ABOUT', 'CONTACT'], F = `800 30px ${EN}`, GAP = 44, LY = 100, LH = 40;
    const cur = t => path([[0, 110, 200], [0.4, 120, 92], [1.25, 140, 96], [1.5, 252, 92], [2.35, 268, 96], [2.6, 380, 92], [3.45, 400, 96], [3.9, 450, 200], [4.7, 110, 200]], t);
    view(k, () => {
      k.fillStyle = '#FFF3EA'; k.fillRect(0, 0, VW, VH);
      logo(k, 24, 28); txt(k, 'MENU', VW - 26, 28.5, `800 11px ${EN}`, C.sub, 'right', 'middle', '2px');
      k.font = F; k.letterSpacing = '1px'; const ws = LINKS.map(s => k.measureText(s).width); k.letterSpacing = '0px';
      let x = (VW - ws.reduce((a, b) => a + b, 0) - GAP * (LINKS.length - 1)) / 2;
      LINKS.forEach((s, i) => {
        const x0 = x, x1 = x + ws[i], inside = t => { const [a, b] = cur(t); return a > x0 - 6 && a < x1 + 6 && b > LY - 30 && b < LY + 10; };
        const on = inside(u), tc = lastSwitch(inside, u);
        k.save(); k.beginPath(); k.rect(x0 - 4, LY - 31, ws[i] + 8, 39); k.clip();
        let cxp = x0;
        [...s].forEach((ch, j) => {
          const f = tc === null ? (on ? 1 : 0) : eIO(P(u, tc + 0.035 * j, tc + 0.035 * j + 0.36)), q = on ? f : 1 - f;
          k.font = F; k.letterSpacing = '1px'; const cw = k.measureText(ch).width; k.letterSpacing = '0px';
          txt(k, ch, cxp, LY - LH * q, F, C.ink, 'left', 'alphabetic', '1px');
          txt(k, ch, cxp, LY + LH - LH * q, F, C.acc, 'left', 'alphabetic', '1px');
          cxp += cw;
        });
        k.restore();
        x += ws[i] + GAP;
      });
      bars(k, VW / 2 - 110, 132, 220, 1, '#F1D9C9', 6);
      const [cx, cy] = cur(u); cursor(k, cx, cy);
    });
  };

  CELLS[12] = (k, w, h, u) => {
    u = snapU(u);
    frame(k);
    const NAMES = ['极光山丘', '湖畔小屋', '海边别墅', '星空露台'], RT = 6, RH = 39;
    const cur = t => path([[0, 140, 200], [0.4, 150, 26], [1.15, 190, 28], [1.4, 205, 65], [2.15, 230, 67], [2.4, 245, 104], [3.15, 265, 106], [3.4, 280, 143], [3.9, 292, 144], [4.3, 150, 200], [4.7, 140, 200]], t);
    const [cx, cy] = cur(u);
    view(k, () => {
      NAMES.forEach((s, i) => {
        const top = RT + i * RH, inside = t => { const [a, b] = cur(t); return b > top && b < top + RH && a > 20 && a < 490; };
        const q = trans(inside, u, 0.25);
        txt(k, '0' + (i + 1), 30, top + 25, `800 12px ${EN}`, C.sub);
        txt(k, s, 64 + 8 * q, top + 26, `800 17px ${JP}`, mix(C.ink, C.acc, q));
        txt(k, '→', 476, top + 25, `700 15px ${EN}`, mix('#B7BFCC', C.acc, q), 'right');
        k.fillStyle = C.rule; k.fillRect(24, top + RH, VW - 48, 1);
      });
      NAMES.forEach((s, i) => {
        const top = RT + i * RH, q = trans(t => { const [a, b] = cur(t); return b > top && b < top + RH && a > 20 && a < 490; }, u, 0.25);
        if (q <= 0) return;
        const iw = 132, ih = 84, px = cx + 26, py = clamp(cy - 46, 4, VH - ih - 4), sc = 0.85 + 0.15 * q;
        k.save(); k.globalAlpha = q; k.translate(px + iw / 2, py + ih / 2); k.scale(sc, sc);
        k.shadowColor = 'rgba(28,35,51,.25)'; k.shadowBlur = 12; k.shadowOffsetY = 4; k.fillStyle = '#fff'; rr(k, -iw / 2, -ih / 2, iw, ih, 6); k.fill(); k.shadowColor = 'transparent';
        pic(k, -iw / 2, -ih / 2, iw, ih, [0, 2, 1, 2][i], 6);
        k.restore();
      });
      cursor(k, cx, cy);
    });
  };

  CELLS[13] = (k, w, h, u) => {
    u = snapU(u);
    frame(k);
    const TEXT = 'hello@example.com', F = { x: 106, y: 58, w: 300, h: 46 };
    const len = t => { t = mod(t, CYC); return t < 1.0 ? 0 : t < 3.2 ? Math.min(TEXT.length, Math.floor((t - 1.0) / 0.075)) : Math.max(0, TEXT.length - Math.floor((t - 3.2) / 0.03)); };
    const focused = t => { t = mod(t, CYC); return t >= 0.65 && t < 3.95; };
    const q = trans(t => focused(t) || len(t) > 0, u, 0.24, eOut), fo = trans(focused, u, 0.15);
    const cur = t => path([[0, 445, 205], [0.45, 262, 82], [0.85, 262, 82], [1.4, 452, 142], [3.5, 452, 142], [3.85, 470, 26], [4.05, 470, 26], [4.6, 445, 205], [4.7, 445, 205]], t);
    const [cx, cy] = cur(u);
    view(k, () => {
      k.fillStyle = C.soft; k.fillRect(0, 0, VW, VH);
      k.save(); k.shadowColor = 'rgba(28,35,51,.1)'; k.shadowBlur = 12; k.shadowOffsetY = 3; k.fillStyle = '#fff'; rr(k, 80, 12, 352, 148, 12); k.fill(); k.restore();
      txt(k, '注册会员', F.x, 40, `800 15px ${JP}`, C.ink);
      k.lineWidth = lerp(1.5, 2.2, fo); k.strokeStyle = mix('#C9D0DC', C.acc, fo); rr(k, F.x, F.y, F.w, F.h, 8); k.stroke();
      const s = TEXT.slice(0, len(u));
      txt(k, s, F.x + 14, F.y + 30, `600 15px ${EN}`, C.ink);
      if (focused(u) && (mod(u, 0.9) < 0.5 || (u > 1 && u < 2.4))) { k.font = `600 15px ${EN}`; const xw = k.measureText(s).width; k.fillStyle = C.ink; k.fillRect(F.x + 14 + xw + 1, F.y + 14, 1.6, 20); }
      const fs = lerp(15, 11.5, q), ly = lerp(F.y + F.h / 2, F.y, q), lx = F.x + lerp(14, 10, q), LAB = '邮箱地址';
      k.font = `600 ${fs}px ${JP}`; const lw = k.measureText(LAB).width;
      if (q > 0) { k.fillStyle = '#fff'; k.fillRect(lx - 4, ly - 3, lw + 8, 6); }
      txt(k, LAB, lx, ly + 0.5, `600 ${fs}px ${JP}`, mix('#8B94A6', C.acc, fo), 'left', 'middle');
      btn(k, F.x, 118, F.w, 30, '下一步', C.ink, '#fff', 12);
      click(k, cx, cy, u, [0.65, 3.95]);
    });
  };

  CELLS[14] = (k, w, h, u) => {
    u = snapU(u);
    frame(k);
    const TEXT = 'hana@example.com', F = { x: 106, y: 56, w: 300, h: 44 };
    const len = t => { t = mod(t, CYC); return t < 0.75 ? 0 : t < 3.6 ? Math.min(TEXT.length, Math.floor((t - 0.75) / 0.115)) : Math.max(0, TEXT.length - Math.floor((t - 3.6) / 0.03)); };
    const err = t => { const n = len(t); return mod(t, CYC) < 3.6 && n >= 2 && n < TEXT.length; };
    const ok = t => mod(t, CYC) < 3.6 && len(t) === TEXT.length;
    const focused = t => { t = mod(t, CYC); return t >= 0.45 && t < 4.2; };
    const qe = trans(err, u, 0.15), qo = trans(ok, u, 0.25), fo = trans(focused, u, 0.15);
    const cur = t => path([[0, 445, 205], [0.3, 262, 80], [0.6, 262, 80], [1.1, 455, 146], [3.8, 455, 146], [4.1, 470, 26], [4.3, 470, 26], [4.65, 445, 205], [4.7, 445, 205]], t);
    const [cx, cy] = cur(u);
    view(k, () => {
      txt(k, '联系我们', F.x, 26, `800 15px ${JP}`, C.ink);
      txt(k, '邮箱地址', F.x, 47, `700 12px ${JP}`, C.ink);
      k.fillStyle = mix('#FFFFFF', '#FFF1F1', qe); rr(k, F.x, F.y, F.w, F.h, 8); k.fill();
      const bc = mix(mix(mix('#C9D0DC', C.ink, fo), RED, qe), GREEN, qo);
      k.lineWidth = lerp(1.5, 2.2, Math.max(fo, qe, qo)); k.strokeStyle = bc; rr(k, F.x, F.y, F.w, F.h, 8); k.stroke();
      const s = TEXT.slice(0, len(u));
      txt(k, s, F.x + 14, F.y + 28, `600 15px ${EN}`, C.ink);
      if (focused(u) && !ok(u) && (mod(u, 0.9) < 0.5 || (u > 0.75 && u < 2.6))) { k.font = `600 15px ${EN}`; const xw = k.measureText(s).width; k.fillStyle = C.ink; k.fillRect(F.x + 14 + xw + 1, F.y + 12, 1.6, 20); }
      if (qe > 0) {
        k.save(); k.globalAlpha = qe;
        k.fillStyle = RED; k.beginPath(); k.arc(F.x + 7, F.y + F.h + 20, 7, 0, 7); k.fill(); txt(k, '!', F.x + 7, F.y + F.h + 20.5, `800 11px ${EN}`, '#fff', 'center', 'middle');
        txt(k, '格式不正确', F.x + 20, F.y + F.h + 20.5, `700 13px ${JP}`, RED, 'left', 'middle');
        k.restore();
      }
      if (qo > 0) {
        k.save(); k.globalAlpha = qo;
        k.fillStyle = GREEN; k.beginPath(); k.arc(F.x + F.w - 22, F.y + F.h / 2, 11 * eEl(qo), 0, 7); k.fill(); check(k, F.x + F.w - 22, F.y + F.h / 2, 12, '#fff', 2.4);
        k.fillStyle = GREEN; k.beginPath(); k.arc(F.x + 7, F.y + F.h + 20, 7, 0, 7); k.fill(); check(k, F.x + 7, F.y + F.h + 20, 8, '#fff', 1.8);
        txt(k, 'OK', F.x + 20, F.y + F.h + 20.5, `800 13px ${EN}`, GREEN, 'left', 'middle');
        k.restore();
      }
      click(k, cx, cy, u, [0.45, 4.2]);
    });
  };

  CELLS[15] = (k, w, h, u) => {
    u = snapU(u);
    frame(k);
    const CLK = 0.8, BY = 124, BHT = 36;
    const shr = eIO(P(u, CLK + 0.05, CLK + 0.35)), done = eOut(P(u, 2.25, 2.45)), grow = eIO(P(u, 2.45, 2.8)), fade = P(u, 3.9, 4.1), back = eOut(P(u, 4.1, 4.4));
    const bw = fade >= 1 ? 220 : grow > 0 ? lerp(BHT, 150, grow) : lerp(220, BHT, shr);
    const cur = t => path([[0, 430, 205], [0.55, 290, 136], [1.1, 290, 136], [1.6, 440, 205], [4.7, 430, 205]], t);
    const [cx, cy] = cur(u);
    view(k, () => {
      k.fillStyle = C.blueL; k.fillRect(0, 0, VW, VH);
      k.save(); k.shadowColor = 'rgba(28,35,51,.1)'; k.shadowBlur = 12; k.shadowOffsetY = 3; k.fillStyle = '#fff'; rr(k, 130, 10, 251, 150, 12); k.fill(); k.restore();
      txt(k, '索取资料', VW / 2, 36, `800 15px ${JP}`, C.ink, 'center');
      for (let i = 0; i < 2; i++) { k.strokeStyle = '#D5DBE6'; k.lineWidth = 1.5; rr(k, 150, 50 + i * 32, 211, 24, 6); k.stroke(); bars(k, 160, 59 + i * 32, i ? 90 : 120, 1, '#AEB6C5', 6); }
      const col = fade >= 1 ? '#FF5A2C' : mix('#FF5A2C', GREEN, done), ba = fade >= 1 ? back : 1 - fade;
      k.save(); k.globalAlpha = ba; k.translate(0, fade >= 1 ? 6 * (1 - back) : 0); k.save(); k.shadowColor = 'rgba(28,35,51,.18)'; k.shadowBlur = 8; k.shadowOffsetY = 3; k.fillStyle = col; rr(k, VW / 2 - bw / 2, BY, bw, BHT, BHT / 2); k.fill(); k.restore();
      const idleA = fade >= 1 ? 1 : 1 - clamp(shr * 3);
      if (idleA > 0) { k.save(); k.globalAlpha = idleA * ba; txt(k, '提交', VW / 2, BY + BHT / 2 + 0.5, `800 14px ${JP}`, '#fff', 'center', 'middle'); k.restore(); }
      if (u > CLK + 0.3 && u < 2.3) { k.save(); k.globalAlpha = clamp((u - CLK - 0.3) / 0.1) * (1 - clamp((u - 2.2) / 0.08)); k.lineCap = 'round'; k.lineWidth = 3; k.strokeStyle = 'rgba(255,255,255,.35)'; k.beginPath(); k.arc(VW / 2, BY + BHT / 2, 10, 0, 7); k.stroke(); const a = u / 0.7 * Math.PI * 2; k.strokeStyle = '#fff'; k.beginPath(); k.arc(VW / 2, BY + BHT / 2, 10, a, a + Math.PI * 0.7); k.stroke(); k.restore(); }
      if (u >= 2.25 && fade < 1) {
        k.save();
        const ox = lerp(0, -26, grow);
        check(k, VW / 2 + ox, BY + BHT / 2, 16, '#fff', 3, P(u, 2.25, 2.5));
        if (grow > 0.5) { k.globalAlpha = ba * P(grow, 0.5, 1); txt(k, '完成', VW / 2 + 12, BY + BHT / 2 + 0.5, `800 14px ${JP}`, '#fff', 'center', 'middle'); }
        k.restore();
      }
      k.restore();
      click(k, cx, cy, u, [CLK]);
    });
  };

  CELLS[16] = (k, w, h, u) => {
    u = snapU(u);
    const e = u < 2.0 ? eIO(P(u, 0.85, 1.45)) : 1 - eIO(P(u, 3.15, 3.75));
    frame(k, e > 0.5 ? 'example.com/works/02' : 'example.com/works');
    const G = [24, 184, 344], GY = 44, GW = 143, GH = 80, NM = ['雪中山屋', '海边咖啡馆', '夜间观景台'], PV = [0, 1, 2];
    const T = { x: 16, y: 10, w: VW - 32, h: 94 };
    const cur = t => path([[0, 420, 205], [0.5, 262, 88], [0.95, 262, 88], [1.6, 380, 150], [2.55, 380, 150], [2.9, 62, 30], [3.2, 62, 30], [3.9, 420, 205], [4.7, 420, 205]], t);
    const [cx, cy] = cur(u);
    view(k, () => {
      const ga = 1 - clamp(e * 1.6);
      k.save(); k.globalAlpha = ga;
      txt(k, 'WORKS', 24, 30, `800 15px ${EN}`, C.ink, 'left', 'alphabetic', '2px');
      for (let i = 0; i < 3; i++) { if (i !== 1) pic(k, G[i], GY, GW, GH, PV[i], 6); txt(k, NM[i], G[i], GY + GH + 20, `800 13px ${JP}`, C.ink); bars(k, G[i], GY + GH + 30, 90, 1, C.faint, 5); }
      k.restore();
      const x = lerp(G[1], T.x, e), y = lerp(GY, T.y, e), ww = lerp(GW, T.w, e), hh = lerp(GH, T.h, e);
      pic(k, x, y, ww, hh, 1, lerp(6, 8, e));
      const da = clamp((e - 0.6) / 0.4);
      if (da > 0) {
        k.save(); k.globalAlpha = da;
        k.fillStyle = 'rgba(255,255,255,.92)'; rr(k, 26, 19, 74, 22, 11); k.fill(); txt(k, '← 返回列表', 63, 30.5, `700 11px ${JP}`, C.ink, 'center', 'middle');
        txt(k, '海边咖啡馆', 24, 134, `800 19px ${JP}`, C.ink); bars(k, 200, 122, 280, 3, C.faint, 6, 12, 0.7);
        k.restore();
      }
      click(k, cx, cy, u, [0.75, 3.05]);
    });
  };

  CELLS[17] = (k, w, h, u) => {
    u = snapU(u);
    frame(k);
    const e = u < 2.0 ? eOut(P(u, 0.85, 1.3)) : 1 - eIO(P(u, 3.05, 3.4));
    const TX = [24, 142, 260, 378], TY = 72, TW = 108, THt = 72, PV = [2, 0, 1, 0];
    const B = { x: 125, y: 12, w: 261, h: 128 };
    const cur = t => path([[0, 430, 205], [0.5, 318, 110], [0.95, 318, 110], [1.6, 445, 120], [2.5, 445, 120], [2.85, 487, 19], [3.15, 487, 19], [3.8, 430, 205], [4.7, 430, 205]], t);
    const [cx, cy] = cur(u);
    view(k, () => {
      header(k, 0);
      txt(k, '作品集', 24, 60, `800 15px ${JP}`, C.ink);
      for (let i = 0; i < 4; i++) pic(k, TX[i], TY, TW, THt, PV[i], 6);
      bars(k, 24, 154, 300, 1, C.faint, 6);
      if (e > 0) {
        k.fillStyle = `rgba(14,18,28,${0.82 * e})`; k.fillRect(0, 0, VW, VH);
        const x = lerp(TX[2], B.x, e), y = lerp(TY, B.y, e), ww = lerp(TW, B.w, e), hh = lerp(THt, B.h, e);
        pic(k, x, y, ww, hh, 1, 6);
        k.save(); k.globalAlpha = clamp((e - 0.5) / 0.5);
        txt(k, '3 / 4', VW / 2, 156, `700 12px ${EN}`, 'rgba(255,255,255,.85)', 'center', 'middle', '1px');
        k.strokeStyle = '#fff'; k.lineWidth = 2.4; k.lineCap = 'round'; k.lineJoin = 'round';
        k.beginPath(); k.moveTo(481, 13); k.lineTo(493, 25); k.moveTo(493, 13); k.lineTo(481, 25); k.stroke();
        k.beginPath(); k.moveTo(98, 66); k.lineTo(90, 76); k.lineTo(98, 86); k.stroke();
        k.beginPath(); k.moveTo(413, 66); k.lineTo(421, 76); k.lineTo(413, 86); k.stroke();
        k.restore();
      }
      click(k, cx, cy, u, [0.75, 3.0]);
    });
  };

  CELLS[18] = (k, w, h, u) => {
    u = snapU(u);
    frame(k);
    const D1 = [186, 52], D2 = [150, 122];
    const o1 = t => { t = mod(t, CYC); return t >= 0.9 && t < 2.4; }, o2 = t => { t = mod(t, CYC); return t >= 2.4 && t < 3.8; };
    const q1 = trans(o1, u, 0.25), q2 = trans(o2, u, 0.25);
    const cur = t => path([[0, 280, 205], [0.6, D1[0], D1[1]], [1.15, D1[0], D1[1]], [2.05, D2[0], D2[1]], [3.95, D2[0], D2[1]], [4.45, 280, 205], [4.7, 280, 205]], t);
    const [cx, cy] = cur(u);
    view(k, () => {
      k.fillStyle = '#EEF1F6'; k.fillRect(0, 0, 300, VH);
      k.strokeStyle = C.ink; k.lineWidth = 6; k.lineCap = 'round'; k.beginPath(); k.arc(150, 30, 16, Math.PI, 0); k.stroke();
      k.fillStyle = '#3B64E8'; rr(k, 92, 26, 116, 134, 28); k.fill();
      k.fillStyle = '#2E50C2'; rr(k, 108, 92, 84, 56, 14); k.fill();
      k.strokeStyle = '#FFD9C9'; k.lineWidth = 2.5; k.beginPath(); k.moveTo(116, 104); k.lineTo(184, 104); k.stroke();
      k.fillStyle = C.acc; rr(k, 140, 54, 20, 8, 4); k.fill();
      txt(k, '旅行背包', 322, 58, `800 16px ${JP}`, C.ink);
      txt(k, '¥12,800', 322, 88, `800 19px ${EN}`, C.acc);
      bars(k, 322, 104, 160, 3);
      [D1, D2].forEach(([x, y], i) => {
        for (let r = 0; r < 2; r++) { const f = mod(u / (CYC / 3) + r * 0.5, 1); k.strokeStyle = `rgba(255,255,255,${0.75 * (1 - f)})`; k.lineWidth = 2; k.beginPath(); k.arc(x, y, 8 + 12 * f, 0, 7); k.stroke(); }
        k.save(); k.shadowColor = 'rgba(28,35,51,.3)'; k.shadowBlur = 6; k.shadowOffsetY = 2; k.fillStyle = '#fff'; k.beginPath(); k.arc(x, y, 8, 0, 7); k.fill(); k.restore();
        k.fillStyle = C.acc; k.beginPath(); k.arc(x, y, 4, 0, 7); k.fill();
      });
      const tip = (x, y, q, title, left) => {
        if (q <= 0) return;
        k.save(); k.globalAlpha = q; k.translate(x, y + 6 * (1 - q));
        const L = left ? 0 : 1;
        const bx = L ? 0 : -136;
        k.save(); k.shadowColor = 'rgba(28,35,51,.22)'; k.shadowBlur = 12; k.shadowOffsetY = 4; k.fillStyle = '#fff'; rr(k, bx, -24, 136, 48, 8); k.fill();
        k.beginPath(); if (L) { k.moveTo(0, -6); k.lineTo(-8, 0); k.lineTo(0, 6); } else { k.moveTo(0, -6); k.lineTo(8, 0); k.lineTo(0, 6); } k.fill(); k.restore();
        txt(k, title, bx + 12, -6, `800 13px ${JP}`, C.ink); bars(k, bx + 12, 6, 100, 1, C.faint, 5);
        k.restore();
      };
      tip(D1[0] - 16, D1[1], q1, '防水面料', true);
      tip(D2[0] + 16, D2[1], q2, '可放电脑的口袋', false);
      click(k, cx, cy, u, [0.9, 2.4, 3.8]);
    });
  };

  CELLS[19] = (k, w, h, u) => {
    const tp = mod(Math.round(u * 1e6) / 1e6, LOOP);
    frame(k);
    const T0 = 0.4, START = 2 * 3600 + 15 * 60 + 4;
    const n = clamp(Math.floor(tp - T0) + 1, 0, 9), fp = n === 0 ? 1 : clamp((tp - T0 - (n - 1)) / 0.32);
    const dg = v => { const hh = Math.floor(v / 3600), mm = Math.floor(v / 60) % 60, ss = v % 60; return [hh, mm, ss].map(x => String(x).padStart(2, '0')).join(''); };
    const now = dg(START - n), was = dg(START - Math.max(0, n - 1));
    const TW = 34, TH = 50, TY = 50, GW = 2 * TW + 4, SEP = 30, X0 = (VW - (3 * GW + 2 * SEP)) / 2;
    const tile = (x, d, clipHalf) => {
      k.save(); k.beginPath(); if (clipHalf === 0) k.rect(x, TY, TW, TH / 2); else if (clipHalf === 1) k.rect(x, TY + TH / 2, TW, TH / 2); else k.rect(x, TY, TW, TH); k.clip();
      k.fillStyle = C.ink; rr(k, x, TY, TW, TH, 6); k.fill();
      txt(k, String(d), x + TW / 2, TY + TH / 2 + 1.5, `800 32px ${EN}`, '#fff', 'center', 'middle');
      k.restore();
    };
    const flip = (x, a, b, f) => {
      k.fillStyle = C.ink; rr(k, x, TY, TW, TH, 6); k.fill();
      k.save(); rr(k, x, TY, TW, TH, 6); k.clip();
      const o = eIO(clamp(f)) * TH;
      txt(k, String(a), x + TW / 2, TY + TH / 2 + 1.5 - o, `800 32px ${EN}`, '#fff', 'center', 'middle');
      txt(k, String(b), x + TW / 2, TY + TH / 2 + 1.5 + TH - o, `800 32px ${EN}`, '#fff', 'center', 'middle');
      k.restore();
    };
    view(k, () => {
      const g = k.createLinearGradient(0, 0, VW, VH); g.addColorStop(0, '#FF6A3D'); g.addColorStop(1, '#FF4A2C'); k.fillStyle = g; k.fillRect(0, 0, VW, VH);
      txt(k, '距活动结束', VW / 2, 34, `800 15px ${JP}`, '#fff', 'center');
      ['时', '分', '秒'].forEach((lab, gi) => {
        const x = X0 + gi * (GW + SEP);
        for (let j = 0; j < 2; j++) { const p = gi * 2 + j, xx = x + j * (TW + 4); if (was[p] !== now[p]) flip(xx, was[p], now[p], fp); else tile(xx, now[p], 2); }
        txt(k, lab, x + GW / 2, TY + TH + 16, `700 11px ${JP}`, 'rgba(255,255,255,.9)', 'center', 'middle');
        if (gi < 2) txt(k, ':', x + GW + SEP / 2, TY + TH / 2, `800 26px ${EN}`, '#fff', 'center', 'middle');
      });
      btn(k, VW / 2 - 75, 132, 150, 28, '立即报名', '#fff', C.acc, 12);
    });
  };

  CELLS[20] = (k, w, h, u) => {
    u = snapU(u);
    frame(k);
    const a = 2 * Math.PI * u / CYC;
    const wave = (base, A1, L1, p1, A2, L2, p2) => { k.beginPath(); k.moveTo(0, VH + 1); for (let x = 0; x <= VW + 4; x += 4) k.lineTo(x, base + A1 * Math.sin(2 * Math.PI * x / L1 + p1) + A2 * Math.sin(2 * Math.PI * x / L2 + p2)); k.lineTo(VW, VH + 1); k.closePath(); };
    view(k, () => {
      const g = k.createLinearGradient(0, 0, 0, 120); g.addColorStop(0, '#3B64E8'); g.addColorStop(1, '#8FA9F7'); k.fillStyle = g; k.fillRect(0, 0, VW, VH);
      k.fillStyle = 'rgba(255,255,255,.9)'; k.beginPath(); k.arc(430, 44, 22, 0, 7); k.fill();
      txt(k, '夏季活动', 34, 42, `800 22px ${JP}`, '#fff'); btn(k, 34, 56, 96, 24, '了解更多', '#fff', C.blue, 11);
      k.fillStyle = 'rgba(255,255,255,.45)'; wave(100, 8, 260, a + 1, 4, 130, -2 * a); k.fill();
      k.fillStyle = '#fff'; wave(110, 9, 300, -a, 3.5, 110, 2 * a + 0.5); k.fill();
      txt(k, '推荐套餐', 34, 146, `800 15px ${JP}`, C.ink); bars(k, 170, 140, 290, 1, C.faint, 6);
      bars(k, 34, 156, 200, 1, C.faint, 5);
    });
  };

  CELLS[21] = (k, w, h, u) => {
    u = snapU(u);
    frame(k);
    const ON = 0.9, OFF = 3.3, HX = 266, HY = 118;
    const liked = u >= ON && u < OFF, d = u - ON, d2 = u - OFF;
    let sc = 1;
    if (d >= 0 && d < 1.2) sc = d < 0.12 ? lerp(0.78, 1.45, eOut(d / 0.12)) : 1 + 0.45 * Math.exp(-7 * (d - 0.12)) * Math.cos((d - 0.12) * 15);
    else if (d < 0 && d > -0.1) sc = 1 - 0.22 * (1 + d / 0.1);
    if (d2 >= -0.1 && d2 < 0.3) sc = 1 - 0.16 * Math.sin(Math.PI * clamp((d2 + 0.1) / 0.4));
    const cur = t => path([[0, 430, 205], [0.5, 276, 130], [1.25, 276, 130], [1.8, 430, 160], [2.75, 430, 160], [3.1, 276, 130], [3.55, 276, 130], [4.1, 430, 205], [4.7, 430, 205]], t);
    const [cx, cy] = cur(u);
    view(k, () => {
      k.fillStyle = C.soft; k.fillRect(0, 0, VW, VH);
      k.fillStyle = '#fff'; rr(k, 16, 12, 479, 144, 12); k.fill();
      pic(k, 28, 24, 200, 120, 1, 8);
      k.fillStyle = C.blueL; k.beginPath(); k.arc(258, 40, 11, 0, 7); k.fill();
      txt(k, 'sample_trip', 276, 44.5, `700 13px ${EN}`, C.ink);
      bars(k, 248, 62, 220, 2, C.faint, 6, 12, 0.7);
      if (d >= 0.08 && d < 0.6) {
        const f = (d - 0.08) / 0.5;
        k.strokeStyle = `rgba(242,61,92,${0.5 * (1 - f)})`; k.lineWidth = 2; k.beginPath(); k.arc(HX, HY, 15 + 18 * eOut(f), 0, 7); k.stroke();
        for (let i = 0; i < 6; i++) { const an = -Math.PI / 2 + i * Math.PI / 3, r = 24 + 13 * eOut(f); k.fillStyle = [HEART, '#FFB020', C.acc][i % 3]; k.globalAlpha = 1 - f; k.beginPath(); k.arc(HX + Math.cos(an) * r, HY + Math.sin(an) * r, 2.4 * (1 - 0.5 * f), 0, 7); k.fill(); }
        k.globalAlpha = 1;
      }
      k.save(); k.translate(HX, HY + 2); k.scale(sc, sc); heartPath(k, 14.5);
      if (liked) { k.fillStyle = HEART; k.fill(); } else { k.lineWidth = 2.4; k.strokeStyle = C.ink; k.lineJoin = 'round'; k.stroke(); }
      k.restore();
      const nf = liked ? eOut(P(d, 0.05, 0.35)) : eOut(P(d2, 0.05, 0.35)), up = liked;
      k.save(); k.beginPath(); k.rect(292, HY - 13, 60, 26); k.clip();
      const A = up ? '128' : '129', Bn = up ? '129' : '128', dir = up ? -1 : 1, sh = 26 * nf * dir;
      const fA = `800 18px ${EN}`;
      if (u < ON || (d2 >= 0 && nf >= 1) || (liked && nf >= 1)) txt(k, liked ? '129' : '128', 294, HY + 1, fA, liked ? HEART : C.ink, 'left', 'middle');
      else { txt(k, A, 294, HY + 1 + sh, fA, up ? C.ink : HEART, 'left', 'middle'); txt(k, Bn, 294, HY + 1 + sh - 26 * dir, fA, up ? HEART : C.ink, 'left', 'middle'); }
      k.restore();
      click(k, cx, cy, u, [ON, OFF]);
    });
  };

  CELLS[22] = (k, w, h, u) => {
    u = snapU(u);
    frame(k);
    const T = CYC / 3, f = mod(u, T) / T;
    view(k, () => {
      k.fillStyle = '#FFF4EA'; k.fillRect(0, 0, VW, VH);
      txt(k, '欢迎来到', 40, 40, `800 22px ${JP}`, C.ink); txt(k, '山顶民宿。', 40, 70, `800 22px ${JP}`, C.ink);
      bars(k, 40, 84, 170, 2, '#EAD9CB');
      pic(k, 286, 10, 200, 92, 1, 10);
      const mx = VW / 2;
      txt(k, 'SCROLL', mx, 116, `800 11px ${EN}`, C.ink, 'center', 'middle', '3px');
      k.strokeStyle = C.ink; k.lineWidth = 2.2; rr(k, mx - 12, 126, 24, 38, 12); k.stroke();
      const dy = eIOs(clamp(f / 0.7)) * 14, da = 1 - clamp((f - 0.45) / 0.3);
      k.fillStyle = `rgba(255,90,44,${da})`; rr(k, mx - 2.5, 133 + dy, 5, 9, 2.5); k.fill();
      [mx - 40, mx + 40].forEach(x => { for (let j = 0; j < 2; j++) { const ff = mod(f + j * 0.5, 1), yy = 128 + ff * 24, al = Math.sin(Math.PI * ff); k.strokeStyle = `rgba(28,35,51,${0.8 * al})`; k.lineWidth = 2.5; k.lineCap = 'round'; k.lineJoin = 'round'; k.beginPath(); k.moveTo(x - 8, yy); k.lineTo(x, yy + 8); k.lineTo(x + 8, yy); k.stroke(); } });
    });
  };

  function cloud(k, x, y, s, a) { k.fillStyle = `rgba(255,255,255,${a})`; k.beginPath(); k.ellipse(x, y, 30 * s, 10 * s, 0, 0, 7); k.ellipse(x - 12 * s, y - 6 * s, 14 * s, 11 * s, 0, 0, 7); k.ellipse(x + 8 * s, y - 10 * s, 17 * s, 14 * s, 0, 0, 7); k.fill(); }
  CELLS[23] = (k, w, h, u) => {
    u = snapU(u);
    frame(k);
    const f = u / CYC;
    view(k, () => {
      const g = k.createLinearGradient(0, 0, 0, 120); g.addColorStop(0, '#7C9EF4'); g.addColorStop(1, '#DCE5FF'); k.fillStyle = g; k.fillRect(0, 0, VW, VH);
      k.fillStyle = 'rgba(255,240,230,.95)'; k.beginPath(); k.arc(400, 66, 20, 0, 7); k.fill();
      for (let x = -170; x < VW + 170; x += 170) { const xx = x + mod(f * 170, 170); cloud(k, xx + 40, 30, 0.7, 0.75); cloud(k, xx + 120, 58, 0.55, 0.6); }
      for (let x = -340; x < VW + 340; x += 340) { const xx = x + mod(f * 340, 340); cloud(k, xx + 90, 44, 1.15, 0.95); cloud(k, xx + 260, 86, 0.9, 0.9); }
      mount(k, VW, 132, [[0, .78], [.18, .66], [.36, .76], [.6, .62], [.82, .74], [1, .68]], '#6E8CEB', 0);
      const sea = (y0, A, L, ph, col) => { k.fillStyle = col; k.beginPath(); k.moveTo(0, VH + 1); for (let x = 0; x <= VW + 4; x += 4) k.lineTo(x, y0 + A * Math.sin(2 * Math.PI * x / L + ph)); k.lineTo(VW, VH + 1); k.closePath(); k.fill(); };
      sea(118, 2.5, 90, -2 * Math.PI * f, '#4B6BDB'); sea(130, 3, 60, 2 * Math.PI * f * 2, '#3B5CCF'); sea(146, 2.5, 120, -2 * Math.PI * f, '#2E4DB8');
      k.fillStyle = 'rgba(28,35,51,.12)'; k.fillRect(0, 0, VW, VH);
      { const sg = k.createLinearGradient(0, 0, 300, 0); sg.addColorStop(0, 'rgba(20,28,64,.45)'); sg.addColorStop(1, 'rgba(20,28,64,0)'); k.fillStyle = sg; k.fillRect(0, 0, 300, VH); }
      k.save(); k.shadowColor = 'rgba(16,24,60,.55)'; k.shadowBlur = 10; k.shadowOffsetY = 2; txt(k, '出发旅行吧。', 34, 60, `800 28px ${JP}`, '#fff', 'left', 'alphabetic', '1px'); k.restore();
      bars(k, 34, 74, 160, 1, 'rgba(255,255,255,.85)');
      btn(k, 34, 92, 96, 26, '预订');
      k.fillStyle = 'rgba(14,18,28,.5)'; rr(k, 420, 134, 76, 24, 12); k.fill();
      k.fillStyle = '#fff'; k.fillRect(435, 140, 3.5, 12); k.fillRect(442, 140, 3.5, 12);
      k.beginPath(); k.moveTo(462, 143); k.lineTo(466, 143); k.lineTo(471, 139); k.lineTo(471, 153); k.lineTo(466, 149); k.lineTo(462, 149); k.closePath(); k.fill();
      k.strokeStyle = '#fff'; k.lineWidth = 1.6; k.lineCap = 'round'; k.beginPath(); k.moveTo(476, 143); k.lineTo(482, 149); k.moveTo(482, 143); k.lineTo(476, 149); k.stroke();
    });
  };

  return { width: CW, height: CH, cycle: LOOP, cells: CELLS, fonts: [] };
});

  g.DMMotionPrompt = {catalog: [{"id":"005","pack":"motion","no":"05","category":"entrances-text","width":539,"height":208,"cycle":4.7,"tags":["mask","reveal","clip","wipe","title","text","slide-up","headline"],"name":"遮罩显现","en":"Mask reveal","meaning":"文字从不可见的边界后移出","hero":4.26},{"id":"006","pack":"motion","no":"06","category":"entrances-text","width":539,"height":208,"cycle":4.7,"tags":["typewriter","typing","text","cursor","input","prompt","chat","type-on"],"name":"打字机效果","en":"Typewriter","meaning":"文字像打字一样逐字出现","hero":2.6},{"id":"007","pack":"motion","no":"07","category":"entrances-text","width":539,"height":208,"cycle":4.7,"tags":["count-up","counter","number","odometer","stats","kpi","progress"],"name":"数字递增","en":"Count-up","meaning":"数字快速增长到目标值","hero":2.94},{"id":"008","pack":"motion","no":"08","category":"entrances-text","width":539,"height":208,"cycle":4.7,"tags":["kinetic-typography","text","typography","lyric","word","bounce","spin","slam"],"name":"动态排版","en":"Kinetic typography","meaning":"文字随含义和节奏移动、缩放与旋转","hero":3.67},{"id":"080","pack":"lp","no":"08","category":"scroll","width":539,"height":208,"cycle":4.8,"tags":["highlighter","marker","text-highlight","emphasis","scroll-reveal","copy","underline"],"name":"荧光笔标记动画","en":"Highlighter animation","meaning":"重点文字下方逐渐画出色带","hero":3.75},{"id":"086","pack":"lp","no":"14","category":"hover-click","width":539,"height":208,"cycle":4.8,"tags":["underline","hover","link","navigation","menu","text-link","scalex"],"name":"下划线动画","en":"Underline animation","meaning":"悬停时链接下划线从左展开","hero":4.65},{"id":"094","pack":"lp","no":"22","category":"loading-loops","width":539,"height":208,"cycle":4.8,"tags":["marquee","ticker","infinite-loop","scrolling-text","logo-strip","band","loop"],"name":"跑马灯","en":"Marquee","meaning":"文字或标志组成连续滚动带","hero":4.65},{"id":"129","pack":"motion2","no":"09","category":"text-shapes","width":539,"height":208,"cycle":4.7,"tags":["text-scramble","scramble","decode","shuffle","random","text","hacker"],"name":"文字乱码效果","en":"Text scramble","meaning":"字符随机变换后定格为正确文字","hero":3.53},{"id":"130","pack":"motion2","no":"10","category":"text-shapes","width":539,"height":208,"cycle":4.7,"tags":["wave-text","wave","text","letters","stagger","bounce","kinetic-type"],"name":"波浪文字","en":"Wave text","meaning":"文字像波浪一样依次上下起伏","hero":3.82},{"id":"131","pack":"motion2","no":"11","category":"text-shapes","width":539,"height":208,"cycle":4.7,"tags":["text-on-path","path-text","curved-text","text","marquee","wave","scroll"],"name":"路径文字","en":"Text on a path","meaning":"文字沿线条或曲线流动","hero":4.26},{"id":"132","pack":"motion2","no":"12","category":"text-shapes","width":539,"height":208,"cycle":4.7,"tags":["variable-font","font-weight","typography","text","weight","kinetic-type"],"name":"可变字体动画","en":"Variable font animation","meaning":"文字粗细平滑变化","hero":3.67},{"id":"133","pack":"motion2","no":"13","category":"text-shapes","width":539,"height":208,"cycle":4.7,"tags":["text-mask","mask","clipping-mask","knockout","text","typography","title"],"name":"文字遮罩","en":"Text mask","meaning":"镂空成文字形状，透出内部画面","hero":3.67},{"id":"146","pack":"lp2","no":"02","category":"scroll","width":539,"height":208,"cycle":9.4,"tags":["scroll","text-reveal","scroll-driven","typography","opacity","storytelling"],"name":"滚动文字显现","en":"Scroll text reveal","meaning":"随着阅读，文字逐字变深","hero":9.11},{"id":"156","pack":"lp2","no":"12","category":"mouse-input","width":539,"height":208,"cycle":9.4,"tags":["text-roll","hover","menu","link","stagger","typography"],"name":"悬停文字翻滚","en":"Text roll on hover","meaning":"文字向上翻转并替换","hero":9.11}],
    get(id) { if (!made[id]) { made[id] = factories[id](); } return made[id]; }};
})(window);
