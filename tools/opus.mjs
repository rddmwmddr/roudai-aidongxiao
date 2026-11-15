#!/usr/bin/env node
// Local JSON API. Reads stdin/files, validates before writing, never executes generated code.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  O = require("../src/opus_config.js");
const [command = "help", argument, ...rest] = process.argv.slice(2);
const read = (file) =>
  JSON.parse(fs.readFileSync(file === "-" ? 0 : file, "utf8"));
const print = (value) =>
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
try {
  if (command === "list")
    print({ version: O.VERSION, templates: O.IDS, presets: O.PRESETS });
  else if (command === "defaults")
    print(O.PRESETS[argument] ? O.preset(argument) : O.defaults(argument));
  else if (command === "from-ai")
    print(O.fromAI(argument, read(rest[0] || "-")));
  else if (command === "validate")
    print({ ok: true, config: O.validate(read(argument || "-")) });
  else if (command === "import-csv") {
    const c = O.validate(read(argument));
    print(O.importTable(c, fs.readFileSync(rest[0], "utf8")));
  } else if (command === "import-subtitles")
    print(
      O.importSubtitles(
        O.validate(read(argument)),
        fs.readFileSync(rest[0], "utf8"),
      ),
    );
  else if (command === "to-row") print(O.row(read(argument || "-")));
  else if (command === "board") {
    const configs = argument ? read(argument) : O.IDS.map(O.defaults);
    if (!Array.isArray(configs)) throw new Error("输入必须为配置数组");
    print({
      title: "重构调研 · 动效演示数据",
      rows: configs.map((c, i) => O.row(c, i + 1)),
    });
  } else if (command === "demo") {
    const dir = path.resolve(argument || "examples/opus");
    fs.mkdirSync(dir, { recursive: true });
    const configs = O.IDS.map(O.defaults),
      presets = Object.keys(O.PRESETS).map(O.preset);
    const split = configs.find((c) => c.templateId === "split-compare");
    for (const [side, name] of [
      ["left", "before"],
      ["right", "after"],
    ]) {
      const file = path.join(dir, "assets", name + ".png");
      if (fs.existsSync(file))
        split.data[side].src =
          "data:image/png;base64," + fs.readFileSync(file).toString("base64");
    }
    for (const c of configs) {
      fs.writeFileSync(
        path.join(dir, `${c.templateId}.json`),
        JSON.stringify(c, null, 2) + "\n",
      );
      fs.writeFileSync(
        path.join(dir, `${c.templateId}.csv`),
        "\uFEFF" + O.csv(c) + "\n",
      );
    }
    for (const [id] of Object.entries(O.PRESETS))
      fs.writeFileSync(
        path.join(dir, `${id}.json`),
        JSON.stringify(O.preset(id), null, 2) + "\n",
      );
    fs.writeFileSync(
      path.join(dir, "重构调研-全部模板.dmboard"),
      JSON.stringify(
        {
          title: "重构调研 · 全部模板（演示数据）",
          rows: [...configs, ...presets].map((c, i) => O.row(c, i + 1)),
        },
        null,
        2,
      ) + "\n",
    );
    print({
      ok: true,
      directory: dir,
      templates: configs.length,
      presets: presets.length,
    });
  } else if (command === "update-board") {
    const [rowId, configFile, outFile] = rest,
      board = read(argument),
      config = O.validate(read(configFile));
    if (!Array.isArray(board.rows)) throw new Error("不是分镜工程");
    const at = board.rows.findIndex((r) => String(r.id) === rowId);
    if (at < 0) throw new Error("未找到镜头ID");
    const old = board.rows[at];
    const template =
      O.PRESETS[old.tpl]?.templateId === config.templateId
        ? old.tpl
        : config.templateId;
    board.rows[at] = { ...old, tpl: template, motion: config };
    delete board.rows[at].dur;
    delete board.rows[at].sampleData;
    delete board.rows[at].pending;
    if (!outFile) throw new Error("必须指定输出文件（可在审阅后替换原工程）");
    const out = path.resolve(outFile);
    if (out === path.resolve(argument))
      throw new Error("请使用新文件名，保留原工程与撤销起点");
    if (fs.existsSync(out)) throw new Error("输出文件已存在，请使用新文件名");
    fs.writeFileSync(out, JSON.stringify(board, null, 2) + "\n", {
      flag: "wx",
    });
    print({ ok: true, path: out });
  } else if (command === "values")
    print(O.researchValues(O.validate(read(argument))));
  else {
    process.stdout.write(
      "node tools/opus.mjs list | defaults <id> | validate <config.json|-> | import-csv <config.json> <data.csv> | import-subtitles <config.json> <captions.srt> | to-row <config.json> | board [configs.json] | demo [directory] | update-board <project.dmboard> <row-id> <config.json> <new.dmboard> | values <config.json>\n",
    );
  }
} catch (e) {
  process.stderr.write(JSON.stringify({ ok: false, error: e.message }) + "\n");
  process.exitCode = 1;
}
