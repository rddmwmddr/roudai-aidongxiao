import AppKit
import SwiftUI

// Mark a word/sentence on the original screenshot. The same normalized rectangle is used in export.
struct PaperArticleCropView: View {
    let source: String
    let focus: [Double] // normalized center x/y, width/height
    let update: ([Double]) -> Void
    @State private var image: NSImage?
    @State private var selection: CGRect?

    var body: some View {
        GeometryReader { geo in
            if let image {
                let scale = min(geo.size.width / image.size.width, geo.size.height / image.size.height)
                let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
                let origin = CGPoint(x: (geo.size.width-size.width)/2, y: (geo.size.height-size.height)/2)
                let saved = CGRect(x: origin.x + (focus[0]-focus[2]/2)*size.width, y: origin.y + (focus[1]-focus[3]/2)*size.height, width: focus[2]*size.width, height: focus[3]*size.height)
                ZStack(alignment: .topLeading) {
                    Color.black.opacity(0.06)
                    Image(nsImage: image).resizable().frame(width: size.width, height: size.height).offset(x: origin.x, y: origin.y)
                    let rect = selection ?? saved
                    Rectangle().fill(Color.yellow.opacity(0.3)).overlay(Rectangle().stroke(Color.orange, lineWidth: 1.5))
                        .frame(width: rect.width, height: rect.height).offset(x: rect.minX, y: rect.minY)
                }
                .contentShape(Rectangle())
                .gesture(DragGesture(minimumDistance: 2).onChanged { value in
                    selection = rectangle(value.startLocation, value.location, origin: origin, size: size)
                }.onEnded { value in
                    let rect = rectangle(value.startLocation, value.location, origin: origin, size: size)
                    if rect.width / size.width >= 0.005, rect.height / size.height >= 0.005 {
                        update([(rect.midX-origin.x)/size.width, (rect.midY-origin.y)/size.height, rect.width/size.width, rect.height/size.height])
                    }
                    selection = nil
                })
                .accessibilityLabel("拖动框选报道中的目标词句")
            }
        }
        .frame(height: 190)
        .task(id: source) {
            guard let data = source.split(separator: ",", maxSplits: 1).last.flatMap({ Data(base64Encoded: String($0)) }) else { image = nil; return }
            image = NSImage(data: data)
        }
    }

    private func rectangle(_ a: CGPoint, _ b: CGPoint, origin: CGPoint, size: CGSize) -> CGRect {
        let x1 = min(max(a.x,origin.x),origin.x+size.width), x2 = min(max(b.x,origin.x),origin.x+size.width)
        let y1 = min(max(a.y,origin.y),origin.y+size.height), y2 = min(max(b.y,origin.y),origin.y+size.height)
        return CGRect(x: min(x1,x2), y: min(y1,y2), width: abs(x1-x2), height: abs(y1-y2))
    }
}
