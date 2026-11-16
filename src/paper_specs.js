// Independent Paper Animator style study. Original schema and artwork; no upstream implementation/assets.
(function(root, factory) {
  const spec = factory();
  if (typeof module === 'object' && module.exports) module.exports = spec;
  else root.DMPaperSpec = spec;
})(typeof window === 'object' ? window : globalThis, function() {
  const VERSION = 'paper-canvas-5';
  const specs = {
    'text-match-cut': {name:'文字匹配剪辑', en:'Text Match Cut', title:'理解选择，需要回到使用现场',
      data:{pages:[{heading:'FIELD NOTES / 01',before:'每一次',after:'都值得被听见',body:'从采访记录到研究发现，让关键词保持在同一个位置。'}, {heading:'研究手记 / 02',before:'理解',after:'才能理解选择',body:'不同的人，不同的纸页，同一份真实体验。'}, {heading:'EXPERIENCE / 03',before:'记录',after:'背后的原因',body:'系统、影像、续航与每一天的使用感受。'}]},
      options:{keyword:'用户体验',paperCount:40,cutSeconds:1/9,fontPair:'gothic-serif',articleScale:1.65,contextBlur:6,focusPadding:180,contextDimming:0,wrinkleStrength:0.65,inkWear:0.12,highlight:true,highlightColor:'#DCE337',paperColor:'#E9E8E0',texture:0.3,seed:31}},
    'paper-cutout': {name:'纸张剪贴',en:'Paper Cutout',title:'把体验剪进研究手记',
      data:{items:[{label:'自制示意素材',src:'',caption:'替换为你自己的图片或透明 PNG'}]},
      options:{tear:12,texture:0.5,thickness:6,shadow:0.35,paperColor:'#FFF8EA',backing:true,entry:'slide',entrySeconds:1.2,tilt:-5,seed:43}},
    'paper-unfold': {name:'折纸展开',en:'Paper Unfold',title:'一层一层，展开研究发现',
      data:{panels:[{heading:'01 / 听见',body:'从用户原声开始。'},{heading:'02 / 理解',body:'梳理操作、场景和原因。'},{heading:'03 / 发现',body:'让证据连接成清晰结论。'},{heading:'04 / 行动',body:'把发现转化为改进方向。'}]},
      options:{direction:'right',segments:4,unfoldSeconds:2.8,paperColor:'#FFF6DF',texture:0.35,shadow:0.5,seed:19}},
    'magazine-letters': {name:'杂志剪字',en:'Magazine Letters',title:'让用户的声音被看见',
      data:{letters:Array.from('重构真实体验').map((text,i)=>({text,font:['local-gothic','system-serif','system-sans'][i%3],paper:['#E5B63E','#E76145','#EEE8D9','#243449'][i%4],ink:i%4===3?'#FFF8EA':'#202B35',tilt:[-8,5,-3,9][i%4]}))},
      options:{stagger:0.12,entrySeconds:0.8,spread:0.8,texture:0.5,tear:7,seed:73}}
  };
  const articleDefaults={image:'',focusX:0.5,focusY:0.5,focusWidth:0.3,focusHeight:0.06};
  const prose = [
    '一项产品的体验，往往藏在不被刻意记录的日常里。早上出门时能否迅速完成常用操作，通勤途中是否愿意打开某项功能，夜晚回到家后电量是否仍让人安心，这些具体情境比抽象的评价更能解释选择。研究应当回到使用现场，记录一次操作发生之前的目标，以及完成之后的感受。\n\n访谈中的一句话需要放回完整上下文。相同的抱怨可能来自不同的任务，相似的满意也可能对应不同的期待。整理材料时，应区分亲身经历、他人评价与事后解释，并保留受访者自己的措辞。只有让原始记录与分析过程相互对应，结论才便于被复核和继续讨论。\n\n从单个故事走向整体发现，还需要仔细检查适用范围。哪些人经历过相似场景，哪些情况构成例外，已有记录是否足以支撑判断，这些问题都应在展示时得到说明。本文为版式演示文案，不构成真实调查报道或产品评价。',
    '面对许多功能相近的产品，人们未必会按照参数表依次做出选择。一次顺手的操作，一段可靠的使用经历，或某个终于被解决的小问题，都可能改变对产品的整体判断。研究者需要理解这些片段如何累积，并在之后的访谈与追踪中检验最初的解释。\n\n把记录整理成文章，并不意味着删掉复杂的部分。不同场景之间的差异、受访者表达中的犹豫，以及观察与自我描述之间的不一致，都可能是进一步追问的线索。好的分析应当让这些线索保持可见，而不是只留下一个漂亮的结论。\n\n在展示中引用一句原话时，应说明它发生的情境，并避免把个别感受直接推广为所有人的看法。文字、图表与案例共同承担解释的工作，具体数字和来源则需要由真实研究材料提供。这里展示的内容仅用于检验文字排版与匹配剪辑效果。',
    '观察产品如何进入生活，比单独询问喜好更接近研究问题本身。人们在不同时间、地点和任务中使用设备，有时追求效率，有时需要表达，也有时只是希望顺利完成一件小事。让这些具体需求在材料中被看见，是后续比较与讨论的基础。\n\n编辑研究记录时，关键词不应脱离原来的句子。词语前后的解释、提出问题的方式、受访者描述的动作，都会影响读者如何理解引用。保留足够的文字背景，可以让重点自然浮现，也让观看者知道这句话为什么值得注意。\n\n一份可继续修改的研究表达，应当允许回到原始材料，替换案例、修订措辞，并重新检查证据与观点之间的关系。无论最后呈现为文章、卡片还是视频，清晰的上下文都比装饰更重要。本页为自制演示文案，未引用任何真实媒体报道。'
  ];
  specs['text-match-cut'].data.pages.forEach((p,i)=>Object.assign(p,articleDefaults,{heading:['观察笔记 · 使用场景','研究手记 · 访谈方法','现场记录 · 体验与选择'][i],body:prose[i]}));
  const contexts=[['每一次','都值得被听见'],['研究者如何理解','背后的选择'],['走近','发生的现场'],['真实场景中的','需要持续观察'],['让','成为改进的起点'],['为什么','值得被认真记录'],['在日常之中理解','的意义'],['从','出发，重新提出问题'],['回到具体任务，观察','如何发生'],['研究让我们看见','背后的原因']];
  specs['text-match-cut'].data.pages=contexts.map(([before,after],i)=>({...specs['text-match-cut'].data.pages[i%3],before,after}));
  const ids=Object.keys(specs), clone=v=>JSON.parse(JSON.stringify(v));
  const error=(path,msg)=>{throw new Error(path+': '+msg)};
  const keys=(v,allowed,path)=>{if(!v||typeof v!=='object'||Array.isArray(v)) error(path,'必须为对象');for(const k of Object.keys(v))if(!allowed.includes(k))error(path+'.'+k,'不支持的字段')};
  const number=(v,path,min,max,int=false)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(int&&!Number.isInteger(v)))error(path,`需要 ${min}–${max} 的${int?'整数':'数字'}`)};
  const string=(v,path,max)=>{if(typeof v!=='string'||Array.from(v).length>max)error(path,`文字最多 ${max} 字`)};
  const choice=(v,x,path)=>{if(!x.includes(v))error(path,'可选 '+x.join(' / '))};
  const color=(v,path)=>{if(typeof v!=='string'||!/^#[a-f0-9]{6}$/i.test(v))error(path,'需要 #RRGGBB')};
  function validate(c) {
    const o=c.options,d=c.data,id=c.templateId;
    number(o.seed,'options.seed',0,1e9,true);number(o.texture,'options.texture',0,1);
    const spec=columns(id);keys(d,[spec.key],'data');
    if(!Array.isArray(d[spec.key])||d[spec.key].length<1||d[spec.key].length>spec.max)error('data.'+spec.key,`需要 1–${spec.max} 项`);
    d[spec.key].forEach((r,i)=>{
      const p=`data.${spec.key}[${i}]`;keys(r,spec.fields,p);
      for(const f of spec.fields) {
        if(['focusX','focusY','focusWidth','focusHeight'].includes(f))number(r[f],p+'.'+f,f.includes('Width')||f.includes('Height')?0.005:0,1);
        else if(f==='tilt')number(r[f],p+'.tilt',-30,30);
        else if(['paper','ink'].includes(f))color(r[f],p+'.'+f);
        else if(f==='src'||f==='image') {string(r[f],p+'.src',16800000);if(r[f]&&!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(r[f]))error(p+'.src','请导入本地 PNG / JPEG / WebP，素材内嵌保存');}
        else string(r[f],p+'.'+f,f==='body'?6000:f==='text'?1:100);
      }
      if(r.text!==undefined&&!r.text.length)error(p+'.text','字片不能为空');
      if(r.font)choice(r.font,['local-gothic','system-sans','system-serif'],p+'.font');
    });
    if(id==='text-match-cut') {
      string(o.keyword,'options.keyword',18);if(!o.keyword.trim())error('options.keyword','关键词不能为空');
      number(o.wrinkleStrength,'options.wrinkleStrength',0,1);number(o.inkWear,'options.inkWear',0,1);
      number(o.articleScale,'options.articleScale',0.6,2);number(o.contextBlur,'options.contextBlur',0,32);number(o.focusPadding,'options.focusPadding',10,400);number(o.contextDimming,'options.contextDimming',0,0.8);
      number(o.paperCount,'options.paperCount',1,40,true);number(o.cutSeconds,'options.cutSeconds',0.05,5);
      choice(o.fontPair,['gothic-serif','sans-gothic','serif-sans'],'options.fontPair');color(o.highlightColor,'options.highlightColor');color(o.paperColor,'options.paperColor');
      if((o.paperCount-1)*o.cutSeconds>c.timeline.duration-c.timeline.entrance-c.timeline.hold)error('options.paperCount','纸张切换总时长超出时间线，请减少数量/切换秒数或增加持续时间');
    } else if(id==='paper-cutout') {
      number(o.tear,'options.tear',0,30);number(o.thickness,'options.thickness',0,20);number(o.shadow,'options.shadow',0,1);number(o.tilt,'options.tilt',-20,20);
      choice(o.entry,['slide','pop','drop'],'options.entry');number(o.entrySeconds,'options.entrySeconds',0.1,c.timeline.duration-c.timeline.entrance-c.timeline.hold);color(o.paperColor,'options.paperColor');
    } else if(id==='paper-unfold') {
      choice(o.direction,['right','left','down','up'],'options.direction');number(o.segments,'options.segments',2,8,true);if(d.panels.length>o.segments)error('options.segments','分段数不能少于内容行数；请先删除多余内容行');
      number(o.unfoldSeconds,'options.unfoldSeconds',0.2,c.timeline.duration-c.timeline.entrance-c.timeline.hold);number(o.shadow,'options.shadow',0,1);color(o.paperColor,'options.paperColor');
    } else {
      number(o.stagger,'options.stagger',0,0.6);number(o.entrySeconds,'options.entrySeconds',0.1,3);number(o.spread,'options.spread',0,1);number(o.tear,'options.tear',0,20);
      if((d.letters.length-1)*o.stagger+o.entrySeconds>c.timeline.duration-c.timeline.entrance-c.timeline.hold)error('options.stagger','逐字入场超出时间线，请减少间隔或增加持续时间');
    }
  }
  function columns(id) {
    return {
      'text-match-cut':{key:'pages',fields:['heading','before','after','body','image','focusX','focusY','focusWidth','focusHeight'],max:20},
      'paper-cutout':{key:'items',fields:['label','src','caption'],max:1},
      'paper-unfold':{key:'panels',fields:['heading','body'],max:8},
      'magazine-letters':{key:'letters',fields:['text','font','paper','ink','tilt'],max:30}
    }[id];
  }
  function table(c) {const s=columns(c.templateId);return [s.fields,...c.data[s.key].map(r=>s.fields.map(k=>r[k]))]}
  function importRows(c,head,rows) {
    const s=columns(c.templateId);if(c.templateId==='text-match-cut'&&head.length===4){head=s.fields;rows=rows.map(r=>[...r,'',0.5,0.5,0.3,0.06].map(String))};if(JSON.stringify(head)!==JSON.stringify(s.fields))error('CSV 表头','需要 '+s.fields.join(','));
    return {[s.key]:rows.map((row,i)=>Object.fromEntries(s.fields.map((k,j)=>{if(['tilt','focusX','focusY','focusWidth','focusHeight'].includes(k)){if(!row[j].trim()||!Number.isFinite(Number(row[j])))error(`CSV 第${i+2}行.${k}`,'需要数字');return [k,Number(row[j])]}return[k,row[j]]}))) };
  }
  function letters(text, previous=[]) {
    string(text,'剪字文案',30);if(!text.length)error('剪字文案','请输入文字');
    return Array.from(text).map((ch,i)=>({...clone(previous[i] || specs['magazine-letters'].data.letters[i%6]),text:ch}));
  }
  function migrate(c) {
    if(!c||!ids.includes(c.templateId)||!['paper-canvas-1','paper-canvas-2','paper-canvas-3','paper-canvas-4',VERSION].includes(c.templateVersion))return c;
    const next=clone(c);next.templateVersion=VERSION;
    if(next.templateId==='text-match-cut'){
      next.options={articleScale:1.65,contextBlur:6,focusPadding:180,contextDimming:0,wrinkleStrength:0.65,inkWear:0.12,...next.options};
      if(c.templateVersion!==VERSION && [1.2,12].includes(next.options.contextBlur) && next.options.focusPadding===100 && next.options.contextDimming===.3){next.options.contextBlur=6;next.options.focusPadding=180;next.options.contextDimming=0}
      if(Array.isArray(next.data?.pages))next.data.pages=next.data.pages.map(p=>({...articleDefaults,...p}));
    }return next;
  }
  return {VERSION,ids,specs,validate,table,importRows,clone,letters,migrate};
});
