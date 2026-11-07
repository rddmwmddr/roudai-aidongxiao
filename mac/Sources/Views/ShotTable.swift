import SwiftUI

// 分镜表：哪一句对应哪个动效，一眼看全
struct ShotTable: View {
    @Binding var board: Board
    let rows: [Shot]
    @Binding var selection: Set<Shot.ID>
    @ObservedObject var stage: StageController
    let names: [String: String]
    let open: (Shot.ID) -> Void

    var body: some View {
        Table(rows, selection: $selection) {
            TableColumn("序号") { shot in
                Text(shot.no).monospacedDigit().foregroundStyle(.tertiary)
            }
            .width(min: 38, ideal: 44, max: 56)
            TableColumn("章节") { shot in
                Text(shot.chapter).lineLimit(1).foregroundStyle(.secondary)
            }
            .width(min: 50, ideal: 64, max: 120)
            TableColumn("口播") { shot in
                Text(shot.line).lineLimit(3).help(shot.line)
            }
            .width(min: 260, ideal: 460)
            TableColumn("画面") { shot in
                Text(shot.visual).lineLimit(3).foregroundStyle(.secondary).help(shot.visual)
            }
            .width(min: 120, ideal: 220)
            TableColumn("动效") { shot in
                HStack(spacing: 8) {
                    MotionButton(shot: shot, stage: stage, names: names) { next in
                        if let i = board.rows.firstIndex(where: { $0.id == shot.id }) { board.rows[i] = next }
                    }
                    Spacer(minLength: 0)
                    if !shot.note.isEmpty {
                        ReviewDot().help(shot.note)
                    }
                }
            }
            .width(min: 120, ideal: 150, max: 200)
        }
        .tableStyle(.inset(alternatesRowBackgrounds: false))
        .scrollContentBackground(.hidden)
        .background(Color.deskBase)
        .contextMenu(forSelectionType: Shot.ID.self) { ids in
            if let id = ids.first {
                Button("在画面里打开") { open(id) }
            }
        } primaryAction: { ids in
            if let id = ids.first { open(id) }
        }
    }
}
