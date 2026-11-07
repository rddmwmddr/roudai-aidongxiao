// 材质系：玻璃液柱、蜂窝前沿（WebGL）。动作取法自 metalforge 的 Progress 系列，着色器为本工具自写。
(function (root) {
  'use strict';
  const D = root.DM;
  const TEXT = D.TEXT;
  const {clamp, lerp, progress, smooth, springTo, hex, numEm} = D;

  const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uMat;
uniform vec3 uP;
uniform vec3 uQ;
uniform vec3 uBg;
uniform vec4 uRect[4];
uniform vec4 uState[4];
uniform float uKind[4];
uniform vec4 uTint[4];
float hash(float n){return fract(sin(n*127.1+311.7)*43758.5453);}
float hash2(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
float sdRound(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.0))+min(max(q.x,q.y),0.0)-r;}
vec4 hexCell(vec2 p,float s){
  vec2 r=vec2(1.0,1.732)*s; vec2 h=r*0.5;
  vec2 a=mod(p,r)-h; vec2 b=mod(p-h,r)-h;
  vec2 g=dot(a,a)<dot(b,b)?a:b;
  vec2 id=(p-g)/s;
  vec2 q=abs(g); float d=max(q.x,q.x*0.5+q.y*0.866);
  return vec4(d,id,0.0);
}
void main(){
  vec2 p=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);
  float k4=uRes.x/3840.0;
  p/=k4;
  vec3 col=uBg;
  vec2 gp=mod(p,44.0)-22.0;
  col+=vec3(0.5)*0.05*smoothstep(2.6,1.2,length(gp));
  vec2 uvn=p/vec2(3840.0,2160.0)-0.5;
  float vig=1.0-dot(uvn,uvn)*0.7;
  for(int i=0;i<4;i++){
    vec4 R=uRect[i]; vec4 S=uState[i]; float op=S.w;
    if(op<0.002) continue;
    float kind=uKind[i];
    vec2 c=R.xy+R.zw*0.5; float rad=R.w*0.2;
    float d=sdRound(p-c,R.zw*0.5,rad);
    float lvl=R.x+S.x; float on=smoothstep(0.0,14.0,S.x);
    float v=clamp((p.y-R.y)/R.w,0.0,1.0);
    vec3 base=uTint[i].w>0.5?uTint[i].rgb:mix(uP,uQ,kind);
    vec3 deep=base*0.26; vec3 mid=base; vec3 rimC=mix(base,vec3(1.0),0.72);
    if(d>0.0){ float lit=smoothstep(lvl+150.0,lvl-150.0,p.x)*on; col+=mid*exp(-d/86.0)*lit*0.18*op; }
    if(d<2.0){
      float t=uTime; float vc=v-0.5;
      float wave=S.z*(sin(v*7.0+t*8.0)*0.55+sin(v*15.0-t*12.0)*0.3+sin(v*33.0+t*21.0)*0.15);
      float fx=lvl+S.y*vc*R.w+wave+7.0*(vc*vc*4.0-0.333);
      float dist=fx-p.x;
      vec3 body;
      float cyl=1.0-pow(abs(2.0*v-1.0),2.4);
      vec3 glass=mix(uBg,vec3(1.0),0.05);
      glass+=mid*exp(-max(-dist,0.0)/230.0)*0.28*on; glass*=0.82+0.3*cyl;
      if(uMat<0.5){
        float fluid=smoothstep(-1.6,1.6,dist)*on;
        float depth=clamp(dist/1500.0,0.0,1.0);
        vec3 f=mix(mid,deep,smoothstep(0.0,0.82,depth)); f*=0.5+0.68*cyl;
        float flow=sin(p.x*0.0085-t*1.5+sin(v*6.0+t*0.9)*1.5)*sin(v*12.0+p.x*0.0026+t*0.6);
        f+=mid*flow*0.05;
        f*=mix(0.56,1.0,smoothstep(R.x+760.0,R.x+1320.0,p.x));
        float rim=exp(-max(dist,0.0)/mix(13.0,20.0,kind));
        float wake=exp(-max(dist,0.0)/mix(320.0,420.0,kind));
        f+=mid*wake*0.35; f=mix(f,rimC,rim*0.92);
        float amt=clamp(S.z/34.0,0.0,1.0);
        if(amt>0.01&&dist>0.0&&dist<520.0){
          for(int k=0;k<14;k++){
            float s=float(k)+float(i)*20.0;
            float bx=lvl-30.0-hash(s)*440.0;
            float by=R.y+R.w*fract(hash(s+1.0)-t*(0.22+hash(s+2.0)*0.5));
            float br=2.5+hash(s+3.0)*6.5;
            f+=rimC*smoothstep(br+1.5,br-1.0,length(p-vec2(bx,by)))*0.5*amt;
          }
        }
        body=mix(glass,f,fluid);
      } else {
        // 蜂窝：格子铺满，前沿经过时点亮，靠前的闪一下
        vec4 h=hexCell(p,46.0);
        float cellId=hash2(h.yz);
        float shape=smoothstep(19.5,17.5,h.x);
        float cx=p.x;
        float jag=(cellId-0.5)*90.0*clamp(S.z/18.0,0.0,1.0);
        float litNow=smoothstep(0.0,10.0,lvl+jag-cx)*on;
        float heat=exp(-max(lvl-cx,0.0)/260.0)*on;
        float pulse=0.75+0.25*sin(t*3.0+cellId*40.0);
        vec3 off=mix(uBg,base,0.13);
        vec3 lit=mix(base*0.7,base,cellId)*pulse;
        lit=mix(lit,rimC,heat*0.85*cellId);
        lit*=mix(0.62,1.0,smoothstep(R.x+760.0,R.x+1320.0,p.x));
        vec3 cell=mix(off,lit,litNow);
        body=mix(mix(uBg,vec3(1.0),0.02),cell,shape);
      }
      body+=vec3(1.0)*smoothstep(0.17,0.075,abs(v-0.1))*0.04;
      float u100=(p.x-R.x)/R.z*100.0;
      float px1=abs(fract(u100+0.5)-0.5)*R.z/100.0;
      float px10=abs(fract(u100/10.0+0.5)-0.5)*R.z/10.0;
      float tick=smoothstep(2.0,1.0,px1)*step(0.925,v)*0.2+smoothstep(2.6,1.4,px10)*step(0.855,v)*0.42;
      body+=vec3(1.0)*tick;
      float inside=smoothstep(1.2,-1.2,d);
      col=mix(col,body,inside*op);
      float edge=smoothstep(3.0,0.6,abs(d+1.0));
      vec3 edgeC=mix(vec3(0.38),vec3(0.15),v)+mid*smoothstep(lvl+60.0,lvl-60.0,p.x)*0.3*on;
      col+=edgeC*edge*op*0.85;
    }
  }
  col*=vig;
  col+=(hash2(p)-0.5)/120.0;
  gl_FragColor=vec4(col,1.0);
}`;
  const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}';

  const pool = new Map();
  const getGL = (w, h) => {
    const key = `${w}x${h}`;
    if (pool.has(key)) return pool.get(key);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const gl = canvas.getContext('webgl', {preserveDrawingBuffer: true, antialias: false, alpha: false});
    if (!gl) throw new Error('这台电脑的浏览器不支持 WebGL');
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.viewport(0, 0, w, h);
    const u = {};
    ['uRes', 'uTime', 'uMat', 'uP', 'uQ', 'uBg', 'uRect', 'uState', 'uKind', 'uTint'].forEach((n) => (u[n] = gl.getUniformLocation(prog, n)));
    const entry = {canvas, gl, u};
    pool.set(key, entry);
    return entry;
  };

  const makeTubes = (mat) => (spec, tl, S) => {
    const rows = D.flatMetrics(spec);
    const n = rows.length;
    const readout = D.makeReadout(S);
    const X0 = 60;
    const W = 1800;
    const P = hex(spec.colors.primary).map((v) => v / 255);
    const Q = hex(spec.colors.secondary).map((v) => v / 255);
    const BGC = hex(spec.colors.bg).map((v) => v / 255);
    const layout = (k, i) => {
      if (k === 1) return {y: 310, h: 460};
      if (k === 2) return {y: 170 + i * 390, h: 350};
      if (k === 3) return {y: 99 + i * 306, h: 270};
      return {y: 60 + i * 245, h: 225};
    };
    const arriveAt = rows.map((r) => r.b.capAt - 0.15);
    const stateAt = (i, t) => {
      let cur = i === 0 ? layout(1, 0) : Object.assign({}, layout(i + 1, i));
      for (let s = i + 1; s < n; s++) {
        const e = springTo(t - arriveAt[s], 1.05, 5.4);
        if (e <= 0) break;
        const L = layout(s + 1, i);
        cur = {y: lerp(cur.y, L.y, e), h: lerp(cur.h, L.h, e)};
      }
      if (i > 0) {
        const e = springTo(t - arriveAt[i], 1.05, 5.4);
        const L = layout(i + 1, i);
        cur = {y: cur.y + (1 - e) * 300, h: cur.h, a: smooth(progress(t, arriveAt[i], arriveAt[i] + 0.35))};
        void L;
      } else cur.a = smooth(progress(t, 0.1, 0.55));
      return cur;
    };
    const after = (end, t) => {
      const d = t - (end - 0.55);
      return d <= 0 ? {tilt: 0, wave: 0} : {tilt: Math.exp(-2.5 * d) * Math.sin(2 * Math.PI * 1.55 * d), wave: (1 - Math.exp(-9 * d)) * Math.exp(-2.9 * d)};
    };
    const W4 = Math.round(1920 * S);
    const H4 = Math.round(1080 * S);
    const draw = (c, t) => {
      const T0 = t;
      const {canvas, gl, u} = getGL(W4, H4);
      gl.uniform2f(u.uRes, W4, H4);
      gl.uniform1f(u.uTime, t);
      gl.uniform1f(u.uMat, mat);
      gl.uniform3fv(u.uP, P);
      gl.uniform3fv(u.uQ, Q);
      gl.uniform3fv(u.uBg, BGC);
      const rect = [];
      const state = [];
      const kinds = [];
      const tints = [];
      const st = [];
      for (let i = 0; i < 4; i++) {
        const r = rows[i];
        if (!r) {
          rect.push(0, 0, 0, 0);
          state.push(0, 0, 0, 0);
          kinds.push(0);
          tints.push(0, 0, 0, 0);
          st.push(null);
          continue;
        }
        // 液柱在着色器里画，位置和大小直接改矩形，时间按这根自己的算。旋转在这种材质上不生效
        const ti = c.el(`tube:${i}`, `${r.b.value}% 的液柱`);
        const M = c.matrix;
        const s = stateAt(i, ti);
        st.push(stateAt(i, T0));
        const kx = M ? M[0] : 1;
        const ky = M ? M[3] : 1;
        const rx = kx * X0 + (M ? M[4] : 0);
        const ry = ky * s.y + (M ? M[5] : 0);
        rect.push(rx * 2, ry * 2, kx * W * 2, ky * s.h * 2);
        // 液面的高低不经过 Canvas，告诉舞台它还在变，时间条才量得准
        c.pathSig = Math.round(D.frontOf(r.b, ti) * 20);
        if (t >= arriveAt[i] || ti >= arriveAt[i]) c.mark(X0, s.y, W, s.h);
        const a = after(r.b.land, ti);
        const sp = clamp(D.speedOf(r.b, ti) / 60);
        state.push((D.frontOf(r.b, ti) / 100) * kx * W * 2, sp * 0.42 - a.tilt * 0.3, sp * 40 + a.wave * 20, (ti < arriveAt[i] ? 0 : s.a) * c.opacity);
        kinds.push(r.mi === 1 || r.b.emphasis ? 1 : 0);
        const tint = c.tint;
        if (tint) tints.push(tint[0] / 255, tint[1] / 255, tint[2] / 255, 1);
        else tints.push(0, 0, 0, 0);
      }
      gl.uniform4fv(u.uRect, new Float32Array(rect));
      gl.uniform4fv(u.uState, new Float32Array(state));
      gl.uniform1fv(u.uKind, new Float32Array(kinds));
      gl.uniform4fv(u.uTint, new Float32Array(tints));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      c.el('bg', '材质底', {kind: 'bg', pick: false});
      c.setTransform(S, 0, 0, S, 0, 0);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
      c.drawImage(canvas, 0, 0, 1920, 1080);
      c.main();
      rows.forEach((r, i) => {
        if (i > 3 || T0 < arriveAt[i]) return;
        const s = st[i];
        const b = r.b;
        const k = s.h / 270;
        const size = s.h * 0.62;
        const baseline = s.y + s.h / 2 + size * 0.35;
        c.globalAlpha = s.a;
        const title = r.title && r.showTitle ? r.title : '';
        const sub = b.caption;
        const avail = 1800 - numEm(b.value) * size - 200;
        if (title) {
          t = c.el(`title:${i}`, title, TEXT);
          D.reveal(c, title, X0 + 52, s.y + s.h / 2 - 64 * k, D.fitSize(title, avail, 56 * k, 26), '#FFFFFF', t, b.capAt);
          t = c.el(`cap:${i}`, sub, TEXT);
          D.reveal(c, sub, X0 + 52, s.y + s.h / 2 + 6 * k, D.fitSize(sub, avail, 40 * k, 22), '#FFFFFF', t, b.capAt + 0.1);
        } else {
          t = c.el(`cap:${i}`, sub, TEXT);
          const w = D.wrapText(sub, avail, 50 * k, 24, 2);
          D.revealLines(c, w, X0 + 52, s.y + s.h / 2 - D.linesH(w) / 2, '#FFFFFF', t, b.capAt);
        }
        t = c.el(`num:${i}`, `${b.value}%`, TEXT);
        readout(c, {x: X0 + W - 44 - numEm(b.value) * size, baseline, size, value: D.frontOf(b, t), target: b.value, speed: D.speedOf(b, t), color: '#FFFFFF', alpha: smooth(progress(t, b.numAt, b.numAt + 0.35)), pulse: D.landPulse(t, b.land)});
        if (b.prefix) {
          t = c.el(`prefix:${i}`, b.prefix, TEXT);
          D.reveal(c, b.prefix, X0 + W - 44 - numEm(b.value) * size - D.textEm(b.prefix) * 40 - 14, baseline - 40, 40, '#FFFFFF', t, b.numAt);
        }
        c.globalAlpha = 1;
      });
    };
    return {draw};
  };

  D.register('tubes', {
    name: '玻璃液柱', family: '数据', desc: '并列的几个数：玻璃管里液面上升，走得快时翻涌，落定后归平。', source: 'metalforge Progress · Slosh/Liquid', colors: {bg: '#070708', primary: '#FF5C1E', secondary: '#FFD27A'}, maxMetrics: 4, create: makeTubes(0),
  });
  D.register('hex', {
    name: '蜂窝前沿', family: '数据', desc: '并列的几个数：蜂窝格铺满，前沿扫过时一格格点亮。', source: 'metalforge Progress · Hex', colors: {bg: '#0B0B0C', primary: '#FF5C1E', secondary: '#FFF4E2'}, maxMetrics: 4, create: makeTubes(1),
  });
})(window);
