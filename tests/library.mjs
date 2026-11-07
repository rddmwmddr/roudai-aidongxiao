// 动效库总测试：每个动效都要有分类、能画、同一时刻画两次一样（导出才稳）、停下来那一帧不是空的；自动匹配要对。
//   node tests/library.mjs [dist/肉呆爱动效.html] [--sheet 输出目录]
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../scripts/'));
const {chromium} = require('playwright-core');
const args = process.argv.slice(2).filter((a) => a !== '--no-filter');
const sheetAt = args.indexOf('--sheet');
const sheetDir = sheetAt >= 0 ? args.splice(sheetAt, 2)[1] : null;
const tool = path.resolve(args[0] || path.join(here, '../dist/肉呆爱动效.html'));
const browser = await chromium.launch({channel: 'chrome', headless: true});
const page = await (await browser.newContext({viewport: {width: 1400, height: 860}})).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
// --no-filter：按 WebKit 的情况跑（没有 ctx.filter）
if (process.argv.includes('--no-filter')) await page.addInitScript(() => { window.DM_FORCE_NO_FILTER = true; });
await page.goto('file://' + encodeURI(tool));
await page.waitForFunction(() => window.DMApp && window.DMApp.ready, null, {timeout: 120000});

const result = await page.evaluate(async () => {
  const D = window.DM;
  const W = 320;
  const H = 180;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d', {alpha: false, willReadFrequently: true});
  const grab = () => g.getImageData(0, 0, W, H).data;
  const variety = (d) => {
    const seen = new Set();
    for (let i = 0; i < d.length; i += 4 * 37) seen.add((d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | d[i + 2] >> 3);
    return seen.size;
  };
  const differ = (a, b) => {
    let n = 0;
    for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 18) n++;
    return n;
  };
  const out = {total: 0, noCategory: [], failed: [], impure: [], blank: [], noKeywords: [], textFailed: [], perCategory: {}};
  for (const tpl of Object.values(D.TEMPLATES)) {
    out.total++;
    if (!tpl.cat) out.noCategory.push(tpl.id);
    out.perCategory[tpl.cat] = (out.perCategory[tpl.cat] || 0) + 1;
    // 加载、按钮、开关靠手选，不参与按文案匹配
    if (tpl.library && !(tpl.keywords || []).length && !['loader', 'button', 'toggle'].includes(tpl.cat)) out.noKeywords.push(tpl.id);
    const sample = D.sampleOf(tpl.id);
    const raw = Object.assign({line: ''}, sample, {template: tpl.id, tpl: tpl.id});
    let scene;
    try {
      scene = D.createScene(raw, W);
      const end = D.thumbTime(tpl.id, scene);
      scene.draw(g, end);
      const a = grab();
      if (variety(a) < 2) out.blank.push(tpl.id);
      scene.draw(g, end * 0.4);
      scene.draw(g, end);
      const moved = differ(a, grab());
      // 一百根的辉光第一次画和之后差约 3%（旧版就有，见 mac/README 踩坑），其余必须一致
      if (moved > (tpl.id === 'comb' ? 2500 : 200)) out.impure.push(`${tpl.id}: ${moved}`);
    } catch (e) {
      out.failed.push(`${tpl.id}: ${e.message}`);
    }
    if (tpl.takesText) {
      try {
        const s = D.createScene(Object.assign({}, raw, {line: '我们询问了5000位朋友，其中有86%的朋友说：喝。', lines: ['其中有86%的朋友说：喝。', '你喝咖啡么？']}), W);
        [0.1, 0.5, 1, 2, s.duration - 0.05].forEach((t) => s.draw(g, t));
        if (variety(grab()) < 2) out.textFailed.push(`${tpl.id}: 没有画出文字`);
      } catch (e) {
        out.textFailed.push(`${tpl.id}: ${e.message}`);
      }
    }
  }
  // lieflat 系列：不能留英文；换了数据画面要跟着变
  out.lfEnglish = [];
  out.lfNoData = [];
  const allow = /^(AI|API|DNS|CDN|MAU)$/;
  const lfCanvas = document.createElement('canvas');
  lfCanvas.width = 480;
  lfCanvas.height = 270;
  const lfG = lfCanvas.getContext('2d', {alpha: false, willReadFrequently: true});
  const snap = (row) => {
    const s = D.createScene(row, 480);
    s.draw(lfG, s.duration - 0.2);
    return lfG.getImageData(0, 0, 480, 270).data;
  };
  const halve = (v) => (typeof v === 'number' ? Math.max(1, Math.round(v * 0.55) + 1) : Array.isArray(v) ? v.map(halve) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, halve(x)])) : v);
  for (const t of Object.values(D.TEMPLATES).filter((x) => x.lieflat)) {
    const raw = Object.assign({line: ''}, D.sampleOf(t.id), {template: t.id, tpl: t.id});
    const sur = await D.surveyElements(raw);
    sur.elements.filter((e) => e.kind === 'text').forEach((e) => {
      const words = String(e.label).match(/[A-Za-z]{2,}/g) || [];
      if (words.some((w) => !allow.test(w))) out.lfEnglish.push(`${t.id}: ${e.label}`);
    });
    try {
      const a = snap(raw);
      const b = snap(Object.assign({}, raw, {lf: halve(raw.lf)}));
      let n = 0;
      for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 8) n++;
      if (n < 20) out.lfNoData.push(`${t.id}: 只变了 ${n} 个点`);
    } catch (e) {
      out.lfNoData.push(`${t.id}: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 0));
  }

  // 自动匹配：说到什么配什么；说不到不瞎配
  const pick = (t) => (D.matchMotion(t) || {}).name || null;
  out.match = {
    '倒计时还剩3天': pick('倒计时还剩3天'), '这个系统彻底崩溃了': pick('这个系统彻底崩溃了'), '我们要划重点': pick('我们要划重点'),
    '心跳一下一下': pick('心跳一下一下'), '今天天气不错': pick('今天天气不错'),
  };
  // 界面组件：短句才配，长句里碰巧有这个词不算；要数字的组件没有数字不配；默认字不进成片
  out.widget = {
    short: pick('这是一个搜索框'),
    long: pick('陪伴了我们三十年历史的搜索工具，在最巅峰的时候也不过如此，这个搜索框'),
    noNumber: D.TEMPLATES.kxs_ring.accepts({line: '今天天气不错'}),
    percent: D.TEMPLATES.kxs_ring.accepts({line: '有51%的朋友表示'}),
    notPercent: D.TEMPLATES.kxs_ring.accepts({line: '有5000位朋友'}),
    adopted: D.adopt({line: '今天天气不错。', tpl: 'statement'}, 'kxs_ring').sampleData === true,
  };
  const painted = [];
  const spy = document.createElement('canvas').getContext('2d');
  const realFill = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (text, ...rest) {
    painted.push(String(text));
    return realFill.call(this, text, ...rest);
  };
  const tabs = D.createScene({line: '只有这一句', lines: ['只有这一句'], tpl: 'kxi_tabs', template: 'kxi_tabs'}, 320);
  const probe = document.createElement('canvas');
  probe.width = 320;
  probe.height = 180;
  tabs.draw(probe.getContext('2d'), 1);
  CanvasRenderingContext2D.prototype.fillText = realFill;
  out.widget.stockWords = painted.filter((t) => ['图片', '视频', '文件'].includes(t));
  // 手动时长：拉长是多停一会儿，缩短是整段加快，两头画出来的都是结尾那一帧
  const timedRow = {line: '这是一句测试用的口播。', lines: ['这是一句测试用的口播'], tpl: 'statement', template: 'statement'};
  const natural = D.createScene(timedRow, 320);
  const paint = (scene, t) => {
    const cv = document.createElement('canvas');
    cv.width = 320;
    cv.height = 180;
    const k = cv.getContext('2d', {alpha: false, willReadFrequently: true});
    scene.draw(k, t);
    return k.getImageData(0, 0, 320, 180).data;
  };
  const end = paint(natural, natural.duration - 0.01);
  const shorter = D.createScene(Object.assign({}, timedRow, {dur: natural.duration / 2}), 320);
  const longer = D.createScene(Object.assign({}, timedRow, {dur: natural.duration + 9}), 320);
  out.timed = {
    short: shorter.duration === natural.duration / 2,
    long: longer.duration === natural.duration + 9,
    shortEnd: differ(end, paint(shorter, shorter.duration - 0.005)) < 200,
    longEnd: differ(end, paint(longer, longer.duration - 0.01)) < 200,
    // 文件里写着已经删掉的动效：照样能画
    gone: !!D.createScene({line: '旧文件里的一句话。', tpl: 'aroll', template: 'aroll'}, 320),
  };
  // 长段重音字幕分页：整个过程把每个字都画出来，一个不丢
  const longText = Array.from({length: 40}, (_, i) => `这是第${i}句很长的口播内容`).join('，');
  const longScene = D.createScene({line: longText, lines: [longText], tpl: 'statement', template: 'statement'}, 320);
  const seen = [];
  const realFill2 = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (text, ...rest) {
    seen.push(String(text));
    return realFill2.call(this, text, ...rest);
  };
  const longCanvas = document.createElement('canvas');
  longCanvas.width = 320;
  longCanvas.height = 180;
  const longG = longCanvas.getContext('2d', {alpha: false});
  // 每一段时间采一帧，把这一段出现过的字都收起来（同一个字画很多遍，按集合比）
  const distinct = new Set();
  for (let t = 0; t < longScene.duration; t += 0.2) {
    seen.length = 0;
    longScene.draw(longG, t);
    seen.forEach((ch) => distinct.add(ch));
  }
  CanvasRenderingContext2D.prototype.fillText = realFill2;
  out.pagedAllChars = Array.from(new Set(longText)).filter((ch) => !distinct.has(ch));
  // 状态切换后，文字颜色要跟上（子元素 transition: inherit 那段不能留在实时里）
  const film = new D.CssFilm({css: '.a{color:#fff;transition:color .4s}.a.is-on{color:#000}.b{transition:inherit}', html: '<div class="a" data-state><span class="b">字</span></div>', stateAt: 0.2});
  film.seek(3);
  out.filmInherit = getComputedStyle(film.shadow.querySelector('.b')).color;
  film.dispose();
  const auto = window.DMAutoboard ? window.DMAutoboard : null;
  out.series = D.parseSeries('抖音有3亿用户，微信有12亿用户，快手有4亿用户。');
  const rankTop = (row) => D.rankTemplates(row, null).slice(0, 3).map((t) => t.name);
  out.rankData = rankTop({line: '有45%表示很少复查', tpl: 'comb', groups: [{relation: 'single', metrics: [{caption: '很少复查', value: 45}]}]});
  out.rankFunnel = rankTop({line: '从看到广告到付费，一层层流失', tpl: 'statement', series: [{label: 'a', value: 100}, {label: 'b', value: 50}, {label: 'c', value: 10}], unit: '人'});
  const adopted = D.adopt({line: '今天天气不错。', tpl: 'statement'}, 'chLine');
  out.adopt = {sample: adopted.sampleData === true, note: adopted.note, canDraw: !!D.createScene(Object.assign({}, adopted, {template: 'chLine'}), 64)};
  // 换走样例：字段和标记都拿掉，原来的备注还在
  const withNote = D.adopt({line: '今天天气不错。', tpl: 'statement', note: '原来的备注'}, 'chLine');
  const back = D.adopt(withNote, 'mp005');
  out.adoptBack = withNote.note.includes('原来的备注') && !back.sampleData && !back.points && back.note === '原来的备注';
  const kept = D.adopt({line: '抖音有3亿', tpl: 'statement', series: [{label: 'a', value: 1}, {label: 'b', value: 2}, {label: 'c', value: 3}]}, 'chBars');
  out.adoptKeepsData = kept.series[0].label === 'a' && !kept.sampleData;
  out.adoptText = D.adopt({line: '这个系统彻底崩溃了。后面的话', tpl: 'statement'}, 'mp006').lines;
  out.rankPlain = rankTop({line: '这个系统彻底崩溃了', tpl: 'statement', lines: ['这个系统彻底崩溃了']});
  return out;
});

console.log(JSON.stringify(result, null, 1));

if (sheetDir) {
  fs.mkdirSync(sheetDir, {recursive: true});
  const names = await page.evaluate(() => window.DM.CATEGORIES.map((c) => c.id));
  for (const cat of names) {
    const data = await page.evaluate(async (cat) => {
      const D = window.DM;
      const list = Object.values(D.TEMPLATES).filter((t) => t.cat === cat);
      if (!list.length) return null;
      const w = 320;
      const h = 180;
      const cols = 8;
      const rows = Math.ceil(list.length / cols);
      const sheet = document.createElement('canvas');
      sheet.width = cols * (w + 8);
      sheet.height = rows * (h + 30);
      const g = sheet.getContext('2d');
      g.fillStyle = '#222';
      g.fillRect(0, 0, sheet.width, sheet.height);
      const cell = document.createElement('canvas');
      cell.width = w;
      cell.height = h;
      const k = cell.getContext('2d', {alpha: false});
      list.forEach((tpl, i) => {
        const raw = Object.assign({line: ''}, D.sampleOf(tpl.id), {template: tpl.id, tpl: tpl.id});
        const x = (i % cols) * (w + 8);
        const y = Math.floor(i / cols) * (h + 30);
        try {
          const s = D.createScene(raw, w);
          s.draw(k, D.thumbTime(tpl.id, s));
          g.drawImage(cell, x, y);
        } catch (e) {
          g.fillStyle = '#a00';
          g.fillRect(x, y, w, h);
        }
        g.fillStyle = '#fff';
        g.font = '16px "PingFang SC",sans-serif';
        g.fillText(`${tpl.id} ${tpl.name}`, x + 4, y + h + 20);
      });
      return sheet.toDataURL('image/jpeg', 0.8);
    }, cat);
    if (data) fs.writeFileSync(path.join(sheetDir, `${cat}.jpg`), Buffer.from(data.split(',')[1], 'base64'));
  }
}
await browser.close();
if (errs.length) console.log('页面错误', errs);
const widget = result.widget;
const timedBad = Object.values(result.timed).filter((v) => !v).length + result.pagedAllChars.length;
const widgetBad = timedBad + (widget.short === null ? 1 : 0) + (widget.long === null ? 0 : 1) + (widget.noNumber ? 1 : 0) + (widget.percent ? 0 : 1) + (widget.notPercent ? 1 : 0) + (widget.adopted ? 0 : 1) + widget.stockWords.length + (result.filmInherit === 'rgb(0, 0, 0)' ? 0 : 1);
const bad = widgetBad + result.lfEnglish.length + result.lfNoData.length + (result.adopt.sample && result.adopt.canDraw ? 0 : 1) + (result.adoptKeepsData ? 0 : 1) + (result.adoptBack ? 0 : 1) + result.noCategory.length + result.failed.length + result.impure.length + result.blank.length + result.noKeywords.length + result.textFailed.length + errs.length;
console.log(bad ? `有 ${bad} 处问题` : '全部通过');
process.exit(bad ? 1 : 0);
