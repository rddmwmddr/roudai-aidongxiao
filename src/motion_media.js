// Shared second-based holds and deterministic sound scheduling. No network assets.
(function(root){
 'use strict';const D=root.DM,O=root.DMOpus,M=O.MEDIA,RATE=48000;
 for(const id of O.IDS){const tpl=D.TEMPLATES[id],create=tpl.create;tpl.create=row=>{if(!row.motion)return create(row);const c=O.validate(row.motion);if(!c.timeline.pauses.length)return create(row);const inside=create({...row,motion:M.inner(c)});return{duration:c.timeline.duration,draw:(g,t)=>inside.draw(g,M.motionTime(c,t))}}}
 const cache=new Map();let decoder;
 function context(){return decoder??=new (root.AudioContext||root.webkitAudioContext)({sampleRate:RATE})}
 async function asset(src){if(cache.has(src))return cache.get(src);const p=(async()=>{const bytes=Uint8Array.from(atob(src.split(',')[1]),c=>c.charCodeAt(0));return context().decodeAudioData(bytes.buffer)})();cache.set(src,p);try{return await p}catch(e){cache.delete(src);throw new Error('音效无法解码，请使用 WAV / MP3 / M4A：'+e.message)}}
 const rand=seed=>{let x=seed|0;return()=>{x=(Math.imul(x,1664525)+1013904223)|0;return (x>>>0)/4294967296}};
 const builtins=new Map();
 function builtin(id){if(builtins.has(id))return builtins.get(id);const sec=id==='builtin:paper'?.12:id==='builtin:pop'?.09:.045,buffer=new AudioBuffer({numberOfChannels:2,length:Math.ceil(RATE*sec),sampleRate:RATE}),r=rand(321);let filtered=0;
  for(let i=0;i<buffer.length;i++){const t=i/RATE,p=t/sec,n=r()*2-1;filtered=filtered*.72+n*.28;const wave=id==='builtin:paper'?filtered*Math.sin(Math.PI*p)**1.7*.65:id==='builtin:pop'?Math.sin(2*Math.PI*(380*t-1000*t*t))*Math.exp(-p*8)*.4:Math.sin(t*2*Math.PI*1500)*Math.exp(-p*13)*.3;for(let ch=0;ch<2;ch++)buffer.getChannelData(ch)[i]=wave}builtins.set(id,buffer);return buffer}
 async function source(c,id){if(id.startsWith('builtin:'))return builtin(id);const a=c.audio.assets.find(a=>a.id===id);if(!a)throw new Error('找不到音效素材 '+id);return asset(a.src)}
 function events(c){if(!c.audio.enabled||!c.audio.auto.enabled)return[];const base=M.inner(c),end=base.timeline.duration-base.timeline.hold,out=[],push=(t,rate=1)=>{const at=M.timelineTime(c,t);if(out.length&&at-out.at(-1).at<1/c.audio.auto.maxPerSecond-1e-6)return;out.push({at,sourceId:c.audio.auto.sourceId,volume:c.audio.auto.volume,rate})};
  if(c.templateId==='text-match-cut'){let before=-1;for(let t=0;t<=end;t+=1/240){const n=D.Paper.state(base,t).cutIndex;if(n!==before){push(t);before=n}}}
  else if(c.templateId==='number-counter'){base.output.fps=1000;let value=D.Opus.numericState(base,0).value,last=-1,range=Math.max(1,...base.data.keyframes.map(k=>Math.abs(k[1])));const precision=10**base.style.decimals;
   for(let t=1/240;t<=end;t+=1/240){const next=D.Opus.numericState(base,t).value;if(Math.round(next*precision)!==Math.round(value*precision)&&t-last>=1/c.audio.auto.maxPerSecond){push(t,Math.min(1.8,.85+Math.abs(next-value)*240/range));last=t}value=next}}
  else if(c.templateId==='magazine-letters')for(let i=0;i<c.data.letters.length;i++)push(base.timeline.entrance+i*c.options.stagger);
  else if(c.templateId==='paper-unfold')push(base.timeline.entrance);
  return out.filter(e=>e.at<c.timeline.duration);
 }
 let renderedKey,renderedPromise;
 async function render(c){if(!c?.audio?.enabled)return null;const automatic=events(c);if(!automatic.length&&!c.audio.clips.length)return null;const key=JSON.stringify([c.audio,c.timeline,c.templateId,c.data,c.options,c.style.decimals]);if(key===renderedKey)return renderedPromise;renderedKey=key;
  renderedPromise=(async()=>{const offline=new OfflineAudioContext(2,Math.ceil(c.timeline.duration*RATE),RATE);
   const add=async e=>{const buffer=await source(c,e.sourceId),node=offline.createBufferSource(),gain=offline.createGain();node.buffer=buffer;node.playbackRate.value=e.rate;node.connect(gain).connect(offline.destination);
    const start=e.start??e.at,offset=e.trimStart??0,length=Math.min((e.trimEnd??buffer.duration)-offset,(c.timeline.duration-start)*e.rate);if(length<=0)return;
    const duration=length/e.rate,volume=e.volume*c.audio.gain;gain.gain.setValueAtTime(e.fadeIn?0:volume,start);if(e.fadeIn)gain.gain.linearRampToValueAtTime(volume,start+e.fadeIn);if(e.fadeOut){gain.gain.setValueAtTime(volume,start+duration-e.fadeOut);gain.gain.linearRampToValueAtTime(0,start+duration)}
    node.start(start,offset,length)};
   for(const e of [...automatic,...c.audio.clips])await add(e);const mixed=await offline.startRendering();let peak=0;for(let ch=0;ch<2;ch++)for(const v of mixed.getChannelData(ch))peak=Math.max(peak,Math.abs(v));if(peak>.98)for(let ch=0;ch<2;ch++){const a=mixed.getChannelData(ch);for(let i=0;i<a.length;i++)a[i]*=.98/peak}return mixed})();
  try{return await renderedPromise}catch(e){renderedKey=null;throw e}
 }
 async function codecConfig(){if(typeof AudioEncoder==='undefined')throw new Error('当前系统没有 AAC 音频编码器，不能导出带音效的视频');const c={codec:'mp4a.40.2',sampleRate:RATE,numberOfChannels:2,bitrate:192000};if(!(await AudioEncoder.isConfigSupported(c)).supported)throw new Error('当前系统不支持 AAC 音效编码');return c}
 // WebKit's AAC encoder can return a complete MPEG-4 ES descriptor as its
 // codec cookie, while ISO BMFF requires only its DecoderSpecificInfo (ASC).
 function aacMetadata(meta){
  const config=meta?.decoderConfig;if(!config?.description)return meta;
  const original=new Uint8Array(config.description);if(original[0]!==3)return meta;
  function descriptor(pos,end){const tag=original[pos++];let size=0,b,count=0;do{if(pos>=end||count++>=4)throw new Error('AAC 音频头长度无效');b=original[pos++];size=size*128+(b&127)}while(b&128);const stop=pos+size;if(stop>end)throw new Error('AAC 音频头越界');if(tag===5)return original.slice(pos,stop);
   if(tag===3){pos+=2;const flags=original[pos++];if(flags&128)pos+=2;if(flags&64)pos+=1+original[pos];if(flags&32)pos+=2}
   else if(tag===4)pos+=13;else return null;
   while(pos<stop){const found=descriptor(pos,stop);if(found)return found;pos++;let n=0,v;do{v=original[pos++];n=n*128+(v&127)}while(v&128);pos+=n}return null;
  }
  const asc=descriptor(0,original.length);if(!asc?.length)throw new Error('AAC 编码头缺少可用音频配置');return {...meta,decoderConfig:{...config,description:asc.buffer}};
 }
 let delayPromise;
 async function measureDelay(config,chunks,impulse){
  let failure;const decoded=[];
  const decoder=new AudioDecoder({output:a=>{const d=new Float32Array(a.numberOfFrames);a.copyTo(d,{planeIndex:0,format:'f32-planar'});decoded.push({start:Math.round(a.timestamp*RATE/1e6),data:d});a.close()},error:e=>failure=e});
  decoder.configure(config);chunks.forEach(c=>decoder.decode(c));await decoder.flush();decoder.close();if(failure)throw failure;
  let peak=0,position=0;for(const part of decoded)for(let i=0;i<part.data.length;i++)if(Math.abs(part.data[i])>peak){peak=Math.abs(part.data[i]);position=part.start+i}
  const delay=position-impulse;if(peak<.05||delay<0||delay>4096)throw new Error('无法确定 AAC 编码延迟，请更换系统编码器');return delay;
 }
 async function encoderDelay(){
  return delayPromise??=(async()=>{
   const cfg=await codecConfig(),chunks=[];let meta,failure;
   const encoder=new AudioEncoder({output:(c,m)=>{chunks.push(c);if(m?.decoderConfig)meta=m.decoderConfig},error:e=>failure=e});encoder.configure(cfg);
   const size=12000,impulse=4096,data=new Float32Array(size*2);data[impulse]=.8;data[size+impulse]=.8;
   const input=new AudioData({format:'f32-planar',sampleRate:RATE,numberOfFrames:size,numberOfChannels:2,timestamp:0,data});encoder.encode(input);input.close();await encoder.flush();encoder.close();if(failure)throw failure;
   if(typeof AudioDecoder==='undefined')return 2112;
   const asc=aacMetadata({decoderConfig:meta}).decoderConfig;
   try{return await measureDelay(asc,chunks,impulse)}catch{try{return await measureDelay(meta,chunks,impulse)}catch(e){if(e?.name==='EncodingError')return 2112;throw e}}
  })();
 }
 async function encode(buffer,muxer,signal){const cfg=await codecConfig();let failure;const encoder=new AudioEncoder({output:(chunk,meta)=>muxer.addAudioChunk(chunk,aacMetadata(meta)),error:e=>failure=e});try{encoder.configure(cfg);for(let pos=0;pos<buffer.length;pos+=1024){if(signal?.aborted)throw new DOMException('已取消','AbortError');if(failure)throw failure;const n=Math.min(1024,buffer.length-pos),data=new Float32Array(n*2);for(let ch=0;ch<2;ch++)data.set(buffer.getChannelData(ch).subarray(pos,pos+n),ch*n);const audio=new AudioData({format:'f32-planar',sampleRate:RATE,numberOfFrames:n,numberOfChannels:2,timestamp:Math.round(pos/RATE*1e6),data});encoder.encode(audio);audio.close();while(encoder.encodeQueueSize>24)await Promise.race([new Promise(r=>encoder.addEventListener('dequeue',r,{once:true})),new Promise(r=>setTimeout(r,100))])}await encoder.flush();if(failure)throw failure}finally{encoder.close()}}
 let player,when=0,offset=0,activeKey='',pendingKey='',latest={};
 const stop=()=>{if(player){try{player.stop()}catch{}player.disconnect();player=null}};
 function sync(c,t,playing){latest={c,t,playing};if(!playing||!c?.audio?.enabled){stop();pendingKey='';return}const key=JSON.stringify([c.audio,c.timeline,c.data,c.options,c.templateId]);if(player&&(activeKey!==key||Math.abs(offset+context().currentTime-when-t)>.12))stop();if(player||pendingKey===key)return;pendingKey=key;
  render(c).then(async buffer=>{if(pendingKey!==key||!latest.playing||!buffer)return;await context().resume();if(pendingKey!==key||!latest.playing)return;stop();player=context().createBufferSource();player.buffer=buffer;player.connect(context().destination);offset=Math.min(buffer.duration-.001,Math.max(0,latest.t));when=context().currentTime;activeKey=key;pendingKey='';player.start(when,offset)}).catch(e=>{pendingKey='';console.error('音效预览失败',e)})}
 root.addEventListener('pointerdown',()=>{if(decoder?.state==='suspended')decoder.resume()},{capture:true});
 D.MotionMedia=M;D.Audio={events,render,encode,codecConfig,encoderDelay,aacMetadata,sync,stop,builtin,assetInfo:async src=>({duration:(await asset(src)).duration}),prepare:context};
})(window);
