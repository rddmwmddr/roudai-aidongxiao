import SwiftUI

// 界面上不写提示，手势和快捷键都收在这一页
struct HelpView: View {
    private let rows: [(String, String)] = [
        ("生成分镜", "文稿页：粘贴文字或拖入文件，按「生成分镜」"),
        ("文稿格式", "Word、WPS、Pages、PPT、Keynote、Excel、Numbers、PDF、epub、网页、字幕、纯文本、图片。扫描版和图片：文字识别"),
        ("接入 AI", "设置 > AI。钥匙串保存 Key。生成结果核对文稿数字"),
        ("选中元素", "点画面里的元素。成群元素选中整群"),
        ("选其中一个", "双击。Esc：回到整群"),
        ("多选", "Shift + 点击"),
        ("移动", "拖动元素或按方向键。Shift + 方向键：10 格"),
        ("改大小和高度", "拖选框手柄。上边手柄：拉高。文字的角手柄：保持比例"),
        ("旋转", "拖选框上方圆点。Shift：15° 一格"),
        ("改速度", "拖时间条两头。短：快。长：慢"),
        ("改出现时间", "拖时间条中段"),
        ("填具体数值", "格子输入，或拖格子左边的字"),
        ("关掉吸附", "⌘ + 拖动"),
        ("播放或暂停", "空格"),
        ("上一镜、下一镜", "⌘↑、⌘↓"),
        ("改一镜的时长", "拖片段右边缘"),
        ("换效果", "点片段上方胶囊"),
        ("拆分一镜", "时间线：B，拆在播放头。脚本框：回车，拆在光标处"),
        ("组合几镜", "时间线：⌘ 或 ⇧ 点片段，右键组合。脚本框：选中几句，右键组合；退格：并回上一句"),
        ("重新匹配", "右键片段或句子"),
        ("切换页面", "⌘1 文稿、⌘2 画面、⌘3 分镜表"),
        ("撤销", "⌘Z。一个动作一步"),
        ("导入 A-roll", "⇧⌘A，或拖入视频、音频。本机识别，零上传"),
    ]

    var body: some View {
        Grid(alignment: .leadingFirstTextBaseline, horizontalSpacing: 18, verticalSpacing: 7) {
            ForEach(rows, id: \.0) { row in
                GridRow {
                    Text(row.0).foregroundStyle(.secondary)
                    Text(row.1).fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .padding(24)
        .frame(width: 560)
    }
}
