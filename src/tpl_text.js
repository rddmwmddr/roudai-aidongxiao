// 文字系：诗句卡、问题卡、重音字幕、词语接力、快问连跳、词位替换。
(function (root) {
  'use strict';
  const D = root.DM;
  const TEXT = D.TEXT;
  const TEXT_GROUP = {kind: 'text', group: true};
  const {clamp, lerp, progress, smooth, outExpo, outCubic, outQuint, wobble, hash, hex, mix, css, numEm, textEm, charEm} = D;
  const clear = (c, S, color) => D.clearFrame(c, S, color);

  // 把一段话按口播估出时间。speed 变快时一起缩
  const speechOf = (row) => {
    const P = root.DMParser;
    const rate = P.RATE * (row.speed > 0 ? +row.speed : 1);
    const text = P.normalizeText(row.line || (row.lines || []).join('，'));
    const timeAt = (i) => P.syllables(text.slice(0, i)) / rate + 0.25;
    const find = (needle, from = 0) => {
      const nn = P.normalizeText(needle);
      const idx = text.indexOf(nn, from);
      return idx < 0 ? null : {start: timeAt(idx), end: timeAt(idx + nn.length), idx, stop: idx + nn.length};
    };
    return {text, timeAt, find, dur: timeAt(text.length)};
  };
  D.speechOf = speechOf;
  // 一组句子各自念到的时间；找不到就按字数均分
  const spansOf = (row, lines, sp) => {
    let cursor = 0;
    const out = [];
    let missing = false;
    lines.forEach((l) => {
      const f = sp.find(l, cursor);
      if (f) {
        out.push({at: f.start, end: f.end});
        cursor = f.stop;
      } else {
        missing = true;
        out.push(null);
      }
    });
    if (missing) {
      const P = root.DMParser;
      const rate = P.RATE * (row.speed > 0 ? +row.speed : 1);
      let t = 0.3;
      return lines.map((l) => {
        const d = Math.max(0.5, P.syllables(l) / rate);
        const r = {at: t, end: t + d};
        t += d + 0.25;
        return r;
      });
    }
    return out;
  };
  D.spansOf = spansOf;
  const theme = (row) => (row.theme === 'paper' ? {bg: '#F1EFE8', ink: '#141416', accent: '#EE3A17', mute: '#77746C'} : {bg: row.pureBlack === false ? '#0A0A0B' : '#000000', ink: '#F4F1EA', accent: '#FF5C1E', mute: '#8E8B85'});
  D.textTheme = theme;

  // 逐字把一段字摆到版面上，返回每个字的位置
  const layoutChars = (text, maxW, size, floor = 40, maxLines = 5) => {
    const wrap = D.wrapText(text, maxW, size, floor, maxLines);
    const lh = wrap.size * 1.32;
    const chars = [];
    wrap.lines.forEach((line, li) => {
      const w = textEm(line) * wrap.size;
      let x = -w / 2;
      Array.from(line).forEach((ch) => {
        chars.push({ch, x, li, w: charEm(ch) * wrap.size});
        x += charEm(ch) * wrap.size;
      });
    });
    return {chars, size: wrap.size, lh, lines: wrap.lines.length, H: lh * wrap.lines.length};
  };

  // 长段文字按标点分页。一页到这么多字就翻，单句太长的自己占一页
  const PAGE_FROM = 96;
  const PAGE_CHARS = 72;
  const pagesOf = (text) => {
    const parts = text.match(/[^，。！？；：,.!?;:]+[，。！？；：,.!?;:”」』）)]*/g) || [text];
    const pages = [];
    let cur = '';
    parts.forEach((part) => {
      if (cur && Array.from(cur + part).length > PAGE_CHARS) {
        pages.push(cur);
        cur = '';
      }
      cur += part;
    });
    if (cur) pages.push(cur);
    return pages;
  };

  // ---------- 诗句卡（竖排）：序，文字渐显渐隐 ----------
  const TITLE_FONT = () => D.FONT_TITLE;
  D.register('titleV', {
    name: '竖排诗句', family: '文字', custom: true, desc: '黑屏，诗句竖排逐字渐显，再整体渐隐。字体可换瘦金体。', source: 'shotcraft paper-title-card', colors: {},
    create(row, S) {
      const lines = row.lines && row.lines.length ? row.lines : ['不识庐山真面目', '只缘身在此山中'];
      const head = row.head || '';
      const foot = row.foot || '';
      const dur = Math.max(6.5, row.duration || 7.5);
      const SIZE = 92;
      const draw = (c, t) => {
        clear(c, S, '#000000');
        const out = 1 - smooth(progress(t, dur - 1.8, dur - 0.5));
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillStyle = '#EDE9DF';
        const total = lines.length + (head ? 1 : 0) + (foot ? 1 : 0);
        const gap = 150;
        const startX = 960 + ((total - 1) * gap) / 2;
        let col = 0;
        let order = 0;
        const column = (id, text, size, x, atBase, top) => {
          c.el(id, text, TEXT_GROUP);
          Array.from(text).forEach((ch, i) => {
            const u = c.push(`${id}:${i}`, ch, TEXT);
            const a = smooth(progress(u, atBase + i * 0.11, atBase + i * 0.11 + 0.9));
            if (a > 0) {
              c.globalAlpha = a * out;
              c.font = `${size}px ${TITLE_FONT()}`;
              c.fillText(ch, x, top + i * size * 1.22 + (1 - a) * 8);
            }
            c.pop();
          });
          return atBase + Array.from(text).length * 0.11;
        };
        let at = 0.5;
        const maxLen = Math.max(...lines.map((l) => Array.from(l).length));
        const blockH = maxLen * SIZE * 1.22;
        const top = 540 - blockH / 2 + SIZE * 0.5;
        if (head) {
          at = column('head', head, 56, startX - col * gap, at, top);
          col++;
          at += 0.25;
        }
        lines.forEach((l, li) => {
          at = column(`line:${li}`, l, SIZE, startX - col * gap, at, top) + 0.18;
          col++;
        });
        if (foot) column('foot', foot, 40, startX - col * gap, at + 0.2, top + (blockH - Array.from(foot).length * 40 * 1.22) * 0.98);
        void order;
        c.globalAlpha = 1;
        c.textBaseline = 'alphabetic';
      };
      return {duration: dur, draw};
    },
  });

  // ---------- 诗句卡（横排）：章节卡 ----------
  D.register('titleH', {
    name: '章节诗句', family: '文字', custom: true, desc: '黑屏，章节号 + 诗句横排渐显。', source: 'shotcraft paper-title-card', colors: {},
    create(row, S) {
      const lines = row.lines || [];
      const dur = Math.max(5.5, row.duration || 6.5);
      const draw = (c, t) => {
        clear(c, S, '#000000');
        const out = 1 - smooth(progress(t, dur - 1.4, dur - 0.3));
        c.textBaseline = 'alphabetic';
        const SIZE = 84;
        const n = lines.length;
        const y0 = 540 - ((n - 1) * SIZE * 1.5) / 2 + 30;
        if (row.head) {
          t = c.el('head', row.head, TEXT);
          const a = smooth(progress(t, 0.3, 1.2));
          c.globalAlpha = a * out;
          c.fillStyle = '#EDE9DF';
          c.font = `52px ${TITLE_FONT()}`;
          c.textAlign = 'center';
          c.fillText(row.head, 960, y0 - 170);
        }
        lines.forEach((l, i) => {
          t = c.el(`line:${i}`, l, TEXT);
          const a = smooth(progress(t, 0.9 + i * 0.9, 2.1 + i * 0.9));
          const w = D.fitSize(l, 1640, SIZE, 44);
          c.globalAlpha = a * out;
          c.fillStyle = '#EDE9DF';
          c.font = `${w}px ${TITLE_FONT()}`;
          c.textAlign = 'center';
          c.fillText(l, 960, y0 + i * SIZE * 1.5 + (1 - a) * 12);
        });
        if (row.foot) {
          t = c.el('foot', row.foot, TEXT);
          const a = smooth(progress(t, 1.2 + n * 0.9, 2.2 + n * 0.9));
          c.globalAlpha = a * out;
          c.fillStyle = '#A9A59B';
          c.font = `38px ${TITLE_FONT()}`;
          c.textAlign = 'center';
          c.fillText(row.foot, 960, y0 + n * SIZE * 1.5 + 30);
        }
        c.globalAlpha = 1;
      };
      return {duration: dur, draw};
    },
  });

  // ---------- 问题卡：逐字打出，光标闪烁；多句时旧句留在上方变暗 ----------
  D.register('question', {
    name: '问题卡', family: '文字', custom: true, desc: '黑屏问题，念到哪打到哪，光标跟着走。多个问题时旧问题留在上方变暗。', source: 'shotcraft typewriter-moves', colors: {},
    create(row, S) {
      const lines = row.lines && row.lines.length ? row.lines : [row.line || ''];
      const sp = speechOf(row);
      const spans = spansOf(row, lines, sp);
      const T = theme(row);
      const dur = Math.max(spans[spans.length - 1].end + (row.hold != null ? +row.hold : 1.6), 2.4);
      const n = lines.length;
      const base = n === 1 ? 104 : n <= 3 ? 84 : 66;
      const wraps = lines.map((l) => D.wrapText(l, 1640, base, 40, 3));
      const heights = wraps.map((w) => w.lines.length * w.size * 1.3 + (n > 1 ? 26 : 0));
      const total = heights.reduce((a, b) => a + b, 0);
      const draw = (c, t) => {
        clear(c, S, T.bg);
        let cur = 0;
        spans.forEach((s, i) => {
          if (t >= s.at) cur = i;
        });
        let y = 540 - total / 2;
        wraps.forEach((w, i) => {
          t = c.el(`q:${i}`, lines[i], TEXT);
          const s = spans[i];
          const a = t < s.at ? 0 : 1;
          const old = i < cur ? 0.32 : 1;
          const align = n === 1 ? 'center' : 'left';
          const x = n === 1 ? 960 : 140;
          const totalChars = Array.from(w.lines.join('')).length;
          const shown = Math.floor(totalChars * clamp((t - s.at) / Math.max(0.2, s.end - s.at)));
          let left = shown;
          if (a) {
            c.globalAlpha = old;
            w.lines.forEach((l, li) => {
              const arr = Array.from(l);
              const part = arr.slice(0, Math.max(0, left)).join('');
              const full = textEm(l) * w.size;
              const x0 = align === 'center' ? x - full / 2 : x;
              c.font = `${w.size}px ${D.FONT_CN}`;
              c.fillStyle = T.ink;
              c.textAlign = 'left';
              c.textBaseline = 'alphabetic';
              const ly = y + w.size * 1.05 + li * w.size * 1.3;
              c.fillText(part, x0, ly);
              const onThis = left <= arr.length && left >= 0 && (shown < totalChars ? true : li === w.lines.length - 1);
              if (i === cur && onThis && (shown < totalChars || Math.floor(t * 2.2) % 2 === 0)) {
                c.push('caret', '光标');
                c.fillStyle = T.accent;
                c.fillRect(x0 + textEm(part) * w.size + 8, ly - w.size * 0.85, Math.max(4, w.size * 0.06), w.size * 1.02);
                c.pop();
              }
              left -= arr.length;
            });
            c.globalAlpha = 1;
          }
          y += heights[i];
        });
      };
      return {duration: dur, draw};
    },
  });

  // ---------- 重音字幕：念到哪出到哪，关键词念到时上色并划线 ----------
  D.register('statement', {
    name: '重音字幕', family: '文字', custom: true, desc: '念到哪字出到哪，关键词念到时上色、划线。定义、金句、结论用。', source: 'shotcraft marker-underline + gradient-word-sweep', colors: {},
    create(row, S) {
      const text = (row.lines && row.lines.length ? row.lines.join('') : row.line) || '';
      const sp = speechOf(Object.assign({}, row, {line: row.line || text}));
      const T = theme(row);
      const start = sp.find(text);
      const at0 = start ? start.start : 0.3;
      const at1 = start ? start.end : 0.3 + root.DMParser.syllables(text) / root.DMParser.RATE;
      const dur = Math.max(at1 + (row.hold != null ? +row.hold : 1.8), 2.6);
      const count = Array.from(text).length;
      const short = count <= 8;
      const size = short ? 190 : count <= 24 ? 110 : 76;
      // 长段口播分页：一页放不下就念到哪翻到哪，一个字都不丢，字也不用缩到看不清
      const pieces = count > PAGE_FROM ? pagesOf(text) : [text];
      const pages = [];
      let from = 0;
      pieces.forEach((piece) => {
        const lay = layoutChars(piece, 1640, size, 44, 6);
        pages.push({lay, from});
        from += lay.chars.length;
      });
      const charsN = from;
      const timeOf = (i) => at0 + ((at1 - at0) * i) / Math.max(1, charsN);
      const pageOf = (i) => {
        let found = pages[0];
        pages.forEach((p) => {
          if (p.from <= i) found = p;
        });
        return found;
      };
      const keys = (row.key || []).map((k) => {
        const i = Array.from(text).join('').indexOf(k);
        return i < 0 ? null : {start: Array.from(text.slice(0, i)).length, len: Array.from(k).length};
      }).filter(Boolean);
      const isKey = (i) => keys.find((k) => i >= k.start && i < k.start + k.len);
      const draw = (c, t0) => {
        let t = t0;
        clear(c, S, T.bg);
        const page = pages.reduce((now, p) => (timeOf(p.from) - 0.05 <= t0 ? p : now), pages[0]);
        const next = pages[pages.indexOf(page) + 1];
        const fade = next ? 1 - smooth(progress(t0, timeOf(next.from) - 0.25, timeOf(next.from) - 0.05)) : 1;
        const lay = page.lay;
        const y0 = 540 - lay.H / 2 - (row.head ? 40 : 0);
        if (row.head) {
          t = c.el('head', row.head, TEXT);
          D.reveal(c, row.head, 960, y0 - 92, 50, T.mute, t, 0.05, 0.02, 0.5, 'center');
        }
        c.el('text', text, TEXT_GROUP);
        c.textBaseline = 'alphabetic';
        c.textAlign = 'left';
        c.font = `${lay.size}px ${D.FONT_CN}`;
        lay.chars.forEach((ch, n) => {
          const i = page.from + n;
          const u = c.push(`ch:${i}`, ch.ch, TEXT);
          const at = timeOf(i);
          const p = outCubic(progress(u, at, at + 0.28));
          if (p > 0) {
            const y = y0 + lay.size * 1.05 + ch.li * lay.lh + (1 - p) * 18;
            const k = isKey(i);
            const heat = k ? smooth(progress(u, at, at + 0.2)) : 0;
            c.globalAlpha = p * fade;
            c.fillStyle = heat ? T.accent : T.ink;
            c.fillText(ch.ch, 960 + ch.x, y);
          }
          c.pop();
        });
        c.globalAlpha = 1;
        // 关键词下划线
        keys.forEach((k, ki) => {
          t = c.el(`ul:${ki}`, '关键词下划线');
          if (pageOf(k.start) !== page) return;
          const a = lay.chars[k.start - page.from];
          const b = lay.chars[k.start - page.from + k.len - 1];
          if (!a || !b || a.li !== b.li) return;
          const at = timeOf(k.start + k.len);
          const p = outExpo(progress(t, at, at + 0.5));
          if (p <= 0) return;
          const y = y0 + lay.size * 1.05 + a.li * lay.lh + lay.size * 0.16;
          c.fillStyle = T.accent;
          c.fillRect(960 + a.x, y, (b.x + b.w - a.x) * p, Math.max(4, lay.size * 0.05));
        });
        if (row.foot) {
          t = c.el('foot', row.foot, TEXT);
          D.reveal(c, row.foot, 960, y0 + lay.H + 40, 44, T.mute, t, at1 + 0.1, 0.02, 0.5, 'center');
        }
      };
      return {duration: dur, draw};
    },
  });

  // ---------- 词语接力：一个词顶走一个词，最后排成一行 ----------
  D.register('relay', {
    name: '词语接力', family: '文字', custom: true, desc: '一串词连着说：一个顶走一个，最后排成一行。', source: 'shotcraft vertical-word-roll + word-relay', colors: {},
    create(row, S) {
      const words = row.lines && row.lines.length ? row.lines : [];
      const sp = speechOf(row);
      const spans = spansOf(row, words, sp);
      const T = theme(row);
      const lastEnd = spans[spans.length - 1].end;
      const dur = Math.max(lastEnd + (row.hold != null ? +row.hold : 2.2), 3);
      const prefix = row.prefix || '';
      const longest = Math.max(...words.map((w) => textEm(w)));
      const HERO = Math.min(190, 1500 / (longest + textEm(prefix) + 0.4));
      const draw = (c, t) => {
        clear(c, S, T.bg);
        const fin = outCubic(progress(t, lastEnd + 0.35, lastEnd + 1.05));
        let cur = -1;
        spans.forEach((s, i) => {
          if (t >= s.at - 0.08) cur = i;
        });
        c.textBaseline = 'alphabetic';
        // 最后的一行
        const small = Math.min(92, 1720 / (words.reduce((a, w) => a + textEm(w), 0) + (words.length - 1) * 0.9));
        const totalW = words.reduce((a, w) => a + textEm(w) * small, 0) + (words.length - 1) * small * 0.9;
        let rx = 960 - totalW / 2;
        const rowX = words.map((w) => {
          const x = rx;
          rx += textEm(w) * small + small * 0.9;
          return x;
        });
        const prefixW = textEm(prefix) * HERO;
        const T0 = t;
        if (prefix && fin < 1) {
          t = c.el('prefix', prefix, TEXT);
          const heroWord = cur >= 0 ? textEm(words[cur]) * HERO : 0;
          c.globalAlpha = (1 - fin) * smooth(progress(t, 0.1, 0.4));
          c.fillStyle = T.mute;
          c.font = `${HERO}px ${D.FONT_CN}`;
          c.textAlign = 'left';
          c.fillText(prefix, 960 - (prefixW + heroWord) / 2, 540 + HERO * 0.35);
          c.globalAlpha = 1;
        }
        words.forEach((w, i) => {
          const s = spans[i];
          t = c.el(`word:${i}`, w, TEXT);
          if (T0 < s.at - 0.08 && t < s.at - 0.08) return;
          if (fin > 0) {
            // 排成一行
            const x = lerp(i === cur ? 960 - (textEm(w) * HERO) / 2 : rowX[i], rowX[i], fin);
            const size = lerp(i === cur ? HERO : small, small, fin);
            const a = i === cur ? 1 : outCubic(progress(fin, 0, 0.7));
            c.globalAlpha = a;
            c.fillStyle = T.ink;
            c.font = `${size}px ${D.FONT_CN}`;
            c.textAlign = 'left';
            c.fillText(w, x, 540 + size * 0.35 + (i === cur ? 0 : (1 - fin) * 30));
            c.globalAlpha = 1;
            if (i < words.length - 1 && fin > 0.5) {
              c.el(`sep:${i}`, '分隔点');
              c.fillStyle = css(hex(T.mute), fin);
              c.beginPath();
              c.arc(rowX[i] + textEm(w) * small + small * 0.45, 540 + small * 0.03, Math.max(3, small * 0.05), 0, Math.PI * 2);
              c.fill();
            }
            return;
          }
          const next = spans[i + 1];
          const inP = outQuint(progress(t, s.at - 0.08, s.at + 0.18));
          const outP = next ? outCubic(progress(t, next.at - 0.1, next.at + 0.1)) : 0;
          if (outP >= 1) return;
          const y = 540 + HERO * 0.35 + (1 - inP) * HERO * 0.9 - outP * HERO * 0.9;
          const headX = prefix ? 960 - (prefixW + textEm(w) * HERO) / 2 + prefixW : 960 - (textEm(w) * HERO) / 2;
          c.globalAlpha = inP * (1 - outP);
          c.fillStyle = i === words.length - 1 ? T.accent : T.ink;
          c.font = `${HERO}px ${D.FONT_CN}`;
          c.textAlign = 'left';
          c.fillText(w, headX, y);
          c.globalAlpha = 1;
        });
      };
      return {duration: dur, draw};
    },
  });

  // ---------- 快问连跳：数字不停涨，问题越来越快（shotcraft speed-ramp + rhythm-interrupt） ----------
  D.register('rapid', {
    name: '快问连跳', family: '文字', custom: true, desc: '百分比一边涨，问题一条比一条快，涨到顶后全部清空，只剩一个数。', source: 'shotcraft speed-ramp-freeze + rhythm-interrupt', colors: {},
    create(row, S) {
      const lines = row.lines || [];
      const from = row.from != null ? +row.from : 75;
      const to = row.to != null ? +row.to : 99;
      const readout = D.makeReadout(S);
      const n = lines.length;
      const P = root.DMParser;
      // 语速逐句加快：每句时长 = 音节时长 × 递减系数
      let tNow = 0.7;
      const spans = lines.map((l, i) => {
        const base = Math.max(0.42, P.syllables(l) / P.RATE);
        const k = lerp(1, 0.42, i / Math.max(1, n - 1));
        const d = base * k + 0.12 * k;
        const s = {at: tNow, end: tNow + d};
        tNow += d;
        return s;
      });
      const endAt = tNow;
      const dur = endAt + (row.hold != null ? +row.hold : 4);
      const valueAt = (t) => {
        if (t < 0.5) return from;
        if (t >= endAt) return to;
        let idx = 0;
        spans.forEach((s, i) => {
          if (t >= s.at) idx = i;
        });
        const s = spans[idx];
        const a = lerp(from, to, idx / n);
        const b = lerp(from, to, (idx + 1) / n);
        return lerp(a, b, smooth((t - s.at) / (s.end - s.at)));
      };
      const draw = (c, t) => {
        clear(c, S, '#000000');
        const T0 = t;
        t = c.el('num', `${to}%`, TEXT);
        const fin = outExpo(progress(t, endAt + 0.25, endAt + 0.95));
        const size = lerp(330, 560, fin);
        const x = lerp(60, 960 - (numEm(to) * 560) / 2, fin);
        const v = valueAt(t);
        readout(c, {x, baseline: 540 + size * 0.35, size, value: v, target: 100 > to ? Math.max(to, 10) : to, speed: Math.abs(valueAt(t + 1 / 60) - v) * 60 * 3, color: '#FFFFFF', alpha: smooth(progress(t, 0.02, 0.1))});
        if (fin >= 1) return;
        let cur = -1;
        spans.forEach((s, i) => {
          if (T0 >= s.at) cur = i;
        });
        const X0 = 660;
        for (let i = Math.max(0, cur - 5); i <= cur; i++) {
          t = c.el(`line:${i}`, lines[i], TEXT);
          const s = spans[i];
          const age = cur - i;
          const p = outQuint(progress(t, s.at, s.at + 0.12));
          const size2 = age === 0 ? Math.min(96, 1180 / Math.max(1, textEm(lines[i]))) : 44;
          const y = 540 + 34 - age * 74 - (age === 0 ? 0 : 58) + (1 - p) * 40;
          c.globalAlpha = (age === 0 ? p : Math.max(0, 0.55 - age * 0.1)) * (1 - fin);
          c.fillStyle = '#FFFFFF';
          c.font = `${size2}px ${D.FONT_CN}`;
          c.textAlign = 'left';
          c.textBaseline = 'alphabetic';
          c.fillText(lines[i], X0, y);
        }
        c.globalAlpha = 1;
      };
      return {duration: dur, draw};
    },
  });

  // ---------- 词位替换：一句话不动，只换其中一个词（shotcraft pill-slot-cycle） ----------
  D.register('swap', {
    name: '词位替换', family: '文字', custom: true, desc: '一句话不动，只换其中一个词。「早餐是豆浆」变成「早餐是拿铁」。', source: 'shotcraft pill-slot-cycle', colors: {},
    create(row, S) {
      const words = row.words || [];
      const sp = speechOf(row);
      const spans = spansOf(row, words, sp);
      const T = theme(row);
      const dur = Math.max(sp.dur + 1.8, spans[spans.length - 1].end + 2);
      const post = row.post || '';
      const pre = row.pre || '';
      const SIZE = 118;
      const readout = D.makeReadout(S);
      const draw = (c, t) => {
        clear(c, S, T.bg);
        if (row.sub) {
          t = c.el('sub', row.sub, TEXT);
          D.reveal(c, row.sub, 960, 240, 54, T.ink, t, 0.2, 0.02, 0.5, 'center');
        }
        if (row.value != null) {
          t = c.el('value', `${row.value}%`, TEXT);
          const pIn = smooth(progress(t, 0.2, 0.5));
          const land = (sp.find(`${row.value}%`) || {end: spans[0].at - 0.2}).end;
          const f = D.runCurve(progress(t, land - 1.3, land)) * row.value;
          readout(c, {x: 960 - (numEm(row.value) * 170) / 2, baseline: 240 - 24, size: 170, value: f, target: row.value, color: T.ink, alpha: pIn});
        }
        t = c.main();
        let cur = 0;
        spans.forEach((s, i) => {
          if (t >= s.at - 0.1) cur = i;
        });
        const prev = Math.max(0, cur - 1);
        const e = cur === 0 ? 1 : smooth(progress(t, spans[cur].at - 0.1, spans[cur].at + 0.32));
        const wNow = lerp(textEm(words[prev]), textEm(words[cur]), e) * SIZE + SIZE * 0.5;
        const preW = textEm(pre) * SIZE;
        const postW = textEm(post) * SIZE;
        const total = preW + wNow + postW + SIZE * 0.3;
        let x = 960 - total / 2;
        const baseline = 620;
        const inAt = (u) => smooth(progress(u, spans[0].at - 0.15, spans[0].at + 0.1));
        t = c.el('pre', pre, TEXT);
        c.globalAlpha = inAt(t);
        c.textBaseline = 'alphabetic';
        c.font = `${SIZE}px ${D.FONT_CN}`;
        c.textAlign = 'left';
        c.fillStyle = T.ink;
        c.fillText(pre, x, baseline);
        x += preW + SIZE * 0.1;
        const isLast = cur === words.length - 1;
        t = c.el('pill', '词位底色');
        c.globalAlpha = inAt(t);
        c.fillStyle = isLast ? T.accent : css(mix(hex(T.bg), hex(T.ink), 0.2));
        c.beginPath();
        c.roundRect(x, baseline - SIZE * 0.98, wNow, SIZE * 1.3, 18);
        c.fill();
        c.save();
        c.beginPath();
        c.rect(x, baseline - SIZE * 0.98, wNow, SIZE * 1.3);
        c.clip();
        t = c.el('word', '替换的词', TEXT);
        c.globalAlpha = inAt(t);
        c.fillStyle = isLast && T.bg === '#000000' ? '#000000' : T.ink;
        const tx = x + SIZE * 0.25;
        c.fillStyle = T.ink;
        if (e < 1) {
          c.fillText(words[prev], tx, baseline - e * SIZE * 1.4);
        }
        c.fillStyle = isLast ? '#FFFFFF' : T.ink;
        c.fillText(words[cur], tx, baseline + (1 - e) * SIZE * 1.4);
        c.restore();
        x += wNow + SIZE * 0.1;
        t = c.el('post', post, TEXT);
        c.globalAlpha = inAt(t);
        c.fillStyle = T.ink;
        c.fillText(post, x, baseline);
        c.globalAlpha = 1;
      };
      return {duration: dur, draw};
    },
  });

  void outExpo;
  void wobble;
  void hash;
})(window);
