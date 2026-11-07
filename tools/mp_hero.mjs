// 算每个命名动效「停在哪一帧最好看」：内容铺得最满的时刻。结果写到 vendor/motion-prompt/hero.json，由 import_motion_prompt.py 打包。
//   node tools/mp_hero.mjs    （先跑过 tools/build.py）
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../scripts/'));
const {chromium} = require('playwright-core');
const browser = await chromium.launch({channel: 'chrome', headless: true});
const page = await (await browser.newContext()).newPage();
await page.goto('file://' + encodeURI(path.join(here, '../dist/肉呆爱动效.html')));
await page.waitForFunction(() => window.DMApp && window.DMApp.ready, null, {timeout: 120000});
const hero = await page.evaluate(() => {
  const MP = window.DMMotionPrompt;
  const out = {};
  MP.catalog.forEach((el) => {
    const cell = MP.get(el.pack).cells[+el.no - 1];
    const c = document.createElement('canvas');
    c.width = el.width;
    c.height = el.height;
    const g = c.getContext('2d', {willReadFrequently: true});
    const steps = 32;
    const scores = [];
    for (let i = 0; i < steps; i++) {
      const u = (i / steps) * el.cycle;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, el.width, el.height);
      g.save();
      cell(g, el.width, el.height, u);
      g.restore();
      const d = g.getImageData(0, 0, el.width, el.height).data;
      const bg = [d[el.height / 2 * el.width * 4 | 0], d[(el.height / 2 * el.width * 4 | 0) + 1], d[(el.height / 2 * el.width * 4 | 0) + 2]];
      const seen = new Set();
      let n = 0;
      for (let p = 0; p < d.length; p += 4 * 3) {
        if (Math.abs(d[p] - bg[0]) + Math.abs(d[p + 1] - bg[1]) + Math.abs(d[p + 2] - bg[2]) > 24) n++;
        seen.add((d[p] >> 4) << 8 | (d[p + 1] >> 4) << 4 | d[p + 2] >> 4);
      }
      scores.push({u, score: n + seen.size * 40});
    }
    // 铺得最满，分数接近时取靠后的（动作已经落定）
    const max = Math.max(...scores.map((s) => s.score));
    const near = scores.filter((s) => s.score >= max * 0.96 && s.u >= el.cycle * 0.15);
    const pick = near.length ? near[near.length - 1] : scores.find((s) => s.score === max);
    out[el.id] = +pick.u.toFixed(2);
  });
  return out;
});
// 算法看不出来的：打字机要停在打完字的时候
Object.assign(hero, {'006': 2.6});
await browser.close();
fs.writeFileSync(path.join(here, '../vendor/motion-prompt/hero.json'), JSON.stringify(hero));
console.log(Object.keys(hero).length, '个停帧');
