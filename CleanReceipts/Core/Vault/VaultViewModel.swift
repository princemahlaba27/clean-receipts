import Foundation
import SwiftData

struct MonthSection: Identifiable {
    var year: Int
    var month: Int
    var receipts: [ReceiptItem]
    var total: Double

    var id: String { "\(year)-\(month)" }
}

enum VaultMath {
    static func total(of items: [ReceiptItem]) -> Double {
        items.reduce(0) { $0 + $1.amount }
    }

    static func estimatedSavings(for amount: Double) -> Double {
        (amount * AppConfig.estimatedTaxRate * 100).rounded() / 100
    }

    static func monthSections(from items: [ReceiptItem], calendar: Calendar = .current) -> [MonthSection] {
        let grouped = Dictionary(grouping: items) { item in
            let year = calendar.component(.year, from: item.date)
            let month = calendar.component(.month, from: item.date)
            return "\(year)-\(month)"
        }
        return grouped.compactMap { key, value in
            let parts = key.split(separator: "-")
            guard parts.count == 2, let year = Int(parts[0]), let month = Int(parts[1]) else {
                return nil
            }
            let sorted = value.sorted {
                if $0.date != $1.date { return $0.date > $1.date }
                return $0.createdAt > $1.createdAt
            }
            return MonthSection(year: year, month: month, receipts: sorted, total: total(of: sorted))
        }
        .sorted { lhs, rhs in
            if lhs.year != rhs.year { return lhs.year > rhs.year }
            return lhs.month > rhs.month
        }
    }

    static func monthTitle(year: Int, month: Int, calendar: Calendar = .current) -> String {
        let symbols = calendar.monthSymbols
        let index = min(max(month - 1, 0), symbols.count - 1)
        return "\(symbols[index]) \(year)"
    }
}

@MainActor
struct VaultViewModel {
    var context: ModelContext

    func saveNew(
        merchant: String,
        amount: Double,
        subtotal: Double,
        tax: Double,
        date: Date,
        category: ReceiptCategory,
        referenceCode: String,
        pageData: [Data]
    ) throws {
        let item = ReceiptItem(
            merchant: merchant,
            amount: amount,
            subtotal: subtotal,
            tax: tax,
            date: date,
            category: category,
            referenceCode: referenceCode,
            pageData: pageData
        )
        context.insert(item)
        for page in item.orderedPages {
            if page.receipt == nil {
                page.receipt = item
            }
            context.insert(page)
        }
        try context.save()
    }

    func update(
        _ item: ReceiptItem,
        merchant: String,
        amount: Double,
        subtotal: Double,
        tax: Double,
        date: Date,
        category: ReceiptCategory,
        referenceCode: String
    ) throws {
        item.merchant = merchant
        item.amount = amount
        item.subtotal = subtotal
        item.tax = tax
        item.date = date
        item.category = category
        item.referenceCode = referenceCode
        try context.save()
    }

    func delete(_ item: ReceiptItem) throws {
        context.delete(item)
        try context.save()
    }

    func recategorize(_ item: ReceiptItem, to category: ReceiptCategory) throws {
        item.category = category
        try context.save()
    }
}
