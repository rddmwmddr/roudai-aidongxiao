import AppKit
import SwiftUI

extension Color {
    static let trackARoll = Color(light: 0x1F6FEB, dark: 0xE4F56B)
    static let trackMotion = Color(light: 0xEE3A17, dark: 0xFF5C1E)
    static let trackShoot = Color(light: 0xD95B16, dark: 0xFF9F38)
    static let trackFootage = Color(light: 0x0969DA, dark: 0x5AC8FA)

    static func forTrack(_ track: String) -> Color {
        switch track {
        case "aroll": .trackARoll
        case "shoot": .trackShoot
        case "footage": .trackFootage
        default: .trackMotion
        }
    }
}

// 轨道切换按钮：在画面顶栏、分镜板卡片和分镜表里都能一键改镜头归属
struct TrackButton: View {
    let shot: Shot
    var floating = false
    let onChange: (Shot) -> Void

    private static let options: [(String, String, String)] = [
        ("aroll", "A-roll 出镜", "person.crop.rectangle"),
        ("motion", "B-roll 动效", "sparkles"),
        ("shoot", "B-roll 实拍", "camera.aperture"),
        ("footage", "B-roll 素材", "doc.richtext"),
    ]

    private var icon: String {
        Self.options.first { $0.0 == shot.track }?.2 ?? "sparkles"
    }

    var body: some View {
        Menu {
            ForEach(Self.options, id: \.0) { key, label, symbol in
                Button {
                    guard shot.track != key else { return }
                    var next = shot
                    next.track = key
                    onChange(next)
                } label: {
                    if shot.track == key {
                        Label(label, systemImage: "checkmark")
                    } else {
                        Label(label, systemImage: symbol)
                    }
                }
            }
        } label: {
            HStack(spacing: 5) {
                Circle()
                    .fill(Color.forTrack(shot.track))
                    .frame(width: 7, height: 7)
                Image(systemName: icon)
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                Text(shot.trackLabel)
                    .fontWeight(.medium)
                    .lineLimit(1)
            }
            .padding(.horizontal, floating ? 11 : 7)
            .frame(height: floating ? 30 : 22)
            .contentShape(Capsule())
            .modifier(TrackPillSurface(floating: floating))
        }
        .menuStyle(.borderlessButton)
        .menuIndicator(.hidden)
        .fixedSize()
        .named("轨道")
        .help("切换 A-roll 出镜、动效、实拍或素材")
    }
}

private struct TrackPillSurface: ViewModifier {
    let floating: Bool

    @ViewBuilder
    func body(content: Content) -> some View {
        if floating {
            content.glass(in: Capsule(), interactive: true)
        } else {
            content.background(Color.deskWell, in: Capsule())
        }
    }
}

// 分镜板：宫格看全片 A/B 节奏、景别调度、构图示意、实拍指令与动效配置
struct StoryboardGridView: View {
    @Binding var board: Board
    let rows: [Shot]
    @Binding var selection: Shot.ID?
    @Binding var filter: ShotFilter
    @ObservedObject var stage: StageController
    let names: [String: String]
    let onExportSheet: () -> Void
    let onOpenStage: (Shot.ID) -> Void
    @State private var seconds: [Shot.ID: Double] = [:]

    private let columns = [GridItem(.adaptive(minimum: 310, maximum: 430), spacing: 14, alignment: .top)]

    private var groupedChapters: [(chapter: String, shots: [Shot])] {
        var order: [String] = []
        var map: [String: [Shot]] = [:]
        for s in rows {
            if map[s.chapter] == nil { order.append(s.chapter) }
            map[s.chapter, default: []].append(s)
        }
        return order.map { ($0, map[$0] ?? []) }
    }

    private func trackCount(_ track: String) -> Int {
        board.rows.filter { $0.track == track }.count
    }

    var body: some View {
        VStack(spacing: 0) {
            summaryBar
            Divider().opacity(0.35)
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 20) {
                    ForEach(groupedChapters, id: \.chapter) { group in
                        VStack(alignment: .leading, spacing: 10) {
                            HStack(alignment: .firstTextBaseline, spacing: 8) {
                                Text(group.chapter)
                                    .font(.system(size: 15, weight: .semibold))
                                Text("\(group.shots.count) 镜")
                                    .font(.system(size: 12).monospacedDigit())
                                    .foregroundStyle(.secondary)
                                Spacer()
                            }
                            .padding(.horizontal, 4)
                            LazyVGrid(columns: columns, spacing: 14) {
                                ForEach(group.shots) { shot in
                                    StoryboardCard(
                                        shot: shot,
                                        selected: selection == shot.id,
                                        duration: shot.duration ?? seconds[shot.id],
                                        stage: stage,
                                        names: names,
                                        onSelect: { selection = shot.id },
                                        onOpenStage: { onOpenStage(shot.id) },
                                        onUpdate: { next in
                                            if let i = board.rows.firstIndex(where: { $0.id == shot.id }) {
                                                board.rows[i] = next
                                            }
                                        }
                                    )
                                }
                            }
                        }
                    }
                }
                .padding(16)
            }
        }
        .background(Color.deskBase)
        .task(id: rows) {
            seconds = await stage.durations(rows)
        }
    }

    private var summaryBar: some View {
        HStack(spacing: 8) {
            filterChip("全部 \(board.rows.count)", .all, dot: nil)
            filterChip("A-roll \(trackCount("aroll"))", .track("aroll"), dot: .trackARoll)
            filterChip("动效 \(trackCount("motion"))", .track("motion"), dot: .trackMotion)
            filterChip("实拍 \(trackCount("shoot"))", .track("shoot"), dot: .trackShoot)
            filterChip("素材 \(trackCount("footage"))", .track("footage"), dot: .trackFootage)
            Spacer()
            Button(action: onExportSheet) {
                Label("导出分镜拍摄单", systemImage: "doc.richtext")
            }
            .buttonStyle(.pill())
            .named("导出分镜拍摄单")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    private func filterChip(_ title: String, _ target: ShotFilter, dot: Color?) -> some View {
        let active = filter == target
        return Button {
            filter = active && target != .all ? .all : target
        } label: {
            HStack(spacing: 6) {
                if let dot {
                    Circle().fill(dot).frame(width: 7, height: 7)
                }
                Text(title)
                    .font(.system(size: 12, weight: active ? .semibold : .regular).monospacedDigit())
            }
            .padding(.horizontal, 11)
            .frame(height: 26)
            .background(active ? Color.white.opacity(0.18) : Color.deskWell, in: Capsule())
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .foregroundStyle(active ? .primary : .secondary)
        .named("筛选\(title)")
    }
}

private struct StoryboardCard: View {
    let shot: Shot
    let selected: Bool
    let duration: Double?
    @ObservedObject var stage: StageController
    let names: [String: String]
    let onSelect: () -> Void
    let onOpenStage: () -> Void
    let onUpdate: (Shot) -> Void
    @State private var thumb: NSImage?

    private var framingLine: String {
        let parts = [shot.shotSize, shot.cameraMove, shot.subject].filter { !$0.isEmpty }
        return parts.isEmpty ? shot.visual : parts.joined(separator: " · ")
    }

    private var shootLine: String {
        if !shot.shootGuide.isEmpty { return shot.shootGuide }
        return shot.visual
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            thumbnailBox
            HStack(spacing: 6) {
                TrackButton(shot: shot, onChange: onUpdate)
                if shot.isMotion {
                    MotionButton(shot: shot, stage: stage, names: names, onPick: onUpdate)
                } else {
                    Text(framingLine)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
                if !shot.note.isEmpty {
                    ReviewDot().help(shot.note)
                }
            }
            Text(shot.line.isEmpty ? "（无口播）" : shot.line)
                .font(.system(size: 13))
                .lineLimit(3)
                .frame(maxWidth: .infinity, alignment: .leading)
                .help(shot.line)
            if !shootLine.isEmpty || !shot.postGuide.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    if !shootLine.isEmpty {
                        guideRow(symbol: shot.track == "footage" ? "doc.text.magnifyingglass" : "video", text: shootLine)
                    }
                    if !shot.postGuide.isEmpty {
                        guideRow(symbol: "scissors", text: shot.postGuide)
                    }
                }
                .padding(8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.black.opacity(0.22), in: RoundedRectangle(cornerRadius: 8))
            }
        }
        .padding(10)
        .background(Color.deskWell, in: RoundedRectangle(cornerRadius: 12))
        .overlay {
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(selected ? Color.lime : Color.white.opacity(0.08), lineWidth: selected ? 2 : 1)
        }
        .contentShape(RoundedRectangle(cornerRadius: 12))
        .onTapGesture(count: 2, perform: onOpenStage)
        .onTapGesture(perform: onSelect)
        .contextMenu {
            Button("在画面里打开", action: onOpenStage)
            Divider()
            Button("设为 A-roll 出镜") { setTrack("aroll") }
            Button("设为 B-roll 动效") { setTrack("motion") }
            Button("设为 B-roll 实拍") { setTrack("shoot") }
            Button("设为 B-roll 素材") { setTrack("footage") }
        }
        .named("分镜卡\(shot.no)")
        .task(id: shot.json) {
            thumb = await stage.shotFrame(shot)
        }
    }

    private func setTrack(_ nextTrack: String) {
        var next = shot
        next.track = nextTrack
        onUpdate(next)
    }

    private var thumbnailBox: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8).fill(Color.black)
            if let thumb {
                Image(nsImage: thumb)
                    .resizable()
                    .aspectRatio(16 / 9, contentMode: .fit)
            }
        }
        .aspectRatio(16 / 9, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(alignment: .topLeading) {
            HStack(spacing: 5) {
                Text(shot.no)
                    .font(.system(size: 11, weight: .semibold).monospacedDigit())
                    .foregroundStyle(.white)
                Text(shot.trackLabel)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(shot.track == "aroll" ? Color.black : Color.white)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 1)
                    .background(Color.forTrack(shot.track), in: Capsule())
            }
            .padding(.horizontal, 7)
            .padding(.vertical, 4)
            .background(Color.black.opacity(0.62), in: Capsule())
            .padding(7)
        }
        .overlay(alignment: .bottomTrailing) {
            if let duration {
                Text(String(format: "%.1fs", duration))
                    .font(.system(size: 11, weight: .medium).monospacedDigit())
                    .foregroundStyle(.white)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.black.opacity(0.62), in: RoundedRectangle(cornerRadius: 5))
                    .padding(7)
            }
        }
    }

    private func guideRow(symbol: String, text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Image(systemName: symbol)
                .font(.system(size: 10))
                .foregroundStyle(.secondary)
                .frame(width: 12)
            Text(text)
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .help(text)
        }
    }
}
