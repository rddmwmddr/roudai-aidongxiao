// Shared validated pauses/audio config for AI, the inspector, preview and MP4 export.
(function(root,factory){const x=factory();if(typeof module==='object'&&module.exports)module.exports=x;else root.DMMediaSpec=x})(globalThis,()=>{
 const clone=v=>JSON.parse(JSON.stringify(v)),fail=(p,s)=>{throw new Error(p+': '+s)};
 const num=(v,p,lo,hi)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)fail(p,`需要 ${lo}–${hi} 的数字`)};
 const keys=(v,list,p)=>{if(!v||typeof v!=='object'||Array.isArray(v))fail(p,'必须为对象');for(const k of Object.keys(v))if(!list.includes(k))fail(p+'.'+k,'不支持的字段')};
 const text=(v,p,n)=>{if(typeof v!=='string'||v.length>n)fail(p,`文字最多 ${n} 字`)};
 const defaults=()=>({enabled:false,gain:.7,auto:{enabled:false,sourceId:'builtin:tick',volume:.45,maxPerSecond:12},assets:[],clips:[]});
 function normalize(c){c=clone(c);c.audio??=defaults();c.timeline.pauses??=[];return c}
 function validate(c){
  const pauses=c.timeline.pauses;if(!Array.isArray(pauses)||pauses.length>20)fail('timeline.pauses','最多20个停顿');
  let prev=-1,total=0;const seen=new Set();
  for(const [i,p]of pauses.entries()){const at=`timeline.pauses[${i}]`;keys(p,['id','at','duration'],at);text(p.id,at+'.id',100);if(!p.id||seen.has(p.id))fail(at+'.id','需要唯一ID');seen.add(p.id);num(p.at,at+'.at',0,c.timeline.duration);num(p.duration,at+'.duration',.05,120);if(p.at<=prev)fail(at+'.at','停顿位置须递增且不能重复');prev=p.at;total+=p.duration}
  const base=c.timeline.duration-total;if(base<=c.timeline.entrance+c.timeline.hold)fail('timeline.pauses','停顿总时长过长，须增加持续时间');
  for(const [i,p]of pauses.entries())if(p.at>=base)fail(`timeline.pauses[${i}].at`,'超出原动效时间');
  const a=c.audio;keys(a,['enabled','gain','auto','assets','clips'],'audio');if(typeof a.enabled!=='boolean')fail('audio.enabled','需要布尔值');num(a.gain,'audio.gain',0,2);
  keys(a.auto,['enabled','sourceId','volume','maxPerSecond'],'audio.auto');if(typeof a.auto.enabled!=='boolean')fail('audio.auto.enabled','需要布尔值');num(a.auto.volume,'audio.auto.volume',0,2);num(a.auto.maxPerSecond,'audio.auto.maxPerSecond',1,24);
  if(!Array.isArray(a.assets)||a.assets.length>20)fail('audio.assets','最多20项');if(!Array.isArray(a.clips)||a.clips.length>40)fail('audio.clips','最多40段');
  const ids=new Set(['builtin:tick','builtin:paper','builtin:pop']),lengths=new Map([['builtin:tick',.045],['builtin:paper',.12],['builtin:pop',.09]]);
  a.assets.forEach((r,i)=>{const p=`audio.assets[${i}]`;keys(r,['id','name','src','duration'],p);text(r.id,p+'.id',100);if(!r.id||ids.has(r.id))fail(p+'.id','需要唯一ID');ids.add(r.id);text(r.name,p+'.name',200);text(r.src,p+'.src',28000000);if(!/^data:audio\/[A-Za-z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/.test(r.src))fail(p+'.src','请导入本地音频');num(r.duration,p+'.duration',.001,600);lengths.set(r.id,r.duration)});
  if(!ids.has(a.auto.sourceId))fail('audio.auto.sourceId','找不到音效素材');const clips=new Set();
  a.clips.forEach((r,i)=>{const p=`audio.clips[${i}]`;keys(r,['id','sourceId','start','trimStart','trimEnd','volume','rate','fadeIn','fadeOut'],p);text(r.id,p+'.id',100);if(!r.id||clips.has(r.id))fail(p+'.id','需要唯一ID');clips.add(r.id);if(!ids.has(r.sourceId))fail(p+'.sourceId','找不到音效素材');num(r.start,p+'.start',0,c.timeline.duration);num(r.trimStart,p+'.trimStart',0,lengths.get(r.sourceId));num(r.trimEnd,p+'.trimEnd',.001,lengths.get(r.sourceId)+.000001);if(r.trimEnd<=r.trimStart)fail(p+'.trimEnd','结束须晚于裁切起点');num(r.volume,p+'.volume',0,2);num(r.rate,p+'.rate',.25,4);const duration=(r.trimEnd-r.trimStart)/r.rate;for(const k of ['fadeIn','fadeOut'])num(r[k],p+'.'+k,0,duration);if(r.fadeIn+r.fadeOut>duration+.000001)fail(p+'.fadeOut','淡入淡出之和超过片段时长');if(r.start+duration>c.timeline.duration+.00001)fail(p+'.start','音效超出镜头时长，请移动或裁切')});
 }
 const baseDuration=c=>c.timeline.duration-(c.timeline.pauses||[]).reduce((s,p)=>s+p.duration,0);
 function motionTime(c,t){let elapsed=0;for(const p of c.timeline.pauses||[]){const start=p.at+elapsed;if(t<start)break;if(t<start+p.duration)return p.at;elapsed+=p.duration}return Math.max(0,Math.min(baseDuration(c),t-elapsed))}
 const timelineTime=(c,t)=>t+(c.timeline.pauses||[]).filter(p=>p.at<t-1e-8).reduce((s,p)=>s+p.duration,0);
 function inner(c){const next=clone(c);next.timeline.duration=baseDuration(c);next.timeline.pauses=[];next.timeline.currentTime=Math.min(next.timeline.duration,motionTime(c,c.timeline.currentTime));return next}
 return {defaults,normalize,validate,baseDuration,motionTime,timelineTime,inner};
});
