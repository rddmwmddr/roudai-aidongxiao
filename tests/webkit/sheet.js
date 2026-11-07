// App 用的是 WKWebView。CSS 动效在 Chrome 和 WebKit 里行为不同（过渡、@property），这里在 WebKit 里全画一遍。
// 返回 errs、blank 和每类一张样张 *.jpg。
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 600 && !(window.DM && window.DMBridge && window.DM.kineticsCount); i++) await wait(100);
const D = window.DM;
if (!D) return {error: 'DM 没加载'};
const report = {ua: navigator.userAgent, total: String(Object.keys(D.TEMPLATES).length)};
await (document.fonts && document.fonts.ready);
const cats = ['texfx', 'loader', 'button', 'toggle', 'kxi', 'kxs', 'kxm'];
const errs = [];
const blank = [];
for (const cat of cats) {
  const tpls = Object.values(D.TEMPLATES).filter((t) => t.cat === cat);
  const cols = cat === 'texfx' ? 11 : 9;
  const w = 234;
  const h = 132;
  const rows = Math.ceil(tpls.length / cols);
  const sheet = document.createElement('canvas');
  sheet.width = cols * (w + 6);
  sheet.height = rows * (h + 22);
  const g = sheet.getContext('2d');
  g.fillStyle = '#222';
  g.fillRect(0, 0, sheet.width, sheet.height);
  const cv = document.createElement('canvas');
  cv.width = w * 2;
  cv.height = h * 2;
  const cg = cv.getContext('2d', {willReadFrequently: true});
  for (let i = 0; i < tpls.length; i++) {
    const t = tpls[i];
    const x = (i % cols) * (w + 6);
    const y = Math.floor(i / cols) * (h + 22);
    try {
      const row = Object.assign({id: 1, no: '001', line: '', tpl: t.id, template: t.id}, D.sampleOf(t.id));
      const scene = D.createScene(row, cv.width);
      const time = D.thumbTime ? D.thumbTime(t.id, scene) : scene.duration - 0.05;
      scene.draw(cg, time);
      const data = cg.getImageData(0, 0, cv.width, cv.height).data;
      const seen = new Set();
      for (let p = 0; p < data.length; p += 4 * 41) seen.add((data[p] >> 3) << 10 | (data[p + 1] >> 3) << 5 | data[p + 2] >> 3);
      if (seen.size < 3) blank.push(t.id);
      g.drawImage(cv, x, y, w, h);
    } catch (e) {
      errs.push(`${t.id}: ${e.message}`);
      g.fillStyle = '#a00';
      g.fillRect(x, y, w, h);
    }
    g.fillStyle = '#ddd';
    g.font = '13px "PingFang SC"';
    g.fillText(`${t.id} ${t.name}`.slice(0, 22), x + 3, y + h + 15);
    if (i % 12 === 11) await wait(0);
  }
  report[`${cat}.jpg`] = sheet.toDataURL('image/jpeg', 0.8);
}
report.errs = JSON.stringify(errs);
report.blank = JSON.stringify(blank);
return report;
