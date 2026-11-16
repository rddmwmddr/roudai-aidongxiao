// App 渲染页：双击画面里的字改字、一百根三四个数一个数一行。真实指针，出错就退出码 1。
//   node tests/stage_text.mjs [mac/Resources/stage.html]
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../scripts/'));
const {chromium} = require('playwright-core');
const tool = path.resolve(process.argv[2] || path.join(here, '../mac/Resources/stage.html'));
const browser = await chromium.launch({channel: 'chrome', headless: true});
const page = await (await browser.newContext({viewport: {width: 1280, height: 820}})).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.addInitScript(() => {
  window.__dmLog = [];
});
await page.goto('file://' + encodeURI(tool));
await page.waitForFunction(() => window.__dmReady, null, {timeout: 120000});
const stage = await page.locator('#stage').boundingBox();
const fails = [];
const expect = (name, ok, got) => {
  if (!ok) fails.push(`${name}：${JSON.stringify(got)}`);
};

const load = async (row) => {
  await page.evaluate((r) => {
    window.__dmLog.length = 0;
    DMBridge.load(JSON.stringify(r), false);
  }, row);
  await page.waitForFunction(() => window.__dmEditor.elements.length > 0, null, {timeout: 20000});
  await page.waitForTimeout(200);
};
const dbl = async (id) => {
  const b = await page.evaluate((i) => window.__dmEditor._box(i).box, id);
  await page.mouse.dblclick(stage.x + ((b[0] + b[2]) / 2 / 1920) * stage.width, stage.y + ((b[1] + b[3]) / 2 / 1080) * stage.height);
  await page.waitForTimeout(150);
};
const box = () => page.evaluate(() => {
  const a = document.querySelector('.dme-text textarea');
  return a ? {value: a.value, focused: document.activeElement === a} : null;
});
const edits = async () => {
  await page.waitForTimeout(50);
  return page.evaluate(() => window.__dmLog.filter((m) => m.type === 'editRow').map((m) => ({id: m.id, fields: JSON.parse(m.fields)})));
};
const COMB = {id: 7, tpl: 'comb', line: '72%的朋友每月都喝咖啡，45%每周都喝，20%每天都喝。', groups: [{relation: 'nested', metrics: [{caption: '每月都喝咖啡', value: 72}, {caption: '每周都喝', value: 45}]}, {relation: 'single', metrics: [{caption: '每天都喝', value: 20}]}]};

// 1. 一百根：三个数三行，四个数四行，两个数包含还是一行
const rows = await page.evaluate((row) => {
  const n = (r) => DM.validate(DM.timeGroups(Object.assign({}, r, {template: 'comb'}))).spec.groups.length;
  const four = Object.assign({}, row, {groups: [row.groups[0], {relation: 'nested', metrics: [{caption: '每天都喝', value: 20}, {caption: '一天两杯', value: 8}]}]});
  const oneGroup = Object.assign({}, row, {groups: [{relation: 'single', metrics: row.groups[0].metrics.concat(row.groups[1].metrics)}]});
  const two = Object.assign({}, row, {groups: [row.groups[0]]});
  return {three: n(row), four: n(four), oneGroup: n(oneGroup), two: n(two)};
}, COMB);
expect('一百根行数', rows.three === 3 && rows.four === 4 && rows.oneGroup === 3 && rows.two === 1, rows);

// 2. 双击说明文字：输入框带原文，回车写回 groups，口播不动；退格不隐藏元素
await load(COMB);
await dbl('cap:1:0');
const opened = await box();
expect('双击说明打开输入框', opened && opened.value === '每周都喝' && opened.focused, opened);
await page.keyboard.press('Space');
expect('输入框内的空格不会播放', !(await page.evaluate(() => window.__dmState().playing)), await box());
await page.keyboard.press('Backspace');
await page.keyboard.type('每周至少喝一次');
await page.keyboard.press('Enter');
const e1 = await edits();
expect('回车写回说明', e1.length === 1 && e1[0].id === 7 && e1[0].fields.groups[0].metrics[1].caption === '每周至少喝一次' && !('line' in e1[0].fields), e1);
expect('退格没有隐藏元素', !(await page.evaluate(() => Object.keys(window.__dmEditor.layers).length)), 'layers');
await page.keyboard.press('Space');
expect('回车退出输入框后空格播放', await page.evaluate(() => window.__dmState().playing));

// 3. Esc 放弃
await load({id: 8, tpl: 'statement', line: '一杯咖啡，一段时光。', lines: ['一杯咖啡，一段时光']});
await dbl('text');
expect('双击字幕打开输入框', (await box()) && (await box()).value === '一杯咖啡，一段时光', await box());
await page.keyboard.type('不要');
await page.keyboard.press('Escape');
expect('Esc 不写回', !(await box()) && !(await edits()).length, await edits());
await page.keyboard.press('Space');
expect('Esc 退出输入框后空格播放', await page.evaluate(() => window.__dmState().playing));

// 4. 文字特效：字画在动效里，双击整块改 lines，Shift+回车换行
const cot = await page.evaluate(() => DM.adopt({id: 10, line: '一杯咖啡，一段时光。'}, 'cot05'));
await load(cot);
await dbl('film');
expect('双击文字特效打开输入框', (await box()) && (await box()).value === cot.lines.join('\n'), await box());
await page.keyboard.press('Meta+A');
await page.keyboard.type('第一行');
await page.keyboard.press('Shift+Enter');
await page.keyboard.type('第二行');
await page.keyboard.press('Enter');
const e2 = await edits();
expect('写回 lines', e2.length === 1 && JSON.stringify(e2[0].fields) === JSON.stringify({lines: ['第一行', '第二行']}), e2);

// 5. 竖条不是字：双击不弹输入框
await load(COMB);
await dbl('bars:0');
expect('竖条不弹输入框', !(await box()), await box());

// 6. 点画面别处：改到一半的字也存
await dbl('cap:0:0');
await page.keyboard.type('爱喝咖啡');
await page.mouse.click(stage.x + 20, stage.y + 20);
const e3 = await edits();
expect('点别处存字', e3.length === 1 && e3[0].fields.groups[0].metrics[0].caption === '爱喝咖啡', e3);

// 7. 框选、⌘A、标准缩放。用外部动效包定义固定的可选元素，避免文字布局随字体变化。
const pack = {
  version: 1,
  templates: [{id: 'local.qa', name: '动效包测试', duration: 1, elements: [
    {id: 'first', type: 'rect', x: 350, y: 330, width: 240, height: 160, color: '#FF0000', enter: 'none'},
    {id: 'second', type: 'rect', x: 950, y: 330, width: 240, height: 160, color: '#00FF00', enter: 'none'},
  ]}],
  overrides: [{target: 'comb', defaults: {colors: {primary: '#00FF00'}}}],
};
const installed = await page.evaluate((json) => JSON.parse(DMBridge.installMotionPack(JSON.stringify(json))), pack);
expect('导入本机模板和内置覆盖', installed.templates === 1 && installed.overrides === 1, installed);
const override = await page.evaluate((row) => DM.createScene({...row, template: 'comb'}, 320).spec.colors.primary, COMB);
expect('覆盖进入渲染引擎', override === '#00FF00', override);
await load({id: 9, tpl: 'local.qa', line: '测试', dur: 1});
const pos = (x, y) => ({x: stage.x + x * stage.width / 1920, y: stage.y + y * stage.height / 1080});
const corner = pos(300, 260);
const end = pos(1250, 520);
await page.mouse.move(corner.x, corner.y);
await page.mouse.down();
await page.mouse.move(end.x, end.y, {steps: 5});
await page.mouse.up();
const selected = () => page.evaluate(() => window.__dmEditor.sel.slice().sort());
expect('空白拖框选择两个元素', JSON.stringify(await selected()) === '["first","second"]', await selected());
await page.keyboard.press('Escape');
await page.keyboard.press('Meta+a');
expect('⌘A 全选并略过背景', JSON.stringify(await selected()) === '["first","second"]', await selected());
await page.keyboard.press('Escape');
const center = pos(470, 410);
await page.mouse.click(center.x, center.y);
const sx = page.getByRole('textbox', {name: '横向缩放百分比'});
expect('横向缩放原值 100%', await sx.inputValue() === '100.00', await sx.inputValue());
await sx.fill('125');
await sx.press('Enter');
const scaled = () => page.evaluate(() => window.__dmEditor.layers.first?.m?.[0]);
expect('精确设置到 125%', await scaled() === 1.25, await scaled());
await sx.fill('100');
await sx.press('Enter');
expect('回填 100% 还原缩放', (await scaled() ?? 1) === 1, await scaled());

const invalid = await page.evaluate(() => JSON.parse(DMBridge.installMotionPack('{"version":2}')));
expect('无效更新保留当前动效包', !!invalid.error && await page.evaluate(() => !!DM.TEMPLATES['local.qa']), invalid);
const updated = structuredClone(pack);
updated.templates[0].elements[0].color = '#0000FF';
await page.evaluate((json) => DMBridge.installMotionPack(JSON.stringify(json)), updated);
const frame = await page.evaluate(() => {
  const scene = window.__dmState().scene;
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 180;
  const c = canvas.getContext('2d');
  DM.createScene({template: 'local.qa', line: '测试'}, 320).draw(c, scene.duration - 0.1);
  return [...c.getImageData(78, 68, 1, 1).data];
});
expect('热更新后绘制新颜色', frame[2] === 255 && frame[0] === 0, frame);
await page.evaluate(() => DMBridge.installMotionPack('{"version":1}'));
const missing = await page.evaluate(() => DM.exportIssue({tpl: 'local.qa', line: '测试'}));
expect('缺少本机模板时禁止导出', missing.includes('未加载'), missing);

const titled = await page.evaluate((row) => {
  const text = {id: 'total-title', type: 'text', text: '总共5000人', x: 80, y: 60, size: 48, color: '#FFFFFF'};
  const frame = (template) => {
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 270;
    const ctx = canvas.getContext('2d', {willReadFrequently: true});
    const scene = DM.createScene({...row, template}, 480);
    const t = scene.duration * 0.7;
    const registry = new Map();
    scene.inspect(ctx, t, registry);
    return {duration: scene.duration, pixels: ctx.getImageData(0, 0, 480, 270).data, registry};
  };
  const base = frame('comb');
  DM.installMotionPack({version: 1, overrides: [{target: 'comb', overlays: [text]}],
    templates: [{id: 'local.qa-comb', name: '一百根带标题', base: 'comb', overlays: [text]}]});
  const override = frame('comb');
  const copy = frame('local.qa-comb');
  let titlePixels = 0;
  let changedElsewhere = 0;
  for (let i = 0; i < base.pixels.length; i += 4) {
    if (base.pixels[i] === override.pixels[i] && base.pixels[i + 1] === override.pixels[i + 1] && base.pixels[i + 2] === override.pixels[i + 2]) continue;
    if (i / 4 < 28 * 480 && (i / 4) % 480 < 100) titlePixels += 1;
    else changedElsewhere += 1;
  }
  const name = (frame) => frame.registry.get('overlay:total-title')?.label;
  return {
    titlePixels, changedElsewhere, label: name(override), copy: name(copy),
    sameDuration: base.duration === override.duration && base.duration === copy.duration,
  };
}, COMB);
expect('叠加文字只改变标题区域，底图和时长不变', titled.titlePixels > 25 && titled.changedElsewhere === 0 && titled.sameDuration, titled);
expect('覆盖和另存的模板均可渲染独立文字', titled.label === '总共5000人' && titled.copy === titled.label, titled);

await load(COMB);
await dbl('overlay:total-title');
expect('双击叠加层可编辑文案', (await box())?.value === '总共5000人', await box());
await page.keyboard.type('总共800人');
await page.keyboard.press('Enter');
const overlayEdits = await edits();
expect('标题只写回当前分镜，不修改底图数据', overlayEdits.length === 1 && overlayEdits[0].fields.overlayText?.comb?.['overlay:total-title'] === '总共800人'
  && Object.keys(overlayEdits[0].fields).length === 1, overlayEdits);
await load({...COMB, ...overlayEdits[0]?.fields});
await dbl('overlay:total-title');
expect('当前分镜使用已保存的新标题', (await box())?.value === '总共800人', await box());
await page.keyboard.press('Escape');
await load({...COMB, id: 77});
await dbl('overlay:total-title');
expect('同一模板的其他分镜仍使用默认标题', (await box())?.value === '总共5000人', await box());
await page.keyboard.press('Escape');

const binding = await page.evaluate((row) => {
  const title = {id: 'total-title', type: 'text', bind: 'sampleSize', text: '总共{sampleSize}人', x: 80, y: 60, size: 48, color: '#FFFFFF'};
  const id = 'local.qa-sample-size';
  DM.installMotionPack({version: 1, templates: [{id, name: '一百根带样本人数', base: 'comb', overlays: [title]}]});
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 270;
  const ctx = canvas.getContext('2d');
  const label = (fields) => {
    const scene = DM.createScene({...row, template: id, ...fields}, 480);
    const registry = new Map();
    scene.inspect(ctx, scene.duration / 2, registry);
    return registry.get('overlay:total-title')?.label ?? null;
  };
  const explicit = label({
    sampleSize: 800,
    line: '我们调查了5000人。',
    overlayText: {[id]: {'overlay:total-title': '总共200人'}},
  });
  const inputs = [
    '我们询问了5,000位朋友，其中有72%这样回答。',
    '本次调研了八百名用户，有45%这样回答。',
    '有800人支持这项建议。',
    '这次调查了5000人，上次调查了800人。',
    '样本量为800到1000人。',
    '调查了800人左右。',
    '样本量为800.5%。',
    '样本人数为1.15万人。',
  ];
  const invalid = JSON.parse(DMBridge.installMotionPack(JSON.stringify({
    version: 1, overrides: [{target: 'comb', overlays: [{...title, text: '总共5000人'}]}],
  })));
  const line = '我们调查了800人，其中有72%每月喝咖啡。';
  const aiRow = {tpl: id, line, sampleSize: 5000, groups: [{relation: 'single', metrics: [{value: 72, caption: '每月喝咖啡'}]}]};
  const reviewed = DMBoard.reviewRows([aiRow], line);
  return {explicit, labels: inputs.map((line) => label({line})), invalid: invalid.error,
    reviewed: {label: label(reviewed.rows[0]), issues: reviewed.issues.length}};
}, COMB);
expect('样本人数绑定随分镜读取，手填字段优先，无法确认时隐藏', binding.explicit === '总共800人'
  && JSON.stringify(binding.labels) === JSON.stringify(['总共5000人', '总共800人', null, null, null, null, null, '总共11500人']), binding);
expect('绑定的标题不能写死示例人数', binding.invalid?.includes('{sampleSize}'), binding);
expect('AI 分镜以本镜口播人数为准', binding.reviewed.issues === 0 && binding.reviewed.label === '总共800人', binding.reviewed);

const combined = await page.evaluate(async () => {
  const config = DMOpus.defaults('poll-results-bars');
  config.timeline.currentTime = 1.25;
  const row = DMOpus.row(config, 901);
  await DMBridge.load(JSON.stringify(row), false);
  const restored = window.__dmState().t;
  await DMBridge.load(JSON.stringify({...row, id: 902}), false, true);
  const {playing: autoplay, t: autoplayTime} = window.__dmState();
  const preview = JSON.parse(await DMBridge.preview(JSON.stringify(row), row.tpl, true));
  return {restored, autoplay, autoplayTime, duration: preview.duration ?? null, expected: config.timeline.duration, frames: preview.frames?.length ?? 0};
});
expect('调研镜头记住播放位置，自动连播时从头开始，并可生成完整预览', combined.restored === 1.25
  && combined.autoplay && combined.autoplayTime === 0 && combined.duration === combined.expected && combined.frames > 1, combined);

await browser.close();
if (errs.length) fails.push(`页面报错：${errs.join('；')}`);
if (fails.length) {
  console.log(fails.join('\n'));
  process.exit(1);
}
console.log('画面内改字、一百根行数：通过');
