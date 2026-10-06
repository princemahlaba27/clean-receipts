import Foundation

enum AppConfig {
    /// RevenueCat public SDK key. Safe to ship in the app binary.
    static let revenueCatAPIKey = "appl_bktuWdyiFioaDjjLrHLUpZfwpWv"

    /// Dashboard identifier for the shared entitlement. All three products attach to it.
    static let entitlementID = "Clean Receipts Pro"
    static let weeklyProductID = "cleanreceipts_weekly_intro"
    static let annualProductID = "cleanreceipts_annual_trial"
    static let monthlyDownsellProductID = "cleanreceipts_monthly_downsell"
    static let downsellOfferingID = "downsell"

    static let termsURL = URL(string: "https://cleanreceipts.app/terms.html")!
    static let privacyURL = URL(string: "https://cleanreceipts.app/privacy.html")!

    /// Illustrative rate for the vault caption. Not tax advice.
    static let estimatedTaxRate = 0.24

    static var allProductIDs: Set<String> {
        [weeklyProductID, annualProductID, monthlyDownsellProductID]
    }

    static var hasRevenueCatKey: Bool {
        revenueCatAPIKey.hasPrefix("appl_")
            && !revenueCatAPIKey.contains("REPLACE_WITH")
            && revenueCatAPIKey.count > 12
    }
}
