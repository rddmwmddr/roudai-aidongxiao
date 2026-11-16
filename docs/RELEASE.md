# 正式发布

1.7（build 13）包含纸张与拼贴四模板、纸面文字编辑、中途停顿、音效导入与自动节拍，以及已有调研模板、AI 动效设计与本地动效包功能。

## 签名与公证

本次正式 App 由 Developer ID Application 签名，附有 Apple 公证票据。`codesign --verify --deep --strict`、`xcrun stapler validate` 和 `spctl -a -vvv -t exec` 均通过。支持 Apple 芯片及 Intel，App 与 `dm-motion` 辅助程序均为通用架构。

本机旧 Developer ID 私钥缺失时，不需要撤销旧证书或降低系统安全设置。在 Xcode → Settings → Apple Accounts 登录原开发者团队，使用 `TEAM=<团队ID> tools/build_cloud_release.sh` 归档，再由 Xcode 自动进行云端 Developer ID 签名和 Apple 公证。账号验证由本人在 Xcode 完成，不把密码或验证码写入脚本。

若 Apple 仍在处理，可稍后重试：

```sh
xcodebuild -exportNotarizedApp -archivePath 'mac/成品/Cloud-Release.xcarchive' -exportPath 'mac/成品/Cloud-Notarized'
```

下载提供 DMG 和 ZIP，二者包含同一个已签名、已装订公证票据的 App。本次 DMG 是安装容器，容器本身未单独签名或公证；公证对象是其中的 App。不要改动 App 包内文件，以免破坏签名。拥有本地 Developer ID 私钥及 notarytool 配置时，也可使用 `tools/build_app.sh` 对 DMG 一并公证。

## 使用与验收

- 安装后打开「动效 → 纸张与拼贴」，选择文字匹配剪辑、纸张剪贴、折纸展开或杂志剪字。
- 暂停后双击纸面文字复制、粘贴、修改；「这一镜 → 中途停顿与音效」编辑停顿和音效。
- 演示工程：`examples/paper/可编辑文字-中途停顿-音效.dmboard`。附带的研究数字及原声均为演示数据。
- 测试视频：发布附件 `Paper-Pause-Audio.mp4`、`Number-Auto-Sync.mp4`，均为原生 App 导出的 1080p、60fps、双声道 AAC 文件。
- 四模板渲染与导出、文本修改、保存恢复、停顿和音频编码已验证。合并后的原生测试报告为 13 组共 50 项通过；测试进程在完成后遇到 Xcode/macOS 的窗口 KVO 清理异常，整套检查脚本退出非零，此问题未伪装为全套命令通过。
