#!/usr/bin/env node
// 命令行出片：和界面用同一个引擎。
//   node generate.mjs --spec shot.json --out out.mp4 [--size 4k|1080p] [--fps 60|30]
//   node generate.mjs --copy "一段文案" --template dots --out out.mp4
//   node generate.mjs --row 25 --template dots --out out.mp4     分镜表第 25 镜
//   node generate.mjs --row 25 --stills 0.5,3,8 --out dir/       只抽帧看
//   node generate.mjs --check                                    把全部镜头和模板画一遍，报错的列出来
//   node generate.mjs --sheet dir/                               每镜抽三帧，出联系表素材
//   node generate.mjs --batch dir/ [--ch 第一章] [--size 4k]       批量输出，写输出清单
//   加 --fonts cn=a.ttf,num=b.otf,title=c.ttf 可替换字体，以上用法都生效
import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const k = argv[i];
  if (!k.startsWith('--')) continue;
  const next = argv[i + 1];
  if (next === undefined || next.startsWith('--')) args[k.slice(2)] = true;
  else {
    args[k.slice(2)] = next;
    i++;
  }
}
const candidates = [args.tool, path.join(here, '../assets/肉呆爱动效.html'), path.join(here, '../dist/肉呆爱动效.html')].filter(Boolean);
const tool = candidates.find((p) => fs.existsSync(p));
if (!tool) throw new Error('找不到 肉呆爱动效.html');

const browser = await chromium.launch({channel: 'chrome', headless: true});
const context = await browser.newContext({viewport: {width: 1400, height: 860}, acceptDownloads: true, deviceScaleFactor: 1});
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
await page.goto(pathToFileURL(tool).href);
await page.waitForFunction(() => window.DMApp && window.DMApp.ready, null, {timeout: 60000});

if (args.fonts) {
  for (const pair of String(args.fonts).split(',')) {
    const [slot, file] = pair.split('=');
    const data = fs.readFileSync(file).toString('base64');
    await page.evaluate(async ({slot, data}) => {
      const bin = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      await DM.setFont(slot, bin.buffer);
    }, {slot, data});
  }
}

const buildSpec = async () => {
  if (args.spec) return JSON.parse(fs.readFileSync(args.spec, 'utf8'));
  if (args.copy) {
    return page.evaluate(({copy, template}) => {
      const parsed = DMParser.parseCopy(copy);
      const row = {line: parsed.text, groups: parsed.groups, tpl: template || 'comb'};
      const ranked = DM.rankTemplates(row, null);
      return {line: parsed.text, groups: parsed.groups, tpl: template || ranked[0].id, template: template || ranked[0].id, explain: parsed.explain, ranked: ranked.slice(0, 5).map((t) => [t.id, t.why])};
    }, {copy: args.copy, template: args.template});
  }
  if (args.row) {
    return page.evaluate(({id, template}) => {
      const r = window.DMApp.rows.find((x) => x.id === id);
      return Object.assign({}, r, {template: template || r.tpl, tpl: template || r.tpl});
    }, {id: +args.row, template: args.template});
  }
  throw new Error('需要 --spec、--copy 或 --row');
};

if (args.check) {
  const report = await page.evaluate(async () => {
    const out = [];
    const c = document.createElement('canvas');
    c.width = 480;
    c.height = 270;
    const ctx = c.getContext('2d');
    for (const r of window.DMApp.rows) {
      const list = DM.rankTemplates(r, null).map((t) => t.id);
      if (!list.includes(r.tpl) && r.tpl !== 'aroll') out.push({row: r.no, tpl: r.tpl, err: '默认模板不在可选列表里'});
      for (const id of new Set([r.tpl, ...list])) {
        try {
          const s = DM.createScene(Object.assign({}, r, {template: id, tpl: id}), 480);
          if (!Number.isFinite(s.duration) || s.duration <= 0) throw new Error(`时长不对 ${s.duration}`);
          for (const f of [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1]) s.draw(ctx, f * s.duration);
          for (const f of [0.1, 0.5, 1]) s.draw(ctx, f * s.duration);
        } catch (e) {
          const pendingRow = r.pending && /大于 0/.test(e.message);
          const limit = /最多放/.test(e.message);
          if (!pendingRow && !limit) out.push({row: r.no, tpl: id, err: e.message});
        }
      }
    }
    return out;
  });
  console.log(JSON.stringify({checked: await page.evaluate(() => window.DMApp.rows.length), errors: report, pageErrors}, null, 1));
  await browser.close();
  process.exit(report.length || pageErrors.length ? 1 : 0);
}

if (args.sheet) {
  fs.mkdirSync(args.sheet, {recursive: true});
  const only = args.only ? String(args.only).split(',').map(Number) : null;
  const rows = await page.evaluate((only) => window.DMApp.rows.filter((r) => r.tpl !== 'aroll' && !r.pending && (!only || only.includes(r.id))).map((r) => r.id), only);
  for (const id of rows) {
    const data = await page.evaluate((id) => {
      const r = window.DMApp.rows.find((x) => x.id === id);
      const s = DM.createScene(Object.assign({}, r, {template: r.tpl}), 640);
      const c = document.createElement('canvas');
      c.width = 640;
      c.height = 360;
      const ctx = c.getContext('2d', {alpha: false});
      return [0.35, 0.65, 0.985].map((f) => {
        s.draw(ctx, f * s.duration);
        return c.toDataURL('image/jpeg', 0.82);
      });
    }, id);
    data.forEach((d, i) => fs.writeFileSync(path.join(args.sheet, `r${String(id).padStart(3, '0')}_${i}.jpg`), Buffer.from(d.split(',')[1], 'base64')));
  }
  console.log('sheet', rows.length, pageErrors);
  await browser.close();
  process.exit(0);
}

if (args.batch) {
  fs.mkdirSync(args.batch, {recursive: true});
  const size = args.size || '4k';
  const fps = +(args.fps || 60);
  const list = await page.evaluate((ch) => window.DMApp.rows.filter((r) => r.tpl !== 'aroll' && !DM.TEMPLATES[r.tpl].noExport && (!ch || r.ch === ch)).map((r) => ({id: r.id, no: r.no, name: DM.TEMPLATES[r.tpl].name})), args.ch || null);
  const report = [];
  for (const item of list) {
    const file = path.join(args.batch, `镜${item.no}_${item.name}_${size}${fps}.mp4`);
    if (fs.existsSync(file) && fs.statSync(file).size > 1000) {
      report.push({no: item.no, status: '已有'});
      continue;
    }
    try {
      const download = page.waitForEvent('download', {timeout: 600000});
      const r = await page.evaluate(async ({id, size, fps}) => {
        const row = window.DMApp.rows.find((x) => x.id === id);
        const raw = window.DMApp.rawOf(row);
        if (!DM.TEMPLATES[raw.template].custom) {
          const v = DM.validate(raw);
          if (v.errors.length) throw new Error(v.errors.join('；'));
        }
        const out = await DM.exportMP4(raw, {size, fps});
        const check = await DM.verifyMP4(out.blob, raw);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(out.blob);
        a.download = 'out.mp4';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 30000);
        return {duration: out.duration, size: out.blob.size, ok: check.ok, rows: check.rows.length};
      }, {id: item.id, size, fps});
      await (await download).saveAs(file);
      report.push(Object.assign({no: item.no, tpl: item.name, status: '完成'}, r));
    } catch (e) {
      report.push({no: item.no, tpl: item.name, status: '失败', error: String(e.message).split('\n')[0].slice(0, 120)});
    }
    console.log(JSON.stringify(report[report.length - 1]));
  }
  const done = report.filter((r) => r.status === '完成');
  console.log(JSON.stringify({total: list.length, done: done.length, had: report.filter((r) => r.status === '已有').length, failed: report.filter((r) => r.status === '失败'), notOk: done.filter((r) => !r.ok).map((r) => r.no), dataChecked: done.filter((r) => r.rows).length, sizeMB: Math.round(done.reduce((a, r) => a + r.size, 0) / 1e6), pageErrors}));
  await browser.close();
  process.exit(report.some((r) => r.status === '失败') ? 2 : 0);
}

const spec = await buildSpec();
if (spec.explain && spec.explain.length) console.log('理解：', spec.explain.join(' / '));
if (spec.ranked) console.log('推荐：', spec.ranked.map((r) => r[0]).join(' > '));

if (args.stills) {
  fs.mkdirSync(args.out, {recursive: true});
  const times = String(args.stills).split(',').map(Number);
  const w = args.size === '4k' ? 3840 : 1920;
  const shots = await page.evaluate(({spec, times, w}) => {
    const s = DM.createScene(spec, w);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = (w * 9) / 16;
    const ctx = c.getContext('2d', {alpha: false});
    return {duration: s.duration, frames: times.map((t) => {
      s.draw(ctx, t < 0 ? s.duration + t : t);
      return c.toDataURL('image/jpeg', 0.9);
    })};
  }, {spec, times, w});
  shots.frames.forEach((d, i) => fs.writeFileSync(path.join(args.out, `t${times[i]}.jpg`), Buffer.from(d.split(',')[1], 'base64')));
  console.log(JSON.stringify({duration: shots.duration, stills: times.length, pageErrors}));
  await browser.close();
  process.exit(0);
}

const download = page.waitForEvent('download', {timeout: 600000});
const report = await page.evaluate(async ({spec, size, fps}) => {
  const out = await DM.exportMP4(spec, {size, fps});
  const check = await DM.verifyMP4(out.blob, spec);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(out.blob);
  a.download = 'out.mp4';
  document.body.appendChild(a);
  a.click();
  return {duration: out.duration, frames: out.frames, size: out.blob.size, width: out.width, height: out.height, check};
}, {spec, size: args.size || '4k', fps: +(args.fps || 60)});
const dl = await download;
fs.mkdirSync(path.dirname(path.resolve(args.out)), {recursive: true});
await dl.saveAs(args.out);
console.log(JSON.stringify(Object.assign({out: args.out, pageErrors}, report), null, 1));
await browser.close();
process.exit(report.check.ok && !pageErrors.length ? 0 : 2);
