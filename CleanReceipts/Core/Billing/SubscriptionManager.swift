import Foundation
import Observation
import os
import RevenueCat
import StoreKit

@MainActor
@Observable
final class SubscriptionManager {
    static let shared = SubscriptionManager()

    private(set) var isPro = false
    private(set) var isLoading = false
    private(set) var weeklyPackage: Package?
    private(set) var annualPackage: Package?
    private(set) var downsellPackage: Package?
    private(set) var storeProducts: [String: Product] = [:]
    var lastError: String?

    private var didStartListeners = false
    private let logger = Logger(subsystem: "com.cleanreceipts.app", category: "billing")

    private init() {}

    static func configureIfNeeded() {
        guard AppConfig.hasRevenueCatKey, !Purchases.isConfigured else { return }
        Purchases.logLevel = .warn
        Purchases.configure(withAPIKey: AppConfig.revenueCatAPIKey)
    }

    var weeklyRenewalPrice: String {
        price(package: weeklyPackage, productID: AppConfig.weeklyProductID, fallback: "$6.99")
    }

    var weeklyIntroPrice: String {
        introPrice(package: weeklyPackage, productID: AppConfig.weeklyProductID, fallback: "$0.99")
    }

    var annualPrice: String {
        price(package: annualPackage, productID: AppConfig.annualProductID, fallback: "$39.99")
    }

    var downsellRenewalPrice: String {
        price(package: downsellPackage, productID: AppConfig.monthlyDownsellProductID, fallback: "$4.99")
    }

    var downsellIntroPrice: String {
        introPrice(package: downsellPackage, productID: AppConfig.monthlyDownsellProductID, fallback: "$1.99")
    }

    var isWeeklyReady: Bool { weeklyPackage != nil || storeProducts[AppConfig.weeklyProductID] != nil }
    var isAnnualReady: Bool { annualPackage != nil || storeProducts[AppConfig.annualProductID] != nil }
    var isDownsellReady: Bool { downsellPackage != nil || storeProducts[AppConfig.monthlyDownsellProductID] != nil }

    func start() async {
        if Purchases.isConfigured {
            startRevenueCatListenerIfNeeded()
            await refreshOfferings()
            await refreshRevenueCatEntitlement()
        } else {
            await loadStoreProducts()
            await refreshStoreKitEntitlements()
            startStoreKitListenerIfNeeded()
        }
    }

    func purchaseWeekly() async -> Bool {
        await purchase(productID: AppConfig.weeklyProductID, package: weeklyPackage)
    }

    func purchaseAnnual() async -> Bool {
        await purchase(productID: AppConfig.annualProductID, package: annualPackage)
    }

    func purchaseDownsell() async -> Bool {
        await purchase(productID: AppConfig.monthlyDownsellProductID, package: downsellPackage)
    }

    func restore() async -> Bool {
        lastError = nil
        isLoading = true
        defer { isLoading = false }
        if Purchases.isConfigured {
            do {
                let info = try await Purchases.shared.restorePurchases()
                apply(customerInfo: info)
                if !isPro {
                    lastError = "No active subscription was found for this Apple ID."
                }
                return isPro
            } catch {
                lastError = error.localizedDescription
                logger.error("Restore failed: \(error.localizedDescription, privacy: .public)")
                return false
            }
        }

        do {
            try await AppStore.sync()
            await refreshStoreKitEntitlements()
            if !isPro {
                lastError = "No active subscription was found for this Apple ID."
            }
            return isPro
        } catch {
            lastError = error.localizedDescription
            return false
        }
    }

    private func purchase(productID: String, package: Package?) async -> Bool {
        lastError = nil
        isLoading = true
        defer { isLoading = false }

        if Purchases.isConfigured {
            guard let package else {
                lastError = "This plan is not available yet. Check the RevenueCat offering."
                return false
            }
            do {
                let result = try await Purchases.shared.purchase(package: package)
                if result.userCancelled { return false }
                apply(customerInfo: result.customerInfo)
                if !isPro {
                    lastError = "Purchase finished, but Pro access is not active yet."
                }
                return isPro
            } catch {
                lastError = error.localizedDescription
                logger.error("Purchase failed: \(error.localizedDescription, privacy: .public)")
                return false
            }
        }

        guard let product = storeProducts[productID] else {
            lastError = AppConfig.hasRevenueCatKey
                ? "This plan is not available yet."
                : "This plan is not loaded. In Xcode, run with Configuration.storekit, or add a RevenueCat key in AppConfig."
            return false
        }

        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                let transaction = try checkVerified(verification)
                await transaction.finish()
                await refreshStoreKitEntitlements()
                if !isPro {
                    lastError = "Purchase finished, but Pro access is not active yet."
                }
                return isPro
            case .userCancelled:
                return false
            case .pending:
                lastError = "Purchase is pending approval."
                return false
            @unknown default:
                lastError = "The App Store could not complete this purchase."
                return false
            }
        } catch {
            lastError = error.localizedDescription
            return false
        }
    }

    private func startRevenueCatListenerIfNeeded() {
        guard !didStartListeners else { return }
        didStartListeners = true
        Task { @MainActor in
            for await info in Purchases.shared.customerInfoStream {
                self.apply(customerInfo: info)
            }
        }
    }

    private func startStoreKitListenerIfNeeded() {
        guard !didStartListeners else { return }
        didStartListeners = true
        Task { @MainActor in
            for await update in Transaction.updates {
                if let transaction = try? self.checkVerified(update) {
                    await transaction.finish()
                    await self.refreshStoreKitEntitlements()
                }
            }
        }
    }

    private func refreshOfferings() async {
        do {
            let offerings = try await Purchases.shared.offerings()
            weeklyPackage = find(AppConfig.weeklyProductID, in: offerings)
            annualPackage = find(AppConfig.annualProductID, in: offerings)
            if let downsellOffering = offerings.offering(identifier: AppConfig.downsellOfferingID) {
                downsellPackage = downsellOffering.availablePackages.first {
                    $0.storeProduct.productIdentifier == AppConfig.monthlyDownsellProductID
                } ?? downsellOffering.availablePackages.first
            }
            if downsellPackage == nil {
                downsellPackage = find(AppConfig.monthlyDownsellProductID, in: offerings)
            }
        } catch {
            lastError = error.localizedDescription
            logger.error("Offerings failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    private func refreshRevenueCatEntitlement() async {
        do {
            let info = try await Purchases.shared.customerInfo()
            apply(customerInfo: info)
        } catch {
            logger.error("Customer info failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    private func loadStoreProducts() async {
        do {
            let products = try await Product.products(for: Array(AppConfig.allProductIDs))
            var mapped: [String: Product] = [:]
            for product in products {
                mapped[product.id] = product
            }
            storeProducts = mapped
            if mapped.isEmpty {
                lastError = "No subscription products were returned. Select Configuration.storekit in the scheme, or add a RevenueCat key."
            } else {
                lastError = nil
            }
        } catch {
            lastError = error.localizedDescription
        }
    }

    private func refreshStoreKitEntitlements() async {
        var active = false
        for await result in Transaction.currentEntitlements {
            guard let transaction = try? checkVerified(result) else { continue }
            if AppConfig.allProductIDs.contains(transaction.productID) {
                active = true
            }
        }
        isPro = active
    }

    private func apply(customerInfo: CustomerInfo) {
        isPro = customerInfo.entitlements[AppConfig.entitlementID]?.isActive == true
    }

    private func find(_ productID: String, in offerings: Offerings) -> Package? {
        for offering in offerings.all.values {
            if let match = offering.availablePackages.first(where: { $0.storeProduct.productIdentifier == productID }) {
                return match
            }
        }
        return nil
    }

    private func price(package: Package?, productID: String, fallback: String) -> String {
        if let package {
            return package.storeProduct.localizedPriceString
        }
        if let product = storeProducts[productID] {
            return product.displayPrice
        }
        return fallback
    }

    private func introPrice(package: Package?, productID: String, fallback: String) -> String {
        if let discount = package?.storeProduct.introductoryDiscount, discount.paymentMode != .freeTrial {
            return discount.localizedPriceString
        }
        if let offer = storeProducts[productID]?.subscription?.introductoryOffer, offer.paymentMode != .freeTrial {
            return offer.displayPrice
        }
        return fallback
    }

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified:
            throw BillingError.unverified
        case .verified(let value):
            return value
        }
    }
}

private enum BillingError: LocalizedError {
    case unverified

    var errorDescription: String? {
        "The App Store could not verify this purchase."
    }
}
