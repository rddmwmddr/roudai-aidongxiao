# 重构调研数据动效

本地增加 20 个基础模板、3 个组合预设，原有 733 个动效保留。实现共用现有 SwiftUI、Canvas / WebKit、逐帧 WebCodecs H.264 + mp4-muxer 链路。

## 打开与使用

已构建的开发版在 `mac/成品/肉呆爱动效-调研开发版.app`。命令行重新构建并打开全部示例：

```sh
cd roudai-aidongxiao
tools/run_dev.sh
```

需要 Xcode、XcodeGen、Python 3；脚本把字体构建依赖装入项目 `.venv`，不修改系统 Python。只构建用 `tools/run_dev.sh --build-only`。单文件离线网页版为 `dist/肉呆爱动效.html`，使用 Chrome 可以导出视频。

在原有时间线片段上点动效胶囊，选择「调研数据 · Opus」或「调研组合预设」。右上角打开检查器：编辑表格、粘贴表格/CSV、修改研究信息/样式/模板参数、设置时间线秒数与输出。支持原有撤销和重做。高级数组、关系、原始记录可在「AI 配置与原始数据」中编辑；三种预设另有阶段上移/下移及持续秒数控件。

在「时间线」点击「记住当前播放位置」，保存 `.dmboard`；重新打开还原该位置、数据、样式、时间段、镜头及输出参数。原有时间线边缘拖动仍改变镜头时长。默认 1920×1080 / 60fps；在「画面与帧率」修改。调研动效导出读取工程配置，不受其他老模板的 4K/1080p 下拉框覆盖。

中文默认用项目内的寒蝉德黑体，字体随构建内嵌、离线可用。`fontFamily` 可选 `local-gothic`、`system-sans`、`system-serif`。工具栏现有字体替换也适用于 `local-gothic`；导入字体由现有本机字体库管理。后两种系统字体取决于本机系统。

## 版本与来源

Opus 固定到 [`8f1b78a25d0cf310c9bf904d434285046c4ed25a`](https://github.com/GovinduSasanka/opus-motion-library/tree/8f1b78a25d0cf310c9bf904d434285046c4ed25a)。原始 TSX、14 项 catalog/props-schema、集成文档、HTTP API 文档和时间线编辑器示例保留在 `vendor/opus-motion/`。`UPSTREAM.json` 记录原始文件 SHA-256。保留 MIT 和第三方声明，App「关于」也列出来源。

这是**源码逻辑到现有 Canvas 引擎的适配版本**，不是直接运行 Opus 的 React/Remotion 播放器，也不宣称与原 TSX 像素一致。保留共享坐标、种子点阵、排名插值、单调三次数字插值、堆叠曲线等算法；布局、中文、问卷统计与镜头按本项目需求调整。可编辑字段以本地配置校验器为准；未支持的上游道具会被拒绝，不静默忽略。

运行时不加载 npm、CDN、Google Fonts 或本地渲染服务器，不新增 Remotion 运行时。原生视频素材由 AVFoundation 按时间解码为 PNG 帧，再交给共用 Canvas，避免 WebKit 离屏暂停定位不结束；网页版用本地 Blob 视频与画布采样。H.264 MP4 已在两条路径实际验证。现有测试用的 `playwright-core@1.65.0` 已核对 npm 实际可用并按原 lockfile 安装。Magic UI、Motion Primitives、Nivo、Aceternity 和 Remotion 第二阶段尚未引入；用户原先规定在第一阶段验收后按需要再接。

地图使用 Natural Earth 1:110m **陆地轮廓**，本地打包、无行政区划界线，等距经纬度投影。来源版本、校验和、处理方式和声明在 `vendor/natural-earth/`，[原站使用条款](https://www.naturalearthdata.com/about/terms-of-use/)标为公有领域。只绘制用户明确输入的城市关系线。

进阶六种模板为本项目自写。YouTube 参考链接只能读取到页面信息，未能读取连续视频画面；实现依据用户提供的明确规格，没有提取或复用视频资产。

## 模板及统计口径

| ID | 用途及关键编辑字段 |
|---|---|
| comparison-dumbbell | `data.rows[{label,before,after}]`；前后标签、变化值或变化率、好坏方向、排序 |
| dot-tally | `data.groups[{label,count,marked}]`；列数、固定种子、填色/圆环/叉、图例；一图标一人 |
| bar-race | `names` 与 `frames[{label,values}]`；名次、固定/动态坐标、各品牌固定颜色 |
| number-counter | `keyframes[[0..1进度,value]]`；tick/roll、单位、小数、标签；负数/小数用 tick |
| card-stack-cascade | `cards[{title,body,value,color?}]`；bento/row/stack、focusIndex、focusAt/focusHold 秒数、弱化透明度 |
| poll-results-bars | `options[{label,value}]`；单选/多选、人数/百分比、有效样本 totalVotes、顺序、强调对象、可为空的最高项标签 |
| sankey-flow | **配对** `links[{from,to,value,color?}]`；来源与去向即使同名也分居两侧；同一比例尺的流带宽度；节点颜色与强调 |
| funnel-conversion | `stages[{label,value,color?}]`；`previous` 为本阶段/上一阶段，`first` 为本阶段/首阶段；零基数显示「无基数」 |
| bubble-scatter-grow | 原始 `records` + 字段映射 label/x/y/size；坐标范围/单位、参考线、重点；气泡半径为数值平方根，面积正比数值 |
| heatmap-calendar | `records[{date,value}]`；日期范围、色阶、最大值、日期强调；有记录零值与无记录使用不同标记，不生成随机数据 |
| testimonial-card-carousel | `testimonials[{quote,name,role,rating?}]`；顺序按数组，holdSeconds/moveSeconds；头像、星级默认关闭；长中文自动换行及缩字 |
| timeline-ruler | `events[{date,title,body,image?}]`；按真实日期天数或等距排列并标明口径；重点事件与本地图片 |
| split-compare | 左右 `label/desc/src/kind`、分隔位置、视频同步起点；本地图片/视频内嵌项目；逐帧定位再绘制视频 |
| stacked-area-flow | `xLabels` 与 `series[{name,values,color?}]`；绝对数量/百分比、图例、分母说明、重点系列；全零时没有百分比基数 |
| cohort-regroup | 关联个体 `users`、稳定 ID、字段映射、权重、两维分组、排序、小人/圆点、转换秒数、强调与选中原声；无记录时用 aggregate 模式 |
| sample-scale-reveal | `total/subgroup/target/person`；三个层级名称、每标记人数、排列、路线与停留；首标记 1 人，其余按明确权重，末标记/部分着色保持统计量 |
| kinetic-narration | `cues[{start,end,text,keywords,emphasis}]`；SRT/VTT 时间戳、可编辑秒数、关键词、数字、图表与结论；字幕中的数字/单位必须与图表一致 |
| research-map-journey | `cities[{id,name,lon,lat,sample,value,label}]`、可选关系 links；顺序、停留、缩放、点位样式、地图颜色 |
| decision-path-explainer | `nodes[{id,label,icon,x,y,at,count?,body}]`、`links[{from,to,value?,at,duration}]`；分支、返回、退出；没有人数就不显示数量 |
| product-scene-focus | phone/cockpit/store 基础几何、重点区域与数据；镜头移动/停留/返回、锚定标注、可替换本地图片；**分层视差，非真实三维模型渲染** |

问卷输入人数时，比例 = 选项人数 / 有效样本人数。多选允许合计超过100%；输入百分比时逐项保持原值。单选合计不得超出基数。人数输入模式把样式单位设为「人」可显示人数标签，条形长度仍表示样本比例。

桑基图不接受只有两组边际占比的输入，不推断流向。个体重排也不从汇总数据制造个体关联。大样本拉远最多绘制2000个标记，用户显式指定每标记权重；这是显示规模限制，不改变总数。

三个预设：`preset-cohort-story`、`preset-sample-story`、`preset-quote-data`。预设复用对应基础模板，`sequence` 保存阶段顺序和秒数。`timeline.duration` 与各阶段秒数之和必须一致。第三个预设的图表部分调用现有问卷/数字组件；可通过 `data.chart.templateId` 选择这两种组件。

## 配置、AI 与本地接口

`row.motion` 是 AI 和人工共用的完整配置：

```json
{
  "schemaVersion": 1,
  "templateId": "comparison-dumbbell",
  "templateVersion": "8f1b78a25d0cf310c9bf904d434285046c4ed25a/canvas-1",
  "data": {},
  "fieldMappings": {},
  "metadata": {},
  "style": {},
  "options": {},
  "camera": {},
  "sequence": [],
  "timeline": {"duration":6,"entrance":0.3,"hold":1,"inPoint":0,"outPoint":1,"currentTime":0},
  "output": {"width":1920,"height":1080,"fps":60},
  "demo": true
}
```

上面为字段示意，空对象不构成有效输入。完整的可运行样例与 CSV 在 `examples/opus/`。默认尺寸可改为偶数边长240–3840、画幅比例1:2至2.4:1，支持24/25/30/50/60fps。内部以秒/归一化进度计算，不把30帧的计时直接当成60帧使用。

原有 AI 分镜提示词已列入这些模板及数据结构。AI 可输出完整 `motion`，或在原有 `data` JSON 字符串中提供 `motionInput`（真实 data 必填，其余按需覆盖），由本地适配器补齐版本与样式，再调用同一校验器。来源、样本量、研究时间未知时隐藏，不用演示数值补齐。原有文稿数字审查也覆盖新配置。没有调用实际付费模型；已验证结构化回答进入现有解析和复核链路。

本地 CLI 不需要服务、密钥或额外 npm 依赖，非零退出码表示校验失败，stderr 给具体字段：

```sh
node tools/opus.mjs list
node tools/opus.mjs defaults poll-results-bars > /tmp/poll.json
node tools/opus.mjs validate /tmp/poll.json
node tools/opus.mjs import-csv /tmp/poll.json examples/opus/poll-results-bars.csv > /tmp/edited.json
node tools/opus.mjs to-row /tmp/edited.json
node tools/opus.mjs update-board examples/opus/重构调研-全部模板.dmboard 6 /tmp/edited.json /tmp/AI修改后的研究.dmboard
```

`update-board` 保留其他镜头和现有字段，写入新工程文件，避免覆盖原工程。打开输出文件后可继续编辑、撤销、保存。已打开工程中的人工更改走原有文档 UndoManager；外部 CLI 生成新文件不会注入当前窗口的撤销栈。

精简 AI 输入示例：

```json
{"data":{"rows":[{"label":"品牌甲","before":42,"after":58}]},"style":{"title":"满意度变化"}}
```

保存为 `input.json` 后运行 `node tools/opus.mjs from-ai comparison-dumbbell input.json`，得到完整有效配置。导入后在同一个右侧面板编辑，无单独「AI 渲染成品」格式。

## 验收与产物

运行：

```sh
npm ci --prefix scripts
node tests/opus.mjs
node tests/opus_media.mjs
node tests/opus.mjs --export
.venv/bin/python tools/verify_opus_exports.py
PATH="$PWD/.venv/bin:$PATH" tools/check.sh
```

专项测试包括：20个模板和3个预设的配置/CSV往返、数据与样式更新、反向定位确定性、横竖布局、30/60fps秒数一致、中文长句、空数据/零值、多人权重、稳定ID、问卷/漏斗/日历/堆叠口径、实际编辑器撤销与保存。

原生 `OpusTests` 验证23个入口、WebKit播放/暂停/定位、工程编码重开和撤销，以及项目配置覆盖导出对话框参数的真实MP4输出。另有原生双视频测试覆盖前后定位、同一素材去重、30fps素材在60fps项目中导出。双视频测试覆盖同步起点、暂停后的前后定位和真实编码；本地图片由本项目生成，不取自参考视频。

输出在 `质检/opus/`：

- `重构调研-全部动效验收.mp4`：20个基础模板与3个预设。
- `Opus-首批四模板.mp4`、`Opus-十种数据组件.mp4`、`重构调研-进阶动效与预设.mp4`：分批验收视频。
- `双视频同步验收.mp4`、`原生双视频同步验收.mp4`：网页与 macOS 原生双素材同步专项。
- `video-verification.json`：ffprobe尺寸/帧率/时长/帧数、解码帧与预览的SSIM。
- `*-decoded.png`、`*-expected.png`、横竖画幅预览、编辑器截图及 `render-contract.json`：可复核证据。

GitHub 调研预览版本为 `v1.4.0-preview.1`，安装说明见 [PREVIEW.md](PREVIEW.md)。预览包未进行 Developer ID 签名与公证，正式版下载仍保留 1.3。第二阶段组件库、真实3D模型、自动口播强制对齐与真实研究数据不在本次实现中；字幕采用导入或手动时间点。
