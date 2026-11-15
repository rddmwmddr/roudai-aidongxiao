// Real local image import and two synchronized video samplers, including paused reverse seek.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
const require = createRequire(
    new URL("../scripts/package.json", import.meta.url),
  ),
  { chromium } = require("playwright-core");
const root = path.resolve(import.meta.dirname, ".."),
  out = path.join(root, "质检/opus"),
  assets = path.join(root, "examples/opus/assets");
fs.mkdirSync(assets, { recursive: true });
execFileSync("ffmpeg", [
  "-v",
  "error",
  "-y",
  "-f",
  "lavfi",
  "-i",
  "testsrc2=size=320x180:rate=30:duration=5",
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
  path.join(out, "video-source.mp4"),
]);
execFileSync("ffmpeg", [
  "-v",
  "error",
  "-y",
  "-i",
  path.join(out, "video-source.mp4"),
  "-vf",
  "hflip",
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
  path.join(out, "video-source-right.mp4"),
]);
const uri2 =
  "data:video/mp4;base64," +
  fs.readFileSync(path.join(out, "video-source-right.mp4")).toString("base64");
const b = await chromium.launch({ channel: "chrome", headless: true });
try {
  const p = await b.newPage();
  await p.goto(pathToFileURL(path.join(root, "mac/Resources/stage.html")).href);
  await p.waitForFunction(() => window.__dmReady);
  const images = await p.evaluate(() =>
    ["升级前：三步找到设置", "升级后：一步打开功能"].map((label, i) => {
      const cv = document.createElement("canvas");
      cv.width = 640;
      cv.height = 400;
      const g = cv.getContext("2d");
      g.fillStyle = "#F7F1E8";
      g.fillRect(0, 0, 640, 400);
      g.fillStyle = i ? "#227F77" : "#5A7DBC";
      g.font = "30px DMGothic";
      g.fillText(label, 40, 65);
      for (let j = 0; j < (i ? 1 : 3); j++) {
        g.fillStyle = i ? "#227F77" : "#5A7DBC";
        g.beginPath();
        g.roundRect(40 + j * 190, 130, 165, 150, 18);
        g.fill();
        g.fillStyle = "#FFFFFF";
        g.font = "28px DMGothic";
        g.fillText(i ? "常用功能" : `第${j + 1}步`, 60 + j * 190, 210);
      }
      return cv.toDataURL();
    }),
  );
  for (let i = 0; i < 2; i++)
    fs.writeFileSync(
      path.join(assets, `${i ? "after" : "before"}.png`),
      Buffer.from(images[i].split(",")[1], "base64"),
    );
  const uri =
    "data:video/mp4;base64," +
    fs.readFileSync(path.join(out, "video-source.mp4")).toString("base64");
  const result = await p.evaluate(
    async ({ uri, uri2, images }) => {
      const c = DMOpus.defaults("split-compare");
      c.data.left = {
        label: "视频甲",
        desc: "统一播放起点0.4秒",
        src: uri,
        kind: "video",
      };
      c.data.right = {
        label: "视频乙",
        desc: "统一播放起点0.4秒",
        src: uri2,
        kind: "video",
      };
      c.options.syncStart = 0.4;
      c.timeline.duration = 3;
      c.timeline.entrance = 0.1;
      c.timeline.hold = 0.3;
      const raw = { ...DMOpus.row(c), template: c.templateId };
      await DM.Opus.prepareAssets(raw);
      const cv = document.createElement("canvas");
      cv.width = 1920;
      cv.height = 1080;
      const g = cv.getContext("2d", { alpha: false }),
        scene = DM.createScene(raw);
      await DM.Opus.prepareFrame(raw, 1.2);
      scene.draw(g, 1.2);
      const A = cv.toDataURL();
      await DM.Opus.prepareFrame(raw, 0.1);
      scene.draw(g, 0.1);
      const B = cv.toDataURL();
      await DM.Opus.prepareFrame(raw, 1.2);
      scene.draw(g, 1.2);
      const C = cv.toDataURL();
      if (A !== C || A === B) throw new Error("反向定位后视频帧不一致");
      await DMBridge.load(JSON.stringify(raw), false);
      DMBridge.seek(1.2);
      await DM.Opus.prepareFrame(raw, 1.2);
      const exported = await DM.exportMP4(raw);
      const video = await new Promise((ok) => {
        const r = new FileReader();
        r.onload = () => ok(r.result);
        r.readAsDataURL(exported.blob);
      });
      const imageConfig = DMOpus.defaults("split-compare");
      imageConfig.data.left.src = images[0];
      imageConfig.data.right.src = images[1];
      const row = DMOpus.row(imageConfig);
      await DMBridge.load(JSON.stringify(row), false);
      DMBridge.seek(1);
      await DM.Opus.prepareFrame({ ...row, template: row.tpl }, 1);
      const preview = DMBridge.thumb("split-compare");
      const same = { ...raw, motion: JSON.parse(JSON.stringify(c)) };
      same.motion.data.right.src = uri;
      await DM.Opus.prepareAssets(same);
      await DM.Opus.prepareFrame(same, 1);
      return { video, A, config: c, passed: true };
    },
    { uri, uri2, images },
  );
  fs.writeFileSync(
    path.join(out, "双视频同步验收.mp4"),
    Buffer.from(result.video.split(",")[1], "base64"),
  );
  fs.writeFileSync(
    path.join(out, "双视频同步预览.png"),
    Buffer.from(result.A.split(",")[1], "base64"),
  );
  fs.writeFileSync(
    path.join(out, "双视频同步配置.json"),
    JSON.stringify(result.config, null, 2),
  );
  console.log(
    "PASS local PNGs, dual video sync, paused reverse seek and actual video export",
  );
} finally {
  await b.close();
}
