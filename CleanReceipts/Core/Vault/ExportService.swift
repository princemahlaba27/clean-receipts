import PDFKit
import UIKit

enum ExportKind {
    case pdf
    case csv
    case both
}

struct TaxReportReceipt: Sendable {
    var merchant: String
    var formattedDate: String
    var category: String
    var amount: Double
    var currencyCode: String
    var pageImageData: [Data]
}

struct TaxReportSnapshot: Sendable {
    var periodTitle: String
    var receipts: [TaxReportReceipt]
}

final class ExportService {
    static let shared = ExportService()

    func generateTaxPDF(
        snapshot: TaxReportSnapshot,
        progress: @escaping @Sendable (Double) -> Void
    ) async -> Data {
        await Task.detached(priority: .userInitiated) { [self] in
            self.renderTaxPDF(snapshot: snapshot, progress: progress)
        }.value
    }

    private func renderTaxPDF(
        snapshot: TaxReportSnapshot,
        progress: @escaping @Sendable (Double) -> Void
    ) -> Data {
        let sorted = snapshot.receipts
        let proofCount = sorted.reduce(0) { $0 + $1.pageImageData.count }
        let totalSteps = max(1, 1 + proofCount)
        var completedSteps = 0
        func advance() {
            completedSteps += 1
            publishProgress(Double(completedSteps) / Double(totalSteps), progress)
        }
        publishProgress(0, progress)
        let pageWidth: CGFloat = 612
        let pageHeight: CGFloat = 792
        let margin: CGFloat = 40
        let format = UIGraphicsPDFRendererFormat()
        format.documentInfo = [
            kCGPDFContextCreator as String: "Clean Receipts iOS",
            kCGPDFContextTitle as String: "Tax Expense Audit Dossier",
            kCGPDFContextAuthor as String: "Clean Receipts"
        ]
        let renderer = UIGraphicsPDFRenderer(
            bounds: CGRect(x: 0, y: 0, width: pageWidth, height: pageHeight),
            format: format
        )
        let currency = currencyFormatter()
        let generated = Date().formatted(date: .abbreviated, time: .shortened)
        let total = sorted.reduce(0) { $0 + $1.amount }
        var pageNumber = 0

        let raw = renderer.pdfData { context in
            func startPage() {
                context.beginPage()
                pageNumber += 1
                let footer = "Clean Receipts · On-device records · Not a tax filing · Page \(pageNumber)"
                draw(
                    footer,
                    in: CGRect(x: margin, y: pageHeight - 36, width: pageWidth - margin * 2, height: 14),
                    font: .systemFont(ofSize: 9, weight: .regular),
                    color: .darkGray,
                    alignment: .left
                )
            }

            startPage()
            draw(
                "TAX EXPENSE AUDIT REPORT",
                in: CGRect(x: margin, y: 36, width: pageWidth - margin * 2, height: 26),
                font: .systemFont(ofSize: 20, weight: .heavy),
                color: .black,
                alignment: .left
            )
            draw(
                "Period \(snapshot.periodTitle)  ·  Generated \(generated)  ·  \(sorted.count) receipt\(sorted.count == 1 ? "" : "s")",
                in: CGRect(x: margin, y: 66, width: pageWidth - margin * 2, height: 16),
                font: .systemFont(ofSize: 11, weight: .regular),
                color: .darkGray,
                alignment: .left
            )
            draw(
                "Period total \(currency.string(from: NSNumber(value: total)) ?? String(format: "$%.2f", total))",
                in: CGRect(x: margin, y: 84, width: pageWidth - margin * 2, height: 16),
                font: .systemFont(ofSize: 12, weight: .semibold),
                color: .black,
                alignment: .left
            )

            var y: CGFloat = 118
            func drawTableHeader() {
                let headerRect = CGRect(x: margin, y: y, width: pageWidth - margin * 2, height: 18)
                UIColor(white: 0.93, alpha: 1).setFill()
                UIBezierPath(rect: headerRect).fill()
                drawColumns(
                    date: "DATE",
                    merchant: "MERCHANT",
                    category: "CATEGORY",
                    amount: "AMOUNT",
                    y: y,
                    font: .monospacedSystemFont(ofSize: 10, weight: .bold),
                    pageWidth: pageWidth,
                    margin: margin
                )
                y += 22
            }

            drawTableHeader()

            if sorted.isEmpty {
                draw(
                    "No expenses recorded for this period.",
                    in: CGRect(x: margin, y: y, width: pageWidth - margin * 2, height: 18),
                    font: .systemFont(ofSize: 11, weight: .regular),
                    color: .darkGray,
                    alignment: .left
                )
            }

            for (index, item) in sorted.enumerated() {
                if y > 700 {
                    startPage()
                    y = 48
                    drawTableHeader()
                }
                if index.isMultiple(of: 2) {
                    UIColor(white: 0.97, alpha: 1).setFill()
                    UIBezierPath(rect: CGRect(x: margin, y: y - 2, width: pageWidth - margin * 2, height: 18)).fill()
                }
                drawColumns(
                    date: item.formattedDate,
                    merchant: item.merchant,
                    category: item.category,
                    amount: currency.string(from: NSNumber(value: item.amount)) ?? String(format: "$%.2f", item.amount),
                    y: y,
                    font: .monospacedSystemFont(ofSize: 10, weight: .regular),
                    pageWidth: pageWidth,
                    margin: margin
                )
                y += 18
            }

            if y > 680 {
                startPage()
                y = 48
            }
            y += 8
            let line = UIBezierPath()
            line.move(to: CGPoint(x: margin, y: y))
            line.addLine(to: CGPoint(x: pageWidth - margin, y: y))
            UIColor.black.setStroke()
            line.lineWidth = 0.6
            line.stroke()
            y += 8
            draw(
                "TOTAL  \(currency.string(from: NSNumber(value: total)) ?? String(format: "$%.2f", total))",
                in: CGRect(x: margin, y: y, width: pageWidth - margin * 2, height: 18),
                font: .monospacedSystemFont(ofSize: 11, weight: .bold),
                color: .black,
                alignment: .right
            )
            advance()

            let imageBounds = CGRect(x: margin, y: 58, width: pageWidth - margin * 2, height: pageHeight - 110)
            for item in sorted {
                let pages = item.pageImageData
                guard !pages.isEmpty else { continue }
                for (pageIndex, pageData) in pages.enumerated() {
                    autoreleasepool {
                        let image = downsampledProofImage(from: pageData, fitting: imageBounds)
                        if let image {
                            startPage()
                            let caption = "RECEIPT PROOF: \(item.merchant) — \(currency.string(from: NSNumber(value: item.amount)) ?? "") — \(item.formattedDate) — page \(pageIndex + 1) of \(pages.count)"
                            draw(
                                caption,
                                in: CGRect(x: margin, y: 32, width: pageWidth - margin * 2, height: 18),
                                font: .systemFont(ofSize: 11, weight: .semibold),
                                color: .black,
                                alignment: .left
                            )
                            image.draw(in: aspectFitRect(imageSize: image.size, in: imageBounds))
                        }
                    }
                    advance()
                }
            }
        }

        guard let document = PDFDocument(data: raw) else { return raw }
        document.documentAttributes = [
            PDFDocumentAttribute.titleAttribute: "Tax Expense Audit Dossier",
            PDFDocumentAttribute.creatorAttribute: "Clean Receipts iOS",
            PDFDocumentAttribute.authorAttribute: "Clean Receipts"
        ]
        return document.dataRepresentation() ?? raw
    }

    func generateCSV(for items: [ReceiptItem]) -> Data {
        let sorted = items.sorted { $0.date < $1.date }
        var lines = ["Date,Merchant,Category,Amount,Currency"]
        for item in sorted {
            let row = [
                csvField(item.formattedDate),
                csvField(item.merchant),
                csvField(item.category.rawValue),
                csvField(String(format: "%.2f", item.amount)),
                csvField(item.currencyCode)
            ].joined(separator: ",")
            lines.append(row)
        }
        let text = lines.joined(separator: "\n") + "\n"
        return text.data(using: .utf8) ?? Data()
    }

    func writeTemp(data: Data, filename: String) throws -> URL {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(filename)
        if FileManager.default.fileExists(atPath: url.path) {
            try FileManager.default.removeItem(at: url)
        }
        try data.write(to: url, options: .atomic)
        return url
    }

    func exportFilename(period: String, ext: String) -> String {
        let allowed = CharacterSet.alphanumerics
        var cleaned = ""
        var previousDash = false
        for scalar in period.unicodeScalars {
            if allowed.contains(scalar) {
                cleaned.unicodeScalars.append(scalar)
                previousDash = false
            } else if !previousDash {
                cleaned.unicodeScalars.append("-")
                previousDash = true
            }
        }
        let trimmed = cleaned.trimmingCharacters(in: CharacterSet(charactersIn: "-"))
        let stem = trimmed.isEmpty ? "Report" : trimmed
        return "CleanReceipts-\(stem).\(ext)"
    }

    private func currencyFormatter() -> NumberFormatter {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        formatter.locale = Locale(identifier: "en_US")
        return formatter
    }

    private func csvField(_ raw: String) -> String {
        let escaped = raw.replacingOccurrences(of: "\"", with: "\"\"")
        return "\"\(escaped)\""
    }

    private func draw(
        _ text: String,
        in rect: CGRect,
        font: UIFont,
        color: UIColor,
        alignment: NSTextAlignment
    ) {
        let style = NSMutableParagraphStyle()
        style.alignment = alignment
        style.lineBreakMode = .byTruncatingTail
        let attributes: [NSAttributedString.Key: Any] = [
            .font: font,
            .foregroundColor: color,
            .paragraphStyle: style
        ]
        (text as NSString).draw(in: rect, withAttributes: attributes)
    }

    private func drawColumns(
        date: String,
        merchant: String,
        category: String,
        amount: String,
        y: CGFloat,
        font: UIFont,
        pageWidth: CGFloat,
        margin: CGFloat
    ) {
        draw(date, in: CGRect(x: margin, y: y, width: 78, height: 16), font: font, color: .black, alignment: .left)
        draw(merchant, in: CGRect(x: margin + 82, y: y, width: 180, height: 16), font: font, color: .black, alignment: .left)
        draw(category, in: CGRect(x: margin + 268, y: y, width: 140, height: 16), font: font, color: .black, alignment: .left)
        draw(amount, in: CGRect(x: pageWidth - margin - 90, y: y, width: 90, height: 16), font: font, color: .black, alignment: .right)
    }

    private static let proofDPI: CGFloat = 200

    private func publishProgress(_ value: Double, _ progress: @escaping @Sendable (Double) -> Void) {
        let clamped = min(1, max(0, value))
        DispatchQueue.main.async {
            progress(clamped)
        }
    }

    /// Scales a stored scan to the proof-page rect at 200 DPI and returns a JPEG-backed image.
    /// The full-resolution decode does not outlive this call.
    private func downsampledProofImage(from data: Data, fitting bounds: CGRect) -> UIImage? {
        guard let source = UIImage(data: data), source.size.width > 0, source.size.height > 0 else {
            return nil
        }
        let fitted = aspectFitRect(imageSize: source.size, in: bounds)
        let pixelsPerPoint = Self.proofDPI / 72
        let pixelSize = CGSize(
            width: max(1, floor(fitted.width * pixelsPerPoint)),
            height: max(1, floor(fitted.height * pixelsPerPoint))
        )
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        let renderer = UIGraphicsImageRenderer(size: pixelSize, format: format)
        let bitmap = renderer.image { _ in
            source.draw(in: CGRect(origin: .zero, size: pixelSize))
        }
        guard let jpeg = bitmap.jpegData(compressionQuality: 0.72),
              let compact = UIImage(data: jpeg) else {
            return bitmap
        }
        return compact
    }

    private func aspectFitRect(imageSize: CGSize, in bounds: CGRect) -> CGRect {
        guard imageSize.width > 0, imageSize.height > 0 else { return bounds }
        let scale = min(bounds.width / imageSize.width, bounds.height / imageSize.height)
        let width = imageSize.width * scale
        let height = imageSize.height * scale
        return CGRect(
            x: bounds.midX - width / 2,
            y: bounds.minY,
            width: width,
            height: height
        )
    }
}
