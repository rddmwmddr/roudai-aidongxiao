// 真实指针操作：点选、拖动、拉高、旋转、拖时间条、双击进单根，确认数据和画面都变了。
//   node tests/editor_pointer.mjs [html] [截图目录]
import {createRequire} from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../scripts/'));
const {chromium} = require('playwright-core');
const tool = process.argv[2] || path.join(here, '../dist/肉呆爱动效.html');
const shots = process.argv[3] || path.join(here, '../质检/editor');
fs.mkdirSync(shots, {recursive: true});
const browser = await chromium.launch({channel: 'chrome', headless: true});
const context = await browser.newContext({viewport: {width: 1500, height: 900}});
const page = await context.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('file://' + encodeURI(tool));
await page.waitForFunction(() => window.DMApp && window.DMApp.ready, null, {timeout: 120000});
const out = {};
// 选一个一百根的镜头，停在结尾
const idx = await page.evaluate(() => DMApp.rows.findIndex((r) => r.tpl === 'comb' && (r.groups || []).length >= 1 && !DM.validate(Object.assign({}, r, {template: 'comb'})).errors.length));
await page.evaluate((i) => DMApp.select(i), idx);
await page.locator('#play').click();
const box = await page.locator('#stage').boundingBox();
const X = (v) => box.x + (v / 1920) * box.width;
const Y = (v) => box.y + (v / 1080) * box.height;
await page.evaluate(() => {
  const seek = document.getElementById('seek');
  seek.value = 0.97;
  seek.dispatchEvent(new Event('input'));
});
await page.waitForTimeout(800);
const layers = () => page.evaluate((i) => {
  const r = DMApp.rows[i];
  return JSON.parse(JSON.stringify((r.layers || {})[r.tpl] || {}));
}, idx);
const hud = () => page.locator('.dme-hud');
await page.screenshot({path: `${shots}/1_未选中.png`});

// 1. 点选一组竖条
await page.mouse.click(X(300), Y(800));
await page.waitForTimeout(100);
out.selectedName = await page.locator('.dme-name').textContent();
await page.screenshot({path: `${shots}/2_选中竖条.png`});

// 2. 拖动
await page.mouse.move(X(300), Y(800));
await page.mouse.down();
await page.mouse.move(X(340), Y(760), {steps: 6});
await page.mouse.up();
await page.waitForTimeout(100);
out.afterMove = await layers();

// 3. 拉高：拖上边的手柄
const n = await page.locator('.dme-h[data-h="n"]').boundingBox();
await page.mouse.move(n.x + n.width / 2, n.y + n.height / 2);
await page.mouse.down();
await page.mouse.move(n.x + n.width / 2, n.y + n.height / 2 - 60, {steps: 6});
await page.mouse.up();
await page.waitForTimeout(100);
out.afterHeight = await layers();
await page.screenshot({path: `${shots}/3_拉高之后.png`});

// 4. 拖时间条右端：变快
const span = await page.locator('.dme-span').boundingBox();
await page.mouse.move(span.x + span.width - 2, span.y + span.height / 2);
await page.mouse.down();
await page.mouse.move(span.x + span.width * 0.55, span.y + span.height / 2, {steps: 6});
await page.mouse.up();
await page.waitForTimeout(100);
out.afterSpeed = await layers();
await page.screenshot({path: `${shots}/4_改速度之后.png`});

// 5. 拖时间条中间：延后
const span2 = await page.locator('.dme-span').boundingBox();
await page.mouse.move(span2.x + span2.width / 2, span2.y + span2.height / 2);
await page.mouse.down();
await page.mouse.move(span2.x + span2.width / 2 + 60, span2.y + span2.height / 2, {steps: 4});
await page.mouse.up();
await page.waitForTimeout(100);
out.afterDelay = await layers();

// 6. 面板里输入数字
const inp = page.locator('.dme-f input[aria-label="不透明度"]');
await inp.click();
await inp.fill('60');
await inp.press('Enter');
await page.waitForTimeout(100);
const barsId = await page.evaluate(() => DMApp.editor.sel[0]);
out.afterAlpha = (await layers())[barsId].alpha;

// 7. 双击进入单根：只有这一根变
const bars = await page.evaluate(() => {
  const s = document.querySelector('.dme-sel').getBoundingClientRect();
  return {x: s.x, y: s.y, w: s.width, h: s.height};
});
const gx = bars.x + bars.w * 0.5;
const gy = bars.y + bars.h * 0.5;
await page.mouse.dblclick(gx, gy);
await page.waitForTimeout(100);
out.childName = await page.locator('.dme-name').textContent();
await page.mouse.move(gx, gy);
await page.mouse.down();
await page.mouse.move(gx, gy - 70, {steps: 5});
await page.mouse.up();
await page.waitForTimeout(100);
const after = await layers();
out.childLayer = Object.entries(after).filter(([k]) => k.startsWith('bar:')).map(([k, v]) => [k, v.m]);
await page.screenshot({path: `${shots}/5_单根.png`});

// 8. 选文字：数字、说明都单独可选
await page.keyboard.press('Escape');
await page.keyboard.press('Escape');
await page.waitForTimeout(100);
const names = await page.evaluate(() => {
  const ed = document.querySelector('.dme');
  return !!ed;
});
out.editorPresent = names;

// 9. 键盘：方向键移动
await page.evaluate((id) => DMApp.editor.select([id]), barsId);
await page.locator('.dme').focus();
const before = (await layers())[barsId].m.slice();
await page.keyboard.press('ArrowRight');
await page.keyboard.press('Shift+ArrowDown');
await page.waitForTimeout(500);
const k = (await layers())[barsId].m;
out.keyNudge = [k[4] - before[4], k[5] - before[5]];

// 10. 撤销
await page.keyboard.press('Meta+z');
await page.waitForTimeout(100);
const u = (await layers())[barsId].m;
out.afterUndo = [u[4] - before[4], u[5] - before[5]];

// 11. 还原
await page.locator('.dme-b', {hasText: '还原'}).click();
await page.waitForTimeout(100);
out.afterReset = Object.keys(await layers()).includes(barsId);

// 12. 刷新后还在（单根那一条）
await page.waitForTimeout(300);
await page.reload();
await page.waitForFunction(() => window.DMApp && window.DMApp.ready, null, {timeout: 120000});
out.afterReload = await page.evaluate((i) => Object.keys((DMApp.rows[i].layers || {})[DMApp.rows[i].tpl] || {}), idx);

// 13. 导出：调整过的镜头
out.export = await page.evaluate(async (i) => {
  const r = DMApp.rows[i];
  const raw = DMApp.rawOf(r);
  const o = await DM.exportMP4(raw, {size: '1080p', fps: 30});
  const c = await DM.verifyMP4(o.blob, raw);
  return {duration: o.duration, MB: o.blob.size / 1e6, ok: c.ok, edited: c.edited};
}, idx);
// 清掉测试留下的调整
await page.evaluate((i) => {
  const r = DMApp.rows[i];
  delete r.layers;
  localStorage.clear();
}, idx);
out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await browser.close();
