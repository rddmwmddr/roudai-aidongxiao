// 画面内编辑：点选任何元素，直接拖动、拉高、旋转；速度和延后在画面底部的时间条上拖。
// 网页版和 macOS App 共用。数据只有一份：row.layers[模板][元素]，见 stage.js。
(function (root) {
  'use strict';
  const D = root.DM;
  const {mul, inv} = root.DMStage;
  const W = 1920;
  const H = 1080;
  const I = [1, 0, 0, 1, 0, 0];
  const isI = (m) => !m || (Math.abs(m[0] - 1) < 1e-6 && Math.abs(m[1]) < 1e-6 && Math.abs(m[2]) < 1e-6 && Math.abs(m[3] - 1) < 1e-6 && Math.abs(m[4]) < 1e-3 && Math.abs(m[5]) < 1e-3);
  const T = (x, y) => [1, 0, 0, 1, x, y];
  const SC = (sx, sy, ax, ay) => [sx, 0, 0, sy, ax - sx * ax, ay - sy * ay];
  const RO = (r, cx, cy) => {
    const c = Math.cos(r);
    const s = Math.sin(r);
    return [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy];
  };
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const round = (x, n = 2) => Math.round(x * 10 ** n) / 10 ** n;

  // ---------- 普查：把这一镜从头到尾扫一遍，知道一共有哪些元素、什么时候出现、什么时候不再变化 ----------
  const survey = async (raw, signal) => {
    const scene = D.createScene(raw, 480);
    const cv = document.createElement('canvas');
    cv.width = 480;
    cv.height = 270;
    const ctx = cv.getContext('2d', {alpha: false});
    const reg = new Map();
    const info = new Map();
    const hz = 8;
    const steps = Math.ceil(scene.duration * hz) + 1;
    for (let i = 0; i < steps; i++) {
      if (signal && signal.aborted) return null;
      const t = Math.min(scene.duration, i / hz);
      const rec = scene.inspect(ctx, t, reg);
      const frame = new Map();
      rec.forEach((r) => {
        [r.id, r.parent].forEach((id) => {
          if (!id) return;
          let f = frame.get(id);
          if (!f) {
            f = {x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1, sig: 0};
            frame.set(id, f);
          } else {
            f.x0 = Math.min(f.x0, r.x0);
            f.y0 = Math.min(f.y0, r.y0);
            f.x1 = Math.max(f.x1, r.x1);
            f.y1 = Math.max(f.y1, r.y1);
          }
          f.sig = (Math.imul(f.sig, 31) + Math.round(r.x0 + r.y0 * 3 + r.x1 * 7 + r.y1 * 11 + r.a * 500) + r.sig) | 0;
        });
      });
      frame.forEach((f, id) => {
        let g = info.get(id);
        if (!g) {
          // 扫描是每秒 8 次，真正开始的时刻可能早一点，时间锚点往前留一格
          g = {first: Math.max(0, t - 1 / hz), last: t, sig: f.sig, x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1};
          info.set(id, g);
        } else {
          if (f.sig !== g.sig) {
            g.last = t;
            g.sig = f.sig;
          }
          g.x0 = Math.min(g.x0, f.x0);
          g.y0 = Math.min(g.y0, f.y0);
          g.x1 = Math.max(g.x1, f.x1);
          g.y1 = Math.max(g.y1, f.y1);
        }
      });
      if (i % 24 === 23) await new Promise((r) => setTimeout(r, 0));
    }
    const list = [...reg.values()].filter((e) => e.kind !== 'main').sort((a, b) => a.order - b.order).map((e) => {
      const g = info.get(e.id);
      return Object.assign({}, e, g ? {first: g.first, last: Math.max(g.last, g.first + 0.1), box: [g.x0, g.y0, g.x1, g.y1]} : {first: null, last: null, box: null});
    });
    return {elements: list, duration: scene.duration};
  };
  D.surveyElements = survey;

  // ---------- 改字：画面里看到的字都来自这一镜的数据（lines、说明、标题……），找到在哪个字段就原地换掉 ----------
  // 口播原文 line 不动；编号、备注、颜色这些不是画面上的字，不找
  const NOT_TEXT = new Set(['id', 'no', 'ch', 'kind', 'cat', 'line', 'visual', 'tpl', 'template', 'note', 'pending', 'sampleData', 'layers', 'overlayText', 'speed', 'hold', 'dur', 'theme', 'colors']);
  const textLeaves = (row) => {
    const out = [];
    const walk = (v, path) => {
      if (typeof v === 'string') out.push({path, s: v});
      else if (Array.isArray(v)) v.forEach((x, i) => walk(x, path.concat(i)));
      else if (v && typeof v === 'object') Object.keys(v).forEach((k) => walk(v[k], path.concat(k)));
    };
    Object.keys(row).forEach((k) => {
      if (!NOT_TEXT.has(k)) walk(row[k], [k]);
    });
    return out;
  };
  const getAt = (o, path) => path.reduce((v, k) => (v == null ? v : v[k]), o);
  const stringLists = (row) => {
    const out = [];
    const walk = (v, path) => {
      if (Array.isArray(v)) {
        if (v.length > 1 && v.every((x) => typeof x === 'string')) out.push({path, list: v});
        else v.forEach((x, i) => walk(x, path.concat(i)));
      } else if (v && typeof v === 'object') Object.keys(v).forEach((k) => walk(v[k], path.concat(k)));
    };
    Object.keys(row).forEach((k) => {
      if (!NOT_TEXT.has(k)) walk(row[k], [k]);
    });
    return out;
  };
  // 一段字在数据里的位置：整段相同 → 一处或几处一起换；一串字拼起来显示的 → 按行改；是某段字的一部分且只出现一次 → 只换这一部分
  const findText = (row, label, partOK) => {
    if (!label || !label.trim()) return null;
    const leaves = textLeaves(row);
    const same = leaves.filter((l) => l.s === label);
    if (same.length) return {kind: 'one', paths: same.map((l) => l.path), value: label};
    const joined = stringLists(row).find((x) => x.list.join(' ') === label || x.list.join('') === label || x.list.join('，') === label);
    if (joined) return {kind: 'list', path: joined.path, value: joined.list.slice()};
    if (!partOK || Array.from(label.trim()).length < 2) return null;
    const part = leaves.filter((l) => l.s.includes(label));
    if (part.length === 1 && part[0].s.indexOf(label) === part[0].s.lastIndexOf(label)) return {kind: 'part', paths: [part[0].path], value: label, whole: part[0].s};
    return null;
  };
  // 改好的字写回数据，只回传改到的顶层字段
  const patchText = (row, target, text) => {
    const next = JSON.parse(JSON.stringify(row));
    const setAt = (path, v) => {
      const parent = getAt(next, path.slice(0, -1));
      parent[path[path.length - 1]] = v;
    };
    if (target.kind === 'list') setAt(target.path, text);
    else if (target.kind === 'part') target.paths.forEach((p) => setAt(p, target.whole.replace(target.value, text)));
    else target.paths.forEach((p) => setAt(p, text));
    const top = target.kind === 'list' ? [target.path[0]] : [...new Set(target.paths.map((p) => p[0]))];
    const patch = {};
    top.forEach((k) => (patch[k] = next[k]));
    return patch;
  };
  D.findText = findText;
  D.patchText = patchText;

  // ---------- 样式 ----------
  const CSS = `
.dme,.dme-dock{--dme-accent:#0a84ff;--dme-hud:rgba(250,250,252,.82);--dme-ink:#1c1c1e;--dme-mute:#55555a;--dme-field:rgba(120,120,128,.14);--dme-line:rgba(60,60,67,.18);--dme-focus:#0a84ff;--dme-guide:#ff2d92;--dme-shadow:0 0 0 .5px rgba(0,0,0,.12),0 2px 6px rgba(0,0,0,.1),0 12px 32px rgba(0,0,0,.18);font:12px/1.35 -apple-system,BlinkMacSystemFont,"PingFang SC","Helvetica Neue",sans-serif;color:var(--dme-ink);user-select:none;-webkit-user-select:none}
.dme{position:absolute;inset:0;touch-action:none;outline:none;overflow:hidden;cursor:default}
@media (prefers-color-scheme:dark){.dme,.dme-dock{--dme-hud:rgba(44,44,46,.82);--dme-ink:#f5f5f7;--dme-mute:#a1a1a6;--dme-field:rgba(120,120,128,.28);--dme-line:rgba(235,235,245,.16);--dme-shadow:0 0 0 .5px rgba(255,255,255,.1),0 2px 6px rgba(0,0,0,.3),0 12px 32px rgba(0,0,0,.45)}}
@media (prefers-reduced-transparency:reduce){.dme,.dme-dock{--dme-hud:#f2f2f7}}
@media (prefers-reduced-transparency:reduce) and (prefers-color-scheme:dark){.dme,.dme-dock{--dme-hud:#2c2c2e}}
@media (prefers-contrast:more){.dme,.dme-dock{--dme-mute:currentColor;--dme-line:currentColor}}
.dme-box{position:absolute;pointer-events:none;box-sizing:border-box}
.dme-hover{outline:1px solid var(--dme-accent);outline-offset:0;box-shadow:0 0 0 1px rgba(255,255,255,.35)}
.dme-sel{outline:1.5px solid var(--dme-accent);box-shadow:0 0 0 1.5px rgba(255,255,255,.55),inset 0 0 0 .5px rgba(0,0,0,.25)}
.dme-sel.ghost{outline-style:dashed}
.dme-marquee{border:1px solid var(--dme-accent);background:color-mix(in srgb,var(--dme-accent) 16%,transparent);display:none}
.dme-part{position:absolute;pointer-events:none;box-sizing:border-box;outline:1px solid var(--dme-accent);opacity:.55}
.dme-h{position:absolute;width:24px;height:24px;margin:-12px 0 0 -12px;padding:0;border:0;background:none;pointer-events:auto;appearance:none;-webkit-appearance:none;outline:none}
.dme-h::before{content:"";position:absolute;left:8px;top:8px;width:8px;height:8px;border-radius:2px;background:#fff;box-shadow:0 0 0 1.25px var(--dme-accent),0 1px 3px rgba(0,0,0,.35)}
.dme-h[data-h=rot]::before{border-radius:50%}
.dme-h:focus-visible::before{box-shadow:0 0 0 2px var(--dme-focus),0 0 0 4px #fff}
.dme-stem{position:absolute;width:1px;background:var(--dme-accent);pointer-events:none}
.dme-guide{position:absolute;background:var(--dme-guide);pointer-events:none;display:none}
.dme-guide.x{top:0;bottom:0;width:1px}
.dme-guide.y{left:0;right:0;height:1px}
.dme-size{position:absolute;padding:1px 5px;border-radius:4px;background:var(--dme-accent);color:#fff;font-size:11px;font-variant-numeric:tabular-nums;white-space:nowrap;pointer-events:none}
.dme-panel{position:absolute;box-sizing:border-box;border:1px solid transparent;background:var(--dme-hud);-webkit-backdrop-filter:blur(28px) saturate(180%);backdrop-filter:blur(28px) saturate(180%);box-shadow:var(--dme-shadow);pointer-events:auto;cursor:default}
.dme-hud{width:252px;padding:8px;border-radius:21px}
.dme-head{display:flex;align-items:center;gap:6px;height:26px;margin:-2px 0 6px;padding:0 2px 0 4px;cursor:grab}
.dme-head:active{cursor:grabbing}
.dme-name{flex:1;min-width:0;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dme-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px}
.dme-f{display:flex;align-items:center;height:26px;border-radius:13px;background:var(--dme-field);padding:0 2px 0 7px;min-width:0}
.dme-f span{flex:none;width:40px;color:var(--dme-mute);cursor:ew-resize;line-height:26px}
.dme-f input{flex:1;min-width:0;width:100%;height:24px;border:0;background:none;color:inherit;font:inherit;font-variant-numeric:tabular-nums;text-align:right;padding:0 5px 0 0;outline:none;border-radius:5px;-webkit-user-select:text;user-select:text}
.dme-f em{flex:none;font-style:normal;color:var(--dme-mute);padding-right:5px}
.dme-f:focus-within{box-shadow:0 0 0 2px var(--dme-focus)}
.dme-f.off{opacity:.45}
.dme-row{display:flex;gap:4px;margin-top:4px}
.dme-b{flex:1;min-width:0;height:26px;border:1px solid transparent;border-radius:13px;background:var(--dme-field);color:inherit;font:inherit;padding:0 6px;white-space:nowrap;transition-property:scale,background-color;transition-duration:150ms;transition-timing-function:ease-out;outline:none;cursor:default}
.dme-b:focus-visible{box-shadow:0 0 0 2px var(--dme-focus)}
.dme-b[aria-pressed=true]{background:var(--dme-accent);color:#fff}
.dme-b:disabled{opacity:.45}
.dme-b:not(:disabled):active{scale:.96}
.dme-color{position:relative;flex:none;width:30px;height:26px;border-radius:13px;overflow:hidden;background:var(--dme-field)}
.dme-color:focus-within{box-shadow:0 0 0 2px var(--dme-focus)}
.dme-color input{position:absolute;inset:-4px;width:calc(100% + 8px);height:calc(100% + 8px);border:0;padding:0;background:none;cursor:default}
.dme-time{left:10px;right:10px;bottom:10px;height:38px;border-radius:10px;padding:4px 8px}
.dme-track{position:relative;height:30px}
.dme-rail{position:absolute;left:0;right:0;top:14px;height:2px;border-radius:1px;background:var(--dme-line)}
.dme-span{position:absolute;top:5px;height:20px;border-radius:5px;background:var(--dme-accent);color:#fff;font-size:11px;line-height:20px;text-align:center;white-space:nowrap;overflow:hidden;cursor:grab;min-width:6px;font-variant-numeric:tabular-nums}
.dme-span:active{cursor:grabbing}
.dme-span:focus-visible{box-shadow:0 0 0 2px #fff,0 0 0 4px var(--dme-focus);outline:none}
.dme-edge{position:absolute;top:-2px;bottom:-2px;width:12px;cursor:ew-resize}
.dme-edge.l{left:-4px}
.dme-edge.r{right:-4px}
.dme-play{position:absolute;top:0;bottom:0;width:1px;background:var(--dme-ink);pointer-events:none}
.dme-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
.dme-listbtn{left:10px;top:10px;height:28px;border-radius:14px;padding:0}
.dme-listbtn button{height:100%;border:0;background:none;color:inherit;font:inherit;padding:0 10px;outline:none}
.dme-listbtn button:focus-visible{box-shadow:0 0 0 2px var(--dme-focus);border-radius:14px}
.dme-list{left:10px;top:44px;width:230px;max-height:calc(100% - 110px);overflow:auto;overscroll-behavior:contain;border-radius:12px;padding:6px}
.dme-list button{display:block;width:100%;height:26px;border:0;background:none;color:inherit;font:inherit;text-align:left;padding:0 8px;border-radius:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;outline:none}
.dme-list button.kid{padding-left:22px;color:var(--dme-mute)}
.dme-list button.on{background:var(--dme-accent);color:#fff}
.dme-list button:focus-visible{box-shadow:inset 0 0 0 2px var(--dme-focus)}
.dme-text{z-index:3;display:flex;flex-direction:column;gap:4px;padding:5px;border-radius:12px}
.dme-text textarea{display:block;box-sizing:border-box;width:100%;margin:0;padding:3px 7px;border:0;border-radius:8px;background:var(--dme-field);color:inherit;font-family:DMGothic,DMGothicFull,-apple-system,"PingFang SC",sans-serif;font-weight:normal;line-height:1.3;resize:none;outline:none;overflow:hidden;-webkit-user-select:text;user-select:text;cursor:text}
.dme-text textarea:focus{box-shadow:0 0 0 2px var(--dme-focus)}
.dme-text small{padding:0 4px;color:var(--dme-mute);font-size:11px;line-height:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dme-dock{display:flex;flex-direction:column;gap:2px;touch-action:none}
.dme-dock .dme-panel{position:static;background:none;-webkit-backdrop-filter:none;backdrop-filter:none;box-shadow:none;border:0;padding:0;width:auto;border-radius:0}
.dme-dock .dme-hud{flex-wrap:wrap;align-items:center;gap:0 8px}
.dme-dock .dme-head{flex:1 1 180px;height:24px;margin:0;padding:0 4px;cursor:default}
.dme-dock .dme-head:active{cursor:default}
.dme-dock .dme-name{font-weight:500}
.dme-dock .dme-row{order:1;flex:none;align-items:center;margin:0;gap:0}
.dme-dock .dme-b{flex:none;height:24px;padding:0 8px;border-radius:6px;background:none;color:var(--dme-mute)}
.dme-dock .dme-b[aria-pressed=true]{background:none;color:var(--dme-ink)}
.dme-dock .dme-color{width:24px;height:24px;border-radius:6px;background:none}
.dme-dock .dme-color input{inset:5px;width:14px;height:14px;border-radius:50%;overflow:hidden}
.dme-dock .dme-color input::-webkit-color-swatch-wrapper{padding:0}
.dme-dock .dme-color input::-webkit-color-swatch{border:0;border-radius:50%;box-shadow:inset 0 0 0 .5px var(--dme-line)}
.dme-dock .dme-grid{order:2;flex:1 1 100%;grid-template-columns:repeat(auto-fit,minmax(84px,1fr));gap:0 4px}
.dme-dock .dme-f{height:24px;padding:0 4px;border-radius:6px;background:none}
.dme-dock .dme-f span{width:auto;margin-right:6px}
.dme-dock .dme-f input{flex:none;width:4.2ch;height:22px;padding:0;text-align:left;border-radius:0}
.dme-dock .dme-f em{padding-right:0}
.dme-dock .dme-f[data-field=sx] input,.dme-dock .dme-f[data-field=sy] input{width:6.6ch}
.dme-dock .dme-time{height:20px;left:auto;right:auto;bottom:auto}
.dme-dock .dme-track{height:20px;margin:0 4px}
.dme-dock .dme-rail{top:10px;height:1px;border-radius:0}
.dme-dock .dme-span{top:7px;height:7px;border-radius:4px;min-width:4px}
.dme-dock .dme-span::before{content:"";position:absolute;inset:-7px 0}
.dme-dock .dme-edge{top:-7px;bottom:-7px}
@media (hover:hover){.dme-list button:not(.on):hover{background:var(--dme-field)}.dme-b:not(:disabled):not([aria-pressed=true]):hover{background:var(--dme-line)}.dme-dock .dme-b:not(:disabled):hover,.dme-dock .dme-f:not(.off):hover,.dme-dock .dme-color:hover{background:var(--dme-field)}}
`;

  const HANDLES = [
    ['nw', 0, 0, '左上角'], ['n', 0.5, 0, '上边'], ['ne', 1, 0, '右上角'], ['e', 1, 0.5, '右边'],
    ['se', 1, 1, '右下角'], ['s', 0.5, 1, '下边'], ['sw', 0, 1, '左下角'], ['w', 0, 0.5, '左边'],
  ];
  const CURSOR = {nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', rot: 'grab'};
  const FIELDS = [
    {k: 'x', label: 'X', aria: '水平位置', step: 1, dec: 0},
    {k: 'y', label: 'Y', aria: '垂直位置', step: 1, dec: 0},
    {k: 'w', label: '宽', aria: '宽度', step: 1, dec: 0},
    {k: 'h', label: '高', aria: '高度', step: 1, dec: 0},
    {k: 'sx', label: '横缩放', aria: '横向缩放百分比', unit: '%', step: 1, dec: 2},
    {k: 'sy', label: '纵缩放', aria: '纵向缩放百分比', unit: '%', step: 1, dec: 2},
    {k: 'rot', label: '旋转', aria: '旋转角度', unit: '°', step: 0.5, dec: 1},
    {k: 'alpha', label: '不透明', aria: '不透明度', unit: '%', step: 1, dec: 0},
    {k: 'speed', label: '速度', aria: '速度倍数', unit: '×', step: 0.05, dec: 2},
    {k: 'delay', label: '延后', aria: '延后秒数', unit: '秒', step: 0.05, dec: 2},
  ];

  let cssAdded = false;

  class Editor {
    // opts: host, scene(), raw(), time(), seek(t), playing(), pause(), play(from, to), invalidate(), commit(layers, label), onSelect(ids), onElements(list), list(是否显示画面内的元素列表), undo(是否自带撤销)
    //       editRow(patch, label, id)：双击改字后把改到的字段交出去，不给就不能改字；onTyping(on)：正在打字，外面的快捷键先让开
    constructor(opts) {
      this.o = opts;
      if (!cssAdded) {
        const st = document.createElement('style');
        st.textContent = CSS;
        document.head.appendChild(st);
        cssAdded = true;
      }
      this.layers = {};
      this.sel = [];
      this.hover = null;
      this.scope = null;
      this.rec = [];
      this.reg = new Map();
      this.info = new Map();
      this.elements = [];
      this.hudPos = null;
      this.undoStack = [];
      this.redoStack = [];
      this._build();
      new ResizeObserver(() => this.render()).observe(opts.host);
    }

    // ---------- 外部接口 ----------
    bind(raw, keepSelection = false) {
      const previous = keepSelection ? {ids: this.sel.slice(), scope: this.scope} : null;
      // 换了一镜或者这一镜重新载入：正在改的字先存回它自己那一镜
      this._closeText(true);
      const tpl = raw.template;
      this.tpl = tpl;
      this.layers = JSON.parse(JSON.stringify((raw.layers && raw.layers[tpl]) || {}));
      this.reg = new Map();
      this.rec = [];
      this.elements = [];
      this.info = new Map();
      this.sel = [];
      this.scope = null;
      this.hover = null;
      this.undoStack = [];
      this.redoStack = [];
      this._notifySelect();
      this._survey(raw, previous);
      this.render();
    }

    setLayers(layers) {
      this.layers = JSON.parse(JSON.stringify(layers || {}));
      this._apply();
    }

    select(ids) {
      const selected = new Set(ids.filter((id) => this.reg.has(id)));
      const next = [...selected].filter((id) => {
        for (let e = this.reg.get(id); e?.parent; e = this.reg.get(e.parent)) {
          if (selected.has(e.parent)) return false;
        }
        return true;
      });
      if (next.length === this.sel.length && next.every((id, i) => id === this.sel[i])) return;
      this.sel = next;
      this._notifySelect();
      this.render();
    }

    _selectionCandidates() {
      const layers = this.o.scene()?.stage.layers || this.layers;
      return this.elements.filter((e) => {
        const info = this.reg.get(e.id);
        return info?.pick !== false && info?.kind !== 'bg' && (e.parent || null) === this.scope && !layers[e.id]?.hidden;
      });
    }

    selectAll() {
      if (this.o.playing()) this.o.pause();
      this.select(this._selectionCandidates().map((e) => e.id));
      this.o.invalidate();
    }

    // 画一帧。暂停时顺便收集元素矩形，这样点选和选框总是跟画面一致
    draw(ctx, t) {
      const scene = this.o.scene();
      if (!scene) return;
      if (this.o.playing()) {
        scene.draw(ctx, t);
        this.rec = [];
        if (!this.wasPlaying) {
          this.wasPlaying = true;
          this.render();
        }
        this.renderPlayhead();
        return;
      }
      this.wasPlaying = false;
      this.rec = scene.inspect(ctx, t, this.reg);
      this.render();
    }

    // ---------- 界面 ----------
    // opts.dock：把属性和时间条放到画面外面（macOS App 的画面下方），不挡画面；不给就浮在画面上（网页版）
    _build() {
      const el = (tag, cls, parent, attrs) => {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (attrs) Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
        (parent || this.root).appendChild(e);
        return e;
      };
      this.root = document.createElement('div');
      this.root.className = 'dme';
      this.root.tabIndex = 0;
      this.root.setAttribute('role', 'application');
      this.root.setAttribute('aria-label', '画面调整层。点选元素后用方向键移动，从空白处拖动框选，Command+A 全选，Tab 切换元素，Esc 取消选择。');
      this.o.host.appendChild(this.root);
      this.partsBox = el('div', 'dme-box');
      this.hoverBox = el('div', 'dme-box dme-hover');
      this.marquee = el('div', 'dme-box dme-marquee');
      this.selBox = el('div', 'dme-box dme-sel');
      this.stem = el('div', 'dme-stem', this.selBox);
      this.handles = {};
      HANDLES.concat([['rot', 0.5, 0, '旋转']]).forEach(([id, , , name]) => {
        const b = el('button', 'dme-h', this.selBox, {type: 'button', 'data-h': id, 'aria-label': id === 'rot' ? '旋转手柄，方向键微调' : `拖动${name}改变大小，方向键微调`});
        b.style.cursor = CURSOR[id];
        this.handles[id] = b;
      });
      this.sizeTag = el('div', 'dme-size');
      this.guideX = el('div', 'dme-guide x');
      this.guideY = el('div', 'dme-guide y');
      this.status = el('div', 'dme-sr', null, {role: 'status'});

      // 属性面板
      this.dock = this.o.dock || null;
      if (this.dock) {
        this.dock.classList.add('dme-dock');
        // 点完面板上的按钮，方向键还能继续移动元素
        this.dock.addEventListener('pointerup', (e) => {
          if (!/INPUT/.test(e.target.tagName)) this.root.focus({preventScroll: true});
        });
      }
      this.hud = el('div', 'dme-panel dme-hud', this.dock, {role: 'group', 'aria-label': '元素属性'});
      const head = el('div', 'dme-head', this.hud);
      this.hudName = el('div', 'dme-name', head);
      this.fields = {};
      const grid = el('div', 'dme-grid', this.hud);
      FIELDS.forEach((f) => {
        const box = el('label', 'dme-f', grid, {'data-field': f.k});
        const sp = el('span', '', box);
        sp.textContent = f.label;
        const inp = el('input', '', box, {type: 'text', inputmode: 'decimal', 'aria-label': f.aria, autocomplete: 'off', spellcheck: 'false'});
        if (f.unit) el('em', '', box).textContent = f.unit;
        this.fields[f.k] = {def: f, box, inp, sp};
        this._wireField(f, sp, inp);
      });
      const row = el('div', 'dme-row', this.hud);
      const colorBox = el('div', 'dme-color', row);
      this.colorInp = el('input', '', colorBox, {type: 'color', 'aria-label': '换这个元素的颜色', title: '换颜色'});
      this.colorInp.addEventListener('input', () => {
        const v = this.colorInp.value;
        const c = [1, 3, 5].map((k) => parseInt(v.slice(k, k + 2), 16));
        this.sel.forEach((id) => (this._ensure(id).color = c));
        this._apply();
      });
      this.colorInp.addEventListener('change', () => this._commit('换颜色'));
      this.btnReplay = el('button', 'dme-b', row, {type: 'button'});
      this.btnReplay.textContent = '回放';
      this.btnHide = el('button', 'dme-b', row, {type: 'button', 'aria-pressed': 'false'});
      this.btnHide.textContent = '隐藏';
      this.btnReset = el('button', 'dme-b', row, {type: 'button'});
      this.btnReset.textContent = '还原';
      this.btnReplay.addEventListener('click', () => this._replay());
      this.btnHide.addEventListener('click', () => {
        const hide = !this.sel.every((id) => (this.o.scene()?.stage.layers || this.layers)[id]?.hidden);
        this.sel.forEach((id) => {
          if (hide) this._ensure(id).hidden = true;
          else if (this.layers[id]) delete this.layers[id].hidden;
        });
        this._apply();
        this._commit(hide ? '隐藏元素' : '显示元素');
      });
      this.btnReset.addEventListener('click', () => {
        this.sel.forEach((id) => delete this.layers[id]);
        this._apply();
        this._commit('还原元素');
      });
      this._wireHudDrag(head);

      // 时间条：拖中间改延后，拖两头改速度
      this.time = el('div', 'dme-panel dme-time', this.dock, {role: 'group', 'aria-label': '这个元素的时间'});
      if (this.dock) this.dock.insertBefore(this.time, this.hud);
      this.track = el('div', 'dme-track', this.time);
      el('div', 'dme-rail', this.track);
      this.span = el('div', 'dme-span', this.track, {tabindex: '0', role: 'slider', 'aria-label': '元素出现的时间段。左右键改延后，按住 Option 再按左右键改速度', 'aria-valuemin': '0'});
      this.edgeL = el('div', 'dme-edge l', this.span);
      this.edgeR = el('div', 'dme-edge r', this.span);
      this.playhead = el('div', 'dme-play', this.track);
      this._wireTime();

      // 画面内的元素清单：选不到的辉光、颗粒、背景从这里选
      if (this.o.list) {
        const wrap = el('div', 'dme-panel dme-listbtn');
        this.listBtn = el('button', '', wrap, {type: 'button', 'aria-expanded': 'false'});
        this.listBtn.textContent = '全部元素';
        this.list = el('div', 'dme-panel dme-list', null, {role: 'listbox', 'aria-label': '这一镜的全部元素'});
        this.list.style.display = 'none';
        this.listBtn.addEventListener('click', () => {
          const open = this.list.style.display === 'none';
          this.list.style.display = open ? 'block' : 'none';
          this.listBtn.setAttribute('aria-expanded', String(open));
          if (open) this._renderList();
        });
      }

      this._wireCanvas();
      this._wireHandles();
      this._wireKeys();
    }

    _renderList() {
      if (!this.list || this.list.style.display === 'none') return;
      this.list.textContent = '';
      this.elements.forEach((e) => {
        if (e.parent && !this.sel.includes(e.parent) && !this.sel.some((id) => (this.reg.get(id) || {}).parent === e.parent)) return;
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = e.label;
        b.title = e.label;
        if (e.parent) b.classList.add('kid');
        if (this.sel.includes(e.id)) b.classList.add('on');
        b.addEventListener('click', (ev) => {
          ev.stopPropagation();
          this.scope = e.parent;
          this.select([e.id]);
        });
        this.list.appendChild(b);
      });
    }

    async _survey(raw, previous) {
      if (this.surveying) this.surveying.abort();
      const ac = new AbortController();
      this.surveying = ac;
      try {
        const res = await survey(raw, ac.signal);
        if (!res || ac.signal.aborted) return;
        this.elements = res.elements;
        this.info = new Map(res.elements.map((e) => [e.id, e]));
        res.elements.forEach((e) => {
          if (!this.reg.has(e.id)) this.reg.set(e.id, e);
        });
        if (this.o.onElements) this.o.onElements(res.elements);
        if (previous && !this.sel.length) {
          this.scope = this.reg.has(previous.scope) ? previous.scope : null;
          this.select(previous.ids);
        }
        this._renderList();
        this.render();
      } catch (e) {
        // 这一镜画不出来时，界面上已经有错误提示
      }
    }

    // ---------- 坐标 ----------
    get k() {
      return this.o.host.clientWidth / W;
    }

    _pt(e) {
      const r = this.o.host.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
    }

    // 当前这一帧这个元素的矩形；还没出现时用普查的结果
    _box(id) {
      let b = null;
      for (const r of this.rec) {
        if (r.id === id || r.parent === id) {
          if (!b) b = [r.x0, r.y0, r.x1, r.y1];
          else {
            b[0] = Math.min(b[0], r.x0);
            b[1] = Math.min(b[1], r.y0);
            b[2] = Math.max(b[2], r.x1);
            b[3] = Math.max(b[3], r.y1);
          }
        }
      }
      if (b) return {box: b, live: true};
      const info = this.info.get(id);
      if (info && info.box) return {box: info.box.slice(), live: false};
      return null;
    }

    _selBox() {
      let out = null;
      let live = false;
      this.sel.forEach((id) => {
        const b = this._box(id);
        if (!b) return;
        live = live || b.live;
        if (!out) out = b.box.slice();
        else {
          out[0] = Math.min(out[0], b.box[0]);
          out[1] = Math.min(out[1], b.box[1]);
          out[2] = Math.max(out[2], b.box[2]);
          out[3] = Math.max(out[3], b.box[3]);
        }
      });
      return out ? {box: out, live} : null;
    }

    // 点选：从上往下找；成群的元素（一百根竖条）先选整群，双击才进去选单根
    _hit(p, deep) {
      const tol = 5 / Math.max(0.2, this.k);
      for (let i = this.rec.length - 1; i >= 0; i--) {
        const r = this.rec[i];
        if (p[0] < r.x0 - tol || p[0] > r.x1 + tol || p[1] < r.y0 - tol || p[1] > r.y1 + tol) continue;
        const me = this.reg.get(r.id);
        if (!me || me.pick === false) continue;
        if (me.parent) {
          const up = this.reg.get(me.parent);
          if (up && up.group && !deep && this.scope !== me.parent) return me.parent;
        }
        return r.id;
      }
      // 一行字拆成单字时，点在字缝里也算点到这一行
      for (const [gid, e] of this.reg) {
        if (e.kind !== 'text' || !e.group || e.pick === false) continue;
        const b = this._box(gid);
        if (b && b.live && p[0] >= b.box[0] - tol && p[0] <= b.box[2] + tol && p[1] >= b.box[1] - tol && p[1] <= b.box[3] + tol) return gid;
      }
      return null;
    }

    // ---------- 改字 ----------
    // 双击的地方能改字就打开输入框，返回 true；不能改返回 false，照旧选元素
    _editTextAt(id) {
      if (!this.o.editRow) return false;
      const raw = this.o.raw();
      if (!raw) return false;
      if (D.motionIsSampleSizeLayer?.(raw.template, id)) return false;
      const row = Object.assign({}, raw);
      delete row.template;
      const overlay = D.motionOverlayText?.(raw, id);
      if (overlay !== undefined) {
        // 分镜只覆盖这句字，模板默认文案和底图数据留在原处。
        const tpl = raw.template;
        row.overlayText = {...raw.overlayText, [tpl]: {...raw.overlayText?.[tpl], [id]: overlay}};
        const target = {kind: 'one', paths: [['overlayText', tpl, id]], value: String(overlay), limit: 300};
        this.select([id]);
        this._openText(target, this._box(id)?.box ?? [660, 440, 1260, 640], row);
        return true;
      }
      // 从双击到的元素往外找：哪一层的字整段在数据里，就改哪一层（竖排标题双击到单个字，改的是整行）
      const chain = [];
      for (let cur = this.reg.get(id); cur; cur = cur.parent ? this.reg.get(cur.parent) : null) chain.push(cur);
      const texts = chain.filter((e) => e.kind === 'text');
      let target = null;
      let at = null;
      for (const e of texts) {
        target = findText(row, e.label, false);
        if (target) {
          at = e.id;
          break;
        }
      }
      if (!target && texts.length) {
        target = findText(row, texts[0].label, true);
        at = texts[0].id;
      }
      // 字画在动效里面、没有单独的文字元素（按钮、开关、文字特效）：改这一镜的 lines
      if (!target && !texts.length) {
        target = this._linesTarget(raw);
        at = chain.length ? chain[chain.length - 1].id : id;
      }
      if (!target) return false;
      const b = this._box(at) || this._box(id);
      this.sel = [at];
      this._notifySelect();
      this.render();
      this._openText(target, b ? b.box : [660, 440, 1260, 640], row);
      return true;
    }

    _linesTarget(raw) {
      const lines = raw.lines;
      if (!Array.isArray(lines) || !lines.length || !lines.every((s) => typeof s === 'string')) return null;
      // 这一镜有单独的文字元素，说明字都标出来了，双击别处不算改字
      for (const e of this.reg.values()) if (e.kind === 'text') return null;
      if (!this._drawsLines(raw)) return null;
      return {kind: 'list', path: ['lines'], value: lines.slice()};
    }

    // lines 有没有画出来：换一份字各画一帧，画面不一样就是画了。同一份字只算一次
    _drawsLines(raw) {
      const key = `${raw.template}\n${JSON.stringify(raw.lines)}`;
      if (this.linesProbe && this.linesProbe.key === key) return this.linesProbe.v;
      let v = false;
      try {
        const w = 320;
        const h = 180;
        const cv = document.createElement('canvas');
        cv.width = w;
        cv.height = h;
        const g = cv.getContext('2d', {alpha: false, willReadFrequently: true});
        const a = D.createScene(raw, w);
        const b = D.createScene(Object.assign({}, raw, {lines: raw.lines.map((s) => '囗'.repeat(Math.max(2, Array.from(s).length)))}), w);
        const times = [this.o.time(), a.duration * 0.6, Math.max(0, a.duration - 0.05)];
        for (const t of times) {
          a.draw(g, Math.min(t, a.duration));
          const pa = g.getImageData(0, 0, w, h).data;
          b.draw(g, Math.min(t, b.duration));
          const pb = g.getImageData(0, 0, w, h).data;
          let n = 0;
          for (let i = 0; i < pa.length; i += 4) if (Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]) > 30) n++;
          if (n > 12) {
            v = true;
            break;
          }
        }
      } catch (e) {
        v = false;
      }
      this.linesProbe = {key, v};
      return v;
    }

    _openText(target, box, row) {
      this._closeText(true);
      const k = this.k;
      const hostW = this.o.host.clientWidth;
      const hostH = this.o.host.clientHeight;
      const list = target.kind === 'list';
      const node = document.createElement('div');
      node.className = 'dme-panel dme-text';
      const area = document.createElement('textarea');
      area.setAttribute('aria-label', list ? '改这一镜的字，一行一句' : '改这段字');
      area.spellcheck = false;
      area.rows = 1;
      area.autocomplete = 'off';
      area.value = list ? target.value.join('\n') : target.value;
      if (target.limit) area.maxLength = target.limit;
      const tip = document.createElement('small');
      tip.textContent = list ? '回车保存 · Shift+回车换行 · Esc 取消' : '回车保存 · Esc 取消';
      node.append(area, tip);
      this.root.appendChild(node);
      // 字号跟着画面里这段字的大小走，太大太小都收一收
      const bh = (box[3] - box[1]) * k;
      const lines = Math.max(1, area.value.split('\n').length);
      const size = list ? 15 : clamp((bh / lines) * 0.62, 14, 30);
      area.style.fontSize = `${size}px`;
      const width = clamp(Math.max((box[2] - box[0]) * k + 16, 240), 160, Math.max(160, hostW - 16));
      node.style.width = `${width}px`;
      const fit = () => {
        area.style.height = 'auto';
        area.style.height = `${Math.min(area.scrollHeight, hostH * 0.6)}px`;
        area.style.overflowY = area.scrollHeight > hostH * 0.6 ? 'auto' : 'hidden';
        const nh = node.offsetHeight;
        node.style.left = `${clamp(box[0] * k - 8, 8, Math.max(8, hostW - width - 8))}px`;
        node.style.top = `${clamp(box[1] * k - 6, 8, Math.max(8, hostH - nh - 8))}px`;
      };
      const ed = {target, row: JSON.parse(JSON.stringify(row)), node, area};
      this.textEd = ed;
      area.addEventListener('input', fit);
      area.addEventListener('keydown', (e) => {
        // 字是在这里打的，方向键、退格、空格都不能再交给画面
        e.stopPropagation();
        if (e.isComposing || e.keyCode === 229) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          this._closeText(false);
          this.root.focus({preventScroll: true});
        } else if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this._closeText(true);
          this.root.focus({preventScroll: true});
        } else if (e.key === 'Enter' && !list) {
          e.preventDefault();
        }
      });
      area.addEventListener('keyup', (e) => e.stopPropagation());
      area.addEventListener('blur', () => {
        if (this.textEd === ed) this._closeText(true);
      });
      node.addEventListener('pointerdown', (e) => e.stopPropagation());
      fit();
      area.focus({preventScroll: true});
      area.select();
      if (this.o.onTyping) this.o.onTyping(true);
    }

    // save：true 存回数据，false 放弃
    _closeText(save) {
      const ed = this.textEd;
      if (!ed) return;
      this.textEd = null;
      ed.node.remove();
      if (this.o.onTyping) this.o.onTyping(false);
      if (!save) return;
      const t = ed.target;
      let text;
      if (t.kind === 'list') {
        text = ed.area.value.split('\n').map((s) => s.trim()).filter(Boolean);
        if (!text.length || JSON.stringify(text) === JSON.stringify(t.value)) return;
      } else {
        // 一段字里不放换行：粘贴进来的换行变成空格
        text = ed.area.value.replace(/\s*\n\s*/g, ' ').trim();
        if (!text || text === t.value) return;
      }
      // 晚一拍再交出去：外面收到后会重建这一镜，不要在 bind 的半路上重建
      const patch = patchText(ed.row, t, text);
      setTimeout(() => this.o.editRow(patch, '修改文字', ed.row.id), 0);
    }

    // ---------- 改数据 ----------
    _ensure(id) {
      if (!this.layers[id]) this.layers[id] = {};
      return this.layers[id];
    }

    _parentM(id) {
      let m = null;
      let cur = this.reg.get(id);
      while (cur && cur.parent) {
        const effective = this.o.scene()?.stage.layers;
        const o = effective?.[cur.parent] || this.layers[cur.parent];
        if (o && o.m) m = m ? mul(o.m, m) : o.m;
        cur = this.reg.get(cur.parent);
      }
      return m;
    }

    _applyWorld(id, Dm, m0) {
      const P = this._parentM(id);
      const base = m0 || I;
      const m = P ? mul(inv(P), mul(Dm, mul(P, base))) : mul(Dm, base);
      if (isI(m)) {
        if (this.layers[id]) delete this.layers[id].m;
      } else {
        this._ensure(id).m = m.map((v, i) => (i > 3 ? round(v, 3) : round(v, 6)));
      }
    }

    _snapshot() {
      const s = new Map();
      this.sel.forEach((id) => s.set(id, this.layers[id] && this.layers[id].m ? this.layers[id].m.slice() : null));
      return s;
    }

    _prune() {
      const defaults = D.motionLayerDefaults?.(this.tpl);
      Object.keys(this.layers).forEach((id) => {
        const o = this.layers[id];
        const preset = defaults?.[id];
        if (o.alpha === 1 && preset?.alpha == null) delete o.alpha;
        if (o.speed === 1 && preset?.speed == null) delete o.speed;
        if (!o.delay && !preset?.delay) delete o.delay;
        if (!o.speed && !o.delay) {
          delete o.anchor;
          delete o.end;
        }
        if (!o.hidden && !preset?.hidden) delete o.hidden;
        if (!Object.keys(o).length) delete this.layers[id];
      });
    }

    _apply() {
      this._prune();
      const scene = this.o.scene();
      if (scene) scene.setLayers(this.layers);
      this.o.invalidate();
    }

    _commit(label) {
      this._prune();
      const snap = JSON.stringify(this.layers);
      if (this.o.undo) {
        if (this.lastSnap !== undefined && this.lastSnap !== snap) {
          this.undoStack.push(this.lastSnap);
          this.redoStack.length = 0;
        }
      }
      this.lastSnap = snap;
      this.o.commit(JSON.parse(snap), label);
      // 大小变了，普查的外框和时间要更新
      clearTimeout(this.surveyTimer);
      this.surveyTimer = setTimeout(() => this._survey(this.o.raw()), 300);
    }

    _notifySelect() {
      const names = this.sel.map((id) => (this.reg.get(id) || {label: id}).label);
      this.status.textContent = names.length ? `已选中 ${names.join('、')}` : '';
      if (this.o.onSelect) this.o.onSelect(this.sel.slice());
      this._renderList();
    }

    // ---------- 画面上的指针 ----------
    _togglePick(id, extending) {
      if (!extending) return this.sel.includes(id) ? this.sel : [id];
      return this.sel.includes(id) ? this.sel.filter((x) => x !== id) : this.sel.concat(id);
    }

    _wireCanvas() {
      const r = this.root;
      r.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || e.target !== r) return;
        r.focus({preventScroll: true});
        if (this.o.playing()) {
          this.o.pause();
          // 正在播放时先停下来，下一帧才有矩形，所以这次点击等画完再处理
          this.pendingPick = {p: this._pt(e), extend: e.shiftKey || e.metaKey || e.ctrlKey};
          this.o.invalidate();
          return;
        }
        const p = this._pt(e);
        const id = this._hit(p, e.detail >= 2);
        if (e.detail >= 2 && id) {
          const me = this.reg.get(id);
          // 双击字：直接改字（一整行字拆成单字的也是改整行）。别的成群元素第一次双击还是进群选单个
          const up = me && me.parent ? this.reg.get(me.parent) : null;
          const entering = up && up.group && up.kind !== 'text' && this.scope !== me.parent;
          if (!entering && this._editTextAt(id)) {
            e.preventDefault();
            return;
          }
          if (me && me.parent) this.scope = me.parent;
          this.sel = [id];
          this._notifySelect();
          this.render();
          return;
        }
        if (id) {
          const me = this.reg.get(id);
          if (this.scope && (!me || me.parent !== this.scope)) this.scope = null;
          this.select(this._togglePick(id, e.shiftKey || e.metaKey || e.ctrlKey));
          const sb = this._selBox();
          this.drag = {kind: 'move', start: p, m0: this._snapshot(), box: sb ? sb.box : null, moved: false, pid: e.pointerId};
          r.setPointerCapture(e.pointerId);
        } else {
          this.drag = {kind: 'marquee', start: p, previous: this.sel.slice(),
            extend: e.shiftKey || e.metaKey || e.ctrlKey, moved: false, pid: e.pointerId};
          r.setPointerCapture(e.pointerId);
        }
        this.render();
      });
      r.addEventListener('pointermove', (e) => {
        const d = this.drag;
        if (d?.kind === 'marquee' && d.pid === e.pointerId) {
          const [x, y] = this._pt(e);
          const [x0, y0] = d.start;
          if (!d.moved && Math.hypot(x - x0, y - y0) * this.k < 3) return;
          d.moved = true;
          const box = [Math.min(x0, x), Math.min(y0, y), Math.max(x0, x), Math.max(y0, y)];
          this.marquee.style.display = 'block';
          this._place(this.marquee, box);
          const picked = this._selectionCandidates().filter((e) => {
            const bounds = this._box(e.id);
            if (!bounds?.live) return false;
            const [a, b, c, f] = bounds.box;
            return a <= box[2] && c >= box[0] && b <= box[3] && f >= box[1];
          }).map((e) => e.id);
          this.select(d.extend ? d.previous.concat(picked) : picked);
          return;
        }
        if (d && d.kind === 'move') {
          const p = this._pt(e);
          let dx = p[0] - d.start[0];
          let dy = p[1] - d.start[1];
          if (!d.moved && Math.hypot(dx, dy) * this.k < 3) return;
          d.moved = true;
          if (e.shiftKey) {
            if (Math.abs(dx) > Math.abs(dy)) dy = 0;
            else dx = 0;
          }
          [dx, dy] = this._snap(dx, dy, d.box, e.metaKey || e.ctrlKey);
          this.sel.forEach((id) => this._applyWorld(id, T(dx, dy), d.m0.get(id)));
          this._apply();
          return;
        }
        if (d) return;
        if (e.target !== r || this.o.playing()) return;
        const id = this._hit(this._pt(e), false);
        if (id !== this.hover) {
          this.hover = id;
          this.renderHover();
        }
        r.style.cursor = id ? 'move' : 'default';
      });
      const end = (e) => {
        const d = this.drag;
        if (!d || !['move', 'marquee'].includes(d.kind) || d.pid !== e.pointerId) return;
        this.drag = null;
        if (d.kind === 'marquee') {
          this.marquee.style.display = 'none';
          if (e.type === 'pointercancel') this.select(d.previous);
          else if (!d.moved && !d.extend) {
            this.scope = null;
            this.select([]);
          }
          if (r.hasPointerCapture(e.pointerId)) r.releasePointerCapture(e.pointerId);
          return;
        }
        this.guideX.style.display = 'none';
        this.guideY.style.display = 'none';
        if (r.hasPointerCapture(e.pointerId)) r.releasePointerCapture(e.pointerId);
        if (d.moved) this._commit('移动元素');
      };
      r.addEventListener('pointerup', end);
      r.addEventListener('pointercancel', end);
      // 双击改字：WebKit 的 pointerdown 带点击次数，上面已经接住；Chrome 的 pointerdown 点击次数是 0，靠 dblclick
      r.addEventListener('dblclick', (e) => {
        if (this.textEd || this.o.playing()) return;
        // 字很小时第二下会落在选框的手柄上，也算双击选中的这段字
        if (e.target !== r && !this.selBox.contains(e.target)) return;
        const id = this._hit(this._pt(e), true) || (this.sel.length === 1 ? this.sel[0] : null);
        const me = id && this.reg.get(id);
        if (!me) return;
        const up = me.parent ? this.reg.get(me.parent) : null;
        if (up && up.group && up.kind !== 'text' && this.scope !== me.parent) return;
        this._editTextAt(id);
      });
      r.addEventListener('pointerleave', () => {
        if (this.hover) {
          this.hover = null;
          this.renderHover();
        }
      });
    }

    // 吸附：画面中线、边距、其他元素的边和中线。按住 ⌘ 暂时关掉
    _snap(dx, dy, box, off) {
      this.guideX.style.display = 'none';
      this.guideY.style.display = 'none';
      if (off || !box) return [dx, dy];
      const tol = 6 / Math.max(0.2, this.k);
      const xs = [60, 960, 1860];
      const ys = [60, 540, 1020];
      const seen = new Set(this.sel);
      const seenBox = new Set();
      for (const r of this.rec) {
        const me = this.reg.get(r.id);
        if (!me || me.pick === false || seen.has(r.id) || seen.has(r.parent)) continue;
        const key = me.parent && (this.reg.get(me.parent) || {}).group ? me.parent : r.id;
        if (seenBox.has(key)) continue;
        seenBox.add(key);
        const b = this._box(key);
        if (!b) continue;
        xs.push(b.box[0], (b.box[0] + b.box[2]) / 2, b.box[2]);
        ys.push(b.box[1], (b.box[1] + b.box[3]) / 2, b.box[3]);
      }
      const near = (vals, targets) => {
        let best = null;
        vals.forEach((v) => targets.forEach((t) => {
          const d = t - v;
          if (Math.abs(d) <= tol && (!best || Math.abs(d) < Math.abs(best.d))) best = {d, t};
        }));
        return best;
      };
      const X = near([box[0] + dx, (box[0] + box[2]) / 2 + dx, box[2] + dx], xs);
      const Y = near([box[1] + dy, (box[1] + box[3]) / 2 + dy, box[3] + dy], ys);
      if (X) {
        dx += X.d;
        this.guideX.style.display = 'block';
        this.guideX.style.left = `${X.t * this.k}px`;
      }
      if (Y) {
        dy += Y.d;
        this.guideY.style.display = 'block';
        this.guideY.style.top = `${Y.t * this.k}px`;
      }
      return [dx, dy];
    }

    // ---------- 手柄 ----------
    _wireHandles() {
      Object.entries(this.handles).forEach(([h, btn]) => {
        btn.addEventListener('pointerdown', (e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          const sb = this._selBox();
          if (!sb) return;
          btn.setPointerCapture(e.pointerId);
          this.drag = {kind: h === 'rot' ? 'rot' : 'size', h, start: this._pt(e), m0: this._snapshot(), box: sb.box, moved: false};
        });
        btn.addEventListener('pointermove', (e) => {
          const d = this.drag;
          if (!d || d.h !== h) return;
          d.moved = true;
          this._handleDrag(d, this._pt(e), e);
        });
        const up = (e) => {
          const d = this.drag;
          if (!d || d.h !== h) return;
          this.drag = null;
          if (btn.hasPointerCapture(e.pointerId)) btn.releasePointerCapture(e.pointerId);
          this.sizeTag.style.display = 'none';
          if (d.moved) this._commit(h === 'rot' ? '旋转元素' : '改变大小');
          this.render();
        };
        btn.addEventListener('pointerup', up);
        btn.addEventListener('pointercancel', up);
        btn.addEventListener('keydown', (e) => {
          const step = e.shiftKey ? 10 : 1;
          const dir = {ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step]}[e.key];
          if (!dir) return;
          e.preventDefault();
          e.stopPropagation();
          const sb = this._selBox();
          if (!sb) return;
          const d = {kind: h === 'rot' ? 'rot' : 'size', h, start: [0, 0], m0: this._snapshot(), box: sb.box};
          const b = sb.box;
          const from = h === 'rot' ? [(b[0] + b[2]) / 2 + 100, (b[1] + b[3]) / 2] : [b[0] + (b[2] - b[0]) * this._hx(h), b[1] + (b[3] - b[1]) * this._hy(h)];
          d.start = from;
          this._handleDrag(d, [from[0] + dir[0], from[1] + dir[1]], e);
          clearTimeout(this.keyTimer);
          this.keyTimer = setTimeout(() => this._commit(h === 'rot' ? '旋转元素' : '改变大小'), 400);
        });
      });
    }

    _hx(h) {
      return h.includes('w') ? 0 : h.includes('e') ? 1 : 0.5;
    }

    _hy(h) {
      return h.includes('n') ? 0 : h.includes('s') ? 1 : 0.5;
    }

    _handleDrag(d, p, e) {
      const b = d.box;
      if (d.kind === 'rot') {
        const cx = (b[0] + b[2]) / 2;
        const cy = (b[1] + b[3]) / 2;
        let a = Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(d.start[1] - cy, d.start[0] - cx);
        if (e.shiftKey) a = Math.round(a / (Math.PI / 12)) * (Math.PI / 12);
        this.sel.forEach((id) => this._applyWorld(id, RO(a, cx, cy), d.m0.get(id)));
        this._apply();
        return;
      }
      const hx = this._hx(d.h);
      const hy = this._hy(d.h);
      const w = Math.max(1, b[2] - b[0]);
      const h = Math.max(1, b[3] - b[1]);
      const center = e.altKey;
      const ax = center ? (b[0] + b[2]) / 2 : b[0] + w * (1 - hx);
      const ay = center ? (b[1] + b[3]) / 2 : b[1] + h * (1 - hy);
      let sx = 1;
      let sy = 1;
      const f = center ? 2 : 1;
      if (hx !== 0.5) sx = (w + (p[0] - d.start[0]) * (hx === 1 ? 1 : -1) * f) / w;
      if (hy !== 0.5) sy = (h + (p[1] - d.start[1]) * (hy === 1 ? 1 : -1) * f) / h;
      // 文字拖角默认等比，形状按住 Shift 等比
      const allText = this.sel.every((id) => (this.reg.get(id) || {}).kind === 'text');
      if (hx !== 0.5 && hy !== 0.5 && (allText !== e.shiftKey)) {
        const u = Math.max(sx, sy);
        sx = u;
        sy = u;
      }
      sx = clamp(sx, 0.02, 40);
      sy = clamp(sy, 0.02, 40);
      this.sel.forEach((id) => this._applyWorld(id, SC(sx, sy, ax, ay), d.m0.get(id)));
      this.sizeTag.style.display = 'block';
      this.sizeTag.textContent = `${Math.round(w * sx)} × ${Math.round(h * sy)}`;
      this._apply();
    }

    // ---------- 属性面板 ----------
    _scaleOf(m, k) {
      const i = k === 'sx' ? 0 : 2;
      return m ? Math.hypot(m[i], m[i + 1]) * 100 : 100;
    }

    _fieldValue(k) {
      const sb = this._selBox();
      const first = this.layers[this.sel[0]] || {};
      switch (k) {
        case 'x': return sb ? sb.box[0] : 0;
        case 'y': return sb ? sb.box[1] : 0;
        case 'w': return sb ? sb.box[2] - sb.box[0] : 0;
        case 'h': return sb ? sb.box[3] - sb.box[1] : 0;
        case 'sx':
        case 'sy': return this._scaleOf(first.m, k);
        case 'rot': return first.m ? (Math.atan2(first.m[1], first.m[0]) * 180) / Math.PI : 0;
        case 'alpha': return (first.alpha == null ? 1 : first.alpha) * 100;
        case 'speed': return first.speed || 1;
        case 'delay': return first.delay || 0;
        default: return 0;
      }
    }

    _setField(k, v, ctx) {
      const b = ctx.box;
      if (k === 'sx' || k === 'sy') {
        this.sel.forEach((id) => {
          const base = ctx.m0.get(id) || I;
          const point = ctx.centers.get(id);
          if (!point) return;
          const factor = clamp(v, 1, 2000) / Math.max(0.01, this._scaleOf(base, k));
          const m = mul(base, SC(k === 'sx' ? factor : 1, k === 'sy' ? factor : 1, ...point));
          if (isI(m)) {
            if (this.layers[id]) delete this.layers[id].m;
          } else this._ensure(id).m = m.map((value, i) => round(value, i > 3 ? 3 : 6));
        });
      } else if (k === 'alpha') {
        this.sel.forEach((id) => (this._ensure(id).alpha = clamp(v, 0, 100) / 100));
      } else if (k === 'speed') {
        this._setTiming({speed: clamp(v, 0.05, 20)});
      } else if (k === 'delay') {
        this._setTiming({delay: clamp(v, 0, 600)});
      } else if (b) {
        let m = null;
        if (k === 'x') m = T(v - b[0], 0);
        if (k === 'y') m = T(0, v - b[1]);
        if (k === 'w') m = SC(Math.max(1, v) / Math.max(1, b[2] - b[0]), 1, b[0], b[1]);
        // 高度从底边往上长，竖条和柱子都站在底线上
        if (k === 'h') m = SC(1, Math.max(1, v) / Math.max(1, b[3] - b[1]), b[0], b[3]);
        if (k === 'rot') m = RO(((v - ctx.value0) * Math.PI) / 180, (b[0] + b[2]) / 2, (b[1] + b[3]) / 2);
        if (m) this.sel.forEach((id) => this._applyWorld(id, m, ctx.m0.get(id)));
      }
      this._apply();
    }

    _wireField(f, sp, inp) {
      const ctxNow = () => {
        const sb = this._selBox();
        const m0 = this._snapshot();
        const centers = new Map();
        if (f.k === 'sx' || f.k === 'sy') {
          this.sel.forEach((id) => {
            const box = this._box(id)?.box;
            if (!box) return;
            const m = inv(mul(this._parentM(id) || I, m0.get(id) || I));
            const x = (box[0] + box[2]) / 2;
            const y = (box[1] + box[3]) / 2;
            centers.set(id, [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]);
          });
        }
        return {box: sb ? sb.box : null, m0, centers, value0: this._fieldValue(f.k)};
      };
      const LABEL = {x: '移动元素', y: '移动元素', w: '改变大小', h: '改变大小', sx: '设置缩放', sy: '设置缩放', rot: '旋转元素', alpha: '改透明度', speed: '改速度', delay: '改延后'};
      sp.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        sp.setPointerCapture(e.pointerId);
        this.scrub = {x: e.clientX, ctx: ctxNow(), moved: false};
      });
      sp.addEventListener('pointermove', (e) => {
        if (!this.scrub) return;
        this.scrub.moved = true;
        const step = f.step * (e.shiftKey ? 10 : 1);
        this._setField(f.k, this.scrub.ctx.value0 + (e.clientX - this.scrub.x) * step, this.scrub.ctx);
      });
      const end = (e) => {
        if (!this.scrub) return;
        const moved = this.scrub.moved;
        this.scrub = null;
        if (sp.hasPointerCapture(e.pointerId)) sp.releasePointerCapture(e.pointerId);
        if (moved) this._commit(LABEL[f.k]);
      };
      sp.addEventListener('pointerup', end);
      sp.addEventListener('pointercancel', end);
      inp.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.isComposing || e.keyCode === 229) return;
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault();
          if (e.key === 'Escape') inp.dataset.cancel = '1';
          inp.blur();
          this.root.focus({preventScroll: true});
          return;
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const step = f.step * (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
          const ctx = ctxNow();
          this._setField(f.k, ctx.value0 + step, ctx);
          clearTimeout(this.keyTimer);
          this.keyTimer = setTimeout(() => this._commit(LABEL[f.k]), 400);
        }
      });
      inp.addEventListener('focus', () => {
        inp.dataset.initial = inp.value;
        inp.select();
      });
      inp.addEventListener('blur', () => {
        const cancel = inp.dataset.cancel;
        delete inp.dataset.cancel;
        const v = parseFloat(inp.value);
        const ctx = ctxNow();
        if (!cancel && inp.value !== inp.dataset.initial && Number.isFinite(v) && Math.abs(v - ctx.value0) > 1e-6) {
          this._setField(f.k, v, ctx);
          this._commit(LABEL[f.k]);
        }
        this.render();
      });
    }

    _wireHudDrag(head) {
      head.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        head.setPointerCapture(e.pointerId);
        const r = this.hud.getBoundingClientRect();
        this.hudDrag = {dx: e.clientX - r.left, dy: e.clientY - r.top};
      });
      head.addEventListener('pointermove', (e) => {
        if (!this.hudDrag) return;
        const host = this.o.host.getBoundingClientRect();
        this.hudPos = [e.clientX - host.left - this.hudDrag.dx, e.clientY - host.top - this.hudDrag.dy];
        this._placeHud();
      });
      const end = () => (this.hudDrag = null);
      head.addEventListener('pointerup', end);
      head.addEventListener('pointercancel', end);
    }

    _placeHud() {
      if (this.dock) return;
      const host = this.o.host;
      const hw = host.clientWidth;
      const hh = host.clientHeight;
      const w = this.hud.offsetWidth;
      const h = this.hud.offsetHeight;
      let x;
      let y;
      if (this.hudPos) [x, y] = this.hudPos;
      else {
        const sb = this._selBox();
        const k = this.k;
        const b = sb ? sb.box.map((v) => v * k) : [hw / 2, hh / 2, hw / 2, hh / 2];
        const gap = 14;
        const bottomLimit = hh - 58;
        // 选框右边放得下放右边，放不下放左边，都放不下放对角
        if (b[2] + gap + w <= hw - 8) x = b[2] + gap;
        else if (b[0] - gap - w >= 8) x = b[0] - gap - w;
        else x = hw - w - 8;
        y = clamp(b[1], 8, Math.max(8, bottomLimit - h));
        if (x + w > b[0] && x < b[2] && y + h > b[1] && y < b[3]) {
          // 元素太大，盖在角上，让中间露出来
          x = hw - w - 8;
          y = 8;
        }
      }
      this.hud.style.left = `${clamp(x, 4, Math.max(4, hw - w - 4))}px`;
      this.hud.style.top = `${clamp(y, 4, Math.max(4, hh - h - 4))}px`;
    }

    // ---------- 时间条 ----------
    _spanOf(id) {
      const o = this.layers[id] || {};
      const info = this.info.get(id);
      const a = o.anchor != null ? o.anchor : info && info.first != null ? info.first : 0;
      const e0 = o.end != null ? o.end : info && info.last != null ? info.last : (this.o.scene() || {duration: 1}).duration;
      if (o.speed || o.delay) {
        return {start: a + (o.delay || 0), end: a + (e0 - a) / (o.speed || 1) + (o.delay || 0), a, e0};
      }
      if (info && info.first != null) return {start: info.first, end: info.last, a, e0};
      return {start: a, end: e0, a, e0};
    }

    _setTiming({speed, delay}) {
      // 多选时共用一个锚点，几个元素才不会错开
      const spans = this.sel.map((id) => this._spanOf(id));
      const a = Math.min(...spans.map((s) => s.a));
      this.sel.forEach((id, i) => {
        const o = this._ensure(id);
        if (o.anchor == null) {
          o.anchor = round(a, 3);
          o.end = round(spans[i].e0, 3);
        }
        if (speed != null) o.speed = round(speed, 3);
        if (delay != null) o.delay = round(delay, 3);
      });
    }

    _wireTime() {
      const pxToT = (dx) => (dx / Math.max(1, this.track.clientWidth)) * (this.o.scene() || {duration: 1}).duration;
      const begin = (e, kind) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        const id = this.sel[0];
        if (!id) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const sp = this._spanOf(id);
        const o = this.layers[id] || {};
        this.timeDrag = {kind, x: e.clientX, sp, speed: o.speed || 1, delay: o.delay || 0, moved: false};
      };
      const move = (e) => {
        const d = this.timeDrag;
        if (!d) return;
        d.moved = true;
        const dt = pxToT(e.clientX - d.x);
        const len = d.sp.end - d.sp.start;
        const raw = d.sp.e0 - d.sp.a;
        if (d.kind === 'body') {
          this._setTiming({delay: Math.max(0, d.delay + dt)});
        } else if (d.kind === 'r') {
          // 拖右端：结束得早就是变快
          const nl = Math.max(0.03, len + dt);
          this._setTiming({speed: clamp(raw / nl, 0.05, 20)});
        } else {
          // 拖左端：结束时间不动，开始时间变了，所以同时改延后和速度
          const ns = clamp(d.sp.start + dt, d.sp.a, d.sp.end - 0.03);
          const nl = d.sp.end - ns;
          this._setTiming({delay: ns - d.sp.a, speed: clamp(raw / nl, 0.05, 20)});
        }
        this._apply();
      };
      const end = (e) => {
        const d = this.timeDrag;
        if (!d) return;
        this.timeDrag = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
        if (d.moved) this._commit(d.kind === 'body' ? '改延后' : '改速度');
      };
      [[this.span, 'body'], [this.edgeL, 'l'], [this.edgeR, 'r']].forEach(([node, kind]) => {
        node.addEventListener('pointerdown', (e) => begin(e, kind));
        node.addEventListener('pointermove', move);
        node.addEventListener('pointerup', end);
        node.addEventListener('pointercancel', end);
      });
      this.track.addEventListener('pointerdown', (e) => {
        if (e.target === this.span || e.target === this.edgeL || e.target === this.edgeR) return;
        const r = this.track.getBoundingClientRect();
        this.o.pause();
        this.o.seek(((e.clientX - r.left) / r.width) * (this.o.scene() || {duration: 0}).duration);
      });
      this.span.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        e.stopPropagation();
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        const o = this.layers[this.sel[0]] || {};
        if (e.altKey) this._setTiming({speed: clamp((o.speed || 1) + dir * 0.05, 0.05, 20)});
        else this._setTiming({delay: Math.max(0, (o.delay || 0) + dir * (e.shiftKey ? 0.5 : 0.05))});
        this._apply();
        clearTimeout(this.keyTimer);
        this.keyTimer = setTimeout(() => this._commit(e.altKey ? '改速度' : '改延后'), 400);
      });
    }

    _replay() {
      if (!this.sel.length) return;
      const spans = this.sel.map((id) => this._spanOf(id));
      const from = Math.max(0, Math.min(...spans.map((s) => s.start)) - 0.3);
      const to = Math.max(...spans.map((s) => s.end)) + 0.6;
      this.o.play(from, to);
    }

    // ---------- 键盘 ----------
    _wireKeys() {
      this.root.addEventListener('keydown', (e) => {
        const tag = (e.target.tagName || '').toLowerCase();
        if (['input', 'textarea', 'select'].includes(tag) || e.target.isContentEditable || e.isComposing) return;
        if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'a') {
          e.preventDefault();
          e.stopPropagation();
          this.selectAll();
          return;
        }
        if (e.key === 'Escape') {
          const parent = this.sel.length === 1 && (this.reg.get(this.sel[0]) || {}).parent;
          if (parent) {
            this.scope = null;
            this.sel = [parent];
          } else this.sel = [];
          this._notifySelect();
          this.render();
          e.preventDefault();
          return;
        }
        if (e.key === 'Tab' && e.target === this.root && !e.shiftKey && this.rec.length) {
          // Tab 在这一帧能看见的元素之间切换
          const ids = [...new Set(this.rec.map((r) => {
            const me = this.reg.get(r.id);
            if (!me || me.pick === false) return null;
            return me.parent && (this.reg.get(me.parent) || {}).group && this.scope !== me.parent ? me.parent : r.id;
          }).filter(Boolean))];
          if (ids.length) {
            const i = ids.indexOf(this.sel[0]);
            this.sel = [ids[(i + 1) % ids.length]];
            this._notifySelect();
            this.render();
            e.preventDefault();
            return;
          }
        }
        if (!this.sel.length) return;
        const step = e.shiftKey ? 10 : 1;
        const dir = {ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step]}[e.key];
        if (dir) {
          e.preventDefault();
          e.stopPropagation();
          this.sel.forEach((id) => this._applyWorld(id, T(dir[0], dir[1]), this.layers[id] && this.layers[id].m));
          this._apply();
          clearTimeout(this.keyTimer);
          this.keyTimer = setTimeout(() => this._commit('移动元素'), 400);
          return;
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          this.sel.forEach((id) => (this._ensure(id).hidden = true));
          this._apply();
          this._commit('隐藏元素');
          e.preventDefault();
          return;
        }
        if (this.o.undo && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          const from = e.shiftKey ? this.redoStack : this.undoStack;
          const to = e.shiftKey ? this.undoStack : this.redoStack;
          if (from.length) {
            to.push(JSON.stringify(this.layers));
            this.layers = JSON.parse(from.pop());
            this.lastSnap = JSON.stringify(this.layers);
            this._apply();
            this.o.commit(JSON.parse(this.lastSnap), '撤销');
          }
        }
      });
    }

    // ---------- 渲染 ----------
    renderHover() {
      const id = this.hover;
      if (!id || this.sel.includes(id) || this.o.playing()) {
        this.hoverBox.style.display = 'none';
        return;
      }
      const b = this._box(id);
      if (!b) {
        this.hoverBox.style.display = 'none';
        return;
      }
      this._place(this.hoverBox, b.box);
      this.hoverBox.style.display = 'block';
    }

    _place(node, b) {
      const k = this.k;
      node.style.left = `${b[0] * k}px`;
      node.style.top = `${b[1] * k}px`;
      node.style.width = `${(b[2] - b[0]) * k}px`;
      node.style.height = `${(b[3] - b[1]) * k}px`;
    }

    renderPlayhead() {
      if (this.time.style.display === 'none') return;
      const scene = this.o.scene();
      if (!scene) return;
      this.playhead.style.left = `${(this.o.time() / scene.duration) * 100}%`;
    }

    // 选中的东西在画面下方时，时间条挪到上方，不挡住它
    _placeTime(box) {
      if (this.dock) return;
      const low = box && box[3] * this.k > this.o.host.clientHeight - 60;
      this.time.style.bottom = low ? 'auto' : '10px';
      this.time.style.top = low ? '10px' : 'auto';
    }

    render() {
      const playing = this.o.playing();
      if (this.pendingPick && !playing && this.rec.length) {
        const {p, extend} = this.pendingPick;
        this.pendingPick = null;
        const id = this._hit(p, false);
        if (id) {
          this.select(this._togglePick(id, extend));
          return;
        }
      }
      this.renderHover();
      const sb = !playing && this.sel.length ? this._selBox() : null;
      if (!sb) {
        this.selBox.style.display = 'none';
        this.hud.style.display = 'none';
        this.time.style.display = this.sel.length && !playing ? 'block' : 'none';
        this.sizeTag.style.display = 'none';
        if (this.sel.length) this._renderTime();
        return;
      }
      this.selBox.style.display = 'block';
      this.selBox.classList.toggle('ghost', !sb.live);
      this._place(this.selBox, sb.box);
      const bw = this.selBox.clientWidth;
      const bh = this.selBox.clientHeight;
      const small = bw < 44 || bh < 44;
      HANDLES.forEach(([id, hx, hy]) => {
        const node = this.handles[id];
        node.style.left = `${hx * bw}px`;
        node.style.top = `${hy * bh}px`;
        // 选框很小时只留四个角，边上的手柄会挡住内容
        node.style.display = small && id.length === 1 ? 'none' : 'block';
      });
      const rot = this.handles.rot;
      rot.style.left = `${bw / 2}px`;
      rot.style.top = '-26px';
      this.stem.style.left = `${bw / 2}px`;
      this.stem.style.top = '-26px';
      this.stem.style.height = '26px';
      if (this.sizeTag.style.display === 'block') {
        this.sizeTag.style.left = `${sb.box[2] * this.k + 8}px`;
        this.sizeTag.style.top = `${sb.box[3] * this.k + 8}px`;
      }
      // 面板
      this.hud.style.display = this.dock ? 'flex' : 'block';
      const one = this.sel.length === 1 ? this.reg.get(this.sel[0]) : null;
      const name = one ? one.label : `${this.sel.length} 个元素`;
      const tip = one && one.group ? '，双击可以选其中一个' : '';
      this.hudName.textContent = name;
      this.hudName.title = name + tip;
      const isBg = one && one.kind === 'bg';
      Object.values(this.fields).forEach((f) => {
        const geo = ['x', 'y', 'w', 'h', 'sx', 'sy', 'rot'].includes(f.def.k);
        f.box.classList.toggle('off', !sb.live && geo);
        f.inp.disabled = isBg && f.def.k !== 'alpha';
        if (document.activeElement !== f.inp) {
          const {k, dec} = f.def;
          const v = this._fieldValue(k);
          const mixed = (k === 'sx' || k === 'sy') && this.sel.some((id) => Math.abs(this._scaleOf(this.layers[id]?.m, k) - v) >= 0.005);
          f.inp.placeholder = mixed ? '混合' : '';
          f.inp.value = mixed ? '' : v.toFixed(dec);
        }
      });
      if (document.activeElement !== this.colorInp) this.colorInp.value = this._swatch();
      const hidden = this.sel.every((id) => (this.o.scene()?.stage.layers || this.layers)[id]?.hidden);
      this.btnHide.setAttribute('aria-pressed', String(hidden));
      this.btnHide.textContent = hidden ? '显示' : '隐藏';
      this.btnReset.disabled = !this.sel.some((id) => this.layers[id]);
      this._placeHud();
      this.time.style.display = 'block';
      this._placeTime(sb.box);
      this._renderTime();
    }

    // 色块显示元素现在的颜色：调过就是调过的，没调过就取这一帧画它用的颜色
    _swatch() {
      const hex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
      const own = (this.o.scene()?.stage.layers || this.layers)[this.sel[0]]?.color;
      if (own) return hex(own);
      const id = this.sel[0];
      for (let i = this.rec.length - 1; i >= 0; i--) {
        const r = this.rec[i];
        if ((r.id === id || r.parent === id) && typeof r.col === 'string') {
          const v = r.col;
          if (v[0] === '#' && v.length === 7) return v.toLowerCase();
          const m = v.match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/);
          if (m) return hex([+m[1], +m[2], +m[3]]);
        }
      }
      return '#888888';
    }

    _renderTime() {
      const scene = this.o.scene();
      if (!scene || !this.sel.length) return;
      const sp = this._spanOf(this.sel[0]);
      const d = scene.duration || 1;
      this.span.style.left = `${(clamp(sp.start, 0, d) / d) * 100}%`;
      this.span.style.width = `${(clamp(sp.end - sp.start, 0.02, d) / d) * 100}%`;
      const o = this.layers[this.sel[0]] || {};
      const label = `${(o.speed || 1).toFixed(2)}×  ${sp.start.toFixed(2)}–${sp.end.toFixed(2)} 秒`;
      this.span.setAttribute('aria-valuetext', label);
      this.span.setAttribute('aria-valuenow', String(round(sp.start)));
      this.span.setAttribute('aria-valuemax', String(round(d)));
      this.span.dataset.label = label;
      this.renderPlayhead();
    }
  }

  root.DMEditor = Editor;
})(window);
