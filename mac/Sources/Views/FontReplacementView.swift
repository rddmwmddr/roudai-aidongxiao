import SwiftUI
import UniformTypeIdentifiers

// 主工具栏里的字体面板。选择即生效，和预览、导出共用原来的字体库。
struct FontReplacementView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var library = FontLibrary.shared
    @State private var showImporter = false
    @State private var errorText: String?
    @State private var askingFont: UUID?

    private let fontTypes: [UTType] = [.font, UTType(filenameExtension: "woff") ?? .data, UTType(filenameExtension: "woff2") ?? .data]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("替换字体")
                .font(.headline)
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Form {
                        ForEach(FontLibrary.Slot.allCases) { slot in
                            Picker(slot.label, selection: Binding(get: { library.assignment[slot.rawValue] }, set: { library.assign(slot, to: $0) })) {
                                Text("默认").tag(UUID?.none)
                                ForEach(library.entries) { e in
                                    Text(e.name).tag(UUID?.some(e.id))
                                }
                            }
                            .named("\(slot.label)字体")
                        }
                    }
                    .formStyle(.columns)
                    if !library.entries.isEmpty {
                        Divider()
                        ForEach(library.entries) { e in
                            HStack {
                                Text(e.name).lineLimit(1).help(e.name)
                                Spacer()
                                // 删除文件不可恢复，沿用原地确认。
                                ConfirmDeleteButton(symbol: "trash", label: "删除\(e.name)", confirmTitle: "删除字体", asking: Binding(get: { askingFont == e.id }, set: { askingFont = $0 ? e.id : nil })) {
                                    library.remove(e)
                                }
                            }
                            .followsMorph(askingFont)
                        }
                    }
                    if let errorText {
                        Label(errorText, systemImage: "exclamationmark.circle")
                            .foregroundStyle(.red)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            HStack {
                Button("导入字体…") { showImporter = true }
                    .buttonStyle(.pill(size: .small))
                    .named("导入字体…")
                Spacer()
                Button("完成") { dismiss() }
                    .buttonStyle(.pill(size: .small))
                    .keyboardShortcut(.cancelAction)
                    .named("完成替换字体")
            }
        }
        .padding(20)
        .frame(width: 440, height: 360)
        .fileImporter(isPresented: $showImporter, allowedContentTypes: fontTypes, allowsMultipleSelection: true) { result in
            switch result {
            case .success(let urls):
                errorText = nil
                for url in urls {
                    do {
                        _ = try library.add(url)
                    } catch {
                        errorText = error.localizedDescription
                    }
                }
            case .failure(let error):
                errorText = error.localizedDescription
            }
        }
    }
}
