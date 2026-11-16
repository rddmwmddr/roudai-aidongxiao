// Original deterministic Canvas paper rendering. No Paper Animator source, textures or fonts copied.
(function(root) {
  'use strict';
  const D=root.DM,O=root.DMOpus,clamp=D.clamp,lerp=D.lerp;
  const ease=p=>1-Math.pow(1-clamp(p),3), rad=x=>x*Math.PI/180;
  const random=seed=>{let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296}};
  const fonts={'local-gothic':D.FONT_CN,'system-serif':D.FONT_TITLE,'system-sans':'"PingFang SC","Noto Sans CJK SC",DMGothic,sans-serif'};
  const imageCache=new Map(),textures=new Map();
  function texture(seed,amount) {
    const key=seed+':'+amount;if(textures.has(key))return textures.get(key);
    const cv=document.createElement('canvas');cv.width=cv.height=256;const x=cv.getContext('2d'),r=random(seed);
    for(let i=0;i<2300;i++){x.fillStyle=`rgba(${r()<0.6?'45,32,17':'255,255,255'},${amount*(0.03+r()*0.1)})`;x.fillRect(r()*256,r()*256,0.4+r()*1.3,0.4+r()*1.3)}
    x.strokeStyle=`rgba(72,51,28,${amount*0.07})`;x.lineWidth=0.4;
    for(let i=0;i<70;i++){const a=r()*256,b=r()*256;x.beginPath();x.moveTo(a,b);x.lineTo(a+1+r()*9,b+r()*2);x.stroke()}
    if(textures.size>40)textures.delete(textures.keys().next().value);textures.set(key,cv);return cv;
  }
  function grain(g,x,y,w,h,seed,amount){if(!amount)return;g.fillStyle=g.createPattern(texture(seed,amount),'repeat');g.fillRect(x,y,w,h)}
  function label(g,text,x,y,size,color,font='local-gothic',align='left',weight=600,max=Infinity) {
    g.font=`${weight} ${size}px ${fonts[font]||fonts['local-gothic']}`;const width=g.measureText(String(text)).width;
    if(width>max)g.font=`${weight} ${size*max/width}px ${fonts[font]||fonts['local-gothic']}`;
    g.textAlign=align;g.textBaseline='alphabetic';g.fillStyle=color;g.fillText(String(text),x,y);
  }
  function paragraph(g,text,x,y,width,size,color,font='local-gothic',maxLines=9) {
    g.font=`400 ${size}px ${fonts[font]||fonts['local-gothic']}`;g.textAlign='left';g.textBaseline='top';g.fillStyle=color;
    const lines=[];let line='';
    for(const ch of Array.from(text)){if(ch==='\n'||(line&&g.measureText(line+ch).width>width&&!/[，。、！？；：,.!?;:]/.test(ch))){lines.push(line);line=ch==='\n'?'':ch}else line+=ch}if(line)lines.push(line);
    lines.slice(0,maxLines).forEach((l,i)=>g.fillText(i===maxLines-1&&lines.length>maxLines?l.slice(0,-1)+'…':l,x,y+i*size*1.65,width));
  }
  function ragged(g,x,y,w,h,tear,seed) {
    const r=random(seed),step=18;g.beginPath();
    for(let edge=0;edge<4;edge++){
      const len=edge%2?h:w,steps=Math.ceil(len/step);
      for(let i=0;i<=steps;i++){
        const a=i/steps,j=(i===0||i===steps)?0:(r()-0.5)*tear*2;
        const px=edge===0?x+w*a:edge===1?x+w+j:edge===2?x+w*(1-a):x+j;
        const py=edge===0?y+j:edge===1?y+h*a:edge===2?y+h+j:y+h*(1-a);
        if(edge===0&&i===0)g.moveTo(px,py);else g.lineTo(px,py);
      }
    }g.closePath();
  }
  function sheet(g,x,y,w,h,{color,tear=5,seed,texture:amount,shadow=0.2,thickness=2}) {
    if(thickness){for(let i=thickness;i>0;i-=2){ragged(g,x+i*.4,y+i,w,h,tear,seed);g.fillStyle='#C0B49F';g.fill()}}
    g.save();g.shadowColor=`rgba(31,26,18,${shadow})`;g.shadowBlur=38;g.shadowOffsetY=18;
    ragged(g,x,y,w,h,tear,seed);g.fillStyle=color;g.fill();g.restore();
    g.save();ragged(g,x,y,w,h,tear,seed);g.clip();grain(g,x,y,w,h,seed,amount);g.restore();
  }
  function clock(c,t) {
    const now=Math.floor(Math.max(0,t)*c.output.fps+1e-6)/c.output.fps;
    const available=c.timeline.duration-c.timeline.entrance-c.timeline.hold;
    return lerp(c.timeline.inPoint,c.timeline.outPoint,clamp((now-c.timeline.entrance)/available))*available;
  }
  function state(c,t,W=1920,H=1080) {
    const sec=clock(c,t),o=c.options;
    if(c.templateId==='text-match-cut')return {seconds:sec,cutIndex:Math.min(o.paperCount-1,Math.floor(sec/o.cutSeconds)),anchor:{x:W/2,y:H*.38},paperCount:o.paperCount};
    if(c.templateId==='paper-unfold')return {seconds:sec,unfold:ease(sec/o.unfoldSeconds)};
    return {seconds:sec};
  }
  function textMatch(g,c,t,W,H) {
    return D.PaperPress.draw(g,c,t,W,H,{state,fonts,grain,imageCache});
  }
  function ownIllustration(g,w,h,c) {
    g.fillStyle='#E2B647';g.beginPath();g.ellipse(w*.22,h*.45,w*.18,h*.3,-.3,0,Math.PI*2);g.fill();
    g.save();g.translate(w*.56,h*.45);g.rotate(-.1);g.fillStyle='#243449';g.fillRect(-w*.19,-h*.39,w*.38,h*.78);
    g.fillStyle='#DBE8DF';g.fillRect(-w*.17,-h*.36,w*.34,h*.72);g.fillStyle=c.style.accent;g.fillRect(-w*.12,-h*.28,w*.24,h*.17);
    for(let i=0;i<3;i++){g.fillStyle=i===1?'#E8B662':'#FFFFFF';g.fillRect(-w*.12,-h*.04+i*h*.15,w*.24,h*.1)}g.restore();
  }
  function cutout(g,c,t,W,H) {
    const o=c.options,s=c.style,item=c.data.items[0],sec=clock(c,t),p=ease(sec/o.entrySeconds),w=W*.64,h=Math.min(H*.61,1300),r=random(o.seed);
    g.save();g.translate(W/2,H*.53+(o.entry==='drop'?-H*(1-p):o.entry==='slide'?H*.3*(1-p):0));
    g.translate(o.entry==='slide'?-W*.4*(1-p):0,0);g.rotate(rad(o.tilt+(1-p)*(r()-.5)*25));
    const scale=o.entry==='pop'?.5+.5*p:1;g.scale(scale,scale);g.globalAlpha=p;
    if(o.backing)sheet(g,-w/2,-h/2,w,h,{color:o.paperColor,tear:o.tear,texture:o.texture,seed:o.seed,shadow:o.shadow,thickness:o.thickness});
    g.save();ragged(g,-w/2+30,-h/2+30,w-60,h-135,o.tear*.5,o.seed+1);g.clip();
    const image=imageCache.get(item.src);g.translate(-w/2+38,-h/2+38);
    if(image){const iw=w-76,ih=h-155,k=Math.min(iw/image.naturalWidth,ih/image.naturalHeight);g.shadowColor=`rgba(0,0,0,${o.shadow})`;g.shadowBlur=24;g.drawImage(image,(iw-image.naturalWidth*k)/2,(ih-image.naturalHeight*k)/2,image.naturalWidth*k,image.naturalHeight*k)}
    else ownIllustration(g,w-76,h-155,c);
    g.restore();
    label(g,item.label,-w/2+45,h/2-65,27,s.accent);label(g,item.caption,-w/2+45,h/2-23,25,s.ink,'local-gothic','left',400,w-90);
    g.restore();
  }
  function triangle(g,img,src,dst) {
    const [a,b,c]=src,[p,q,r]=dst,det=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);if(Math.abs(det)<1e-9)return;
    const A=((q[0]-p[0])*(c[1]-a[1])-(r[0]-p[0])*(b[1]-a[1]))/det;
    const C=((r[0]-p[0])*(b[0]-a[0])-(q[0]-p[0])*(c[0]-a[0]))/det;
    const B=((q[1]-p[1])*(c[1]-a[1])-(r[1]-p[1])*(b[1]-a[1]))/det;
    const E=((r[1]-p[1])*(b[0]-a[0])-(q[1]-p[1])*(c[0]-a[0]))/det;
    g.save();g.beginPath();g.moveTo(...p);g.lineTo(...q);g.lineTo(...r);g.closePath();g.clip();g.transform(A,B,C,E,p[0]-A*a[0]-C*a[1],p[1]-B*a[0]-E*a[1]);g.drawImage(img,0,0);g.restore();
  }
  const foldCache=new Map();
  function foldSurface(c,vertical) {
    const key=JSON.stringify([c.data,c.style,c.options]);if(foldCache.has(key))return foldCache.get(key);
    const cv=document.createElement('canvas');cv.width=1200;cv.height=760;const g=cv.getContext('2d'),o=c.options,s=c.style;
    g.fillStyle=o.paperColor;g.fillRect(0,0,1200,760);grain(g,0,0,1200,760,o.seed,o.texture);
    const span=(vertical?760:1200)/o.segments;
    for(let i=0;i<o.segments;i++){
      const d=c.data.panels[i],x=vertical?50:i*span+22,y=vertical?i*span+28:60;
      if(d){label(g,d.heading,x,y+26,vertical?30:Math.min(34,span*.13),s.accent,'local-gothic','left',700,vertical?1080:span-44);paragraph(g,d.body,x,y+68,vertical?1080:span-44,vertical?26:Math.min(30,span*.12),s.ink,'local-gothic',vertical?Math.max(1,Math.floor((span-85)/40)):10)}
      g.strokeStyle='#A89F89';g.lineWidth=1;g.setLineDash([5,7]);g.beginPath();if(vertical){g.moveTo(0,(i+1)*span);g.lineTo(1200,(i+1)*span)}else{g.moveTo((i+1)*span,0);g.lineTo((i+1)*span,760)}g.stroke();g.setLineDash([]);
    }
    if(foldCache.size>12)foldCache.delete(foldCache.keys().next().value);foldCache.set(key,cv);return cv;
  }
  function unfold(g,c,t,W,H) {
    const o=c.options,s=c.style,vertical=['up','down'].includes(o.direction),reverse=['left','up'].includes(o.direction),image=foldSurface(c,vertical),n=o.segments;
    const p=state(c,t).unfold,len=(vertical?image.height:image.width)/n,wide=vertical?image.width:image.height;
    const hinges=[[0,0]];let angle=0;
    // Continuous accordion chain: adjacent panels share the exact same 3D hinge.
    for(let i=0;i<n;i++){angle=(i%2?1:-1)*(1-p)*1.47;const prev=hinges.at(-1);hinges.push([prev[0]+Math.cos(angle)*len,prev[1]+Math.sin(angle)*len])}
    const project=(a,b,z)=>{const k=1800/(1800+z);return vertical?[a*k,b*k]:[b*k,a*k]};
    const quads=[];
    for(let i=0;i<n;i++){
      const [a,za]=hinges[i],[b,zb]=hinges[i+1],flip=reverse?-1:1;
      quads.push([project(-wide/2,a*flip,za),project(wide/2,a*flip,za),project(wide/2,b*flip,zb),project(-wide/2,b*flip,zb)]);
    }
    const pts=quads.flat(),minX=Math.min(...pts.map(p=>p[0])),maxX=Math.max(...pts.map(p=>p[0])),minY=Math.min(...pts.map(p=>p[1])),maxY=Math.max(...pts.map(p=>p[1]));
    // Constant scene scale avoids changing character proportions while unfolding.
    const scale=Math.min(W*.77/image.width,H*.61/image.height);
    g.save();g.translate(W/2-(minX+maxX)/2*scale,H*.53-(minY+maxY)/2*scale);g.scale(scale,scale);
    quads.forEach((q,i)=>{
      g.save();g.shadowColor=`rgba(31,24,13,${o.shadow*(.35+(1-p)*.4)})`;g.shadowBlur=30;g.shadowOffsetY=20;g.beginPath();q.forEach(([x,y],j)=>j?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fillStyle=o.paperColor;g.fill();g.restore();
      const a=reverse?(n-i)*len:i*len,b=reverse?(n-i-1)*len:(i+1)*len;
      // Strip tessellation reduces affine seams and approximates a perspective surface.
      for(let j=0;j<12;j++){
        const f=j/12,k=(j+1)/12,point=(u,v)=>[lerp(lerp(q[0][0],q[1][0],u),lerp(q[3][0],q[2][0],u),v),lerp(lerp(q[0][1],q[1][1],u),lerp(q[3][1],q[2][1],u),v)];
        const d=[point(0,f),point(1,f),point(1,k),point(0,k)],src=vertical?[[0,lerp(a,b,f)],[1200,lerp(a,b,f)],[1200,lerp(a,b,k)],[0,lerp(a,b,k)]]:[[lerp(a,b,f),0],[lerp(a,b,f),760],[lerp(a,b,k),760],[lerp(a,b,k),0]];
        triangle(g,image,[src[0],src[1],src[2]],[d[0],d[1],d[2]]);triangle(g,image,[src[0],src[2],src[3]],[d[0],d[2],d[3]]);
      }
      g.fillStyle=`rgba(55,41,22,${(1-p)*(i%2?.25:.09)})`;g.beginPath();q.forEach(([x,y],j)=>j?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fill();
    });g.restore();
    label(g,`${n} 段折纸 · ${o.direction==='right'?'向右':o.direction==='left'?'向左':o.direction==='down'?'向下':'向上'}展开`,W/2,H*.9,25,s.accent,'local-gothic','center');
  }
  function magazine(g,c,t,W,H) {
    const o=c.options,s=c.style,letters=c.data.letters,cols=Math.min(10,letters.length<=10?letters.length:Math.ceil(letters.length/Math.ceil(letters.length/10))),rows=Math.ceil(letters.length/cols);
    const pitch=Math.min(W*.8/cols,190,H*.53/rows),cell=pitch*.87,sec=clock(c,t),r=random(o.seed);
    letters.forEach((item,i)=>{
      const row=Math.floor(i/cols),count=Math.min(cols,letters.length-row*cols),col=i%cols,x=W/2+(col-(count-1)/2)*pitch,y=H*.54+(row-(rows-1)/2)*pitch*1.23;
      const startX=(r()-.5)*W*o.spread,startY=(r()-.5)*H*.8*o.spread,turn=(r()-.5)*190,p=ease((sec-i*o.stagger)/o.entrySeconds);
      if(p===0)return;g.save();g.translate(x+startX*(1-p),y+startY*(1-p));g.rotate(rad(item.tilt+turn*(1-p)));g.globalAlpha=p;
      sheet(g,-cell/2,-cell*.58,cell,cell*1.16,{color:item.paper,tear:o.tear,seed:o.seed+i*31,texture:o.texture,shadow:.24,thickness:2});
      const size=cell*.72;g.font=`${i%2?500:800} ${size}px ${fonts[item.font]}`;const m=g.measureText(item.text),a=m.actualBoundingBoxAscent||size*.8,d=m.actualBoundingBoxDescent||0;
      g.fillStyle=item.ink;g.textBaseline='alphabetic';g.textAlign='center';g.fillText(item.text,0,(a-d)/2);g.restore();
    });
    label(g,'每一张字片，都保留自己的形状。',W/2,H*.86,29,s.ink,'system-serif','center',400,W*.8);
  }
  function create(c) {
    return {duration:c.timeline.duration,draw(g,t){
      const W=1920,H=W*c.output.height/c.output.width,s=c.style;
      g.bg();g.fillStyle=s.background;g.fillRect(0,0,W,H);grain(g,0,0,W,H,c.options.seed,.18);
      g.el('paper-heading','纸张标题',D.TEXT);if(c.templateId!=='text-match-cut'&&c.metadata.showTitle)label(g,s.title,110,H*.105,Math.min(s.titleSize,58),s.ink,s.fontFamily,'left',700,W-220);
      g.el('paper-content','纸张内容',D.MAIN);g.save();
      if(c.templateId==='text-match-cut')textMatch(g,c,t,W,H);
      else if(c.templateId==='paper-cutout')cutout(g,c,t,W,H);
      else if(c.templateId==='paper-unfold')unfold(g,c,t,W,H);
      else magazine(g,c,t,W,H);g.restore();
      g.el('paper-caption','纸张说明',D.TEXT);if(c.templateId!=='text-match-cut'&&c.metadata.showSubtitle)label(g,s.subtitle,110,H*.955,24,s.ink,s.fontFamily,'left',400,W-220);
      if(c.templateId!=='text-match-cut'&&c.demo)label(g,'演示内容 / 自制视觉素材',W-110,H*.055,21,s.accent,'local-gothic','right');
    }};
  }
  const basePrepare=D.Opus.prepareAssets;
  D.Opus.prepareAssets=async raw=>{
    await basePrepare(raw);
    const c=raw.motion;if(!c)return;
    if(c.templateId==='text-match-cut')await D.PaperPress.prepareMaterial();
    const sources=c.templateId==='paper-cutout'?[c.data.items[0].src]:c.templateId==='text-match-cut'?c.data.pages.map(p=>p.image):[];
    await Promise.all([...new Set(sources.filter(Boolean))].map(async src=>{
      if(imageCache.has(src))return;const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('本地纸张/报道图片无法解码'));img.src=src});imageCache.set(src,img);
    }));
  };
  D.Paper={create,state,clock,fonts};
})(window);
