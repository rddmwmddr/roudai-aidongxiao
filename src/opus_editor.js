// Web inspector adapter; native inspector uses the same DMOpus contract and CSV functions.
(function (root) {
  const D = root.DM,
    O = root.DMOpus,
    esc = (s) =>
      String(s ?? "").replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      );
  D.Opus.editorHTML = (row) => {
    if (!row.motion) return "";
    const c = D.Opus.configOf(row),
      labels = {
        metadata: "研究信息",
        style: "样式与文字",
        timeline: "时间线（秒）",
        output: "画面与帧率",
        options: "模板参数",
        fieldMappings: "字段映射",
        camera: "镜头",
      };
    const controls = Object.entries(labels)
      .filter(([key]) => c[key] && Object.keys(c[key]).length)
      .map(
        ([section, title]) =>
          `<details class="block" ${section === "style" ? "open" : ""}><summary>${title}</summary>${Object.entries(
            c[section],
          )
            .map(
              ([key, value]) =>
                `<label style="display:block;margin-top:9px">${esc(key)} ${typeof value === "boolean" ? `<input type="checkbox" data-motion="${section}.${key}" ${value ? "checked" : ""}>` : typeof value === "object" ? `<textarea data-motion="${section}.${key}" data-type="json" rows="3">${esc(JSON.stringify(value))}</textarea>` : `<input data-motion="${section}.${key}" type="${typeof value === "number" ? "number" : typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? "color" : "text"}" value="${esc(value)}" ${typeof value === "number" ? 'step="any"' : ""}>`}</label>`,
            )
            .join("")}</details>`,
      )
      .join("");
    return `${D.Audio.editorHTML(c)}<div class="block" id="motionEditor"><h3>调研数据 · AI 共用配置</h3><div id="motionError" role="alert" style="color:#c43b50"></div>
      <details open><summary>编辑数据表格 / 粘贴 CSV</summary><div style="overflow:auto;max-height:420px"><table id="motionTable">${O.table(
        c,
      )
        .map(
          (r, i) =>
            `<tr>${r.map((cell, j) => (i === 0 ? `<th>${esc(cell)}</th>` : `<td><input aria-label="第${i}行 ${esc(O.table(c)[0][j])}" data-cell="${i}:${j}" value="${esc(String(cell).length > 500 ? "[内嵌素材]" : cell)}" style="min-width:110px" ${String(cell).length > 500 ? "disabled" : ""}></td>`)).join("")}</tr>`,
        )
        .join(
          "",
        )}</table></div><textarea id="motionCSV" rows="6">${esc(O.csv(c))}</textarea><button id="motionCSVApply">应用粘贴数据</button><label>导入 CSV <input id="motionCSVFile" type="file" accept=".csv,.tsv,.txt"></label></details>
      ${c.templateId === "text-match-cut" ? c.data.pages.map((r,i)=>`<label>导入第${i+1}页报道截图（focusX/Y/Width/Height 在表格中编辑，0–1）<input data-media="article:${i}" type="file" accept="image/png,image/jpeg,image/webp"></label>`).join('') : ""}
      ${c.templateId === "magazine-letters" ? `<label>剪字文案 <input id="paperText" value="${esc(c.data.letters.map(r=>r.text).join(''))}"></label><button id="paperLettersApply">按文字更新字片</button>` : ""}
      ${c.templateId === "paper-cutout" ? '<label>导入或替换图片 / 透明 PNG <input data-media="paper" type="file" accept="image/png,image/jpeg,image/webp"></label>' : ""}
      ${c.templateId === "kinetic-narration" ? '<label>导入 SRT/VTT <input id="motionSRT" type="file" accept=".srt,.vtt,.txt"></label>' : ""}
      ${c.templateId === "split-compare" ? ["left", "right"].map((side) => `<label>${side === "left" ? "左侧" : "右侧"}图片或视频 <input data-media="${side}" type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"></label>`).join("") : ""}
      ${c.templateId === "product-scene-focus" ? '<label>场景本地图片 <input data-media="asset" type="file" accept="image/png,image/jpeg,image/webp"></label>' : ""}
      ${c.templateId === "timeline-ruler" ? c.data.events.map((r, i) => `<label>事件${i + 1}图片 <input data-media="event:${i}" type="file" accept="image/png,image/jpeg,image/webp"></label>`).join("") : ""}
      <button id="motionRemember">记住当前时间线位置</button><button id="motionJSONSave">下载 AI 配置</button>
      <details><summary>完整结构化配置（含顺序与原始数据）</summary><textarea id="motionJSON" rows="14">${esc(JSON.stringify(c, null, 2))}</textarea><button id="motionJSONApply">校验并应用配置</button></details></div>${controls}`;
  };
  D.Opus.bindEditor = (row, rebuild, render, time) => {
    if (!row.motion) return;
    const $ = (id) => document.getElementById(id),
      error = (e) => {
        $("motionError").textContent = e.message;
      };
    const apply = (next) => {
      try {
        const mediaOpen=document.getElementById("mediaEditor")?.open;
        row.motion = O.validate(next);
        delete row.dur;
        rebuild(row, false);
        render();
        if(mediaOpen)document.getElementById("mediaEditor").open=true;
      } catch (e) {
        error(e);
      }
    };
    D.Audio.bindEditor(row,apply,time,error);
    document.querySelectorAll("[data-motion]").forEach(
      (el) =>
        (el.onchange = () => {
          try {
            const next = D.Opus.configOf(row),
              [section, key] = el.dataset.motion.split(".");
            next[section][key] =
              el.dataset.type === "json"
                ? JSON.parse(el.value)
                : el.type === "checkbox"
                  ? el.checked
                  : el.type === "number"
                    ? Number(el.value)
                    : el.value;
            apply(next);
          } catch (e) {
            error(e);
          }
        }),
    );
    document.querySelectorAll("[data-cell]").forEach(
      (el) =>
        (el.onchange = () => {
          try {
            const c = D.Opus.configOf(row),
              table = O.table(c),
              [i, j] = el.dataset.cell.split(":").map(Number);
            table[i][j] = el.value;
            const csv = table
              .map((r) =>
                r
                  .map((v) => '"' + String(v).replace(/"/g, '""') + '"')
                  .join(","),
              )
              .join("\n");
            apply(O.importTable(c, csv));
          } catch (e) {
            error(e);
          }
        }),
    );
    $("motionCSVApply").onclick = () => {
      try {
        apply(O.importTable(D.Opus.configOf(row), $("motionCSV").value));
      } catch (e) {
        error(e);
      }
    };
    $("motionCSVFile").onchange = async (e) => {
      try {
        apply(
          O.importTable(D.Opus.configOf(row), await e.target.files[0].text()),
        );
      } catch (e) {
        error(e);
      }
    };
    $("motionJSONApply").onclick = () => {
      try {
        apply(JSON.parse($("motionJSON").value));
      } catch (e) {
        error(e);
      }
    };
    $("motionRemember").onclick = () => {
      const c = D.Opus.configOf(row);
      c.timeline.currentTime = Math.min(time(), c.timeline.duration);
      apply(c);
    };
    $("motionJSONSave").onclick = () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(
        new Blob([JSON.stringify(D.Opus.configOf(row), null, 2)], {
          type: "application/json",
        }),
      );
      a.download = `${row.tpl}.motion.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    if ($("paperLettersApply")) $("paperLettersApply").onclick=()=>{try{const c=D.Opus.configOf(row);c.data.letters=O.paperLetters($("paperText").value,c.data.letters);apply(c)}catch(e){error(e)}};
    if ($("motionSRT"))
      $("motionSRT").onchange = async (e) => {
        try {
          apply(
            O.importSubtitles(
              D.Opus.configOf(row),
              await e.target.files[0].text(),
            ),
          );
        } catch (e) {
          error(e);
        }
      };
    document.querySelectorAll("[data-media]").forEach(
      (el) =>
        (el.onchange = () => {
          const f = el.files[0];
          if (!f) return;
          if (f.size > ((el.dataset.media === "paper" || el.dataset.media.startsWith("article:")) ? 12 : 100) * 1024 * 1024) {
            error(new Error((el.dataset.media === "paper" || el.dataset.media.startsWith("article:")) ? "纸张图片上限12MB" : "素材上限100MB"));
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const c = D.Opus.configOf(row),
              side = el.dataset.media;
            if (side.startsWith("article:")) c.data.pages[Number(side.slice(8))].image=reader.result;
            else if (side === "paper") c.data.items[0].src=reader.result;
            else if (side === "asset") c.options.asset = reader.result;
            else if (side.startsWith("event:"))
              c.data.events[Number(side.slice(6))].image = reader.result;
            else
              Object.assign(c.data[side], {
                src: reader.result,
                kind: f.type.startsWith("video") ? "video" : "image",
              });
            apply(c);
          };
          reader.readAsDataURL(f);
        }),
    );
  };
})(window);
