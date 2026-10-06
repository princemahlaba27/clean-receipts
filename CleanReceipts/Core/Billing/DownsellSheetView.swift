import SwiftUI

struct DownsellSheetView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(SubscriptionManager.self) private var subscriptions

    var onPurchased: () -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("MONTH-END OFFER")
                        .font(.caption.weight(.bold))
                        .tracking(0.6)
                        .foregroundStyle(Color.obsidian)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Color.industrialYellow, in: Capsule())

                    Text("Wait! Special Month-End Bookkeeping Offer")
                        .font(.title.bold())
                        .foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)

                    Text("Get your first month of unlimited exports for just \(subscriptions.downsellIntroPrice).")
                        .font(.body)
                        .foregroundStyle(Color.labelSecondary)
                        .fixedSize(horizontal: false, vertical: true)

                    VStack(alignment: .leading, spacing: 6) {
                        Text("First month")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Color.labelSecondary)
                        Text(subscriptions.downsellIntroPrice)
                            .font(.system(size: 40, weight: .bold, design: .rounded))
                            .foregroundStyle(Color.industrialYellow)
                        Text("Then \(subscriptions.downsellRenewalPrice) per month")
                            .font(.subheadline)
                            .foregroundStyle(.white)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(18)
                    .glassCard()

                    Button(action: purchase) {
                        if subscriptions.isLoading {
                            ProgressView()
                                .tint(Color.obsidian)
                        } else {
                            Text("Claim 1st Month for \(subscriptions.downsellIntroPrice)")
                        }
                    }
                    .buttonStyle(YellowCapsuleButtonStyle(enabled: canPurchase && !subscriptions.isLoading))
                    .disabled(!canPurchase || subscriptions.isLoading)

                    Text(disclosure)
                        .font(.caption)
                        .foregroundStyle(Color.labelSecondary)
                        .fixedSize(horizontal: false, vertical: true)

                    if !canPurchase {
                        Text(subscriptions.lastError ?? "Loading the monthly plan…")
                            .font(.caption)
                            .foregroundStyle(Color.labelSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    } else if let lastError = subscriptions.lastError {
                        Text(lastError)
                            .font(.caption)
                            .foregroundStyle(Color.destructiveRed)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    Button("No thanks, I'll pass") {
                        dismiss()
                    }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color.labelSecondary)
                    .frame(maxWidth: .infinity)

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
        subscriptions.isPro || subscriptions.isDownsellReady
    }

    private var disclosure: String {
        "\(subscriptions.downsellIntroPrice) for the first month, then \(subscriptions.downsellRenewalPrice) per month. Subscription automatically renews until canceled. Cancel anytime in Settings > Apple ID > Subscriptions."
    }

    private func purchase() {
        Task {
            if subscriptions.isPro {
                onPurchased()
                dismiss()
                return
            }
            let success = await subscriptions.purchaseDownsell()
            if success {
                Haptics.success()
                onPurchased()
                dismiss()
            }
        }
    }
}
