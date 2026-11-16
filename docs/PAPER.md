# 纸张与拼贴 · 1.6 本地开发版

1.6 build11 使用 `paper-canvas-5`，增加原创无字纸纹、双击文字编辑、中途停顿与AAC音效导出。用法与AI配置见 [文字、停顿与音效](MOTION_MEDIA.md)。下方保留上一版的视觉研究记录；旧配置会迁移并保留文本内容。

实际入口：画面左上角「动效」→「纸张与拼贴」，或搜索「纸张、拼贴、剪贴、匹配剪辑、Paper、Match Cut」。共四项，右上角「这一镜」编辑内容、参数、时间线和画面输出。

- `text-match-cut` 文字匹配剪辑：`data.pages` 编辑每页的标题、前文、后文、正文；`options.keyword/paperCount/cutSeconds/fontPair/highlight/highlightColor/paperColor/texture/seed` 控制关键词、切换节奏、字体组合与纸张。关键词与周围正文采用相同的阅读字号，按实际字形边界对齐；正文近景、标题留白、字体、裁切及上下文随切换变化。新增 `articleScale/contextBlur` 控制阅读倍率和上下文虚化。可逐页导入真实报道截图，并在预览小图上拖动框选原文词句；`image/focusX/focusY/focusWidth/focusHeight` 内嵌保存素材与归一化定位区域。图片模式保留原文，不会用输入框的文字替换图片中的字。
- `paper-cutout` 纸张剪贴：用「导入或替换图片 / 透明 PNG」选择本地 PNG、JPEG 或 WebP（最多12MB）；`data.items[0]` 保存内嵌素材、标签及说明。`tear/texture/thickness/shadow/backing/entry/entrySeconds/tilt` 可编辑。透明通道保留；可关闭纸张衬底。示例手机图与纸纹均由本项目几何绘制生成。
- `paper-unfold` 折纸展开：编辑 `data.panels` 的标题和正文，方向 `right/left/up/down`，分段数2–8，`unfoldSeconds` 按秒。所有段共享连续铰链坐标，透视投影后用三角网格映射纸面内容，并随角度变化投影与明暗。Canvas 的2.5D实现，无三维运行时。内容行数不能超出分段数；导入表格时自动增加到足够的分段数，未填写的段留白。
- `magazine-letters` 杂志剪字：先用「整句生成字片」输入最多30字，再在表格中逐字编辑 `text/font/paper/ink/tilt`；字体可选 `local-gothic/system-serif/system-sans`。`stagger/entrySeconds/spread/tear/texture/seed` 控制组合入场与纸边。

四项使用版本 `paper-canvas-5`，沿用现有 `row.motion` 结构，含数据、样式、seed、时间线、输出与模板版本。秒级时间计算，布局固定seed；可反复定位、撤销、保存及逐帧导出。更改时长时若容纳不下既有切换次数或展开节奏，会显示具体参数错误；先增加持续时间或减少相应参数。

AI 可沿用项目现有工具调用以及经过参数校验的本地接口：

```sh
node tools/opus.mjs defaults text-match-cut > /tmp/paper.json
node tools/opus.mjs validate /tmp/paper.json
node tools/opus.mjs from-ai text-match-cut input.json
node tools/opus.mjs update-board project.dmboard 1 /tmp/paper.json /tmp/updated.dmboard
```

精简输入 `input.json`：

```json
{"data":{"pages":[{"heading":"研究发现","before":"听见","after":"背后的原因","body":"来自用户提供的访谈记录。"}]},"options":{"keyword":"真实声音","paperCount":6,"cutSeconds":0.5},"style":{"title":"原声与发现"}}
```

构建：`tools/run_dev.sh --build-only`。示例：`examples/paper/纸张与拼贴-演示.dmboard`。测试：`node tests/paper.mjs`（包含真实1080p60导出），`PATH="$PWD/.venv/bin:$PATH" tools/check.sh`（包含原生四项播放、保存/恢复、撤销与MP4）。验收产物在 `质检/paper/`。

公开参考：https://app.paperanimator.com/ 与用户提供的 X 视频。现已通过公开媒体地址实际取得原参考视频，1280×720、30fps，共70帧；逐帧拆解并对照，未复制其代码、文章、视频或材质到产品。原片观察与测量见下方分析文档，参考视频仅保留在临时研究目录；验收联系图位于 `质检/paper/原参考逐帧-*.jpg`。现有内嵌中文黑体沿用OFL许可，宋体由本机提供。

1.5 build 9 根据原片实际帧重做文字匹配剪辑：关键词中心位于画面高度约38%，版式直接硬切，默认每秒9次；40次切换中10种近景构图循环。正文与标题版式交替，保留背景阅读线索和留白。默认 `contextBlur=6` 为纵向虚化上限、`focusPadding=180`、`contextDimming=0`，使用方向性卷积和宽范围连续景深，纸纹在虚化之后绘制以保留材质细节，预览与导出共用像素实现。其他显式用户参数保持；旧默认组合12/100/0.3自动迁移为6/180/0。

这是一套根据参考视觉独立实现的可编辑效果，非原站算法的逐像素复刻；中文字体度量与英文原片存在自然差别。分析文档：`docs/PAPER_REFERENCE_ANALYSIS.md`。
