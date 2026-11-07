// 屏幕系：输入框特写、对话气泡、跳过按钮。
(function (root) {
  'use strict';
  const D = root.DM;
  const TEXT = D.TEXT;
  const {clamp, lerp, progress, smooth, outCubic, outQuint, wobble, hex, mix, css, textEm} = D;
  const clear = (c, S, color) => D.clearFrame(c, S, color);

  // ---------- 输入框特写：逐字打出，点发送，上一句升上去 ----------
  D.register('input', {
    name: '输入框特写', family: '屏幕', custom: true, desc: '屏幕动效：对话框里逐字打问题，点发送，上一句升上去。', source: 'shotcraft typewriter-moves + interaction', colors: {},
    accepts: (r) => r.lines && r.lines.length,
    create(row, S) {
      const lines = row.lines;
      const sp = D.speechOf(row);
      const spans = D.spansOf(row, lines, sp);
      const dur = spans[spans.length - 1].end + (row.hold != null ? +row.hold : 1.8);
      const BG = '#0D0E10';
      const PANEL = '#1B1C20';
      const LINE = '#34353B';
      const INK = '#F4F1EA';
      const MUTE = '#7E7D78';
      const ACC = '#FF5C1E';
      const BOX_X = 150;
      const BOX_W = 1620;
      const draw = (c, t) => {
        clear(c, S, BG);
        const push = 1 + 0.03 * (t / dur);
        c.translate(960, 760);
        c.scale(push, push);
        c.translate(-960, -760);
        let cur = 0;
        spans.forEach((s, i) => {
          if (t >= s.at - 0.15) cur = i;
        });
        const text = lines[cur];
        const s = spans[cur];
        const wrap = D.wrapText(text, BOX_W - 230, 62, 34, 4);
        const total = Array.from(wrap.lines.join('')).length;
        const shown = Math.floor(total * clamp((t - s.at) / Math.max(0.2, s.end - s.at)));
        const sent = t > s.end + 0.12 && (spans[cur + 1] ? t < spans[cur + 1].at : true);
        const boxH = Math.max(150, wrap.lines.length * wrap.size * 1.3 + 90);
        const boxY = 900 - boxH;
        // 已发送的句子
        let y = boxY - 40;
        const shownOld = [];
        for (let i = cur - (sent ? 0 : 1); i >= 0; i--) shownOld.push(i);
        shownOld.forEach((i, idx) => {
          t = c.el(`old:${i}`, lines[i], TEXT);
          const w = D.wrapText(lines[i], 1180, 46, 28, 4);
          const h = w.lines.length * w.size * 1.3 + 44;
          const age = t - (spans[i].end + 0.12);
          const rise = outQuint(age / 0.4);
          const bw = w.w + 70;
          const bx = BOX_X + BOX_W - bw;
          const by = y - h + (1 - rise) * 80;
          c.globalAlpha = clamp(rise) * (1 - idx * 0.28);
          c.fillStyle = '#2B2C31';
          c.beginPath();
          c.roundRect(bx, by, bw, h, 26);
          c.fill();
          c.fillStyle = INK;
          c.font = `${w.size}px ${D.FONT_CN}`;
          c.textAlign = 'left';
          c.textBaseline = 'alphabetic';
          w.lines.forEach((l, li) => c.fillText(l, bx + 35, by + 22 + w.size * 1.02 + li * w.size * 1.3));
          c.globalAlpha = 1;
          y -= h + 22;
        });
        // 输入框
        t = c.el('box', '输入框');
        c.fillStyle = PANEL;
        c.strokeStyle = LINE;
        c.lineWidth = 2;
        c.beginPath();
        c.roundRect(BOX_X, boxY, BOX_W, boxH, 34);
        c.fill();
        c.stroke();
        c.font = `${wrap.size}px ${D.FONT_CN}`;
        c.textAlign = 'left';
        c.textBaseline = 'alphabetic';
        t = c.el('placeholder', '问点什么…', TEXT);
        if (sent || shown === 0) {
          c.fillStyle = MUTE;
          c.fillText('问点什么…', BOX_X + 56, boxY + 48 + wrap.size * 1.02);
        }
        t = c.el('typed', '打出来的字', TEXT);
        if (!sent) {
          let left = Math.floor(total * clamp((t - s.at) / Math.max(0.2, s.end - s.at)));
          wrap.lines.forEach((l, li) => {
            const arr = Array.from(l);
            const part = arr.slice(0, Math.max(0, left)).join('');
            const ly = boxY + 48 + wrap.size * 1.02 + li * wrap.size * 1.3;
            c.fillStyle = INK;
            c.fillText(part, BOX_X + 56, ly);
            if (left >= 0 && left <= arr.length && shown < total && Math.floor(t * 3) % 2 === 0) {
              c.push('caret', '光标');
              c.fillStyle = ACC;
              c.fillRect(BOX_X + 56 + textEm(part) * wrap.size + 4, ly - wrap.size * 0.85, 5, wrap.size);
              c.pop();
            }
            left -= arr.length;
          });
        }
        // 发送键
        t = c.el('send', '发送键');
        const ready = shown >= total && !sent;
        const press = t > s.end ? wobble(t - s.end, 3, 8) * Math.exp(-(t - s.end) * 3) : 0;
        const bx = BOX_X + BOX_W - 96;
        const by = boxY + boxH - 74;
        c.fillStyle = ready ? ACC : '#3A3B41';
        c.beginPath();
        c.arc(bx + 30, by + 30, 38 * (1 - 0.14 * clamp(press)), 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = '#FFFFFF';
        c.lineWidth = 5;
        c.lineCap = 'round';
        c.lineJoin = 'round';
        c.beginPath();
        c.moveTo(bx + 30, by + 46);
        c.lineTo(bx + 30, by + 15);
        c.moveTo(bx + 16, by + 29);
        c.lineTo(bx + 30, by + 15);
        c.lineTo(bx + 44, by + 29);
        c.stroke();
        c.setTransform(S, 0, 0, S, 0, 0);
      };
      return {duration: dur, draw};
    },
  });

  // ---------- 对话气泡：我/AI 一问一答，AI 的话逐字流出 ----------
  D.register('chat', {
    name: '对话气泡', family: '屏幕', custom: true, desc: '人和 AI 的对话：用户气泡弹出，AI 的回答逐字流出，一路向上滚。', source: 'shotcraft typewriter + UI entrance', colors: {},
    accepts: (r) => r.dialog && r.dialog.length,
    create(row, S) {
      const dialog = row.dialog;
      const sp = D.speechOf(row);
      const spans = D.spansOf(row, dialog.map((d) => d.text), sp);
      const dur = spans[spans.length - 1].end + (row.hold != null ? +row.hold : 2);
      const BG = '#0D0E10';
      const items = dialog.map((d, i) => {
        const w = D.wrapText(d.text, 1120, 52, 32, 8);
        return Object.assign({}, d, {wrap: w, h: w.lines.length * w.size * 1.34 + 56, span: spans[i], me: d.who !== 'AI'});
      });
      // 内容少时居中，多了就贴底往上滚
      const allH = items.reduce((a, it) => a + it.h + 30, 0);
      const anchor = Math.min(980, 540 + allH / 2);
      const draw = (c, t) => {
        clear(c, S, BG);
        let cur = -1;
        items.forEach((it, i) => {
          if (t >= it.span.at - 0.1) cur = i;
        });
        // 向上滚：最新一条底边贴在 960
        let totalH = 0;
        for (let i = 0; i <= cur; i++) totalH += items[i].h + 30;
        const off = (i) => {
          let h = 0;
          for (let k = i; k <= cur; k++) h += items[k].h + 30;
          return h;
        };
        items.forEach((it, i) => {
          if (i > cur) return;
          t = c.el(`bubble:${i}`, it.text, TEXT);
          const age = t - (it.span.at - 0.1);
          const rise = outQuint(age / 0.3);
          const y = anchor - off(i) + (1 - rise) * 60;
          if (y + it.h < -20) return;
          const w = it.wrap;
          const bw = w.w + 72;
          const bx = it.me ? 1860 - 140 - bw : 200;
          c.globalAlpha = rise;
          c.fillStyle = it.me ? '#FF5C1E' : '#24252A';
          c.beginPath();
          c.roundRect(bx, y, bw, it.h, 28);
          c.fill();
          c.fillStyle = it.me ? '#FFFFFF' : '#F4F1EA';
          c.font = `${w.size}px ${D.FONT_CN}`;
          c.textAlign = 'left';
          c.textBaseline = 'alphabetic';
          const total = Array.from(w.lines.join('')).length;
          const shown = it.me ? total : Math.floor(total * clamp((t - it.span.at) / Math.max(0.2, it.span.end - it.span.at)));
          let left = shown;
          w.lines.forEach((l, li) => {
            const arr = Array.from(l);
            const part = arr.slice(0, Math.max(0, left)).join('');
            c.fillText(part, bx + 36, y + 26 + w.size * 1.02 + li * w.size * 1.34);
            left -= arr.length;
          });
          // 头像位
          t = c.el(`avatar:${i}`, it.me ? '我的头像' : 'AI 头像', TEXT);
          c.globalAlpha = outQuint((t - (it.span.at - 0.1)) / 0.3);
          c.fillStyle = it.me ? '#FF5C1E' : '#44454B';
          c.beginPath();
          c.arc(it.me ? 1860 - 86 : 116, y + 42, 42, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = '#FFFFFF';
          c.font = `34px ${D.FONT_CN}`;
          c.textAlign = 'center';
          c.fillText(it.me ? '我' : 'AI', it.me ? 1860 - 86 : 116, y + 54);
          c.globalAlpha = 1;
        });
        void totalH;
      };
      return {duration: dur, draw};
    },
  });

  // ---------- 跳过：每个词是一段过场动画，光标点「跳过」 ----------
  D.register('skip', {
    name: '跳过过场', family: '屏幕', custom: true, desc: '「像游戏过场动画一样跳过」：几个词摆在屏幕上，念到跳过时光标连点，词被一个个切掉。', source: 'shotcraft interaction + beat-cut', colors: {},
    accepts: (r) => r.lines && r.lines.length > 1,
    create(row, S) {
      const words = row.lines;
      const sp = D.speechOf(row);
      const spans = D.spansOf(row, words, sp);
      const lastEnd = spans[spans.length - 1].end;
      const sk = sp.find('跳过');
      const skipT = sk ? sk.start : lastEnd + 0.6;
      const btnF = sp.find('过场动画');
      const btnT = btnF ? btnF.start : lastEnd + 0.2;
      const STEP = 0.3;
      const dur = Math.max(sp.dur, skipT + words.length * STEP) + (row.hold != null ? +row.hold : 1.4);
      const BX = 1530;
      const BY = 900;
      const SIZE = Math.min(220, 1560 / words.reduce((a, w) => a + textEm(w) + 0.5, 0));
      const widths = words.map((w) => textEm(w) * SIZE);
      const totalW = widths.reduce((a, b) => a + b, 0) + (words.length - 1) * SIZE * 0.5;
      const xs = [];
      let rx = 960 - totalW / 2;
      widths.forEach((w) => {
        xs.push(rx);
        rx += w + SIZE * 0.5;
      });
      const draw = (c, t) => {
        clear(c, S, '#000000');
        c.textBaseline = 'alphabetic';
        words.forEach((w, i) => {
          const s = spans[i];
          t = c.el(`word:${i}`, w, TEXT);
          if (t < s.at - 0.05) return;
          const inP = outQuint(progress(t, s.at - 0.05, s.at + 0.2));
          const clickAt = skipT + i * STEP;
          const cut = clamp((t - clickAt) * 11);
          if (cut >= 1) return;
          c.globalAlpha = inP * (1 - cut);
          c.fillStyle = '#F4F1EA';
          c.font = `${SIZE}px ${D.FONT_CN}`;
          c.textAlign = 'left';
          c.fillText(w, xs[i] - cut * 90, 540 + SIZE * 0.35 + (1 - inP) * 30);
          c.globalAlpha = 1;
        });
        // 进度条：每点一下跳一大截
        t = c.el('bar', '进度条');
        const barAt = (u) => smooth(progress(u, btnT, btnT + 0.3));
        const barIn = barAt(t);
        if (barIn > 0) {
          const clicks = clamp((t - skipT) / (words.length * STEP));
          const crawl = 0.08 * clamp((t - btnT) / Math.max(0.5, skipT - btnT));
          const prog = crawl + (1 - crawl) * outCubic(clicks);
          c.globalAlpha = barIn;
          c.fillStyle = 'rgba(244,241,234,.2)';
          c.fillRect(60, 1020, 1800, 5);
          c.fillStyle = '#FF5C1E';
          c.fillRect(60, 1020, 1800 * prog, 5);
          t = c.el('btn', '跳过按钮', TEXT);
          c.globalAlpha = barAt(t);
          const hover = t > skipT - 0.25 && t < skipT + words.length * STEP + 0.1;
          c.fillStyle = hover ? '#F4F1EA' : 'rgba(244,241,234,.14)';
          c.beginPath();
          c.roundRect(BX, BY, 330, 88, 44);
          c.fill();
          c.fillStyle = hover ? '#000000' : '#F4F1EA';
          c.font = `46px ${D.FONT_CN}`;
          c.textAlign = 'center';
          c.fillText('跳过 ▸▸', BX + 165, BY + 60);
          c.globalAlpha = 1;
          // 光标与点击涟漪
          t = c.el('ripple', '点击涟漪');
          const tx = BX + 186;
          const ty = BY + 52;
          const e = outCubic(progress(t, skipT - 0.65, skipT - 0.1));
          const cx = lerp(1040, tx, e);
          const cy = lerp(760, ty, e);
          let down = 1;
          for (let i = 0; i < words.length; i++) {
            const age = t - (skipT + i * STEP);
            if (age > -0.03 && age < 0.08) down = 0.86;
            if (age > 0 && age < 0.35) {
              c.strokeStyle = `rgba(255,255,255,${(1 - age / 0.35) * 0.7})`;
              c.lineWidth = 3;
              c.beginPath();
              c.arc(tx, ty, 10 + (age / 0.35) * 46, 0, Math.PI * 2);
              c.stroke();
            }
          }
          t = c.el('cursor', '鼠标光标');
          c.save();
          c.translate(cx, cy);
          c.scale(down, down);
          c.globalAlpha = barAt(t);
          c.fillStyle = '#FFFFFF';
          c.strokeStyle = '#000000';
          c.lineWidth = 3;
          c.beginPath();
          c.moveTo(0, 0);
          c.lineTo(0, 52);
          c.lineTo(13, 40);
          c.lineTo(23, 62);
          c.lineTo(33, 57);
          c.lineTo(23, 37);
          c.lineTo(40, 36);
          c.closePath();
          c.fill();
          c.stroke();
          c.restore();
        }
      };
      return {duration: dur, draw};
    },
  });

  void lerp;
  void mix;
  void css;
  void hex;
})(window);
