<p align="center"><img src="docs/icon.png" width="128" alt="肉呆爱动效图标"></p>

<h1 align="center">肉呆爱动效</h1>

<p align="center">口播文稿变动效视频。导入文稿或 A-roll，生成分镜，拖片段，换效果，导出 MP4。</p>

<p align="center"><b><a href="https://github.com/rddmwmddr/roudai-aidongxiao/releases/download/v1.7.0/RouDaiAiDongXiao.dmg">下载 1.7 正式版</a></b> · <a href="https://github.com/rddmwmddr/roudai-aidongxiao/releases/tag/v1.3.0">1.3 历史正式版</a> · <a href="https://ahuamiao.com/sites/other/roudai-tools.html#motion">官网和图文教程</a></p>

<p align="center">macOS 13 及以上 · A-roll 识别：macOS 26 及以上 · Apple 芯片和 Intel 通用 · 1.7 正式 App 已通过 Developer ID 签名与 Apple 公证</p>

![剪辑台](docs/screenshots/board.jpg)

截图里是示例文稿，数字是示例。

## 特点

### 动效库

733 个原有动效，11 个分类（另新增20个调研基础模板、3个预设，见下文）：百分比 11、图表 55、细读图表 39、文字 26、文字特效 130、状态 64、交互 58、质感 54、加载 99、按钮 101、开关提示 96。

**特点**

- 文稿匹配动效：百分比进一百根、一百人，一串数进图表，短句进文字特效。
- 一百根：两个数可以叠在一行（包含、相反）。三四个数：一个数一行。
- 成片的字和数字来自文稿。默认字和默认数：样例专用。样例镜头：导出跳过。
- 挑选窗口带预览：左侧分类，上方预览，下方效果。

**好处**：一句「72% 的朋友选择拿铁」配一百根竖条，72 根亮起，数字和文稿一致。

### 脚本框和时间线

画面右侧是脚本框，下方是时间线，两边联动。

**特点**

- 点片段：脚本框跳到这一句，高亮这一句，播放进度带着字走。
- 点句子：时间线跳到这一镜。
- 脚本框回车：拆成两镜。时间线 B 键：拆在播放头。
- 选中几句或 ⌘ 点几个片段，右键：组合、重新匹配、导出。
- 拖片段右边缘：改时长，整段动画跟着变。右拖放慢，左拖加快。右栏「速率」：2 是两倍快。
- 点片段上方的胶囊：换效果。
- 双击画面里的字：原地改字，回车保存，⌘Z 撤销。按钮、开关、文字特效：双击整个动效改它的字。口播原文不变。
- 右栏「颜色」：组件、CSS 动效、数据动效的底色、主色、辅色、文字色，点色块选色，右键恢复默认。
- 工具栏「替换字体」：选择中文、数字、诗句字体，预览和导出一起生效。支持导入 ttf、otf、woff、woff2，也可以选回默认字体。

**好处**：长段落：回车，两段两个动效。几句话讲同一组数：组合，两个数进同一张图。

### 文稿

**特点**

- 打开软件：示例分镜开始播放，画面、脚本框、时间线一屏看全。<kbd>⌘</kbd><kbd>N</kbd>：新建空白文稿。
- 文稿格式：Word、WPS、Pages、PPT、Keynote、Excel、Numbers、PDF、epub、网页、字幕、纯文本、图片。扫描版 PDF 和图片：文字识别。
- 看文件内容判断格式，改过扩展名的文件同样能读。

**好处**：手里的稿子是什么格式，导入什么格式。

### A-roll

**特点**

- 导入视频或音频，离线识别，一句一镜，时长对齐声音，动效配好。
- 现成的分镜：字和效果保留，时长对齐声音。
- 系统要求：macOS 26 及以上。

**好处**：录完口播，导入视频。时间线和声音对齐。

### 导出

**特点**

- MP4，4K、1080p，60 帧、30 帧。
- 一镜一个文件。批量导出：跳过现成的文件，写一份输出清单。

**好处**：一镜一条素材，进剪辑软件，时长和口播一致。

## 教程

[官网教程](https://ahuamiao.com/sites/other/roudai-tools.html#m-tutorial)：十一步，一步一张图。

## 纸张与拼贴（1.7 正式版）

新增文字匹配剪辑、纸张剪贴、折纸展开、杂志剪字。在「动效 → 纸张与拼贴」选择，右上角「这一镜」编辑内容、素材及参数。支持中文、固定 seed、保存重开和逐帧导出。

[参数与 AI 调用](docs/PAPER.md) · [文字、停顿与音效](docs/MOTION_MEDIA.md) · 示例工程 `examples/paper/可编辑文字-中途停顿-音效.dmboard`。暂停后双击纸面文字可复制、粘贴和修改；「这一镜 → 中途停顿与音效」支持输入或拖动停顿、音效导入编辑及数字自动节拍。

## 重构调研数据动效（已并入 1.7 正式版）

1.7 正式版包含全部调研模板、三个组合预设及四个纸张模板，共 760 个动效入口。演示数据明确标注。[下载演示工程](https://github.com/rddmwmddr/roudai-aidongxiao/releases/download/v1.7.0/Research-Examples-1.7.0.zip) · [正式发布与签名流程](docs/RELEASE.md)。

新增20个可编辑基础模板和3个组合预设，位于动效选择器「调研数据 · Opus」「调研组合预设」。支持表格/CSV、中文样式、统一AI配置、秒级时间线、项目保存与本地视频导出。

```sh
tools/run_dev.sh  # 构建并打开全部演示工程
```

详细入口、参数口径、AI本地接口、版本/许可证与验收方法见 [docs/OPUS.md](docs/OPUS.md)。示例工程：`examples/opus/重构调研-全部模板.dmboard`。测试视频：`质检/opus/重构调研-全部动效验收.mp4`。

## 源码构建

需要 Xcode、[XcodeGen](https://github.com/yonaskolb/XcodeGen)、Python 3。测试需要 Node 和 Chrome。

```bash
python3 tools/build.py        # 打包引擎，生成单文件网页版 dist/肉呆爱动效.html
cd mac && xcodegen generate   # 生成 Xcode 工程
tools/check.sh                # 打包、界面规则、引擎测试、原生单元测试
```

公证发版：

```bash
SIGN_ID="Developer ID Application: 名字 (TEAMID)" TEAM=TEAMID NOTARY_PROFILE=钥匙串配置名 tools/build_app.sh
```

本机升级包使用同一 Apple Development 签名身份和 App 标识，DMG 文件名包含版本号。每次发新版本时，在 `mac/project.yml` 递增 `MARKETING_VERSION` 和 `CURRENT_PROJECT_VERSION`。

```bash
SIGN_ID="Apple Development: 名字 (TEAMID)" TEAM=TEAMID tools/build_app.sh --local
```

## 本机动效包

在动效选择器中点「AI 做动效」，使用已配置的 AI 服务生成动效草稿。可以新建模板或修改当前模板，预览后保存到本机动效库。

macOS App 的「设置 → 动效包」可连接一个由同事或 Agent 编辑的工作文件夹。文件保存并通过校验后，画面会自动更新，最后一份有效配置会随本机 App 数据保留。查看 [动效包协议和示例](mac/Resources/MotionPack.md)。

在设置里复制 Agent 命令后，可让 Agent 查询动效和元素 ID、增删改本机模板、覆盖或恢复内置动效，并用 App 的渲染引擎生成 GIF。命令随安装包提供，操作 App 所连接的工作文件夹。

## AI 和 Key

规则模式可离线使用。AI 模式保存服务地址和模型。从 1.5.2 起，在「设置 → AI」填写 Key 或从文件导入配置一次即可，之后正常替换 App 会继续使用本机配置。旧版尚存的 Key 会在首次打开新版时迁移。

## 授权

| 来源 | 用途 | 授权 |
|---|---|---|
| [Opus Motion Library](https://github.com/GovinduSasanka/opus-motion-library) | 14 个调研动效的源码逻辑适配 | MIT |
| [Natural Earth](https://www.naturalearthdata.com/) | 本地地图陆地轮廓 | 公有领域 |
| [Motion Prompt](https://github.com/showheyohtaki/motion-prompt) | 14 个文字动效 | MIT |
| [Colorion](https://colorion.co/) | 417 个 CSS 动效 | MIT |
| [Lieflat Charts](https://github.com/larashero3-dotcom/lieflat-charts) | 39 种细读图表 | PolyForm Noncommercial |
| [mp4-muxer](https://github.com/Vanilagy/mp4-muxer) | 写 MP4 文件 | MIT |
| [寒蝉德黑体 / ChillDIN](https://github.com/Warren2060/ChillDIN-ChillDINGothic) | 字体 | OFL |
| [Kinetics](https://kinetics.colorion.co/) | 162 个界面组件的效果清单。代码自写 | 参考 |
| [Verse Text](https://verse.rajatsethii.in/) | 错位印刷的效果。代码自写 | 参考 |
| [uiarc / arc-library](https://github.com/kuratlielia/arc-library) | 30 个组件的效果和动效参数。代码自写 | MIT |

Lieflat Charts 的条款限定非商业用途。商用视频：选其余 694 种动效，或购买作者的授权。

授权原文：`vendor/`、`fonts/`、`mac/Resources/licenses/`。App 的「关于」页列出全部来源。
