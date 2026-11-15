/* Opus Motion Library Canvas adaptation, pinned in vendor/opus-motion/UPSTREAM.json.
 * Copyright (c) 2026 Govindu Sasanka, MIT. Dot-tally idea: LemoLab, MIT.
 * Original TSX and complete notices retained under vendor/opus-motion and App licenses.
 * Shared-axis dumbbell, seeded dot marking, rank interpolation, monotone counter and
 * stacked cosine interpolation follow upstream. Dashboard layout, survey semantics,
 * date precision, editing contract and media sampling are host adaptations.
 */
(function (root) {
  "use strict";
  const D = root.DM,
    O = root.DMOpus;
  const { clamp, lerp } = D;
  const out = D.bezier(0.16, 1, 0.3, 1),
    inOut = D.bezier(0.65, 0, 0.35, 1),
    back = D.bezier(0.34, 1.56, 0.64, 1);
  const prog = (f, a, b, e = out) =>
    e(clamp((f - a) / Math.max(0.000001, b - a)));
  const NAMES = {
    "comparison-dumbbell": "前后数据对比",
    "dot-tally": "人群占比点阵",
    "bar-race": "动态条形排名",
    "number-counter": "指标数字变化",
    "card-stack-cascade": "看板卡片聚焦",
    "poll-results-bars": "问卷结果揭晓",
    "sankey-flow": "品牌流向桑基图",
    "funnel-conversion": "购买转化漏斗",
    "bubble-scatter-grow": "气泡散点图",
    "heatmap-calendar": "使用频率热力日历",
    "testimonial-card-carousel": "用户原声卡片",
    "timeline-ruler": "追踪研究时间轴",
    "split-compare": "左右分屏对比",
    "stacked-area-flow": "构成随时间变化",
  };
  function configOf(row) {
    const c = O.validate(row.motion);
    if (
      c.templateId !==
      (O.PRESETS[row.template || row.tpl]?.templateId ||
        row.template ||
        row.tpl)
    )
      throw new Error("motion.templateId 与所选模板不匹配");
    if (row.dur > 0) {
      c.timeline.duration = row.dur;
      c.timeline.currentTime = Math.min(c.timeline.currentTime, row.dur);
      c.timeline.entrance = Math.min(c.timeline.entrance, row.dur * 0.15);
      c.timeline.hold = Math.min(c.timeline.hold, row.dur * 0.2);
    }
    return c;
  }
  // Upstream core/text-kit.tsx: Fritsch–Carlson interpolation, unchanged algorithm.
  function monotone(keys, x) {
    const k = [...keys].sort((a, b) => a[0] - b[0]),
      n = k.length;
    if (!n) return 0;
    if (n === 1 || x <= k[0][0]) return k[0][1];
    if (x >= k[n - 1][0]) return k[n - 1][1];
    const d = [];
    for (let i = 0; i < n - 1; i++)
      d.push((k[i + 1][1] - k[i][1]) / Math.max(1e-9, k[i + 1][0] - k[i][0]));
    const m = [d[0]];
    for (let i = 1; i < n - 1; i++)
      m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
    m.push(d[n - 2]);
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) {
        m[i] = 0;
        m[i + 1] = 0;
        continue;
      }
      const a = m[i] / d[i],
        b = m[i + 1] / d[i],
        s = a * a + b * b;
      if (s > 9) {
        const t = 3 / Math.sqrt(s);
        m[i] = t * a * d[i];
        m[i + 1] = t * b * d[i];
      }
    }
    let i = 0;
    while (i < n - 2 && x > k[i + 1][0]) i++;
    const h = k[i + 1][0] - k[i][0],
      t = (x - k[i][0]) / h,
      t2 = t * t,
      t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * k[i][1] +
      (t3 - 2 * t2 + t) * h * m[i] +
      (-2 * t3 + 3 * t2) * k[i + 1][1] +
      (t3 - t2) * h * m[i + 1]
    );
  }
  const rng = (seed) => {
    let a = seed >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  function progress(c, t) {
    // Seconds remain authoritative; quantization is at the selected output FPS, not upstream's 30 FPS.
    const now = Math.floor(Math.max(0, t) * c.output.fps + 1e-6) / c.output.fps;
    const p = clamp(
      (now - c.timeline.entrance) /
        Math.max(
          0.001,
          c.timeline.duration - c.timeline.entrance - c.timeline.hold,
        ),
    );
    return lerp(c.timeline.inPoint, c.timeline.outPoint, p);
  }
  function numericState(c, t) {
    const p = progress(c, t),
      id = c.templateId;
    if (id === "number-counter")
      return { value: monotone(c.data.keyframes, p), progress: p };
    if (id === "bar-race") {
      const d = c.data,
        s = clamp((p - 0.1) / 0.8) * (d.frames.length - 1),
        a = Math.floor(s),
        b = Math.min(a + 1, d.frames.length - 1),
        e = inOut(clamp((s - a - 0.12) / 0.88));
      const rank = (i) => {
        const order = d.names
            .map((_, k) => k)
            .sort(
              (x, y) => d.frames[i].values[y] - d.frames[i].values[x] || x - y,
            ),
          r = [];
        order.forEach((idx, k) => (r[idx] = k));
        return r;
      };
      const ra = rank(a),
        rb = rank(b);
      return {
        progress: p,
        period: d.frames[Math.round(s)].label,
        rows: d.names.map((label, i) => ({
          label,
          index: i,
          value:
            lerp(d.frames[a].values[i], d.frames[b].values[i], e) *
            out(clamp(p / 0.12)),
          rank: lerp(ra[i], rb[i], e),
        })),
      };
    }
    return { progress: p, values: O.researchValues(c) };
  }
  const fontFamily = (s) =>
    s.fontFamily === "system-serif"
      ? D.FONT_TITLE
      : s.fontFamily === "system-sans"
        ? '"PingFang SC",sans-serif'
        : D.FONT_CN;
  function text(
    g,
    s,
    txt,
    x,
    y,
    size,
    color,
    align = "left",
    weight = 500,
    maxWidth,
  ) {
    g.font = `${weight} ${size}px ${fontFamily(s)}`;
    g.fillStyle = color || s.ink;
    g.textAlign = align;
    g.textBaseline = "alphabetic";
    let fs = size;
    if (maxWidth) {
      const w = g.measureText(String(txt)).width;
      if (w > maxWidth) {
        fs = (size * maxWidth) / w;
        g.font = `${weight} ${fs}px ${fontFamily(s)}`;
      }
    }
    g.fillText(String(txt), x, y);
  }
  function lines(g, s, txt, w, size) {
    g.font = `500 ${size}px ${fontFamily(s)}`;
    const rows = [];
    for (const para of String(txt).split("\n")) {
      let line = "";
      for (const ch of [...para]) {
        if (line && g.measureText(line + ch).width > w) {
          rows.push(line);
          line = ch;
        } else line += ch;
      }
      rows.push(line);
    }
    return rows;
  }
  function block(g, s, txt, x, y, w, h, size, color = s.ink, weight = 500) {
    let fs = size,
      rs = lines(g, s, txt, w, fs);
    while (rs.length * fs * 1.42 > h && fs > 9) {
      fs -= 1;
      rs = lines(g, s, txt, w, fs);
    }
    rs.forEach((r, i) =>
      text(g, s, r, x, y + fs + i * fs * 1.42, fs, color, "left", weight),
    );
    return rs.length * fs * 1.42;
  }
  const fill = (g, color, x, y, w, h, r = 0) => {
    if (w <= 0 || h <= 0) return;
    g.fillStyle = color;
    g.beginPath();
    if (r) g.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
    else g.rect(x, y, w, h);
    g.fill();
  };
  const line = (g, color, x, y, x2, y2, width = 2) => {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x2, y2);
    g.stroke();
  };
  const circle = (g, color, x, y, r) => {
    if (r <= 0) return;
    g.fillStyle = color;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  };
  const tone = (a, b, k) => D.css(D.mix(D.hex(a), D.hex(b), k));
  const fmt = (n, s, unit = true) =>
    `${s.prefix}${Number(n).toLocaleString("en-US", { minimumFractionDigits: s.decimals, maximumFractionDigits: s.decimals })}${unit ? s.unit : ""}`;
  const pct = (n) => (n === null ? "无基数" : `${Number(n.toFixed(1))}%`);
  function shell(g, c, t, W, H) {
    const s = c.style,
      m = c.metadata,
      portrait = H > W;
    g.bg();
    fill(g, s.background, 0, 0, W, H);
    g.el("header", "标题与说明", D.TEXT);
    text(g, s, "重构调研 / RESEARCH MOTION", 80, 78, 22, s.accent, "left", 700);
    let y = 108;
    if (m.showTitle)
      y +=
        block(g, s, s.title, 80, y, W - 160, 150, s.titleSize, s.ink, 700) + 16;
    if (m.showSubtitle)
      y +=
        block(
          g,
          s,
          s.subtitle,
          80,
          y,
          W - 160,
          95,
          s.fontSize * 0.86,
          tone(s.ink, s.background, 0.25),
        ) + 18;
    const footer = [];
    if (m.showSource && m.source) footer.push(`来源：${m.source}`);
    if (m.showSampleSize) footer.push(`样本量 n=${m.sampleSize}`);
    if (m.showResearchTime && m.researchTime) footer.push(m.researchTime);
    const footerH = footer.length
      ? Math.max(
          70,
          Math.ceil(footer.join(" · ").length / (portrait ? 45 : 100)) * 36,
        )
      : 40;
    const box = {
      x: 80,
      y: y + 12,
      w: W - 160,
      h: H - y - footerH - 65,
      portrait,
    };
    g.el("panel", "信息面板");
    fill(
      g,
      tone(s.background, "#FFFFFF", 0.58),
      box.x,
      box.y,
      box.w,
      box.h,
      30,
    );
    g.el("footer", "研究信息", D.TEXT);
    block(
      g,
      s,
      footer.join(" · "),
      80,
      H - footerH,
      W - 160,
      footerH - 10,
      22,
      tone(s.ink, s.background, 0.2),
    );
    if (c.demo) {
      text(g, s, "演示数据", W - 90, 75, 22, s.accent, "right", 700);
    }
    g.el("progress", "时间进度");
    fill(g, tone(s.ink, s.background, 0.9), 80, H - 20, W - 160, 4, 2);
    fill(
      g,
      s.accent,
      80,
      H - 20,
      (W - 160) * clamp(t / c.timeline.duration),
      4,
      2,
    );
    return {
      x: box.x + 44,
      y: box.y + 40,
      w: box.w - 88,
      h: box.h - 80,
      portrait,
    };
  }
  function dumbbell(g, c, p, b) {
    const s = c.style,
      o = c.options;
    let rows = [...c.data.rows];
    if (o.sort !== "none")
      rows.sort((a, b) =>
        o.sort === "delta"
          ? Math.abs(b.after - b.before) - Math.abs(a.after - a.before)
          : b[o.sort] - a[o.sort],
      );
    const vals = rows.flatMap((r) => [r.before, r.after]),
      lo = o.zeroBased ? Math.min(0, ...vals) : Math.min(...vals),
      hi = Math.max(...vals),
      pad = (hi - lo || 10) * 0.17,
      min = lo - pad,
      max = hi + pad;
    const labelW = b.w * 0.2,
      deltaW = o.showDelta ? b.w * 0.16 : 0,
      x0 = b.x + labelW,
      x1 = b.x + b.w - deltaW - 75;
    const rh = Math.min(125, (b.h - 90) / Math.max(1, rows.length)),
      top = b.y + 72,
      sx = (v) => lerp(x0, x1, (v - min) / (max - min));
    text(g, s, `● ${o.beforeLabel}`, x0, b.y + 22, s.fontSize, s.beforeColor);
    text(
      g,
      s,
      `● ${o.afterLabel}`,
      x0 + 260,
      b.y + 22,
      s.fontSize,
      s.afterColor,
    );
    for (let i = 0; i < 6; i++) {
      const x = lerp(x0, x1, i / 5);
      line(
        g,
        tone(s.ink, s.background, 0.91),
        x,
        top,
        x,
        top + rh * rows.length,
      );
      text(
        g,
        s,
        fmt(lerp(min, max, i / 5), s),
        x,
        top + rh * rows.length + 42,
        22,
        s.ink,
        "center",
        500,
        150,
      );
    }
    rows.forEach((r, i) => {
      g.el(`row:${i}`, r.label);
      const y = top + (i + 0.5) * rh,
        frame = p * (100 + rows.length * 8),
        start = 8 + i * 8,
        move = prog(frame, start + 14, start + 48, inOut),
        pb = prog(frame, start, start + 16, back),
        xb = sx(r.before),
        xa = lerp(xb, sx(r.after), move),
        good = r.after >= r.before === (o.goodDirection === "up"),
        col = good ? s.goodColor : s.badColor;
      block(g, s, r.label, b.x, y - 28, labelW - 20, 60, s.fontSize);
      line(g, col, xb, y, xa, y, 8);
      circle(g, s.beforeColor, xb, y, 14 * clamp(pb));
      circle(g, s.afterColor, xa, y, 16 * clamp(pb));
      if (o.showValues) {
        text(
          g,
          s,
          fmt(r.before, s),
          xb,
          y - 25,
          s.fontSize * 0.8,
          s.beforeColor,
          "center",
          600,
          125,
        );
        text(
          g,
          s,
          fmt(lerp(r.before, r.after, move), s),
          xa,
          y + 42,
          s.fontSize * 0.85,
          s.ink,
          "center",
          700,
          150,
        );
      }
      if (o.showDelta) {
        const d = r.after - r.before,
          delta =
            o.deltaMode === "percent"
              ? r.before === 0
                ? null
                : (100 * d) / Math.abs(r.before)
              : d;
        fill(
          g,
          tone(col, s.background, 0.85),
          b.x + b.w - deltaW + 12,
          y - 28,
          deltaW - 16,
          56,
          24,
        );
        text(
          g,
          s,
          delta === null
            ? "无基数"
            : `${delta > 0 ? "+" : ""}${o.deltaMode === "percent" ? pct(delta) : fmt(delta, s)}`,
          b.x + b.w - deltaW / 2,
          y + 10,
          s.fontSize * 0.85,
          col,
          "center",
          700,
          deltaW - 30,
        );
      }
    });
  }
  function dots(g, c, p, b) {
    const s = c.style,
      o = c.options,
      gs = c.data.groups,
      stack = b.portrait,
      total = gs.reduce((a, r) => a + r.count, 0),
      marked = gs.reduce((a, r) => a + r.marked, 0),
      gridW = stack ? b.w : b.w * 0.65,
      gridH = stack ? b.h * 0.65 : b.h;
    const rows = gs.reduce((a, r) => a + Math.ceil(r.count / o.cols), 0),
      pitch = Math.min(
        62,
        gridW / o.cols,
        (gridH - gs.length * 62) / Math.max(1, rows),
      ),
      allSpan = marked + gs.length * 12,
      frame = p * (allSpan + 50);
    let yy = b.y,
      at = 25,
      now = 0;
    gs.forEach((r, gi) => {
      g.el(`group:${gi}`, r.label);
      block(g, s, r.label, b.x, yy, gridW, 42, s.fontSize);
      const idx = Array.from({ length: r.count }, (_, i) => i),
        rand = rng(o.seed * 31 + gi);
      if (o.shuffle)
        for (let i = idx.length - 1; i > 0; i--) {
          const j = Math.floor(rand() * (i + 1));
          [idx[i], idx[j]] = [idx[j], idx[i]];
        }
      const order = new Map(idx.slice(0, r.marked).map((i, k) => [i, k]));
      for (let i = 0; i < r.count; i++) {
        const x = b.x + ((i % o.cols) + 0.5) * pitch,
          y = yy + 50 + (Math.floor(i / o.cols) + 0.5) * pitch,
          k = order.get(i),
          mt = k === undefined ? 0 : prog(frame, at + k, at + k + 6),
          r0 = pitch * 0.28 * clamp(prog(frame, i * 0.08, i * 0.08 + 10, back));
        if (mt > 0.5) now++;
        circle(
          g,
          mt > 0.5 && o.markStyle === "fill"
            ? s.accent
            : tone(s.ink, s.background, 0.72),
          x,
          y,
          r0,
        );
        if (mt && o.markStyle === "ring") {
          g.strokeStyle = s.accent;
          g.lineWidth = 3;
          g.beginPath();
          g.arc(x, y, r0 + 2, 0, Math.PI * 2);
          g.stroke();
        }
        if (mt && o.markStyle === "cross") {
          line(g, s.accent, x - r0, y - r0, x + r0, y + r0, 3);
          line(g, s.accent, x + r0, y - r0, x - r0, y + r0, 3);
        }
      }
      yy += 50 + Math.ceil(r.count / o.cols) * pitch + 12;
      at += r.marked + 12;
    });
    const x = stack ? b.x + b.w / 2 : b.x + b.w * 0.83,
      y = stack ? b.y + b.h * 0.8 : b.y + b.h * 0.45;
    g.el("total", "人数与占比", D.TEXT);
    text(
      g,
      s,
      String(now),
      x,
      y,
      s.numberSize,
      s.accent,
      "center",
      700,
      b.w * (stack ? 0.8 : 0.3),
    );
    text(
      g,
      s,
      `/ ${total} 人 · ${pct(total ? (now / total) * 100 : 0)}`,
      x,
      y + 62,
      s.fontSize,
      s.ink,
      "center",
      500,
      b.w * (stack ? 0.8 : 0.3),
    );
    block(
      g,
      s,
      o.totalLabel,
      x - (stack ? b.w * 0.4 : b.w * 0.14),
      y + 88,
      b.w * (stack ? 0.8 : 0.28),
      75,
      s.fontSize * 0.8,
    );
    text(
      g,
      s,
      `${o.legend[0]} / ${o.legend[1]}`,
      x,
      y + 190,
      22,
      s.ink,
      "center",
      500,
      b.w * (stack ? 0.8 : 0.3),
    );
  }
  function race(g, c, t, b) {
    const s = c.style,
      o = c.options,
      state = numericState(c, t),
      top = Math.min(o.topN, state.rows.length),
      rh = (b.h - 70) / Math.max(1, top),
      x0 = b.x + b.w * 0.23,
      maxWidth = b.w * 0.62;
    const max =
      o.scale === "fixed"
        ? Math.max(1, ...c.data.frames.flatMap((f) => f.values))
        : Math.max(1, ...state.rows.map((r) => r.value));
    text(
      g,
      s,
      state.period,
      b.x + b.w,
      b.y + b.h,
      80,
      tone(s.ink, s.background, 0.65),
      "right",
      700,
      b.w * 0.45,
    );
    state.rows.forEach((r) => {
      if (r.rank >= top) return;
      g.el(`brand:${r.index}`, r.label);
      const y = b.y + r.rank * rh,
        bar = (maxWidth * r.value) / max;
      block(
        g,
        s,
        `${o.showRank ? `${Math.round(r.rank) + 1}. ` : ""}${r.label}`,
        b.x,
        y + rh * 0.18,
        b.w * 0.21,
        rh * 0.7,
        s.fontSize,
      );
      fill(
        g,
        s.colors[r.index % s.colors.length],
        x0,
        y + 12,
        bar,
        rh - 28,
        10,
      );
      text(
        g,
        s,
        fmt(r.value, s),
        x0 + bar + 16,
        y + rh * 0.55,
        s.fontSize,
        s.ink,
        "left",
        700,
        b.w * 0.14,
      );
    });
  }
  function counter(g, c, t, b) {
    const s = c.style,
      o = c.options,
      v = numericState(c, t).value,
      p = progress(c, t),
      cx = b.x + b.w / 2,
      cy = b.y + b.h / 2;
    g.el("metric", "指标数字", D.TEXT);
    text(
      g,
      s,
      o.label,
      cx,
      cy - Math.min(s.numberSize * 0.9, b.h * 0.3) - s.fontSize * 0.6,
      s.fontSize,
      s.ink,
      "center",
      600,
      b.w * 0.9,
    );
    const num = v
      .toLocaleString("en-US", {
        minimumFractionDigits: s.decimals,
        maximumFractionDigits: s.decimals,
      })
      .replace(/,/g, o.separator);
    const full = `${s.prefix}${num}${s.unit}`;
    if (o.mode === "roll" && p < 0.999) {
      const fs = Math.min(
          s.numberSize,
          b.w / (Math.max(1, full.length) * 0.65),
        ),
        width = g.measureText(full).width;
      g.save();
      g.beginPath();
      g.rect(b.x, cy - fs, b.w, fs * 1.35);
      g.clip();
      const chars = [...full],
        cw = fs * 0.65,
        x = cx - (chars.length * cw) / 2;
      chars.forEach((ch, i) => {
        const off = /\d/.test(ch) ? (1 - out(v % 1)) * fs : 0;
        text(g, s, ch, x + i * cw, cy + 20 + off, fs, s.accent, "left", 700);
        if (off)
          text(
            g,
            s,
            String((Number(ch) + 9) % 10),
            x + i * cw,
            cy + 20 + off - fs * 1.2,
            fs,
            s.accent,
            "left",
            700,
          );
      });
      g.restore();
    } else
      text(
        g,
        s,
        full,
        cx,
        cy + 35,
        s.numberSize,
        s.accent,
        "center",
        700,
        b.w * 0.9,
      );
    line(
      g,
      tone(s.accent, s.background, 0.75),
      cx - b.w * 0.28,
      cy + 115,
      cx + b.w * 0.28,
      cy + 115,
      5,
    );
    circle(
      g,
      s.accent,
      lerp(cx - b.w * 0.28, cx + b.w * 0.28, p),
      cy + 115,
      10,
    );
  }
  function cards(g, c, t, p, b) {
    const s = c.style,
      o = c.options,
      cs = c.data.cards,
      n = cs.length,
      cols =
        o.layout === "row" ? Math.min(4, n) : b.portrait ? 2 : Math.min(3, n),
      rows = Math.ceil(n / Math.max(1, cols)),
      gap = 24,
      cw = (b.w - gap * (cols - 1)) / Math.max(1, cols),
      ch = (b.h - gap * (rows - 1)) / Math.max(1, rows);
    const focus =
      prog(t, o.focusAt, o.focusAt + 0.45) *
      (1 - prog(t, o.focusAt + o.focusHold, o.focusAt + o.focusHold + 0.45));
    const paint = (r, i) => {
      const active = i === o.focusIndex,
        appear = prog(p, i * 0.045, i * 0.045 + 0.2, back),
        f = active ? focus : 0;
      g.el(`card:${i}`, r.title);
      g.save();
      g.globalAlpha = clamp(appear) * (active ? 1 : lerp(1, o.dimTo, focus));
      const stack = o.layout === "stack",
        x0 = stack
          ? b.x + (b.w - cw) / 2 + (i - n / 2) * 36
          : b.x + (i % cols) * (cw + gap),
        y0 = stack
          ? b.y + (b.h - ch) / 2 + (i - n / 2) * 18
          : b.y + Math.floor(i / cols) * (ch + gap),
        ww = lerp(cw, b.w * 0.78, f),
        hh = lerp(ch, b.h * 0.82, f),
        x = lerp(x0, b.x + (b.w - ww) / 2, f),
        y = lerp(y0, b.y + (b.h - hh) / 2, f) + (1 - appear) * 40;
      fill(
        g,
        tone(r.color || s.accent, s.background, active ? 0.88 : 0.96),
        x,
        y,
        ww,
        hh,
        24,
      );
      fill(g, r.color || s.accent, x + 26, y + 28, 8, hh - 56, 4);
      block(
        g,
        s,
        r.title,
        x + 54,
        y + 32,
        ww - 90,
        hh * 0.24,
        s.fontSize * (active ? 1.3 : 1),
        s.ink,
        700,
      );
      text(
        g,
        s,
        r.value,
        x + 54,
        y + hh * 0.53,
        Math.min(80, hh * 0.26),
        r.color || s.accent,
        "left",
        700,
        ww - 90,
      );
      block(
        g,
        s,
        r.body,
        x + 54,
        y + hh * 0.62,
        ww - 90,
        hh * 0.3,
        s.fontSize * 0.86,
      );
      g.restore();
    };
    cs.forEach((r, i) => {
      if (i !== o.focusIndex) paint(r, i);
    });
    if (cs[o.focusIndex]) paint(cs[o.focusIndex], o.focusIndex);
  }
  function poll(g, c, p, b) {
    const s = c.style,
      o = c.options;
    let rs = O.researchValues(c);
    if (o.order !== "input")
      rs.sort((a, b) =>
        o.order === "descending"
          ? b.percent - a.percent
          : a.percent - b.percent,
      );
    const rh = (b.h - 100) / Math.max(1, rs.length),
      x = b.x + b.w * 0.32,
      w = b.w * 0.53,
      max = Math.max(100, ...rs.map((r) => r.percent));
    rs.forEach((r, i) => {
      g.el(`option:${r.index}`, r.label);
      const k = prog(
          p,
          0.12 + (i * o.stagger) / Math.max(1, c.timeline.duration),
          0.55 + (i * o.stagger) / Math.max(1, c.timeline.duration),
        ),
        y = b.y + i * rh,
        col =
          r.index === o.highlight ? s.accent : tone(s.ink, s.background, 0.65);
      block(
        g,
        s,
        r.label,
        b.x,
        y + rh * 0.14,
        b.w * 0.29,
        rh * 0.8,
        s.fontSize,
      );
      fill(
        g,
        tone(s.ink, s.background, 0.94),
        x,
        y + rh * 0.25,
        w,
        rh * 0.4,
        14,
      );
      fill(g, col, x, y + rh * 0.25, ((w * r.percent) / max) * k, rh * 0.4, 14);
      text(
        g,
        s,
        o.inputMode === "count" && s.unit && s.unit !== "%"
          ? fmt(r.value * k, s)
          : pct(r.percent * k),
        b.x + b.w,
        y + rh * 0.57,
        s.fontSize * 1.15,
        col,
        "right",
        700,
        b.w * 0.14,
      );
      if (r.index === o.highlight && o.winnerLabel)
        text(g, s, o.winnerLabel, x, y + rh * 0.9, 20, col);
    });
    const rule =
      o.inputMode === "percent"
        ? "输入百分比保持原值"
        : `选项人数 ÷ 有效样本 n=${o.totalVotes}`;
    block(
      g,
      s,
      `${o.questionType === "multiple" ? "多选题 · 合计可超过100%" : "单选题"}  /  ${rule}`,
      b.x,
      b.y + b.h - 60,
      b.w,
      70,
      24,
    );
  }
  function sankey(g, c, p, b) {
    const s = c.style,
      o = c.options,
      links = c.data.links,
      from = [...new Set(links.map((r) => r.from))],
      to = [...new Set(links.map((r) => r.to))],
      total = links.reduce((a, r) => a + r.value, 0),
      gap = 28,
      h = b.h - 75,
      k = total
        ? Math.min(
            (h - (from.length - 1) * gap) / total,
            (h - (to.length - 1) * gap) / total,
          )
        : 0;
    const build = (ns, key) => {
        let y = b.y + 40;
        return Object.fromEntries(
          ns.map((name, i) => {
            const v = links
                .filter((r) => r[key] === name)
                .reduce((a, r) => a + r.value, 0),
              r = {
                name,
                y,
                h: v * k,
                value: v,
                used: 0,
                color: o.nodeColors[name] || s.colors[i % s.colors.length],
              };
            y += r.h + gap;
            return [name, r];
          }),
        );
      },
      a = build(from, "from"),
      z = build(to, "to"),
      x0 = b.x + b.w * 0.26,
      x1 = b.x + b.w * 0.74;
    text(g, s, "来源品牌", b.x, b.y + 12, 24);
    text(g, s, "最终购买品牌", b.x + b.w, b.y + 12, 24, s.ink, "right");
    if (total === 0) {
      text(
        g,
        s,
        "全部配对流向为零 · 没有可绘制的流带",
        b.x + b.w / 2,
        b.y + b.h / 2,
        32,
        s.ink,
        "center",
        500,
        b.w,
      );
      return;
    }
    links.forEach((r, i) => {
      const l = a[r.from],
        rr = z[r.to],
        hh = r.value * k,
        y0 = l.y + l.used,
        y1 = rr.y + rr.used;
      l.used += hh;
      rr.used += hh;
      if (!r.value) return;
      g.el(`flow:${i}`, `${r.from} → ${r.to}：${r.value}`);
      g.save();
      g.globalAlpha =
        o.linkOpacity *
        prog(p, i * 0.02, 0.5 + i * 0.02) *
        (o.highlight && r.from !== o.highlight && r.to !== o.highlight
          ? 0.15
          : 1);
      g.fillStyle = r.color || l.color;
      g.beginPath();
      g.moveTo(x0 + 22, y0);
      g.bezierCurveTo(
        x0 + (x1 - x0) * 0.5,
        y0,
        x0 + (x1 - x0) * 0.5,
        y1,
        x1,
        y1,
      );
      g.lineTo(x1, y1 + hh);
      g.bezierCurveTo(
        x0 + (x1 - x0) * 0.5,
        y1 + hh,
        x0 + (x1 - x0) * 0.5,
        y0 + hh,
        x0 + 22,
        y0 + hh,
      );
      g.closePath();
      g.fill();
      g.restore();
    });
    for (const [nodes, x, align] of [
      [a, x0, "right"],
      [z, x1, "left"],
    ])
      for (const r of Object.values(nodes)) {
        g.el(`node:${align}:${r.name}`, r.name);
        fill(g, r.color, x, r.y, 22, Math.max(r.h, 2), 5);
        const labelX = align === "right" ? x - 14 : x + 36;
        text(
          g,
          s,
          r.name,
          labelX,
          r.y + Math.max(22, r.h / 2),
          s.fontSize,
          s.ink,
          align,
          600,
          b.w * 0.23,
        );
        if (o.showValues)
          text(
            g,
            s,
            fmt(r.value, s),
            labelX,
            r.y + Math.max(22, r.h / 2) + 34,
            24,
            r.color,
            align,
            600,
            b.w * 0.23,
          );
      }
    if (total === 0)
      text(
        g,
        s,
        "全部配对流向为零",
        b.x + b.w / 2,
        b.y + b.h / 2,
        32,
        s.ink,
        "center",
      );
  }
  function funnel(g, c, p, b) {
    const s = c.style,
      o = c.options,
      rs = O.researchValues(c),
      top = rs[0]?.value || 0,
      rh = (b.h - 60) / Math.max(1, rs.length),
      cx = b.x + b.w * 0.5,
      w = b.w * 0.52;
    rs.forEach((r, i) => {
      g.el(`stage:${i}`, r.label);
      const k = prog(p, i * 0.065, i * 0.065 + 0.45),
        ww = top ? (w * r.value) / top : 0,
        wb =
          i < rs.length - 1
            ? top
              ? (w * rs[i + 1].value) / top
              : 0
            : ww * 0.85,
        y = b.y + i * rh,
        col = r.color || s.colors[i % s.colors.length];
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(cx - (ww * k) / 2, y + 4);
      g.lineTo(cx + (ww * k) / 2, y + 4);
      g.lineTo(cx + (wb * k) / 2, y + rh - 12);
      g.lineTo(cx - (wb * k) / 2, y + rh - 12);
      g.closePath();
      g.fill();
      block(g, s, r.label, b.x, y + rh * 0.2, b.w * 0.2, rh * 0.7, s.fontSize);
      text(
        g,
        s,
        fmt(r.value * k, s),
        b.x + b.w,
        y + rh * 0.42,
        s.fontSize,
        s.ink,
        "right",
        700,
        b.w * 0.21,
      );
      if (o.showConversion)
        text(
          g,
          s,
          `${o.rateMode === "previous" ? "转化" : "保留"} ${pct(r.rate)}`,
          b.x + b.w,
          y + rh * 0.76,
          24,
          col,
          "right",
          600,
          b.w * 0.25,
        );
    });
    text(
      g,
      s,
      o.rateMode === "previous"
        ? "口径：本阶段人数 ÷ 上一阶段人数（首阶段以自身为基数）"
        : "口径：本阶段人数 ÷ 首阶段人数",
      b.x,
      b.y + b.h - 2,
      24,
      s.ink,
      "left",
      500,
      b.w,
    );
  }
  function bubble(g, c, p, b) {
    const s = c.style,
      o = c.options,
      rs = O.researchValues(c),
      x0 = b.x + 90,
      y0 = b.y + 25,
      w = b.w - 140,
      h = b.h - 150,
      sx = (v) => x0 + ((v - o.xMin) / (o.xMax - o.xMin)) * w,
      sy = (v) => y0 + h - ((v - o.yMin) / (o.yMax - o.yMin)) * h,
      max = Math.max(1, ...rs.map((r) => r.size)),
      rmax = Math.min(100, w * 0.1, h * 0.18);
    for (let i = 0; i < 5; i++) {
      const k = i / 4;
      line(
        g,
        tone(s.ink, s.background, 0.88),
        x0,
        y0 + k * h,
        x0 + w,
        y0 + k * h,
      );
      text(
        g,
        s,
        `${Number(lerp(o.yMax, o.yMin, k).toFixed(1))}${o.yUnit}`,
        x0 - 20,
        y0 + k * h + 8,
        22,
        s.ink,
        "right",
      );
      text(
        g,
        s,
        `${Number(lerp(o.xMin, o.xMax, k).toFixed(1))}${o.xUnit}`,
        x0 + k * w,
        y0 + h + 38,
        22,
        s.ink,
        "center",
      );
    }
    g.setLineDash([8, 8]);
    if (o.referenceX >= o.xMin && o.referenceX <= o.xMax)
      line(g, s.accent, sx(o.referenceX), y0, sx(o.referenceX), y0 + h);
    if (o.referenceY >= o.yMin && o.referenceY <= o.yMax)
      line(g, s.accent, x0, sy(o.referenceY), x0 + w, sy(o.referenceY));
    g.setLineDash([]);
    const ordered = rs
      .map((r, i) => ({ ...r, i }))
      .sort((a, b) => b.size - a.size);
    for (const r of ordered) {
      g.el(`bubble:${r.i}`, `${r.label} / ${r.size}`);
      const rr =
          rmax *
          Math.sqrt(r.size / max) *
          clamp(prog(p, r.i * 0.025, r.i * 0.025 + 0.45, back)),
        col = r.color || s.colors[r.i % s.colors.length],
        x = sx(r.x),
        y = sy(r.y);
      g.save();
      g.globalAlpha = o.highlight && o.highlight !== r.label ? 0.4 : 0.8;
      circle(g, col, x, y, rr);
      g.restore();
      if (o.highlight === r.label && r.size > 0) {
        g.strokeStyle = s.ink;
        g.lineWidth = 3;
        g.beginPath();
        g.arc(x, y, rr + 7, 0, Math.PI * 2);
        g.stroke();
      }
      text(
        g,
        s,
        r.label,
        clamp(x, x0 + 60, x0 + w - 60),
        clamp(y - rr - 12, y0 + 24, y0 + h),
        s.fontSize * 0.9,
        s.ink,
        "center",
        600,
        150,
      );
    }
    text(g, s, o.xLabel, x0 + w / 2, y0 + h + 88, s.fontSize, s.ink, "center");
    text(g, s, o.yLabel, x0, y0 - 6, 22);
    text(
      g,
      s,
      o.sizeLabel,
      b.x + b.w,
      b.y + b.h,
      22,
      s.ink,
      "right",
      500,
      b.w * 0.7,
    );
  }
  function calendar(g, c, p, b) {
    const s = c.style,
      o = c.options,
      rs = O.researchValues(c),
      offset = (new Date(O.dateNumber(o.startDate)).getUTCDay() + 6) % 7,
      weeks = Math.ceil((rs.length + offset) / 7),
      pitch = Math.min((b.w - 110) / weeks, (b.h - 145) / 7, 82),
      size = pitch * 0.8,
      x0 = b.x + 70,
      y0 = b.y + 50;
    ["一", "二", "三", "四", "五", "六", "日"].forEach((d, i) =>
      text(g, s, d, b.x, y0 + i * pitch + size * 0.75, 22),
    );
    rs.forEach((r, i) => {
      g.el(
        `date:${r.date}`,
        `${r.date} ${r.value === null ? "无记录" : r.value}`,
      );
      const col = Math.floor((i + offset) / 7),
        row = (i + offset) % 7,
        x = x0 + col * pitch,
        y = y0 + row * pitch,
        visible = prog(
          p,
          (i / (rs.length || 1)) * 0.65,
          (i / (rs.length || 1)) * 0.65 + 0.1,
        ),
        level =
          r.value === null
            ? -1
            : r.value === 0
              ? 0
              : Math.max(1, Math.ceil((r.value / o.maxValue) * (o.levels - 1))),
        co =
          level < 0
            ? tone(s.ink, s.background, 0.94)
            : level === 0
              ? tone(s.accent, s.background, 0.9)
              : tone(
                  s.accent,
                  s.background,
                  0.8 * (1 - level / (o.levels - 1)),
                );
      g.save();
      g.globalAlpha = visible;
      fill(g, co, x, y, size, size, 5);
      if (level < 0) {
        line(
          g,
          tone(s.ink, s.background, 0.7),
          x + 5,
          y + size - 5,
          x + size - 5,
          y + 5,
          1.5,
        );
      }
      if (r.date === o.highlight) {
        g.strokeStyle = s.ink;
        g.lineWidth = 3;
        g.strokeRect(x - 3, y - 3, size + 6, size + 6);
      }
      g.restore();
      if (row === 0)
        text(
          g,
          s,
          r.date.slice(5),
          x,
          y0 - 14,
          18,
          s.ink,
          "left",
          500,
          pitch * 1.6,
        );
    });
    if (o.showLegend) {
      const y = b.y + b.h - 32;
      const labels = [
        "无记录",
        "0",
        ...Array.from(
          { length: o.levels - 1 },
          (_, i) =>
            `≤${Number((((i + 1) * o.maxValue) / (o.levels - 1)).toFixed(1))}`,
        ),
      ];
      labels.forEach((l, i) => {
        const x = b.x + (i * b.w) / labels.length;
        fill(
          g,
          i === 0
            ? tone(s.ink, s.background, 0.94)
            : i === 1
              ? tone(s.accent, s.background, 0.9)
              : tone(
                  s.accent,
                  s.background,
                  0.8 * (1 - (i - 1) / (o.levels - 1)),
                ),
          x,
          y - 18,
          22,
          22,
          4,
        );
        text(
          g,
          s,
          l,
          x + 30,
          y + 2,
          20,
          s.ink,
          "left",
          500,
          b.w / labels.length - 35,
        );
      });
    }
  }
  function quotes(g, c, t, p, b) {
    const s = c.style,
      o = c.options,
      rs = c.data.testimonials,
      elapsed = Math.max(0, t - c.timeline.entrance),
      cycle = o.holdSeconds + o.moveSeconds,
      i = Math.min(rs.length - 1, Math.floor(elapsed / cycle)),
      local = elapsed - i * cycle,
      r = rs[i];
    if (!r) return;
    g.el(`quote:${i}`, `受访者 ${i + 1}`);
    const enter = i === 0 ? prog(p, 0, 0.1) : prog(local, 0, o.moveSeconds);
    g.save();
    g.globalAlpha = enter;
    const x = b.x + Math.min(80, b.w * 0.05),
      y = b.y + (1 - enter) * 35,
      w = b.w - Math.min(160, b.w * 0.1);
    text(g, s, "“", x, y + 90, 150, s.accent, "left", 700);
    block(
      g,
      s,
      r.quote,
      x + 36,
      y + 100,
      w - 72,
      b.h - 290,
      Math.min(56, s.fontSize * 1.6),
      s.ink,
      600,
    );
    text(
      g,
      s,
      r.name,
      x + 36,
      b.y + b.h - 100,
      s.fontSize,
      s.accent,
      "left",
      700,
      w - 72,
    );
    block(g, s, r.role, x + 36, b.y + b.h - 78, w - 72, 75, s.fontSize * 0.82);
    if (o.showAvatar) {
      circle(
        g,
        tone(s.accent, s.background, 0.8),
        b.x + b.w - 65,
        b.y + 60,
        40,
      );
      text(
        g,
        s,
        [...r.name][0] || "访",
        b.x + b.w - 65,
        b.y + 72,
        30,
        s.ink,
        "center",
      );
    }
    if (o.showRating && r.rating !== undefined)
      text(
        g,
        s,
        "★".repeat(Math.round(r.rating)),
        b.x + b.w - 25,
        b.y + 55,
        28,
        s.accent,
        "right",
      );
    g.restore();
    text(
      g,
      s,
      `${i + 1} / ${rs.length}  ·  停留 ${o.holdSeconds} 秒`,
      b.x + b.w,
      b.y + b.h,
      22,
      s.ink,
      "right",
    );
  }
  function timeline(g, c, p, b) {
    const s = c.style,
      o = c.options,
      es = c.data.events,
      n = es.length,
      first = n ? O.dateNumber(es[0].date) : 0,
      last = n ? O.dateNumber(es[n - 1].date) : 0,
      positions = es.map((r, i) =>
        o.scale === "linear"
          ? last === first
            ? 0.5
            : (O.dateNumber(r.date) - first) / (last - first)
          : n === 1
            ? 0.5
            : i / (n - 1),
      ),
      active = Math.min(n - 1, Math.floor(p * n));
    const x0 = b.x + 45,
      w = b.w - 90,
      y = b.y + 95;
    line(g, tone(s.ink, s.background, 0.8), x0, y, x0 + w, y, 4);
    line(g, s.accent, x0, y, x0 + w * p, y, 5);
    es.forEach((r, i) => {
      g.el(`event:${i}`, r.title);
      const x = x0 + w * positions[i];
      circle(
        g,
        i === o.highlight ? s.accent : tone(s.ink, s.background, 0.4),
        x,
        y,
        i === active ? 14 : 9,
      );
      text(
        g,
        s,
        r.date,
        x,
        y + (i % 2 ? 72 : -30),
        20,
        s.ink,
        "center",
        500,
        (w / Math.max(3, n)) * 1.15,
      );
    });
    const r = es[active];
    if (r) {
      g.el("event-detail", "当前事件", D.TEXT);
      const image = mediaCache.get(r.image),
        imageW = image ? b.w * 0.32 : 0;
      text(g, s, r.date, b.x + 30, b.y + 240, 34, s.accent);
      block(
        g,
        s,
        r.title,
        b.x + 30,
        b.y + 260,
        b.w - 60 - imageW,
        110,
        46,
        s.ink,
        700,
      );
      block(
        g,
        s,
        r.body,
        b.x + 30,
        b.y + 380,
        b.w - 60 - imageW,
        b.h - 440,
        34,
      );
      if (image)
        drawMedia(g, image, b.x + b.w - imageW, b.y + 220, imageW, b.h - 300);
    }
    text(
      g,
      s,
      o.scale === "linear"
        ? "排列口径：实际日期间隔（天）"
        : "排列口径：等距节点",
      b.x,
      b.y + b.h,
      24,
      s.accent,
    );
  }
  const mediaCache = new Map();
  const videoQueues = new WeakMap();
  const videoFrames = new WeakMap();
  const nativeEntries = new Map();
  const nativeMedia = () => root.webkit?.messageHandlers?.motionMedia;
  function captureVideoFrame(video) {
    let canvas = videoFrames.get(video);
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      videoFrames.set(video, canvas);
    }
    const context = canvas.getContext("2d", {
      alpha: false,
      willReadFrequently: true,
    });
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
  }
  async function prepareAssets(raw) {
    if (!raw.motion) return;
    const c = configOf(raw),
      entries =
        c.templateId === "split-compare"
          ? [c.data.left, c.data.right]
          : c.templateId === "timeline-ruler"
            ? c.data.events.map((r) => ({ src: r.image, kind: "image" }))
            : c.templateId === "product-scene-focus"
              ? [{ src: c.options.asset, kind: "image" }]
              : [];
    await Promise.all(
      [
        ...new Map(
          entries.filter((e) => e.src).map((e) => [e.src, e]),
        ).values(),
      ].map((e) => {
        if (mediaCache.has(e.src)) return;
        if (e.kind === "video" && nativeMedia()) {
          return nativeMedia()
            .postMessage({ action: "open", src: e.src })
            .then((meta) => {
              if (!nativeEntries.has(meta.key))
                nativeEntries.set(meta.key, { ...meta, nativeVideo: true });
              mediaCache.set(e.src, nativeEntries.get(meta.key));
            });
        }
        return new Promise((resolve, reject) => {
          const el = document.createElement(
            e.kind === "video" ? "video" : "img",
          );
          let timer = setTimeout(
            () => reject(new Error("本地素材解码超时")),
            15000,
          );
          const done = () => {
            clearTimeout(timer);
            mediaCache.set(e.src, el);
            resolve();
          };
          if (e.kind === "video") {
            el.muted = true;
            el.preload = "auto";
            el.playsInline = true;
            el.setAttribute("muted", "");
            el.setAttribute("playsinline", "");
            el.style.cssText =
              "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none";
            document.body.appendChild(el);
            el.onloadeddata = () => {
              el.onloadeddata = null;
              el.pause();
              done();
            };
          } else el.onload = done;
          el.onerror = () => {
            clearTimeout(timer);
            reject(new Error("本地素材无法解码"));
          };
          if (e.kind === "video") {
            const comma = e.src.indexOf(",");
            const type = e.src.slice(5, e.src.indexOf(";"));
            const bytes = Uint8Array.from(atob(e.src.slice(comma + 1)), (ch) =>
              ch.charCodeAt(0),
            );
            el.src = URL.createObjectURL(new Blob([bytes], { type }));
            el.load();
            el.play().catch(() => {});
          } else el.src = e.src;
        });
      }),
    );
  }
  async function prepareFrame(raw, t) {
    if (raw.motion?.templateId !== "split-compare") return;
    // The scene and asset load already validate the config. Do not clone embedded videos each frame.
    const c = raw.motion,
      sources = [
        ...new Set(
          [c.data.left, c.data.right]
            .filter((s) => s.kind === "video" && s.src)
            .map((s) => s.src),
        ),
      ];
    await Promise.all(
      sources.map((src) => {
        const video = mediaCache.get(src);
        if (!video) throw new Error("视频尚未加载");
        const time = Math.min(
          Math.max(0, video.duration - 0.04),
          c.options.syncStart + Math.max(0, t),
        );
        if (video.nativeVideo) {
          const pending = (videoQueues.get(video) || Promise.resolve())
            .catch(() => {})
            .then(async () => {
              if (video.currentTime === time && videoFrames.has(video)) return;
              const frame = await nativeMedia().postMessage({
                action: "frame",
                key: video.key,
                time,
              });
              const image = new Image();
              await new Promise((resolve, reject) => {
                image.onload = resolve;
                image.onerror = () => reject(new Error("视频帧载入失败"));
                image.src = "data:image/png;base64," + frame.b64;
              });
              videoFrames.set(video, image);
              video.currentTime = time;
              video.actualTime = frame.actualTime;
            });
          videoQueues.set(video, pending);
          return pending;
        }
        const pending = (videoQueues.get(video) || Promise.resolve())
          .catch(() => {})
          .then(async () => {
            if (
              Math.abs(video.currentTime - time) < 0.001 &&
              !video.seeking &&
              video.readyState >= 2
            ) {
              captureVideoFrame(video);
              return;
            }
            await new Promise((resolve, reject) => {
              const done = () => {
                clearTimeout(timer);
                clearInterval(poll);
                video.removeEventListener("seeked", done);
                resolve();
              };
              const timer = setTimeout(() => {
                clearInterval(poll);
                video.removeEventListener("seeked", done);
                reject(
                  new Error(
                    `视频定位超时：目标${time.toFixed(3)}秒，当前位置${video.currentTime.toFixed(3)}秒，状态${video.readyState}/${video.seeking}`,
                  ),
                );
              }, 5000);
              // WebKit may complete a same-frame seek without emitting seeked.
              const poll = setInterval(() => {
                if (
                  !video.seeking &&
                  video.readyState >= 2 &&
                  Math.abs(video.currentTime - time) < 0.001
                )
                  done();
              }, 16);
              video.addEventListener("seeked", done, { once: true });
              video.currentTime = time;
            });
            captureVideoFrame(video);
          });
        videoQueues.set(video, pending);
        return pending;
      }),
    );
  }
  function drawMedia(g, el, x, y, w, h) {
    if (el.nativeVideo && !videoFrames.has(el)) return;
    const iw = el.videoWidth || el.naturalWidth || el.width,
      ih = el.videoHeight || el.naturalHeight || el.height,
      k = Math.min(w / iw, h / ih);
    if (k > 0) {
      g.save();
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      g.drawImage(
        videoFrames.get(el) || el,
        x + (w - iw * k) / 2,
        y + (h - ih * k) / 2,
        iw * k,
        ih * k,
      );
      g.restore();
    }
  }
  function split(g, c, p, b) {
    const s = c.style,
      o = c.options,
      vertical = b.portrait,
      first = vertical ? b.h * o.divider : b.w * o.divider;
    ["left", "right"].forEach((key, i) => {
      const r = c.data[key],
        x = b.x + (vertical ? 0 : i ? first + 15 : 0),
        y = b.y + (vertical && i ? first + 15 : 0),
        w = vertical ? b.w : i ? b.w - first - 15 : first - 15,
        h = vertical ? (i ? b.h - first - 15 : first - 15) : b.h;
      g.el(`side:${key}`, r.label);
      fill(g, tone(s.accent, s.background, i ? 0.95 : 0.9), x, y, w, h, 20);
      text(
        g,
        s,
        r.label,
        x + 24,
        y + 45,
        s.fontSize,
        s.ink,
        "left",
        700,
        w - 48,
      );
      block(g, s, r.desc, x + 24, y + h - 80, w - 48, 70, s.fontSize * 0.8);
      const el = mediaCache.get(r.src);
      if (el) drawMedia(g, el, x + 20, y + 70, w - 40, h - 170);
      else {
        fill(
          g,
          tone(s.accent, s.background, 0.88),
          x + w * 0.15,
          y + h * 0.28,
          w * 0.7,
          h * 0.38,
          20,
        );
        text(
          g,
          s,
          "导入本地图片或视频",
          x + w / 2,
          y + h * 0.5,
          s.fontSize,
          s.accent,
          "center",
          600,
          w * 0.7,
        );
        text(
          g,
          s,
          "左右素材按同一秒数同步定位",
          x + w / 2,
          y + h * 0.6,
          22,
          s.ink,
          "center",
          500,
          w * 0.75,
        );
      }
    });
  }
  function stacked(g, c, p, b) {
    const s = c.style,
      o = c.options,
      d = c.data,
      rs = O.researchValues(c),
      n = rs.length,
      x0 = b.x + 80,
      y0 = b.y + 30,
      w = b.w - 110,
      h = b.h - 160,
      max =
        o.stackMode === "percent"
          ? 100
          : Math.max(1, ...rs.map((r) => r.total)),
      N = Math.max(1, (n - 1) * 12),
      at = (i, fx) => {
        const a = Math.min(Math.max(0, Math.floor(fx)), Math.max(0, n - 2)),
          bb = Math.min(n - 1, a + 1),
          k = (1 - Math.cos(clamp(fx - a) * Math.PI)) / 2;
        return lerp(rs[a]?.values[i] || 0, rs[bb]?.values[i] || 0, k);
      },
      sx = (q) => x0 + q * w,
      sy = (v) => y0 + h - (h * v) / max;
    for (let i = 0; i < 5; i++) {
      const k = i / 4;
      line(
        g,
        tone(s.ink, s.background, 0.9),
        x0,
        y0 + h * (1 - k),
        x0 + w,
        y0 + h * (1 - k),
      );
      text(
        g,
        s,
        `${Number((k * max).toFixed(1))}${o.stackMode === "percent" ? "%" : s.unit}`,
        x0 - 14,
        y0 + h * (1 - k) + 7,
        20,
        s.ink,
        "right",
      );
    }
    const reveal = inOut(clamp(p / 0.85));
    d.series.forEach((r, i) => {
      g.el(`series:${i}`, r.name);
      g.save();
      g.beginPath();
      g.rect(x0, y0, w * reveal, h + 1);
      g.clip();
      g.globalAlpha = o.highlight && o.highlight !== r.name ? 0.22 : 0.85;
      g.fillStyle = r.color || s.colors[i % s.colors.length];
      g.beginPath();
      for (let k = 0; k <= N; k++) {
        const fx = (k / N) * Math.max(0, n - 1),
          sum = d.series.slice(0, i + 1).reduce((a, _, j) => a + at(j, fx), 0);
        if (!k) g.moveTo(sx(k / N), sy(sum));
        else g.lineTo(sx(k / N), sy(sum));
      }
      for (let k = N; k >= 0; k--) {
        const fx = (k / N) * Math.max(0, n - 1),
          sum = d.series.slice(0, i).reduce((a, _, j) => a + at(j, fx), 0);
        g.lineTo(sx(k / N), sy(sum));
      }
      g.closePath();
      g.fill();
      g.restore();
    });
    d.xLabels.forEach((l, i) => {
      if (n <= 12 || i % Math.ceil(n / 10) === 0)
        text(
          g,
          s,
          l,
          x0 + (n === 1 ? 0.5 : i / (n - 1)) * w,
          y0 + h + 32,
          22,
          s.ink,
          "center",
          500,
          w / Math.min(10, n),
        );
    });
    if (o.showLegend)
      d.series.forEach((r, i) => {
        const x = b.x + (i * b.w) / Math.max(1, d.series.length);
        circle(
          g,
          r.color || s.colors[i % s.colors.length],
          x + 10,
          b.y + b.h - 55,
          8,
        );
        text(
          g,
          s,
          r.name,
          x + 28,
          b.y + b.h - 48,
          23,
          s.ink,
          "left",
          600,
          b.w / d.series.length - 35,
        );
      });
    const rule =
      o.stackMode === "percent"
        ? `百分比堆叠 · 分母：${o.denominator} · 各时点为零时无百分比基数`
        : `绝对数量堆叠 · 单位：${s.unit || "数量"}`;
    text(g, s, rule, b.x, b.y + b.h, 22, s.accent, "left", 500, b.w);
  }
  Object.assign(NAMES, {
    "cohort-regroup": "用户连续重新分组",
    "sample-scale-reveal": "从一个人拉远到整组样本",
    "kinetic-narration": "跟随口播的文字与数据",
    "research-map-journey": "地图镜头与城市数据",
    "decision-path-explainer": "用户决策路径演示",
    "product-scene-focus": "三维场景聚焦（分层视差）",
  });
  const PHASES = {
    "cohort-regroup": ["brand", "dimension", "highlight", "quote"],
    "sample-scale-reveal": ["individual", "subgroup", "total", "target"],
    "kinetic-narration": ["quote", "keyword", "number", "chart", "conclusion"],
  };
  function phaseAt(c, t) {
    const base =
      c.templateId === "sample-scale-reveal"
        ? [
            { phase: "individual", duration: c.options.individualHold },
            { phase: "subgroup", duration: c.options.subgroupHold + 1 },
            {
              phase: "total",
              duration:
                (c.timeline.duration -
                  c.options.individualHold -
                  c.options.subgroupHold -
                  1) /
                2,
            },
            {
              phase: "target",
              duration:
                (c.timeline.duration -
                  c.options.individualHold -
                  c.options.subgroupHold -
                  1) /
                2,
            },
          ]
        : (PHASES[c.templateId] || []).map((phase) => ({
            phase,
            duration: c.timeline.duration / (PHASES[c.templateId]?.length || 1),
          }));
    const seq = c.sequence.length ? c.sequence : base;
    let start = 0;
    for (let i = 0; i < seq.length; i++) {
      if (t < start + seq[i].duration || i === seq.length - 1)
        return {
          phase: seq[i].phase,
          index: i,
          local: clamp((t - start) / seq[i].duration),
          seconds: Math.max(0, t - start),
          duration: seq[i].duration,
        };
      start += seq[i].duration;
    }
    return { phase: "", index: 0, local: 0, seconds: 0, duration: 1 };
  }
  function person(g, col, x, y, size, icon = "person") {
    if (icon === "dot") {
      circle(g, col, x, y, size * 0.36);
      return;
    }
    circle(g, col, x, y - size * 0.28, size * 0.17);
    fill(
      g,
      col,
      x - size * 0.21,
      y - size * 0.06,
      size * 0.42,
      size * 0.48,
      size * 0.12,
    );
    line(
      g,
      col,
      x - size * 0.1,
      y + size * 0.25,
      x - size * 0.13,
      y + size * 0.55,
      size * 0.13,
    );
    line(
      g,
      col,
      x + size * 0.1,
      y + size * 0.25,
      x + size * 0.13,
      y + size * 0.55,
      size * 0.13,
    );
  }
  function groupedPositions(users, field, b, finalLayout = "grid") {
    if (finalLayout === "bars") {
      const names = [...new Set(users.map((r) => r[field]))].sort(),
        positions = new Map(),
        anchors = [];
      const max = Math.max(
        1,
        ...names.map((name) => users.filter((r) => r[field] === name).length),
      );
      const rowH = (b.h - 155) / Math.max(1, names.length),
        pitch = Math.min(
          60,
          Math.sqrt(((b.w - 260) * Math.max(1, rowH - 35)) / max) * 0.75,
        ),
        perRow = Math.max(1, Math.floor((b.w - 260) / pitch));
      names.forEach((name, gi) => {
        const y = b.y + gi * rowH;
        anchors.push({
          name,
          x: b.x,
          y: y + rowH / 2,
          count: users.filter((r) => r[field] === name).length,
        });
        users
          .filter((r) => r[field] === name)
          .forEach((r, i) =>
            positions.set(r.__id, {
              x: b.x + 240 + ((i % perRow) + 0.5) * pitch,
              y: y + 22 + (Math.floor(i / perRow) + 0.5) * pitch,
            }),
          );
      });
      return { positions, groups: anchors, size: Math.max(4, pitch * 0.6) };
    }
    const groups = [...new Set(users.map((r) => r[field]))].sort(),
      cols = Math.min(b.portrait ? 2 : 4, Math.max(1, groups.length)),
      rows = Math.ceil(groups.length / cols),
      gw = b.w / cols,
      gh = (b.h - 155) / Math.max(1, rows),
      out = new Map(),
      anchors = [];
    const maxN = Math.max(
        1,
        ...groups.map((name) => users.filter((u) => u[field] === name).length),
      ),
      pitch = Math.min(
        86,
        Math.sqrt(Math.max(1, ((gw - 60) * (gh - 70)) / maxN)) * 0.74,
      ),
      perRow = Math.max(1, Math.floor((gw - 50) / pitch));
    groups.forEach((name, gi) => {
      const x = b.x + (gi % cols) * gw,
        y = b.y + Math.floor(gi / cols) * gh,
        rs = users.filter((r) => r[field] === name);
      anchors.push({ name, x: x + 20, y: y + 22, count: rs.length });
      rs.forEach((r, i) => {
        out.set(r.__id, {
          x: x + 25 + ((i % perRow) + 0.5) * pitch,
          y: y + 65 + (Math.floor(i / perRow) + 0.5) * pitch,
        });
      });
    });
    return { positions: out, groups: anchors, size: Math.max(4, pitch * 0.6) };
  }
  function cohortState(c, t, b) {
    const m = c.fieldMappings,
      o = c.options,
      ph = phaseAt(c, t);
    if (o.mode !== "individual")
      return {
        phase: ph,
        users: [],
        total: c.data.aggregates.reduce((a, r) => a + r.value, 0),
      };
    let users = c.data.users.map((r) => ({ ...r, __id: r[m.id] }));
    if (o.sort === "id")
      users.sort((a, b) => String(a.__id).localeCompare(String(b.__id)));
    const A = groupedPositions(users, m.from, b),
      B = groupedPositions(users, m.to, b, o.finalLayout),
      step =
        ph.phase === "brand"
          ? 0
          : ph.phase === "dimension"
            ? inOut(clamp(ph.seconds / o.transitionSeconds))
            : 1;
    const target =
        ph.phase === "dimension" ||
        ph.phase === "highlight" ||
        ph.phase === "quote",
      size = Math.min(A.size, B.size),
      positions = users.map((r, i) => {
        const a = A.positions.get(r.__id),
          z = B.positions.get(r.__id);
        return {
          id: r.__id,
          x:
            lerp(a.x, z.x, step) +
            Math.sin(step * Math.PI) * Math.sin(i * 2.4) * 18,
          y:
            lerp(a.y, z.y, step) +
            Math.sin(step * Math.PI) * Math.cos(i * 1.7) * 12,
          record: r,
          color:
            o.colors[r[m.from]] ||
            c.style.colors[
              [...new Set(users.map((r) => r[m.from]))].indexOf(r[m.from]) %
                c.style.colors.length
            ],
        };
      });
    // Stable spatial relaxation: keeps icons separated during crossing paths, without scaling their bodies.
    if (step > 0 && step < 1)
      for (let pass = 0; pass < 3; pass++) {
        const grid = new Map(),
          cell = size * 1.3;
        for (const q of positions) {
          const gx = Math.floor(q.x / cell),
            gy = Math.floor(q.y / cell);
          for (let dx = -1; dx <= 1; dx++)
            for (let dy = -1; dy <= 1; dy++)
              for (const other of grid.get(`${gx + dx}:${gy + dy}`) || []) {
                let vx = q.x - other.x,
                  vy = q.y - other.y,
                  dist = Math.hypot(vx, vy),
                  min = size * 0.94;
                if (dist < min) {
                  if (dist < 0.001) {
                    vx = 1;
                    vy = 0;
                    dist = 1;
                  }
                  const push = (min - dist) * 0.5;
                  q.x += (vx / dist) * push;
                  q.y += (vy / dist) * push;
                  other.x -= (vx / dist) * push;
                  other.y -= (vy / dist) * push;
                }
              }
          const key = `${gx}:${gy}`;
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key).push(q);
        }
      }
    return {
      phase: ph,
      users: positions,
      groups: target ? B.groups : A.groups,
      size,
      total: users.reduce((a, r) => a + r[m.weight], 0),
      target: users
        .filter((r) => r[m.to] === o.highlight)
        .reduce((a, r) => a + r[m.weight], 0),
    };
  }
  function cohort(g, c, t, p, b) {
    const s = c.style,
      o = c.options,
      m = c.fieldMappings,
      state = cohortState(c, t, b);
    if (o.mode === "aggregate") {
      const max = Math.max(1, ...c.data.aggregates.map((r) => r.value)),
        rh = (b.h - 80) / Math.max(1, c.data.aggregates.length);
      c.data.aggregates.forEach((r, i) => {
        g.el(`aggregate:${i}`, r.label);
        text(g, s, r.label, b.x, b.y + i * rh + 30, s.fontSize);
        fill(
          g,
          s.colors[i % s.colors.length],
          b.x + b.w * 0.28,
          b.y + i * rh + 4,
          ((b.w * 0.56 * r.value) / max) * out(p),
          rh * 0.5,
          10,
        );
        text(
          g,
          s,
          String(r.value),
          b.x + b.w,
          b.y + i * rh + 30,
          s.fontSize,
          s.ink,
          "right",
        );
      });
      text(
        g,
        s,
        "汇总数据展示 · 无可关联记录，不生成个体跨维度对应关系",
        b.x,
        b.y + b.h,
        24,
        s.accent,
        "left",
        500,
        b.w,
      );
      return;
    }
    state.groups.forEach((r) => {
      g.el(`label:${r.name}`, r.name, D.TEXT);
      text(
        g,
        s,
        r.name,
        r.x,
        r.y,
        s.fontSize,
        s.ink,
        "left",
        700,
        b.w / (b.portrait ? 2 : 4) - 30,
      );
    });
    const selected = o.selectedId;
    state.users.forEach((q) => {
      g.el(`user:${q.id}`, q.record[m.label]);
      g.save();
      g.globalAlpha =
        ["highlight", "quote"].includes(state.phase.phase) &&
        o.highlight &&
        q.record[m.to] !== o.highlight
          ? 0.16
          : 1;
      person(g, q.color, q.x, q.y, state.size, o.icon);
      if (q.id === selected) {
        g.strokeStyle = s.ink;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(q.x, q.y, state.size * 0.8, 0, Math.PI * 2);
        g.stroke();
      }
      g.restore();
    });
    const who = state.users.find((q) => q.id === selected);
    g.el("cohort-note", "分组说明", D.TEXT);
    text(
      g,
      s,
      `${state.phase.phase === "brand" ? o.fromLabel : o.toLabel} · ${state.users.length} 条稳定 ID 记录 · 权重合计 ${state.total} 人 · 目标 ${state.target} 人`,
      b.x,
      b.y + b.h - 112,
      24,
      s.accent,
      "left",
      600,
      b.w,
    );
    if (who && state.phase.phase === "quote")
      block(
        g,
        s,
        `${who.record[m.label]}（${who.id}，权重 ${who.record[m.weight]}）：${who.record[m.quote]}`,
        b.x,
        b.y + b.h - 85,
        b.w,
        100,
        30,
      );
    if (
      o.finalLayout === "bars" &&
      ["highlight", "quote"].includes(state.phase.phase)
    ) {
      const total = state.users.length,
        colors = new Map();
      state.users.forEach((q) => {
        const key = q.record[m.to];
        if (!colors.has(key)) colors.set(key, []);
        colors.get(key).push(q);
      });
      let at = 0;
      for (const [name, rs] of colors) {
        fill(
          g,
          s.colors[[...colors.keys()].indexOf(name) % s.colors.length],
          b.x + (b.w * at) / Math.max(1, total),
          b.y + b.h - 38,
          (b.w * rs.length) / Math.max(1, total),
          18,
          0,
        );
        at += rs.length;
      }
    }
  }
  function sampleState(c, t) {
    const d = c.data,
      o = c.options,
      phase = phaseAt(c, t),
      n = d.total > 0 ? 1 + Math.ceil((d.total - 1) / o.perMarker) : 0,
      markers = Array.from({ length: n }, (_, i) => {
        const start = i === 0 ? 0 : 1 + (i - 1) * o.perMarker,
          weight = i === 0 ? 1 : Math.min(o.perMarker, d.total - start),
          target = Math.max(0, Math.min(weight, d.target - start));
        return { id: `sample:${i}`, weight, target };
      });
    return {
      phase,
      markers,
      total: d.total,
      target: d.target,
      percent: d.total ? (100 * d.target) / d.total : 0,
    };
  }
  function sample(g, c, t, p, b) {
    const s = c.style,
      o = c.options,
      d = c.data,
      state = sampleState(c, t),
      ph = state.phase,
      n = state.markers.length,
      cols =
        o.arrangement === "rows"
          ? Math.max(1, Math.ceil(Math.sqrt(n) * 1.7))
          : Math.max(1, Math.ceil(Math.sqrt(n * (b.w / (b.h * 0.75))))),
      pitch = Math.min(
        b.w / (cols + 2),
        (b.h - 170) / (Math.ceil(n / cols) + 1),
      ),
      radius = pitch * 0.28,
      x0 = b.x + pitch,
      y0 = b.y + pitch;
    const full = 1,
      group = Math.min(
        4,
        Math.sqrt(Math.max(1, (n * o.perMarker) / Math.max(1, d.subgroup))),
      ),
      individual = Math.min(
        14,
        Math.max(group, (Math.sqrt(Math.max(1, n)) * 0.8 * c.camera.zoom) / 2),
      );
    let zoom = full;
    if (ph.phase === "individual") zoom = individual;
    else if (ph.phase === "subgroup")
      zoom = lerp(
        individual,
        group,
        inOut(clamp(ph.seconds / Math.max(0.4, ph.duration - o.subgroupHold))),
      );
    else if (ph.phase === "total")
      zoom = lerp(
        group,
        1,
        inOut(clamp(ph.seconds / Math.max(0.5, ph.duration * 0.6))),
      );
    const focusX = x0 + pitch / 2,
      focusY = y0 + pitch / 2,
      pan = o.cameraRoute === "pan-zoom" ? 0.15 : 0,
      desiredX = b.x + b.w * (0.3 + pan),
      desiredY = b.y + b.h * 0.4;
    g.el("sample-world", "样本标记");
    g.save();
    g.beginPath();
    g.rect(b.x, b.y, b.w, b.h - 125);
    g.clip();
    g.translate(
      lerp(
        0,
        desiredX - focusX * zoom,
        clamp((zoom - 1) / Math.max(1, individual - 1)),
      ),
      lerp(
        0,
        desiredY - focusY * zoom,
        clamp((zoom - 1) / Math.max(1, individual - 1)),
      ),
    );
    g.scale(zoom, zoom);
    state.markers.forEach((r, i) => {
      g.el(r.id, `${r.weight}名用户`);
      const x = x0 + ((i % cols) + 0.5) * pitch,
        y = y0 + (Math.floor(i / cols) + 0.5) * pitch;
      circle(g, tone(s.ink, s.background, 0.75), x, y, radius);
      if (ph.phase === "target" && r.target) {
        g.fillStyle = o.highlightColor;
        g.beginPath();
        g.moveTo(x, y);
        g.arc(
          x,
          y,
          radius,
          -Math.PI / 2,
          -Math.PI / 2 + (Math.PI * 2 * r.target) / r.weight,
        );
        g.closePath();
        g.fill();
      }
      if (
        ph.phase === "subgroup" &&
        (i === 0 ? 0 : 1 + (i - 1) * o.perMarker) < d.subgroup
      ) {
        g.strokeStyle = o.highlightColor;
        g.lineWidth = 1.5 / zoom;
        g.beginPath();
        g.arc(x, y, radius * 1.2, 0, Math.PI * 2);
        g.stroke();
      }
    });
    g.restore();
    g.el("sample-annotation", "样本层级与原声", D.TEXT);
    const title =
      ph.phase === "individual"
        ? `${o.individualLabel} · ${d.person.label}`
        : ph.phase === "subgroup"
          ? `${o.subgroupLabel} · ${d.subgroup}人`
          : ph.phase === "total"
            ? `${o.totalLabel} · ${d.total}人`
            : `${o.targetLabel} · ${d.target} / ${d.total}人（${pct(state.percent)}）`;
    text(g, s, title, b.x, b.y + b.h - 72, 36, s.accent, "left", 700, b.w);
    text(
      g,
      s,
      `首标记 = 1 人；完整标记 = ${o.perMarker} 人；末标记 = ${state.markers.at(-1)?.weight || 0} 人，部分着色按实际人数计算`,
      b.x,
      b.y + b.h - 22,
      23,
      s.ink,
      "left",
      500,
      b.w,
    );
    if (ph.phase === "individual")
      block(
        g,
        s,
        `“${d.person.quote}”`,
        b.x + b.w * 0.52,
        b.y + b.h * 0.12,
        b.w * 0.45,
        b.h * 0.6,
        42,
      );
  }
  function narration(g, c, t, p, b) {
    const s = c.style,
      o = c.options,
      ph = phaseAt(c, t),
      sequenced = c.sequence.length > 0,
      chartOn = sequenced
        ? ["chart", "conclusion"].includes(ph.phase)
        : t >= o.chartAt,
      conclusionOn = sequenced
        ? ph.phase === "conclusion"
        : t >= o.conclusionAt;
    let cue =
      c.data.cues.find((r) => t >= r.start && t < r.end) ||
      [...c.data.cues].reverse().find((r) => t >= r.start) ||
      c.data.cues[0];
    if (!cue) return;
    if (sequenced && ["quote", "keyword"].includes(ph.phase))
      cue = c.data.cues[0] || cue;
    const appear = out(clamp((t - cue.start) / 0.35)),
      keywords = cue.keywords,
      retained =
        sequenced &&
        ["keyword", "number", "chart", "conclusion"].includes(ph.phase),
      num = `${c.data.chart.value}${c.data.chart.unit}`;
    if (!chartOn) {
      g.el("narration", "口播短句", D.TEXT);
      g.save();
      g.globalAlpha = appear;
      block(
        g,
        s,
        retained && keywords.length ? keywords.join(" · ") : cue.text,
        b.x + b.w * 0.08,
        b.y + b.h * 0.08,
        b.w * 0.84,
        b.h * 0.56,
        Math.min(76, s.fontSize * 2),
        s.ink,
        600,
      );
      g.restore();
      if (keywords.length) {
        g.el("keywords", "关键词", D.TEXT);
        const fs = cue.emphasis === "scale" ? 68 : 48,
          x = cue.emphasis === "position" ? b.x + b.w * 0.18 : b.x + b.w * 0.08;
        block(
          g,
          s,
          keywords.join(" · "),
          x,
          b.y + b.h * 0.62,
          b.w * 0.75,
          b.h * 0.3,
          fs,
          s.accent,
          700,
        );
      }
      if (
        (sequenced && ph.phase === "number") ||
        (!sequenced && t > o.chartAt - 0.8)
      ) {
        g.el("retained-number", "保留的原始数字", D.TEXT);
        text(
          g,
          s,
          num,
          b.x + b.w * 0.8,
          b.y + b.h * 0.76,
          90,
          s.accent,
          "center",
          700,
          b.w * 0.35,
        );
      }
    } else {
      const chart = O.defaults(c.data.chart.templateId),
        d = c.data.chart;
      chart.style = { ...c.style, title: "", subtitle: "", unit: d.unit };
      chart.metadata = { ...c.metadata, showTitle: false, showSubtitle: false };
      chart.options =
        chart.templateId === "poll-results-bars"
          ? {
              ...chart.options,
              inputMode: "percent",
              questionType: "single",
              totalVotes: c.metadata.sampleSize,
              highlight: 0,
              winnerLabel: "",
            }
          : { ...chart.options, label: o.chartLabel };
      if (chart.templateId === "poll-results-bars") {
        chart.data = {
          options: d.labels.map((label, i) => ({ label, value: d.values[i] })),
        };
        chart.options.questionType =
          d.values.reduce((a, v) => a + v, 0) > 100 ? "multiple" : "single";
      } else
        chart.data = {
          keyframes: [
            [0, 0],
            [1, d.value],
          ],
        };
      const cp = conclusionOn
        ? 1
        : out(sequenced ? ph.local : clamp((t - o.chartAt) / 1.4));
      if (chart.templateId === "poll-results-bars")
        poll(g, chart, cp, { ...b, h: b.h * 0.72 });
      else
        counter(g, chart, cp * chart.timeline.duration, { ...b, h: b.h * 0.7 });
      const transfer = conclusionOn
        ? 1
        : out(clamp((sequenced ? ph.seconds : t - o.chartAt) / 0.6));
      const movingSize = lerp(90, 32, transfer);
      g.font = `700 ${movingSize}px ${fontFamily(s)}`;
      const movingWidth = g.measureText(num).width;
      g.el("retained-number", "保留的原始数字", D.TEXT);
      text(
        g,
        s,
        num,
        lerp(b.x + b.w * 0.8 - movingWidth / 2, b.x, transfer),
        lerp(b.y + b.h * 0.76, b.y + b.h * 0.79, transfer),
        movingSize,
        s.accent,
        "left",
        700,
        b.w,
      );
      if (transfer >= 1) {
        const numberWidth = g.measureText(num).width;
        text(
          g,
          s,
          ` · ${o.chartLabel}`,
          b.x + numberWidth + 8,
          b.y + b.h * 0.79,
          32,
          s.accent,
          "left",
          700,
          b.w - numberWidth - 8,
        );
      }
      if (conclusionOn)
        block(
          g,
          s,
          o.conclusion,
          b.x,
          b.y + b.h * 0.83,
          b.w,
          b.h * 0.16,
          36,
          s.ink,
          700,
        );
    }
  }
  function mapJourney(g, c, t, p, b) {
    const s = c.style,
      o = c.options,
      cs = o.order.map((id) => c.data.cities.find((r) => r.id === id)),
      cycle = o.holdSeconds + o.moveSeconds,
      idx = Math.min(cs.length - 1, Math.floor(t / cycle)),
      active = cs[idx];
    if (!active) return;
    const prev = cs[Math.max(0, idx - 1)],
      local = t - idx * cycle,
      move = inOut(clamp(local / o.moveSeconds)),
      focus =
        idx === 0
          ? active
          : {
              lon: lerp(prev.lon, active.lon, move),
              lat: lerp(prev.lat, active.lat, move),
            },
      allLon = cs.map((r) => r.lon),
      allLat = cs.map((r) => r.lat),
      spanX = Math.max(20, Math.max(...allLon) - Math.min(...allLon) + 15),
      spanY = Math.max(15, Math.max(...allLat) - Math.min(...allLat) + 12),
      zoom = lerp(
        1,
        Math.min(8, (o.zoom * c.camera.zoom) / 2),
        clamp((t - 0.5) / 1.2),
      ),
      cx = lerp(
        (Math.min(...allLon) + Math.max(...allLon)) / 2,
        focus.lon,
        clamp((zoom - 1) / (o.zoom - 1 || 1)),
      ),
      cy = lerp(
        (Math.min(...allLat) + Math.max(...allLat)) / 2,
        focus.lat,
        clamp((zoom - 1) / (o.zoom - 1 || 1)),
      ),
      mapW = b.portrait ? b.w : b.w * 0.66,
      mapH = b.portrait ? b.h * 0.6 : b.h,
      sx = (lon) => b.x + mapW / 2 + ((lon - cx) / spanX) * mapW * zoom,
      sy = (lat) => b.y + mapH / 2 - ((lat - cy) / spanY) * mapH * zoom;
    g.el("map", "本地地图");
    g.save();
    g.beginPath();
    g.rect(b.x, b.y, mapW, mapH);
    g.clip();
    fill(g, tone(s.accent, s.background, 0.96), b.x, b.y, mapW, mapH, 18);
    for (let lon = -180; lon <= 180; lon += 5)
      line(
        g,
        tone(s.ink, s.background, 0.92),
        sx(lon),
        b.y,
        sx(lon),
        b.y + mapH,
        1,
      );
    for (let lat = -80; lat <= 80; lat += 5)
      line(
        g,
        tone(s.ink, s.background, 0.92),
        b.x,
        sy(lat),
        b.x + mapW,
        sy(lat),
        1,
      );
    for (const polygon of root.DM_LAND || []) {
      g.fillStyle = o.mapColor;
      g.beginPath();
      polygon.forEach((pt, i) => {
        if (i === 0) g.moveTo(sx(pt[0]), sy(pt[1]));
        else g.lineTo(sx(pt[0]), sy(pt[1]));
      });
      g.closePath();
      g.fill();
    }
    c.data.links.forEach((r, i) => {
      const a = cs.find((q) => q.id === r.from),
        z = cs.find((q) => q.id === r.to);
      g.el(`relation:${i}`, `${a.name} → ${z.name}`);
      line(
        g,
        tone(s.accent, s.background, 0.4),
        sx(a.lon),
        sy(a.lat),
        sx(z.lon),
        sy(z.lat),
        3,
      );
    });
    cs.forEach((r, i) => {
      g.el(`city:${r.id}`, r.name);
      const x = sx(r.lon),
        y = sy(r.lat),
        col = r.id === active.id ? o.highlightColor : s.accent;
      circle(g, tone(col, s.background, 0.65), x, y, 18);
      circle(g, col, x, y, 7);
      if (o.pointStyle === "pin") {
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(x, y + 18);
        g.lineTo(x - 10, y);
        g.lineTo(x + 10, y);
        g.closePath();
        g.fill();
      }
      text(
        g,
        s,
        r.name,
        x + 22,
        y + (i % 2 ? 32 : -18),
        28,
        s.ink,
        "left",
        600,
        150,
      );
    });
    g.restore();
    const x = b.portrait ? b.x : b.x + mapW + 38,
      y = b.portrait ? b.y + mapH + 30 : b.y + 55,
      w = b.portrait ? b.w : b.w - mapW - 38;
    g.el("city-card", "城市研究卡片", D.TEXT);
    text(g, s, active.name, x, y + 32, 48, s.accent, "left", 700, w);
    text(
      g,
      s,
      `${Math.abs(active.lon).toFixed(3)}°${active.lon < 0 ? "W" : "E"} / ${Math.abs(active.lat).toFixed(3)}°${active.lat < 0 ? "S" : "N"}`,
      x,
      y + 80,
      22,
      s.ink,
      "left",
      500,
      w,
    );
    text(
      g,
      s,
      `样本 ${active.sample} 人`,
      x,
      y + 138,
      30,
      s.ink,
      "left",
      600,
      w,
    );
    text(
      g,
      s,
      `${active.value}${s.unit}`,
      x,
      y + 230,
      72,
      s.accent,
      "left",
      700,
      w,
    );
    block(g, s, active.label, x, y + 260, w, 120, 32);
    text(
      g,
      s,
      "经纬度投影 · 本地陆地轮廓",
      b.x,
      b.y + b.h,
      20,
      s.ink,
      "left",
      500,
      mapW,
    );
  }
  function icon(g, type, col, x, y, size) {
    if (type === "person") return person(g, col, x, y, size);
    if (type === "phone") {
      fill(
        g,
        col,
        x - size * 0.28,
        y - size * 0.45,
        size * 0.56,
        size * 0.9,
        size * 0.08,
      );
      fill(
        g,
        "#F7F1E8",
        x - size * 0.2,
        y - size * 0.32,
        size * 0.4,
        size * 0.58,
        3,
      );
      return;
    }
    if (type === "store") {
      fill(g, col, x - size * 0.4, y - size * 0.18, size * 0.8, size * 0.55, 4);
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(x - size * 0.5, y - size * 0.2);
      g.lineTo(x, y - size * 0.5);
      g.lineTo(x + size * 0.5, y - size * 0.2);
      g.closePath();
      g.fill();
      return;
    }
    if (type === "message") {
      fill(g, col, x - size * 0.45, y - size * 0.35, size * 0.9, size * 0.6, 9);
      line(
        g,
        col,
        x - size * 0.2,
        y + size * 0.2,
        x - size * 0.35,
        y + size * 0.4,
        8,
      );
      return;
    }
    line(
      g,
      col,
      x - size * 0.3,
      y - size * 0.3,
      x + size * 0.3,
      y + size * 0.3,
      6,
    );
    line(
      g,
      col,
      x + size * 0.3,
      y - size * 0.3,
      x - size * 0.3,
      y + size * 0.3,
      6,
    );
  }
  function decision(g, c, t, p, b) {
    const s = c.style,
      o = c.options,
      ns = c.data.nodes,
      xy = (r) => ({
        x: b.x + 60 + r.x * (b.w - 120),
        y: b.y + 70 + r.y * (b.h - 190),
      });
    c.data.links.forEach((r, i) => {
      const a = ns.find((n) => n.id === r.from),
        z = ns.find((n) => n.id === r.to),
        A = xy(a),
        Z = xy(z),
        dx = Z.x - A.x,
        dy = Z.y - A.y,
        dist = Math.max(1, Math.hypot(dx, dy)),
        ux = dx / dist,
        uy = dy / dist,
        start = { x: A.x + ux * 40, y: A.y + uy * 40 },
        end = { x: Z.x - ux * 40, y: Z.y - uy * 40 },
        col =
          o.highlight && o.highlight !== r.from && o.highlight !== r.to
            ? tone(s.ink, s.background, 0.85)
            : tone(s.accent, s.background, 0.3);
      g.el(`path:${i}`, `${r.from} → ${r.to}`);
      const curve = Math.abs(dy) > 80;
      g.strokeStyle = col;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(start.x, start.y);
      const control = {
        x: (start.x + end.x) / 2 + (curve ? 50 : 0),
        y: (start.y + end.y) / 2 - (curve ? 30 : 0),
      };
      g.quadraticCurveTo(control.x, control.y, end.x, end.y);
      g.stroke();
      const angle = Math.atan2(end.y - control.y, end.x - control.x);
      line(
        g,
        col,
        end.x,
        end.y,
        end.x - 14 * Math.cos(angle - 0.45),
        end.y - 14 * Math.sin(angle - 0.45),
        3,
      );
      line(
        g,
        col,
        end.x,
        end.y,
        end.x - 14 * Math.cos(angle + 0.45),
        end.y - 14 * Math.sin(angle + 0.45),
        3,
      );
      if (o.showCounts && r.value !== undefined)
        text(
          g,
          s,
          String(r.value),
          control.x,
          control.y - 16,
          22,
          s.ink,
          "center",
          600,
          100,
        );
      if (t >= r.at && t <= r.at + r.duration) {
        const k = inOut((t - r.at) / r.duration),
          x =
            (1 - k) ** 2 * start.x +
            2 * (1 - k) * k * control.x +
            k * k * end.x,
          y =
            (1 - k) ** 2 * start.y +
            2 * (1 - k) * k * control.y +
            k * k * end.y;
        person(g, s.accent, x, y, 24, o.markerIcon);
      }
    });
    const current = [...ns]
      .filter((r) => r.at <= t)
      .sort((a, b) => b.at - a.at)[0];
    ns.forEach((r) => {
      g.el(`step:${r.id}`, r.label);
      const at = xy(r),
        a = prog(t, r.at, r.at + 0.35),
        col =
          current?.id === r.id || o.highlight === r.id
            ? s.accent
            : tone(s.ink, s.background, 0.45);
      g.save();
      g.globalAlpha = a;
      circle(g, tone(col, s.background, 0.9), at.x, at.y, 44);
      icon(g, r.icon, col, at.x, at.y, 48);
      text(
        g,
        s,
        r.label,
        at.x,
        at.y + 82,
        s.fontSize,
        s.ink,
        "center",
        600,
        Math.min(260, b.w * 0.26),
      );
      if (o.showCounts && r.count !== undefined)
        text(
          g,
          s,
          `${r.count} 人`,
          at.x,
          at.y + 119,
          23,
          col,
          "center",
          600,
          150,
        );
      g.restore();
    });
    if (current) {
      g.el("step-note", "步骤解说", D.TEXT);
      block(g, s, current.body, b.x, b.y + b.h - 50, b.w, 65, 30);
    }
  }
  function scene(g, c, t, p, b) {
    const s = c.style,
      o = c.options,
      d = c.data,
      r = d.regions.find((r) => r.id === o.focusId),
      zoom =
        1 +
        (c.camera.zoom - 1) *
          prog(t, o.focusAt, o.focusAt + o.moveSeconds) *
          (1 - prog(t, o.returnAt, o.returnAt + o.moveSeconds)),
      origin = { x: b.x + b.w * 0.35, y: b.y + b.h * 0.49 },
      deviceW = Math.min(b.w * 0.38, 310),
      deviceH = Math.min(b.h * 0.82, 560),
      target = r
        ? {
            x: origin.x + (r.x - 0.5) * deviceW,
            y: origin.y + (r.y - 0.5) * deviceH,
          }
        : origin,
      pan = clamp((zoom - 1) / (c.camera.zoom - 1 || 1)),
      camx = lerp(0, origin.x - target.x * zoom, pan),
      camy = lerp(0, origin.y - target.y * zoom, pan),
      project = (x, y) => ({ x: x * zoom + camx, y: y * zoom + camy });
    g.el("scene", "参数化分层场景");
    g.save();
    g.beginPath();
    g.rect(b.x, b.y, b.w * 0.6, b.h - 60);
    g.clip();
    g.translate(camx, camy);
    g.scale(zoom, zoom);
    const asset = mediaCache.get(o.asset);
    if (asset)
      drawMedia(
        g,
        asset,
        origin.x - deviceW / 2,
        origin.y - deviceH / 2,
        deviceW,
        deviceH,
      );
    else if (d.scene === "phone") {
      fill(
        g,
        tone(s.ink, s.background, 0.8),
        origin.x - deviceW / 2 + 18,
        origin.y - deviceH / 2 + 22,
        deviceW,
        deviceH,
        38,
      );
      fill(
        g,
        s.ink,
        origin.x - deviceW / 2,
        origin.y - deviceH / 2,
        deviceW,
        deviceH,
        38,
      );
      fill(
        g,
        tone(s.accent, s.background, 0.92),
        origin.x - deviceW / 2 + 14,
        origin.y - deviceH / 2 + 18,
        deviceW - 28,
        deviceH - 36,
        28,
      );
      fill(g, s.ink, origin.x - 38, origin.y - deviceH / 2 + 28, 76, 12, 6);
      for (let i = 0; i < 9; i++)
        fill(
          g,
          s.colors[i % s.colors.length],
          origin.x - deviceW * 0.33 + (i % 3) * deviceW * 0.25,
          origin.y - deviceH * 0.25 + Math.floor(i / 3) * deviceH * 0.2,
          deviceW * 0.15,
          deviceW * 0.15,
          10,
        );
    } else if (d.scene === "cockpit") {
      fill(
        g,
        s.ink,
        origin.x - deviceW * 0.7,
        origin.y - deviceH * 0.3,
        deviceW * 1.4,
        deviceH * 0.6,
        35,
      );
      fill(
        g,
        tone(s.accent, s.background, 0.8),
        origin.x - deviceW * 0.55,
        origin.y - deviceH * 0.22,
        deviceW * 1.1,
        deviceH * 0.3,
        12,
      );
      g.strokeStyle = s.accent;
      g.lineWidth = 12;
      g.beginPath();
      g.arc(
        origin.x - deviceW * 0.3,
        origin.y + deviceH * 0.2,
        60,
        0,
        Math.PI * 2,
      );
      g.stroke();
    } else {
      fill(
        g,
        s.ink,
        origin.x - deviceW * 0.65,
        origin.y - deviceH * 0.3,
        deviceW * 1.3,
        deviceH * 0.65,
        12,
      );
      fill(
        g,
        tone(s.accent, s.background, 0.75),
        origin.x - deviceW * 0.6,
        origin.y - deviceH * 0.4,
        deviceW * 1.2,
        deviceH * 0.15,
        8,
      );
      fill(g, s.background, origin.x - 30, origin.y, 60, deviceH * 0.35, 4);
    }
    d.regions.forEach((q) => {
      g.el(`region:${q.id}`, q.label);
      const x = origin.x + (q.x - 0.5) * deviceW,
        y = origin.y + (q.y - 0.5) * deviceH;
      circle(
        g,
        q.id === o.focusId ? s.accent : tone(s.ink, s.background, 0.4),
        x,
        y,
        8,
      );
    });
    g.restore();
    if (r) {
      const anchor = project(target.x, target.y),
        x = b.x + b.w * 0.65,
        y = b.y + b.h * 0.2;
      g.el("anchored-note", "对象锚定标注", D.TEXT);
      line(
        g,
        s.accent,
        clamp(anchor.x, b.x, b.x + b.w * 0.6),
        clamp(anchor.y, b.y, b.y + b.h - 60),
        x - 15,
        y + 20,
        2,
      );
      block(g, s, r.label, x, y, b.w * 0.33, 100, 38, s.ink, 700);
      text(
        g,
        s,
        `${r.value}${r.unit}`,
        x,
        y + 170,
        82,
        s.accent,
        "left",
        700,
        b.w * 0.33,
      );
      block(g, s, r.body, x, y + 215, b.w * 0.33, b.h * 0.4, 30);
    }
    text(
      g,
      s,
      "分层视差场景 · 基础几何可替换为本地素材",
      b.x,
      b.y + b.h,
      22,
      s.accent,
      "left",
      500,
      b.w,
    );
  }

  function isEmpty(c) {
    const d = c.data;
    if (
      [
        "split-compare",
        "sample-scale-reveal",
        "cohort-regroup",
        "research-map-journey",
        "decision-path-explainer",
        "product-scene-focus",
        "kinetic-narration",
      ].includes(c.templateId)
    )
      return false;
    return Object.values(d)
      .filter(Array.isArray)
      .some((a) => a.length === 0);
  }
  function create(row) {
    const c = configOf(row),
      id = c.templateId;
    return {
      duration: c.timeline.duration,
      draw(g, t) {
        const s = c.style,
          canvas = g.x.canvas,
          availableW = 1920,
          availableH = canvas.height / (canvas.width / 1920),
          ratio = c.output.width / c.output.height;
        const W = ratio >= 16 / 9 ? 1080 * ratio : 1920,
          H = W / ratio,
          k = Math.min(availableW / W, availableH / H);
        g.globalAlpha = 1;
        g.shadowBlur = 0;
        g.shadowOffsetX = 0;
        g.shadowOffsetY = 0;
        g.setLineDash([]);
        g.lineCap = "butt";
        g.lineJoin = "miter";
        if ("filter" in g) g.filter = "none";
        g.bg();
        fill(g, s.background, 0, 0, availableW, availableH);
        g.save();
        g.translate((availableW - W * k) / 2, (availableH - H * k) / 2);
        g.scale(k, k);
        const b = shell(g, c, t, W, H),
          p = progress(c, t);
        if (O.ADVANCED_IDS.includes(id)) {
          g.globalAlpha = prog(
            t,
            c.timeline.entrance,
            c.timeline.entrance + 0.25,
          );
          t = Math.min(
            Math.floor(t * c.output.fps) / c.output.fps,
            c.timeline.duration - c.timeline.hold,
          );
          const e = c.camera.route === "linear" ? p : inOut(p);
          g.translate(
            lerp(c.camera.from[0], c.camera.to[0], e),
            lerp(c.camera.from[1], c.camera.to[1], e),
          );
        }
        if (isEmpty(c)) {
          g.el("empty", "空数据", D.TEXT);
          text(
            g,
            s,
            "暂无数据 · 请粘贴表格或导入 CSV",
            b.x + b.w / 2,
            b.y + b.h / 2,
            36,
            s.ink,
            "center",
            500,
            b.w,
          );
        } else if (id === "comparison-dumbbell") dumbbell(g, c, p, b);
        else if (id === "dot-tally") dots(g, c, p, b);
        else if (id === "bar-race") race(g, c, t, b);
        else if (id === "number-counter") counter(g, c, t, b);
        else if (id === "card-stack-cascade") cards(g, c, t, p, b);
        else if (id === "poll-results-bars") poll(g, c, p, b);
        else if (id === "sankey-flow") sankey(g, c, p, b);
        else if (id === "funnel-conversion") funnel(g, c, p, b);
        else if (id === "bubble-scatter-grow") bubble(g, c, p, b);
        else if (id === "heatmap-calendar") calendar(g, c, p, b);
        else if (id === "testimonial-card-carousel") quotes(g, c, t, p, b);
        else if (id === "timeline-ruler") timeline(g, c, p, b);
        else if (id === "split-compare") split(g, c, p, b);
        else if (id === "stacked-area-flow") stacked(g, c, p, b);
        else if (id === "cohort-regroup") cohort(g, c, t, p, b);
        else if (id === "sample-scale-reveal") sample(g, c, t, p, b);
        else if (id === "kinetic-narration") narration(g, c, t, p, b);
        else if (id === "research-map-journey") mapJourney(g, c, t, p, b);
        else if (id === "decision-path-explainer") decision(g, c, t, p, b);
        else if (id === "product-scene-focus") scene(g, c, t, p, b);
        g.restore();
      },
    };
  }
  D.CATEGORIES.unshift({ id: "research", name: "调研数据 · Opus" });
  O.IDS.forEach((id) =>
    D.register(id, {
      name: NAMES[id],
      en: id,
      family: "数据动效",
      cat: "research",
      desc: `${NAMES[id]} · 可编辑数据、中文样式、时间线和输出`,
      custom: true,
      library: true,
      keywords: [NAMES[id], "调研", "数据", "品牌", "满意度"],
      accepts: (row) => {
        try {
          return row.motion?.templateId === id && !!O.validate(row.motion);
        } catch (e) {
          return false;
        }
      },
      sample: { motion: O.defaults(id) },
      create,
    }),
  );
  D.CATEGORIES.unshift({ id: "research-presets", name: "调研组合预设" });
  for (const [id, p] of Object.entries(O.PRESETS))
    D.register(id, {
      name: p.name,
      en: id,
      family: "数据动效",
      cat: "research-presets",
      desc: "可编辑阶段顺序、数据、镜头和时长",
      custom: true,
      library: true,
      keywords: ["调研", "预设", p.name],
      accepts: (row) => row.motion?.templateId === p.templateId,
      sample: { motion: O.preset(id) },
      create,
    });
  const catalog = D.catalog;
  D.catalog = () =>
    catalog().map((item) => ({
      ...item,
      categoryName:
        D.CATEGORIES.find((c) => c.id === item.category)?.name ||
        item.categoryName ||
        "数据动效",
    }));
  const adopt = D.adopt;
  D.adopt = (row, id) => {
    const next = adopt(row, id);
    if (
      (O.IDS.includes(id) || O.PRESETS[id]) &&
      next.motion?.templateId === (O.PRESETS[id]?.templateId || id)
    ) {
      next.motion = JSON.parse(JSON.stringify(next.motion));
      if (O.PRESETS[id]) {
        const preset = O.preset(id);
        next.motion.sequence = preset.sequence;
        next.motion.timeline = preset.timeline;
      }
      delete next.sampleData;
      delete next.pending;
      next.note = next.motion.demo ? "演示数据，非真实研究结论" : "";
    }
    return next;
  };
  const libraryPrompt = D.libraryPrompt;
  D.libraryPrompt = () =>
    libraryPrompt() +
    `\nOpus 调研模板：以上 research 分类模板统一写 data:{"motion":完整配置}。配置由 DMOpus.defaults(id) 创建并经 DMOpus.validate 校验；包含 schemaVersion:1、templateId、templateVersion:${O.VERSION}、data、fieldMappings、metadata、style、options、timeline(秒)、output。数据、标签只能来自文稿；不要编造样本数、来源、配对流向。也可输出精简的 data:{"motionInput":{"data":真实原始数据,"style":{"title":"标题"},"options":{按需参数}}}，引擎会补齐样式与版本并校验，不能省略data。来源与样本量未知时不显示，不填演示数字。
数据结构：comparison-dumbbell {rows:[{label,before,after}]}；dot-tally {groups:[{label,count,marked}]}；bar-race {names:[],frames:[{label,values:[]}]}；number-counter {keyframes:[[0,起点数值],[1,终点数值]]}；card-stack-cascade {cards:[{title,body,value}]}；poll-results-bars {options:[{label,value}]}，options.questionType=single/multiple，inputMode=percent/count，count时必填totalVotes；sankey-flow {links:[{from,to,value}]}仅配对记录；funnel-conversion {stages:[{label,value}]}，rateMode=previous/first；bubble-scatter-grow {records:[{name,importance,satisfaction,people}]}，自定义字段则用fieldMappings；heatmap-calendar {records:[{date:"YYYY-MM-DD",value}]}，options.startDate/endDate/maxValue；testimonial-card-carousel {testimonials:[{quote,name,role}]}；timeline-ruler {events:[{date,title,body}]}；stacked-area-flow {xLabels:[],series:[{name,values:[]}]}。
进阶组件须完整记录与对象ID；cohort-regroup 不得从汇总比例生成关联个体。配置说明见 docs/OPUS.md。`;
  D.Opus = {
    configOf,
    numericState,
    progress,
    monotone,
    prepareAssets,
    prepareFrame,
    NAMES,
    phaseAt,
    cohortState,
    sampleState,
  };
})(window);
