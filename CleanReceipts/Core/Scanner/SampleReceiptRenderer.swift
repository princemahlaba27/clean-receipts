import UIKit

enum SampleReceiptRenderer {
    static func makeImage() -> UIImage {
        let size = CGSize(width: 900, height: 1400)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { context in
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: size))

            let title = UIFont.systemFont(ofSize: 56, weight: .bold)
            let body = UIFont.monospacedSystemFont(ofSize: 32, weight: .regular)
            let bold = UIFont.monospacedSystemFont(ofSize: 36, weight: .bold)
            var y: CGFloat = 90

            func draw(_ text: String, font: UIFont, centered: Bool = false) {
                let attributes: [NSAttributedString.Key: Any] = [
                    .font: font,
                    .foregroundColor: UIColor.black
                ]
                let textSize = (text as NSString).size(withAttributes: attributes)
                let x = centered ? (size.width - textSize.width) / 2 : 70
                (text as NSString).draw(at: CGPoint(x: x, y: y), withAttributes: attributes)
                y += textSize.height + 22
            }

            draw("STARBUCKS", font: title, centered: true)
            draw("123 Market Street", font: body, centered: true)
            draw("San Francisco CA", font: body, centered: true)
            y += 24
            draw("CASH RECEIPT", font: bold, centered: true)
            y += 12
            draw("Date: October 23, 2025", font: body)
            draw("Reference: APL-987657", font: body)
            y += 28
            draw("Coffee                 4.50", font: body)
            draw("Muffin                 3.25", font: body)
            y += 16
            draw("Subtotal               7.75", font: body)
            draw("Tax                    0.62", font: body)
            draw("Total                  8.37", font: bold)
            y += 36
            draw("THANK YOU", font: bold, centered: true)
        }
    }
}
