import SwiftUI

// 画面、属性条（选中元素才有，在渲染页里）都在这个网页视图里
struct StageWebHost: NSViewRepresentable {
    let web: StageWebView
    let visible: Bool

    func makeNSView(context: Context) -> NSView {
        let container = NSView()
        web.translatesAutoresizingMaskIntoConstraints = false
        web.removeFromSuperview()
        container.addSubview(web)
        NSLayoutConstraint.activate([
            web.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            web.topAnchor.constraint(equalTo: container.topAnchor),
            web.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])
        web.isHidden = !visible
        return container
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        web.isHidden = !visible
    }
}

// 元素清单：选画面里点不到的东西（辉光、颗粒、背景），也是键盘和旁白的路径
struct ElementList: View {
    let shot: Shot
    @ObservedObject var stage: StageController

    private var tops: [StageElement] { stage.elements.filter { $0.parent == nil } }

    private func children(of id: String) -> [StageElement] {
        stage.elements.filter { $0.parent == id }
    }

    private var layers: [String: JSONValue] {
        shot.layers(for: shot.template)?.object ?? [:]
    }

    var body: some View {
        VStack(spacing: 0) {
            List(selection: Binding(get: { Set(stage.selection) }, set: { stage.select(Array($0)) })) {
                ForEach(tops) { e in
                    let kids = children(of: e.id)
                    if kids.isEmpty {
                        row(e).tag(e.id)
                    } else {
                        DisclosureGroup {
                            ForEach(kids) { k in
                                row(k).tag(k.id)
                            }
                        } label: {
                            row(e)
                        }
                        .tag(e.id)
                    }
                }
            }
            .listStyle(.plain)
            Divider()
            HStack {
                Spacer()
                Button("还原这一镜") { stage.resetElements() }
                    .buttonStyle(.pill(.quiet, size: .small))
                    .disabled(layers.isEmpty)
                    .named("还原这一镜")
            }
            .padding(8)
        }
        .frame(width: 300, height: 420)
    }

    private func row(_ e: StageElement) -> some View {
        let hidden = layers[e.id]?.object?["hidden"]?.bool ?? false
        return HStack(spacing: 6) {
            Text(e.label)
                .lineLimit(1)
                .foregroundStyle(hidden ? .secondary : .primary)
                .help(e.label)
            Spacer(minLength: 4)
            Button {
                stage.setHidden(e.id, !hidden)
            } label: {
                Image(systemName: hidden ? "eye.slash" : "eye")
            }
            .buttonStyle(.icon(diameter: 22, faint: !hidden))
            .named(hidden ? "显示\(e.label)" : "隐藏\(e.label)")
        }
    }
}
