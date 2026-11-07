import SwiftUI

// 关于：感谢这些作者。动效的来源、授权都列在这里，非商用授权的要带上条款
struct AboutView: View {
    private struct Credit: Identifiable {
        let name: String
        let author: String
        let use: String
        let license: String
        let url: String
        var id: String { name }
    }

    private let motion = [
        Credit(name: "Motion Prompt", author: "Shohei Ohtaki", use: "14 个文字动效", license: "MIT", url: "https://github.com/showheyohtaki/motion-prompt"),
        Credit(name: "Lieflat Charts", author: "躺在废墟里", use: "编辑部风格图表", license: "PolyForm Noncommercial", url: "https://github.com/larashero3-dotcom/lieflat-charts"),
        Credit(name: "Colorion", author: "Csaba Kissi", use: "417 个 CSS 动效", license: "MIT", url: "https://colorion.co/"),
        Credit(name: "Kinetics", author: "Csaba Kissi", use: "162 个界面组件的清单", license: "参考，代码没有用", url: "https://kinetics.colorion.co/"),
        Credit(name: "uiarc / arc-library", author: "Elia Kuratli", use: "30 个组件：文字、数字、图表、交互", license: "MIT，代码自写", url: "https://github.com/kuratlielia/arc-library"),
        Credit(name: "Verse Text", author: "Rajat Sethi", use: "错位印刷文字效果", license: "参考，代码没有用", url: "https://verse.rajatsethii.in/"),
        Credit(name: "video-shotcraft", author: "Vincentwei1021", use: "文字和数据动效的手法", license: "见原仓库", url: "https://github.com/Vincentwei1021/video-shotcraft"),
        Credit(name: "garden-skills", author: "ConardLi", use: "动效手法", license: "见原仓库", url: "https://github.com/ConardLi/garden-skills"),
        Credit(name: "Remotion", author: "Remotion", use: "时间驱动动画的思路", license: "见原仓库", url: "https://github.com/remotion-dev/remotion"),
        Credit(name: "Metalforge", author: "metalforge.xyz", use: "细小的动画参考", license: "参考", url: "https://metalforge.xyz/"),
    ]

    private let rest = [
        Credit(name: "寒蝉德黑体 / ChillDIN", author: "Warren2060", use: "字体", license: "OFL", url: "https://github.com/Warren2060/ChillDIN-ChillDINGothic"),
        Credit(name: "mp4-muxer", author: "Vanilagy", use: "写 MP4 文件", license: "MIT", url: "https://github.com/Vanilagy/mp4-muxer"),
        Credit(name: "Video Editor", author: "Kawsar Ahmed", use: "界面参考", license: "参考", url: "https://dribbble.com/shots/24782216-Video-Editor"),
        Credit(name: "Swishy", author: "swishy.ai", use: "动效分类参考", license: "参考", url: "https://www.swishy.ai/"),
        Credit(name: "Interactions", author: "khagwal.com", use: "按钮状态参考", license: "参考", url: "https://khagwal.com/interactions/"),
        Credit(name: "Skills", author: "Emil Kowalski、Jakub Krehel", use: "动效和界面规范", license: "参考", url: "https://github.com/emilkowalski/skills"),
    ]

    private var version: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? ""
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(spacing: 12) {
                Image(nsImage: NSApp.applicationIconImage)
                    .resizable()
                    .frame(width: 48, height: 48)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("肉呆爱动效").font(.title3.weight(.semibold))
                    Text(version).foregroundStyle(.secondary).monospacedDigit()
                }
            }
            section("感谢这些动效的作者", motion)
            section("还用到了", rest)
            Text("Lieflat Charts 只授权用于非商业用途。条款：polyformproject.org/licenses/noncommercial/1.0.0")
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(24)
        .frame(width: 620)
    }

    private func section(_ title: String, _ items: [Credit]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title).fontWeight(.medium).padding(.bottom, 6)
            ForEach(items) { c in
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Link(c.name, destination: URL(string: c.url)!)
                        .frame(width: 160, alignment: .leading)
                    Text(c.author).foregroundStyle(.secondary).frame(maxWidth: .infinity, alignment: .leading)
                    Text(c.use).foregroundStyle(.secondary).frame(width: 170, alignment: .trailing)
                }
                .padding(.vertical, 5)
                .overlay(alignment: .bottom) { Divider().opacity(0.6) }
                .help(c.license)
            }
        }
    }
}
