import SwiftUI

// 分镜表：A/B 轨道、景别调度、口播、拍摄指导和动效，一表看全
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
            .width(min: 50, ideal: 68, max: 120)
            TableColumn("类型与景别") { shot in
                HStack(spacing: 6) {
                    TrackButton(shot: shot) { next in
                        if let i = board.rows.firstIndex(where: { $0.id == shot.id }) { board.rows[i] = next }
                    }
                    if !shot.shotSize.isEmpty, !shot.isMotion {
                        Text([shot.shotSize, shot.cameraMove].filter { !$0.isEmpty }.joined(separator: "·"))
                            .font(.system(size: 12))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
            }
            .width(min: 130, ideal: 175, max: 230)
            TableColumn("口播") { shot in
                Text(shot.line).lineLimit(3).help(shot.line)
            }
            .width(min: 220, ideal: 380)
            TableColumn("拍摄与后期指导") { shot in
                let guide = [shot.shootGuide.isEmpty ? shot.visual : shot.shootGuide, shot.postGuide].filter { !$0.isEmpty }.joined(separator: " ｜ ")
                Text(guide).lineLimit(3).foregroundStyle(.secondary).help(guide)
            }
            .width(min: 160, ideal: 260)
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
            .width(min: 110, ideal: 145, max: 200)
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
