// macOS App 里的渲染页。界面都是原生的，这一页只负责画面、画面内调整、分镜规则和视频编码。
(function (root) {
  'use strict';
  const D = root.DM;
  const post = (m) => {
    try {
      root.webkit.messageHandlers.dm.postMessage(m);
    } catch (e) {
      // 不在 App 里运行（测试）时没有这个通道
      if (root.__dmLog) root.__dmLog.push(m);
    }
  };
  const S = {row: null, raw: null, scene: null, t: 0, playing: false, until: null, dirty: true, loop: true};
  const cv = document.getElementById('cv');
  const stageEl = document.getElementById('stage');
  const ctx = cv.getContext('2d', {alpha: false});
  const errEl = document.getElementById('err');

  const fitCanvas = () => {
    const w = Math.min(1920, Math.round(stageEl.clientWidth * (root.devicePixelRatio || 1)));
    if (!w) return false;
    const want = Math.max(320, w - (w % 2));
    if (cv.width === want) return false;
    cv.width = want;
    cv.height = Math.round((want * 9) / 16);
    return true;
  };
  const build = () => {
    if (!S.raw) {
      S.scene = null;
      return;
    }
    fitCanvas();
    try {
      S.scene = D.createScene(S.raw, cv.width);
      errEl.hidden = true;
    } catch (e) {
      S.scene = null;
      errEl.hidden = false;
      errEl.textContent = S.row && S.row.pending ? '这一镜还缺数据' : `这一镜画不出来：${e.message}`;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cv.width, cv.height);
      post({type: 'sceneError', message: e.message});
    }
    S.dirty = true;
  };
  const report = () => {
    post({type: 'time', t: S.t, duration: S.scene ? S.scene.duration : 0, playing: S.playing, edited: !!(S.scene && S.scene.edited)});
  };
  const setPlaying = (on) => {
    if (S.playing === on) return;
    S.playing = on;
    S.dirty = true;
    report();
  };

  const editor = new root.DMEditor({
    host: stageEl,
    dock: document.getElementById('dock'),
    scene: () => S.scene,
    raw: () => S.raw,
    time: () => S.t,
    seek: (t) => {
      S.t = t;
      S.dirty = true;
      report();
    },
    playing: () => S.playing,
    pause: () => {
      S.until = null;
      setPlaying(false);
    },
    play: (from, to) => {
      S.t = from;
      S.until = to;
      setPlaying(true);
    },
    invalidate: () => {
      S.dirty = true;
    },
    commit: (layers, label) => {
      if (S.raw) {
        S.raw.layers = S.raw.layers || {};
        if (Object.keys(layers).length) S.raw.layers[S.raw.template] = layers;
        else delete S.raw.layers[S.raw.template];
      }
      report();
      post({type: 'commit', template: S.raw && S.raw.template, layers: JSON.stringify(layers), label});
    },
    onSelect: (ids) => post({type: 'selection', ids}),
    onElements: (list) => post({type: 'elements', list: JSON.stringify(list.map((e) => ({id: e.id, label: e.label, parent: e.parent, kind: e.kind, group: e.group, first: e.first, last: e.last})))}),
    list: false,
    undo: false,
  });

  let lastNow = performance.now();
  let lastReport = 0;
  const tick = (now) => {
    const dt = Math.min(0.1, (now - lastNow) / 1000);
    lastNow = now;
    if (S.scene) {
      if (S.playing) {
        S.t += dt;
        if (S.until != null && S.t >= S.until) {
          S.until = null;
          setPlaying(false);
        }
        if (S.t >= S.scene.duration) {
          if (S.loop) S.t = 0;
          else {
            S.t = S.scene.duration;
            setPlaying(false);
          }
        }
        if (now - lastReport > 100) {
          lastReport = now;
          report();
        }
      }
      if (S.playing || S.dirty) {
        S.dirty = false;
        try {
          editor.draw(ctx, Math.min(S.t, S.scene.duration));
        } catch (e) {
          errEl.hidden = false;
          errEl.textContent = `这个模板画不了这一镜：${e.message}`;
        }
      }
    }
    requestAnimationFrame(tick);
  };

  new ResizeObserver(() => {
    if (fitCanvas() && S.raw) build();
    S.dirty = true;
  }).observe(stageEl);

  addEventListener('keydown', (e) => {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.code === 'Space') {
      e.preventDefault();
      api.toggle();
    } else if ((e.code === 'ArrowDown' || e.code === 'ArrowUp') && !editor.sel.length) {
      e.preventDefault();
      post({type: 'nav', dir: e.code === 'ArrowDown' ? 1 : -1});
    }
  });

  const b64ToBuffer = (b64) => {
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8.buffer;
  };
  const bufToB64 = (u8) => new Promise((ok, no) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).slice(String(r.result).indexOf(',') + 1));
    r.onerror = () => no(r.error);
    r.readAsDataURL(new Blob([u8]));
  });

  let exporting = null;
  const api = {
    // ---------- 预览 ----------
    load(rowJSON, keepTime) {
      const row = JSON.parse(rowJSON);
      S.row = row;
      S.raw = Object.assign({}, row, {template: row.tpl});
      if (!keepTime) {
        S.t = 0;
        S.until = null;
      }
      build();
      if (S.scene) {
        // 切到一镜时停在最后一帧：所有元素都看得见，马上就能调。按空格从头播放
        if (!keepTime) S.t = Math.max(0, S.scene.duration - 0.05);
        S.t = Math.min(S.t, S.scene.duration);
        editor.bind(S.raw);
        D.ensureGlyphs(rowJSON).then((loaded) => {
          if (loaded) build();
        }).catch(() => {});
      }
      report();
      return S.scene ? S.scene.duration : 0;
    },
    clear() {
      S.row = null;
      S.raw = null;
      S.scene = null;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cv.width, cv.height);
      errEl.hidden = true;
      editor.select([]);
      report();
    },
    setLayers(tpl, json) {
      const layers = JSON.parse(json || '{}');
      if (S.raw) {
        S.raw.layers = S.raw.layers || {};
        if (Object.keys(layers).length) S.raw.layers[tpl] = layers;
        else delete S.raw.layers[tpl];
      }
      editor.setLayers(layers);
      report();
    },
    seek(t) {
      S.t = Math.max(0, t);
      S.until = null;
      setPlaying(false);
      S.dirty = true;
      report();
    },
    play() {
      if (S.scene && S.t >= S.scene.duration - 0.1) S.t = 0;
      setPlaying(true);
    },
    pause() {
      S.until = null;
      setPlaying(false);
    },
    toggle() {
      if (S.playing) api.pause();
      else api.play();
    },
    setLoop(on) {
      S.loop = !!on;
    },
    select(ids) {
      editor.select(ids);
    },
    deselect() {
      editor.select([]);
    },
    toggleHidden(id, hidden) {
      const o = editor.layers[id] || (editor.layers[id] = {});
      if (hidden) o.hidden = true;
      else delete o.hidden;
      editor._apply();
      editor._commit(hidden ? '隐藏元素' : '显示元素');
    },
    resetElements() {
      editor.layers = {};
      editor._apply();
      editor._commit('还原这一镜');
    },
    frameInfo() {
      return JSON.stringify({rec: editor.rec.length, sel: editor.sel, t: S.t, w: cv.width, h: cv.height, playing: S.playing});
    },
    // ---------- 字体 ----------
    async setFont(slot, b64) {
      await D.setFont(slot, b64 ? b64ToBuffer(b64) : null);
      if (S.raw) {
        build();
        report();
      }
      return true;
    },
    // ---------- 模板 ----------
    templates() {
      return JSON.stringify(Object.values(D.TEMPLATES).map((t) => ({id: t.id, name: t.name, family: t.family, desc: t.desc, custom: !!t.custom})));
    },
    catalog() {
      return JSON.stringify({categories: D.CATEGORIES, items: D.catalog()});
    },
    // 时间线上的胶片：这一镜从出来到结束的几个瞬间
    frames(rowJSON, count) {
      const row = JSON.parse(rowJSON);
      const canvas = document.createElement('canvas');
      canvas.width = 192;
      canvas.height = 108;
      const g = canvas.getContext('2d', {alpha: false});
      try {
        const scene = D.createScene(Object.assign({}, row, {template: row.tpl}), 192);
        const pick = D.thumbTime(row.tpl, scene);
        return Array.from({length: count}, (_, i) => {
          const t = count === 1 ? pick : scene.duration * (0.3 + (0.68 * i) / (count - 1));
          scene.draw(g, t);
          return canvas.toDataURL('image/jpeg', 0.7);
        });
      } catch (e) {
        return [];
      }
    },
    // 时间线的长度：每一镜真实的秒数，拖边缘改时长要从它开始算。建不出来的（缺数据）按念多久估
    durations(rowsJSON) {
      const out = {};
      JSON.parse(rowsJSON).forEach((row) => {
        try {
          out[row.id] = D.createScene(Object.assign({}, row, {template: row.tpl}), 64).duration;
          return;
        } catch (e) {
          // 下面按念多久估
        }
        let speech = 2;
        try {
          speech = D.speechOf(row).dur;
        } catch (e) {
          // 没有口播的镜头按 2 秒
        }
        out[row.id] = +row.dur > 0 ? +row.dur : Math.max(2, speech + (row.hold != null ? +row.hold : 1.5));
      });
      return JSON.stringify(out);
    },
    // 挑动效时的预览：用这一镜自己的字把这个动效演一遍。缺数据的放样例，并说明是样例
    preview(rowJSON, id) {
      const row = D.adopt(JSON.parse(rowJSON), id);
      const canvas = document.createElement('canvas');
      canvas.width = 480;
      canvas.height = 270;
      const g = canvas.getContext('2d', {alpha: false});
      try {
        const scene = D.createScene(Object.assign({}, row, {template: id, tpl: id}), 480);
        const count = Math.max(12, Math.min(36, Math.round(scene.duration * 10)));
        const frames = Array.from({length: count}, (_, i) => {
          scene.draw(g, (scene.duration * i) / (count - 1) * 0.995);
          return canvas.toDataURL('image/jpeg', 0.72);
        });
        return JSON.stringify({frames, seconds: Math.min(scene.duration, 4), sample: !!row.sampleData});
      } catch (e) {
        return JSON.stringify({frames: [], seconds: 0, sample: false});
      }
    },
    adopt(rowJSON, id) {
      return JSON.stringify(D.adopt(JSON.parse(rowJSON), id));
    },
    libraryPrompt() {
      return D.libraryPrompt();
    },
    // 动效库的缩略图：用样例数据画这个动效停下来的那一帧
    thumb(id) {
      const tpl = D.TEMPLATES[id];
      if (!tpl) return '';
      const raw = Object.assign({line: ''}, D.sampleOf(id), {template: id, tpl: id});
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 180;
      const g = canvas.getContext('2d', {alpha: false});
      g.fillStyle = '#000';
      g.fillRect(0, 0, 320, 180);
      try {
        const scene = D.createScene(raw, 320);
        scene.draw(g, D.thumbTime(id, scene));
      } catch (e) {
        return '';
      }
      return canvas.toDataURL('image/jpeg', 0.82);
    },
    rank(rowJSON, last) {
      const row = JSON.parse(rowJSON);
      return JSON.stringify(D.rankTemplates(row, last || null).map((t) => ({id: t.id, name: t.name, family: t.family, why: t.why, score: t.score})));
    },
    validate(rowJSON) {
      const row = JSON.parse(rowJSON);
      const tpl = D.TEMPLATES[row.tpl];
      if (!tpl) return JSON.stringify({errors: [`没有「${row.tpl}」这个模板`]});
      if (tpl.custom) return JSON.stringify({errors: []});
      return JSON.stringify({errors: D.validate(Object.assign({}, row, {template: row.tpl})).errors});
    },
    // ---------- 分镜 ----------
    parseCopy(text) {
      return JSON.stringify(root.DMParser.parseCopy(text));
    },
    autoboard(text, chapter, sentences) {
      return JSON.stringify(root.DMBoard.generate(text, {chapter: chapter || undefined, sentences: !!sentences}));
    },
    // 一段话配一个动效：拆分、组合、重新匹配都走这里
    rematch(line, chapter) {
      const row = root.DMBoard.generate(line, {chapter: chapter || undefined, whole: true}).rows[0];
      return JSON.stringify(row || null);
    },
    reviewRows(rowsJSON, source) {
      return JSON.stringify(root.DMBoard.reviewRows(JSON.parse(rowsJSON), source));
    },
    // ---------- 导出 ----------
    probes(rowJSON) {
      const row = JSON.parse(rowJSON);
      const raw = Object.assign({}, row, {template: row.tpl});
      const scene = D.createScene(raw, 1920);
      const pal = scene.palette;
      const probes = pal && scene.probes && !scene.edited ? scene.probes() : null;
      const shades = pal ? Object.entries(pal).filter(([n]) => n !== 'bg').flatMap(([name, col]) => [0, 0.5, 0.55].map((f) => ({name, rgb: D.mix(col, pal.bg, f).map((v) => Math.round(v))}))) : [];
      return JSON.stringify({duration: scene.duration, edited: !!scene.edited, shades, rows: probes ? probes.map((p) => ({title: p.title, points: p.points, expect: p.expect})) : []});
    },
    async exportRow(rowJSON, size, fps, hook) {
      if (exporting) exporting.abort();
      const ac = new AbortController();
      exporting = ac;
      const row = JSON.parse(rowJSON);
      const raw = Object.assign({}, row, {template: row.tpl});
      const sink = async (data, pos) => {
        const b64 = await bufToB64(data);
        await root.webkit.messageHandlers.sink.postMessage({pos, b64});
      };
      try {
        const out = await D.exportMP4(raw, {
          size,
          fps,
          signal: ac.signal,
          sink,
          onProgress: (p, sec) => {
            if (hook) hook(p, sec);
          },
        });
        return JSON.stringify({frames: out.frames, duration: out.duration, width: out.width, height: out.height, fps: out.fps});
      } finally {
        if (exporting === ac) exporting = null;
      }
    },
    cancelExport() {
      if (exporting) exporting.abort();
    },
  };
  root.DMBridge = api;
  // 自动化测试读状态用
  root.__dmEditor = editor;
  root.__dmState = () => S;

  D.loadFonts().then(() => {
    fitCanvas();
    requestAnimationFrame(tick);
    post({type: 'ready'});
    root.__dmReady = true;
  }).catch((e) => {
    errEl.hidden = false;
    errEl.textContent = `字体载入失败：${e.message}`;
    post({type: 'fatal', message: e.message});
  });
})(window);
