// 生成文件，不要手改。由 tools/import_lieflat.py 从 vendor/lieflat-charts 生成。
/* Lieflat Charts, https://github.com/larashero3-dotcom/lieflat-charts
# PolyForm Noncommercial License 1.0.0

<https://polyformproject.org/licenses/noncommercial/1.0.0>

## Acceptance

In order to get any license under these terms, you must agree
to them as both strict obligations and conditions to all
your licenses.

## Copyright License

The licensor grants you a copyright license for the
software to do everything you might do with the software
that would otherwise infringe the licensor's copyright
in it for any permitted purpose.  However, you may
only distribute the software according to [Distribution
License](#distribution-license) and make changes or new works
based on the software according to [Changes and New Works
License](#changes-and-new-works-license).

## Distribution License

The licensor grants you an additional copyright license
to distribute copies of the software.  Your license
to distribute covers distributing the software with
changes and new works permitted by [Changes and New Works
License](#changes-and-new-works-license).

## Notices

You must ensure that anyone who gets a copy of any part of
the software from you also gets a copy of these terms or the
URL for them above, as well as copies of any plain-text lines
beginning with `Required Notice:` that the licensor provided
with the software.  For example:

> Required Notice: Copyright Yoyodyne, Inc. (http://example.com)

## Changes and New Works License

The licensor grants you an additional copyright license to
make changes and new works based on the software for any
permitted purpose.

## Patent License

The licensor grants you a patent license for the software that
covers patent claims the licensor can license, or becomes able
to license, that you would infringe by using the software.

## Noncommercial Purposes

Any noncommercial purpose is a permitted purpose.

## Personal Uses

Personal use for research, experiment, and testing for
the benefit of public knowledge, personal study, private
entertainment, hobby projects, amateur pursuits, or religious
observance, without any anticipated commercial application,
is use for a permitted purpose.

## Noncommercial Organizations

Use by any charitable organization, educational institution,
public research organization, public safety or health
organization, environmental protection organization,
or government institution is use for a permitted purpose
regardless of the source of funding or obligations resulting
from the funding.

## Fair Use

You may have "fair use" rights for the software under the
law. These terms do not limit them.

## No Other Rights

These terms do not allow you to sublicense or transfer any of
your licenses to anyone else, or prevent the licensor from
granting licenses to anyone else.  These terms do not imply
any other licenses.

## Patent Defense

If you make any written claim that the software infringes or
contributes to infringement of any patent, your patent license
for the software granted under these terms ends immediately. If
your company makes such a claim, your patent license ends
immediately for work on behalf of your company.

## Violations

The first time you are notified in writing that you have
violated any of these terms, or done anything with the software
not covered by your licenses, your licenses can nonetheless
continue if you come into full compliance with these terms,
and take practical steps to correct past violations, within
32 days of receiving notice.  Otherwise, all your licenses
end immediately.

## No Liability

***As far as the law allows, the software comes as is, without
any warranty or condition, and the licensor will not be liable
to you for any damages arising out of these terms or the use
or nature of the software, under any kind of legal claim.***

## Definitions

The **licensor** is the individual or entity offering these
terms, and the **software** is the software the licensor makes
available under these terms.

**You** refers to the individual or entity agreeing to these
terms.

**Your company** is any legal entity, sole proprietorship,
or other kind of organization that you work for, plus all
organizations that have control over, are under the control of,
or are under common control with that organization.  **Control**
means ownership of substantially all the assets of an entity,
or the power to direct its management and policies by vote,
contract, or otherwise.  Control can be direct or indirect.

**Your licenses** are all the licenses granted to you for the
software under these terms.

**Use** means anything you do with the software requiring one
of your licenses.
*/
(function (root) {
  'use strict';
  const CHARTS = {};
  const ZH = {"labels": {"Editor": "编辑器", "EDITOR": "编辑器", "Boards": "看板", "BOARDS": "看板", "Docs": "文档", "DOCS": "文档", "Chat": "聊天", "CHAT": "聊天", "Flows": "流程", "FLOWS": "流程", "Vault": "资料库", "VAULT": "资料库", "Pages": "页面", "PAGES": "页面", "Sync": "同步", "SYNC": "同步", "Grid": "表格", "GRID": "表格", "Views": "视图", "VIEWS": "视图", "Hub": "中心", "HUB": "中心", "Forms": "表单", "FORMS": "表单", "QUOTA": "配额", "DISK": "磁盘", "CERT": "证书", "CACHE": "缓存", "QUEUE": "队列", "LOCK": "锁", "OOM": "内存溢出", "NET": "网络", "3P API": "第三方接口", "CONFIG": "配置", "DB": "数据库", "DEPLOY": "部署", "CODE": "代码", "HUMAN": "人为", "JAN": "一月", "FEB": "二月", "MAR": "三月", "APR": "四月", "MAY": "五月", "JUN": "六月", "JUL": "七月", "AUG": "八月", "SEP": "九月", "OCT": "十月", "NOV": "十一月", "DEC": "十二月", "MON": "周一", "TUE": "周二", "WED": "周三", "THU": "周四", "FRI": "周五", "SAT": "周六", "SUN": "周日", "SF": "旧金山", "NYC": "纽约", "LON": "伦敦", "BER": "柏林", "TOK": "东京", "SYD": "悉尼", "SIN": "新加坡", "PAR": "巴黎", "AMS": "阿姆斯特丹", "TOR": "多伦多", "SEO": "首尔", "SAO": "圣保罗", "PERF": "性能", "INTEGRATIONS": "集成", "PRICING": "定价", "MOBILE": "移动端", "UX": "体验", "CORE": "核心", "PLUGINS": "插件", "THEMES": "主题", "FORKS": "分支", "MIRRORS": "镜像", "FRIEND": "朋友", "AUTHORITY": "权威", "SERIOUS": "严肃", "PLAYFUL": "活泼", "RELIABLE": "可靠", "RISK-TAKING": "敢冒险", "CONTEMPORARY": "当代", "CLASSIC": "经典", "● US    ● COMPETITORS A · B · C": "● 我们    ● 竞品 A · B · C", "PLATFORM": "平台", "GROWTH": "增长", "INFRA": "基础设施", "ML": "机器学习", "DESIGN": "设计", "FRONTEND": "前端", "BACKEND": "后端", "DATA": "数据", "SECURITY": "安全", "Dark mode": "深色模式", "Kanban": "看板", "Wikis": "知识库", "Slash cmds": "斜杠命令", "Templates": "模板", "Inbox": "收件箱", "Live cursors": "实时光标", "AI drafts": "AI 草稿", "Voice notes": "语音笔记", "Offline": "离线", "GET THROUGH": "通过", "VISITORS": "访客", "SIGN-UPS": "注册", "ACTIVATED": "激活", "RETAINED": "留存", "PAYING": "付费", "CHARGED": "投入", "TORN": "纠结", "ADRIFT": "观望", "AVERSE": "抵触", "DO MORE WITH THE SAME PAY": "同样的工资干更多活", "AN UNSUSTAINABLE PACE": "节奏撑不下去", "QUALITY OF WORK SLIPPING": "工作质量下滑", "BEING REPLACED OUTRIGHT": "被直接替代", "DESKTOP": "桌面端", "API": "接口", "IMPORTS": "导入", "BATCH": "批处理", "PRICE $": "价格", "CSAT": "满意度", "RETENTION %": "留存 %", "GROWTH %": "增长 %", "FREE": "免费版", "STARTER": "入门版", "PRO": "专业版", "TEAM": "团队版", "SCALE": "规模版", "ENT": "企业版", "ORGANIC": "自然", "PAID": "付费", "REFERRAL": "推荐", "SOCIAL": "社交", "TICKS · ONE = 1%": "一格 = 1%", "NA": "北美", "EU": "欧洲", "APAC": "亚太", "LATAM": "拉美", "ADD-ONS": "增值", "SERVICES": "服务", "CHEAP": "便宜", "PREMIUM": "高端", "HAPPIER ↑": "更满意 ↑", "INVITE FLOW": "邀请流程", "FIRST BOARD": "第一个看板", "IMPORT DATA": "导入数据", "TEAM SETUP": "团队设置", "GO LIVE": "上线", "FASTER ←": "更快 ←", "MINUTES": "分钟", "HALF RESOLVED BY HERE": "一半已解决", "LEGACY EDITOR": "旧版编辑器", "SEARCH": "搜索", "OTHER": "其他", "core": "核心", "ui": "界面", "api": "接口", "data": "数据", "auth": "认证", "sync": "同步", "mail": "邮件", "flag": "开关", "edge": "边缘", "doc": "文档", "bot": "机器人", "kit": "套件", "svc": "服务", "web": "网页", "cli": "终端", "db": "数据库", "gw": "网关", "sdk": "开发包", "jobs": "任务"}, "perChart": {"fall": {"GROSS": "总收入", "REFUNDS": "退款", "COGS": "成本", "OPS": "运营", "NET": "净利"}}, "captions": {"patchwork": "描边 = 触发过事故", "hundredfield": "一个点 = 一个人", "ballottally": "一格 = 一位受访者 · 每十格一个点", "matheat": "颜色深浅 = 数量", "calheat": "一个点 = 一天 · 点的大小 = 部署次数", "ridge": "每个波峰 = 一条流水线 · 点 = 峰值", "parallel": "一根线 = 一个产品 · 深色 = 综合最好", "rungs": "一格 = 1 千元 · 每五格一个点", "dayline": "一个点 = 一天 · 空心 = 周末", "hairarea": "一根线 = 一天", "tickdonut": "十二点方向是起点 · 每十格一个点 · 顺时针读", "tickrows": "一格 = 一次发布 · 每五格一个点", "pairrungs": "浅色 = 去年 · 深色 = 今年 · 一格 = 1 千元", "stackrungs": "最深 = 核心业务 · 中间 = 增值 · 最浅 = 服务 · 一格 = 1 千元", "plumb": "每个点垂一条线 · 在底部读横轴", "fall": "实线是加 · 虚线是减 · 一格 = 1 千元", "dotheat": "点的大小 = 工单数 · 虚线圈 = 峰值", "gauge": "一格 = 目标的 1% · 深色 = 已完成", "dumbbell": "一颗珠子 = 省下一分钟 · 空心 = 之前 · 实心 = 之后", "histo": "一格 = 一百张工单里的一张 · 每段两小时 · 每五格一个点", "boxplot": "方框 = 中间一半 · 白线 = 中位数 · 空心 = 异常值", "stream": "带宽 = 周活 · 最深 = 现在第一 · 整条河是总量", "candle": "实心 = 收跌 · 空心 = 收涨 · 细线 = 当天最高最低", "violin": "宽度 = 等这么久的工单数 · 白线 = 中位数", "gheat": "颜色深浅 = 使用率", "rankstrip": "一格 = 当季名次 · 第一名最深 · 每行从左往右读", "sankey": "带宽 = 每百个账号 · 颜色 = 渠道"}};
  const META = {"fan":{"dark":false,"viewBox":[0.0,0.0,400.0,320.0],"title":"Twelve features, fanned out","gallery":"lupi-gallery","names":["FEAT","LAUNCH"]},"cascade":{"dark":true,"viewBox":[0.0,0.0,400.0,320.0],"title":"What breaks, stacked and ranked","gallery":"lupi-gallery","names":["CAUSE","COUNT"]},"barcode":{"dark":false,"viewBox":[0.0,0.0,800.0,300.0],"title":"Ninety days as a barcode","gallery":"lupi-gallery","names":["N","values"]},"arcmatrix":{"dark":false,"viewBox":[0.0,0.0,430.0,320.0],"title":"Eight products land in twelve cities","gallery":"lupi-gallery","names":["PROD","CITY","W"]},"converge":{"dark":false,"viewBox":[0.0,0.0,400.0,320.0],"title":"48 requests pull toward five themes","gallery":"lupi-gallery","names":["THEME"]},"clusters":{"dark":false,"viewBox":[0.0,0.0,840.0,320.0],"title":"The contributor field","gallery":"lupi-gallery","names":["SAT"]},"spectrum":{"dark":false,"viewBox":[0.0,0.0,460.0,300.0],"title":"Where the brand sits","gallery":"lupi-gallery","names":["ROWS","US","COMP"]},"dotty":{"dark":false,"viewBox":[0.0,0.0,400.0,372.0],"title":"Four squads, stacked in space","gallery":"lupi-gallery","names":["SQUAD","SHADE"]},"almanac":{"dark":false,"viewBox":[0.0,0.0,840.0,400.0],"title":"Eight years of tickets, one almanac","gallery":"lupi-gallery","names":["AREAS","BETA","BORN"]},"patchwork":{"dark":false,"viewBox":[0.0,0.0,400.0,320.0],"title":"A quarter of deploys, overlaid","gallery":"lupi-gallery","names":[]},"lineage":{"dark":false,"viewBox":[0.0,0.0,400.0,340.0],"title":"Features rise, fall, come back","gallery":"lupi-gallery","names":["TR"]},"colonnade":{"dark":false,"viewBox":[0.0,0.0,400.0,320.0],"title":"Forty-four repos, ten owners","gallery":"lupi-gallery","names":["TEAM"]},"hourglass":{"dark":false,"viewBox":[0.0,0.0,400.0,330.0],"title":"The funnel, poured","gallery":"lupi-gallery","names":["STAGE"]},"hundredfield":{"dark":false,"viewBox":[0.0,0.0,400.0,320.0],"title":"A hundred of us, four minds","gallery":"lupi-gallery","names":["SEG","POS"]},"ballottally":{"dark":false,"viewBox":[0.0,0.0,400.0,320.0],"title":"What they fear, tick by tick","gallery":"lupi-gallery","names":["ASK"]},"matheat":{"dark":false,"viewBox":[0.0,0.0,400.0,320.0],"title":"Which features get used together","gallery":"lupi-gallery","names":["FEAT","LG"]},"calheat":{"dark":false,"viewBox":[0.0,0.0,840.0,232.0],"title":"A year of deploys, day by day","gallery":"lupi-gallery","names":["MON","DAY"]},"ridge":{"dark":false,"viewBox":[0.0,0.0,400.0,320.0],"title":"Five pipelines, five tempos","gallery":"lupi-gallery","names":["ROWS"]},"parallel":{"dark":false,"viewBox":[0.0,0.0,400.0,320.0],"title":"Twelve products, four dimensions","gallery":"lupi-gallery","names":["DIMS","P"]},"rungs":{"dark":false,"viewBox":[0.0,0.0,400.0,320.0],"title":"Revenue by plan, rung by rung","gallery":"basics-gallery","names":["D"]},"dayline":{"dark":false,"viewBox":[0.0,0.0,400.0,320.0],"title":"Thirty days of sign-ups","gallery":"basics-gallery","names":["N","values"]},"hairarea":{"dark":false,"viewBox":[0.0,0.0,400.0,320.0],"title":"Concurrent users, filled with days","gallery":"basics-gallery","names":["N","values"]},"tickdonut":{"dark":false,"viewBox":[0.0,0.0,400.0,320.0],"title":"Where the traffic comes from","gallery":"basics-gallery","names":["D"]},"tickrows":{"dark":false,"viewBox":[0.0,0.0,400.0,320.0],"title":"Six teams, shipped and counted","gallery":"basics-gallery","names":["D"]},"pairrungs":{"dark":false,"viewBox":[0.0,0.0,400.0,320.0],"title":"This year against last, plan by plan","gallery":"basics-gallery","names":["D"]},"stackrungs":{"dark":false,"viewBox":[0.0,0.0,400.0,320.0],"title":"Where each region's revenue sits","gallery":"basics-gallery","names":["D","SHADE","SEG"]},"plumb":{"dark":false,"viewBox":[0.0,0.0,400.0,320.0],"title":"Price against satisfaction, twelve products","gallery":"basics-gallery","names":["P"]},"fall":{"dark":false,"viewBox":[0.0,0.0,400.0,320.0],"title":"From gross to net, step by step","gallery":"basics-gallery","names":["D"]},"dotheat":{"dark":false,"viewBox":[0.0,0.0,400.0,320.0],"title":"When support gets loud","gallery":"basics-gallery","names":["DAY"]},"gauge":{"dark":false,"viewBox":[0.0,0.0,400.0,320.0],"title":"How far to the quarter's goal","gallery":"basics-gallery","names":["GOAL"]},"dumbbell":{"dark":false,"viewBox":[0.0,0.0,400.0,320.0],"title":"Onboarding, before and after the redesign","gallery":"basics-gallery","names":["D"]},"histo":{"dark":false,"viewBox":[0.0,0.0,400.0,320.0],"title":"Where the work went","gallery":"basics-gallery","names":["BIN"]},"boxplot":{"dark":false,"viewBox":[0.0,0.0,400.0,320.0],"title":"Reply times, boxed by plan","gallery":"basics-gallery","names":["G","SHADE"]},"stream":{"dark":false,"viewBox":[0.0,0.0,840.0,300.0],"title":"Three products trade the same river","gallery":"basics-gallery","names":["SERIES"]},"candle":{"dark":false,"viewBox":[0.0,0.0,400.0,320.0],"title":"Six weeks of the token, candle by candle","gallery":"basics-gallery","names":[]},"violin":{"dark":false,"viewBox":[0.0,0.0,400.0,320.0],"title":"Trees planted, year by year","gallery":"glance-gallery","names":["G","SHADE"]},"gheat":{"dark":false,"viewBox":[0.0,0.0,400.0,320.0],"title":"Adoption runs hot on the new versions","gallery":"glance-gallery","names":["FEAT","VER","BASEV"]},"rankstrip":{"dark":false,"viewBox":[0.0,0.0,400.0,320.0],"title":"Flows climbs to the top","gallery":"glance-gallery","names":["RANKS","SHADE"]},"sankey":{"dark":false,"viewBox":[0.0,0.0,400.0,320.0],"title":"Channels pour into plans","gallery":"glance-gallery","names":["SRC","DST","SH"]}};
  const make_lupi_gallery = (el, txt, tip, obsReveal, __data, __fn, __cell) => {
  const none = new Proxy(function () {}, {get: (t, k) => (k === Symbol.toPrimitive ? () => '' : none), apply: () => none, construct: () => none, set: () => true});
  const Chart = none, echarts = none;

// ── shared Mono tokens ──
const INK='#1C1C1A',PAPER='#F0EFEB',MUTED='#8F8E88',GRID='#DEDDD6';
const NS='http://www.w3.org/2000/svg';



const rnd=(i,k)=>Math.abs(((i*73856093)^(k*19349663))%1000)/1000; // deterministic
const D2R=Math.PI/180;
const pol=(cx,cy,r,deg)=>[cx+r*Math.cos(deg*D2R),cy+r*Math.sin(deg*D2R)];
const sect=(cx,cy,r0,r1,a0,a1)=>{
  const big=a1-a0>180?1:0;
  const [xa,ya]=pol(cx,cy,r1,a0),[xb,yb]=pol(cx,cy,r1,a1);
  const [xc,yc]=pol(cx,cy,r0,a1),[xd,yd]=pol(cx,cy,r0,a0);
  return `M${xa} ${ya} A${r1} ${r1} 0 ${big} 1 ${xb} ${yb} L${xc} ${yc} A${r0} ${r0} 0 ${big} 0 ${xd} ${yd} Z`;
};
// unified reveal: draw when scrolled into view; click replays


// ════ 1 · launch fan ════
// spokes sorted by launch week → the big dots cascade along a diagonal arc

    return {
    "fan": () => {

const FEAT=__data("FEAT",['Editor','Boards','Docs','Chat','Flows','Vault','Pages','Sync','Grid','Views','Hub','Forms']);
const LAUNCH=__data("LAUNCH",[1,3,4,6,8,9,11,12,14,16,17,19]);     // week of launch
const CX=40,CY=304,rOf=w=>56+w*9.7;
obsReveal('fan',s=>{
  const ang=i=>-84+i*(76/11);
  // dotted week guides
  [5,10,15,20].forEach((w,gi)=>{
    const r=rOf(w),[x1,y1]=pol(CX,CY,r,-84),[x2,y2]=pol(CX,CY,r,-8);
    el(s,'path',{d:`M${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2}`,fill:'none',
      stroke:'#D8D6CE','stroke-width':1,'stroke-dasharray':'2 5',
      class:'fade',style:`animation-delay:${gi*.1}s`});
    const [lx,ly]=pol(CX,CY,r,-87.5);
    txt(s,{x:lx,y:ly,'font-size':6.5,fill:'#B0AFA9','text-anchor':'middle',
      class:'fade',style:`animation-delay:${gi*.1}s`},'W'+w);
  });
  FEAT.forEach((name,i)=>{
    const a=ang(i),L=LAUNCH[i];
    const mau=Math.round(48-i*3+rnd(i+1,3)*10);
    // hairline spoke from launch to rim
    const [sx,sy]=pol(CX,CY,rOf(L),a),[ex,ey]=pol(CX,CY,rOf(20),a);
    el(s,'line',{x1:sx,y1:sy,x2:ex,y2:ey,stroke:'#E3E2DB','stroke-width':.7,
      class:'fade',style:`animation-delay:${.15+i*.05}s`});
    // weekly texture dots
    for(let w=L+1;w<=20;w++){
      const [x,y]=pol(CX,CY,rOf(w),a);
      el(s,'circle',{cx:x,cy:y,r:1.1+rnd(i+1,w)*1.2,fill:'#B0AFA9',opacity:.8,
        class:'pop',style:`animation-delay:${.2+i*.06+(w-L)*.015}s`});
    }
    // launch dot, sized by MAU
    const [bx,by]=pol(CX,CY,rOf(L),a);
    const big=el(s,'circle',{cx:bx,cy:by,r:Math.sqrt(mau)*1.15,fill:INK,
      class:'pop',style:`animation-delay:${.15+i*.07}s`});
    tip(big,`${name} — launched W${L} · ${mau}k MAU`);
    // rim label along the spoke
    const [tx,ty]=pol(CX,CY,rOf(20)+9,a);
    txt(s,{x:tx,y:ty,'font-size':7,'font-weight':600,fill:'#6A6963',
      transform:`rotate(${a} ${tx} ${ty})`,'dominant-baseline':'middle',
      class:'fade',style:`animation-delay:${.3+i*.05}s`},name);
  });
});
    },
    "cascade": () => {

const CAUSE=__data("CAUSE",['DNS','CDN','QUOTA','DISK','CERT','CACHE','QUEUE','LOCK','OOM','NET','3P API','CONFIG','DB','DEPLOY','CODE','HUMAN']);
const COUNT=__data("COUNT",[1,1,2,3,3,4,5,6,7,9,11,13,15,18,22,27]);
obsReveal('cascade',s=>{
  const x=i=>34+i*22.2, base=i=>272-i*7.5;
  // dotted diagonal baseline
  el(s,'line',{x1:x(0)-8,y1:base(0)+4,x2:x(15)+8,y2:base(15)+4,
    stroke:'#4A4944','stroke-width':1,'stroke-dasharray':'2 4',class:'fade'});
  CAUSE.forEach((name,i)=>{
    const n=Math.ceil(COUNT[i]/2),bx=x(i),by=base(i);
    for(let k=0;k<n-1;k++)
      el(s,'circle',{cx:bx,cy:by-12-k*8.8,r:2.2,fill:'#B3B0A4',opacity:.9,
        class:'pop',style:`animation-delay:${i*.05+k*.03}s`});
    const topY=by-12-(n-1)*8.8;
    const top=el(s,'circle',{cx:bx,cy:topY,r:4.6,fill:PAPER,
      class:'pop',style:`animation-delay:${i*.05+n*.03}s`});
    tip(top,`${name} — ${COUNT[i]} incidents`);
    txt(s,{x:bx,y:topY-10,'font-size':9,'font-weight':700,fill:PAPER,'text-anchor':'middle',
      class:'fade',style:`animation-delay:${.2+i*.05}s`},COUNT[i]);
    txt(s,{x:bx,y:by+12,'font-size':6.5,'font-weight':600,fill:'#6A6963','text-anchor':'end',
      transform:`rotate(-90 ${bx} ${by+12})`,
      class:'fade',style:`animation-delay:${.1+i*.05}s`},name);
  });
});
    },
    "barcode": () => {

const N=__data("N",90);
const val=__fn("values",d=>95+55*Math.sin(d/9.5)+30*Math.sin(d/3.7)+rnd(d+1,5)*40);
obsReveal('barcode',s=>{
  // the barcode: one hairline per day, full height
  for(let d=0;d<N;d++){
    const x=18+d*8.53;
    el(s,'line',{x1:x,y1:8,x2:x,y2:258,stroke:GRID,'stroke-width':.7,
      class:'fade',style:`animation-delay:${d*.004}s`});
  }
  const vs=Array.from({length:N},(_,d)=>val(d));
  // top-3 peaks, kept at least 6 days apart so labels never collide
  const top3=[];
  for(const d of [...vs.keys()].sort((a,b)=>vs[b]-vs[a])){
    if(top3.every(t=>Math.abs(t-d)>=6))top3.push(d);
    if(top3.length===3)break;
  }
  for(let d=0;d<N;d++){
    const x=18+d*8.53,v=vs[d],y=252-v*.75;
    const weekend=d%7===5||d%7===6;
    const stemEnd=Math.min(256,y+14+rnd(d+1,9)*26);
    el(s,'line',{x1:x,y1:y,x2:x,y2:stemEnd,stroke:INK,'stroke-width':1.1,
      class:'fade',style:`animation-delay:${.3+d*.008}s`});
    const big=top3.includes(d);
    const dot=el(s,'circle',{cx:x,cy:y,r:big?4.6:2.7,
      fill:weekend?PAPER:INK,stroke:INK,'stroke-width':weekend?1.2:0,
      class:'pop',style:`animation-delay:${.3+d*.008}s`});
    tip(dot,`Day ${d+1} — ${Math.round(v)}k peak`);
    if(big)txt(s,{x,y:y-10,'font-size':9,'font-weight':800,fill:INK,'text-anchor':'middle',
      class:'fade',style:`animation-delay:${.9+d*.004}s`},Math.round(v)+'k');
  }
  [[0,'APR'],[30,'MAY'],[61,'JUN']].forEach(([d,m])=>
    txt(s,{x:18+d*8.53,y:276,'font-size':8,'font-weight':600,fill:MUTED,
      'letter-spacing':'.12em',class:'fade'},m));
});
    },
    "arcmatrix": () => {

const PROD=__data("PROD",['Editor','Boards','Docs','Flows','Chat','Vault','Pages','Sync']);
const CITY=__data("CITY",['SF','NYC','LON','BER','TOK','SYD','SIN','PAR','AMS','TOR','SEO','SAO']);
const W=__data("W",[9,8,7,7,6,5,5,4,4,3,3,2]);             // market weight
obsReveal('arcmatrix',s=>{
  const rowY=i=>74+i*29, colX=j=>92+j*27, dy=j=>-16*Math.sin(Math.PI*j/11);
  const v=(i,j)=>{
    if(rnd(i*13+1,j*7+3)<.09)return 0;                 // a few true absences
    const age=1-i*.085;                                // older rows reach further
    return Math.min(40,Math.round(W[j]*3.4*age*(.45+rnd(i+1,j+1)*.85)));
  };
  // find top-4 cells for labels
  const all=[];
  PROD.forEach((_,i)=>CITY.forEach((_,j)=>all.push([v(i,j),i,j])));
  const top=all.sort((a,b)=>b[0]-a[0]).slice(0,4).map(d=>d[1]*100+d[2]);
  PROD.forEach((p,i)=>{
    // the horizon arc
    const d='M'+CITY.map((_,j)=>`${colX(j)} ${rowY(i)+dy(j)}`).join(' L ');
    el(s,'path',{d,fill:'none',stroke:'#E3E2DB','stroke-width':1,pathLength:1,
      class:'draw',style:`animation-delay:${i*.08}s`});
    txt(s,{x:84,y:rowY(i)+3,'font-size':8,'font-weight':600,fill:'#6A6963','text-anchor':'end',
      class:'fade',style:`animation-delay:${i*.08}s`},p);
    CITY.forEach((c,j)=>{
      const x=colX(j),y=rowY(i)+dy(j),vv=v(i,j);
      if(!vv){el(s,'circle',{cx:x,cy:y,r:.9,fill:'#D8D6CE',
        class:'pop',style:`animation-delay:${.2+i*.08+j*.02}s`});return}
      const fill=vv>=25?INK:vv>=12?'#6A6963':'#B0AFA9';
      const dot=el(s,'circle',{cx:x,cy:y,r:Math.sqrt(vv)*1.3,fill,
        class:'pop',style:`animation-delay:${.2+i*.08+j*.02}s`});
      tip(dot,`${p} · ${c} — ${vv} accounts`);
      if(top.includes(i*100+j))
        txt(s,{x,y:y-Math.sqrt(vv)*1.3-4,'font-size':7,'font-weight':800,fill:INK,
          'text-anchor':'middle',class:'fade',style:`animation-delay:${.6}s`},vv);
    });
  });
  CITY.forEach((c,j)=>{
    const x=colX(j),y=74+dy(j)-24;
    txt(s,{x,y,'font-size':7,'font-weight':700,fill:MUTED,'letter-spacing':'.08em',
      transform:`rotate(-55 ${x} ${y})`,class:'fade',style:`animation-delay:${j*.03}s`},c);
  });
});
    },
    "converge": () => {

const CX=200,CY=162,R=116;
const THEME=__data("THEME",[['PERF',15,-75],['INTEGRATIONS',10,-3],['PRICING',9,69],['MOBILE',8,141],['UX',6,213]]);
const N=THEME.reduce((a,t)=>a+t[1],0);
obsReveal('converge',s=>{
  // hub assignment: contiguous blocks with a little organic leakage
  const blocks=THEME.flatMap(([,n],h)=>Array(n).fill(h));
  const hubOf=i=>rnd(i+1,11)>.92?(blocks[i]+2)%THEME.length:blocks[i];
  const hubPt=h=>pol(CX,CY,34,THEME[h][2]);
  const counts=THEME.map(()=>0);
  for(let i=0;i<N;i++)counts[hubOf(i)]++;
  for(let i=0;i<N;i++){
    const deg=i/N*360-90,[px,py]=pol(CX,CY,R,deg);
    const h=hubOf(i),[hx,hy]=hubPt(h);
    const c1x=CX+(px-CX)*.42,c1y=CY+(py-CY)*.42;
    const c2x=CX+(hx-CX)*.3,c2y=CY+(hy-CY)*.3;
    el(s,'path',{d:`M${px} ${py} C${c1x} ${c1y} ${c2x} ${c2y} ${hx} ${hy}`,
      fill:'none',stroke:'#A8A7A0','stroke-width':.7,opacity:.55,pathLength:1,
      class:'draw',style:`animation-delay:${i*.018}s`});
    el(s,'circle',{cx:px,cy:py,r:1.6,fill:'#6A6963',
      class:'pop',style:`animation-delay:${i*.018}s`});
    // tiny rim code, flipped on the left half so it stays readable
    const flip=deg>90&&deg<270,[lx,ly]=pol(CX,CY,R+7,deg);
    txt(s,{x:lx,y:ly,'font-size':5.5,fill:MUTED,
      'text-anchor':flip?'end':'start','dominant-baseline':'middle',
      transform:`rotate(${flip?deg+180:deg} ${lx} ${ly})`,
      class:'fade',style:`animation-delay:${.2+i*.01}s`},'R-'+String(i+1).padStart(2,'0'));
  }
  THEME.forEach(([name,,deg],h)=>{
    const [hx,hy]=hubPt(h);
    const hub=el(s,'circle',{cx:hx,cy:hy,r:Math.sqrt(counts[h])*1.55,fill:INK,
      class:'pop',style:`animation-delay:${.5+h*.08}s`});
    tip(hub,`${name} — ${counts[h]} requests`);
    // theme label parked outside the rim, past the code ring
    const [tx,ty]=pol(CX,CY,R+34,deg);
    txt(s,{x:tx,y:ty,'font-size':8,'font-weight':800,fill:INK,'text-anchor':'middle',
      'dominant-baseline':'middle','letter-spacing':'.08em',
      style:`animation-delay:${.6+h*.08}s`,
      class:'fade'},`${name} · ${counts[h]}`);
    // hairline tying the label to its hub, skimming past the rim
    const [gx,gy]=pol(CX,CY,R+22,deg);
    el(s,'line',{x1:hx,y1:hy,x2:gx,y2:gy,stroke:'#C6C5BF','stroke-width':.7,
      'stroke-dasharray':'1 3',class:'fade',style:`animation-delay:${.7+h*.08}s`});
  });
});
    },
    "clusters": () => {

const SAT=__data("SAT",[[622,78,'PLUGINS',22],[706,214,'THEMES',16],[540,268,'DOCS',13],[92,72,'FORKS',12],[774,58,'MIRRORS',9]]);
obsReveal('clusters',s=>{
  const HX=300,HY=172;
  // dotted cross-contribution paths, hub → each island
  SAT.forEach(([x,y],ci)=>{
    const mx=(HX+x)/2,my=(HY+y)/2-30;
    el(s,'path',{d:`M${HX} ${HY} Q${mx} ${my} ${x} ${y}`,fill:'none',
      stroke:GRID,'stroke-width':.9,'stroke-dasharray':'2 4',pathLength:1,
      class:'draw',style:`animation-delay:${.8+ci*.12}s;animation-duration:.7s`});
  });
  // main hub: 80 golden-angle spokes
  for(let i=0;i<80;i++){
    const a=i*137.508,len=28+rnd(i+1,7)*88;
    const [x,y]=pol(HX,HY,len,a);
    el(s,'line',{x1:HX,y1:HY,x2:x,y2:y,stroke:'#C6C5BF','stroke-width':.6,pathLength:1,
      class:'draw',style:`animation-delay:${i*.012}s;animation-duration:.5s`});
    const dot=el(s,'circle',{cx:x,cy:y,r:1.6+rnd(i+1,4)*1.8,fill:INK,opacity:.85,
      class:'pop',style:`animation-delay:${.15+i*.012}s`});
    tip(dot,`core contributor #${i+1}`);
  }
  el(s,'circle',{cx:HX,cy:HY,r:6.5,fill:INK,class:'pop'});
  txt(s,{x:HX,y:HY+140,'font-size':8,'font-weight':800,fill:INK,'text-anchor':'middle',
    'letter-spacing':'.1em',style:`paint-order:stroke;stroke:${PAPER};stroke-width:3px`,
    class:'fade'},'CORE · 80');
  // satellite islands
  SAT.forEach(([x,y,name,n],ci)=>{
    el(s,'circle',{cx:x,cy:y,r:3.5,fill:'#4A4944',
      class:'pop',style:`animation-delay:${.9+ci*.12}s`});
    for(let k=0;k<n;k++){
      const a=k*137.508+ci*40,rr=9+rnd(k+1,ci+2)*26;
      const [dx,dy]=pol(x,y,rr,a);
      if(k%2===0)el(s,'line',{x1:x,y1:y,x2:dx,y2:dy,stroke:'#D8D6CE','stroke-width':.5,
        class:'fade',style:`animation-delay:${1+ci*.12+k*.02}s`});
      el(s,'circle',{cx:dx,cy:dy,r:1.4+rnd(k+3,ci+5)*1.4,fill:'#6A6963',
        class:'pop',style:`animation-delay:${1+ci*.12+k*.02}s`});
    }
    txt(s,{x,y:y+44,'font-size':7.5,'font-weight':700,fill:MUTED,'text-anchor':'middle',
      'letter-spacing':'.12em',style:`paint-order:stroke;stroke:${PAPER};stroke-width:3px`,
      class:'fade'},`${name} · ${n}`);
  });
});
    },
    "spectrum": () => {

const ROWS=__data("ROWS",[['FRIEND','AUTHORITY'],['SERIOUS','PLAYFUL'],['RELIABLE','RISK-TAKING'],['CONTEMPORARY','CLASSIC']]);
const US=__data("US",[.74,.80,.40,.22]);                 // 0 = left trait, 1 = right trait
const COMP=__data("COMP",[[.42,.52,.57],[.60,.65,.86],[.30,.34,.50],[.36,.41,.73]]);
const X0=118,X1=342,Y=i=>58+i*60,px=t=>X0+t*(X1-X0);
obsReveal('spectrum',s=>{
  // the ribbon first, underneath everything
  let d=`M${px(US[0])} ${Y(0)}`;
  for(let i=1;i<4;i++)
    d+=` C${px(US[i-1])} ${Y(i-1)+30} ${px(US[i])} ${Y(i)-30} ${px(US[i])} ${Y(i)}`;
  el(s,'path',{d,fill:'none',stroke:'#F0EFEB','stroke-width':30,'stroke-linecap':'round',
    'stroke-linejoin':'round',opacity:.9,pathLength:1,class:'draw',
    style:'animation-duration:1.4s'});
  ROWS.forEach(([a,b],i)=>{
    const y=Y(i);
    el(s,'line',{x1:X0,y1:y,x2:X1,y2:y,stroke:'#B0AFA9','stroke-width':1,
      class:'fade',style:`animation-delay:${i*.08}s`});
    [X0,X1].forEach(x=>el(s,'line',{x1:x,y1:y-4,x2:x,y2:y+4,stroke:'#B0AFA9','stroke-width':1,
      class:'fade',style:`animation-delay:${i*.08}s`}));
    txt(s,{x:X0-14,y:y+3,'font-size':8,'font-weight':600,fill:'#6A6963','text-anchor':'end',
      'letter-spacing':'.1em',class:'fade',style:`animation-delay:${i*.08}s`},a);
    txt(s,{x:X1+14,y:y+3,'font-size':8,'font-weight':600,fill:'#6A6963',
      'letter-spacing':'.1em',class:'fade',style:`animation-delay:${i*.08}s`},b);
    COMP[i].forEach((t,k)=>{
      const c=el(s,'circle',{cx:px(t),cy:y,r:3.2,fill:'#8F8E88',
        class:'pop',style:`animation-delay:${.3+i*.1+k*.05}s`});
      tip(c,`competitor ${'ABC'[k]} — ${Math.round(t*100)}% toward ${b}`);
    });
    const us=el(s,'circle',{cx:px(US[i]),cy:y,r:8,fill:INK,
      class:'pop',style:`animation-delay:${.5+i*.1}s`});
    tip(us,`us — ${Math.round(US[i]*100)}% toward ${b}`);
  });
  txt(s,{x:X0,y:284,'font-size':7.5,'font-weight':600,fill:'#B0AFA9','letter-spacing':'.12em',
    class:'fade',style:'animation-delay:.9s'},'● US    ● COMPETITORS A · B · C');
});
    },
    "dotty": () => {

const SQUAD=__data("SQUAD",['PLATFORM','GROWTH','MOBILE','INFRA']);
const SHADE=__data("SHADE",['#C6C5BF','#A8A7A0','#6A6963',INK]);
const P=(c,r,k)=>[196+(c-r)*20,236+(c+r)*10-k*64];
obsReveal('dotty',s=>{
  for(let k=0;k<4;k++){
    // plane slab: paper fill so upper decks occlude lower ones
    const cs=[P(-.8,-.8,k),P(5.8,-.8,k),P(5.8,5.8,k),P(-.8,5.8,k)];
    el(s,'path',{d:'M'+cs.map(p=>p.join(' ')).join(' L ')+' Z',
      fill:PAPER,'fill-opacity':.96,stroke:'#DEDDD6','stroke-width':.9,
      class:'fade',style:`animation-delay:${k*.16}s`});
    for(let r=0;r<6;r++)for(let c=0;c<6;c++){
      const load=rnd(k*37+r*6+c+1,k+2);
      const v=__cell("cells",k,r*6+c,load<.3?0:Math.round(load*12));   // sparser: silence is part of the texture
      const [x,y]=P(c,r,k);
      if(!v){el(s,'circle',{cx:x,cy:y,r:.7,fill:'#D8D6CE',
        class:'pop',style:`animation-delay:${k*.16+(r*6+c)*.008}s`});continue}
      const dot=el(s,'circle',{cx:x,cy:y,r:1+Math.sqrt(v)*1.15,fill:SHADE[k],
        class:'pop',style:`animation-delay:${k*.16+(r*6+c)*.008}s`});
      tip(dot,`${SQUAD[k]} · week ${c+1} × lane ${r+1} — ${v} tasks`);
    }
    // label off the plane's right corner, tied by a short hairline
    const [cxr,cyr]=P(5.8,-.8,k);
    el(s,'line',{x1:cxr+4,y1:cyr,x2:cxr+22,y2:cyr,stroke:'#C6C5BF','stroke-width':.8,
      class:'fade',style:`animation-delay:${.2+k*.16}s`});
    txt(s,{x:cxr+27,y:cyr+2.5,'font-size':7.5,'font-weight':700,fill:k===3?INK:'#8F8E88',
      'letter-spacing':'.12em',class:'fade',style:`animation-delay:${.2+k*.16}s`},SQUAD[k]);
  }
});
    },
    "almanac": () => {

const AREAS=__data("AREAS",['EDITOR','BOARDS','DOCS','CHAT','FLOWS','VAULT','PAGES','SYNC','GRID','VIEWS','HUB','FORMS']);
const BETA=__data("BETA",{GRID:2023,VIEWS:2024,HUB:2025,FORMS:2025});   // beta until this year
const BORN=__data("BORN",{EDITOR:2019,BOARDS:2019,DOCS:2019,CHAT:2020,FLOWS:2020,VAULT:2021,PAGES:2021,SYNC:2022,GRID:2022,VIEWS:2023,HUB:2024,FORMS:2024});
obsReveal('almanac',s=>{
  const rowY=i=>62+i*34,colX=j=>132+j*57;
  // ledger paper: hairlines every 6.8px, edge to edge, under everything
  for(let y=40;y<=318;y+=6.8)
    el(s,'line',{x1:56,y1:y,x2:822,y2:y,stroke:'#E4E3DC','stroke-width':.5,
      class:'fade',style:`animation-delay:${(y-40)*.001}s`});
  const vals=[];
  for(let i=0;i<8;i++){
    const yr=2019+i;
    el(s,'line',{x1:56,y1:rowY(i),x2:822,y2:rowY(i),stroke:'#D3D2CA','stroke-width':.9,
      class:'fade',style:`animation-delay:${i*.04}s`});
    txt(s,{x:48,y:rowY(i)+3,'font-size':9,'font-weight':700,fill:'#8F8E88','text-anchor':'end',
      class:'fade',style:`animation-delay:${i*.04}s`},yr);
    AREAS.forEach((a,j)=>{
      if(yr<BORN[a])return;
      const age=yr-BORN[a];
      // steep spread: quiet areas stay pinpricks, busy ones balloon
      const v=Math.round((2+age*5)*(0.25+rnd(i*12+j+1,j+3)**2*2.2));
      vals.push([Math.max(1,__cell("cells",i,j,v)),i,j,a,yr]);
    });
  }
  // draw small over large so the giants sit underneath as washes
  vals.sort((a,b)=>b[0]-a[0]);
  const top3=vals.slice(0,3);
  // hand-drawn circle: radius wobbles around the rim on two slow sine waves,
  // so every bubble is its own slightly-off print — never a compass circle
  const blob=(x,y,r,seed)=>{
    const n=Math.max(14,Math.round(r*1.6)),pts=[];
    for(let t=0;t<n;t++){
      const a=t/n*Math.PI*2;
      const w=1+.055*Math.sin(a*2+seed*7)+.04*Math.sin(a*3+seed*13)+(rnd(seed+t,3)-.5)*.03;
      pts.push([x+Math.cos(a)*r*w,y+Math.sin(a)*r*w]);
    }
    let d=`M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for(let t=0;t<n;t++){
      const p=pts[t],q=pts[(t+1)%n];
      d+=` Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${((p[0]+q[0])/2).toFixed(1)} ${((p[1]+q[1])/2).toFixed(1)}`;
    }
    return d+' Z';
  };
  vals.forEach(([v,i,j,a,yr],k)=>{
    const x=colX(j)+(rnd(i*7+j+2,j+9)-.5)*10,  // jitter off the gridline
          y=rowY(i),r=Math.sqrt(v)*3.8;        // big: rows are 34 apart, giants reach ~28 and collide
    const beta=BETA[a]&&yr<=BETA[a];
    const g=el(s,'g',{class:'pop',style:`animation-delay:${.15+k*.012}s`});
    const seed=i*12+j;
    const dot=el(g,'path',beta
      ?{d:blob(x,y,r,seed),fill:'none',stroke:'#8F8E88','stroke-width':1,'stroke-dasharray':'3 3'}
      :{d:blob(x,y,r,seed),fill:INK,'fill-opacity':.09+rnd(i+2,j+4)*.1,
        stroke:INK,'stroke-opacity':.3+rnd(i+5,j+7)*.35,'stroke-width':.6+rnd(i+3,j+11)*.9});
    tip(dot,`${a} · ${yr} — ${v*10} tickets${beta?' (beta)':''}`);
    // escalation core: small wobbly blot, nudged off-center like a press mark
    if(!beta){
      const ox=(rnd(seed+1,17)-.5)*r*.3,oy=(rnd(seed+3,19)-.5)*r*.3;
      el(g,'path',{d:blob(x+ox,y+oy,Math.max(1.4,r*.17),seed+29),fill:INK});
    }
    if(top3.includes(vals[k]))
      txt(s,{x,y:y-r-5,'font-size':8.5,'font-weight':800,fill:INK,'text-anchor':'middle',
        class:'fade',style:'animation-delay:1s'},v*10);
  });
  AREAS.forEach((a,j)=>{
    const x=colX(j);
    txt(s,{x,y:34,'font-size':7.5,'font-weight':700,fill:MUTED,'letter-spacing':'.1em',
      transform:`rotate(-32 ${x} 34)`,class:'fade',style:`animation-delay:${j*.03}s`},a);
  });

});
    },
    "patchwork": () => {

const CX=200,CY=168,N=46;
obsReveal('patchwork',s=>{
  // 24h rim ticks
  for(let h=0;h<96;h++){
    const a=-90+h*3.75,[x1,y1]=pol(CX,CY,140,a),[x2,y2]=pol(CX,CY,h%4===0?146:143,a);
    el(s,'line',{x1,y1,x2,y2,stroke:'#C6C5BF','stroke-width':h%4===0?1:.5,
      class:'fade',style:`animation-delay:${h*.006}s`});
  }
  [0,6,12,18].forEach(h=>{
    const [x,y]=pol(CX,CY,157,-90+h*15);
    txt(s,{x,y:y+3,'font-size':8,'font-weight':700,fill:MUTED,'text-anchor':'middle',
      class:'fade'},String(h).padStart(2,'0'));
  });
  // the patchwork: translucent wedges pile into ink
  const wedges0=[];
  for(let i=0;i<N;i++){
    // deploys cluster around 11h and 16h, thin overnight
    const peak=rnd(i+1,2)>.5?11:16;
    const hour=(peak+(rnd(i+1,3)-.5)*7+24)%24;
    const a0=-90+hour*15,sw=10+rnd(i+1,4)*34;
    const r1=34+rnd(i+1,5)*100;
    wedges0.push([a0,sw,r1,hour,i]);
  }
  const wedges=__data("wedges",wedges0);
  wedges.forEach(([a0,sw,r1,hour,i])=>{
    const w=el(s,'path',{d:sect(CX,CY,16,r1,a0,a0+sw),fill:INK,
      'fill-opacity':.07+rnd(i+1,6)*.09,class:'fade',
      style:`animation-delay:${.2+i*.022}s`});
    tip(w,`deploy #${i+1} — ${String(Math.floor(hour)).padStart(2,'0')}:${String(Math.floor(hour%1*60)).padStart(2,'0')} · ${Math.round(r1*6)} files`);
  });
  // three outlined wedges: the ones that paged somebody
  [4,17,31].forEach((i,k)=>{
    const [a0,sw,r1]=wedges[i];
    const w=el(s,'path',{d:sect(CX,CY,16,r1,a0,a0+sw),fill:'none',
      stroke:INK,'stroke-width':1.1,class:'fade',style:`animation-delay:${1.2+k*.15}s`});
    tip(w,`deploy #${i+1} — triggered an incident`);
  });
  el(s,'circle',{cx:CX,cy:CY,r:3,fill:INK,class:'pop',style:'animation-delay:1.3s'});
  txt(s,{x:CX,y:308,'font-size':7.5,'font-weight':600,fill:'#B0AFA9','text-anchor':'middle',
    'letter-spacing':'.12em',class:'fade',style:'animation-delay:1.4s'},'OUTLINED = TRIGGERED AN INCIDENT');
});
    },
    "lineage": () => {

// [name, events [year, type f|o], aliveToday]
const TR=__data("TR",[
  ['Dark mode',[[2017,'f'],[2022,'o']],true],
  ['Kanban',[[2016,'f']],true],
  ['Wikis',[[2016,'f'],[2019,'o']],false],
  ['Slash cmds',[[2018,'f']],true],
  ['Templates',[[2019,'f'],[2024,'o']],true],
  ['Inbox',[[2020,'f']],false],
  ['Live cursors',[[2020,'f'],[2023,'o']],true],
  ['AI drafts',[[2023,'f'],[2025,'o']],true],
  ['Voice notes',[[2021,'f']],false],
  ['Offline',[[2018,'f'],[2026,'o']],true],
]);
const Y0=2016,yY=yr=>34+(yr-Y0)*24,colX=c=>76+c*31;
obsReveal('lineage',s=>{
  for(let yr=Y0;yr<=2026;yr++){
    el(s,'line',{x1:60,y1:yY(yr),x2:372,y2:yY(yr),stroke:'#E3E2DB','stroke-width':.8,
      class:'fade',style:`animation-delay:${(yr-Y0)*.03}s`});
    if(yr%2===0)txt(s,{x:52,y:yY(yr)+3,'font-size':8,'font-weight':600,fill:MUTED,'text-anchor':'end',
      class:'fade',style:`animation-delay:${(yr-Y0)*.03}s`},yr);
  }
  TR.forEach(([name,ev,alive],c)=>{
    const x=colX(c);
    // segments between events: solid while fresh, dashed once dormant
    for(let k=0;k<ev.length-1;k++){
      const gap=ev[k+1][0]-ev[k][0];
      el(s,'line',{x1:x,y1:yY(ev[k][0])+7,x2:x,y2:yY(ev[k+1][0])-7,
        stroke:'#B0AFA9','stroke-width':1,
        'stroke-dasharray':gap>2?'2 4':'none',pathLength:1,
        class:'draw',style:`animation-delay:${.3+c*.07}s;animation-duration:.6s`});
    }
    const last=ev[ev.length-1][0];
    if(alive)
      el(s,'line',{x1:x,y1:yY(last)+7,x2:x,y2:yY(2026)+16,stroke:'#B0AFA9','stroke-width':1,
        pathLength:1,class:'draw',style:`animation-delay:${.45+c*.07}s;animation-duration:.6s`});
    ev.forEach(([yr,t])=>{
      const node=el(s,'circle',t==='f'
        ?{cx:x,cy:yY(yr),r:5.5,fill:INK}
        :{cx:x,cy:yY(yr),r:5.5,fill:PAPER,stroke:INK,'stroke-width':1.4});
      node.setAttribute('class','pop');
      node.style.animationDelay=(.35+c*.07)+'s';
      tip(node,`${name} — ${t==='f'?'shipped':'reworked'} ${yr}`);
    });
    // terminal dot: alive lands on today's baseline, dead stops where it stopped
    el(s,'circle',{cx:x,cy:alive?yY(2026)+16:yY(last)+12,r:alive?3:1.6,
      fill:alive?INK:'#C6C5BF',class:'pop',style:`animation-delay:${.6+c*.07}s`});
    const ly=yY(2026)+26;
    txt(s,{x,y:ly,'font-size':6.8,'font-weight':600,fill:alive?'#4A4944':'#B0AFA9',
      transform:`rotate(-38 ${x} ${ly})`,'text-anchor':'end',
      class:'fade',style:`animation-delay:${.7+c*.05}s`},name);
  });
});
    },
    "colonnade": () => {

const PRE=['core','ui','api','data','auth','sync','mail','flag','edge','doc','bot'];
const SUF=['-kit','-svc','-web','-cli','-db','-gw','-sdk','-jobs'];
const TEAM=__data("TEAM",['PLATFORM','FRONTEND','BACKEND','DATA','INFRA','MOBILE','SECURITY','GROWTH','ML','DESIGN']);
obsReveal('colonnade',s=>{
  const teamY=j=>36+j*28,repoY=i=>16+i*6.7;
  const counts=Array(10).fill(0);
  const owner=i=>{const w=rnd(i+1,17);return Math.min(9,Math.floor(w*w*10))}; // skewed: low teams hoard
  const ITEMS=__data("ITEMS",Array.from({length:44},(_,i)=>[PRE[i%11]+SUF[Math.floor(rnd(i+1,8)*8)%8]+(i>21?'-v2':''),owner(i)]));
  const N=ITEMS.length;
  for(let i=0;i<N;i++)counts[ITEMS[i][1]]++;
  for(let i=0;i<N;i++){
    const name=ITEMS[i][0];
    const yi=repoY(i),j=ITEMS[i][1],yj=teamY(j);
    txt(s,{x:112,y:yi+2,'font-size':5,fill:'#8F8E88','text-anchor':'end',
      class:'fade',style:`animation-delay:${i*.012}s`},name);
    el(s,'rect',{x:117,y:yi-1.2,width:4,height:2.4,fill:'#B0AFA9',
      class:'fade',style:`animation-delay:${i*.012}s`});
    el(s,'path',{d:`M123 ${yi} C 200 ${yi} 220 ${yj} 288 ${yj}`,fill:'none',
      stroke:'#A8A7A0','stroke-width':.6,opacity:.6,pathLength:1,
      class:'draw',style:`animation-delay:${.2+i*.015}s;animation-duration:.7s`});
  }
  TEAM.forEach((t,j)=>{
    const y=teamY(j);
    el(s,'circle',{cx:293,cy:y,r:2.6+counts[j]*.55,fill:counts[j]>=7?INK:counts[j]>=4?'#6A6963':'#B0AFA9',
      class:'pop',style:`animation-delay:${.6+j*.05}s`});
    const lab=txt(s,{x:302+counts[j]*.55,y:y+2.5,'font-size':7,'font-weight':700,fill:'#4A4944',
      class:'fade',style:`animation-delay:${.65+j*.05}s`},`${t} · ${counts[j]}`);
    tip(lab,`${t} owns ${counts[j]} repos`);
  });
});
    },
    "hourglass": () => {

const STAGE=__data("STAGE",[['VISITORS',4200],['SIGN-UPS',1900],['ACTIVATED',960],['RETAINED',540],['PAYING',310]]);
obsReveal('hourglass',s=>{
  const CXm=185,sy=k=>34+k*64,w=c=>c/4200*290;
  STAGE.forEach(([name,c],k)=>{
    const y=sy(k),hw=w(c)/2;
    // barcode strip: one tick ≈ 40 people
    const n=Math.round(c/40);
    for(let t=0;t<n;t++){
      const x=CXm-hw+(t+.5)/n*hw*2+(rnd(t+1,k+3)-.5)*3;
      el(s,'line',{x1:x,y1:y-6,x2:x,y2:y+6,stroke:INK,'stroke-width':.8,
        opacity:.45+rnd(t+2,k+5)*.5,class:'fade',style:`animation-delay:${k*.12+t*.004}s`});
    }
    // threads trickling to the next strip
    if(k<4){
      const hw1=w(STAGE[k+1][1])/2;
      for(let t=0;t<34;t++){
        const xt=CXm+(rnd(t+1,k*7+1)-.5)*2*hw*.94;
        const xb=CXm+(rnd(t+3,k*7+5)-.5)*2*hw1*.94;
        el(s,'path',{d:`M${xt} ${y+8} C${xt} ${y+34} ${xb} ${sy(k+1)-34} ${xb} ${sy(k+1)-8}`,
          fill:'none',stroke:'#B0AFA9','stroke-width':.5,opacity:.32,pathLength:1,
          class:'draw',style:`animation-delay:${.2+k*.15+t*.008}s;animation-duration:.8s`});
      }
      // conversion between stages, parked in the left margin
      const pct=Math.round(STAGE[k+1][1]/c*100);
      txt(s,{x:26,y:(y+sy(k+1))/2+3,'font-size':8.5,'font-weight':800,fill:'#8F8E88',
        class:'fade',style:`animation-delay:${.5+k*.15}s`},pct+'%');
      txt(s,{x:26,y:(y+sy(k+1))/2+13,'font-size':6,'font-weight':600,fill:'#C6C5BF',
        'letter-spacing':'.08em',class:'fade',style:`animation-delay:${.5+k*.15}s`},'GET THROUGH');
    }
    // stage label, tied to the strip edge
    el(s,'line',{x1:CXm+hw+6,y1:y,x2:340,y2:y,stroke:'#DEDDD6','stroke-width':.8,
      class:'fade',style:`animation-delay:${.3+k*.12}s`});
    txt(s,{x:344,y:y-1,'font-size':7.5,'font-weight':700,fill:'#4A4944',
      'letter-spacing':'.08em',class:'fade',style:`animation-delay:${.35+k*.12}s`},name);
    txt(s,{x:344,y:y+10,'font-size':9.5,'font-weight':800,fill:INK,
      class:'fade',style:`animation-delay:${.4+k*.12}s`},c.toLocaleString());
  });
});
    },
    "hundredfield": () => {

const SEG=__data("SEG",[['CHARGED',41,INK],['TORN',35,'#55554F'],['ADRIFT',12,'#8F8E88'],['AVERSE',12,'#B0AFA9']]);
const POS=__data("POS",[[132,140],[276,116],[186,252],[322,238]]);
obsReveal('hundredfield',s=>{
  // dashed constellation hairlines tying the cluster cores
  [[0,1],[0,2],[1,3],[2,3]].forEach(([a,b],k)=>{
    el(s,'line',{x1:POS[a][0],y1:POS[a][1],x2:POS[b][0],y2:POS[b][1],
      stroke:GRID,'stroke-width':.7,'stroke-dasharray':'2 5',
      class:'fade',style:`animation-delay:${.9+k*.1}s`});
  });
  SEG.forEach(([name,v,shade],ci)=>{
    const [cx,cy]=POS[ci];
    let edge=0;
    for(let k=0;k<v;k++){
      const a=k*137.508+ci*55;
      const rr=4+Math.sqrt(k)*5.9+rnd(k+1,ci+2)*3;
      edge=Math.max(edge,rr);
      const [x,y]=pol(cx,cy,rr,a);
      // hairline spoke for every 5th person, core to dot
      if(k%5===0)el(s,'line',{x1:cx,y1:cy,x2:x,y2:y,stroke:'#CDCCC5','stroke-width':.6,
        class:'fade',style:`animation-delay:${ci*.14+k*.012}s`});
      const dot=el(s,'circle',{cx:x,cy:y,r:1.5+rnd(k+2,ci+3)*1.7,fill:shade,opacity:.9,
        class:'pop',style:`animation-delay:${ci*.14+k*.012}s`});
      tip(dot,`${name} — one of ${v} in 100`);
    }
    el(s,'circle',{cx,cy,r:2.4,fill:INK,class:'pop',style:`animation-delay:${ci*.14}s`});
    txt(s,{x:cx,y:cy+edge+13,'font-size':8,'font-weight':800,fill:INK,'text-anchor':'middle',
      'letter-spacing':'.1em',style:`paint-order:stroke;stroke:${PAPER};stroke-width:3px;animation-delay:${.5+ci*.12}s`,
      class:'fade'},`${name} · ${v}`);
  });
  txt(s,{x:200,y:314,'font-size':7,'font-weight':600,fill:'#B0AFA9','text-anchor':'middle',
    'letter-spacing':'.12em',class:'fade',style:'animation-delay:1.3s'},'ONE DOT = ONE PERSON · 41 + 35 + 12 + 12 = 100');
});
    },
    "ballottally": () => {

const ASK=__data("ASK",[['DO MORE WITH THE SAME PAY',51],['AN UNSUSTAINABLE PACE',46],['QUALITY OF WORK SLIPPING',41],['BEING REPLACED OUTRIGHT',22]]);
obsReveal('ballottally',s=>{
  ASK.forEach(([name,v],i)=>{
    const base=78+i*62;
    txt(s,{x:28,y:base-26,'font-size':7.5,'font-weight':700,fill:'#6A6963',
      'letter-spacing':'.08em',class:'fade',style:`animation-delay:${i*.1}s`},name);
    el(s,'line',{x1:28,y1:base,x2:372,y2:base,stroke:GRID,'stroke-width':.6,
      class:'fade',style:`animation-delay:${i*.1}s`});
    for(let k=0;k<100;k++){
      const x=28+k*3.44,picked=k<v;
      const h=picked?12+rnd(k+1,i+2)*5:4.5+rnd(k+1,i+5)*2;
      el(s,'line',{x1:x,y1:base,x2:x,y2:base-h,
        stroke:picked?INK:'#CFCEC7','stroke-width':picked?.9:.55,
        class:'fade',style:`animation-delay:${i*.1+k*.006}s`});
      if(k%10===0)el(s,'circle',{cx:x,cy:base+4.5,r:.8,fill:'#C6C5BF',
        class:'fade',style:`animation-delay:${i*.1+k*.006}s`});
    }
    const lab=txt(s,{x:28+(v-1)*3.44+9,y:base-11,'font-size':11,'font-weight':800,fill:INK,
      style:`paint-order:stroke;stroke:${PAPER};stroke-width:3px;animation-delay:${.5+i*.1}s`,
      class:'fade'},v);
    tip(lab,`${v} of 100 picked this — they could pick several`);
  });
  txt(s,{x:200,y:314,'font-size':7,'font-weight':600,fill:'#B0AFA9','text-anchor':'middle',
    'letter-spacing':'.12em',class:'fade',style:'animation-delay:1.1s'},'ONE TICK = ONE RESPONDENT · DOT MARKS EVERY TENTH');
});
    },
    "matheat": () => {
const INK='#1C1C1A',PAPER='#F0EFEB',MUTED='#8F8E88',GRID='#DEDDD6';
const NS='http://www.w3.org/2000/svg';



const rnd=(i,k)=>Math.abs(((i*73856093)^(k*19349663))%1000)/1000;

// ════ L16 · matrix heat ════
// 通用矩阵热力：任意 分类×分类×连续值。明度即数据——五档灰阶方块，
// 越黑越高。对角线不参与（自己×自己），零格留一粒小点（沉默可见）。
// 最强的一对上虚线框 + 标数。区别于 F10 dot heat：这里编码用明度不用面积，
// 值是占比/强度而不是可数件数。
const FEAT=__data("FEAT",['EDITOR','BOARDS','DOCS','CHAT','FLOWS','VAULT','PAGES','SYNC']);
const v0=(i,j)=>{
  if(i===j)return -1;
  const a=Math.min(i,j),b=Math.max(i,j);
  const pop=(8-a)/8*(8-b)/8;                       // 头部功能重合度高
  const raw=pop*62*(0.35+rnd(a*8+b+1,a+b+3)*.9);
  return Math.round(raw);
};
const shade=t=>t>36?INK:t>24?'#4A4944':t>14?'#8F8E88':t>6?'#B0AFA9':'#D8D7D1';
const v=(i,j)=>__cell("cells",i,j,v0(i,j));
obsReveal('matheat',s=>{
  const X0=118,Y0=70,P=26,C=22;
  let max=0,mi=0,mj=0;
  for(let i=0;i<8;i++)for(let j=0;j<8;j++){const t=v(i,j);if(t>max){max=t;mi=i;mj=j}}
  FEAT.forEach((f,i)=>{
    txt(s,{x:X0-10,y:Y0+i*P+C/2+3,'font-size':7,'font-weight':700,fill:'#6A6963','text-anchor':'end',
      'letter-spacing':'.06em',class:'fade',style:`animation-delay:${i*.04}s`},f);
    const cy=Y0-10;
    txt(s,{x:X0+i*P+C/2,y:cy,'font-size':7,'font-weight':700,fill:MUTED,'letter-spacing':'.06em',
      transform:`rotate(-55 ${X0+i*P+C/2} ${cy})`,class:'fade',style:`animation-delay:${i*.04}s`},f);
  });
  for(let i=0;i<8;i++)for(let j=0;j<8;j++){
    const x=X0+j*P,y=Y0+i*P,t=v(i,j),d=(i+j)*.02;
    if(t<0){el(s,'rect',{x:x+C/2-3,y:y+C/2-.6,width:6,height:1.2,fill:'#D8D6CE',
      class:'fade',style:`animation-delay:${d}s`});continue}
    if(!t){el(s,'circle',{cx:x+C/2,cy:y+C/2,r:.9,fill:'#D8D6CE',
      class:'pop',style:`animation-delay:${d}s`});continue}
    const cell=el(s,'rect',{x,y,width:C,height:C,rx:4,fill:shade(t),
      class:'pop',style:`animation-delay:${d}s`});
    tip(cell,`${FEAT[i]} × ${FEAT[j]} — ${t}% of accounts use both`);
    if(i===mi&&j===mj){
      el(s,'rect',{x:x-3.5,y:y-3.5,width:C+7,height:C+7,rx:6,fill:'none',
        stroke:INK,'stroke-width':1,'stroke-dasharray':'2 3',
        class:'fade',style:'animation-delay:.9s'});
      txt(s,{x:x+C/2,y:y+C/2+3.5,'font-size':9,'font-weight':800,fill:PAPER,'text-anchor':'middle',
        class:'fade',style:'animation-delay:1s'},t);
    }
  }
  // shade legend, countable buckets
  const LG=__data("LG",[['#D8D7D1','1–6'],['#B0AFA9','7–14'],['#8F8E88','15–24'],['#4A4944','25–36'],[INK,'37+']]);
  LG.forEach(([c,lab],k)=>{
    const x=118+k*54;
    el(s,'rect',{x,y:292,width:9,height:9,rx:2,fill:c,class:'fade',style:`animation-delay:${1+k*.05}s`});
    txt(s,{x:x+13,y:300,'font-size':6.5,'font-weight':600,fill:'#8F8E88',
      class:'fade',style:`animation-delay:${1+k*.05}s`},lab+'%');
  });
  txt(s,{x:36,y:300,'font-size':7,'font-weight':600,fill:'#B0AFA9','letter-spacing':'.1em',
    class:'fade',style:'animation-delay:1s'},'SHADE = %');
});
    },
    "calheat": () => {
const INK='#1C1C1A',PAPER='#F0EFEB',MUTED='#8F8E88',GRID='#DEDDD6';
const NS='http://www.w3.org/2000/svg';



const rnd=(i,k)=>Math.abs(((i*73856093)^(k*19349663))%1000)/1000;

// ════ L16 · matrix heat ════
// 通用矩阵热力：任意 分类×分类×连续值。明度即数据——五档灰阶方块，
// 越黑越高。对角线不参与（自己×自己），零格留一粒小点（沉默可见）。
// 最强的一对上虚线框 + 标数。区别于 F10 dot heat：这里编码用明度不用面积，
// 值是占比/强度而不是可数件数。
const MON=__data("MON",['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']);
const DAY=__data("DAY",['MON','WED','FRI','SUN']);
const val0=(w,d)=>{
  const wd=d<5;
  const season=1+.55*Math.sin((w-8)/9);            // 春秋两个发布季
  if(!wd)return rnd(w*7+d+1,3)>.82?1:0;            // 周末基本静默
  const raw=season*(2.5+rnd(w*7+d+1,d+2)*9)*(rnd(w+1,d+5)>.12?1:0);
  return Math.round(raw);
};
obsReveal('calheat',s=>{
  const X0=56,Y0=42,P=14.8;
  const val=(w,d)=>__cell("cells",w,d,val0(w,d));
  let max=0,mw=0,md=0;
  for(let w=0;w<52;w++)for(let d=0;d<7;d++){const t=val(w,d);if(t>max){max=t;mw=w;md=d}}
  DAY.forEach((lab,k)=>{
    txt(s,{x:X0-10,y:Y0+[0,2,4,6][k]*P+3,'font-size':6.5,'font-weight':700,fill:'#8F8E88','text-anchor':'end',
      'letter-spacing':'.06em',class:'fade',style:`animation-delay:${k*.04}s`},lab);
  });
  MON.forEach((m,k)=>{
    const x=X0+Math.round(k*52/12)*P;
    txt(s,{x,y:Y0-16,'font-size':7,'font-weight':700,fill:MUTED,'letter-spacing':'.1em',
      class:'fade',style:`animation-delay:${k*.03}s`},m);
    el(s,'line',{x1:x,y1:Y0-11,x2:x,y2:Y0-5,stroke:'#C6C5BF','stroke-width':.7,
      class:'fade',style:`animation-delay:${k*.03}s`});
  });
  for(let w=0;w<52;w++)for(let d=0;d<7;d++){
    const x=X0+w*P,y=Y0+d*P,t=val(w,d),delay=w*.012+d*.004;
    if(!t){el(s,'circle',{cx:x,cy:y,r:.75,fill:'#D8D6CE',
      class:'pop',style:`animation-delay:${delay}s`});continue}
    const r=1.1+Math.sqrt(t)*1.55;
    const dot=el(s,'circle',{cx:x,cy:y,r,
      fill:t>max*.66?INK:t>max*.33?'#6A6963':'#B0AFA9',
      class:'pop',style:`animation-delay:${delay}s`});
    tip(dot,`W${w+1} ${['MON','TUE','WED','THU','FRI','SAT','SUN'][d]} — ${t} deploys`);
  }
  // peak: dashed ring + marginalia hairline
  const px=X0+mw*P,py=Y0+md*P,pr=1.1+Math.sqrt(max)*1.55;
  el(s,'circle',{cx:px,cy:py,r:pr+3.6,fill:'none',stroke:INK,'stroke-width':1,
    'stroke-dasharray':'2 3',class:'fade',style:'animation-delay:1s'});
  txt(s,{x:420,y:222,'font-size':7,'font-weight':600,fill:'#B0AFA9','text-anchor':'middle',
    'letter-spacing':'.12em',class:'fade',style:'animation-delay:1.2s'},
    'ONE DOT = ONE DAY · DOT AREA = DEPLOYS · TINY DOT = A QUIET DAY');
});
    },
    "ridge": () => {
const INK='#1C1C1A',PAPER='#F0EFEB',MUTED='#8F8E88',GRID='#DEDDD6';
const NS='http://www.w3.org/2000/svg';



const rnd=(i,k)=>Math.abs(((i*73856093)^(k*19349663))%1000)/1000;

// ════ L16 · matrix heat ════
// 通用矩阵热力：任意 分类×分类×连续值。明度即数据——五档灰阶方块，
// 越黑越高。对角线不参与（自己×自己），零格留一粒小点（沉默可见）。
// 最强的一对上虚线框 + 标数。区别于 F10 dot heat：这里编码用明度不用面积，
// 值是占比/强度而不是可数件数。
const ROWS=__data("ROWS",[['MOBILE',3.2,1.3],['DESKTOP',5.1,1.9],['API',7.4,2.3],['IMPORTS',10.8,3.2],['BATCH',15.2,4]]);
obsReveal('ridge',s=>{
  const X0=92,X1=372,MAXH=24,N=72,LIFT=54;
  const rowY=i=>96+i*44;
  ROWS.forEach(([name,c,sp],i)=>{
    const y0=rowY(i);
    const dens=Array.from({length:N},(_,k)=>{
      const h=k/(N-1)*MAXH;
      return Math.exp(-((h-c)**2)/(2*sp*sp))+.26*Math.exp(-((h-c*2.1)**2)/(2*(sp*1.7)**2));
    });
    const dmax=Math.max(...dens);
    const pts=dens.map((d,k)=>[X0+k/(N-1)*(X1-X0),y0-d/dmax*LIFT]);
    const crest='M'+pts.map(p=>p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' L ');
    el(s,'path',{d:crest+` L${X1} ${y0} L${X0} ${y0} Z`,fill:PAPER,'fill-opacity':.96,
      class:'fade',style:`animation-delay:${i*.1}s`});
    pts.forEach(([px,py],k)=>{
      if(k%2)return;
      el(s,'line',{x1:px,y1:y0,x2:px,y2:py,stroke:'#8F8E88','stroke-width':.5,
        opacity:.28+rnd(k+1,i+3)*.32,class:'fade',style:`animation-delay:${i*.1+k*.004}s`});
    });
    el(s,'path',{d:crest,fill:'none',stroke:INK,'stroke-width':.9,pathLength:1,
      class:'draw',style:`animation-delay:${.1+i*.1}s;animation-duration:.8s`});
    el(s,'line',{x1:X0,y1:y0,x2:X1,y2:y0,stroke:GRID,'stroke-width':.7,
      class:'fade',style:`animation-delay:${i*.1}s`});
    const pk=dens.indexOf(dmax),[px,py]=pts[pk];
    const dot=el(s,'circle',{cx:px,cy:py,r:2.6,fill:INK,class:'pop',style:`animation-delay:${.6+i*.1}s`});
    tip(dot,`${name} — most runs finish around ${c.toFixed(1)}h`);
    txt(s,{x:px+7,y:py+1,'font-size':8,'font-weight':800,fill:INK,
      style:`paint-order:stroke;stroke:${PAPER};stroke-width:3px;animation-delay:${.7+i*.1}s`,
      class:'fade'},c.toFixed(1)+'h');
    txt(s,{x:X0-10,y:y0-3,'font-size':7.5,'font-weight':700,fill:'#6A6963','text-anchor':'end',
      'letter-spacing':'.06em',class:'fade',style:`animation-delay:${i*.1}s`},name);
  });
  const yb=rowY(4);
  [0,6,12,18,24].forEach(h=>{
    const x=X0+h/MAXH*(X1-X0);
    el(s,'line',{x1:x,y1:yb+4,x2:x,y2:yb+9,stroke:'#CFCEC7','stroke-width':.6,
      class:'fade',style:'animation-delay:.8s'});
    txt(s,{x,y:yb+20,'font-size':7,'font-weight':600,fill:MUTED,'text-anchor':'middle',
      class:'fade',style:'animation-delay:.85s'},h+'h');
  });
  txt(s,{x:200,y:308,'font-size':7,'font-weight':600,fill:'#B0AFA9','text-anchor':'middle',
    'letter-spacing':'.12em',class:'fade',style:'animation-delay:1.1s'},
    'EACH CREST = ONE PIPELINE · THE AREA IS MADE OF HAIRLINES · DOT = THE PEAK');
});
    },
    "parallel": () => {
const INK='#1C1C1A',PAPER='#F0EFEB',MUTED='#8F8E88',GRID='#DEDDD6';
const NS='http://www.w3.org/2000/svg';



const rnd=(i,k)=>Math.abs(((i*73856093)^(k*19349663))%1000)/1000;

// ════ L16 · matrix heat ════
// 通用矩阵热力：任意 分类×分类×连续值。明度即数据——五档灰阶方块，
// 越黑越高。对角线不参与（自己×自己），零格留一粒小点（沉默可见）。
// 最强的一对上虚线框 + 标数。区别于 F10 dot heat：这里编码用明度不用面积，
// 值是占比/强度而不是可数件数。
const DIMS=__data("DIMS",[['PRICE $',8,30],['CSAT',6,9.6],['RETENTION %',55,95],['GROWTH %',-5,40]]);
const P=__data("P",[['Editor',12,9.1,91,22],['Boards',18,8.4,86,18],['Forms',9,8.8,78,31],
  ['Docs',15,8.0,82,12],['Chat',7,7.2,64,8],['Vault',24,7.8,88,6],
  ['Flows',21,8.6,90,38],['Views',11,7.5,71,14],['Sync',16,6.9,58,-2],
  ['Pages',8,8.2,74,19],['Grid',19,7.1,62,4],['Hub',13,6.6,52,9]]);
obsReveal('parallel',s=>{
  const AX=[64,156,248,340],TOP=64,BOT=252;
  const mapY=(di,v)=>{const [,lo,hi]=DIMS[di];return BOT-(v-lo)/(hi-lo)*(BOT-TOP)};
  // hero: judged on csat+retention+growth (price is a fact, not a virtue)
  const score=p=>(p[2]-6)/3.6+(p[3]-55)/40+(p[4]+5)/45;
  const hero=P.reduce((a,b)=>score(b)>score(a)?b:a);
  DIMS.forEach(([name,lo,hi],di)=>{
    el(s,'line',{x1:AX[di],y1:TOP-8,x2:AX[di],y2:BOT+8,stroke:'#B0AFA9','stroke-width':1,
      class:'fade',style:`animation-delay:${di*.06}s`});
    [[TOP-8],[BOT+8]].forEach(([yy])=>
      el(s,'line',{x1:AX[di]-4,y1:yy,x2:AX[di]+4,y2:yy,stroke:'#B0AFA9','stroke-width':1,
        class:'fade',style:`animation-delay:${di*.06}s`}));
    txt(s,{x:AX[di],y:TOP-22,'font-size':7,'font-weight':800,fill:'#6A6963','text-anchor':'middle',
      'letter-spacing':'.08em',class:'fade',style:`animation-delay:${di*.06}s`},name);
    txt(s,{x:AX[di]+8,y:TOP-5,'font-size':6.5,'font-weight':600,fill:'#C6C5BF',
      class:'fade',style:`animation-delay:${.1+di*.06}s`},hi);
    txt(s,{x:AX[di]+8,y:BOT+11,'font-size':6.5,'font-weight':600,fill:'#C6C5BF',
      class:'fade',style:`animation-delay:${.1+di*.06}s`},lo);
  });
  P.forEach((p,i)=>{
    const isHero=p===hero;
    const ys=[mapY(0,p[1]),mapY(1,p[2]),mapY(2,p[3]),mapY(3,p[4])];
    let d=`M${AX[0]} ${ys[0].toFixed(1)}`;
    for(let k=0;k<3;k++){
      const mx=(AX[k]+AX[k+1])/2;
      d+=` C${mx} ${ys[k].toFixed(1)} ${mx} ${ys[k+1].toFixed(1)} ${AX[k+1]} ${ys[k+1].toFixed(1)}`;
    }
    const ln=el(s,'path',{d,fill:'none',
      stroke:isHero?INK:'#8F8E88','stroke-width':isHero?2:.65,
      opacity:isHero?1:.5+rnd(i+1,5)*.3,pathLength:1,
      class:'draw',style:`animation-delay:${.2+i*.05}s;animation-duration:.8s`});
    tip(ln,`${p[0]} — $${p[1]} · CSAT ${p[2]} · ${p[3]}% retained · ${p[4]}% growth`);
    ys.forEach((y,di)=>el(s,'circle',{cx:AX[di],cy:y,r:isHero?3:1.4,
      fill:isHero?INK:'#8F8E88',opacity:isHero?1:.7,
      class:'pop',style:`animation-delay:${.3+i*.05+di*.04}s`}));
    if(isHero)
      txt(s,{x:AX[3]+12,y:ys[3]+3,'font-size':9,'font-weight':800,fill:INK,
        style:`paint-order:stroke;stroke:${PAPER};stroke-width:3px;animation-delay:1s`,
        class:'fade'},p[0]);
  });
  txt(s,{x:200,y:302,'font-size':7,'font-weight':600,fill:'#B0AFA9','text-anchor':'middle',
    'letter-spacing':'.12em',class:'fade',style:'animation-delay:1.2s'},
    'ONE HAIRLINE = ONE PRODUCT · INK = BEST ACROSS THE BOARD');
});
    },
    };
  };
  CHARTS["lupi-gallery"] = make_lupi_gallery;
  const make_basics_gallery = (el, txt, tip, obsReveal, __data, __fn, __cell) => {
  const none = new Proxy(function () {}, {get: (t, k) => (k === Symbol.toPrimitive ? () => '' : none), apply: () => none, construct: () => none, set: () => true});
  const Chart = none, echarts = none;

// ── shared Mono tokens（与 lupi-gallery 同源） ──
const INK='#1C1C1A',PAPER='#F0EFEB',MUTED='#8F8E88',GRID='#DEDDD6';
const NS='http://www.w3.org/2000/svg';



const rnd=(i,k)=>Math.abs(((i*73856093)^(k*19349663))%1000)/1000;
const D2R=Math.PI/180;
const pol=(cx,cy,r,deg)=>[cx+r*Math.cos(deg*D2R),cy+r*Math.sin(deg*D2R)];


// ════ B1 · rung bars ════
// 柱状图的 Lupi 化：柱身 = 一格格横档，1 档 = 1 个诚实单位。
// 远看是柱状图剪影，近看每一档都数得出来。档长、透明度 rnd 抖动。

    return {
    "rungs": () => {

const D=__data("D",[['FREE',38],['STARTER',27],['PRO',22],['TEAM',16],['SCALE',11],['ENT',7]]);
obsReveal('rungs',s=>{
  const x0=i=>56+i*56,base=266,step=5.6,HW=14;
  D.forEach(([name,v],i)=>{
    const x=x0(i);
    for(let k=0;k<v;k++){
      const y=base-k*step,w=HW-1.5+rnd(k+1,i+2)*3;
      el(s,'line',{x1:x-w,y1:y,x2:x+w,y2:y,stroke:INK,'stroke-width':1,
        opacity:.5+rnd(k+2,i+4)*.5,class:'fade',style:`animation-delay:${i*.08+k*.012}s`});
      if(k%5===4)el(s,'circle',{cx:x+HW+4.5,cy:y,r:.8,fill:'#C6C5BF',
        class:'fade',style:`animation-delay:${i*.08+k*.012}s`});
    }
    const topY=base-(v-1)*step;
    const num=txt(s,{x,y:topY-10,'font-size':11,'font-weight':800,fill:INK,'text-anchor':'middle',
      class:'fade',style:`animation-delay:${.4+i*.08}s`},v);
    tip(num,`${name} — $${v}k MRR`);
    txt(s,{x,y:base+18,'font-size':7.5,'font-weight':700,fill:MUTED,'text-anchor':'middle',
      'letter-spacing':'.08em',class:'fade',style:`animation-delay:${i*.08}s`},name);
  });
  el(s,'line',{x1:28,y1:base+4,x2:372,y2:base+4,stroke:GRID,'stroke-width':.8,class:'fade'});
  txt(s,{x:200,y:306,'font-size':7,'font-weight':600,fill:'#B0AFA9','text-anchor':'middle',
    'letter-spacing':'.12em',class:'fade',style:'animation-delay:.9s'},
    'ONE RUNG = $1K · DOT MARKS EVERY FIFTH');
});
    },
    "dayline": () => {

const N=__data("N",30);
const val=__fn("values",d=>46+22*Math.sin(d/4.6)+14*Math.sin(d/2.1)+rnd(d+1,5)*12);
obsReveal('dayline',s=>{
  const x=d=>30+d*11.7,base=262,map=v=>base-v*2.15;
  // calendar floor
  for(let d=0;d<N;d++)
    el(s,'line',{x1:x(d),y1:base,x2:x(d),y2:base-7,stroke:'#CFCEC7','stroke-width':.6,
      class:'fade',style:`animation-delay:${d*.008}s`});
  el(s,'line',{x1:24,y1:base,x2:376,y2:base,stroke:GRID,'stroke-width':.8,class:'fade'});
  const vs=Array.from({length:N},(_,d)=>val(d));
  // top-2 peaks, apart
  const top=[];
  for(const d of [...vs.keys()].sort((a,b)=>vs[b]-vs[a])){
    if(top.every(t=>Math.abs(t-d)>=5))top.push(d);
    if(top.length===2)break;
  }
  // hairline path
  const pts=vs.map((v,d)=>`${x(d)} ${map(v)}`).join(' L ');
  el(s,'path',{d:'M'+pts,fill:'none',stroke:INK,'stroke-width':1,pathLength:1,
    class:'draw',style:'animation-duration:1.2s'});
  vs.forEach((v,d)=>{
    const weekend=d%7===5||d%7===6,big=top.includes(d);
    const dot=el(s,'circle',{cx:x(d),cy:map(v),r:big?4.2:2.1,
      fill:weekend?PAPER:INK,stroke:INK,'stroke-width':weekend?1:0,
      class:'pop',style:`animation-delay:${.2+d*.03}s`});
    tip(dot,`Day ${d+1} — ${Math.round(v)} sign-ups`);
    if(big)txt(s,{x:x(d),y:map(v)-11,'font-size':9.5,'font-weight':800,fill:INK,'text-anchor':'middle',
      style:`paint-order:stroke;stroke:${PAPER};stroke-width:3px;animation-delay:${1+d*.01}s`,
      class:'fade'},Math.round(v));
  });
  [[0,'JUN 1'],[14,'JUN 15'],[29,'JUN 30']].forEach(([d,m])=>
    txt(s,{x:x(d),y:base+18,'font-size':7.5,'font-weight':600,fill:MUTED,'text-anchor':'middle',
      'letter-spacing':'.1em',class:'fade'},m));
  txt(s,{x:200,y:306,'font-size':7,'font-weight':600,fill:'#B0AFA9','text-anchor':'middle',
    'letter-spacing':'.12em',class:'fade',style:'animation-delay:1.1s'},
    'ONE DOT = ONE DAY · HOLLOW = WEEKEND');
});
    },
    "hairarea": () => {

const N=__data("N",45);
const val=__fn("values",d=>34+26*Math.sin(d/7.2)+12*Math.sin(d/2.8)+rnd(d+1,3)*16);
obsReveal('hairarea',s=>{
  const x=d=>28+d*7.75,base=262,map=v=>base-v*2.35;
  el(s,'line',{x1:22,y1:base,x2:378,y2:base,stroke:GRID,'stroke-width':.8,class:'fade'});
  const vs=Array.from({length:N},(_,d)=>val(d));
  const peak=vs.indexOf(Math.max(...vs));
  vs.forEach((v,d)=>{
    el(s,'line',{x1:x(d),y1:base,x2:x(d),y2:map(v),
      stroke:d===peak?INK:'#8F8E88','stroke-width':d===peak?1.1:.55,
      opacity:d===peak?1:.5+rnd(d+1,7)*.45,
      class:'fade',style:`animation-delay:${d*.014}s`});
  });
  const pts=vs.map((v,d)=>`${x(d)} ${map(v)}`).join(' L ');
  el(s,'path',{d:'M'+pts,fill:'none',stroke:INK,'stroke-width':1.2,pathLength:1,
    class:'draw',style:'animation-delay:.4s;animation-duration:1.2s'});
  const pd=el(s,'circle',{cx:x(peak),cy:map(vs[peak]),r:4.2,fill:INK,
    class:'pop',style:'animation-delay:1.2s'});
  tip(pd,`Day ${peak+1} — ${Math.round(vs[peak])}k peak`);
  txt(s,{x:x(peak),y:map(vs[peak])-11,'font-size':9.5,'font-weight':800,fill:INK,'text-anchor':'middle',
    style:`paint-order:stroke;stroke:${PAPER};stroke-width:3px;animation-delay:1.3s`,
    class:'fade'},Math.round(vs[peak])+'k');
  [[0,'MAY'],[22,'JUN'],[44,'JUL']].forEach(([d,m])=>
    txt(s,{x:x(d),y:base+18,'font-size':7.5,'font-weight':600,fill:MUTED,'text-anchor':'middle',
      'letter-spacing':'.1em',class:'fade'},m));
  txt(s,{x:200,y:306,'font-size':7,'font-weight':600,fill:'#B0AFA9','text-anchor':'middle',
    'letter-spacing':'.12em',class:'fade',style:'animation-delay:1.3s'},
    'ONE HAIRLINE = ONE DAY, FLOOR TO PEAK');
});
    },
    "tickdonut": () => {

const D=__data("D",[['ORGANIC',37,INK],['PAID',28,'#55554F'],['REFERRAL',21,'#8F8E88'],['SOCIAL',14,'#B0AFA9']]);
obsReveal('tickdonut',s=>{
  const cx=200,cy=148,R0=64;
  let k0=0;
  D.forEach(([name,v,shade],si)=>{
    for(let k=0;k<v;k++){
      const idx=k0+k,a=idx*3.6-90;
      const len=10+rnd(idx+1,si+2)*6;
      const [x1,y1]=pol(cx,cy,R0,a),[x2,y2]=pol(cx,cy,R0+len,a);
      el(s,'line',{x1,y1,x2,y2,stroke:shade,'stroke-width':1,
        class:'fade',style:`animation-delay:${idx*.012}s`});
      if(idx%10===0){
        const [dx,dy]=pol(cx,cy,R0-5,a);
        el(s,'circle',{cx:dx,cy:dy,r:.8,fill:'#C6C5BF',
          class:'fade',style:`animation-delay:${idx*.012}s`});
      }
    }
    // segment label at mid-angle, outside, tied by a dotted hairline
    const mid=(k0+v/2)*3.6-90,[lx,ly]=pol(cx,cy,R0+38,mid),[gx,gy]=pol(cx,cy,R0+20,mid);
    el(s,'line',{x1:gx,y1:gy,x2:lx,y2:ly,stroke:'#C6C5BF','stroke-width':.7,
      'stroke-dasharray':'1 3',class:'fade',style:`animation-delay:${.6+si*.1}s`});
    const anchor=Math.cos(mid*D2R)>0.3?'start':Math.cos(mid*D2R)<-0.3?'end':'middle';
    const lab=txt(s,{x:lx,y:ly+3,'font-size':8,'font-weight':800,fill:shade,'text-anchor':anchor,
      'letter-spacing':'.06em',style:`paint-order:stroke;stroke:${PAPER};stroke-width:3px;animation-delay:${.65+si*.1}s`,
      class:'fade'},`${name} · ${v}`);
    tip(lab,`${name} — ${v}% of traffic`);
    k0+=v;
  });
  txt(s,{x:cx,y:cy-2,'font-size':22,'font-weight':800,fill:INK,'text-anchor':'middle',
    class:'fade',style:'animation-delay:.9s'},'100');
  txt(s,{x:cx,y:cy+14,'font-size':7,'font-weight':600,fill:MUTED,'text-anchor':'middle',
    'letter-spacing':'.1em',class:'fade',style:'animation-delay:.9s'},'TICKS · ONE = 1%');
  txt(s,{x:200,y:296,'font-size':7,'font-weight':600,fill:'#B0AFA9','text-anchor':'middle',
    'letter-spacing':'.12em',class:'fade',style:'animation-delay:1.1s'},
    'TWELVE O’CLOCK IS ZERO · DOT MARKS EVERY TENTH · READS CLOCKWISE');
});
    },
    "tickrows": () => {

const D=__data("D",[['PLATFORM',34],['GROWTH',28],['MOBILE',22],['INFRA',17],['ML',11],['DESIGN',8]]);
obsReveal('tickrows',s=>{
  const y0=i=>52+i*44,X0=104,PX=6.9;
  D.forEach(([name,v],i)=>{
    const y=y0(i);
    txt(s,{x:94,y:y+3,'font-size':8,'font-weight':700,fill:'#6A6963','text-anchor':'end',
      'letter-spacing':'.08em',class:'fade',style:`animation-delay:${i*.08}s`},name);
    el(s,'line',{x1:X0,y1:y+9,x2:X0+34*PX,y2:y+9,stroke:GRID,'stroke-width':.6,
      class:'fade',style:`animation-delay:${i*.08}s`});
    for(let k=0;k<v;k++){
      const x=X0+k*PX+PX/2,h=9+rnd(k+1,i+2)*6;
      el(s,'line',{x1:x,y1:y+9,x2:x,y2:y+9-h,stroke:INK,'stroke-width':.9,
        opacity:.55+rnd(k+3,i+5)*.45,class:'fade',style:`animation-delay:${i*.08+k*.012}s`});
      if(k%5===4)el(s,'circle',{cx:x,cy:y+13,r:.8,fill:'#C6C5BF',
        class:'fade',style:`animation-delay:${i*.08+k*.012}s`});
    }
    const lab=txt(s,{x:X0+v*PX+10,y:y+4,'font-size':11,'font-weight':800,fill:INK,
      class:'fade',style:`animation-delay:${.4+i*.08}s`},v);
    tip(lab,`${name} — ${v} releases`);
  });
  txt(s,{x:200,y:308,'font-size':7,'font-weight':600,fill:'#B0AFA9','text-anchor':'middle',
    'letter-spacing':'.12em',class:'fade',style:'animation-delay:.9s'},
    'ONE TICK = ONE RELEASE · DOT MARKS EVERY FIFTH');
});
    },
    "pairrungs": () => {

const D=__data("D",[['FREE',31,38],['STARTER',22,27],['PRO',16,22],['TEAM',13,16],['ENT',6,9]]);
obsReveal('pairrungs',s=>{
  const x0=i=>64+i*66,base=258,step=5.4,HW=10;
  D.forEach(([name,was,now],i)=>{
    const xa=x0(i)-13,xb=x0(i)+13;
    for(let k=0;k<was;k++){
      const y=base-k*step,w=HW-1.2+rnd(k+1,i+2)*2.4;
      el(s,'line',{x1:xa-w,y1:y,x2:xa+w,y2:y,stroke:'#B0AFA9','stroke-width':1,
        opacity:.5+rnd(k+2,i+3)*.4,class:'fade',style:`animation-delay:${i*.08+k*.01}s`});
    }
    for(let k=0;k<now;k++){
      const y=base-k*step,w=HW-1.2+rnd(k+1,i+7)*2.4;
      el(s,'line',{x1:xb-w,y1:y,x2:xb+w,y2:y,stroke:INK,'stroke-width':1,
        opacity:.6+rnd(k+2,i+8)*.4,class:'fade',style:`animation-delay:${.15+i*.08+k*.01}s`});
    }
    const topB=base-(now-1)*step;
    const num=txt(s,{x:xb,y:topB-9,'font-size':10.5,'font-weight':800,fill:INK,'text-anchor':'middle',
      class:'fade',style:`animation-delay:${.5+i*.08}s`},now);
    tip(num,`${name} — $${was}k → $${now}k`);
    txt(s,{x:xa,y:base-(was-1)*step-9,'font-size':8.5,'font-weight':700,fill:'#B0AFA9','text-anchor':'middle',
      class:'fade',style:`animation-delay:${.5+i*.08}s`},was);
    txt(s,{x:x0(i),y:base+18,'font-size':7.5,'font-weight':700,fill:MUTED,'text-anchor':'middle',
      'letter-spacing':'.08em',class:'fade',style:`animation-delay:${i*.08}s`},name);
  });
  el(s,'line',{x1:30,y1:base+4,x2:370,y2:base+4,stroke:GRID,'stroke-width':.8,class:'fade'});
  txt(s,{x:200,y:306,'font-size':7,'font-weight':600,fill:'#B0AFA9','text-anchor':'middle',
    'letter-spacing':'.12em',class:'fade',style:'animation-delay:1s'},
    'FAINT = 2025 · INK = 2026 · ONE RUNG = $1K');
});
    },
    "stackrungs": () => {

const D=__data("D",[['NA',[18,11,7]],['EU',[14,9,5]],['APAC',[9,7,6]],['LATAM',[5,4,2]]]);
const SHADE=__data("SHADE",[INK,'#8F8E88','#C0BFB8']);
const SEG=__data("SEG",['CORE','ADD-ONS','SERVICES']);
obsReveal('stackrungs',s=>{
  const x0=i=>72+i*76,base=262,step=5.2,HW=13;
  D.forEach(([name,segs],i)=>{
    const x=x0(i);let k0=0;
    segs.forEach((v,si)=>{
      for(let k=0;k<v;k++){
        const y=base-(k0+k+si)*step,w=HW-1.4+rnd(k+1,i*3+si+2)*2.8;
        el(s,'line',{x1:x-w,y1:y,x2:x+w,y2:y,stroke:SHADE[si],'stroke-width':1,
          opacity:.6+rnd(k+2,i+si+4)*.4,class:'fade',
          style:`animation-delay:${i*.09+(k0+k)*.012}s`});
      }
      const midY=base-(k0+v/2+si)*step;
      const lab=txt(s,{x:x+HW+7,y:midY+2.5,'font-size':8,'font-weight':800,fill:SHADE[si]===`#C0BFB8`?'#8F8E88':SHADE[si],
        class:'fade',style:`animation-delay:${.5+i*.09+si*.06}s`},v);
      tip(lab,`${name} ${SEG[si]} — $${v}k`);
      k0+=v;
    });
    const total=segs[0]+segs[1]+segs[2];
    txt(s,{x,y:base-(k0+2)*step-8,'font-size':10.5,'font-weight':800,fill:INK,'text-anchor':'middle',
      class:'fade',style:`animation-delay:${.6+i*.09}s`},total);
    txt(s,{x,y:base+18,'font-size':7.5,'font-weight':700,fill:MUTED,'text-anchor':'middle',
      'letter-spacing':'.08em',class:'fade',style:`animation-delay:${i*.09}s`},name);
  });
  el(s,'line',{x1:36,y1:base+4,x2:364,y2:base+4,stroke:GRID,'stroke-width':.8,class:'fade'});
  txt(s,{x:200,y:306,'font-size':7,'font-weight':600,fill:'#B0AFA9','text-anchor':'middle',
    'letter-spacing':'.12em',class:'fade',style:'animation-delay:1.1s'},
    'DARKEST = CORE · MID = ADD-ONS · PALE = SERVICES · ONE RUNG = $1K');
});
    },
    "plumb": () => {

const P=__data("P",[['Editor',72,86],['Boards',58,74],['Docs',44,79],['Chat',38,62],['Flows',66,58],
         ['Vault',82,71],['Pages',28,55],['Sync',52,49],['Grid',88,44],['Views',20,68],
         ['Hub',76,32],['Forms',34,38]]);
obsReveal('plumb',s=>{
  const X0=48,X1=368,base=258,mapX=p=>X0+p/100*(X1-X0),mapY=v=>base-(v-20)*2.6;
  // barcode floor
  for(let g=0;g<=20;g++){
    const x=X0+g/20*(X1-X0);
    el(s,'line',{x1:x,y1:base,x2:x,y2:base-(g%5===0?7:4),stroke:'#CFCEC7','stroke-width':.6,
      class:'fade',style:`animation-delay:${g*.01}s`});
  }
  el(s,'line',{x1:X0-6,y1:base,x2:X1+6,y2:base,stroke:GRID,'stroke-width':.8,class:'fade'});
  txt(s,{x:X0,y:base+16,'font-size':7,'font-weight':600,fill:'#C6C5BF',class:'fade'},'CHEAP');
  txt(s,{x:X1,y:base+16,'font-size':7,'font-weight':600,fill:'#C6C5BF','text-anchor':'end',
    class:'fade'},'PREMIUM');
  const best=P.reduce((a,b)=>b[2]>a[2]?b:a),worst=P.reduce((a,b)=>b[2]<a[2]?b:a);
  P.forEach(([name,px,sat],i)=>{
    const x=mapX(px),y=mapY(sat),hero=name===best[0]||name===worst[0];
    el(s,'line',{x1:x,y1:base,x2:x,y2:y,stroke:'#B0AFA9','stroke-width':.55,
      opacity:.6,class:'fade',style:`animation-delay:${.2+i*.05}s`});
    const dot=el(s,'circle',{cx:x,cy:y,r:hero?4.6:2.6,fill:hero?INK:'#55554F',
      class:'pop',style:`animation-delay:${.25+i*.05}s`});
    tip(dot,`${name} — price ${px} · satisfaction ${sat}`);
    if(hero)txt(s,{x,y:y-10,'font-size':8.5,'font-weight':800,fill:INK,'text-anchor':'middle',
      style:`paint-order:stroke;stroke:${PAPER};stroke-width:3px;animation-delay:${.8}s`,
      class:'fade'},`${name} · ${sat}`);
  });
  txt(s,{x:26,y:mapY(85),'font-size':7,'font-weight':600,fill:'#C6C5BF',
    transform:`rotate(-90 26 ${mapY(85)})`,'text-anchor':'end','letter-spacing':'.08em',class:'fade'},'HAPPIER ↑');
  txt(s,{x:200,y:306,'font-size':7,'font-weight':600,fill:'#B0AFA9','text-anchor':'middle',
    'letter-spacing':'.12em',class:'fade',style:'animation-delay:1s'},
    'EVERY DOT HANGS A PLUMB LINE · READ X AT THE FLOOR');
});
    },
    "fall": () => {

const D=__data("D",[['GROSS',42,null],['REFUNDS',-6,null],['COGS',-11,null],['OPS',-8,null],['NET',17,'total']]);
obsReveal('fall',s=>{
  const x0=i=>58+i*72,step=5.2,HW=11;
  let run=0;
  const levels=[];
  D.forEach(([name,v],i)=>{levels.push([name,v,run]);if(i!==D.length-1)run+=v});
  // recompute cleanly: running level after each step
  let lv=0;const rows=[];
  D.forEach(([name,v],i)=>{
    if(i===0){rows.push([name,v,0,v]);lv=v}
    else if(i===D.length-1){rows.push([name,lv,0,lv])}
    else{rows.push([name,v,lv+v,lv]);lv=lv+v}
  });
  const base=252,yOf=k=>base-k*step;
  rows.forEach(([name,v,lo,hi],i)=>{
    const x=x0(i),isTotal=i===0||i===rows.length-1,neg=v<0&&!isTotal;
    const from=isTotal?0:lo,to=isTotal?v:hi,n=Math.abs(to-from);
    for(let k=0;k<n;k++){
      const y=yOf(from+k),w=HW-1.2+rnd(k+1,i+2)*2.4;
      if(neg)el(s,'line',{x1:x-w,y1:y,x2:x+w,y2:y,stroke:'#8F8E88','stroke-width':1,
        'stroke-dasharray':'2.5 2.5',opacity:.7,class:'fade',
        style:`animation-delay:${i*.12+k*.014}s`});
      else el(s,'line',{x1:x-w,y1:y,x2:x+w,y2:y,stroke:INK,'stroke-width':1,
        opacity:.6+rnd(k+2,i+4)*.4,class:'fade',style:`animation-delay:${i*.12+k*.014}s`});
    }
    // step hand-off: dashed hairline to the next column's start level
    if(i<rows.length-1){
      const nx=x0(i+1),yl=yOf(isTotal?v:hi- (neg?0:0));
      const lvl=isTotal?v:(neg?lo:hi);
      el(s,'line',{x1:x+HW+2,y1:yOf(lvl),x2:nx-HW-2,y2:yOf(lvl),stroke:'#C6C5BF',
        'stroke-width':.7,'stroke-dasharray':'2 3',class:'fade',
        style:`animation-delay:${.3+i*.12}s`});
    }
    const topY=yOf(Math.max(from,to));
    const num=txt(s,{x,y:topY-8,'font-size':10,'font-weight':800,
      fill:neg?'#8F8E88':INK,'text-anchor':'middle',
      class:'fade',style:`animation-delay:${.4+i*.12}s`},(neg?'−':'')+Math.abs(v));
    tip(num,`${name} — ${neg?'−':''}$${Math.abs(v)}k`);
    txt(s,{x,y:base+18,'font-size':7.5,'font-weight':700,fill:MUTED,'text-anchor':'middle',
      'letter-spacing':'.08em',class:'fade',style:`animation-delay:${i*.12}s`},name);
  });
  el(s,'line',{x1:30,y1:base+4,x2:370,y2:base+4,stroke:GRID,'stroke-width':.8,class:'fade'});
  txt(s,{x:200,y:302,'font-size':7,'font-weight':600,fill:'#B0AFA9','text-anchor':'middle',
    'letter-spacing':'.12em',class:'fade',style:'animation-delay:1.2s'},
    'SOLID RUNGS ADD · DASHED RUNGS TAKE AWAY · ONE RUNG = $1K');
});
    },
    "dotheat": () => {

const DAY=__data("DAY",['MON','TUE','WED','THU','FRI','SAT','SUN']);
obsReveal('dotheat',s=>{
  const x0=j=>64+j*27,y0=i=>58+i*30;
  let max=0,mi=0,mj=0;
  const v0=(i,j)=>{
    const day=i<5?1:.32;                       // weekends quiet
    const hour=Math.exp(-((j-4.6)**2)/7)+.7*Math.exp(-((j-8.4)**2)/5); // two peaks
    const raw=day*hour*22*(0.6+rnd(i*12+j+1,j+3)*.8);
    return Math.round(raw);
  };
  const v=(i,j)=>__cell("cells",i,j,v0(i,j));
  for(let i=0;i<7;i++)for(let j=0;j<12;j++){const t=v(i,j);if(t>max){max=t;mi=i;mj=j}}
  for(let i=0;i<7;i++){
    txt(s,{x:50,y:y0(i)+3,'font-size':7.5,'font-weight':700,fill:'#6A6963','text-anchor':'end',
      'letter-spacing':'.08em',class:'fade',style:`animation-delay:${i*.05}s`},DAY[i]);
    for(let j=0;j<12;j++){
      const t=v(i,j),x=x0(j),y=y0(i);
      if(!t){el(s,'circle',{cx:x,cy:y,r:.8,fill:'#D8D6CE',
        class:'pop',style:`animation-delay:${i*.05+j*.015}s`});continue}
      const hero=i===mi&&j===mj;
      const dot=el(s,'circle',{cx:x,cy:y,r:1.2+Math.sqrt(t)*2.1,
        fill:t>max*.66?INK:t>max*.33?'#6A6963':'#B0AFA9',
        class:'pop',style:`animation-delay:${i*.05+j*.015}s`});
      tip(dot,`${DAY[i]} ${8+j}:00 — ${t} tickets`);
      if(hero)el(s,'circle',{cx:x,cy:y,r:1.2+Math.sqrt(t)*2.1+3.4,fill:'none',
        stroke:INK,'stroke-width':1,'stroke-dasharray':'2 3',
        class:'fade',style:'animation-delay:1s'});
    }
  }
  for(let j=0;j<12;j+=2)
    txt(s,{x:x0(j),y:y0(6)+26,'font-size':7,'font-weight':600,fill:'#C6C5BF','text-anchor':'middle',
      class:'fade',style:`animation-delay:${j*.02}s`},(8+j)+':00');
  txt(s,{x:200,y:306,'font-size':7,'font-weight':600,fill:'#B0AFA9','text-anchor':'middle',
    'letter-spacing':'.12em',class:'fade',style:'animation-delay:1.1s'},
    `DOT AREA = TICKETS · DASHED RING = THE PEAK, ${max} · TINY DOT = A QUIET HOUR`);
});
    },
    "gauge": () => {

const GOAL=__data("GOAL",73);
obsReveal('gauge',s=>{
  const cx=200,cy=190,R0=104,A0=-195,SW=210; // -195° → +15°
  for(let k=0;k<100;k++){
    const a=A0+k/100*SW,inked=k<GOAL;
    const len=inked?13+rnd(k+1,3)*6:5+rnd(k+1,7)*2.5;
    const [x1,y1]=pol(cx,cy,R0,a),[x2,y2]=pol(cx,cy,R0+len,a);
    el(s,'line',{x1,y1,x2,y2,stroke:inked?INK:'#CFCEC7','stroke-width':inked?1:.6,
      class:'fade',style:`animation-delay:${k*.012}s`});
  }
  [25,50,75,100].forEach(m=>{
    const a=A0+m/100*SW,[dx,dy]=pol(cx,cy,R0-7,a),[tx2,ty2]=pol(cx,cy,R0-19,a);
    el(s,'circle',{cx:dx,cy:dy,r:1,fill:'#B0AFA9',class:'fade',style:'animation-delay:.8s'});
    txt(s,{x:tx2,y:ty2+3,'font-size':7,'font-weight':600,fill:'#C6C5BF','text-anchor':'middle',
      class:'fade',style:'animation-delay:.85s'},m);
  });
  // inked tip bead
  const aT=A0+GOAL/100*SW,[ex,ey]=pol(cx,cy,R0+20,aT);
  el(s,'circle',{cx:ex,cy:ey,r:2.4,fill:INK,class:'pop',style:'animation-delay:1.1s'});
  const num=txt(s,{x:cx,y:cy-4,'font-size':34,'font-weight':800,fill:INK,'text-anchor':'middle',
    class:'fade',style:'animation-delay:1s'},GOAL+'%');
  tip(num,`$730k of the $1M quarter target`);
  txt(s,{x:cx,y:cy+16,'font-size':8,'font-weight':600,fill:MUTED,'text-anchor':'middle',
    'letter-spacing':'.1em',class:'fade',style:'animation-delay:1.05s'},`还差 ${100-GOAL} 格`);
  txt(s,{x:200,y:300,'font-size':7,'font-weight':600,fill:'#B0AFA9','text-anchor':'middle',
    'letter-spacing':'.12em',class:'fade',style:'animation-delay:1.2s'},
    'ONE TICK = 1% OF TARGET · INKED = EARNED');
});
    },
    "dumbbell": () => {

const D=__data("D",[['INVITE FLOW',14,6],['FIRST BOARD',19,9],['IMPORT DATA',26,13],['TEAM SETUP',31,21],['GO LIVE',38,30]]);
obsReveal('dumbbell',s=>{
  const y0=i=>56+i*46,X0=118,X1=364,mapX=v=>X0+(v-4)/36*(X1-X0);
  D.forEach(([name,was,now],i)=>{
    const y=y0(i),xa=mapX(was),xb=mapX(now);
    txt(s,{x:108,y:y+3,'font-size':7.5,'font-weight':700,fill:'#6A6963','text-anchor':'end',
      'letter-spacing':'.06em',class:'fade',style:`animation-delay:${i*.08}s`},name);
    el(s,'line',{x1:X0-6,y1:y,x2:X1+6,y2:y,stroke:'#E3E2DB','stroke-width':.7,
      class:'fade',style:`animation-delay:${i*.08}s`});
    // beads: one per minute saved, strung between the two dots
    const n=was-now;
    for(let k=0;k<n;k++){
      const t=(k+.5)/n,x=xb+t*(xa-xb),yy=y+(rnd(k+1,i+3)-.5)*2.6;
      el(s,'circle',{cx:x,cy:yy,r:1.5+rnd(k+2,i+4)*.9,fill:'#8F8E88',opacity:.85,
        class:'pop',style:`animation-delay:${.3+i*.08+k*.03}s`});
    }
    el(s,'circle',{cx:xa,cy:y,r:4.2,fill:PAPER,stroke:INK,'stroke-width':1.3,
      class:'pop',style:`animation-delay:${.2+i*.08}s`});
    const after=el(s,'circle',{cx:xb,cy:y,r:4.6,fill:INK,
      class:'pop',style:`animation-delay:${.6+i*.08}s`});
    tip(after,`${name} — ${was} min → ${now} min`);
    txt(s,{x:xa+10,y:y-8,'font-size':8.5,'font-weight':700,fill:'#B0AFA9',
      class:'fade',style:`animation-delay:${.3+i*.08}s`},was);
    txt(s,{x:xb-10,y:y-8,'font-size':10,'font-weight':800,fill:INK,'text-anchor':'end',
      class:'fade',style:`animation-delay:${.7+i*.08}s`},now);
  });
  txt(s,{x:X0,y:290,'font-size':7,'font-weight':600,fill:'#C6C5BF',class:'fade'},'FASTER ←');
  txt(s,{x:X1,y:290,'font-size':7,'font-weight':600,fill:'#C6C5BF','text-anchor':'end',
    class:'fade'},'MINUTES');
  txt(s,{x:200,y:308,'font-size':7,'font-weight':600,fill:'#B0AFA9','text-anchor':'middle',
    'letter-spacing':'.12em',class:'fade',style:'animation-delay:1s'},
    'ONE BEAD = ONE MINUTE SAVED · HOLLOW = BEFORE · INK = AFTER');
});
    },
    "histo": () => {
const INK='#1C1C1A',PAPER='#F0EFEB',MUTED='#8F8E88',GRID='#DEDDD6';
const NS='http://www.w3.org/2000/svg';



const rnd=(i,k)=>Math.abs(((i*73856093)^(k*19349663))%1000)/1000;

// ════ F14 · rung histogram ════
// 直方图的 Lupi Basics 皮：连续数值分箱，一箱一把梯子，1 档 = 1 张工单
// （百分之一）。箱界写在梯脚之间——直方图的箱是区间不是类目，
// 这是它和 F1 Rung Bars 的本质区别。峰值箱标数，中位数落点小旗标注。
const BIN=__data("BIN",[6,14,22,19,13,9,6,4,3,2,1,1]);       // 2h bins, sums to 100
obsReveal('histo',s=>{
  const X0=44,PW=27.5,base=252,step=5.4,HW=10.5;
  BIN.forEach((v,i)=>{
    const x=X0+i*PW+PW/2;
    for(let k=0;k<v;k++){
      const y=base-k*step,w=HW-1.4+rnd(k+1,i+2)*2.8;
      el(s,'line',{x1:x-w,y1:y,x2:x+w,y2:y,stroke:INK,'stroke-width':1,
        opacity:.55+rnd(k+2,i+4)*.45,class:'fade',style:`animation-delay:${i*.06+k*.012}s`});
      if(k%5===4)el(s,'circle',{cx:x+HW+3.5,cy:y,r:.7,fill:'#C6C5BF',
        class:'fade',style:`animation-delay:${i*.06+k*.012}s`});
    }
  });
  // peak label
  const pk=BIN.indexOf(Math.max(...BIN));
  const px=X0+pk*PW+PW/2;
  const num=txt(s,{x:px,y:base-(BIN[pk]-1)*step-10,'font-size':11,'font-weight':800,fill:INK,
    'text-anchor':'middle',class:'fade',style:'animation-delay:.8s'},BIN[pk]);
  tip(num,`${BIN[pk]} of 100 tickets took ${pk*2}–${pk*2+2}h`);
  // bin edges: the continuous axis is the histogram's identity
  el(s,'line',{x1:X0-4,y1:base+4,x2:X0+12*PW+4,y2:base+4,stroke:GRID,'stroke-width':.8,class:'fade'});
  for(let e=0;e<=12;e++){
    const x=X0+e*PW;
    el(s,'line',{x1:x,y1:base+4,x2:x,y2:base+(e%2===0?11:8),stroke:'#CFCEC7','stroke-width':.6,
      class:'fade',style:`animation-delay:${e*.02}s`});
    if(e%2===0)txt(s,{x,y:base+21,'font-size':7,'font-weight':600,fill:MUTED,'text-anchor':'middle',
      class:'fade',style:`animation-delay:${e*.02}s`},e*2+'h');
  }
  // median flag: cumulative crosses 50 inside bin 2
  let acc=0,mb=0;for(let i=0;i<12;i++){acc+=BIN[i];if(acc>=50){mb=i;break}}
  const mx=X0+mb*PW+PW*.7;
  el(s,'line',{x1:mx,y1:base+4,x2:mx,y2:base-BIN[mb]*step-16,stroke:'#8F8E88','stroke-width':.9,
    'stroke-dasharray':'2 4',class:'fade',style:'animation-delay:1s'});
  txt(s,{x:mx+4,y:base-BIN[mb]*step-20,'font-size':7.5,'font-weight':800,fill:'#6A6963',
    class:'fade',style:'animation-delay:1.1s'},'HALF RESOLVED BY HERE');
  txt(s,{x:200,y:306,'font-size':7,'font-weight':600,fill:'#B0AFA9','text-anchor':'middle',
    'letter-spacing':'.12em',class:'fade',style:'animation-delay:1.2s'},
    'ONE RUNG = ONE TICKET IN A HUNDRED · BINS OF TWO HOURS · DOT MARKS EVERY FIFTH');
});
    },
    "boxplot": () => {
const INK='#1C1C1A',PAPER='#F0EFEB',MUTED='#8F8E88',GRID='#DEDDD6';
const NS='http://www.w3.org/2000/svg';



const rnd=(i,k)=>Math.abs(((i*73856093)^(k*19349663))%1000)/1000;

// ════ F14 · rung histogram ════
// 直方图的 Lupi Basics 皮：连续数值分箱，一箱一把梯子，1 档 = 1 张工单
// （百分之一）。箱界写在梯脚之间——直方图的箱是区间不是类目，
// 这是它和 F1 Rung Bars 的本质区别。峰值箱标数，中位数落点小旗标注。
const G=__data("G",[['ENT',[.4,.9,1.5,2.6,4.4],[6.2]],
         ['PRO',[.8,2.1,3.3,5,7.8],[10.5]],
         ['STARTER',[1.5,3.8,6.1,8.9,13.2],[16.8]],
         ['FREE',[2.2,6,9.4,13.8,19.6],[22.1,23.5]]]);
const SHADE=__data("SHADE",[INK,'#4A4944','#8F8E88','#B0AFA9']);
obsReveal('boxplot',s=>{
  const TOP=42,BASE=260,MAXH=24,mapY=v=>BASE-v/MAXH*(BASE-TOP);
  const colX=g=>78+g*84,BW=24;
  [0,6,12,18,24].forEach(h=>{
    el(s,'line',{x1:36,y1:mapY(h),x2:378,y2:mapY(h),stroke:'#E3E2DB','stroke-width':.8,
      class:'fade',style:`animation-delay:${h*.008}s`});
    txt(s,{x:30,y:mapY(h)+3,'font-size':7.5,'font-weight':600,fill:MUTED,'text-anchor':'end',
      class:'fade',style:`animation-delay:${h*.008}s`},h+'h');
  });
  G.forEach(([name,[mn,q1,md,q3,mx],outs],g)=>{
    const x=colX(g);
    el(s,'line',{x1:x,y1:mapY(mn),x2:x,y2:mapY(mx),stroke:'#8F8E88','stroke-width':.8,
      pathLength:1,class:'draw',style:`animation-delay:${g*.12}s;animation-duration:.6s`});
    [mn,mx].forEach(vv=>el(s,'line',{x1:x-7,y1:mapY(vv),x2:x+7,y2:mapY(vv),
      stroke:'#8F8E88','stroke-width':1,class:'fade',style:`animation-delay:${.2+g*.12}s`}));
    const box=el(s,'rect',{x:x-BW/2,y:mapY(q3),width:BW,height:mapY(q1)-mapY(q3),rx:9,
      fill:SHADE[g],class:'pop',style:`animation-delay:${.15+g*.12}s`});
    tip(box,`${name} — half of tickets answered in ${q1}–${q3}h`);
    el(s,'line',{x1:x-BW/2+3,y1:mapY(md),x2:x+BW/2-3,y2:mapY(md),stroke:PAPER,'stroke-width':2.2,
      class:'fade',style:`animation-delay:${.5+g*.12}s`});
    txt(s,{x:x+BW/2+6,y:mapY(md)+3,'font-size':9.5,'font-weight':800,fill:INK,
      class:'fade',style:`animation-delay:${.6+g*.12}s`},md.toFixed(1)+'h');
    outs.forEach((o,k)=>{
      const d=el(s,'circle',{cx:x+(rnd(k+1,g+3)-.5)*8,cy:mapY(o),r:2.6,fill:PAPER,
        stroke:'#6A6963','stroke-width':1.1,class:'pop',style:`animation-delay:${.7+g*.12+k*.06}s`});
      tip(d,`${name} outlier — ${o}h`);
    });
    txt(s,{x,y:BASE+18,'font-size':7.5,'font-weight':700,fill:MUTED,'text-anchor':'middle',
      'letter-spacing':'.08em',class:'fade',style:`animation-delay:${g*.12}s`},name);
  });
  txt(s,{x:200,y:306,'font-size':7,'font-weight':600,fill:'#B0AFA9','text-anchor':'middle',
    'letter-spacing':'.12em',class:'fade',style:'animation-delay:1.2s'},
    'BOX = MIDDLE HALF · PAPER TICK = MEDIAN · HOLLOW = OUTLIER · DARKEST = FASTEST');
});
    },
    "stream": () => {
const INK='#1C1C1A',PAPER='#F0EFEB',MUTED='#8F8E88',GRID='#DEDDD6';
const NS='http://www.w3.org/2000/svg';



const rnd=(i,k)=>Math.abs(((i*73856093)^(k*19349663))%1000)/1000;

// ════ F14 · rung histogram ════
// 直方图的 Lupi Basics 皮：连续数值分箱，一箱一把梯子，1 档 = 1 张工单
// （百分之一）。箱界写在梯脚之间——直方图的箱是区间不是类目，
// 这是它和 F1 Rung Bars 的本质区别。峰值箱标数，中位数落点小旗标注。
let N=48;
const mk=(base,trend,w1,w2,seed)=>Array.from({length:N},(_,t)=>
  Math.max(2,base+trend*t+10*Math.sin(t/w1+seed)+5*Math.sin(t/w2+seed*2)+rnd(t+1,seed)*6));
const SERIES=__data("SERIES",[
  ['LEGACY EDITOR',mk(46,-.62,9,3.7,2),'#C6C5BF'],
  ['BOARDS',mk(26,.10,11,4.2,5),'#8F8E88'],
  ['FLOWS',mk(12,.78,10,3.1,8),INK],
]);
obsReveal('stream',s=>{
  const X0=36,X1=744,CY=138,SC=1.15;
  const x=t=>X0+t/(N-1)*(X1-X0);
  N=SERIES[0][1].length;
  const tot=Array.from({length:N},(_,t)=>SERIES.reduce((a,S)=>a+S[1][t],0));
  // stacked offsets, silhouette baseline: top of stack starts at -total/2
  const y0=Array.from({length:N},(_,t)=>CY-tot[t]*SC/2);
  const smooth=pts=>{
    let d=`M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for(let k=1;k<pts.length-1;k++){
      const p=pts[k],q=pts[k+1];
      d+=` Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${((p[0]+q[0])/2).toFixed(1)} ${((p[1]+q[1])/2).toFixed(1)}`;
    }
    return d+` L${pts[pts.length-1][0].toFixed(1)} ${pts[pts.length-1][1].toFixed(1)}`;
  };
  let run=y0.slice();
  SERIES.forEach(([name,vals,shade],si)=>{
    const top=run.map((v,t)=>[x(t),v]);
    const bot=run.map((v,t)=>[x(t),v+vals[t]*SC]);
    run=bot.map(p=>p[1]);
    const d=smooth(top)+' L '+[...bot].reverse().map(p=>`${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L ')+' Z';
    const band=el(s,'path',{d,fill:shade,stroke:PAPER,'stroke-width':2,
      class:'fade',style:`animation-delay:${si*.16}s`});
    tip(band,`${name} — weekly active accounts, 48 weeks`);
    // label at the band's widest week — clamped off both ends so the
    // paper-colored text never spills past the band onto paper (invisible)
    let wk=4;vals.forEach((v,t)=>{if(t>=4&&t<=N-6&&v>vals[wk])wk=t});
    const midY=(top[wk][1]+bot[wk][1])/2;
    const dark=shade===INK||shade==='#4A4944';
    txt(s,{x:x(wk),y:midY+3,'font-size':9,'font-weight':800,'text-anchor':'middle',
      fill:dark?PAPER:'#4A4944','letter-spacing':'.06em',
      class:'fade',style:`animation-delay:${.5+si*.14}s`},name);
  });
  // month floor: barcode ticks + labels every 8 weeks
  const base=252;
  el(s,'line',{x1:X0-6,y1:base,x2:X1+6,y2:base,stroke:GRID,'stroke-width':.8,class:'fade'});
  for(let t=0;t<N;t++)
    el(s,'line',{x1:x(t),y1:base,x2:x(t),y2:base-(t%8===0?7:4),stroke:'#CFCEC7','stroke-width':.6,
      class:'fade',style:`animation-delay:${t*.006}s`});
  ['JAN','MAR','MAY','JUL','SEP','NOV'].forEach((m,k)=>
    txt(s,{x:x(k*8),y:base+15,'font-size':7.5,'font-weight':600,fill:MUTED,'text-anchor':'middle',
      'letter-spacing':'.1em',class:'fade'},m));
  txt(s,{x:390,y:288,'font-size':7,'font-weight':600,fill:'#B0AFA9','text-anchor':'middle',
    'letter-spacing':'.12em',class:'fade',style:'animation-delay:1.1s'},
    'BAND WIDTH = WEEKLY ACTIVES · DARKEST = TODAY’S LEADER · THE RIVER IS THE TOTAL');
});
    },
    "candle": () => {
const INK='#1C1C1A',PAPER='#F0EFEB',MUTED='#8F8E88',GRID='#DEDDD6';
const NS='http://www.w3.org/2000/svg';



const rnd=(i,k)=>Math.abs(((i*73856093)^(k*19349663))%1000)/1000;

// ════ F14 · rung histogram ════
// 直方图的 Lupi Basics 皮：连续数值分箱，一箱一把梯子，1 档 = 1 张工单
// （百分之一）。箱界写在梯脚之间——直方图的箱是区间不是类目，
// 这是它和 F1 Rung Bars 的本质区别。峰值箱标数，中位数落点小旗标注。
let N=30;
// deterministic random walk with a dip-and-recover arc
const DAYS0=[];
let px=52;
for(let d=0;d<N;d++){
  const drift=d<10?.4:d<18?-1.5:1.3;
  const open=px;
  const close=Math.max(30,open+drift+(rnd(d+1,3)-.5)*4.6);
  const hi=Math.max(open,close)+rnd(d+2,7)*2.6;
  const lo=Math.min(open,close)-rnd(d+3,11)*2.6;
  DAYS0.push([open,close,hi,lo]);
  px=close;
}
obsReveal('candle',s=>{
  const X0=40,PW=11.2,BASE=258,TOP=44;
  const DAYS=__data("DAYS",DAYS0);N=DAYS.length;
  const vmin=Math.min(...DAYS.map(d=>d[3])),vmax=Math.max(...DAYS.map(d=>d[2]));
  const mapY=v=>BASE-(v-vmin)/(vmax-vmin)*(BASE-TOP);
  const x=d=>X0+d*PW+PW/2;
  // price grid
  for(let g=0;g<=4;g++){
    const v=vmin+g/4*(vmax-vmin);
    el(s,'line',{x1:X0-4,y1:mapY(v),x2:X0+N*PW+4,y2:mapY(v),stroke:'#E3E2DB','stroke-width':.8,
      class:'fade',style:`animation-delay:${g*.03}s`});
    txt(s,{x:X0-8,y:mapY(v)+3,'font-size':7.5,'font-weight':600,fill:MUTED,'text-anchor':'end',
      class:'fade',style:`animation-delay:${g*.03}s`},'$'+Math.round(v));
  }
  let hiD=0,loD=0;
  DAYS.forEach(([o,c,h,l],d)=>{
    if(h>DAYS[hiD][2])hiD=d;
    if(l<DAYS[loD][3])loD=d;
  });
  DAYS.forEach(([o,c,h,l],d)=>{
    const cx=x(d),up=c>=o;
    const yT=mapY(Math.max(o,c)),yB=mapY(Math.min(o,c));
    // wick: one hairline, full reach
    el(s,'line',{x1:cx,y1:mapY(h),x2:cx,y2:mapY(l),stroke:'#6A6963','stroke-width':.7,
      class:'fade',style:`animation-delay:${d*.03}s`});
    // body: capsule; hollow = up, ink = down
    const body=el(s,'rect',{x:cx-3.4,y:yT,width:6.8,height:Math.max(2.5,yB-yT),rx:3,
      ...(up?{fill:PAPER,stroke:INK,'stroke-width':1.1}:{fill:INK}),
      class:'fade',style:`animation-delay:${.05+d*.03}s`});
    tip(body,`Day ${d+1} — open $${o.toFixed(1)} · close $${c.toFixed(1)} · high $${h.toFixed(1)} · low $${l.toFixed(1)}`);
    // extremes, labeled with hairline flags
    if(d===hiD)txt(s,{x:cx,y:mapY(h)-7,'font-size':8,'font-weight':800,fill:INK,'text-anchor':'middle',
      style:`paint-order:stroke;stroke:${PAPER};stroke-width:3px;animation-delay:1s`,
      class:'fade'},'$'+Math.round(h));
    if(d===loD)txt(s,{x:cx,y:mapY(l)+14,'font-size':8,'font-weight':800,fill:'#6A6963','text-anchor':'middle',
      style:`paint-order:stroke;stroke:${PAPER};stroke-width:3px;animation-delay:1s`,
      class:'fade'},'$'+Math.round(l));
  });
  // week ticks on the floor
  el(s,'line',{x1:X0-4,y1:BASE+8,x2:X0+N*PW+4,y2:BASE+8,stroke:GRID,'stroke-width':.8,class:'fade'});
  for(let d=0;d<N;d++)
    el(s,'line',{x1:x(d),y1:BASE+8,x2:x(d),y2:BASE+8-(d%5===0?6:3),stroke:'#CFCEC7','stroke-width':.6,
      class:'fade',style:`animation-delay:${d*.008}s`});
  ['W1','W2','W3','W4','W5','W6'].forEach((w,k)=>
    txt(s,{x:x(k*5),y:BASE+21,'font-size':7,'font-weight':600,fill:MUTED,'text-anchor':'middle',
      'letter-spacing':'.08em',class:'fade'},w));
  txt(s,{x:200,y:306,'font-size':7,'font-weight':600,fill:'#B0AFA9','text-anchor':'middle',
    'letter-spacing':'.12em',class:'fade',style:'animation-delay:1.1s'},
    'INK BODY = CLOSED DOWN · HOLLOW = CLOSED UP · WICK = THE DAY’S FULL REACH');
});
    },
    };
  };
  CHARTS["basics-gallery"] = make_basics_gallery;
  const make_glance_gallery = (el, txt, tip, obsReveal, __data, __fn, __cell) => {
  const none = new Proxy(function () {}, {get: (t, k) => (k === Symbol.toPrimitive ? () => '' : none), apply: () => none, construct: () => none, set: () => true});
  const Chart = none, echarts = none;

// ── shared Mono tokens ──
const INK='#1C1C1A',PAPER='#F0EFEB',MUTED='#8F8E88',GRID='#DEDDD6';
const L=['#1C1C1A','#4A4944','#6A6963','#8F8E88','#B0AFA9','#C6C5BF'];
const LAD=['#1C1C1A','#4A4944','#8F8E88','#B0AFA9','#D8D7D1'];
const tipLight={backgroundColor:INK,borderWidth:0,textStyle:{color:PAPER,fontFamily:'Inter',fontSize:12},padding:[10,14]};
const tipDark={backgroundColor:PAPER,borderWidth:0,textStyle:{color:INK,fontFamily:'Inter',fontSize:12},padding:[10,14]};
const rnd=(i,k)=>((i*73856093)^(k*19349663))%1000/1000; // deterministic

// ── unified reveal: every chart waits to be scrolled into view; click replays.
//    fn charts manage their own timers via keep(); they're cleared on replay.
const timers={};

const keep=(id,t)=>{(timers[id]=timers[id]||[]).push(t)};
const eReveal=(id,opt)=>obsReveal(id,el=>{
  const g=echarts.getInstanceByDom(el)||echarts.init(el);
  g.clear();g.setOption(opt);
});
const cjs={};
const cReveal=(id,mkCfg)=>obsReveal(id,el=>{
  cjs[id]?.destroy();
  cjs[id]=new Chart(el,mkCfg());
});

Chart.defaults.color=MUTED;
Chart.defaults.font.family='Inter';
Chart.defaults.font.size=10.5;
Chart.defaults.borderColor=GRID;
Chart.defaults.plugins.legend.display=false;
Chart.defaults.plugins.tooltip.backgroundColor=INK;
Chart.defaults.plugins.tooltip.titleColor='#F0EFEB';
Chart.defaults.plugins.tooltip.bodyColor='#A5A49E';
Chart.defaults.plugins.tooltip.padding=12;
Chart.defaults.plugins.tooltip.cornerRadius=12;
Chart.defaults.plugins.tooltip.displayColors=false;

// ════ mono-demo · 3: chunky bars, values on top ════

    return {
    "violin": () => {
const INK='#1C1C1A',PAPER='#F0EFEB',MUTED='#8F8E88',GRID='#DEDDD6';
const NS='http://www.w3.org/2000/svg';



const rnd=(i,k)=>Math.abs(((i*73856093)^(k*19349663))%1000)/1000;

// ════ G19 · violin ════
// 小提琴：提前聚合的密度剪影，Glance 世界观。
// 四个 plan 各一把琴，宽度 = 该时长的工单密度（KDE），
// 明度按中位数快慢排：越快越黑。纸色横档 = 中位数。
const G=__data("G",[['ENT',1.6,.8],['PRO',3.4,1.6],['STARTER',6.2,2.6],['FREE',9.5,4.2]]);
const M=64;
const samples=g=>Array.from({length:M},(_,i)=>{
  const [,c,s]=G[g];
  const v=c+s*((rnd(i+1,g*3+1)+rnd(i+7,g*3+2)+rnd(i+13,g*3+3))-1.5);
  return Math.max(.2,v);
});
obsReveal('violin',s=>{
  const TOP=40,BASE=262,HMAX=17;
  const mapY=h=>BASE-h/HMAX*(BASE-TOP);
  const colX=g=>76+g*84;
  // hour grid
  [0,4,8,12,16].forEach(h=>{
    el(s,'line',{x1:34,y1:mapY(h),x2:378,y2:mapY(h),stroke:'#E3E2DB','stroke-width':.8,
      class:'fade',style:`animation-delay:${h*.01}s`});
    txt(s,{x:28,y:mapY(h)+3,'font-size':7.5,'font-weight':600,fill:MUTED,'text-anchor':'end',
      class:'fade',style:`animation-delay:${h*.01}s`},h+'h');
  });
  const SHADE=__data("SHADE",[INK,'#4A4944','#8F8E88','#B0AFA9']);
  G.forEach(([name],g)=>{
    const vs=samples(g).sort((a,b)=>a-b);
    const med=vs[Math.floor(M/2)];
    // fuller bandwidth = the classic rounded violin belly, not a spindle
    const bw=Math.max(.9,G[g][2]*.72);
    // pad past the data by 1.6 bandwidths so the density decays to ~0 and the
    // ends taper naturally — clipping tighter gives flat-cut lantern ends
    const lo=Math.max(0,vs[0]-bw*1.6),hi=Math.min(HMAX,vs[M-1]+bw*1.6);
    const NPTS=44;
    const grid=Array.from({length:NPTS},(_,k)=>lo+k/(NPTS-1)*(hi-lo));
    const dens=grid.map(h=>vs.reduce((a,v)=>a+Math.exp(-((h-v)**2)/(2*bw*bw)),0));
    const dmax=Math.max(...dens);
    const W=30;
    const x=colX(g);
    // smooth closed outline through the mirrored density — quadratic
    // midpoint smoothing, same trick as almanac's blob
    const pts=[];
    grid.forEach((h,k)=>pts.push([x+dens[k]/dmax*W,mapY(h)]));
    for(let k=NPTS-1;k>=0;k--)pts.push([x-dens[k]/dmax*W,mapY(grid[k])]);
    let d=`M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for(let t=0;t<pts.length;t++){
      const p=pts[t],q=pts[(t+1)%pts.length];
      d+=` Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${((p[0]+q[0])/2).toFixed(1)} ${((p[1]+q[1])/2).toFixed(1)}`;
    }
    const body=el(s,'path',{d:d+' Z',fill:SHADE[g],class:'fade',style:`animation-delay:${g*.14}s`});
    tip(body,`${name} — median ${med.toFixed(1)}h to first reply`);
    // median: paper tick across the body, value parked right
    const mk=Math.round((med-lo)/(hi-lo)*(NPTS-1));
    const wAtMed=dens[Math.max(0,Math.min(NPTS-1,mk))]/dmax*W;
    el(s,'line',{x1:x-wAtMed,y1:mapY(med),x2:x+wAtMed,y2:mapY(med),
      stroke:PAPER,'stroke-width':2.2,class:'fade',style:`animation-delay:${.5+g*.14}s`});
    txt(s,{x:x+W+5,y:mapY(med)+3,'font-size':9.5,'font-weight':800,fill:INK,
      class:'fade',style:`animation-delay:${.6+g*.14}s`},med.toFixed(1)+'h');
    txt(s,{x,y:BASE+18,'font-size':7.5,'font-weight':700,fill:MUTED,'text-anchor':'middle',
      'letter-spacing':'.08em',class:'fade',style:`animation-delay:${g*.14}s`},name);
  });
  txt(s,{x:200,y:306,'font-size':7,'font-weight':600,fill:'#B0AFA9','text-anchor':'middle',
    'letter-spacing':'.12em',class:'fade',style:'animation-delay:1.1s'},
    'WIDTH = HOW MANY TICKETS WAIT THAT LONG · PAPER TICK = MEDIAN · DARKEST = FASTEST');
});
    },
    "gheat": () => {
const INK='#1C1C1A',PAPER='#F0EFEB',MUTED='#8F8E88',GRID='#DEDDD6';
const NS='http://www.w3.org/2000/svg';



const rnd=(i,k)=>Math.abs(((i*73856093)^(k*19349663))%1000)/1000;

// ════ G19 · violin ════
// 小提琴：提前聚合的密度剪影，Glance 世界观。
// 四个 plan 各一把琴，宽度 = 该时长的工单密度（KDE），
// 明度按中位数快慢排：越快越黑。纸色横档 = 中位数。
const FEAT=__data("FEAT",['EDITOR','BOARDS','DOCS','CHAT','FLOWS','VAULT']);
const VER=__data("VER",['v2.0','v1.9','v1.8','v1.7','v1.6']);
const BASEV=__data("BASEV",[88,74,61,42,35,27]);
const v0=(r,c)=>Math.max(2,Math.round(BASEV[c]-r*(6+c*.8)+(rnd(r*6+c+1,c+3)-.5)*10));
const shade=t=>t>64?INK:t>46?'#4A4944':t>30?'#8F8E88':t>15?'#B0AFA9':'#D8D7D1';
const v=(r,c)=>__cell("cells",r,c,v0(r,c));
obsReveal('gheat',s=>{
  const X0=92,Y0=58,PX=48,PY=42,W=42,H=36;
  FEAT.forEach((f,c)=>{
    txt(s,{x:X0+c*PX+W/2,y:Y0-12,'font-size':6.5,'font-weight':700,fill:MUTED,'text-anchor':'middle',
      'letter-spacing':'.04em',class:'fade',style:`animation-delay:${c*.04}s`},f);
  });
  VER.forEach((ver,r)=>{
    txt(s,{x:X0-10,y:Y0+r*PY+H/2+3,'font-size':8.5,'font-weight':700,fill:'#6A6963','text-anchor':'end',
      class:'fade',style:`animation-delay:${r*.05}s`},ver);
    FEAT.forEach((f,c)=>{
      const t=v(r,c),x=X0+c*PX,y=Y0+r*PY,dark=t>46;
      const cell=el(s,'rect',{x,y,width:W,height:H,rx:9,fill:shade(t),
        class:'pop',style:`animation-delay:${(r*6+c)*.022}s`});
      tip(cell,`${f} on ${ver} — ${t}% of accounts`);
      txt(s,{x:x+W/2,y:y+H/2+4,'font-size':10.5,'font-weight':800,fill:dark?PAPER:INK,'text-anchor':'middle',
        class:'fade',style:`animation-delay:${.15+(r*6+c)*.022}s`},t);
    });
  });
  txt(s,{x:200,y:300,'font-size':7,'font-weight':600,fill:'#B0AFA9','text-anchor':'middle',
    'letter-spacing':'.12em',class:'fade',style:'animation-delay:1s'},
    'SHADE = ADOPTION · NEWER VERSIONS RUN DARKER');
});
    },
    "rankstrip": () => {
const INK='#1C1C1A',PAPER='#F0EFEB',MUTED='#8F8E88',GRID='#DEDDD6';
const NS='http://www.w3.org/2000/svg';



const rnd=(i,k)=>Math.abs(((i*73856093)^(k*19349663))%1000)/1000;

// ════ G19 · violin ════
// 小提琴：提前聚合的密度剪影，Glance 世界观。
// 四个 plan 各一把琴，宽度 = 该时长的工单密度（KDE），
// 明度按中位数快慢排：越快越黑。纸色横档 = 中位数。
const RANKS=__data("RANKS",[['Flows',[5,3,2,1,1,1]],['Editor',[1,1,1,2,2,2]],['Boards',[2,2,3,3,3,4]],
  ['Vault',[4,5,5,4,4,3]],['Docs',[3,4,4,5,5,5]]]);
const SHADE=__data("SHADE",[INK,'#4A4944','#8F8E88','#B0AFA9','#D8D7D1']);   // rank 1 → 5
obsReveal('rankstrip',s=>{
  // rows sorted by final rank, the climber lands on top
  const rows=[...RANKS].sort((a,b)=>a[1][5]-b[1][5]);
  const X0=110,PX=38,Y0=64,PY=42,C=32;
  ['Q1','Q2','Q3','Q4','Q5','Q6'].forEach((q,k)=>
    txt(s,{x:X0+k*PX+C/2,y:Y0-12,'font-size':7.5,'font-weight':600,fill:MUTED,'text-anchor':'middle',
      'letter-spacing':'.08em',class:'fade',style:`animation-delay:${k*.04}s`},q));
  rows.forEach(([p,rk],i)=>{
    const y=Y0+i*PY,hero=i===0;
    txt(s,{x:X0-12,y:y+C/2+3,'font-size':8.5,'font-weight':hero?800:600,fill:hero?INK:'#6A6963','text-anchor':'end',
      class:'fade',style:`animation-delay:${i*.07}s`},p);
    rk.forEach((r,q)=>{
      const dark=r<=2;
      const cell=el(s,'rect',{x:X0+q*PX,y,width:C,height:C,rx:8,fill:SHADE[r-1],
        stroke:'#CFCEC7','stroke-width':.5,
        class:'pop',style:`animation-delay:${i*.07+q*.035}s`});
      tip(cell,`${p} — #${r} in Q${q+1}`);
      txt(s,{x:X0+q*PX+C/2,y:y+C/2+3.5,'font-size':9.5,'font-weight':800,
        fill:dark?PAPER:'#55544E','text-anchor':'middle',
        class:'fade',style:`animation-delay:${.1+i*.07+q*.035}s`},r);
    });
    // arrival flag: climbed / fell / held, told at the row's end
    const d=rk[0]-rk[5];
    txt(s,{x:X0+6*PX+8,y:y+C/2+3,'font-size':8,'font-weight':800,
      fill:d>0?INK:d<0?'#B0AFA9':'#C6C5BF',
      class:'fade',style:`animation-delay:${.5+i*.07}s`},
      d>0?'▲'+d:d<0?'▼'+(-d):'—');
  });
  txt(s,{x:200,y:308,'font-size':7,'font-weight':600,fill:'#B0AFA9','text-anchor':'middle',
    'letter-spacing':'.12em',class:'fade',style:'animation-delay:1.1s'},
    'CELL = RANK THAT QUARTER · #1 WEARS BLACK · READ EACH ROW LIKE A FILMSTRIP');
});
    },
    "sankey": () => {
const INK='#1C1C1A',PAPER='#F0EFEB',MUTED='#8F8E88',GRID='#DEDDD6';
const NS='http://www.w3.org/2000/svg';



const rnd=(i,k)=>Math.abs(((i*73856093)^(k*19349663))%1000)/1000;

// ════ G19 · violin ════
// 小提琴：提前聚合的密度剪影，Glance 世界观。
// 四个 plan 各一把琴，宽度 = 该时长的工单密度（KDE），
// 明度按中位数快慢排：越快越黑。纸色横档 = 中位数。
const SRC=__data("SRC",[['SEARCH',[20,10,4]],['REFERRAL',[12,9,6]],['SOCIAL',[12,4,2]],['PAID',[6,3,3]],['OTHER',[5,2,2]]]);
const DST=__data("DST",['FREE','PRO','TEAM']);
const SH=__data("SH",[INK,'#4A4944','#8F8E88','#B0AFA9','#C6C5BF']);
obsReveal('sankey',s=>{
  const XL=104,XR=298,Y0=34,SC=1.9,GAPL=8,GAPR=22,MID=(XL+XR)/2;
  const srcTot=SRC.map(d=>d[1].reduce((a,b)=>a+b,0));
  const dstTot=DST.map((_,j)=>SRC.reduce((a,d)=>a+d[1][j],0));
  const sy=[],dy=[];
  let y=Y0;srcTot.forEach((t,i)=>{sy[i]=y;y+=t*SC+GAPL});
  y=Y0+2;dstTot.forEach((t,j)=>{dy[j]=y;y+=t*SC+GAPR});
  const syc=[...sy],dyc=[...dy];
  SRC.forEach((d,i)=>{
    d[1].forEach((v,j)=>{
      if(!v)return;
      const sa=syc[i],sb=sa+v*SC,da=dyc[j],db=da+v*SC;
      syc[i]=sb;dyc[j]=db;
      const rib=el(s,'path',{d:`M${XL} ${sa} C${MID} ${sa} ${MID} ${da} ${XR} ${da} L${XR} ${db} C${MID} ${db} ${MID} ${sb} ${XL} ${sb} Z`,
        fill:SH[i],opacity:.5,class:'fade',style:`animation-delay:${.2+(i*3+j)*.06}s`});
      tip(rib,`${SRC[i][0]} → ${DST[j]} — ${v} accounts of 100`);
    });
  });
  SRC.forEach((d,i)=>{
    el(s,'rect',{x:XL-9,y:sy[i],width:9,height:srcTot[i]*SC,rx:4,fill:SH[i],
      class:'fade',style:`animation-delay:${i*.06}s`});
    txt(s,{x:XL-16,y:sy[i]+srcTot[i]*SC/2+2.5,'font-size':7.5,'font-weight':700,fill:'#4A4944','text-anchor':'end',
      'letter-spacing':'.05em',class:'fade',style:`animation-delay:${i*.06}s`},`${d[0]} · ${srcTot[i]}`);
  });
  DST.forEach((n,j)=>{
    el(s,'rect',{x:XR,y:dy[j],width:9,height:dstTot[j]*SC,rx:4,fill:'#3A3934',
      class:'fade',style:`animation-delay:${.1+j*.06}s`});
    txt(s,{x:XR+16,y:dy[j]+dstTot[j]*SC/2-3,'font-size':7.5,'font-weight':700,fill:'#4A4944',
      'letter-spacing':'.05em',class:'fade',style:`animation-delay:${.15+j*.06}s`},n);
    txt(s,{x:XR+16,y:dy[j]+dstTot[j]*SC/2+9,'font-size':10,'font-weight':800,fill:INK,
      class:'fade',style:`animation-delay:${.2+j*.06}s`},dstTot[j]);
  });
  txt(s,{x:200,y:302,'font-size':7,'font-weight':600,fill:'#B0AFA9','text-anchor':'middle',
    'letter-spacing':'.12em',class:'fade',style:'animation-delay:1.1s'},
    'RIBBON WIDTH = ACCOUNTS OF 100 · SHADE = CHANNEL');
});
    },
    };
  };
  CHARTS["glance-gallery"] = make_glance_gallery;
  root.DMLieflatSource = {CHARTS, META, ZH};
})(window);
