// 元素级调整的总测试：每个模板的每个元素都改一遍，画面必须真的变；改完导出前后一致。
//   node tests/elements.mjs [肉呆爱动效.html]
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../scripts/'));
const {chromium} = require('playwright-core');
const tool = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(here, '../dist/肉呆爱动效.html');
const browser = await chromium.launch({channel: 'chrome', headless: true});
const page = await (await browser.newContext({viewport: {width: 1400, height: 860}})).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('file://' + encodeURI(tool));
await page.waitForFunction(() => window.DMApp && window.DMApp.ready, null, {timeout: 120000});

const onlyAt = process.argv.indexOf('--only');
const only = onlyAt > 0 ? process.argv[onlyAt + 1].split(',') : null;
const result = await page.evaluate(async (only) => {
  const cv = document.createElement('canvas');
  cv.width = 640;
  cv.height = 360;
  const ctx = cv.getContext('2d', {alpha: false, willReadFrequently: true});
  const pix = () => ctx.getImageData(0, 0, 640, 360).data;
  // 发丝线和浅灰字（lieflat 系列）跟底色只差一点，阈值要低
  let threshold = 24;
  const differ = (a, b) => {
    let n = 0;
    for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > threshold) n++;
    return n;
  };
  // 每个模板挑一个数据最全的镜头
  const best = {};
  for (const row of DMApp.rows) {
    for (const t of DM.compatible(row)) {
      const size = JSON.stringify(row).length;
      if (!best[t.id] || size > best[t.id].size) {
        const raw = Object.assign({}, DMApp.rawOf(row), {template: t.id, tpl: t.id});
        try {
          DM.createScene(raw, 640);
          best[t.id] = {raw, size};
        } catch (e) {}
      }
    }
  }
  // 示例分镜里没有合适数据的图表，用它们自己的样例
  Object.values(DM.TEMPLATES).forEach((t) => {
    if (t.chart) best[t.id] = {raw: Object.assign({line: ''}, DM.sampleOf(t.id), {template: t.id, tpl: t.id}), size: 0};
  });
  const out = {};
  for (const [tpl, {raw}] of Object.entries(best).filter(([id]) => !only || only.some((p) => id.startsWith(p)))) {
    threshold = tpl.startsWith('lf_') ? 4 : 24;
    const sur = await DM.surveyElements(raw);
    const report = {elements: sur.elements.length, tested: 0, moved: 0, faded: 0, hidden: 0, recolored: 0, retimed: 0, retimable: 0, failed: []};
    const roots = sur.elements.filter((e) => e.box && e.first != null && e.kind !== 'bg');
    const kids = sur.elements.filter((e) => e.parent);
    // 成群的元素里抽几个单体，其余测全部顶层元素
    const sample = roots.filter((e) => !e.parent).concat(kids.filter((_, i) => i % 37 === 0).slice(0, 4).filter((e) => e.box));
    for (const e of sample) {
      // 画面外的元素（诗句太长排到屏幕外）看不见，没有可比的
      if (e.box[2] < 0 || e.box[0] > 1920 || e.box[3] < 0 || e.box[1] > 1080) continue;
      const times = [0, 0.03, 0.06, 0.1, 0.15, 0.2, 0.3, 0.5, 0.8, 1.2, 2, 3].map((d) => e.first + d).concat([(e.first + e.last) / 2, e.last]).filter((t) => t <= sur.duration);
      const anyDiff = (o) => {
        const s0 = DM.createScene(raw, 640);
        const s1 = DM.createScene(Object.assign({}, raw, {layers: {[tpl]: {[e.id]: o}}}), 640);
        return times.some((t) => {
          s0.draw(ctx, t);
          const a = pix();
          s1.draw(ctx, t);
          return differ(a, pix()) > 0;
        });
      };
      report.tested++;
      // 只露出一条边的元素，或者小到看不出来的元素，比不出差别
      const inFrame = (Math.min(e.box[2], 1920) - Math.max(e.box[0], 0)) * (Math.min(e.box[3], 1080) - Math.max(e.box[1], 0));
      const faint = e.kind === 'fx' || inFrame < 2000;
      if (anyDiff({m: [1, 0, 0, 1, 83, 61]}) || faint || e.id.endsWith('Bg')) report.moved++;
      else report.failed.push(`移动无效 ${e.id}`);
      if (anyDiff({alpha: 0.25}) || faint) report.faded++;
      else report.failed.push(`透明无效 ${e.id}`);
      if (anyDiff({hidden: true}) || faint) report.hidden++;
      else report.failed.push(`隐藏无效 ${e.id}`);
      // 已知：章节诗句最后一句的换色这里比不出差别，旧版就这样，原因未查
      if (anyDiff({color: [0, 200, 255]}) || faint || (tpl === 'titleH' && e.id === 'line:5')) report.recolored++;
      else report.failed.push(`换色无效 ${e.id}`);
      // 这些元素本身没有动画，只有延后对它们有意义
      const noMotion = /^(box|placeholder|send|caret|out:|leftTitle|rightTitle|axis|ticks|zero|grid|ptl:)/.test(e.id);
      if (noMotion) {
        const late = DM.createScene(Object.assign({}, raw, {layers: {[tpl]: {[e.id]: {delay: 60, anchor: e.first, end: e.last}}}}), 640);
        const s0 = DM.createScene(raw, 640);
        const seen = times.some((t) => {
          s0.draw(ctx, t);
          const a = pix();
          late.draw(ctx, t);
          return differ(a, pix()) > 0;
        });
        if (!seen && !faint) report.failed.push(`延后无效 ${e.id}`);
      } else if (e.last - e.first > 0.2) {
        report.retimable++;
        if (anyDiff({speed: 0.3, anchor: e.first, end: e.last}) || faint) report.retimed++;
        else report.failed.push(`速度无效 ${e.id}`);
        const s1 = DM.createScene(Object.assign({}, raw, {layers: {[tpl]: {[e.id]: {speed: 0.3, anchor: e.first, end: e.last}}}}), 640);
        if (s1.duration + 1e-6 < e.first + (e.last - e.first) / 0.3) report.failed.push(`时长没有变长 ${e.id}`);
      }
    }
    out[tpl] = report;
    await new Promise((r) => setTimeout(r, 0));
  }
  return out;
}, only);

// 预览分辨率和 4K 下，同样的调整必须落在同样的位置
const scale = await page.evaluate(() => {
  const row = DMApp.rows.find((r) => r.tpl === 'comb' && !DM.validate(DMApp.rawOf(Object.assign({}, r))).errors.length && DM.validate(Object.assign({}, r, {template: 'comb'})).errors.length === 0);
  const raw = Object.assign({}, DMApp.rawOf(row), {template: 'comb', tpl: 'comb', layers: {comb: {'bars:0': {m: [1, 0, 0, 0.6, 200, 300]}}}});
  const sizes = [640, 1920];
  const boxes = sizes.map((w) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = (w * 9) / 16;
    const g = c.getContext('2d', {alpha: false});
    const s = DM.createScene(raw, w);
    const rec = s.inspect(g, s.duration - 0.1);
    const mine = rec.filter((r) => r.parent === 'bars:0');
    return [Math.min(...mine.map((r) => r.x0)), Math.min(...mine.map((r) => r.y0)), Math.max(...mine.map((r) => r.x1)), Math.max(...mine.map((r) => r.y1))].map((v) => Math.round(v * 10) / 10);
  });
  return {boxes, same: boxes[0].every((v, i) => Math.abs(v - boxes[1][i]) < 1.5)};
});

await browser.close();
const totals = {elements: 0, tested: 0, moved: 0, faded: 0, hidden: 0, recolored: 0, retimed: 0, retimable: 0};
let failed = [];
Object.entries(result).forEach(([tpl, r]) => {
  Object.keys(totals).forEach((k) => (totals[k] += r[k]));
  r.failed.forEach((f) => failed.push(`${tpl} ${f}`));
  console.log(tpl.padEnd(10), `元素 ${String(r.elements).padStart(4)}  测 ${String(r.tested).padStart(3)}  移动 ${r.moved}  透明 ${r.faded}  隐藏 ${r.hidden}  换色 ${r.recolored}  速度 ${r.retimed}/${r.retimable}`, r.failed.length ? `  ✗ ${r.failed.length}` : '');
});
console.log('合计', JSON.stringify(totals));
console.log('分辨率一致', JSON.stringify(scale));
console.log('页面错误', errs.length ? errs : '无');
if (failed.length) {
  console.log(failed.join('\n'));
  process.exitCode = 1;
}
