// 舞台：包在真实 Canvas 上下文外面的一层。模板照常画，只需要说「现在画的是哪个元素」。
// 每个元素的位置、大小、旋转（矩阵 m）、透明度、颜色、隐藏、快慢（speed/delay/anchor）都在这里接管，
// 所以预览、缩略图、导出走同一条路径，每一帧仍然只由 t 决定。
//
// 调整数据存在 row.layers[模板 id][元素 id]：
//   {m:[a,b,c,d,e,f], alpha, color:[r,g,b], hidden, speed, delay, anchor, end}
// 矩阵用 1920×1080 的设计坐标，所以换分辨率导出结果一样。
(function (root) {
  'use strict';

  const mul = (a, b) => [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
  const inv = (m) => {
    const det = m[0] * m[3] - m[1] * m[2] || 1e-9;
    return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
  };
  const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

  const TEXT = Object.freeze({kind: 'text'});
  const BG = Object.freeze({kind: 'bg', pick: false});
  const MAIN = Object.freeze({kind: 'main', pick: false});

  const remap = (o, t) => {
    if (!o.speed && !o.delay) return t;
    const a = o.anchor || 0;
    return a + (t - a - (o.delay || 0)) * (o.speed || 1);
  };

  class Stage {
    constructor(S, layers) {
      this.S = S;
      this.layers = layers || null;
      this.stack = [{id: null, t: 0, M: null, alpha: 1, color: null, hidden: false, text: false}];
      this.saves = [];
      this.x = null;
      this.T = 0;
      this.d = 0;
      this.M = null;
      this.C = null;
      this.A = 1;
      this.col = null;
      this.hid = false;
      this.ta = 1;
      this.tf = '#000';
      this.ts = '#000';
      // 记录模式：把每次绘制的矩形收集起来，给画面点选和时间轴用
      this.rec = null;
      this.reg = null;
      this.order = 0;
      this.path = null;
      this.clipBox = null;
      this.clipStack = [];
      this.pathSig = 0;
    }

    setLayers(layers) {
      this.layers = layers && Object.keys(layers).length ? layers : null;
    }

    begin(ctx, t) {
      this.x = ctx;
      this.T = t;
      this.d = 0;
      this.stack[0].t = t;
      this.M = null;
      this.C = null;
      this.A = 1;
      this.col = null;
      this.hid = false;
      this.ta = 1;
      this.saves.length = 0;
      this.path = null;
      this.clipBox = null;
      this.clipStack.length = 0;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      if (this.layers) {
        // 背景被移动或变透明时，露出来的地方是黑的，不留上一帧
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      }
      ctx.setTransform(this.S, 0, 0, this.S, 0, 0);
    }

    end() {
      this.d = 0;
      if (this.A !== 1) this.x.globalAlpha = this.ta;
      this.A = 1;
    }

    // ---------- 元素标记 ----------
    el(id, label, meta) {
      this.d = 0;
      return this._enter(id, label, meta, this.T);
    }

    push(id, label, meta, t) {
      return this._enter(id, label, meta, t === undefined ? this.stack[this.d].t : t);
    }

    pop() {
      this.d = Math.max(0, this.d - 1);
      const f = this.stack[this.d];
      this._sync(f);
      return f.t;
    }

    bg() {
      return this.el('bg', '背景', BG);
    }

    main() {
      return this.el('main', '其余内容', MAIN);
    }

    // 文字助手用：已经在文字元素里就不再分；否则按这段字本身生成一个元素
    textIn(text, t) {
      if (this.stack[this.d].text) return null;
      return this._enter(`t:${text}`, text, TEXT, t);
    }

    get matrix() {
      return this.M;
    }

    get opacity() {
      return this.hid ? 0 : this.A;
    }

    get tint() {
      return this.col;
    }

    // 不经过 Canvas 画的东西（WebGL 液柱），自己报一个矩形
    mark(x, y, w, h) {
      if (!this.rec) return;
      const r = this.x.getTransform();
      const m = [r.a, r.b, r.c, r.d, r.e, r.f];
      this._addBox(m, x, y, x + w, y + h);
    }

    _enter(id, label, meta, tp) {
      const parent = this.stack[this.d];
      this.d += 1;
      let f = this.stack[this.d];
      if (!f) {
        f = {};
        this.stack[this.d] = f;
      }
      f.id = id;
      f.meta = meta;
      if (this.reg && !this.reg.has(id)) {
        this.reg.set(id, {id, label: String(label == null ? id : label), parent: parent.id && parent.id !== 'main' ? parent.id : null, kind: (meta && meta.kind) || 'shape', group: !!(meta && meta.group), pick: !(meta && meta.pick === false), order: this.order++});
      }
      const isText = !!(meta && meta.kind === 'text');
      const o = this.layers && this.layers[id];
      if (!o) {
        f.t = tp;
        f.M = parent.M;
        f.alpha = parent.alpha;
        f.color = parent.color;
        f.hidden = parent.hidden;
      } else {
        f.t = remap(o, tp);
        f.M = o.m ? (parent.M ? mul(parent.M, o.m) : o.m) : parent.M;
        f.alpha = parent.alpha * (o.alpha == null ? 1 : o.alpha);
        f.color = o.color || parent.color;
        // 延后：还没到时间就不画，没有进场动画的元素（底槽、输入框）也一样晚出现
        f.hidden = parent.hidden || !!o.hidden || (o.delay > 0 && tp < (o.anchor || 0) + o.delay);
      }
      f.text = isText || parent.text;
      this._sync(f);
      return f.t;
    }

    _sync(f) {
      if (f.M !== this.M) this._setM(f.M);
      if (f.alpha !== this.A) {
        this.A = f.alpha;
        this.x.globalAlpha = this.ta * this.A;
      }
      if (f.color !== this.col) {
        this.col = f.color;
        this.x.fillStyle = this._tint(this.tf);
        this.x.strokeStyle = this._tint(this.ts);
      }
      this.hid = f.hidden;
    }

    _setM(M) {
      const S = this.S;
      const Cnew = M ? [M[0], M[1], M[2], M[3], M[4] * S, M[5] * S] : null;
      const r = this.x.getTransform();
      let R = [r.a, r.b, r.c, r.d, r.e, r.f];
      if (this.C) R = mul(inv(this.C), R);
      if (Cnew) R = mul(Cnew, R);
      this.x.setTransform(R[0], R[1], R[2], R[3], R[4], R[5]);
      this.M = M;
      this.C = Cnew;
    }

    // 换颜色时保留模板自己的透明度（淡入淡出还要用）
    _tint(v) {
      if (!this.col) return v;
      const c = this.col;
      let a = 1;
      if (typeof v === 'string' && v.charCodeAt(3) === 97) {
        const i = v.lastIndexOf(',');
        if (i > 0) a = parseFloat(v.slice(i + 1));
      }
      return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
    }

    // ---------- 状态 ----------
    save() {
      this.saves.push({ta: this.ta, tf: this.tf, ts: this.ts, M: this.M, A: this.A, col: this.col});
      if (this.rec) this.clipStack.push(this.clipBox);
      this.x.save();
    }

    restore() {
      this.x.restore();
      const s = this.saves.pop();
      if (!s) return;
      this.ta = s.ta;
      this.tf = s.tf;
      this.ts = s.ts;
      if (this.rec) this.clipBox = this.clipStack.pop() || null;
      // 真实上下文回到 save 时的矩阵和透明度，如果那之后换了元素，要改成当前元素的
      const Mnow = this.M;
      const Anow = this.A;
      const colNow = this.col;
      if (s.M !== Mnow) {
        const S = this.S;
        this.M = s.M;
        this.C = s.M ? [s.M[0], s.M[1], s.M[2], s.M[3], s.M[4] * S, s.M[5] * S] : null;
        this._setM(Mnow);
      }
      if (s.A !== Anow) this.x.globalAlpha = this.ta * Anow;
      if (s.col !== colNow) {
        this.x.fillStyle = this._tint(this.tf);
        this.x.strokeStyle = this._tint(this.ts);
      }
    }

    setTransform(a, b, c, d, e, f) {
      if (this.C) {
        const R = mul(this.C, [a, b, c, d, e, f]);
        this.x.setTransform(R[0], R[1], R[2], R[3], R[4], R[5]);
      } else this.x.setTransform(a, b, c, d, e, f);
    }

    get globalAlpha() {
      return this.ta;
    }

    set globalAlpha(v) {
      this.ta = v;
      this.x.globalAlpha = v * this.A;
    }

    get fillStyle() {
      return this.tf;
    }

    set fillStyle(v) {
      this.tf = v;
      this.x.fillStyle = this.col ? this._tint(v) : v;
    }

    get strokeStyle() {
      return this.ts;
    }

    set strokeStyle(v) {
      this.ts = v;
      this.x.strokeStyle = this.col ? this._tint(v) : v;
    }

    // ---------- 绘制 ----------
    fill(...a) {
      if (this.rec) this._recPath(0);
      if (!this.hid) this.x.fill(...a);
    }

    stroke(...a) {
      if (this.rec) this._recPath(this.x.lineWidth / 2);
      if (!this.hid) this.x.stroke(...a);
    }

    fillRect(x, y, w, h) {
      if (this.rec) this._recRect(x, y, x + w, y + h);
      if (!this.hid) this.x.fillRect(x, y, w, h);
    }

    strokeRect(x, y, w, h) {
      if (this.rec) {
        const p = this.x.lineWidth / 2;
        this._recRect(x - p, y - p, x + w + p, y + h + p);
      }
      if (!this.hid) this.x.strokeRect(x, y, w, h);
    }

    fillText(s, x, y, mw) {
      if (this.rec) this._recText(s, x, y);
      if (this.hid) return;
      if (mw === undefined) this.x.fillText(s, x, y);
      else this.x.fillText(s, x, y, mw);
    }

    strokeText(s, x, y, mw) {
      if (this.rec) this._recText(s, x, y);
      if (this.hid) return;
      if (mw === undefined) this.x.strokeText(s, x, y);
      else this.x.strokeText(s, x, y, mw);
    }

    drawImage(img, ...a) {
      if (this.rec) {
        if (a.length === 2) this._recRect(a[0], a[1], a[0] + (img.width || 0), a[1] + (img.height || 0));
        else if (a.length === 4) this._recRect(a[0], a[1], a[0] + a[2], a[1] + a[3]);
        else if (a.length === 8) this._recRect(a[4], a[5], a[4] + a[6], a[5] + a[7]);
      }
      if (!this.hid) this.x.drawImage(img, ...a);
    }

    // ---------- 路径：记录模式下顺手算外接矩形 ----------
    beginPath() {
      this.path = null;
      this.pathSig = 0;
      this.x.beginPath();
    }

    moveTo(x, y) {
      if (this.rec) this._pt(x, y);
      this.x.moveTo(x, y);
    }

    lineTo(x, y) {
      if (this.rec) this._pt(x, y);
      this.x.lineTo(x, y);
    }

    rect(x, y, w, h) {
      if (this.rec) {
        this._pt(x, y);
        this._pt(x + w, y + h);
      }
      this.x.rect(x, y, w, h);
    }

    roundRect(x, y, w, h, r) {
      if (this.rec) {
        this._pt(x, y);
        this._pt(x + w, y + h);
      }
      this.x.roundRect(x, y, w, h, r);
    }

    arc(x, y, r, a0, a1, ccw) {
      if (this.rec) {
        // 按整圆算外接矩形，点选时宽松一点没有坏处
        this._pt(x - r, y - r);
        this._pt(x + r, y + r);
        this.pathSig = (this.pathSig + Math.round((a1 - a0) * 200)) | 0;
      }
      this.x.arc(x, y, r, a0, a1, ccw);
    }

    clip(...a) {
      if (this.rec && this.path) {
        const b = this.path;
        const c = this.clipBox;
        this.clipBox = c ? [Math.max(c[0], b[0]), Math.max(c[1], b[1]), Math.min(c[2], b[2]), Math.min(c[3], b[3])] : b.slice();
      }
      this.x.clip(...a);
    }

    _pt(x, y) {
      const r = this.x.getTransform();
      const px = r.a * x + r.c * y + r.e;
      const py = r.b * x + r.d * y + r.f;
      const b = this.path;
      if (!b) this.path = [px, py, px, py];
      else {
        if (px < b[0]) b[0] = px;
        if (py < b[1]) b[1] = py;
        if (px > b[2]) b[2] = px;
        if (py > b[3]) b[3] = py;
      }
    }

    _recPath(pad) {
      const b = this.path;
      if (!b) return;
      const r = this.x.getTransform();
      const k = Math.hypot(r.a, r.b) * pad;
      this._push(b[0] - k, b[1] - k, b[2] + k, b[3] + k);
    }

    _recRect(x0, y0, x1, y1) {
      const r = this.x.getTransform();
      this._addBox([r.a, r.b, r.c, r.d, r.e, r.f], x0, y0, x1, y1);
    }

    _addBox(m, x0, y0, x1, y1) {
      const p = [apply(m, x0, y0), apply(m, x1, y0), apply(m, x1, y1), apply(m, x0, y1)];
      this._push(Math.min(p[0][0], p[1][0], p[2][0], p[3][0]), Math.min(p[0][1], p[1][1], p[2][1], p[3][1]), Math.max(p[0][0], p[1][0], p[2][0], p[3][0]), Math.max(p[0][1], p[1][1], p[2][1], p[3][1]));
    }

    _recText(s, x, y) {
      if (!s) return;
      const w = this.x.measureText(s);
      const r = this.x.getTransform();
      this._addBox([r.a, r.b, r.c, r.d, r.e, r.f], x - w.actualBoundingBoxLeft, y - w.actualBoundingBoxAscent, x + w.actualBoundingBoxRight, y + w.actualBoundingBoxDescent);
    }

    _push(x0, y0, x1, y1) {
      const a = this.x.globalAlpha;
      if (a < 0.004 || x1 < x0 || y1 < y0) return;
      const c = this.clipBox;
      if (c) {
        x0 = Math.max(x0, c[0]);
        y0 = Math.max(y0, c[1]);
        x1 = Math.min(x1, c[2]);
        y1 = Math.min(y1, c[3]);
        if (x1 <= x0 || y1 <= y0) return;
      }
      const k = 1 / this.S;
      this.rec.push({id: this.stack[this.d].id, parent: this.d > 1 ? this.stack[this.d - 1].id : null, x0: x0 * k, y0: y0 * k, x1: x1 * k, y1: y1 * k, a, sig: this._colorSig(), col: this.tf});
    }

    _colorSig() {
      let h = this.pathSig | 0;
      [this.tf, this.ts].forEach((v) => {
        if (typeof v !== 'string') return;
        for (let i = v.length - 1; i >= 0 && i > v.length - 18; i--) h = (h * 31 + v.charCodeAt(i)) | 0;
      });
      return h;
    }
  }

  // 其余成员原样转发。缺什么就加什么，不用 Proxy，这样逐帧绘制没有额外开销
  ['closePath', 'translate', 'scale', 'rotate', 'transform', 'getTransform', 'measureText', 'setLineDash', 'getLineDash', 'createLinearGradient', 'createRadialGradient', 'createPattern', 'clearRect', 'bezierCurveTo', 'quadraticCurveTo', 'ellipse', 'arcTo'].forEach((name) => {
    Stage.prototype[name] = function (...a) {
      return this.x[name](...a);
    };
  });
  ['font', 'textAlign', 'textBaseline', 'lineWidth', 'lineCap', 'lineJoin', 'miterLimit', 'lineDashOffset', 'globalCompositeOperation', 'imageSmoothingEnabled', 'imageSmoothingQuality', 'shadowBlur', 'shadowColor', 'shadowOffsetX', 'shadowOffsetY'].forEach((name) => {
    Object.defineProperty(Stage.prototype, name, {
      get() {
        return this.x[name];
      },
      set(v) {
        this.x[name] = v;
      },
    });
  });
  Object.defineProperty(Stage.prototype, 'canvas', {
    get() {
      return this.x.canvas;
    },
  });
  // Safari 和 WKWebView 没有 ctx.filter，模板靠 'filter' in c 判断，这里保持一致
  if ('filter' in CanvasRenderingContext2D.prototype) {
    Object.defineProperty(Stage.prototype, 'filter', {
      get() {
        return this.x.filter;
      },
      set(v) {
        this.x.filter = v;
      },
    });
  }

  root.DMStage = {Stage, TEXT, mul, inv, apply, remap};
})(window);
