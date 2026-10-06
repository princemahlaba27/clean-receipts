import Foundation
import SwiftData

enum ReceiptCategory: String, CaseIterable, Identifiable, Codable {
    case meals = "Meals & Dining"
    case travel = "Travel & Transport"
    case office = "Office Supplies"
    case fuel = "Fuel"
    case software = "Software"
    case other = "Other"

    var id: String { rawValue }

    var symbolName: String {
        switch self {
        case .meals: return "fork.knife"
        case .travel: return "airplane"
        case .office: return "paperclip"
        case .fuel: return "fuelpump.fill"
        case .software: return "laptopcomputer"
        case .other: return "tag.fill"
        }
    }
}

enum TaxQuarter: Int, CaseIterable, Identifiable {
    case all = 0
    case q1 = 1
    case q2 = 2
    case q3 = 3
    case q4 = 4

    var id: Int { rawValue }

    var title: String {
        self == .all ? "All" : "Q\(rawValue)"
    }

    func contains(month: Int) -> Bool {
        switch self {
        case .all:
            return true
        case .q1:
            return (1...3).contains(month)
        case .q2:
            return (4...6).contains(month)
        case .q3:
            return (7...9).contains(month)
        case .q4:
            return (10...12).contains(month)
        }
    }
}

@Model
final class ReceiptPage {
    var id: UUID
    var index: Int
    @Attribute(.externalStorage) var imageData: Data
    var receipt: ReceiptItem?

    init(id: UUID = UUID(), index: Int, imageData: Data) {
        self.id = id
        self.index = index
        self.imageData = imageData
    }
}

@Model
final class ReceiptItem {
    @Attribute(.unique) var id: UUID
    var merchant: String
    var amount: Double
    var subtotal: Double
    var tax: Double
    var date: Date
    var categoryRaw: String
    var referenceCode: String
    var currencyCode: String
    var createdAt: Date
    @Relationship(deleteRule: .cascade, inverse: \ReceiptPage.receipt)
    var pages: [ReceiptPage]

    var category: ReceiptCategory {
        get { ReceiptCategory(rawValue: categoryRaw) ?? .other }
        set { categoryRaw = newValue.rawValue }
    }

    var formattedDate: String {
        ReceiptDateFormat.ledger.string(from: date)
    }

    var orderedPages: [ReceiptPage] {
        var seen: Set<UUID> = []
        return pages
            .sorted { $0.index < $1.index }
            .filter { seen.insert($0.id).inserted }
    }

    init(
        id: UUID = UUID(),
        merchant: String,
        amount: Double,
        subtotal: Double,
        tax: Double,
        date: Date,
        category: ReceiptCategory,
        referenceCode: String,
        currencyCode: String = "USD",
        createdAt: Date = Date(),
        pageData: [Data] = []
    ) {
        self.id = id
        self.merchant = merchant
        self.amount = amount
        self.subtotal = subtotal
        self.tax = tax
        self.date = date
        self.categoryRaw = category.rawValue
        self.referenceCode = referenceCode
        self.currencyCode = currencyCode
        self.createdAt = createdAt
        self.pages = []
        for (index, data) in pageData.enumerated() {
            pages.append(ReceiptPage(index: index, imageData: data))
        }
    }

}

private enum ReceiptDateFormat {
    static let ledger: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}
