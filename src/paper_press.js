// Original editorial rendering, informed by a frame study of the supplied public video.
// No reference-site source, article imagery or textures are used.
(function(root) {
  const D=root.DM,cache=new Map();
  const random=seed=>{let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296}};
  const fit=(g,s,width,tail=false)=>{const chars=Array.from(s);while(chars.length&&g.measureText(chars.join('')).width>width)tail?chars.shift():chars.pop();return chars.join('')};
  function lines(g,source,width) {
    const out=[];let line='';
    const tokens=source.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*|\n|[^\S\n]+|[^\x00-\x7F]|./g)||[];
    for(const word of tokens){if(word==='\n'||(line&&g.measureText(line+word).width>width&&!/^[，。、！？；：,.!?;:]$/.test(word))){out.push(line.trim());line=word==='\n'?'':word}else line+=word}if(line.trim())out.push(line.trim());return out;
  }
  function marker(g,box,color,seed) {
    const r=random(seed),{x,y,w,h}=box;
    g.save();g.globalAlpha=.82;g.globalCompositeOperation='multiply';g.fillStyle=color;g.beginPath();g.moveTo(x-12,y+1);
    g.lineTo(x+w+12,y+r()*3);g.lineTo(x+w+10,y+h);g.lineTo(x+w*.45,y+h+r()*2);g.lineTo(x-13,y+h-1);g.closePath();g.fill();g.restore();
  }
  let materialPromise,materialReady=false,materialImage;
  const materialMaps=new Map();
  function prepareMaterial(){
    if(!materialPromise)materialPromise=new Promise((resolve,reject)=>{
      if(!root.DM_PAPER_MATERIAL){reject(new Error('缺少内嵌纸张材质，请重新构建 App'));return}
      materialImage=new Image();materialImage.onload=()=>{materialReady=true;resolve()};
      materialImage.onerror=()=>reject(new Error('本地纸张材质无法解码'));materialImage.src=root.DM_PAPER_MATERIAL;
    });return materialPromise;
  }
  function materialMap(W,H,seed){
    const key=`${W}:${H}:${seed}`;if(materialMaps.has(key))return materialMaps.get(key);
    const cv=document.createElement('canvas');cv.width=W;cv.height=H;const x=cv.getContext('2d',{willReadFrequently:true}),r=random(seed);
    const k=Math.max(W/materialImage.naturalWidth,H/materialImage.naturalHeight)*1.07,w=materialImage.naturalWidth*k,h=materialImage.naturalHeight*k;
    x.save();if(r()>.5){x.translate(W,0);x.scale(-1,1)}
    x.drawImage(materialImage,-(w-W)*r(),-(h-H)*r(),w,h);x.restore();
    const data=x.getImageData(0,0,W,H).data,lum=new Float32Array(W*H);let mean=0;
    for(let j=0;j<lum.length;j++){const at=j*4;lum[j]=data[at]*.2126+data[at+1]*.7152+data[at+2]*.0722;mean+=lum[j]}
    const result={lum,mean:mean/lum.length};
    if(materialMaps.size>3)materialMaps.delete(materialMaps.keys().next().value);materialMaps.set(key,result);return result;
  }
  function material(g,W,H,o,helpers){
    if(!materialReady){helpers.grain(g,0,0,W,H,o.seed,o.texture);return}
    if(!(o.wrinkleStrength||o.texture||o.inkWear))return;
    const {lum,mean}=materialMap(W,H,o.seed),image=g.getImageData(0,0,W,H),data=image.data;
    const paper=o.paperColor.slice(1).match(/../g).map(v=>parseInt(v,16));
    // One material illuminates paper, pigment and marker together. The sharp grain
    // is independent of optical defocus; no unrelated lines are drawn over the page.
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const j=y*W+x,at=j*4,l=lum[j],near=(lum[y*W+Math.max(0,x-2)]+lum[y*W+Math.min(W-1,x+2)]+lum[Math.max(0,y-2)*W+x]+lum[Math.min(H-1,y+2)*W+x])*.25;
      const micro=l-near,shade=Math.max(.84,Math.min(1.06,1+(near-mean)*o.wrinkleStrength/240)),wear=Math.min(.06,Math.max(0,micro)*o.inkWear*.012);
      for(let ch=0;ch<3;ch++){const v=data[at+ch];data[at+ch]=(v+(paper[ch]-v)*wear)*shade+micro*o.texture*.12}
    }g.putImageData(image,0,0);
  }
  if(root.DM_PAPER_MATERIAL)prepareMaterial().catch(()=>{});
  function typeset(c,i,W,H,helpers) {
    const page=c.data.pages[i%c.data.pages.length],o=c.options,s=c.style;
    const key=JSON.stringify([page,o,s,c.metadata,W,H,i]);if(cache.has(key))return cache.get(key);
    const cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d'),targets=[];
    const pagePath=['data','pages',i%c.data.pages.length];
    function text(value,x,y,path,label){g.fillText(value,x,y);const m=g.measureText(value);targets.push({path,label,x:x-(m.actualBoundingBoxLeft||0),y:y-(m.actualBoundingBoxAscent||size),w:m.width,h:(m.actualBoundingBoxAscent||size)+(m.actualBoundingBoxDescent||0)})}
    const pair={'gothic-serif':['system-serif','local-gothic'],'sans-gothic':['system-sans','local-gothic'],'serif-sans':['system-serif','system-sans']}[o.fontPair];
    const font=helpers.fonts[pair[i%2]],body=[0,3,8].includes(i%10),weight=body?400:700;
    let size=Math.min(H*.12,Math.max(30,s.fontSize*2.1)*o.articleScale);
    g.font=`700 ${size}px ${helpers.fonts[pair[0]]}`;
    const reference=g.measureText(o.keyword),target=Math.min(W*.51,reference.actualBoundingBoxLeft+reference.actualBoundingBoxRight||reference.width);
    g.font=`700 ${size}px ${font}`;let m=g.measureText(o.keyword);
    size*=target/(m.actualBoundingBoxLeft+m.actualBoundingBoxRight||m.width);
    g.font=`700 ${size}px ${font}`;m=g.measureText(o.keyword);
    const left=m.actualBoundingBoxLeft||0,right=m.actualBoundingBoxRight||m.width,asc=m.actualBoundingBoxAscent||size*.8,des=m.actualBoundingBoxDescent||0;
    const cx=W/2,cy=H*.38,wordX=cx+(left-right)/2,base=cy+(asc-des)/2,lineH=size*1.48;
    g.fillStyle=o.paperColor;g.fillRect(0,0,W,H);g.fillStyle=s.ink;g.textBaseline='alphabetic';
    g.font=`${weight} ${size}px ${font}`;
    const prefix=fit(g,page.before,W*.42,true),start=wordX-g.measureText(prefix).width;
    const context=page.after+(page.after.match(/[。！？.!?]$/)?'':'，');
    text(prefix,start,base,[...pagePath,'before'],'关键词前文');text(context,wordX+m.width+size*.08,base,[...pagePath,'after'],'关键词后文');
    g.font=`700 ${size}px ${font}`;text(o.keyword,wordX,base,['options','keyword'],'固定关键词');
    g.font=`${weight} ${size}px ${font}`;
    if(body){
      const bodyLines=lines(g,page.body,W*.98),x=[W*.15,-W*.07,W*.13][[0,3,8].indexOf(i%10)];
      // A close crop of a paragraph: only one line above and up to three below.
      if(bodyLines[0])text(bodyLines[0],x,base-lineH,[...pagePath,'body'],'正文');
      bodyLines.slice(1,4).forEach((line,n)=>text(line,x,base+(n+1)*lineH,[...pagePath,'body'],'正文'));
      if(i%10===3){g.fillStyle=s.ink;g.fillRect(W*.86,H*.1,4,H*.13)}
    }else{
      const small=size*.27;g.font=`500 ${small}px ${helpers.fonts['system-sans']}`;
      text(page.heading,Math.max(30,start),Math.max(small*2,base-size*1.7),[...pagePath,'heading'],'报道栏目');
      if(c.metadata.showTitle){g.font=`400 ${small}px ${font}`;text(fit(g,s.title,W*.8),Math.max(30,start),base+size*.72,['style','title'],'标题')}
      // Quiet image placeholder, drawn from our own geometry rather than invented article text.
      g.fillStyle='rgba(76,75,65,.07)';g.fillRect(Math.max(0,start),base+size*1.12,W*.81,H*.34);
      if(i%10===5){g.font=`400 ${small}px ${font}`;g.fillStyle=s.ink;text(page.body.slice(0,44),W*.15,H*.85,[...pagePath,'body'],'正文')}
    }
    if(c.metadata.showSubtitle){g.font=`400 ${Math.max(15,size*.18)}px ${font}`;g.fillStyle=s.ink;text(fit(g,s.subtitle,W*.8),Math.max(25,start),H-55,['style','subtitle'],'说明')}
    const result={canvas:cv,targets,box:{x:cx-(left+right)/2,y:cy-(asc+des)/2-5,w:left+right,h:asc+des+10}};
    if(cache.size>24)cache.delete(cache.keys().next().value);cache.set(key,result);return result;
  }
  // Three directional box passes, baked into pixels for native WebKit export.
  function defocus(source,radius) {
    if(!radius)return source;
    const cv=document.createElement('canvas'),scale=2;cv.width=Math.ceil(source.width/scale);cv.height=Math.ceil(source.height/scale);
    const ctx=cv.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0,cv.width,cv.height);
    const pixels=ctx.getImageData(0,0,cv.width,cv.height),w=cv.width,h=cv.height;
    let a=pixels.data;
    for(let pass=0;pass<3;pass++)for(const axis of [0,1]){
      const r=Math.round(radius*(axis?1:.16)/scale);if(!r)continue;
      const b=new Uint8ClampedArray(a.length),div=2*r+1,outer=axis?w:h,inner=axis?h:w;
      for(let line=0;line<outer;line++){
        const at=k=>(axis?(Math.max(0,Math.min(h-1,k))*w+line):(line*w+Math.max(0,Math.min(w-1,k))))*4;
        const sum=[0,0,0];for(let k=-r;k<=r;k++){const n=at(k);for(let ch=0;ch<3;ch++)sum[ch]+=a[n+ch]}
        for(let k=0;k<inner;k++){const n=at(k);for(let ch=0;ch<3;ch++)b[n+ch]=sum[ch]/div;b[n+3]=255;
          const old=at(k-r),next=at(k+r+1);for(let ch=0;ch<3;ch++)sum[ch]+=a[next+ch]-a[old+ch]}
      }a=b;
    }pixels.data.set(a);ctx.putImageData(pixels,0,0);return cv;
  }
  function depthAt(x,y,box,W,H,padding){
    const dx=Math.max(0,Math.abs(x-box.x-box.w/2)-box.w*.42-padding)/(W*.37);
    const dy=Math.max(0,Math.abs(y-box.y-box.h/2)-box.h*.55-padding*.25)/(H*.48);
    return Math.min(1,Math.hypot(dx,dy));
  }
  const scenes=new WeakMap();
  function draw(g,c,t,W,H,helpers) {
    const st=helpers.state(c,t,W,H),i=st.cutIndex%Math.max(10,c.data.pages.length),page=c.data.pages[i%c.data.pages.length],o=c.options;
    let frames=scenes.get(c);if(!frames){frames=new Map();scenes.set(c,frames)}
    const frameKey=`${i}:${W}:${H}`;if(frames.has(frameKey)){g.drawImage(frames.get(frameKey),0,0);return}
    let box,crisp;
    if(page.image){
      const image=helpers.imageCache.get(page.image);if(!image)throw new Error('报道图片尚未载入');
      const iw=image.naturalWidth,ih=image.naturalHeight,k=Math.min(W*.51/(iw*page.focusWidth),64*o.articleScale/(ih*page.focusHeight));
      const x=W/2-page.focusX*iw*k,y=H*.38-page.focusY*ih*k;
      crisp=document.createElement('canvas');crisp.width=W;crisp.height=H;const ctx=crisp.getContext('2d');ctx.fillStyle=o.paperColor;ctx.fillRect(0,0,W,H);ctx.drawImage(image,x,y,iw*k,ih*k);
      box={x:W/2-page.focusWidth*iw*k/2,y:H*.38-page.focusHeight*ih*k/2,w:page.focusWidth*iw*k,h:page.focusHeight*ih*k};
    }else{const article=typeset(c,i,W,H,helpers);box=article.box;crisp=article.canvas}
    const frame=document.createElement('canvas');frame.width=W;frame.height=H;const ctx=frame.getContext('2d',{willReadFrequently:true});ctx.drawImage(crisp,0,0);
    const original=ctx.getImageData(0,0,W,H),pixels=original.data;
    if(o.contextBlur||o.contextDimming){
      const levels=[0,.4,.7,1],planes=[new Uint8ClampedArray(pixels)];
      for(const level of levels.slice(1)){ctx.drawImage(defocus(crisp,o.contextBlur*level),0,0,W,H);planes.push(ctx.getImageData(0,0,W,H).data)}
      const paper=o.paperColor.slice(1).match(/../g).map(v=>parseInt(v,16));
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){
        const d=depthAt(x,y,box,W,H,o.focusPadding);let lo=0;while(lo<2&&d>levels[lo+1])lo++;
        const mix=(d-levels[lo])/(levels[lo+1]-levels[lo]),at=(y*W+x)*4;
        for(let ch=0;ch<3;ch++){const ink=planes[lo][at+ch]*(1-mix)+planes[lo+1][at+ch]*mix;pixels[at+ch]=ink*(1-o.contextDimming*d)+paper[ch]*o.contextDimming*d}
      }ctx.putImageData(original,0,0);
    }
    if(o.highlight)marker(ctx,box,o.highlightColor,o.seed+i);
    if(!page.image)material(ctx,W,H,o,helpers);
    if(c.demo){ctx.fillStyle='rgba(244,242,235,.85)';ctx.fillRect(W-350,H-36,350,36);ctx.font=`18px ${helpers.fonts['system-sans']}`;ctx.textAlign='right';ctx.fillStyle='#69685E';ctx.fillText('版式演示 · 非真实新闻报道',W-22,H-12)}
    if(page.image||materialReady)frames.set(frameKey,frame);g.drawImage(frame,0,0);
  }
  function textAt(c,t,x,y){
    const W=1920,H=W*c.output.height/c.output.width,i=D.Paper.state(c,t).cutIndex%Math.max(10,c.data.pages.length);
    if(c.data.pages[i%c.data.pages.length].image)return null;
    const targets=typeset(c,i,W,H,{fonts:D.Paper.fonts}).targets;
    const hit=targets.find(r=>x>=r.x&&x<=r.x+r.w&&y>=r.y-6&&y<=r.y+r.h+6);
    return hit?{...hit,value:hit.path.reduce((v,key)=>v[key],c)}:null;
  }
  D.PaperPress={draw,depthAt,prepareMaterial,textAt};
})(window);
