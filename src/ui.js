// 网页版界面，和 App 的剪辑台一样：中间大画面，下面时间线，一镜一个片段。三页：文稿、画面、分镜表。
(async function () {
  'use strict';
  const D = window.DM;
  const P = window.DMParser;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem(k);
        return v == null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (e) {
        /* 隐私模式下存不了，不影响使用 */
      }
    },
  };

  const API = window.DM_API || null;
  const lib = window.DMFontLib;
  await D.loadFonts();

  // 换一期片子时，分镜表由 make_board_html.py 灌进来；修改按分镜表名字分开存，互不覆盖
  const BOARD = window.DM_BOARD_OVERRIDE || window.DM_BOARD;
  BOARD.rows.forEach((r, i) => {
    r.id = r.id || i + 1;
    r.no = r.no || String(r.id).padStart(3, '0');
    r.kind = r.kind || 'B';
    r.cat = r.cat || '数据动效';
    r.ch = r.ch || '正片';
  });
  // 「出镜」和删掉的动效都不在了：这种镜头按重音字幕，口播不动，点胶囊换掉
  const normalize = (r) => {
    if (D.TEMPLATES[r.tpl]) return;
    r.tpl = 'statement';
    r.kind = 'B';
    if (r.cat === '出镜' || r.cat === '实拍') r.cat = '文字动效';
    if (!(r.lines && r.lines.length) && r.line) r.lines = [String(r.line).replace(/[。！？!?；;，,：:\s]+$/, '')];
  };
  const NS = `${BOARD.title || 'board'}:`;
  const rawStore = {get: store.get, set: store.set};
  store.get = (k, d) => rawStore.get(NS + k, d);
  store.set = (k, v) => rawStore.set(NS + k, v);
  document.title = BOARD.title ? `${BOARD.title}` : document.title;
  $('title').textContent = BOARD.title || '肉呆爱动效';
  const original = JSON.parse(JSON.stringify(BOARD.rows));
  const rows = BOARD.rows;
  const applyDiff = (row, diff) => {
    Object.entries(diff).forEach(([k, v]) => {
      if (v && v.__del) delete row[k];
      else row[k] = v;
    });
  };
  // 服务器版：修改和字体选择全组共用一份；单文件版：存在这台电脑的浏览器里
  const boardName = BOARD.title || 'board';
  const sync = {rev: -1, online: false, pending: new Map(), timer: null};
  let edits = store.get('dm_edits_v2', {});
  let extra = store.get('dm_extra_v2', []);
  let assign = store.get('dm_font_assign', {});
  if (API) {
    edits = {};
    extra = [];
    assign = {};
    try {
      const res = await fetch(`${API}/state?board=${encodeURIComponent(boardName)}`);
      if (!res.ok) throw new Error(String(res.status));
      const st = await res.json();
      edits = st.edits || {};
      extra = Object.values(st.extra || {});
      assign = st.fonts || {};
      sync.rev = st.rev;
      sync.online = true;
    } catch (e) {
      sync.online = false;
    }
  }
  extra.forEach((r) => rows.push(r));
  rows.forEach((r) => {
    if (edits[r.id]) applyDiff(r, edits[r.id]);
    normalize(r);
  });
  // 团队字体可能很大、服务器出口又小，放到后台加载，界面先出来
  let fontsReady = Promise.resolve();
  const S = {sel: Math.max(0, rows.findIndex((r) => r.id === store.get('dm_sel', 1))), playing: true, t: 0, scene: null, filter: 'all', query: '', exporting: null, picked: new Set(), page: 'stage', loop: true};

  const rawOf = (row) => Object.assign({}, row, {template: row.tpl});
  const estDur = (row) => {
    const s = P.syllables(row.line || '') / (P.RATE * (row.speed || 1));
    if (row.tpl === 'titleV') return 7.5;
    if (row.tpl === 'titleH') return 6.5;
    if (row.tpl === 'lucy') return 1.9;
    return s + 2.4;
  };
  const outputable = (r) => !r.sampleData && !!D.TEMPLATES[r.tpl] && !D.TEMPLATES[r.tpl].noExport;
  const nameOf = (row) => (D.TEMPLATES[row.tpl] ? D.TEMPLATES[row.tpl].name : '重音字幕');
  const fmt = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

  const setSync = (text, cls = '') => {
    $('sync').textContent = text;
    $('sync').className = cls;
  };
  const flushEdits = async () => {
    clearTimeout(sync.timer);
    for (const [id, body] of [...sync.pending]) {
      try {
        const res = await fetch(`${API}/edit`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(Object.assign({board: boardName, id}, body))});
        if (!res.ok) throw new Error(String(res.status));
        if (sync.pending.get(id) === body) sync.pending.delete(id);
        sync.online = true;
      } catch (e) {
        sync.online = false;
        setSync('没存上服务器，会自动重试', 'warn');
        return;
      }
    }
    if (!sync.pending.size) setSync('已同步', 'okText');
  };
  const queueEdit = (id, body) => {
    sync.pending.set(id, body);
    setSync('保存中…');
    clearTimeout(sync.timer);
    sync.timer = setTimeout(flushEdits, 500);
  };
  // 撤销：所有修改都走 saveRow，每个动作单独一步。只有拖滑块这种连续改，一秒内才算一步
  const history = {undo: [], redo: [], snap: new Map(), at: 0, last: null, sliding: false};
  const remember = (row) => history.snap.set(row.id, JSON.stringify(row));
  rows.forEach(remember);
  const recordStep = (row) => {
    const before = history.snap.get(row.id);
    const now = JSON.stringify(row);
    if (before === now) return;
    const t = performance.now();
    if (before && !(history.sliding && history.last === row.id && t - history.at < 1000)) {
      history.undo.push({id: row.id, json: before});
      if (history.undo.length > 200) history.undo.shift();
      history.redo.length = 0;
    }
    history.last = row.id;
    history.at = t;
    history.snap.set(row.id, now);
  };
  const saveRow = (row) => {
    recordStep(row);
    const base = original.find((o) => o.id === row.id);
    if (!base) {
      if (API) queueEdit(row.id, {row});
      else store.set('dm_extra_v2', rows.filter((r) => r.added));
      return;
    }
    const diff = {};
    new Set([...Object.keys(row), ...Object.keys(base)]).forEach((k) => {
      if (k === 'id' || k === 'no') return;
      if (JSON.stringify(row[k]) !== JSON.stringify(base[k])) diff[k] = row[k] === undefined ? {__del: true} : row[k];
    });
    if (Object.keys(diff).length) edits[row.id] = diff;
    else delete edits[row.id];
    if (API) queueEdit(row.id, {diff: edits[row.id] || null});
    else store.set('dm_edits_v2', edits);
  };

  // ---------- 筛选 ----------
  const matches = (r) => {
    const q = S.query.trim();
    if (q && !(r.line || '').includes(q) && !String(r.no).includes(q)) return false;
    if (S.filter === 'all') return true;
    if (S.filter === 'note') return !!r.note;
    if (S.filter === 'adjusted') return !!(r.layers && Object.keys(r.layers).length);
    if (S.filter.startsWith('ch:')) return r.ch === S.filter.slice(3);
    return r.cat === S.filter;
  };
  const renderFilter = () => {
    const count = (fn) => rows.filter(fn).length;
    const chapters = [...new Set(rows.map((r) => r.ch))];
    const opts = [['all', '全部', rows.length], ['数据动效', '数据动效', count((r) => r.cat === '数据动效')], ['文字动效', '文字动效', count((r) => r.cat === '文字动效')], ['屏幕动效', '屏幕动效', count((r) => r.cat === '屏幕动效')], ['note', '要确认', count((r) => r.note)], ['adjusted', '调整过', count((r) => r.layers && Object.keys(r.layers).length)]].filter((o) => o[2] || o[0] === 'all');
    chapters.forEach((c) => opts.push([`ch:${c}`, c, count((r) => r.ch === c)]));
    $('filter').innerHTML = opts.map(([k, n, c]) => `<option value="${esc(k)}" ${S.filter === k ? 'selected' : ''}>${esc(n)} ${c}</option>`).join('');
  };
  const refilter = () => {
    renderTimeline();
    renderTable();
    if (!matches(rows[S.sel])) {
      const first = rows.findIndex(matches);
      if (first >= 0) select(first);
    }
  };
  $('filter').onchange = (e) => {
    S.filter = e.target.value;
    refilter();
  };
  $('search').oninput = (e) => {
    S.query = e.target.value;
    refilter();
    if (S.query && S.page === 'script') setPage('stage');
  };

  // ---------- 时间线：刻度、效果胶囊、胶片、口播轨，一镜一列 ----------
  const PX = 40;
  const MIN_W = 56;
  const secondsCache = new Map();
  const secondsOf = (row) => {
    if (+row.dur > 0) return +row.dur;
    const key = JSON.stringify(row);
    if (!secondsCache.has(key)) {
      let sec;
      try {
        sec = D.createScene(rawOf(row), 64).duration;
      } catch (e) {
        sec = estDur(row);
      }
      secondsCache.set(key, sec);
    }
    return secondsCache.get(key);
  };
  const widthOf = (sec) => Math.max(MIN_W, sec * PX);
  const clock = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const clipOf = (i) => document.querySelector(`.clip[data-i="${i}"]`);

  // 胶片一镜一镜慢慢画，不抢播放
  const strips = new Map();
  const stripKey = (row, n) => `${n}|${JSON.stringify(row)}`;
  const queue = [];
  let painting = false;
  const paintNext = () => {
    if (S.exporting) {
      setTimeout(paintNext, 500);
      return;
    }
    const clip = queue.shift();
    if (!clip) {
      painting = false;
      return;
    }
    if (clip.isConnected) paintStrip(clip);
    setTimeout(paintNext, 12);
  };
  const enqueueStrip = (clip) => {
    if (!queue.includes(clip)) queue.push(clip);
    if (!painting) {
      painting = true;
      setTimeout(paintNext, 0);
    }
  };
  const paintStrip = (clip) => {
    const row = rows[+clip.dataset.i];
    if (!row) return;
    const w = clip.offsetWidth;
    const n = Math.max(1, Math.ceil(w / 103));
    const key = stripKey(row, n);
    const film = clip.querySelector('.film');
    let strip = strips.get(key);
    if (!strip) {
      strip = document.createElement('canvas');
      strip.width = n * 206;
      strip.height = 116;
      const g = strip.getContext('2d', {alpha: false});
      try {
        const scene = D.createScene(rawOf(row), 206);
        const frame = document.createElement('canvas');
        frame.width = 206;
        frame.height = 116;
        const k = frame.getContext('2d', {alpha: false});
        for (let i = 0; i < n; i++) {
          scene.draw(k, n === 1 ? D.thumbTime(row.tpl, scene) : scene.duration * (0.3 + (0.68 * i) / (n - 1)));
          g.drawImage(frame, i * 206, 0);
        }
      } catch (e) {
        return;
      }
      strips.set(key, strip);
      if (strips.size > 400) strips.delete(strips.keys().next().value);
    }
    let shown = film.querySelector('canvas');
    if (!shown) {
      shown = document.createElement('canvas');
      film.prepend(shown);
    }
    shown.width = strip.width;
    shown.height = strip.height;
    shown.style.width = `${n * 103}px`;
    shown.getContext('2d').drawImage(strip, 0, 0);
    clip.dataset.strip = key;
  };
  const stripWatch = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) enqueueStrip(en.target);
    });
  }, {root: $('timeline'), rootMargin: '0px 500px'});

  const clipHtml = (r, i, start) => {
    const sec = secondsOf(r);
    return `<div class="clip ${i === S.sel ? 'sel' : ''}" data-i="${i}" style="width:${widthOf(sec)}px;--sec:${PX}px">
      <div class="ruler" data-i="${i}">${clock(start)}</div>
      <button class="cap" data-i="${i}" aria-label="效果 ${esc(r.no)}" title="${esc(nameOf(r))}"><svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="8"/><path d="M10 2a8 8 0 0 1 0 16z" fill="currentColor"/></svg><span>${esc(r.ch !== '正片' && (i === 0 || rows[i - 1].ch !== r.ch) ? `${r.ch} · ` : '')}${esc(nameOf(r))}</span></button>
      <div class="film" data-i="${i}" title="${esc(r.line)}"><span class="no">${esc(r.no)}${r.note ? '<i class="dot" title="要确认"></i>' : ''}</span><div class="trim" data-i="${i}" role="slider" tabindex="0" aria-label="第 ${esc(r.no)} 镜时长" aria-valuenow="${sec.toFixed(1)}" aria-valuetext="${sec.toFixed(1)} 秒"></div></div>
      <div class="audio"><i>♪</i><b></b></div>
    </div>`;
  };
  const renderTimeline = () => {
    const box = $('clips');
    const left = $('timeline').scrollLeft;
    let t = 0;
    let html = '';
    rows.forEach((r, i) => {
      if (!matches(r)) return;
      html += clipHtml(r, i, t);
      t += secondsOf(r);
    });
    box.innerHTML = html;
    $('timeline').scrollLeft = left;
    stripWatch.disconnect();
    box.querySelectorAll('.clip').forEach((c) => stripWatch.observe(c));
    placePlayhead();
  };
  // 一镜的时长变了：宽度、后面的时间、胶片
  const refreshTimes = () => {
    let t = 0;
    rows.forEach((r, i) => {
      if (!matches(r)) return;
      const clip = clipOf(i);
      if (!clip) return;
      clip.querySelector('.ruler').textContent = clock(t);
      t += secondsOf(r);
    });
  };
  const refreshClip = (i) => {
    const clip = clipOf(i);
    if (!clip) return;
    const r = rows[i];
    const sec = secondsOf(r);
    clip.style.width = `${widthOf(sec)}px`;
    const cap = clip.querySelector('.cap span');
    cap.textContent = `${r.ch !== '正片' && (i === 0 || rows[i - 1].ch !== r.ch) ? `${r.ch} · ` : ''}${nameOf(r)}`;
    clip.querySelector('.cap').title = nameOf(r);
    const trim = clip.querySelector('.trim');
    trim.setAttribute('aria-valuenow', sec.toFixed(1));
    trim.setAttribute('aria-valuetext', `${sec.toFixed(1)} 秒`);
    enqueueStrip(clip);
    refreshTimes();
  };
  // 播放头放在选中的片段身上
  const playhead = document.createElement('div');
  playhead.id = 'playhead';
  playhead.innerHTML = '<em></em><u></u>';
  const placePlayhead = () => {
    const clip = clipOf(S.sel);
    if (clip) clip.appendChild(playhead);
    else playhead.remove();
  };
  const revealClip = (i, smooth = true) => {
    const clip = clipOf(i);
    if (!clip) return;
    const box = $('timeline');
    const left = clip.offsetLeft + clip.offsetWidth / 2 - box.clientWidth / 2;
    // 隔得远就直接到，不然平滑滚动要滚很久
    const near = Math.abs(left - box.scrollLeft) < box.clientWidth * 1.5;
    box.scrollTo({left, behavior: smooth && near ? 'smooth' : 'auto'});
  };
  // 刻度：点或拖就是定位。胶囊：换效果。胶片：选这一镜
  $('clips').addEventListener('click', (e) => {
    const cap = e.target.closest('.cap');
    if (cap) {
      const i = +cap.dataset.i;
      if (i !== S.sel) select(i);
      openPicker();
      return;
    }
    const film = e.target.closest('.film');
    if (film && !e.target.closest('.trim')) {
      const i = +film.dataset.i;
      if (i !== S.sel) select(i);
    }
  });
  $('clips').addEventListener('pointerdown', (e) => {
    const ruler = e.target.closest('.ruler');
    if (ruler) {
      const i = +ruler.dataset.i;
      const seekTo = (ev) => {
        const r = ruler.getBoundingClientRect();
        const k = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
        if (S.sel !== i) select(i);
        if (S.scene) S.t = k * S.scene.duration;
        lastDraw = -1;
      };
      seekTo(e);
      ruler.setPointerCapture(e.pointerId);
      ruler.onpointermove = seekTo;
      ruler.onpointerup = () => {
        ruler.onpointermove = null;
        ruler.onpointerup = null;
      };
      return;
    }
    const trim = e.target.closest('.trim');
    if (!trim) return;
    // 拖片段右边缘改时长：长了多停一会儿，短了整段加快。松手才算一步
    e.preventDefault();
    e.stopPropagation();
    const i = +trim.dataset.i;
    const row = rows[i];
    const clip = clipOf(i);
    const start = secondsOf(row);
    const x0 = e.clientX;
    let now = start;
    trim.setPointerCapture(e.pointerId);
    trim.classList.add('drag');
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = `${start.toFixed(1)} 秒`;
    clip.querySelector('.film').parentElement.appendChild(bubble);
    bubble.style.bottom = '80px';
    trim.onpointermove = (ev) => {
      now = Math.min(600, Math.max(0.5, Math.round((start + (ev.clientX - x0) / PX) * 10) / 10));
      clip.style.width = `${widthOf(now)}px`;
      bubble.textContent = `${now.toFixed(1)} 秒`;
    };
    trim.onpointerup = () => {
      trim.onpointermove = null;
      trim.onpointerup = null;
      trim.classList.remove('drag');
      bubble.remove();
      if (Math.abs(now - start) >= 0.05) setDuration(i, now);
      else clip.style.width = `${widthOf(start)}px`;
    };
  });
  // 双击边缘恢复自动时长；键盘左右键每次半秒
  $('clips').addEventListener('dblclick', (e) => {
    const trim = e.target.closest('.trim');
    if (trim) setDuration(+trim.dataset.i, null);
  });
  $('clips').addEventListener('keydown', (e) => {
    const trim = e.target.closest('.trim');
    if (!trim || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    e.stopPropagation();
    const i = +trim.dataset.i;
    setDuration(i, Math.max(0.5, secondsOf(rows[i]) + (e.key === 'ArrowRight' ? 0.5 : -0.5)));
  });
  const setDuration = (i, seconds) => {
    const row = rows[i];
    if (seconds == null) delete row.dur;
    else row.dur = seconds;
    saveRow(row);
    refreshClip(i);
    if (i === S.sel) {
      buildScene(false);
      renderShot();
    }
    renderTable();
  };

  // ---------- 分镜表 ----------
  const renderTable = () => {
    const box = $('table');
    const top = box.scrollTop;
    let html = '';
    let ch = '';
    rows.forEach((r, i) => {
      if (!matches(r)) return;
      if (r.ch !== ch) {
        ch = r.ch;
        const list = rows.filter((x) => x.ch === ch);
        const total = list.reduce((a, x) => a + secondsOf(x), 0);
        html += `<div class="chapter">${esc(ch)} <span>${list.length} 镜 · ${fmt(total)}</span></div>`;
      }
      const canPick = outputable(r);
      html += `<div class="row ${i === S.sel ? 'sel' : ''}" data-i="${i}">
        <input class="pick" type="checkbox" data-id="${r.id}" aria-label="勾选镜 ${esc(r.no)}" ${S.picked.has(r.id) ? 'checked' : ''} ${canPick ? '' : 'disabled'}>
        <div class="n">${esc(r.no)}${r.note ? '<i class="dot" title="要确认"></i>' : ''}</div>
        <div class="txt">${esc(r.line)}</div>
        <div class="sec">${secondsOf(r).toFixed(1)} 秒</div>
        <button class="cap" data-i="${i}" aria-label="效果 ${esc(r.no)}" title="${esc(nameOf(r))}"><svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="8"/><path d="M10 2a8 8 0 0 1 0 16z" fill="currentColor"/></svg><span>${esc(nameOf(r))}</span></button>
      </div>`;
    });
    box.innerHTML = html;
    box.scrollTop = top;
    box.querySelectorAll('.row').forEach((el) => {
      el.onclick = (e) => {
        if (e.target.closest('.cap') || e.target.tagName === 'INPUT') return;
        select(+el.dataset.i);
      };
      el.ondblclick = (e) => {
        if (e.target.closest('.cap') || e.target.tagName === 'INPUT') return;
        setPage('stage');
      };
    });
    box.querySelectorAll('.cap').forEach((b) => {
      b.onclick = () => {
        select(+b.dataset.i);
        openPicker();
      };
    });
    box.querySelectorAll('.pick').forEach((el) => {
      el.onchange = () => {
        if (el.checked) S.picked.add(+el.dataset.id);
        else S.picked.delete(+el.dataset.id);
        renderPickbar();
      };
    });
    renderPickbar();
  };
  const renderPickbar = () => {
    const n = S.picked.size;
    const shown = rows.filter((r) => matches(r) && outputable(r));
    $('pickbar').innerHTML = `<span>${n ? `已勾选 ${n} 镜` : ''}</span><button id="pickAll">全选（${shown.length}）</button><button id="pickNone" ${n ? '' : 'disabled'}>清空</button><button id="pickGo" class="primary" ${n ? '' : 'disabled'}>导出勾选的</button>`;
    $('pickAll').onclick = () => {
      shown.forEach((r) => S.picked.add(r.id));
      renderTable();
    };
    $('pickNone').onclick = () => {
      S.picked.clear();
      renderTable();
    };
    $('pickGo').onclick = () => openBatch('picked');
  };

  // ---------- 这一镜 ----------
  const select = (i) => {
    const prev = clipOf(S.sel);
    if (prev) prev.classList.remove('sel');
    S.sel = i;
    store.set('dm_sel', rows[i].id);
    const clip = clipOf(i);
    if (clip) clip.classList.add('sel');
    placePlayhead();
    revealClip(i);
    document.querySelectorAll('.row').forEach((el) => el.classList.toggle('sel', +el.dataset.i === i));
    const el = document.querySelector(`.row[data-i="${i}"]`);
    if (el && S.page === 'table') {
      const box = $('table');
      const r = el.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      if (r.top < b.top + 36 || r.bottom > b.bottom) el.scrollIntoView({block: 'center'});
    }
    $('motionName').textContent = nameOf(rows[i]);
    buildScene(true);
    renderShot();
  };

  const cv = $('cv');
  const ctx = cv.getContext('2d', {alpha: false});
  // 画面内调整：每个元素都能直接在预览上拖动、拉高、改速度
  let playUntil = null;
  const ICON_PLAY = '<svg class="solid" viewBox="0 0 20 20"><path d="M5.500 3v14L17 10z"/></svg>';
  const ICON_PAUSE = '<svg class="solid" viewBox="0 0 20 20"><path d="M5 3.500h3.500v13H5zM11.500 3.500H15v13h-3.500z"/></svg>';
  const setPlaying = (on) => {
    S.playing = on;
    $('play').innerHTML = on ? ICON_PAUSE : ICON_PLAY;
    $('play').setAttribute('aria-label', on ? '暂停' : '播放');
    $('play').title = on ? '暂停' : '播放';
  };
  const editor = new window.DMEditor({
    host: $('stage'),
    scene: () => S.scene,
    raw: () => rawOf(rows[S.sel]),
    time: () => S.t,
    seek: (t) => {
      S.t = t;
      lastDraw = -1;
    },
    playing: () => S.playing,
    pause: () => {
      setPlaying(false);
      playUntil = null;
    },
    play: (from, to) => {
      S.t = from;
      playUntil = to;
      setPlaying(true);
    },
    invalidate: () => {
      lastDraw = -1;
    },
    commit: (layers) => {
      const row = rows[S.sel];
      row.layers = row.layers || {};
      if (Object.keys(layers).length) row.layers[row.tpl] = layers;
      else delete row.layers[row.tpl];
      if (!Object.keys(row.layers).length) delete row.layers;
      saveRow(row);
    },
    list: true,
  });
  const buildScene = (reset, keepSelection = false) => {
    const row = rows[S.sel];
    try {
      S.scene = D.createScene(rawOf(row), cv.width);
      $('err').style.display = 'none';
    } catch (e) {
      S.scene = null;
      $('err').style.display = 'grid';
      $('err').textContent = row.pending ? `这一镜的数据还没有：${row.note || ''}（${e.message}）` : e.message;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cv.width, cv.height);
    }
    if (reset) S.t = 0;
    if (S.scene) S.t = Math.min(S.t, S.scene.duration);
    if (editor && S.scene) {
      // 撤销时动效没换，选中的元素留着
      if (keepSelection) editor.setLayers((row.layers && row.layers[row.tpl]) || {});
      else editor.bind(rawOf(row));
    }
    D.ensureGlyphs(JSON.stringify(row)).then((loaded) => {
      if (loaded) buildScene(false);
    }).catch(() => {});
  };

  const REL = {single: '单个', nested: '包含', opposing: '相反两拨', parallel: '并列', chain: '这其中（基数变了）'};
  // 这一镜动效本身多长：不算手动时长。速率 = 本身时长 ÷ 时长
  const naturalOf = (row) => {
    try {
      return D.createScene(Object.assign({}, rawOf(row), {dur: null}), 64).duration;
    } catch (e) {
      return secondsOf(Object.assign({}, row, {dur: null}));
    }
  };
  const renderShot = () => {
    const row = rows[S.sel];
    const metricsHtml = (row.groups || []).map((g, gi) => `
      <div class="field" style="border-top:1px solid var(--line);padding-top:8px">
        <div class="two" style="margin-bottom:6px">
          <div><label>第 ${gi + 1} 组标题</label><input type="text" data-g="${gi}" data-k="title" value="${esc(g.title)}" placeholder="可留空"></div>
          <div><label>这组几个数的关系</label><select data-g="${gi}" data-k="relation">${['single', 'nested', 'opposing', 'parallel', 'chain'].map((k) => `<option value="${k}" ${g.relation === k ? 'selected' : ''}>${REL[k]}</option>`).join('')}</select></div>
        </div>
        <div class="mrow mhead"><span>前缀</span><span>说明</span><span>数值 %</span><span>落定 秒</span><span></span></div>
        ${g.metrics.map((m, mi) => `<div class="mrow">
          <input type="text" data-g="${gi}" data-m="${mi}" data-k="prefix" value="${esc(m.prefix || '')}" placeholder="只有">
          <input type="text" data-g="${gi}" data-m="${mi}" data-k="caption" value="${esc(m.caption)}">
          <input type="number" step="0.1" data-g="${gi}" data-m="${mi}" data-k="value" value="${m.value == null ? '' : m.value}" placeholder="待填">
          <input type="number" step="0.1" data-g="${gi}" data-m="${mi}" data-k="land" value="${m.land == null ? '' : m.land}" placeholder="自动">
          <button data-del="${gi}:${mi}" title="删掉这个数">×</button>
        </div>`).join('')}
      </div>`).join('');
    const hasLines = row.lines && row.lines.length;
    const advKeys = ['points', 'ref', 'cohort', 'events', 'sets', 'steps', 'highlight', 'nodes', 'left', 'right', 'dialog', 'words', 'sub', 'wrong', 'title', 'ceil', 'caption', 'pre', 'post', 'head', 'foot', 'prefix', 'key', 'center', 'total', 'from', 'to'];
    const adv = {};
    advKeys.forEach((k) => {
      if (row[k] !== undefined) adv[k] = row[k];
    });
    const hasAdv = Object.keys(adv).length > 0;
    const tpl = D.TEMPLATES[row.tpl];
    const roles = D.colorRoles ? D.colorRoles(row) : [];
    $('shot').innerHTML = `
      <div class="block">
        <h3>镜 ${esc(row.no)} · ${esc(row.ch)} · ${esc(row.cat)}</h3>
        <p class="line">${esc(row.line)}</p>
        ${row.visual ? `<p class="visual">${esc(row.visual)}</p>` : ''}
        ${row.note ? `<p class="note">${esc(row.note)}</p>` : ''}
      </div>
      ${row.groups && row.groups.length ? `<div class="block"><h3>数据</h3>${metricsHtml}<button id="addMetric">加一个数</button> <button id="addGroup">加一组</button></div>` : ''}
      ${hasLines ? `<div class="block"><h3>上屏文字（一行一条）</h3><textarea id="linesBox" rows="${Math.min(8, row.lines.length + 1)}">${esc(row.lines.join('\n'))}</textarea></div>` : ''}
      ${hasAdv ? `<details class="block"><summary style="cursor:pointer;color:var(--mute)">其他参数</summary><textarea id="advBox" rows="8" style="margin-top:8px;font-family:Menlo,monospace;font-size:12px">${esc(JSON.stringify(adv, null, 1))}</textarea><div id="advErr" class="warn" style="font-size:12px"></div></details>` : ''}
      <div class="block">
        <h3>节奏与颜色</h3>
        <div class="two">
          <div class="field"><label>这一镜的秒数（空着是自动）</label><input id="dur" type="number" min="0.5" step="0.1" value="${row.dur != null ? row.dur : ''}" placeholder="${secondsOf(row).toFixed(1)}"></div>
          <div class="field"><label>速率</label><input id="rate" type="number" min="0.125" max="8" step="0.05" value="${row.dur > 0 ? +(naturalOf(row) / row.dur).toFixed(2) : ''}" placeholder="1"></div>
        </div>
        <div class="two">
          <div class="field"><label>口播速度 ${(row.speed || 1).toFixed(2)} 倍</label><input id="speed" type="range" min="0.6" max="1.6" step="0.05" value="${row.speed || 1}"></div>
          <div class="field"><label>念完后停留 ${(row.hold != null ? +row.hold : 3).toFixed(1)} 秒</label><input id="hold" type="range" min="0.5" max="6" step="0.1" value="${row.hold != null ? row.hold : 3}"></div>
        </div>
        <div style="display:flex;gap:6px">
          <button data-theme="">模板默认色</button><button data-theme="black">黑底</button><button data-theme="paper">奶白底</button>
          <button id="resetRow" style="margin-left:auto">恢复这一镜</button>
        </div>
        ${roles.length ? `<div class="colors">${roles.map((r) => `<label class="swatch${r.custom ? ' on' : ''}"><input type="color" data-color="${esc(r.key)}" value="${esc(r.value)}" aria-label="${esc(r.name)}"><span>${esc(r.name)}</span></label>`).join('')}</div>` : ''}
      </div>
      <div class="block">
        <h3>输出视频</h3>
        <div class="expo">
          <select id="xSize"><option value="4k">4K</option><option value="1080p">1080p</option></select>
          <select id="xFps"><option value="60">60 帧</option><option value="30">30 帧</option></select>
          <button id="xGo" class="primary" ${tpl && tpl.noExport ? 'disabled' : ''}>输出这一镜</button>
          <button id="xCancel" style="display:none">取消</button>
          
        </div>
        <div id="bar"><i></i></div>
        <div id="result"></div>
      </div>`;
    bindShot(row);
  };

  const rebuild = (row, reset) => {
    saveRow(row);
    buildScene(reset);
    refreshClip(S.sel);
  };
  const bindShot = (row) => {
    // 颜色：选好写进这一镜；右键恢复默认
    document.querySelectorAll('#shot [data-color]').forEach((el) => {
      el.onchange = () => {
        row.colors = Object.assign({}, row.colors, {[el.dataset.color]: el.value});
        rebuild(row, false);
        renderShot();
      };
      el.parentElement.oncontextmenu = (e) => {
        e.preventDefault();
        if (!row.colors || !row.colors[el.dataset.color]) return;
        const next = Object.assign({}, row.colors);
        delete next[el.dataset.color];
        row.colors = Object.keys(next).length ? next : undefined;
        rebuild(row, false);
        renderShot();
      };
    });
    document.querySelectorAll('#shot [data-g]').forEach((el) => {
      el.onchange = () => {
        const g = row.groups[+el.dataset.g];
        const k = el.dataset.k;
        if (el.dataset.m != null) {
          const m = g.metrics[+el.dataset.m];
          if (k === 'value') m.value = el.value === '' ? null : +el.value;
          else if (k === 'land') m.land = el.value === '' ? null : +el.value;
          else m[k] = el.value;
          if (k === 'value') {
            row.pending = false;
            if (row.tpl === 'swap') row.value = m.value;
          }
        } else {
          g[k] = el.value;
        }
        rebuild(row, false);
      };
    });
    document.querySelectorAll('#shot [data-del]').forEach((b) => (b.onclick = () => {
      const [gi, mi] = b.dataset.del.split(':').map(Number);
      row.groups[gi].metrics.splice(mi, 1);
      if (!row.groups[gi].metrics.length) row.groups.splice(gi, 1);
      rebuild(row, true);
      renderShot();
    }));
    if ($('addMetric')) $('addMetric').onclick = () => {
      const g = row.groups[row.groups.length - 1];
      g.metrics.push({caption: '', value: 10});
      if (g.metrics.length > 1 && g.relation === 'single') g.relation = 'parallel';
      rebuild(row, true);
      renderShot();
    };
    if ($('addGroup')) $('addGroup').onclick = () => {
      row.groups.push({title: '', relation: 'single', metrics: [{caption: '', value: 10}]});
      rebuild(row, true);
      renderShot();
    };
    if ($('linesBox')) $('linesBox').onchange = (e) => {
      row.lines = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean);
      rebuild(row, true);
    };
    if ($('advBox')) $('advBox').onchange = (e) => {
      try {
        Object.assign(row, JSON.parse(e.target.value));
        $('advErr').textContent = '';
        rebuild(row, true);
      } catch (err) {
        $('advErr').textContent = `格式不对：${err.message}`;
      }
    };
    $('speed').oninput = (e) => {
      row.speed = +e.target.value;
      e.target.previousElementSibling.textContent = `口播速度 ${row.speed.toFixed(2)} 倍`;
      history.sliding = true;
      rebuild(row, false);
      history.sliding = false;
    };
    $('hold').oninput = (e) => {
      row.hold = +e.target.value;
      e.target.previousElementSibling.textContent = `念完后停留 ${row.hold.toFixed(1)} 秒`;
      history.sliding = true;
      rebuild(row, false);
      history.sliding = false;
    };
    document.querySelectorAll('[data-theme]').forEach((b) => (b.onclick = () => {
      if (b.dataset.theme) row.theme = b.dataset.theme;
      else delete row.theme;
      rebuild(row, false);
    }));
    $('rate').onchange = (e) => {
      const r = parseFloat(e.target.value);
      setDuration(S.sel, r > 0 ? Math.round((naturalOf(row) / Math.min(8, Math.max(0.125, r))) * 100) / 100 : null);
      renderShot();
    };
    $('dur').onchange = (e) => {
      const v = parseFloat(e.target.value);
      setDuration(S.sel, v > 0 ? Math.max(0.5, v) : null);
    };
    $('resetRow').onclick = () => {
      const base = original.find((o) => o.id === row.id);
      if (!base) return;
      Object.keys(row).forEach((k) => delete row[k]);
      Object.assign(row, JSON.parse(JSON.stringify(base)));
      delete edits[row.id];
      if (API) queueEdit(row.id, {diff: null});
      else store.set('dm_edits_v2', edits);
      recordStep(row);
      renderAll();
      select(S.sel);
    };
    $('xGo').onclick = () => exportRow(row);
  };

  // ---------- 输出 ----------
  const fileName = (row, size, fps) => `镜${row.no}_${D.TEMPLATES[row.tpl].name}_${size}${fps}.mp4`;
  // 发布成网页时，保存要走平台的下载接口；本地打开时 window.claude 不存在，直接下载
  const hostDownloads = window.claude ? window.claude.use('downloads') : Promise.resolve(null);
  const saveBlob = async (blob, name, dir) => {
    const host = await hostDownloads;
    if (host) {
      await host.save({filename: name, data: blob});
      return;
    }
    if (dir) {
      const h = await dir.getFileHandle(name, {create: true});
      const w = await h.createWritable();
      await w.write(blob);
      await w.close();
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  };
  const exportRow = async (row) => {
    const size = $('xSize').value;
    const fps = +$('xFps').value;
    const ctl = new AbortController();
    S.exporting = ctl;
    $('xGo').disabled = true;
    $('xCancel').style.display = '';
    $('xCancel').onclick = () => ctl.abort();
    $('bar').style.display = 'block';
    $('result').className = '';
    const wasPlaying = S.playing;
    S.playing = false;
    try {
      $('result').textContent = '准备中…';
      await fontsReady;
      const raw = rawOf(row);
      const out = await D.exportMP4(raw, {size, fps, signal: ctl.signal, onProgress: (p, sec) => {
        $('bar').firstElementChild.style.width = `${p * 100}%`;
        $('result').textContent = `正在输出 ${Math.round(p * 100)}%，已用 ${sec.toFixed(0)} 秒`;
      }});
      await saveBlob(out.blob, fileName(row, size, fps));
      const info = `${out.width}×${out.height}，${out.duration.toFixed(1)} 秒，${(out.blob.size / 1e6).toFixed(1)} MB`;
      // 核对不影响保存：页面环境读不回视频时，只说没核对
      try {
        const check = await D.verifyMP4(out.blob, raw);
        const details = check.rows.map((r) => `${r.title}：亮 ${r.got.primary + r.got.secondary} 个`).join('；');
        $('result').className = check.ok ? 'ok' : 'bad';
        $('result').textContent = `${check.ok ? '已输出，核对通过' : '已输出，但核对没过'}。${info}。${details}`;
      } catch (err) {
        $('result').className = 'ok';
        $('result').textContent = `已输出，这个环境没法读回视频核对。${info}`;
      }
      store.set('dm_last_tpl', row.tpl);
    } catch (e) {
      $('result').className = 'bad';
      $('result').textContent = e.name === 'AbortError' ? '已取消' : e.code === 'declined' ? '没有保存：你在确认框里取消了' : `没输出成功：${e.message}`;
    }
    S.exporting = null;
    S.playing = wasPlaying;
    $('xGo').disabled = false;
    $('xCancel').style.display = 'none';
    $('bar').style.display = 'none';
  };

  const openOverlay = (html) => {
    $('obox').innerHTML = html;
    $('overlay').style.display = 'grid';
  };
  const closeOverlay = () => ($('overlay').style.display = 'none');

  // ---------- 批量输出 ----------
  let batchDir = null;
  const canPickFolder = !!window.showDirectoryPicker && !window.claude;
  const openBatch = (preset) => {
    const chapters = [...new Set(rows.map((r) => r.ch))];
    const filtered = S.filter !== 'all' || S.query.trim();
    const options = [];
    if (S.picked.size) options.push(['picked', `勾选的 ${S.picked.size} 镜`]);
    if (filtered) options.push(['filter', '当前筛选结果']);
    options.push(['all', '全片']);
    chapters.forEach((c) => options.push([`ch:${c}`, c]));
    openOverlay(`<h3 style="margin:0 0 12px;font-weight:500">批量输出</h3>
      <div id="bForm">
        <div class="field"><label>范围</label><select id="bScope">${options.map(([k, n]) => `<option value="${esc(k)}" ${k === preset ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
        <div class="two"><div class="field"><label>尺寸</label><select id="bSize"><option value="4k">4K</option><option value="1080p">1080p</option></select></div><div class="field"><label>帧率</label><select id="bFps"><option value="60">60 帧</option><option value="30">30 帧</option></select></div></div>
        <label style="display:flex;gap:8px;align-items:center;margin:2px 0 10px;color:var(--mute);font-size:13px"><input id="bSkip" type="checkbox" checked style="width:auto">文件夹里已有的不重复输出（中断后接着出）</label>
        <p id="bPlan" style="color:var(--ink);font-size:13px;margin:0 0 6px"></p>
        <p style="color:var(--mute);font-size:13px;margin:0 0 12px">${canPickFolder ? '选一次文件夹，之后自动存，不用逐个确认。会同时写一份输出清单。输出时可以切到别的标签页，别关掉这一页。' : '这个环境不能选文件夹，每个文件要单独保存。请用 Chrome 或 Edge 打开服务器版。'}</p>
      </div>
      <div id="bBar" style="height:6px;background:#242428;border-radius:3px;overflow:hidden;display:none;margin-bottom:8px"><i style="display:block;height:100%;background:var(--hi);width:0"></i></div>
      <div id="bNow" style="font-size:13px;margin-bottom:6px"></div>
      <div id="bLog" style="font-size:12px;color:var(--mute);max-height:190px;overflow:auto;line-height:1.7"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button id="bClose">关闭</button><button id="bRetry" style="display:none">重试没出成的</button><button id="bGo" class="primary">${canPickFolder ? '选文件夹并开始' : '开始'}</button></div>`);
    const listOf = () => {
      const scope = $('bScope').value;
      let pool = rows;
      if (scope === 'picked') pool = rows.filter((r) => S.picked.has(r.id));
      else if (scope === 'filter') pool = rows.filter(matches);
      else if (scope.startsWith('ch:')) pool = rows.filter((r) => r.ch === scope.slice(3));
      const motion = pool.filter(outputable);
      const ok = [];
      const bad = [];
      motion.forEach((r) => {
        const v = D.TEMPLATES[r.tpl].custom ? {errors: []} : D.validate(rawOf(r));
        (v.errors.length ? bad : ok).push(r);
      });
      return {ok, bad, skipped: pool.length - motion.length};
    };
    const plan = () => {
      const {ok, bad, skipped} = listOf();
      const sec = ok.reduce((a, r) => a + secondsOf(r), 0);
      const speed = ($('bSize').value === '4k' ? 0.7 : 0.3) * (+$('bFps').value === 60 ? 1 : 0.55);
      $('bPlan').textContent = `将输出 ${ok.length} 镜，成片约 ${fmt(sec)}，大约要 ${Math.max(1, Math.ceil((sec * speed) / 60))} 分钟。${skipped ? `样例数据 ${skipped} 镜不输出。` : ''}${bad.length ? `缺数据 ${bad.length} 镜跳过（${bad.map((r) => r.no).join('、')}）。` : ''}`;
      $('bGo').disabled = !ok.length;
    };
    ['bScope', 'bSize', 'bFps'].forEach((id) => ($(id).onchange = plan));
    plan();
    let last = [];
    const start = async (list) => {
      const size = $('bSize').value;
      const fps = +$('bFps').value;
      const skip = $('bSkip').checked;
      if (canPickFolder) {
        try {
          batchDir = await window.showDirectoryPicker({id: 'dm-batch', mode: 'readwrite'});
        } catch (e) {
          if (e.name === 'AbortError') return;
          batchDir = null;
        }
      }
      $('bForm').style.display = 'none';
      $('bGo').style.display = 'none';
      $('bRetry').style.display = 'none';
      $('bBar').style.display = 'block';
      last = await runBatch(list, {size, fps, skip, dir: batchDir});
      const fails = last.filter((x) => x.status === '失败');
      if (fails.length) {
        $('bRetry').style.display = '';
        $('bRetry').onclick = () => start(fails.map((x) => x.row));
      }
    };
    $('bGo').onclick = () => start(listOf().ok);
    $('bClose').onclick = () => {
      if (S.exporting) {
        S.exporting.abort();
        return;
      }
      closeOverlay();
    };
  };
  $('btnBatch').onclick = () => openBatch(S.picked.size ? 'picked' : 'all');

  const runBatch = async (list, {size, fps, skip, dir}) => {
    const ctl = new AbortController();
    S.exporting = ctl;
    S.playing = false;
    $('bClose').textContent = '停止';
    let lock = null;
    try {
      lock = navigator.wakeLock ? await navigator.wakeLock.request('screen') : null;
    } catch (e) {
      lock = null;
    }
    const guard = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    addEventListener('beforeunload', guard);
    const log = (text, cls) => {
      const d = document.createElement('div');
      d.textContent = text;
      if (cls) d.className = cls;
      $('bLog').prepend(d);
    };
    $('bNow').textContent = '正在准备字体…';
    await fontsReady;
    const results = [];
    const totalSec = list.reduce((a, r) => a + secondsOf(r), 0) || 1;
    let doneSec = 0;
    const t0 = performance.now();
    for (let i = 0; i < list.length; i++) {
      if (ctl.signal.aborted) break;
      const r = list[i];
      const name = fileName(r, size, fps);
      const tick = (p) => {
        const frac = (doneSec + p * secondsOf(r)) / totalSec;
        $('bBar').firstElementChild.style.width = `${frac * 100}%`;
        const used = (performance.now() - t0) / 1000;
        const left = frac > 0.02 ? (used / frac) * (1 - frac) : 0;
        $('bNow').textContent = `第 ${i + 1}/${list.length} 镜：镜${r.no} ${D.TEMPLATES[r.tpl].name}${left ? `，还要约 ${Math.ceil(left / 60)} 分钟` : ''}`;
      };
      tick(0);
      if (dir && skip) {
        try {
          const f = await (await dir.getFileHandle(name)).getFile();
          if (f.size > 1000) {
            results.push({row: r, name, status: '已有', size: f.size});
            log(`镜${r.no} 文件夹里已有，跳过`);
            doneSec += secondsOf(r);
            continue;
          }
        } catch (e) {
          /* 没有这个文件，正常输出 */
        }
      }
      try {
        const raw = rawOf(r);
        const out = await D.exportMP4(raw, {size, fps, signal: ctl.signal, onProgress: tick});
        await saveBlob(out.blob, name, dir);
        let check = '只核时长';
        try {
          const c = await D.verifyMP4(out.blob, raw);
          check = !c.ok ? '核对没过' : c.rows.length ? '数据核对通过' : '时长核对通过';
        } catch (e) {
          check = '没能核对';
        }
        results.push({row: r, name, status: '完成', size: out.blob.size, duration: out.duration, check});
        log(`镜${r.no} ${name}，${(out.blob.size / 1e6).toFixed(1)} MB，${check}`, check === '核对没过' ? 'warn' : '');
      } catch (e) {
        if (e.name === 'AbortError') break;
        results.push({row: r, name, status: '失败', error: e.message});
        log(`镜${r.no} 没出成：${e.message}`, 'warn');
      }
      doneSec += secondsOf(r);
    }
    if (dir && results.length) {
      const q = (x) => `"${String(x == null ? '' : x).replace(/"/g, '""')}"`;
      const csv = ['\ufeff镜号,章节,动效,文件,状态,大小MB,时长秒,核对,口播文案'].concat(results.map((x) => [x.row.no, x.row.ch, D.TEMPLATES[x.row.tpl].name, x.name, x.status, x.size ? (x.size / 1e6).toFixed(1) : '', x.duration ? x.duration.toFixed(1) : '', x.check || x.error || '', x.row.line].map(q).join(',')));
      try {
        await saveBlob(new Blob([csv.join('\n')], {type: 'text/csv'}), '输出清单.csv', dir);
      } catch (e) {
        log('清单没写成', 'warn');
      }
    }
    removeEventListener('beforeunload', guard);
    if (lock) lock.release().catch(() => {});
    S.exporting = null;
    S.playing = true;
    $('bClose').textContent = '关闭';
    const done = results.filter((x) => x.status === '完成').length;
    const had = results.filter((x) => x.status === '已有').length;
    const fail = results.filter((x) => x.status === '失败').length;
    const bad = results.filter((x) => x.check === '核对没过').length;
    $('bBar').firstElementChild.style.width = ctl.signal.aborted ? $('bBar').firstElementChild.style.width : '100%';
    $('bNow').textContent = `${ctl.signal.aborted ? '已停止。' : '完成。'}输出 ${done} 镜${had ? `，跳过已有 ${had} 镜` : ''}${fail ? `，失败 ${fail} 镜` : ''}${bad ? `，核对没过 ${bad} 镜` : ''}，用时 ${fmt((performance.now() - t0) / 1000)}。`;
    return results;
  };

  $('btnCsv').onclick = () => {
    const head = ['镜号', '章节', '类别', '口播文案', '画面', '动效', '时长(秒)', '要确认'];
    const q = (s) => `"${String(s == null ? '' : s).replace(/"/g, '""')}"`;
    const body = rows.map((r) => [r.no, r.ch, r.cat, r.line, r.visual, nameOf(r), secondsOf(r).toFixed(1), r.note].map(q).join(','));
    saveBlob(new Blob(['﻿' + [head.map(q).join(','), ...body].join('\n')], {type: 'text/csv'}), '全片动效分镜表.csv');
  };

  // ---------- 字体 ----------
  const SLOTS = [
    ['cn', '中文字体', '标题、说明、问题和字幕', '100 位朋友每周喝一杯咖啡', 'DMGothic,sans-serif', 'ChillDIN 寒蝉德黑体'],
    ['num', '数字字体', '大数字和刻度', '0123456789 66.5%', 'DMNumBold,sans-serif', 'ChillDIN 窄粗'],
    ['title', '诗句字体', '序和章节的诗句卡', '不识庐山真面目，只缘身在此山中', 'DMTitle,"Songti SC",serif', '系统宋体'],
  ];
  const refreshAfterFont = () => {
    buildScene(false);
    strips.clear();
    renderTimeline();
  };
  const applyFont = async (slot, id, persist = true) => {
    await D.setFont(slot, id ? await lib.load(id) : null);
    if (id) assign[slot] = id;
    else delete assign[slot];
    if (persist) {
      if (API) {
        const res = await fetch(`${API}/assign`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({board: boardName, slot, font: id || null})});
        if (!res.ok) throw new Error('字体选择没存上服务器');
      } else store.set('dm_font_assign', assign);
    }
    refreshAfterFont();
  };
  const openFonts = async () => {
    openOverlay(`<div id="fontBox" style="font-size:13px;color:var(--mute)">正在读取字体库…</div>`);
    const render = async (msg = '') => {
      let list = [];
      try {
        list = await lib.list();
      } catch (e) {
        msg = `字体库读不了：${e.message}`;
      }
      $('fontBox').innerHTML = `
        <h3 style="margin:0 0 4px;font-weight:500;font-size:16px;color:var(--ink)">字体</h3>
        <p style="margin:0 0 12px">换字体后，全片所有模板和导出的视频一起变。${API ? '字体库和选择全组共用。' : '字体存在这台电脑的浏览器里。'}</p>
        ${SLOTS.map(([k, n, d, sample, css, def]) => `<div class="field" style="background:var(--panel2);padding:10px;border-radius:8px">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:6px"><span style="color:var(--ink)">${n}<span style="color:var(--dim);font-size:12px;margin-left:8px">${d}</span></span></div>
          <div style="font-family:${esc(css)};font-size:24px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:8px">${esc(sample)}</div>
          <select data-slot="${k}"><option value="">默认：${esc(def)}</option>${list.map((f) => `<option value="${f.id}" ${assign[k] === f.id ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select>
        </div>`).join('')}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 8px">
          <button id="fUpload" class="primary">上传字体文件</button>
          ${window.queryLocalFonts ? '<button id="fLocal">从这台电脑已装的字体里选</button>' : ''}
          <button id="fClose" style="margin-left:auto">关闭</button>
        </div>
        <p id="fMsg" class="warn" style="margin:4px 0 0;min-height:1.4em">${esc(msg)}</p>
        <div id="fPicker"></div>
        ${list.length ? `<details style="margin-top:6px"><summary style="cursor:pointer">字体库里的 ${list.length} 款字体</summary>${list.map((f) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--line)"><span>${esc(f.name)} <span style="color:var(--dim)">${(f.size / 1e6).toFixed(1)} MB</span></span><button data-del-font="${f.id}" ${Object.values(assign).includes(f.id) ? 'disabled title="正在使用"' : ''}>删除</button></div>`).join('')}</details>` : ''}
        <p style="margin:10px 0 0;font-size:12px;color:var(--dim)">支持 ttf、otf、woff、woff2；ttc 合集不支持。商用字体请确认授权。</p>`;
      $('fClose').onclick = closeOverlay;
      $('fUpload').onclick = () => $('fontFile').click();
      if ($('fLocal')) $('fLocal').onclick = pickLocal;
      document.querySelectorAll('[data-slot]').forEach((el) => {
        el.onchange = async () => {
          $('fMsg').textContent = '正在载入字体…';
          try {
            await applyFont(el.dataset.slot, el.value || null);
            await render();
          } catch (e) {
            await render(`没换成：${e.message}`);
          }
        };
      });
      document.querySelectorAll('[data-del-font]').forEach((el) => {
        el.onclick = async () => {
          try {
            await lib.remove(el.dataset.delFont);
            await render();
          } catch (e) {
            await render(`没删掉：${e.message}`);
          }
        };
      });
    };
    S.renderFonts = render;
    const pickLocal = async () => {
      try {
        const all = await window.queryLocalFonts();
        const box = $('fPicker');
        box.innerHTML = `<input id="fFind" type="text" placeholder="搜字体名，比如 瘦金" style="margin:6px 0"><div id="fFound" style="max-height:170px;overflow:auto"></div>`;
        const show = (q) => {
          const hit = all.filter((f) => !q || f.fullName.toLowerCase().includes(q.toLowerCase()) || f.family.toLowerCase().includes(q.toLowerCase())).slice(0, 60);
          $('fFound').innerHTML = hit.length ? hit.map((f) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0"><span style="color:var(--ink)">${esc(f.fullName)}</span><button data-add-local="${esc(f.postscriptName)}">加入字体库</button></div>`).join('') : '没有找到';
          $('fFound').querySelectorAll('[data-add-local]').forEach((b) => (b.onclick = async () => {
            const f = all.find((x) => x.postscriptName === b.dataset.addLocal);
            b.disabled = true;
            b.textContent = '加入中…';
            try {
              await lib.add(f.fullName, await (await f.blob()).arrayBuffer());
              await render('已加入字体库，在上面的下拉框里选它');
            } catch (e) {
              await render(e.message);
            }
          }));
        };
        $('fFind').oninput = (e) => show(e.target.value);
        show('');
      } catch (e) {
        $('fMsg').textContent = '浏览器没有拿到读取字体的权限，可以改用上传字体文件';
      }
    };
    await render();
  };
  $('btnFont').onclick = openFonts;
  $('fontFile').onchange = async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    let msg = '';
    for (const f of files) {
      try {
        await lib.add(f.name.replace(/\.(ttf|otf|woff2?|ttc)$/i, ''), await f.arrayBuffer());
        msg = '已加入字体库，在上面的下拉框里选它';
      } catch (err) {
        msg = `${f.name}：${err.message}`;
      }
    }
    if (S.renderFonts) await S.renderFonts(msg);
  };

  // ---------- 工程文件（单文件版用来互传；服务器版全组共用，不需要） ----------
  if (API) $('btnProject').style.display = 'none';
  $('btnProject').onclick = () => {
    openOverlay(`<h3 style="margin:0 0 10px;font-weight:500">工程文件</h3>
      <p style="color:var(--mute);font-size:13px;margin:0 0 12px">你在这里做的切换和修改保存在这台电脑的浏览器里。要发给别人，导出工程文件，对方在工具里导入。</p>
      <div style="display:flex;gap:8px;justify-content:flex-end"><button id="pImport">导入</button><button id="pExport" class="primary">导出</button><button id="pClose">关闭</button></div>`);
    $('pClose').onclick = closeOverlay;
    $('pExport').onclick = () => saveBlob(new Blob([JSON.stringify({edits, extra: rows.filter((r) => r.added)}, null, 1)], {type: 'application/json'}), '动效分镜工程.json');
    $('pImport').onclick = () => $('projFile').click();
  };
  $('projFile').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const data = JSON.parse(await f.text());
    store.set('dm_edits_v2', data.edits || {});
    store.set('dm_extra_v2', data.extra || []);
    location.reload();
  };

  // ---------- 全组共用：定时取同事的修改 ----------
  const applyRemote = async (st) => {
    const changed = [];
    rows.forEach((r) => {
      const base = original.find((o) => o.id === r.id);
      if (!base || sync.pending.has(r.id)) return;
      const remote = (st.edits || {})[r.id] || null;
      if (JSON.stringify(remote) === JSON.stringify(edits[r.id] || null)) return;
      Object.keys(r).forEach((k) => delete r[k]);
      Object.assign(r, JSON.parse(JSON.stringify(base)));
      if (remote) {
        applyDiff(r, remote);
        edits[r.id] = remote;
      } else delete edits[r.id];
      normalize(r);
      remember(r);
      changed.push(r);
    });
    Object.values(st.extra || {}).forEach((x) => {
      if (rows.some((r) => r.id === x.id)) return;
      rows.push(x);
      normalize(x);
      remember(x);
      changed.push(x);
    });
    const fonts = st.fonts || {};
    for (const [slot] of SLOTS) {
      if ((fonts[slot] || null) !== (assign[slot] || null)) {
        try {
          await applyFont(slot, fonts[slot] || null, false);
          setSync('同事换了字体', 'okText');
        } catch (e) {
          setSync('同事换的字体载入不了', 'warn');
        }
      }
    }
    sync.rev = st.rev;
    if (!changed.length) return;
    const editing = document.activeElement && $('shot').contains(document.activeElement);
    renderAll();
    const selId = rows[S.sel] && rows[S.sel].id;
    if (changed.some((r) => r.id === selId) && !editing) select(S.sel);
    setSync(`同事改了 ${changed.length} 镜：${changed.slice(0, 4).map((r) => r.no).join('、')}`, 'okText');
  };
  const poll = async () => {
    if (!API || S.exporting || document.querySelector('#overlay').style.display === 'grid' || !$('picker').hidden) return;
    if (sync.pending.size) await flushEdits();
    if (sync.pending.size) return;
    try {
      const res = await fetch(`${API}/state?board=${encodeURIComponent(boardName)}&since=${sync.rev}`);
      if (!res.ok) throw new Error(String(res.status));
      const st = await res.json();
      sync.online = true;
      if (!st.same) await applyRemote(st);
      else if ($('sync').className === 'warn') setSync('已同步', 'okText');
    } catch (e) {
      sync.online = false;
      setSync('连不上服务器，修改会在恢复后补存', 'warn');
    }
  };
  if (API) {
    setSync(sync.online ? '已同步' : '连不上服务器，修改会在恢复后补存', sync.online ? 'okText' : 'warn');
    setInterval(poll, 15000);
    addEventListener('focus', poll);
    addEventListener('beforeunload', () => {
      if (sync.pending.size) flushEdits();
    });
  }

  // ---------- 换效果：左边分类，上面预览，下面缩略图 ----------
  // 指到哪个就用这一镜自己的字演哪个，点一下换到画面上，弹窗不关，可以一个个试
  const SUGGESTED = 'suggested';
  const pk = {cat: SUGGESTED, query: '', hovered: null, scene: null, start: 0, raf: 0, id: null, timer: 0};
  const thumbs = new Map();
  const pkCtx = $('pkCanvas').getContext('2d', {alpha: false});
  const previousDataTpl = () => {
    for (let i = S.sel - 1; i >= 0; i--) if (rows[i].groups) return rows[i].tpl;
    return null;
  };
  const pkItems = () => {
    const all = D.catalog();
    const q = pk.query.trim();
    if (q) return all.filter((m) => m.name.includes(q) || (m.en || '').toLowerCase().includes(q.toLowerCase()) || (m.desc || '').includes(q) || (m.keywords || []).some((k) => k.includes(q)));
    if (pk.cat === SUGGESTED) {
      const top = D.rankTemplates(rows[S.sel], previousDataTpl()).slice(0, 9).map((t) => t.id);
      return top.map((id) => all.find((m) => m.id === id)).filter(Boolean);
    }
    return all.filter((m) => m.category === pk.cat);
  };
  const renderPkCats = () => {
    $('pkCats').innerHTML = [[SUGGESTED, '适合']].concat(D.CATEGORIES.map((c) => [c.id, c.name])).map(([id, n]) => `<button data-c="${id}" class="${pk.cat === id && !pk.query ? 'on' : ''}">${esc(n)}</button>`).join('');
    $('pkCats').querySelectorAll('button').forEach((b) => (b.onclick = () => {
      pk.cat = b.dataset.c;
      pk.query = '';
      $('pkFind').value = '';
      renderPkCats();
      renderPkGrid();
    }));
  };
  const paintThumb = (canvas, id) => {
    const c = canvas.getContext('2d', {alpha: false});
    const done = thumbs.get(id);
    if (done) {
      c.drawImage(done, 0, 0);
      return;
    }
    const raw = Object.assign({line: ''}, D.sampleOf(id), {template: id, tpl: id});
    try {
      const scene = D.createScene(raw, canvas.width);
      scene.draw(c, D.thumbTime(id, scene));
      const copy = document.createElement('canvas');
      copy.width = canvas.width;
      copy.height = canvas.height;
      copy.getContext('2d').drawImage(canvas, 0, 0);
      thumbs.set(id, copy);
    } catch (e) {
      c.fillStyle = '#000';
      c.fillRect(0, 0, canvas.width, canvas.height);
    }
  };
  let tileWatch = null;
  const renderPkGrid = () => {
    const row = rows[S.sel];
    const items = pkItems();
    const grid = $('pkGrid');
    grid.scrollTop = 0;
    grid.innerHTML = items.map((m) => `<button class="tile ${m.id === row.tpl ? 'on' : ''}" data-t="${m.id}" aria-label="${esc(m.name)}" title="${esc(m.desc)}"><canvas width="320" height="180"></canvas><span>${esc(m.name)}</span></button>`).join('');
    if (tileWatch) tileWatch.disconnect();
    tileWatch = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        tileWatch.unobserve(en.target);
        paintThumb(en.target.querySelector('canvas'), en.target.dataset.t);
      });
    }, {root: grid, rootMargin: '120px'});
    grid.querySelectorAll('.tile').forEach((tile) => {
      tileWatch.observe(tile);
      tile.onmouseenter = () => previewEffect(tile.dataset.t);
      tile.onfocus = () => previewEffect(tile.dataset.t);
      tile.onclick = () => applyEffect(tile.dataset.t);
    });
  };
  const previewEffect = (id) => {
    if (pk.id === id) return;
    pk.id = id;
    clearTimeout(pk.timer);
    // 鼠标扫过一排时不用每个都建
    pk.timer = setTimeout(() => {
      const row = rows[S.sel];
      const adopted = D.adopt(JSON.parse(JSON.stringify(row)), id);
      const tpl = D.TEMPLATES[id];
      let scene = null;
      try {
        scene = D.createScene(Object.assign({}, adopted, {template: id, tpl: id}), 480);
      } catch (e) {
        scene = null;
      }
      pk.scene = scene;
      pk.start = performance.now();
      $('pkInfo').innerHTML = `<b>${esc(tpl ? tpl.name : '')}</b><p>${esc(tpl ? tpl.desc || '' : '')}</p>${adopted.sampleData ? '<small>样例数据</small>' : ''}`;
    }, 80);
  };
  const pkLoop = (now) => {
    if ($('picker').hidden) return;
    if (pk.scene) {
      const span = pk.scene.duration + 0.6;
      const t = ((now - pk.start) / 1000) % span;
      try {
        pk.scene.draw(pkCtx, Math.min(t, pk.scene.duration));
      } catch (e) {
        pk.scene = null;
      }
    } else {
      pkCtx.fillStyle = '#000';
      pkCtx.fillRect(0, 0, 480, 270);
    }
    pk.raf = requestAnimationFrame(pkLoop);
  };
  const applyEffect = (id) => {
    const row = rows[S.sel];
    const next = D.adopt(JSON.parse(JSON.stringify(row)), id);
    Object.keys(row).forEach((k) => delete row[k]);
    Object.assign(row, next);
    saveRow(row);
    $('motionName').textContent = nameOf(row);
    $('pkGrid').querySelectorAll('.tile').forEach((t) => t.classList.toggle('on', t.dataset.t === id));
    buildScene(true);
    renderShot();
    refreshClip(S.sel);
    renderTable();
  };
  const openPicker = () => {
    pk.cat = SUGGESTED;
    pk.query = '';
    pk.id = null;
    $('pkFind').value = '';
    $('picker').hidden = false;
    renderPkCats();
    renderPkGrid();
    previewEffect(rows[S.sel].tpl);
    cancelAnimationFrame(pk.raf);
    pk.raf = requestAnimationFrame(pkLoop);
    $('pkFind').focus();
  };
  const closePicker = () => {
    $('picker').hidden = true;
    cancelAnimationFrame(pk.raf);
    pk.scene = null;
    pk.id = null;
  };
  $('btnMotion').onclick = openPicker;
  $('pkClose').onclick = closePicker;
  $('picker').addEventListener('click', (e) => {
    if (e.target === $('picker')) closePicker();
  });
  $('pkFind').oninput = (e) => {
    pk.query = e.target.value;
    renderPkCats();
    renderPkGrid();
  };

  // ---------- 贴文案 ----------
  const renderPaste = () => {
    $('p-script').innerHTML = `
      <div class="block"><textarea id="pText" rows="10" aria-label="文案" placeholder="贴一段口播文案"></textarea>
        <div style="margin-top:8px;display:flex;justify-content:flex-end"><button id="pGo" class="primary">拆解并匹配</button></div>
      </div>
      <div id="pOut"></div>`;
    $('pGo').onclick = () => {
      const text = $('pText').value.trim();
      if (!text) return;
      const parsed = P.parseCopy(text);
      if (!parsed.count) {
        const lines = [text.replace(/[。！？!?；;，,：:\s]+$/, '')];
        $('pOut').innerHTML = `<div class="block"><h3>没有百分比，按文字镜加进去</h3><div class="rec"><button class="on" id="pAddState"><b>重音字幕</b><small>念到哪字出到哪</small></button><button id="pAddQ"><b>问题卡</b><small>问题打出来</small></button></div></div>`;
        $('pAddState').onclick = () => addRow({line: text, cat: '文字动效', visual: '', tpl: 'statement', lines});
        $('pAddQ').onclick = () => addRow({line: text, cat: '文字动效', visual: '', tpl: 'question', lines: [text]});
        return;
      }
      const row = {line: text, groups: parsed.groups, tpl: 'comb'};
      const ranked = D.rankTemplates(row, store.get('dm_last_tpl', null));
      row.tpl = ranked[0].id;
      $('pOut').innerHTML = `<div class="block"><h3>拆出来的数据</h3>
        ${parsed.groups.map((g) => `<p style="margin:0 0 6px"><b>${esc(g.title || '（无标题）')}</b> <span style="color:var(--mute)">${REL[g.relation]}</span><br>${g.metrics.map((m) => `${esc(m.prefix || '')}${m.value}%：${esc(m.caption)}`).join('<br>')}</p>`).join('')}
        ${parsed.explain.length ? `<p class="note">${parsed.explain.map(esc).join('<br>')}</p>` : ''}</div>
        <div class="block"><h3>点一个加进分镜</h3><div class="rec">${ranked.slice(0, 6).map((t, i) => `<button class="${i === 0 ? 'on' : ''}" data-add="${t.id}"><b>${esc(t.name)}</b><small>${esc(t.why)}</small></button>`).join('')}</div></div>`;
      document.querySelectorAll('[data-add]').forEach((b) => (b.onclick = () => addRow({line: text, cat: '数据动效', visual: '', tpl: b.dataset.add, groups: parsed.groups})));
    };
  };
  const addRow = (o) => {
    // 多人同时加镜头时编号不撞
    const id = Date.now();
    const row = Object.assign({ch: '新增', kind: 'B', added: true, id, no: `新${rows.filter((r) => r.added).length + 1}`}, o);
    rows.push(row);
    remember(row);
    saveRow(row);
    renderAll();
    setPage('stage');
    select(rows.length - 1);
  };

  // ---------- 三页、控制键 ----------
  const setPage = (p) => {
    S.page = p;
    document.querySelectorAll('.seg button').forEach((b) => {
      b.classList.toggle('on', b.dataset.p === p);
      b.setAttribute('aria-selected', String(b.dataset.p === p));
    });
    document.querySelectorAll('.page').forEach((x) => x.classList.toggle('on', x.id === `p-${p}`));
    if (p === 'script' && !$('pText')) renderPaste();
    syncInspector();
    if (p === 'stage') {
      lastDraw = -1;
      revealClip(S.sel, false);
    }
  };
  document.querySelectorAll('.seg button').forEach((b) => (b.onclick = () => setPage(b.dataset.p)));
  const inspectorOpen = () => rawStore.get('dm_inspector', false);
  const syncInspector = () => {
    const open = inspectorOpen() && S.page !== 'script';
    $('inspector').hidden = !open;
    $('btnInspector').classList.toggle('on', open);
    $('btnInspector').disabled = S.page === 'script';
  };
  $('btnInspector').onclick = () => {
    rawStore.set('dm_inspector', !inspectorOpen());
    syncInspector();
  };
  const renderAll = () => {
    renderFilter();
    renderTimeline();
    renderTable();
    $('motionName').textContent = nameOf(rows[S.sel]);
  };
  // 撤销和重做：一步一镜
  const restore = (from, to) => {
    const step = from.pop();
    if (!step) return;
    const row = rows.find((r) => r.id === step.id);
    if (!row) return;
    to.push({id: row.id, json: JSON.stringify(row)});
    Object.keys(row).forEach((k) => delete row[k]);
    Object.assign(row, JSON.parse(step.json));
    remember(row);
    history.last = null;
    saveRow(row);
    const i = rows.indexOf(row);
    const sameMotion = i === S.sel && editor.tpl === row.tpl;
    renderFilter();
    refreshClip(i);
    renderTable();
    if (i === S.sel) {
      $('motionName').textContent = nameOf(row);
      buildScene(false, sameMotion);
      renderShot();
    } else select(i);
  };
  const undoStep = () => restore(history.undo, history.redo);
  const redoStep = () => restore(history.redo, history.undo);
  $('kUndo').onclick = undoStep;
  $('kRedo').onclick = redoStep;
  const go = (dir) => {
    const list = rows.map((r, i) => [r, i]).filter(([r]) => matches(r)).map(([, i]) => i);
    const at = list.indexOf(S.sel);
    const next = list[at + dir];
    if (next != null) select(next);
  };
  $('kPrev').onclick = () => go(-1);
  $('kNext').onclick = () => go(1);
  $('kStart').onclick = () => {
    S.t = 0;
    lastDraw = -1;
  };
  $('kEnd').onclick = () => {
    if (S.scene) S.t = Math.max(0, S.scene.duration - 0.05);
    setPlaying(false);
    lastDraw = -1;
  };
  $('kLoop').onclick = () => {
    S.loop = !S.loop;
    $('kLoop').classList.toggle('on', S.loop);
    $('kLoop').setAttribute('aria-pressed', String(S.loop));
  };
  $('kFull').onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  };
  $('play').onclick = () => setPlaying(!S.playing);
  $('seek').oninput = (e) => {
    if (!S.scene) return;
    S.t = +e.target.value * S.scene.duration;
    setPlaying(false);
  };
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('picker').hidden) {
      closePicker();
      return;
    }
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) redoStep();
      else undoStep();
      return;
    }
    if (e.metaKey || e.ctrlKey) {
      if (e.code === 'Digit1') setPage('script');
      else if (e.code === 'Digit2') setPage('stage');
      else if (e.code === 'Digit3') setPage('table');
      else return;
      e.preventDefault();
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      setPlaying(!S.playing);
    }
    if ((e.code === 'ArrowDown' || e.code === 'ArrowUp') && !(editor.sel && editor.sel.length)) {
      e.preventDefault();
      go(e.code === 'ArrowDown' ? 1 : -1);
    }
  });
  let lastNow = performance.now();
  let lastDraw = -1;
  const tick = (now) => {
    const dt = Math.min(0.1, (now - lastNow) / 1000);
    lastNow = now;
    if (S.scene && !S.exporting && S.page === 'stage') {
      if (S.playing) {
        S.t += dt;
        if (playUntil != null && S.t >= playUntil) {
          playUntil = null;
          setPlaying(false);
        }
        if (S.t > S.scene.duration + (S.loop ? 0.5 : 0)) {
          if (S.loop) S.t = 0;
          else {
            // 关了循环就接着播下一镜，时间线上看着是一条连续的片子
            const list = rows.map((r, i) => [r, i]).filter(([r]) => matches(r)).map(([, i]) => i);
            const next = list[list.indexOf(S.sel) + 1];
            if (next != null) select(next);
            else setPlaying(false);
          }
        }
      }
      const t = Math.min(S.t, S.scene.duration);
      if (t !== lastDraw || S.playing) {
        try {
          editor.draw(ctx, t);
        } catch (err) {
          $('err').style.display = 'grid';
          $('err').textContent = `这个模板画不了这一镜：${err.message}`;
        }
        lastDraw = t;
      }
      const k = t / S.scene.duration;
      $('seek').value = k;
      const clip = playhead.parentElement;
      if (clip) {
        playhead.style.left = `${clip.offsetWidth * k}px`;
        const start = rows.slice(0, S.sel).filter(matches).reduce((a, r) => a + secondsOf(r), 0);
        playhead.firstElementChild.textContent = clock(start + S.scene.duration * k);
      }
    }
    requestAnimationFrame(tick);
  };

  if (!('VideoEncoder' in window) || !('filter' in ctx)) {
    setSync('建议用 Chrome 打开：这个浏览器不能导出视频，或辉光效果不完整', 'warn');
  }

  const boot = $('boot');
  if (boot) boot.remove();
  setPlaying(S.playing);
  renderAll();
  setPage('stage');
  select(S.sel);
  revealClip(S.sel, false);
  const slotsToLoad = Object.keys(assign);
  if (slotsToLoad.length) {
    setSync('正在载入这部片子的字体…');
    fontsReady = (async () => {
      for (const slot of slotsToLoad) {
        try {
          await D.setFont(slot, await lib.load(assign[slot]));
        } catch (e) {
          setSync('有一款字体载入不了，先用默认字体', 'warn');
        }
      }
      refreshAfterFont();
      if ($('sync').textContent.startsWith('正在载入')) setSync(API ? '已同步' : '');
    })();
  }
  requestAnimationFrame(tick);

  // 给命令行和自动化用
  window.DMApp = {rows, rawOf, ready: true, sync, assign: () => assign, api: API, poll, editor, select, setPage, openPicker, closePicker};
})();
