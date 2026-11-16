# 肉呆爱动效 · 动效包协议 v1

想在 App 里生成或修改动效，可在动效选择器打开「AI 做动效」。这个页面用于连接外部工作文件夹和 Agent。

在 macOS App 的「设置 → 动效包」选择一个工作文件夹。Agent 可以用随 App 安装的 `dm-motion` 命令，也可以直接编辑该文件夹里的 UTF-8 文件 `motion-pack.dmotion.json`。直接编辑时，建议先写到同目录的临时文件，再原子替换目标文件。保存通过校验后，打开的画面和之后开始的导出会采用新配置。App 会保存最后一份通过校验的本机副本，换新版 DMG 后也会恢复。文件缺失、权限需要重新授予或 JSON 校验失败时，会继续使用副本。重新连接原目录即可继续热更新。要停用覆盖，请在设置里断开文件夹，或保存一个空包 `{"version":1}`。分镜使用了本机模板时，把动效包一起交给同事。

## 给 Agent 哪些资料

- **让 Agent 创建、修改或预览动效**　把「复制协议给 Agent」和「复制 Agent 命令」的内容一起发过去。协议说明怎么写，命令告诉 Agent 去哪里查动效、保存和预览。
- **只给 Agent 文件资料**　发送协议和工作文件夹路径。改内置动效时，可以附上「复制内置动效名称和 ID」得到的清单。清单把界面名称和文件里的 ID 对应起来。例如「一百根」对应 `comb`。修改它用 `"target": "comb"`，拿它做底稿用 `"base": "comb"`。
- **只改某个元素**　Agent 可以用 `get` 查样例里的元素 ID。要指定当前分镜中的元素，可以在画面顶部打开「元素」列表，右键复制该元素的 ID。

下面这段可以直接发给 Agent。

> 把「一百根」的默认主色改成 `#84CC16`，保留其他设置。用 Agent 命令保存，再生成一个 GIF 给我看。

## Agent 命令

App 1.4.0 起附带 `dm-motion`。复制的命令已经包含 App 路径和工作文件夹路径，末尾的 `list` 可以换成下面任一子命令。Agent 通过本机终端运行，当前用户需要有相应的文件权限。成功时在标准输出返回 JSON，失败时在标准错误返回带 `error` 的 JSON，并以非零状态退出。命令无需 AI Key，JSON 内容由 Agent 根据需求和协议生成。

| 子命令 | 用途 |
| --- | --- |
| `list` | 列出可用动效，含名称、ID、来源及是否被本机覆盖。 |
| `get comb` | 查看动效详情、当前包里的条目、样例数据、字段和样例中的元素 ID。 |
| `validate` | 按 App 的规则校验整个工作文件夹里的动效包。 |
| `upsert template.json` | 新增或替换本机模板。传一个 `templates` 条目，编辑时先读 `get` 的 `entry`，保留需要的字段后交回完整条目。 |
| `remove local.number-card` | 按 ID 移除本机模板。已经引用它的分镜需要换模板或重新载入该模板。 |
| `override comb patch.json` | 新增或替换内置动效的覆盖。传包含 `defaults`、`layers` 或 `overlays` 的完整覆盖配置，目标 ID 由命令参数指定。 |
| `reset comb` | 移除本机覆盖，恢复该动效的内置设置。 |
| `preview comb preview.gif` | 使用 App 渲染引擎，按样例数据生成 480 × 270 GIF。 |
| `preview comb preview.gif row.json` | 用一个分镜 JSON 对象生成 GIF。数据不符合该动效要求时返回原因。 |

例如，改「一百根」配色时，先用 `get comb` 查看当前覆盖，再把 `{"defaults":{"colors":{"primary":"#84CC16"}}}` 合入现有配置，保存为 `patch.json`，运行 `override comb patch.json`。最后运行 `preview comb preview.gif`，把返回的 `file` 交给用户预览。`sample: true` 表示用了样例数据。GIF 会压缩至最多 4 秒，返回值中的 `duration` 是动效原时长。想先预览草稿再应用，可以把当前动效包复制到临时工作文件夹，用该路径作为 `--workspace` 写入和预览，定稿后再保存到 App 连接的文件夹。

## 示例

```json
{
  "version": 1,
  "templates": [
    {
      "id": "local.team-title",
      "name": "团队标题卡",
      "description": "沿用重音字幕的布局，给团队统一配色",
      "base": "statement",
      "defaults": {"theme": "paper"},
      "layers": {"text": {"color": "#365314"}}
    },
    {
      "id": "local.number-card",
      "name": "强调卡",
      "duration": 3,
      "defaults": {"colors": {"bg": "#101014"}},
      "elements": [
        {"id": "accent", "type": "rect", "x": 160, "y": 410, "width": 18, "height": 180, "color": "#84CC16", "enter": "pop"},
        {"id": "headline", "type": "text", "x": 220, "y": 500, "size": 88, "color": "#FFFFFF", "bind": "line", "enter": "slide", "start": 0.2}
      ]
    }
  ],
  "overrides": [
    {
      "target": "comb",
      "defaults": {"colors": {"primary": "#84CC16"}},
      "layers": {"bars:0": {"alpha": 0.9, "delay": 0.15}},
      "overlays": [
        {"id": "total-title", "type": "text", "text": "总共5000人", "x": 80, "y": 60, "size": 48, "color": "#FFFFFF"}
      ]
    }
  ]
}
```

## 字段

- `version` 必须为整数 `1`。`templates` 和 `overrides` 都可省略，每项最多 40 条。文件最多 256 KB。
- 新模板的 `id` 以 `local.` 开头，用小写英文字母、数字、点、下划线或连字符。定稿后保持 ID 不变，分镜用这个 ID 找回模板。`name` 是动效库显示的名称，`description` 可选。
- 以 `base` 引用一个内置模板 ID 时，沿用原模板的绘制逻辑及数据结构。也可用 `elements` 描述自己的图形和文字，单个模板最多 48 个元素，`duration` 默认为 4 秒。
- App 1.6.0 起，内置动效覆盖和使用 `base` 的本机模板都可以用 `overlays` 添加独立文字图层，最多 48 个。图层的 `type` 写 `text`，默认直接显示，可以双击更改当前分镜的文案。通过 `layers` 调整样式时，在 ID 前加 `overlay:`，例如 `overlay:total-title`。
- App 1.6.1 起，文字可以用 `"bind": "sampleSize", "text": "总共{sampleSize}人"` 绑定当前分镜的人数。优先读取分镜的 `sampleSize` 正整数，留空时从该镜口播识别。未识别出明确人数时隐藏这层文字，可在检查器的「内容」里填写样本人数。
- 声明元素使用 1920 × 1080 的画布坐标，`x`、`y` 从左上角算。矩形和椭圆使用 `width`、`height`，文字使用 `size` 和 `text`，或用 `bind` 取本镜 `line`、`title`。`color` 用六位十六进制。`enter` 支持 `fade`、`slide`、`pop`、`none`，`start`、`seconds` 的单位是秒。图形与文字都可以在 App 里点选。
- `overrides[].target` 是要覆盖的内置模板 ID，同一 ID 只写一次。`defaults` 支持 `theme`（`black` 或 `paper`）、`colors`、`speed`（倍数）和 `hold`（秒）。颜色键由原模板决定，常见键有 `bg`、`primary`、`secondary`。
- `layers` 按元素 ID 配置默认调整，支持 `alpha`（0–1）、`hidden`、`color`、`speed`、`delay`（秒）和六值矩阵 `m`。矩阵格式是 `[a,b,c,d,tx,ty]`，位移用画布像素。当前分镜的手动调整优先，分镜矩阵会叠加在模板矩阵之上。
- v1 只读取声明式 JSON。通过新增图层、组合入场效果、复用或覆盖内置模板可以扩展效果。
