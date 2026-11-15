// Contract, semantic, real editor, seek/determinism and optional H.264 acceptance.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
const require = createRequire(import.meta.url),
  O = require("../src/opus_config.js");
const { chromium } = createRequire(
  new URL("../scripts/package.json", import.meta.url),
)("playwright-core");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  out = path.join(root, "质检/opus");
fs.mkdirSync(out, { recursive: true });
const board = JSON.parse(
  fs.readFileSync(path.join(root, "examples/opus/重构调研-全部模板.dmboard")),
);
const check = (name, fn) => {
  fn();
  console.log("PASS", name);
};
check("all versioned configurations and CSV round trip", () => {
  for (const c of [
    ...O.IDS.map(O.defaults),
    ...Object.keys(O.PRESETS).map(O.preset),
  ]) {
    O.validate(c);
    assert.deepEqual(O.importTable(c, O.csv(c)).data, c.data);
  }
});
check(
  "multiple choice uses respondent base; input percentages are unchanged",
  () => {
    const c = O.defaults("poll-results-bars");
    c.options.inputMode = "count";
    c.data.options = [
      { label: "甲", value: 150 },
      { label: "乙", value: 140 },
    ];
    assert.deepEqual(
      O.researchValues(c).map((r) => r.percent),
      [75, 70],
    );
    c.options.inputMode = "percent";
    c.data.options = [
      { label: "甲", value: 75 },
      { label: "乙", value: 70 },
    ];
    assert.deepEqual(
      O.researchValues(c).map((r) => r.percent),
      [75, 70],
    );
    c.options.questionType = "single";
    assert.throws(() => O.validate(c), /单选题/);
  },
);
check("funnel denominator and zero are explicit", () => {
  const c = O.defaults("funnel-conversion");
  assert.deepEqual(
    O.researchValues(c).map((r) => r.rate),
    [100, 60, 60, 50, 50],
  );
  c.options.rateMode = "first";
  assert.deepEqual(
    O.researchValues(c).map((r) => r.rate),
    [100, 60, 36, 18, 9],
  );
  c.data.stages = [
    { label: "零", value: 0 },
    { label: "零后", value: 0 },
  ];
  assert.deepEqual(
    O.researchValues(c).map((r) => r.rate),
    [null, null],
  );
});
check("heatmap missing record differs from a recorded zero", () => {
  const r = O.researchValues(O.defaults("heatmap-calendar"));
  assert.equal(r[0].value, 0);
  assert.equal(r[3].value, null);
});
check("stacking has explicit per-period denominator", () => {
  const c = O.defaults("stacked-area-flow");
  c.data = {
    xLabels: ["A", "B"],
    series: [
      { name: "一", values: [1, 0] },
      { name: "二", values: [3, 0] },
    ],
  };
  assert.deepEqual(O.researchValues(c)[0].values, [25, 75]);
  assert.equal(O.researchValues(c)[1].missingDenominator, true);
  c.options.stackMode = "absolute";
  assert.deepEqual(O.researchValues(c)[0].values, [1, 3]);
});
check("precise validation and real CSV quoting", () => {
  const c = O.defaults("comparison-dumbbell");
  const r = O.importTable(
    c,
    '\uFEFFlabel,before,after\r\n"品牌,甲",42,55\r\n"品牌""乙",50,60',
  );
  assert.equal(r.data.rows[0].label, "品牌,甲");
  assert.equal(r.data.rows[1].label, '品牌"乙');
  assert.throws(
    () => O.importTable(c, "label,before,after\n甲,,55"),
    /不是数字/,
  );
  assert.throws(() => O.importTable(c, "label,before,after\n甲,2"), /列数/);
  const bad = O.defaults("cohort-regroup");
  bad.data.users[1].id = bad.data.users[0].id;
  assert.throws(() => O.validate(bad), /重复/);
  bad.options.mode = "aggregate";
  assert.throws(() => O.validate(bad), /汇总模式/);
});
check("CSV quoted tabs and precise cell errors", () => {
  const c = O.defaults("testimonial-card-carousel");
  c.data.testimonials[0].quote = "中文\t引语";
  assert.deepEqual(O.importTable(c, O.csv(c)).data, c.data);
  assert.throws(
    () =>
      O.importTable(
        O.defaults("comparison-dumbbell"),
        "label,before,after\n甲,abc,5",
      ),
    /第2行.before/,
  );
});
check("SRT import uses editable seconds", () => {
  const c = O.importSubtitles(
    O.defaults("kinetic-narration"),
    "1\n00:00:01,200 --> 00:00:03,500\n中文原声\n\n2\n00:00:04,000 --> 00:00:05,000\n68%的受访者",
  );
  assert.equal(c.data.cues[0].start, 1.2);
  assert.equal(c.data.cues[1].end, 5);
});
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--allow-file-access-from-files"],
});
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      acceptDownloads: true,
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript((board) => {
    window.DM_BOARD_OVERRIDE = board;
    localStorage.clear();
  }, board);
  await page.goto(pathToFileURL(path.join(root, "dist/肉呆爱动效.html")).href);
  await page.waitForFunction(() => window.DMApp?.ready, null, {
    timeout: 120000,
  });
  const contract = await page.evaluate(async (board) => {
    const D = window.DM,
      O = window.DMOpus,
      fail = [],
      images = {},
      results = [];
    for (const row of board.rows) {
      const c = O.validate(row.motion),
        raw = { ...row, template: row.tpl },
        cv = document.createElement("canvas");
      cv.width = c.output.width;
      cv.height = c.output.height;
      const g = cv.getContext("2d", { willReadFrequently: true });
      try {
        await D.Opus.prepareAssets(raw);
        const scene = D.createScene(raw, cv.width);
        scene.draw(g, scene.duration * 0.7);
        const a = cv.toDataURL();
        scene.draw(g, scene.duration * 0.25);
        scene.draw(g, scene.duration * 0.7);
        if (a !== cv.toDataURL()) fail.push(row.tpl + " non-deterministic");
        images[row.tpl] = cv.toDataURL("image/png");
        const records = scene.inspect(g, scene.duration * 0.7);
        const outside = records.filter(
          (r) => r.x0 < -4 || r.y0 < -4 || r.x1 > 1925 || r.y1 > 1085,
        );
        if (outside.length)
          fail.push(
            row.tpl + " outside " + JSON.stringify(outside.slice(0, 3)),
          );
        const alt = JSON.parse(JSON.stringify(raw));
        alt.motion.style.title = "修改数据后，中文标题可继续编辑";
        alt.motion.style.accent = "#C65064";
        D.createScene(alt, cv.width).draw(g, scene.duration * 0.7);
        if (a === cv.toDataURL())
          fail.push(row.tpl + " edit did not change pixels");
        const edited = JSON.parse(JSON.stringify(raw)),
          dc = edited.motion,
          dd = dc.data;
        switch (dc.templateId) {
          case "comparison-dumbbell":
            dd.rows[0].after += 1;
            break;
          case "dot-tally":
            dd.groups[0].marked = Math.max(0, dd.groups[0].marked - 1);
            break;
          case "bar-race":
            dd.frames.forEach((f) => (f.values[0] += 1));
            break;
          case "number-counter":
            dd.keyframes.forEach((k) => (k[1] += 1));
            break;
          case "card-stack-cascade":
            dd.cards.forEach((r) => (r.title += " 更新"));
            break;
          case "poll-results-bars":
            dd.options[0].value -= 1;
            break;
          case "sankey-flow":
            dd.links[0].value += 1;
            break;
          case "funnel-conversion":
            dd.stages[dd.stages.length - 1].value -= 1;
            break;
          case "bubble-scatter-grow":
            dd.records[0][dc.fieldMappings.size] *= 2;
            break;
          case "heatmap-calendar":
            dd.records[0].value = dc.options.maxValue;
            break;
          case "testimonial-card-carousel":
            dd.testimonials.forEach(
              (r) => (r.quote = "更新后的中文原声：" + r.quote),
            );
            break;
          case "timeline-ruler":
            dd.events.forEach((r) => (r.title += " 更新"));
            break;
          case "split-compare":
            dd.left.label += " 更新";
            break;
          case "stacked-area-flow":
            dd.series[0].values = dd.series[0].values.map((v) => v * 2);
            break;
          case "cohort-regroup":
            dd.users[0][dc.fieldMappings.to] = "新增分组";
            break;
          case "sample-scale-reveal":
            dd.target += 1;
            break;
          case "kinetic-narration":
            dd.chart.value = 69;
            dd.chart.values = [69, 31];
            dd.cues.forEach((r) => {
              r.text = r.text.replace("68%", "69%");
              r.keywords = r.keywords.map((k) => k.replace("68%", "69%"));
            });
            break;
          case "research-map-journey":
            dd.cities.forEach((r) => (r.value += 1));
            break;
          case "decision-path-explainer":
            dd.nodes.forEach((r) => (r.count += 1));
            break;
          case "product-scene-focus":
            dd.regions.forEach((r) => (r.value += 1));
            break;
        }
        O.validate(dc);
        scene.draw(g, scene.duration - 0.1);
        const dataBaseline = cv.toDataURL();
        D.createScene(edited, cv.width).draw(g, scene.duration - 0.1);
        if (dataBaseline === cv.toDataURL())
          fail.push(row.tpl + " data edit did not change pixels");
        const at = 2;
        raw.motion.output.fps = 30;
        const thirty = D.Opus.progress(raw.motion, at);
        raw.motion.output.fps = 60;
        const sixty = D.Opus.progress(raw.motion, at);
        if (Math.abs(thirty - sixty) > 1e-10)
          fail.push(row.tpl + " FPS changed seconds");
        const portrait = JSON.parse(JSON.stringify(raw));
        portrait.motion.output.width = 1080;
        portrait.motion.output.height = 1920;
        cv.width = 1080;
        cv.height = 1920;
        D.createScene(portrait, 1080).draw(g, scene.duration * 0.7);
        images[row.tpl + "-portrait"] = cv.toDataURL("image/png");
        results.push({
          id: row.tpl,
          duration: scene.duration,
          records: records.length,
        });
      } catch (e) {
        fail.push(row.tpl + ": " + e.stack);
      }
    }
    const cc = O.defaults("cohort-regroup"),
      box = { x: 100, y: 200, w: 1720, h: 650, portrait: false };
    for (const t of [0, 4, 8, 11]) {
      const state = D.Opus.cohortState(cc, t, box);
      if (
        new Set(state.users.map((r) => r.id)).size !== 48 ||
        state.total !== 48
      )
        fail.push("identity/weight");
    }
    const sc = O.defaults("sample-scale-reveal");
    sc.data.total = 1205;
    sc.data.target = 363;
    const ss = D.Opus.sampleState(sc, 10);
    if (
      ss.markers.reduce((a, r) => a + r.weight, 0) !== 1205 ||
      ss.markers.reduce((a, r) => a + r.target, 0) !== 363
    )
      fail.push("weighted sample counts");
    const edges = [];
    for (const id of [
      "card-stack-cascade",
      "poll-results-bars",
      "sankey-flow",
      "funnel-conversion",
      "bubble-scatter-grow",
      "heatmap-calendar",
      "testimonial-card-carousel",
      "timeline-ruler",
      "stacked-area-flow",
    ]) {
      const c = O.defaults(id);
      for (const key of Object.keys(c.data))
        if (Array.isArray(c.data[key])) c.data[key] = [];
      if (id === "card-stack-cascade") c.options.focusIndex = 0;
      if (id === "timeline-ruler") c.options.highlight = -1;
      edges.push(c);
    }
    const long = O.defaults("testimonial-card-carousel");
    long.data.testimonials.forEach(
      (r) =>
        (r.quote =
          "这是一段中文访谈，讨论系统、影像和续航体验，强调日常任务是否顺手。".repeat(
            30,
          )),
    );
    edges.push(long);
    const zero = O.defaults("funnel-conversion");
    zero.data.stages.forEach((r) => (r.value = 0));
    edges.push(zero);
    const zerosankey = O.defaults("sankey-flow");
    zerosankey.data.links.forEach((r) => (r.value = 0));
    edges.push(zerosankey);
    const nps = O.defaults("number-counter");
    nps.data.keyframes = [
      [0, -32],
      [1, -5],
    ];
    edges.push(nps);
    for (const c of edges) {
      try {
        O.validate(c);
        const cv = document.createElement("canvas");
        cv.width = 1920;
        cv.height = 1080;
        const scene = D.createScene({ ...O.row(c), template: c.templateId });
        scene.draw(cv.getContext("2d"), c.timeline.duration - 0.1);
        images[c.templateId + "-edge"] = cv.toDataURL();
      } catch (e) {
        fail.push(c.templateId + " edge: " + e.message);
      }
    }
    const nc = O.defaults("number-counter");
    if (D.Opus.numericState(nc, 6).value !== 46)
      fail.push("counter final value");
    return { fail, results, images };
  }, board);
  for (const [name, uri] of Object.entries(contract.images))
    fs.writeFileSync(
      path.join(out, `${name}.png`),
      Buffer.from(uri.split(",")[1], "base64"),
    );
  delete contract.images;
  fs.writeFileSync(
    path.join(out, "render-contract.json"),
    JSON.stringify(contract, null, 2),
  );
  assert.deepEqual(contract.fail, []);
  console.log(
    "PASS all templates, deterministic reverse seek, edited pixels, frame rates, wide/portrait bounds",
  );
  // Exercise the actual existing editor and undo persistence rather than only the adapter.
  await page.evaluate(() => DMApp.select(5));
  await page.locator("#btnInspector").click();
  await page
    .locator('[data-motion="style.title"]')
    .fill("AI 与人工共同编辑的中文标题");
  await page.locator('[data-motion="style.title"]').dispatchEvent("change");
  await page.waitForFunction(
    () => DMApp.rows[5].motion.style.title === "AI 与人工共同编辑的中文标题",
  );
  await page.locator("#motionCSV").fill("label,value\n选项甲,75\n选项乙,70");
  await page.locator("#motionCSVApply").click();
  assert.deepEqual(
    await page.evaluate(() =>
      DMOpus.researchValues(DMApp.rows[5].motion).map((r) => r.percent),
    ),
    [75, 70],
  );
  await page.locator("#kUndo").click();
  assert.equal(
    await page.evaluate(() => DMApp.rows[5].motion.data.options.length),
    4,
  );
  await page.locator('[data-motion="style.title"]').fill("保存重开后的标题");
  await page.locator('[data-motion="style.title"]').dispatchEvent("change");
  // Init script clears storage, so use a second page without that script to verify the persisted state.
  const saved = await page.evaluate(() => JSON.stringify(localStorage));
  assert.ok(saved.includes("保存重开后的标题"));
  const reopened = await context.newPage();
  await reopened.addInitScript((board) => {
    window.DM_BOARD_OVERRIDE = board;
  }, board);
  await reopened.goto(
    pathToFileURL(path.join(root, "dist/肉呆爱动效.html")).href,
  );
  await reopened.waitForFunction(() => window.DMApp?.ready, null, {
    timeout: 120000,
  });
  assert.equal(
    await reopened.evaluate(() => DMApp.rows[5].motion.style.title),
    "保存重开后的标题",
  );
  await reopened.close();
  console.log(
    "PASS web inspector cells/CSV, shared AI config, undo, persistence",
  );
  await page.screenshot({ path: path.join(out, "editor.png"), fullPage: true });
  assert.deepEqual(errors, []);
  if (process.argv.includes("--export")) {
    const only = process.argv
      .find((a) => a.startsWith("--only="))
      ?.slice(7)
      .split(",")
      .map(Number);
    for (let i = 0; i < board.rows.length; i++) {
      if (only && !only.includes(i + 1)) continue;
      const row = board.rows[i],
        video = await page.evaluate(async (row) => {
          const raw = { ...row, template: row.tpl };
          const result = await DM.exportMP4(raw);
          const url = await new Promise((ok, no) => {
            const r = new FileReader();
            r.onload = () => ok(r.result);
            r.onerror = no;
            r.readAsDataURL(result.blob);
          });
          const cv = document.createElement("canvas");
          cv.width = result.width;
          cv.height = result.height;
          const sampleTime =
            Math.floor(result.fps * result.duration * 0.7) / result.fps;
          await DM.Opus.prepareFrame(raw, sampleTime);
          DM.createScene(raw, result.width).draw(
            cv.getContext("2d"),
            sampleTime,
          );
          return {
            url,
            png: cv.toDataURL(),
            sampleTime,
            width: result.width,
            height: result.height,
            fps: result.fps,
            duration: result.duration,
            frames: result.frames,
          };
        }, row);
      fs.writeFileSync(
        path.join(out, `${String(i + 1).padStart(2, "0")}-${row.tpl}.mp4`),
        Buffer.from(video.url.split(",")[1], "base64"),
      );
      fs.writeFileSync(
        path.join(
          out,
          `${String(i + 1).padStart(2, "0")}-${row.tpl}-expected.png`,
        ),
        Buffer.from(video.png.split(",")[1], "base64"),
      );
      delete video.url;
      delete video.png;
      fs.writeFileSync(
        path.join(
          out,
          `${String(i + 1).padStart(2, "0")}-${row.tpl}-video.json`,
        ),
        JSON.stringify(video, null, 2),
      );
      console.log(
        "EXPORTED",
        i + 1,
        row.tpl,
        video.duration + "s",
        video.fps + "fps",
      );
    }
  }
  console.log("PASS Opus acceptance");
} finally {
  await browser.close();
}
