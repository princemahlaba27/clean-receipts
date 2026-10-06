import ImageIO
import UIKit
import Vision

struct ParsedReceipt: Equatable {
    var merchant: String
    var total: Double
    var subtotal: Double?
    var tax: Double?
    var date: Date
    var referenceCode: String
    var category: ReceiptCategory
}

enum ReceiptMoney {
    static func parse(_ raw: String) -> Double? {
        var text = raw
            .replacingOccurrences(of: "$", with: "")
            .replacingOccurrences(of: "USD", with: "")
            .replacingOccurrences(of: "usd", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        text = text.filter { "0123456789.,".contains($0) }
        guard !text.isEmpty else { return nil }

        let hasComma = text.contains(",")
        let hasDot = text.contains(".")
        if hasComma && hasDot {
            if let lastComma = text.lastIndex(of: ","), let lastDot = text.lastIndex(of: ".") {
                if lastDot > lastComma {
                    text = text.replacingOccurrences(of: ",", with: "")
                } else {
                    text = text.replacingOccurrences(of: ".", with: "")
                    text = text.replacingOccurrences(of: ",", with: ".")
                }
            }
        } else if hasComma {
            let parts = text.split(separator: ",", omittingEmptySubsequences: false)
            if parts.count == 2, let fraction = parts.last, fraction.count <= 2 {
                text = text.replacingOccurrences(of: ",", with: ".")
            } else {
                text = text.replacingOccurrences(of: ",", with: "")
            }
        }

        guard let value = Double(text), value >= 0, value < 1_000_000 else { return nil }
        return value
    }

    static func values(in line: String) -> [Double] {
        guard let regex = try? NSRegularExpression(
            pattern: #"\$?\s*(?:\d{1,3}(?:[.,]\d{3})+[.,]\d{2}|\d+[.,]\d{2})"#
        ) else {
            return []
        }
        let range = NSRange(line.startIndex..., in: line)
        return regex.matches(in: line, range: range).compactMap { match in
            guard let matchRange = Range(match.range, in: line) else { return nil }
            return parse(String(line[matchRange]))
        }
    }
}

final class VisionOCRService {
    static let shared = VisionOCRService()

    func parseReceipt(from image: UIImage) async -> ParsedReceipt {
        let lines = await recognizeLines(in: image)
        return extractMetadata(from: lines)
    }

    func extractMetadata(from lines: [String]) -> ParsedReceipt {
        let merchant = detectMerchant(in: lines) ?? "Store Receipt"
        let subtotal = labeledAmount(in: lines, keywords: ["subtotal", "sub-total", "sub total"])
        let tax = labeledAmount(in: lines, keywords: ["tax", "vat", "gst"])
        let total = detectTotal(in: lines) ?? 0
        let date = detectDate(in: lines) ?? Date()
        let reference = detectReference(in: lines)
        let category = suggestCategory(merchant: merchant, lines: lines)
        return ParsedReceipt(
            merchant: merchant,
            total: total,
            subtotal: subtotal,
            tax: tax,
            date: date,
            referenceCode: reference,
            category: category
        )
    }

    private func recognizeLines(in image: UIImage) async -> [String] {
        guard let cgImage = image.cgImage else { return [] }
        let orientation = image.cgImagePropertyOrientation
        return await withCheckedContinuation { continuation in
            DispatchQueue.global(qos: .userInitiated).async {
                let lines = Self.performRecognition(cgImage: cgImage, orientation: orientation)
                continuation.resume(returning: lines)
            }
        }
    }

    private static func performRecognition(cgImage: CGImage, orientation: CGImagePropertyOrientation) -> [String] {
        let accurate = VNRecognizeTextRequest()
        accurate.recognitionLevel = .accurate
        accurate.usesLanguageCorrection = true
        accurate.recognitionLanguages = ["en-US"]
        let handler = VNImageRequestHandler(cgImage: cgImage, orientation: orientation, options: [:])
        do {
            try handler.perform([accurate])
            return orderedLines(from: accurate.results as? [VNRecognizedTextObservation])
        } catch {
            let fallback = VNRecognizeTextRequest()
            fallback.recognitionLevel = .accurate
            fallback.usesLanguageCorrection = true
            let retry = VNImageRequestHandler(cgImage: cgImage, orientation: orientation, options: [:])
            do {
                try retry.perform([fallback])
                return orderedLines(from: fallback.results as? [VNRecognizedTextObservation])
            } catch {
                return []
            }
        }
    }

    private static func orderedLines(from observations: [VNRecognizedTextObservation]?) -> [String] {
        guard let observations else { return [] }
        let sorted = observations.sorted { lhs, rhs in
            let delta = lhs.boundingBox.midY - rhs.boundingBox.midY
            if abs(delta) > 0.015 {
                return lhs.boundingBox.midY > rhs.boundingBox.midY
            }
            return lhs.boundingBox.minX < rhs.boundingBox.minX
        }
        return sorted.compactMap { $0.topCandidates(1).first?.string }
    }

    private func detectMerchant(in lines: [String]) -> String? {
        let candidates = lines.prefix(6).compactMap { line -> String? in
            let clean = line.trimmingCharacters(in: .whitespacesAndNewlines)
            return isLikelyMerchant(clean) ? clean : nil
        }
        if let banner = candidates.first(where: { $0 == $0.uppercased() && $0.filter(\.isLetter).count >= 3 }) {
            return banner
        }
        return candidates.first
    }

    private func isLikelyMerchant(_ line: String) -> Bool {
        guard line.count > 2 else { return false }
        let lower = line.lowercased()
        let banned = [
            "cash receipt", "receipt", "thank you", "description", "price", "subtotal", "sub-total",
            "total", "tax", "qty", "amount", "change", "visa", "mastercard", "debit",
            "credit", "reference", "approval", "invoice", "date:", "date ", "tel",
            "phone", "www", "http", "address"
        ]
        if banned.contains(where: { lower.contains($0) }) { return false }
        if line.contains("$") || line.contains("%") { return false }
        if line.first?.isNumber == true { return false }
        if firstDate(in: line) != nil { return false }
        let letters = line.filter(\.isLetter)
        return letters.count >= 3
    }

    private func detectTotal(in lines: [String]) -> Double? {
        if let total = lastAmount(in: lines, where: { lower in
            lower.contains("total")
                && !lower.contains("subtotal")
                && !lower.contains("sub-total")
                && !lower.contains("sub total")
        }) {
            return total
        }
        if let due = lastAmount(in: lines, where: { lower in
            lower.contains("balance") || lower.contains("amount due") || lower.contains("amount paid")
        }) {
            return due
        }
        return lines.flatMap { ReceiptMoney.values(in: $0) }.max()
    }

    private func labeledAmount(in lines: [String], keywords: [String]) -> Double? {
        lastAmount(in: lines) { lower in
            keywords.contains { lower.contains($0) }
        }
    }

    private func lastAmount(in lines: [String], where predicate: (String) -> Bool) -> Double? {
        for line in lines.reversed() {
            guard predicate(line.lowercased()) else { continue }
            if let value = ReceiptMoney.values(in: line).last {
                return value
            }
        }
        return nil
    }

    private func detectReference(in lines: [String]) -> String {
        let pattern = #"(?i)\b(?:approval(?:\s*code)?|auth(?:orization)?(?:\s*code)?|ref(?:erence)?|invoice(?:\s*(?:no|number))?)\b\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-]{2,})"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return "" }
        for line in lines {
            let range = NSRange(line.startIndex..., in: line)
            guard let match = regex.firstMatch(in: line, range: range),
                  match.numberOfRanges > 1,
                  let capture = Range(match.range(at: 1), in: line) else {
                continue
            }
            return String(line[capture]).trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return ""
    }

    private func detectDate(in lines: [String]) -> Date? {
        let preferred = lines.filter { $0.lowercased().contains("date") }
        let remainder = lines.filter { !preferred.contains($0) }
        for line in preferred + remainder {
            if let date = firstDate(in: line) {
                return date
            }
        }
        return nil
    }

    private func firstDate(in line: String) -> Date? {
        let patterns = [
            #"\d{4}-\d{2}-\d{2}"#,
            #"\d{1,2}/\d{1,2}/\d{2,4}"#,
            #"\d{1,2}-\d{1,2}-\d{4}"#,
            #"[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4}"#,
            #"\d{1,2}\s+[A-Za-z]{3,9}\.?\s+\d{4}"#
        ]
        for pattern in patterns {
            guard let regex = try? NSRegularExpression(pattern: pattern) else { continue }
            let range = NSRange(line.startIndex..., in: line)
            guard let match = regex.firstMatch(in: line, range: range),
                  let capture = Range(match.range, in: line) else {
                continue
            }
            let token = String(line[capture]).replacingOccurrences(of: ".", with: "")
            if let date = parseDateToken(token) {
                return date
            }
        }
        return nil
    }

    private func parseDateToken(_ token: String) -> Date? {
        let formats = [
            "yyyy-MM-dd",
            "M/d/yyyy",
            "MM/dd/yyyy",
            "M/d/yy",
            "MM/dd/yy",
            "M-d-yyyy",
            "MM-dd-yyyy",
            "MMMM d, yyyy",
            "MMM d, yyyy",
            "MMMM d yyyy",
            "MMM d yyyy",
            "d MMMM yyyy",
            "d MMM yyyy"
        ]
        let calendar = Calendar(identifier: .gregorian)
        let pivot = calendar.date(from: DateComponents(year: 2000, month: 1, day: 1))
        for format in formats {
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.calendar = calendar
            formatter.timeZone = .current
            formatter.isLenient = false
            formatter.dateFormat = format
            formatter.twoDigitStartDate = pivot
            if let date = formatter.date(from: token), isPlausible(date) {
                return date
            }
        }
        return nil
    }

    private func isPlausible(_ date: Date) -> Bool {
        let calendar = Calendar(identifier: .gregorian)
        let year = calendar.component(.year, from: date)
        guard (1990...2100).contains(year) else { return false }
        if let limit = calendar.date(byAdding: .day, value: 7, to: Date()), date > limit {
            return false
        }
        return true
    }

    private func suggestCategory(merchant: String, lines: [String]) -> ReceiptCategory {
        let text = ([merchant] + lines.prefix(8)).joined(separator: " ").lowercased()
        let rules: [(ReceiptCategory, [String])] = [
            (.fuel, ["shell", "chevron", "exxon", "fuel", "gas station", "petrol"]),
            (.software, ["adobe", "github", "software", "saas", "google workspace"]),
            (.travel, ["uber", "lyft", "airline", "delta air", "united air", "hotel", "airbnb", "parking"]),
            (.office, ["staples", "office depot", "office supplies"]),
            (.meals, ["starbucks", "cafe", "coffee", "restaurant", "mcdonald", "doordash", "grubhub", "dining", "pizza"])
        ]
        for (category, keys) in rules {
            if keys.contains(where: { text.contains($0) }) {
                return category
            }
        }
        return .other
    }
}

private extension UIImage {
    var cgImagePropertyOrientation: CGImagePropertyOrientation {
        switch imageOrientation {
        case .up: return .up
        case .down: return .down
        case .left: return .left
        case .right: return .right
        case .upMirrored: return .upMirrored
        case .downMirrored: return .downMirrored
        case .leftMirrored: return .leftMirrored
        case .rightMirrored: return .rightMirrored
        @unknown default: return .up
        }
    }
}
