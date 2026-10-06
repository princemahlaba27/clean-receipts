import SwiftUI

struct ScannerOverlayView: View {
    var body: some View {
        GeometryReader { geo in
            let width = geo.size.width
            let height = geo.size.height
            let length = min(28, min(width, height) * 0.18)
            Path { path in
                path.move(to: CGPoint(x: 0, y: length))
                path.addLine(to: .zero)
                path.addLine(to: CGPoint(x: length, y: 0))

                path.move(to: CGPoint(x: width - length, y: 0))
                path.addLine(to: CGPoint(x: width, y: 0))
                path.addLine(to: CGPoint(x: width, y: length))

                path.move(to: CGPoint(x: 0, y: height - length))
                path.addLine(to: CGPoint(x: 0, y: height))
                path.addLine(to: CGPoint(x: length, y: height))

                path.move(to: CGPoint(x: width - length, y: height))
                path.addLine(to: CGPoint(x: width, y: height))
                path.addLine(to: CGPoint(x: width, y: height - length))
            }
            .stroke(
                Color.industrialYellow,
                style: StrokeStyle(lineWidth: 3, lineCap: .square, lineJoin: .miter)
            )
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}
