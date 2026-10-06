import RevenueCat
import SwiftData
import SwiftUI

@main
struct CleanReceiptsApp: App {
    @State private var subscriptions = SubscriptionManager.shared

    init() {
        SubscriptionManager.configureIfNeeded()
    }

    var body: some Scene {
        WindowGroup {
            VaultListView()
                .environment(subscriptions)
                .preferredColorScheme(.dark)
                .tint(Color.industrialYellow)
                .task {
                    await subscriptions.start()
                }
        }
        .modelContainer(for: [ReceiptItem.self, ReceiptPage.self])
    }
}
