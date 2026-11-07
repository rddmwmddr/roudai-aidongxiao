// 网页版的剪辑台：真实鼠标走一遍。第二部分起真的服务端，两个人同时开，看修改能不能同步。
//   node tests/web_shell.mjs [截图目录]
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../scripts/'));
const {chromium} = require('playwright-core');
const shots = process.argv[2] || null;
if (shots) fs.mkdirSync(shots, {recursive: true});
const fails = [];
const check = (name, ok, extra = '') => {
  console.log(`${ok ? '通过' : '失败'}  ${name}${extra ? `  ${extra}` : ''}`);
  if (!ok) fails.push(name);
};
const browser = await chromium.launch({channel: 'chrome', headless: true});
const open = async (ctx, url) => {
  const page = await ctx.newPage();
  page.errs = [];
  page.on('pageerror', (e) => page.errs.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.DMApp && window.DMApp.ready, null, {timeout: 120000});
  await page.waitForTimeout(400);
  return page;
};
const snap = async (page, name) => {
  if (shots) await page.screenshot({path: path.join(shots, `${name}.jpg`), type: 'jpeg', quality: 82});
};
const dragTrim = async (page, i, dx) => {
  await page.evaluate((n) => {
    const clip = document.querySelector(`.clip[data-i="${n}"]`);
    clip.scrollIntoView({inline: 'center', block: 'nearest'});
  }, i);
  await page.waitForTimeout(150);
  const box = await page.locator(`.clip[data-i="${i}"] .trim`).boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let k = 1; k <= 8; k++) await page.mouse.move(x + (dx * k) / 8, y);
  await page.mouse.up();
  await page.waitForTimeout(200);
};

// ---------- 单文件版 ----------
{
  const ctx = await browser.newContext({viewport: {width: 1480, height: 900}});
  const url = 'file://' + encodeURI(path.join(here, '../dist/肉呆爱动效.html'));
  const page = await open(ctx, url);
  const count = await page.evaluate(() => ({clips: document.querySelectorAll('.clip').length, rows: DMApp.rows.length, sel: document.querySelectorAll('.clip.sel').length, total: Object.keys(DM.TEMPLATES).length}));
  check('一镜一个片段', count.clips === count.rows && count.rows >= 10, JSON.stringify(count));
  check('只有一个选中', count.sel === 1);
  check('动效库 703 个', count.total === 703, String(count.total));
  await page.evaluate(() => DMApp.select(5));
  await page.waitForTimeout(600);
  await snap(page, '网页_画面');
  // 胶片画出来了
  await page.waitForFunction(() => document.querySelector('.clip[data-i="5"] .film canvas'), null, {timeout: 15000}).catch(() => {});
  check('胶片画出来了', await page.evaluate(() => !!document.querySelector('.clip[data-i="5"] .film canvas')));

  // 拖片段右边缘改时长
  const before = await page.evaluate(() => ({d: DMApp.editor ? null : null, row: DMApp.rows[5].dur, w: document.querySelector('.clip[data-i="5"]').offsetWidth, next: document.querySelector('.clip[data-i="6"]').offsetLeft}));
  await dragTrim(page, 5, 80);
  const after = await page.evaluate(() => ({row: DMApp.rows[5].dur, w: document.querySelector('.clip[data-i="5"]').offsetWidth, next: document.querySelector('.clip[data-i="6"]').offsetLeft}));
  check('往右拖 80 点多 2 秒，片段变宽，后面的挪开', after.row > 0 && Math.abs(after.w - before.w - 80) <= 6 && after.next - before.next > 70, JSON.stringify({before, after}));
  await snap(page, '网页_拖长之后');
  // 撤销和重做
  await page.locator('#kUndo').click();
  await page.waitForTimeout(150);
  check('撤销回去', (await page.evaluate(() => DMApp.rows[5].dur)) === undefined);
  await page.locator('#kRedo').click();
  await page.waitForTimeout(150);
  check('重做回来', Math.abs((await page.evaluate(() => DMApp.rows[5].dur)) - after.row) < 0.01);
  // 往左拖缩短
  await dragTrim(page, 5, -40);
  const shorter = await page.evaluate(() => DMApp.rows[5].dur);
  check('往左拖缩短', shorter < after.row - 0.8, String(shorter));
  // 改的时长刷新后还在
  await page.reload();
  await page.waitForFunction(() => window.DMApp && window.DMApp.ready, null, {timeout: 120000});
  check('时长存下来了，刷新还在', Math.abs((await page.evaluate(() => DMApp.rows[5].dur)) - shorter) < 0.01);
  // 双击恢复自动
  await page.evaluate(() => DMApp.select(5));
  await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('.clip[data-i="5"]').scrollIntoView({inline: 'center', block: 'nearest'}));
  await page.waitForTimeout(200);
  await page.locator('.clip[data-i="5"] .trim').dblclick();
  await page.waitForTimeout(150);
  check('双击边缘恢复自动', (await page.evaluate(() => DMApp.rows[5].dur)) === undefined);

  // 点胶囊换效果，有预览
  await page.evaluate(() => document.querySelector('.clip[data-i="5"]').scrollIntoView({inline: 'center', block: 'nearest'}));
  await page.waitForTimeout(150);
  const tpl0 = await page.evaluate(() => DMApp.rows[5].tpl);
  await page.locator('.clip[data-i="5"] .cap').click();
  await page.waitForFunction(() => !document.getElementById('picker').hidden, null, {timeout: 3000});
  const cats = await page.evaluate(() => [...document.querySelectorAll('#pkCats button')].map((b) => b.textContent));
  check('分类没有删掉的和出镜', !['图形', '转场', '镜头', '光影', '界面', '网页', '出镜'].some((c) => cats.includes(c)), cats.join(' '));
  await page.waitForTimeout(500);
  const px = () => page.evaluate(() => {
    const c = document.getElementById('pkCanvas');
    return Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data).filter((_, i) => i % 97 === 0).join();
  });
  await page.locator('#pkCats button', {hasText: '状态'}).click();
  await page.waitForTimeout(200);
  const tile = page.locator('.tile').filter({hasText: '进度环'});
  await tile.hover();
  await page.waitForTimeout(500);
  const a = await px();
  await page.waitForTimeout(600);
  const b = await px();
  check('指到哪个，预览就在动', a !== b);
  check('预览显示名字', (await page.locator('#pkInfo b').textContent()) === '进度环');
  await snap(page, '网页_换效果');
  await tile.click();
  await page.waitForTimeout(200);
  check('点一下换到画面上，弹窗不关', (await page.evaluate(() => DMApp.rows[5].tpl)) === 'kxs_ring' && !(await page.evaluate(() => document.getElementById('picker').hidden)));
  check('时间线胶囊跟着变', (await page.locator('.clip[data-i="5"] .cap').getAttribute('title')) === '进度环');
  // 搜索
  await page.locator('#pkFind').fill('极光');
  await page.waitForTimeout(150);
  check('能搜到', (await page.locator('.tile').filter({hasText: '极光渐变'}).count()) === 1);
  await page.keyboard.press('Escape');
  check('Esc 收起', await page.evaluate(() => document.getElementById('picker').hidden));
  await page.locator('#kUndo').click();
  await page.waitForTimeout(150);
  check('换效果能撤销', (await page.evaluate(() => DMApp.rows[5].tpl)) === tpl0);

  // 三页
  await page.locator('.seg button[data-p="table"]').click();
  await page.waitForTimeout(200);
  check('分镜表每镜一行', (await page.locator('.row').count()) === count.rows);
  await snap(page, '网页_分镜表');
  await page.locator('.row[data-i="2"] .pick').check();
  check('勾选后能批量', (await page.locator('#pickGo').isEnabled()));
  await page.locator('#pickGo').click();
  check('批量导出面板', await page.locator('#bScope').isVisible());
  await snap(page, '网页_批量导出');
  await page.locator('#bClose').click();
  await page.locator('.seg button[data-p="script"]').click();
  await page.waitForTimeout(100);
  await page.locator('#pText').fill('我们询问了5000位朋友，其中有86%的朋友说：喝。');
  await page.locator('#pGo').click();
  await page.waitForTimeout(150);
  await snap(page, '网页_文稿');
  const n0 = await page.evaluate(() => DMApp.rows.length);
  await page.locator('[data-add]').first().click();
  await page.waitForTimeout(300);
  check('贴文案加进分镜，回到画面', (await page.evaluate(() => DMApp.rows.length)) === n0 + 1 && (await page.locator('#p-stage').isVisible()));
  // 这一镜
  await page.locator('#btnInspector').click();
  await page.waitForTimeout(200);
  check('这一镜能开', await page.locator('#inspector').isVisible());
  await page.locator('#dur').fill('6.5');
  await page.locator('#dur').press('Tab');
  await page.waitForTimeout(200);
  check('这一镜里能填秒数', (await page.evaluate(() => DMApp.rows[DMApp.rows.length - 1].dur)) === 6.5);
  await snap(page, '网页_这一镜');
  // 真的导出一条：手动时长要算数
  await page.locator('#xSize').selectOption('1080p');
  await page.locator('#xFps').selectOption('30');
  const [download] = await Promise.all([page.waitForEvent('download', {timeout: 90000}), page.locator('#xGo').click()]);
  const saved = await download.path();
  const size = fs.statSync(saved).size;
  const name = download.suggestedFilename();
  await page.waitForFunction(() => /已输出/.test(document.getElementById('result').textContent), null, {timeout: 60000});
  const result = await page.locator('#result').textContent();
  check('导出一条 MP4，时长是手动定的 6.5 秒', size > 10000 && name.endsWith('.mp4') && /6\.5 秒/.test(result), `${name} ${(size / 1e6).toFixed(2)} MB ${result.slice(0, 40)}`);
  // 筛选和字体
  await page.locator('#filter').selectOption('数据动效');
  await page.waitForTimeout(200);
  check('筛选后时间线只剩这一类', (await page.locator('.clip').count()) === (await page.evaluate(() => DMApp.rows.filter((r) => r.cat === '数据动效').length)));
  await page.locator('#filter').selectOption('all');
  await page.locator('#btnFont').click();
  await page.waitForTimeout(300);
  check('字体面板', await page.locator('#fontBox').isVisible());
  await page.locator('#fClose').click();
  check('页面没有报错', page.errs.length === 0, page.errs.slice(0, 3).join(' | '));
  // 窄屏不撑破
  await page.setViewportSize({width: 390, height: 844});
  await page.waitForTimeout(300);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check('手机宽度不横向溢出', over <= 0, String(over));
  await snap(page, '网页_手机');
  await ctx.close();
}

// ---------- 服务器版：真的服务端，两个人 ----------
{
  const hosted = path.join(here, '../dist/hosted');
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-'));
  const API_PORT = 18096;
  const srv = spawn('node', [path.join(here, '../server/server.js')], {env: Object.assign({}, process.env, {PORT: String(API_PORT), DATA_DIR: data}), stdio: 'ignore'});
  await new Promise((r) => setTimeout(r, 500));
  const types = {'.html': 'text/html; charset=utf-8', '.woff2': 'font/woff2', '.txt': 'text/plain'};
  const web = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname.startsWith('/motion/api')) {
      const up = http.request({host: '127.0.0.1', port: API_PORT, path: req.url, method: req.method, headers: req.headers}, (r) => {
        res.writeHead(r.statusCode, r.headers);
        r.pipe(res);
      });
      up.on('error', () => res.writeHead(502).end());
      req.pipe(up);
      return;
    }
    const f = path.join(hosted, u.pathname === '/motion/' ? 'index.html' : decodeURI(u.pathname.replace('/motion/', '')));
    if (!fs.existsSync(f)) return res.writeHead(404).end();
    res.writeHead(200, {'Content-Type': types[path.extname(f)] || 'application/octet-stream'});
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => web.listen(18097, '127.0.0.1', r));
  const url = 'http://127.0.0.1:18097/motion/';
  try {
    const a = await open(await browser.newContext({viewport: {width: 1480, height: 900}}), url);
    const b = await open(await browser.newContext({viewport: {width: 1480, height: 900}}), url);
    check('服务器版连上了', await a.evaluate(() => DMApp.sync.online));
    await a.evaluate(() => DMApp.select(5));
    await a.waitForTimeout(400);
    await dragTrim(a, 5, 80);
    await a.waitForTimeout(900);
    const dur = await a.evaluate(() => DMApp.rows[5].dur);
    check('甲拖时长，存上服务器', dur > 0 && (await a.locator('#sync').textContent()) === '已同步', String(dur));
    await b.evaluate(() => DMApp.poll());
    await b.waitForTimeout(400);
    check('乙看到时长', (await b.evaluate(() => DMApp.rows[5].dur)) === dur);
    check('乙的时间线跟着变宽', (await b.locator('.clip[data-i="5"]').evaluate((el) => el.offsetWidth)) === (await a.locator('.clip[data-i="5"]').evaluate((el) => el.offsetWidth)));
    await a.locator('.clip[data-i="5"] .cap').click();
    await a.waitForFunction(() => !document.getElementById('picker').hidden);
    await a.locator('#pkCats button', {hasText: '文字特效'}).click();
    await a.locator('.tile').filter({hasText: '极光渐变'}).click();
    await a.waitForTimeout(700);
    await a.keyboard.press('Escape');
    await b.evaluate(() => DMApp.poll());
    await b.waitForTimeout(400);
    check('乙看到换的效果', (await b.evaluate(() => DMApp.rows[5].tpl)) === 'cot01');
    check('乙的胶囊也变了', (await b.locator('.clip[data-i="5"] .cap').getAttribute('title')) === '极光渐变');
    await b.reload();
    await b.waitForFunction(() => window.DMApp && window.DMApp.ready, null, {timeout: 60000});
    check('刷新后还在', (await b.evaluate(() => DMApp.rows[5].tpl)) === 'cot01');
    check('服务器版页面没有报错', a.errs.length === 0 && b.errs.length === 0, a.errs.concat(b.errs).slice(0, 3).join(' | '));
  } finally {
    web.close();
    srv.kill();
    fs.rmSync(data, {recursive: true, force: true});
  }
}
await browser.close();
console.log(fails.length ? `网页版：${fails.length} 处失败` : '网页版：全部通过');
process.exit(fails.length ? 1 : 0);
