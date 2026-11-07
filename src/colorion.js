// Colorion 的纯 CSS 动效：文字特效、加载动画、按钮、提示框、开关。
// 动效本身是作者写的 CSS（见 vendor/colorion），放映机（css_film.js）把它画到画布上。这里只做三件事：
// 把这一镜的字填进去、配上工具的颜色、决定放多久停在哪一帧。
(function (root) {
  'use strict';
  const D = root.DM;
  const SRC = root.DMColorion;
  if (!SRC || !D.CssFilm) return;
  const ZH = SRC.zh;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  const PALETTE = {
    black: {bg: '#0A0A0B', ink: '#F4F1EA', a: '#FF6A1F', b: '#4CC9F0', on: '#0A0A0B'},
    paper: {bg: '#F0EFEB', ink: '#141416', a: '#E8501A', b: '#1B7FA8', on: '#F0EFEB'},
  };
  const CO_COLORS = [{key: 'bg', name: '底色'}, {key: 'a', name: '主色'}, {key: 'b', name: '辅色'}, {key: 'ink', name: '文字'}];
  const paletteOf = (row) => Object.assign({}, PALETTE[row.theme === 'paper' ? 'paper' : 'black'], D.pickColors(row, CO_COLORS.map((r) => r.key)));

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

  // 一句口播太长，放不进一行特效字：取能放下的那一小句
  const shortLine = (s, max) => {
    const clean = String(s || '').replace(/[“”"「」《》]/g, '').trim();
    const first = clean.split(/[。！？!?\n]/)[0].trim();
    if ([...first].length <= max) return /^[？?]/.test(clean.slice(first.length).trim()) ? `${first}？` : first;
    const parts = first.split(/[，,、；;：:]/).map((x) => x.trim()).filter(Boolean);
    const fit = [...parts].reverse().find((p) => [...p].length <= max && [...p].length >= 2);
    return fit || [...first].slice(0, max).join('');
  };
  const wordsOf = (row, fallback, max = 14) => {
    if (row.lines && row.lines.length) return shortLine(row.lines.join(' '), max + 4);
    return shortLine(row.line, max) || fallback;
  };

  // ---------- 放映机缓存：同一段字同一个放映机。一个放映机是一小棵 DOM，留得太多费内存 ----------
  const films = new Map();
  const filmOf = (key, make) => {
    let film = films.get(key);
    if (film) {
      films.delete(key);
      films.set(key, film);
      return film;
    }
    film = make();
    films.set(key, film);
    if (films.size > 24) {
      const [old, first] = films.entries().next().value;
      first.dispose();
      films.delete(old);
    }
    return film;
  };

  // 停在哪一帧：一个循环里字最清楚的那一刻。打字机这种循环到头是空的，不能停在头上
  const heroCache = new Map();
  const heroOf = (key, film, cycle) => {
    if (heroCache.has(key)) return heroCache.get(key);
    const w = 200;
    const h = 112;
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const g = cv.getContext('2d', {willReadFrequently: true});
    const box = film.size();
    const k = Math.min(w / Math.max(1, box.w), h / Math.max(1, box.h)) * 0.8;
    let best = 0;
    let lowest = Infinity;
    let bestAt = cycle * 0.5;
    const steps = 16;
    for (let i = 1; i <= steps; i++) {
      const t = (i / steps) * cycle;
      film.seek(t);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, w, h);
      g.setTransform(k, 0, 0, k, (w - box.w * k) / 2, (h - box.h * k) / 2);
      film.paint(g);
      const data = g.getImageData(0, 0, w, h).data;
      let lit = 0;
      for (let p = 3; p < data.length; p += 4) lit += data[p];
      lowest = Math.min(lowest, lit);
      // 差不多亮的时候，取靠后的那一刻，已经进场完了
      if (lit >= best * 0.985) {
        best = Math.max(lit, best);
        bestAt = t;
      }
    }
    const hero = {at: bestAt, vanishes: lowest < best * 0.35};
    heroCache.set(key, hero);
    return hero;
  };

  const createFilmScene = (row, S, spec) => {
    const pal = paletteOf(row);
    const key = `${spec.id}|${pal.ink}|${spec.html}|${spec.extraCss || ''}`;
    const make = () => new D.CssFilm({
      css: `${spec.css}${spec.extraCss || ''}`,
      html: spec.html,
      font: D.FONT_CN,
      stateAt: spec.stateAt === undefined ? null : spec.stateAt,
      vars: Object.assign({'--ink': pal.ink, '--ink-2': pal.a, '--ink-3': pal.b, color: pal.ink}, spec.vars ? spec.vars(pal) : {}),
    });
    const film = filmOf(key, make);
    // 打字机这种一开始宽度是 0，几个时刻都量一下
    const box = {w: 1, h: 1};
    for (let i = 0; i <= 6; i++) {
      film.seek(spec.stateAt !== undefined ? spec.stateAt + i * 0.3 : ((film.cycle || 2.4) * i) / 6);
      const s0 = film.size();
      box.w = Math.max(box.w, s0.w);
      box.h = Math.max(box.h, s0.h);
    }
    const k = Math.min(spec.maxW / Math.max(1, box.w), spec.maxH / Math.max(1, box.h), spec.maxK || 9);
    const W = Math.max(2, Math.round(1920 * S));
    const H = Math.max(2, Math.round(1080 * S));
    const off = document.createElement('canvas');
    off.width = W;
    off.height = H;
    const g = off.getContext('2d');
    const pk = k * S;
    const top = (spec.cy === undefined ? 540 : spec.cy) * S - (box.h * pk) / 2;
    const left = (W - box.w * pk) / 2;
    const sp = D.speechOf(row);
    const cycle = film.cycle || 2.4;
    const once = spec.stateAt !== undefined;
    let end;
    if (once) {
      end = spec.stateAt + Math.max(1.4, cycle);
    } else {
      const found = heroOf(key, film, cycle);
      const hero = spec.heroAt !== undefined ? spec.heroAt * cycle : found.at;
      const need = Math.max(sp.dur + 0.3, cycle * 0.9);
      // 字会整个消失的效果（揭幕、打字）循环起来中间会黑屏：放一遍，停在字最清楚的时候
      end = spec.holdHero && found.vanishes ? hero : Math.ceil((need - hero) / cycle) * cycle + hero;
    }
    const duration = Math.max(end, once ? sp.dur + 0.4 : 0, spec.holdHero ? sp.dur + 0.3 : 0) + (row.hold != null ? +row.hold : once ? 0.8 : 0);
    const caption = spec.caption ? D.wrapText(spec.caption, 1500, 84, 40, 2) : null;
    const draw = (c) => {
      c.bg();
      c.fillStyle = pal.bg;
      c.fillRect(0, 0, 1920, 1080);
      const t = c.el('film', spec.name);
      const u = Math.min(Math.max(t, 0), end);
      const live = filmOf(key, make);
      live.seek(u);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, W, H);
      g.setTransform(pk, 0, 0, pk, left, top);
      live.paint(g);
      const tint = c.tint;
      if (tint) {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalCompositeOperation = 'source-atop';
        g.fillStyle = `rgb(${tint[0]},${tint[1]},${tint[2]})`;
        g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = 'source-over';
      }
      c.pathSig = Math.floor(u * 30);
      c.drawImage(off, 0, 0, 1920, 1080);
      c.pathSig = 0;
      if (caption) {
        const tt = c.el('caption', spec.caption, D.TEXT);
        D.revealLines(c, caption, 960, spec.captionY || 740, pal.ink, tt, 0.15, 'center');
      }
    };
    return {duration, draw};
  };

  const register = (id, def) => {
    D.register(id, Object.assign({custom: true, library: true, colors: {}, accepts: () => true, colorRoles: CO_COLORS, colorDefaults: (row) => PALETTE[row.theme === 'paper' ? 'paper' : 'black']}, def));
  };

  // ---------- 文字特效 ----------
  // 这几个是盖住字的效果，按亮度挑帧会挑到盖得最满的那一刻。要停在字露出来的时候（循环的百分比）
  const HERO_AT = {blackout: 0.92, chalk: 0.8};
  const decoderCss = (css, text) => {
    const letters = [...text];
    const noise = '▓▒░#%&*@';
    const scramble = (kept) => letters.map((ch, i) => (i < kept ? ch : noise[(i * 3 + kept) % noise.length])).join('');
    const steps = [0, 8, 16, 24, 32];
    let frames = steps.map((p, i) => `${p}% { content: "${scramble(Math.round((i / steps.length) * letters.length))}"; color: var(--ink-3); }`).join('\n');
    frames += `\n40%, 82% { content: "${esc(text)}"; color: var(--ink); }`;
    frames += `\n88% { content: "${scramble(Math.round(letters.length * 0.5))}"; color: var(--ink-3); }`;
    frames += `\n94% { content: "${scramble(1)}"; }`;
    return css.replace(/content:\s*"[^"]*"/, `content: "${scramble(0)}"`).replace(/@keyframes fx-decoder\s*\{[\s\S]*?\n\}/, `@keyframes fx-decoder {\n${frames}\n}`);
  };

  const textSpec = (item, row, word) => {
    const text = wordsOf(row, word);
    const letters = [...text];
    let {css} = item;
    let html;
    const kind = item.type;
    if (kind === 'typewriter') {
      // 一个汉字 1em，西文大约半个。按字数算会把光标留在很远的地方
      const em = letters.reduce((sum, ch) => sum + (ch.charCodeAt(0) < 0x2E80 ? 0.56 : 1), 0).toFixed(2);
      css = css.replace(/10ch/g, `${em}em`).replace(/\.55ch/g, '.28em').replace(/steps\(10\b/g, `steps(${letters.length}`);
    }
    if (kind === 'decoder') {
      css = decoderCss(css, text);
      html = '<div class="fx-decoder"></div>';
    }
    if (kind === 'rotator') {
      // 同一个位置换词：有几句用几句，不够就重复
      const words = (row.lines && row.lines.length > 1 ? row.lines : text.split(/[\s，、]+/).filter(Boolean)).slice(0, 4);
      const list = words.length ? words : [text];
      let i = 0;
      css = css.replace(/content:\s*"[^"]*"/g, () => `content: "${esc(list[i++ % list.length])}"`);
      const longest = [...list].sort((a, b) => [...b].length - [...a].length)[0];
      html = `<div class="fx-rotator">${esc(longest)}</div>`;
    }
    if (kind === 'contour') {
      const w = letters.length * 38 + 20;
      css = css.replace(/width:\s*240px/, `width: ${w}px`);
      html = `<svg class="fx-contour" viewBox="0 0 ${w} 56" role="img"><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle">${esc(text)}</text></svg>`;
    } else if (kind === 'annotate') {
      html = `<div class="fx-annotate">${esc(text)}<svg viewBox="0 0 200 100" preserveAspectRatio="none"><path class="fx-annotate-ring" pathLength="100" d="${SRC.annotate.ring}"/><path class="fx-annotate-line" pathLength="100" d="${SRC.annotate.line}"/></svg></div>`;
    } else if (kind === 'textpath') {
      const slots = letters.length > 1 ? 60 / (letters.length - 1) : 0;
      html = `<div class="fx-textpath">${letters.map((ch, i) => `<b style="--i:${i};--d:${(i * slots).toFixed(2)}%">${esc(ch)}</b>`).join('')}</div>`;
    } else if (item.letters) {
      html = `<div class="fx-${kind}">${letters.map((ch, i) => `<b style="--i:${i}">${ch === ' ' ? '&nbsp;' : esc(ch)}</b>`).join('')}</div>`;
    } else if (item.dataText) {
      html = `<div class="fx-${kind}" data-text="${esc(text)}">${esc(text)}</div>`;
    } else if (!html) {
      html = `<div class="fx-${kind}">${esc(text)}</div>`;
    }
    return {css, html, text};
  };

  SRC.text.forEach((item) => {
    const [name, desc, word, keywords] = ZH.text[String(+item.no).padStart(2, '0')] || [item.name, item.blurb, item.word, []];
    const id = `cot${item.no}`;
    register(id, {
      name, family: '文字特效', cat: 'texfx', desc, en: item.name, keywords, takesText: true,
      source: 'CSS Text Effects（Colorion，MIT）',
      sample: {lines: [word]},
      create(row, S) {
        const spec = textSpec(item, row, word);
        return createFilmScene(row, S, {id, name, css: spec.css, html: spec.html, maxW: 1560, maxH: 560, maxK: 8, heroAt: HERO_AT[item.type], holdHero: true});
      },
    });
  });

  // ---------- 加载动画 ----------
  SRC.loader.forEach((item) => {
    const [name, desc] = ZH.loader[item.no] || [item.name, item.blurb];
    const id = `col${item.no}`;
    // 字幕词太多会把别的动效挤掉：只有前几个常见样子认「加载」这些词
    const keywords = item.no === '01' ? ['加载', '转圈', '等待'] : item.no === '43' ? ['正在输入', '对方正在'] : item.no === '47' ? ['水位'] : item.no === '79' ? ['充电', '电量'] : item.no === '64' ? ['加载到'] : item.no === '22' ? ['雷达'] : [];
    register(id, {
      name, family: '加载', cat: 'loader', desc, en: item.name, keywords, takesText: true,
      source: 'CSS Loader Library（Colorion，MIT）',
      sample: {lines: ['正在加载']},
      create(row, S) {
        let html;
        if (item.svg) html = item.svg;
        else if (item.text) html = `<div class="ld-${item.type}">${esc(wordsOf(row, item.text, 10))}</div>`;
        else html = `<div class="ld-${item.type}">${'<i></i>'.repeat(item.count)}</div>`;
        let {css} = item;
        // 原文写 inherits: false，伪元素读不到动画里的数，一直是 0
        if (item.type === 'counter') css = css.replace('inherits: false', 'inherits: true');
        if (item.type === 'glitch') css = css.replace(/content:\s*"[^"]*"/g, `content: "${esc(wordsOf(row, item.text, 10))}"`);
        if (item.type === 'marquee') {
          const t = wordsOf(row, '正在加载', 10);
          css = css.replace(/content:\s*"[^"]*"/g, `content: "${esc(t)} · ${esc(t)} · "`);
        }
        const caption = item.text ? '' : wordsOf(row, '', 28);
        return createFilmScene(row, S, {
          id, name, css, html,
          maxW: 900, maxH: 340, maxK: 6.5,
          cy: caption ? 460 : 540,
          caption,
          captionY: 730,
        });
      },
    });
  });

  // ---------- 按钮：先静止，到点按下去 ----------
  const uiVars = (pal) => ({'--primary': pal.a, '--secondary': pal.ink, '--surface': pal.bg});
  const uiOverride = (cls, pal) => `.${cls}{--primary:${pal.a};--secondary:${pal.ink};--surface:${pal.bg};--bink:${pal.ink};--bsurf:${pal.bg}}`;
  SRC.button.forEach((item) => {
    const name = ZH.button[item.no] || item.name;
    const id = `cob${item.no}`;
    register(id, {
      name: `按钮·${name}`, family: '按钮', cat: 'button', desc: `鼠标放上去：${name}`, en: item.name, keywords: item.no === '1' ? ['按钮'] : item.no === '30' ? ['点一下'] : [], takesText: true,
      source: 'CSS Button Library（Colorion，MIT）',
      sample: {lines: ['立即开始']},
      create(row, S) {
        const pal = paletteOf(row);
        const text = wordsOf(row, '立即开始', 10);
        return createFilmScene(row, S, {
          id, name,
          css: SRC.buttonBase + item.css,
          extraCss: uiOverride('btn', pal),
          html: `<button class="btn fx-${item.no} is-state" data-state type="button"><span class="btn-label">${esc(text)}</span></button>`,
          maxW: 1200, maxH: 340, maxK: 10,
          stateAt: 0.7,
        });
      },
    });
  });

  // ---------- 提示框 ----------
  const tipName = (raw) => {
    const [dir, reveal] = raw.split(' · ');
    const d = ZH.tip.dirs[dir] || dir;
    return reveal ? `${d}·${ZH.tip.reveal[reveal] || reveal}` : d;
  };
  SRC.tip.forEach((item) => {
    const id = `cop${item.no}`;
    const name = `提示框·${tipName(item.name)}`;
    register(id, {
      name, family: '开关提示', cat: 'toggle', desc: '指到按钮上，气泡冒出来', en: `Tooltip ${item.name}`, keywords: item.no === '1' ? ['气泡提示', '提示框'] : [], takesText: true,
      source: 'CSS Tooltip Library（Colorion，MIT）',
      sample: {lines: ['这里要注意']},
      create(row, S) {
        const pal = paletteOf(row);
        const text = wordsOf(row, '这里要注意', 18);
        return createFilmScene(row, S, {
          id, name,
          css: SRC.tipBase + item.css,
          extraCss: `.tip{--tip-bg:${pal.ink};--tip-fg:${pal.bg}}`,
          html: `<button class="tip tp-${item.no}" data-state type="button" data-tip="${esc(text)}">查看</button>`,
          maxW: 1300, maxH: 420, maxK: 8,
          stateAt: 0.6,
        });
      },
    });
  });

  // ---------- 开关 ----------
  SRC.toggle.forEach((item) => {
    const id = `cog${item.no}`;
    const family = ZH.toggle[item.family] || item.family;
    const name = `${family}·${ZH.toggle.names[item.name] || item.name}`;
    const keyword = {switch: ['打开开关'], check: ['打勾', '勾选'], radio: ['单选']}[item.family];
    register(id, {
      name, family: '开关提示', cat: 'toggle', desc: `${family}从关到开`, en: `Toggle ${item.name}`, keywords: item.cls.endsWith('-1') ? keyword : [], takesText: true,
      source: 'CSS Toggle Library（Colorion，MIT）',
      sample: {lines: ['同意']},
      create(row, S) {
        const pal = paletteOf(row);
        const text = wordsOf(row, '同意', 14);
        const inner = item.family === 'switch'
          ? '<span class="track"><span class="thumb"></span></span>'
          : item.family === 'check'
            ? `<span class="box"></span><span class="lbl">${esc(text)}</span>`
            : `<span class="dot"></span><span class="lbl">${esc(text)}</span>`;
        return createFilmScene(row, S, {
          id, name,
          css: SRC.toggleBase[item.family] + item.css,
          // 描边款的轨道被基础样式填实了，圆钮同色就看不见
          extraCss: uiOverride(item.family, pal) + (item.cls === 'sw-4' ? '.sw-4 input:checked + .track{background:transparent}' : ''),
          html: `<label class="${item.family} ${item.cls}"><input type="checkbox">${inner}</label>`,
          maxW: 1100, maxH: 320, maxK: 10,
          stateAt: 0.6,
          cy: item.family === 'switch' ? 460 : 540,
          caption: item.family === 'switch' ? text : '',
          captionY: 640,
        });
      },
    });
  });
})(window);
