import SwiftUI

private enum PaywallPlan {
    case weekly
    case annual
}

struct PaywallView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(SubscriptionManager.self) private var subscriptions

    var onPurchased: () -> Void

    @State private var selection: PaywallPlan = .weekly

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("TAX COMPLIANCE & EXPORT ENGINE")
                        .font(.caption.weight(.bold))
                        .tracking(0.6)
                        .foregroundStyle(Color.obsidian)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Color.industrialYellow, in: Capsule())

                    Text("Export Audit-Ready Reports")
                        .font(.largeTitle.bold())
                        .foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)

                    VStack(alignment: .leading, spacing: 12) {
                        benefit("Audit-ready PDF ledger with receipt images", systemImage: "doc.richtext")
                        benefit("CSV export for spreadsheets", systemImage: "tablecells")
                        benefit("On-device storage, included in your iPhone backup", systemImage: "lock.iphone")
                    }
                    .padding(.top, 4)

                    VStack(spacing: 10) {
                        planButton(
                            title: "Weekly",
                            price: "\(subscriptions.weeklyIntroPrice) for 7 days",
                            detail: "then \(subscriptions.weeklyRenewalPrice)/week",
                            selected: selection == .weekly
                        ) {
                            selection = .weekly
                        }
                        planButton(
                            title: "Annual",
                            price: "\(subscriptions.annualPrice) / year",
                            detail: "3-day free trial · Save 89% · $3.33/mo",
                            selected: selection == .annual
                        ) {
                            selection = .annual
                        }
                    }

                    Button(action: purchase) {
                        if subscriptions.isLoading {
                            ProgressView()
                                .tint(Color.obsidian)
                        } else {
                            Text(ctaTitle)
                        }
                    }
                    .buttonStyle(YellowCapsuleButtonStyle(enabled: canPurchase && !subscriptions.isLoading))
                    .disabled(!canPurchase || subscriptions.isLoading)

                    Text(disclosure)
                        .font(.caption)
                        .foregroundStyle(Color.labelSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    if !canPurchase {
                        Text(subscriptions.lastError ?? "Loading plans…")
                            .font(.caption)
                            .foregroundStyle(Color.labelSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    } else if let lastError = subscriptions.lastError {
                        Text(lastError)
                            .font(.caption)
                            .foregroundStyle(Color.destructiveRed)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    LegalFooter {
                        onPurchased()
                        dismiss()
                    }
                }
                .padding(24)
                .frame(maxWidth: 560)
                .frame(maxWidth: .infinity)
            }
            .background(Color.obsidian.ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.body.weight(.semibold))
                            .foregroundStyle(Color.labelSecondary)
                    }
                    .accessibilityLabel("Close")
                }
            }
            .toolbarBackground(Color.obsidian, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .presentationBackground(Color.obsidian)
        .task {
            await subscriptions.start()
        }
    }

    private var canPurchase: Bool {
        if subscriptions.isPro { return true }
        switch selection {
        case .weekly:
            return subscriptions.isWeeklyReady
        case .annual:
            return subscriptions.isAnnualReady
        }
    }

    private var ctaTitle: String {
        if subscriptions.isPro { return "Continue to Export" }
        switch selection {
        case .weekly:
            return "Start 7-Day Access for \(subscriptions.weeklyIntroPrice)"
        case .annual:
            return "Start 3-Day Free Trial"
        }
    }

    private var disclosure: String {
        let renewal = "Subscription automatically renews until canceled. Cancel anytime in Settings > Apple ID > Subscriptions."
        switch selection {
        case .weekly:
            return "\(subscriptions.weeklyIntroPrice) for the first 7 days, then \(subscriptions.weeklyRenewalPrice) per week. \(renewal)"
        case .annual:
            return "3-day free trial, then \(subscriptions.annualPrice) per year. \(renewal)"
        }
    }

    private func purchase() {
        Task {
            if subscriptions.isPro {
                onPurchased()
                dismiss()
                return
            }
            let success: Bool
            switch selection {
            case .weekly:
                success = await subscriptions.purchaseWeekly()
            case .annual:
                success = await subscriptions.purchaseAnnual()
            }
            if success {
                Haptics.success()
                onPurchased()
                dismiss()
            }
        }
    }

    private func benefit(_ text: String, systemImage: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: systemImage)
                .foregroundStyle(Color.industrialYellow)
                .frame(width: 22)
            Text(text)
                .font(.subheadline)
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func planButton(
        title: String,
        price: String,
        detail: String,
        selected: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.headline)
                        .foregroundStyle(.white)
                    Text(price)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.industrialYellow)
                    Text(detail)
                        .font(.caption)
                        .foregroundStyle(Color.labelSecondary)
                }
                Spacer(minLength: 8)
                Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(selected ? Color.industrialYellow : Color.labelSecondary)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.surfaceGlass.opacity(0.85), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(selected ? Color.industrialYellow : Color.surfaceBorder, lineWidth: selected ? 1.5 : 1)
            }
        }
        .buttonStyle(.plain)
    }
}

struct LegalFooter: View {
    @Environment(SubscriptionManager.self) private var subscriptions
    var onRestored: () -> Void
    @State private var note: String?

    var body: some View {
        VStack(spacing: 14) {
            Button("Restore Purchases") {
                Task {
                    let restored = await subscriptions.restore()
                    if restored {
                        Haptics.success()
                        onRestored()
                    } else {
                        note = subscriptions.lastError ?? "No purchases to restore."
                    }
                }
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(Color.industrialYellow)
            .disabled(subscriptions.isLoading)

            if let note {
                Text(note)
                    .font(.caption)
                    .foregroundStyle(Color.labelSecondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }

            HStack(spacing: 16) {
                Link("Terms of Use (EULA)", destination: AppConfig.termsURL)
                Link("Privacy Policy", destination: AppConfig.privacyURL)
            }
            .font(.footnote)
            .foregroundStyle(Color.labelSecondary)
            .tint(Color.labelSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 8)
    }
}
