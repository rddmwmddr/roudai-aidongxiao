# 文字、停顿与音效 · 1.6 build11

安装路径：`/Applications/肉呆爱动效-调研开发版.app`。启动示例：`examples/paper/可编辑文字-中途停顿-音效.dmboard`。构建命令：`tools/run_dev.sh --build-only`。

## 操作

- 暂停后双击纸面文字，在文字框中选中复制、粘贴、修改，点击「应用文字」。关键词、前后文、栏目、正文、标题、说明写回同一份项目配置。多行正文编辑完整原文。导入的截图是图片，不会自动 OCR；需要修改截图中的字时，将原文粘贴到文字排版字段并清除该页图片。
- 「这一镜 → 中途停顿与音效」：在当前画面加入停顿，输入位置和秒数，或拖动滑块。位置以原动效时间计，加入停顿自动增加镜头时长，原有变化速度保持不变。已有调研模板同样适用。
- 自动节拍支持数字计数器、纸张切换、剪字入场与折纸起点。数字根据实际数值变化触发，变化快时节拍更密，最大频率可调；停顿不重复触发。其他模板可手动摆放音效，尚不自动推断语义。
- 内置数字轻点、翻纸摩擦、轻弹入场，均由确定性信号合成。支持本地 WAV、MP3、M4A 等系统可解码音频，每项最多20MB、600秒。素材内嵌保存，不依赖外链。导入后可在自动音效下拉框选用，或添加手动片段。
- 手动片段可编辑素材、起点（可拖动）、裁切头尾、音量、速度、淡入淡出。预览暂停、拖动与循环会同步声音位置。

## AI 共用格式

沿用 `row.motion`，新增 `audio` 和 `timeline.pauses`。旧工程自动补齐空停顿与关闭音效。

```json
{
  "timeline":{"duration":7,"entrance":0.3,"hold":1,"inPoint":0,"outPoint":1,"currentTime":0,"pauses":[{"id":"read-1","at":2,"duration":1}]},
  "audio":{"enabled":true,"gain":0.7,"auto":{"enabled":true,"sourceId":"builtin:tick","volume":0.45,"maxPerSecond":12},"assets":[],"clips":[]}
}
```

`timeline.duration` 包含停顿；`pauses[].at` 是去除停顿后的动效位置，按位置递增。`assets[]` 保存 `{id,name,src,duration}`，音频src为内嵌data URI。`clips[]` 保存 `{id,sourceId,start,trimStart,trimEnd,volume,rate,fadeIn,fadeOut}`，裁切以源音频秒数计，其余时间以项目秒数计。sourceId引用素材ID或 `builtin:tick/paper/pop`。参数、引用及范围统一校验，错误返回具体字段。

精简调用示例（以下为演示数据）：

```json
{"data":{"keyframes":[[0,0],[1,100]]},"audio":{"enabled":true,"auto":{"enabled":true}},"timeline":{"duration":7,"pauses":[{"id":"pause-1","at":2,"duration":1}]}}
```

`node tools/opus.mjs from-ai number-counter input.json` 生成经过校验的配置。AI 与人工编辑同一JSON，继续支持撤销、保存和重开。

## 实现与验证

停顿统一映射项目时间到原动效时间，Canvas可定位任意帧。声音确定性离线混音，预览使用同一缓冲区；导出复用H.264与MP4封装，增加48kHz双声道AAC。峰值过高时整段统一降低增益，避免削波。

本机AAC延迟通过离线脉冲编码/解码校准，MP4 edit list去除预延迟。只在编码结尾flush，避免中途重复延迟。封装库扩展及保留许可证见 `vendor/MP4-AUDIO-PATCH.md`。

`tests/motion_media.mjs` 覆盖双击文字编辑、停顿滑块、音效导入、手动片段、时间冻结、帧率切换和AAC导出；`MotionMediaTests` 覆盖真实WebKit与原生导出。实际解码中，设在0.200秒的声音约在0.2001秒出现，中途停顿区间无重复节拍。

原创无字褶皱纸纹、内置 imagegen 模式及完整生成提示保留在 `assets/paper/GENERATION.md`。材质内嵌到App，文字仍由Canvas排版。`wrinkleStrength`、`texture`、`inkWear` 分别控制褶皱光影、细纹和油墨颗粒。

最终安装包1.6（build11）在实际窗口中完成文字复制/粘贴/修改、停留控件修改、WAV导入及片段起点编辑，保存重开后还原。最终成片在 `质检/paper/1.6原生导出/`：7.3秒纸张停顿与声音、7秒数字自动节拍，均1920×1080、60fps、48kHz双声道AAC。外部完整解码通过，相关性检测声音偏移0个采样，停顿声音峰值0；对应JSON报告同目录。WebKit返回的完整AAC ES描述符已转换为标准ASC，避免仅时长通过而音轨无法解码。
