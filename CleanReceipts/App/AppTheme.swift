import SwiftUI
import UIKit

extension Color {
    static let obsidian = Color(red: 7.0 / 255.0, green: 9.0 / 255.0, blue: 14.0 / 255.0)
    static let surfaceGlass = Color(red: 17.0 / 255.0, green: 21.0 / 255.0, blue: 31.0 / 255.0)
    static let surfaceBorder = Color(red: 29.0 / 255.0, green: 35.0 / 255.0, blue: 51.0 / 255.0)
    static let industrialYellow = Color(red: 1.0, green: 229.0 / 255.0, blue: 0.0)
    static let industrialYellowDim = Color(red: 204.0 / 255.0, green: 183.0 / 255.0, blue: 0.0)
    static let labelSecondary = Color(red: 138.0 / 255.0, green: 146.0 / 255.0, blue: 166.0 / 255.0)
    static let destructiveRed = Color(red: 1.0, green: 69.0 / 255.0, blue: 58.0 / 255.0)
}

struct GlassCardModifier: ViewModifier {
    var radius: CGFloat = 16

    func body(content: Content) -> some View {
        content
            .background {
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .fill(Color.surfaceGlass.opacity(0.85))
                    .overlay {
                        RoundedRectangle(cornerRadius: radius, style: .continuous)
                            .strokeBorder(Color.surfaceBorder, lineWidth: 1)
                    }
            }
    }
}

extension View {
    func glassCard(radius: CGFloat = 16) -> some View {
        modifier(GlassCardModifier(radius: radius))
    }
}

struct YellowCapsuleButtonStyle: ButtonStyle {
    var enabled: Bool = true

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(Color.obsidian)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(
                (configuration.isPressed ? Color.industrialYellowDim : Color.industrialYellow)
                    .opacity(enabled ? 1 : 0.4),
                in: Capsule()
            )
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

enum Haptics {
    static func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle) {
        let generator = UIImpactFeedbackGenerator(style: style)
        generator.prepare()
        generator.impactOccurred()
    }

    static func success() {
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(.success)
    }
}
