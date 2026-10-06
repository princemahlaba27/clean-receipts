import SwiftData
import SwiftUI
import UIKit

enum ReceiptEditorMode {
    case new(pages: [Data])
    case existing(ReceiptItem)
}

struct ReceiptDetailView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext

    let mode: ReceiptEditorMode
    var showsCloseButton: Bool

    @State private var merchant = ""
    @State private var reference = ""
    @State private var subtotalText = ""
    @State private var taxText = ""
    @State private var totalText = ""
    @State private var date = Date()
    @State private var category: ReceiptCategory = .other
    @State private var isEditing = true
    @State private var isParsing = false
    @State private var didParse = false
    @State private var pageIndex = 0
    @State private var showZoom = false
    @State private var saveError: String?
    @FocusState private var focusedField: Field?

    private var vault: VaultViewModel { VaultViewModel(context: modelContext) }

    private var isNew: Bool {
        if case .new = mode { return true }
        return false
    }

    private var pageData: [Data] {
        switch mode {
        case .new(let pages):
            return pages
        case .existing(let item):
            return item.orderedPages.map(\.imageData)
        }
    }

    init(mode: ReceiptEditorMode, showsCloseButton: Bool) {
        self.mode = mode
        self.showsCloseButton = showsCloseButton
        if case .existing(let item) = mode {
            _merchant = State(initialValue: item.merchant)
            _reference = State(initialValue: item.referenceCode)
            _date = State(initialValue: item.date)
            _category = State(initialValue: item.category)
            _subtotalText = State(initialValue: item.subtotal > 0 ? String(format: "%.2f", item.subtotal) : "")
            _taxText = State(initialValue: item.tax > 0 ? String(format: "%.2f", item.tax) : "")
            _totalText = State(initialValue: String(format: "%.2f", item.amount))
            _isEditing = State(initialValue: false)
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                preview
                if isParsing {
                    HStack(spacing: 10) {
                        ProgressView()
                            .tint(Color.industrialYellow)
                        Text("Reading receipt…")
                            .font(.subheadline)
                            .foregroundStyle(Color.labelSecondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                merchantCard
                categoryPicker
                dateAndReference
                breakdown
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .padding(.bottom, 24)
            .frame(maxWidth: 640)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Color.obsidian.ignoresSafeArea())
        .navigationTitle(isNew ? "Scanned Details" : "Receipt")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if showsCloseButton {
                ToolbarItem(placement: .cancellationAction) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.body.weight(.semibold))
                    }
                    .accessibilityLabel("Close")
                }
            }
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { focusedField = nil }
            }
        }
        .toolbarBackground(Color.obsidian, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .safeAreaInset(edge: .bottom) {
            actionBar
        }
        .task {
            await parseIfNeeded()
        }
        .fullScreenCover(isPresented: $showZoom) {
            zoomScreen
        }
        .alert("Could Not Save", isPresented: Binding(
            get: { saveError != nil },
            set: { if !$0 { saveError = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(saveError ?? "")
        }
    }

    private var preview: some View {
        ZStack {
            TabView(selection: $pageIndex) {
                ForEach(Array(pageData.enumerated()), id: \.offset) { index, data in
                    Group {
                        if let image = UIImage(data: data) {
                            Image(uiImage: image)
                                .resizable()
                                .scaledToFit()
                        } else {
                            Color.surfaceGlass
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: pageData.count > 1 ? .automatic : .never))
            .frame(height: 230)

            ScannerOverlayView()
                .padding(12)

            VStack {
                HStack {
                    Spacer()
                    Button {
                        showZoom = true
                    } label: {
                        Image(systemName: "arrow.up.left.and.arrow.down.right")
                            .font(.footnote.weight(.bold))
                            .foregroundStyle(Color.obsidian)
                            .frame(width: 32, height: 32)
                            .background(Color.industrialYellow, in: Circle())
                    }
                    .accessibilityLabel("Expand receipt")
                    .buttonStyle(.plain)
                }
                Spacer()
            }
            .padding(18)
        }
        .glassCard(radius: 18)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private var merchantCard: some View {
        HStack(alignment: .center, spacing: 12) {
            Text(badgeLetter)
                .font(.headline.weight(.bold))
                .foregroundStyle(Color.obsidian)
                .frame(width: 48, height: 48)
                .background(Color.industrialYellow, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            VStack(alignment: .leading, spacing: 4) {
                Text("MERCHANT")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.labelSecondary)
                if isEditing {
                    TextField("Merchant", text: $merchant)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(.white)
                        .textInputAutocapitalization(.words)
                        .autocorrectionDisabled()
                        .focused($focusedField, equals: .merchant)
                } else {
                    Text(merchant.isEmpty ? "Store Receipt" : merchant)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(.white)
                        .lineLimit(2)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(16)
        .glassCard()
    }

    private var categoryPicker: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("CATEGORY")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.labelSecondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(ReceiptCategory.allCases) { item in
                        Button {
                            category = item
                        } label: {
                            Label(item.rawValue, systemImage: item.symbolName)
                                .font(.subheadline.weight(.semibold))
                                .labelStyle(.titleAndIcon)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .foregroundStyle(category == item ? Color.obsidian : Color.white)
                                .background(
                                    category == item ? Color.industrialYellow : Color.surfaceGlass,
                                    in: Capsule()
                                )
                                .overlay {
                                    Capsule().strokeBorder(category == item ? Color.clear : Color.surfaceBorder, lineWidth: 1)
                                }
                        }
                        .buttonStyle(.plain)
                        .disabled(!isEditing)
                    }
                }
            }
        }
    }

    private var dateAndReference: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text("DATE")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.labelSecondary)
                DatePicker("Date", selection: $date, displayedComponents: .date)
                    .labelsHidden()
                    .datePickerStyle(.compact)
                    .tint(Color.industrialYellow)
                    .disabled(!isEditing)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .glassCard()

            VStack(alignment: .leading, spacing: 6) {
                Text("REFERENCE")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.labelSecondary)
                if isEditing {
                    TextField("Reference", text: $reference)
                        .font(.body.weight(.medium))
                        .foregroundStyle(.white)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .focused($focusedField, equals: .reference)
                } else {
                    Text(reference.isEmpty ? "—" : reference)
                        .font(.body.weight(.medium))
                        .foregroundStyle(.white)
                        .lineLimit(2)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .glassCard()
        }
    }

    private var breakdown: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("PURCHASE BREAKDOWN")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.labelSecondary)
            moneyRow(title: "Subtotal", text: $subtotalText, field: .subtotal, emphasized: false)
            moneyRow(title: "Tax", text: $taxText, field: .tax, emphasized: false)
            Divider().overlay(Color.surfaceBorder)
            moneyRow(title: "Total Paid", text: $totalText, field: .total, emphasized: true)
        }
        .padding(16)
        .glassCard()
    }

    private func moneyRow(title: String, text: Binding<String>, field: Field, emphasized: Bool) -> some View {
        HStack {
            Text(title)
                .font(emphasized ? .headline : .body)
                .foregroundStyle(emphasized ? Color.white : Color.labelSecondary)
            Spacer()
            if isEditing {
                TextField("0.00", text: text)
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
                    .font(emphasized ? .system(.title2, design: .rounded).weight(.bold) : .system(.body, design: .rounded))
                    .foregroundStyle(emphasized ? Color.industrialYellow : Color.white)
                    .focused($focusedField, equals: field)
                    .frame(maxWidth: 140)
            } else {
                Text(text.wrappedValue.isEmpty ? "—" : displayMoney(text.wrappedValue))
                    .font(emphasized ? .system(.title2, design: .rounded).weight(.bold) : .system(.body, design: .rounded))
                    .foregroundStyle(emphasized ? Color.industrialYellow : Color.white)
            }
        }
    }

    private var actionBar: some View {
        HStack(spacing: 12) {
            Button(isEditing ? "Done" : "Edit") {
                isEditing.toggle()
                focusedField = nil
            }
            .font(.headline)
            .foregroundStyle(Color.industrialYellow)
            .frame(width: 96, height: 52)
            .background(Color.clear)
            .overlay {
                Capsule().strokeBorder(Color.industrialYellow, lineWidth: 1)
            }
            .accessibilityLabel("Edit Details")

            Button(action: save) {
                Text(isNew ? "Save to Vault" : "Save")
            }
            .buttonStyle(YellowCapsuleButtonStyle())
            .accessibilityLabel(isNew ? "Save to Vault" : "Save")
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
        .padding(.bottom, 8)
        .background(Color.obsidian)
    }

    private var zoomScreen: some View {
        ZStack {
            Color.obsidian.ignoresSafeArea()
            if pageData.indices.contains(pageIndex), let image = UIImage(data: pageData[pageIndex]) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .padding(24)
            }
            VStack {
                HStack {
                    Button {
                        showZoom = false
                    } label: {
                        Image(systemName: "xmark")
                            .font(.body.weight(.semibold))
                            .foregroundStyle(.white)
                            .frame(width: 36, height: 36)
                            .background(Color.surfaceGlass, in: Circle())
                            .overlay {
                                Circle().strokeBorder(Color.surfaceBorder, lineWidth: 1)
                            }
                    }
                    .accessibilityLabel("Close preview")
                    .padding(20)
                    Spacer()
                }
                Spacer()
            }
        }
    }

    private var badgeLetter: String {
        let source = merchant.isEmpty ? "S" : merchant
        let letter = source.first { $0.isLetter } ?? "?"
        return String(letter).uppercased()
    }

    private func parseIfNeeded() async {
        guard !didParse, case .new(let pages) = mode else { return }
        didParse = true
        guard let data = pages.first, let image = UIImage(data: data) else { return }
        isParsing = true
        let parsed = await VisionOCRService.shared.parseReceipt(from: image)
        guard !Task.isCancelled else {
            isParsing = false
            return
        }
        merchant = parsed.merchant
        totalText = moneyString(parsed.total)
        subtotalText = moneyString(parsed.subtotal)
        taxText = moneyString(parsed.tax)
        date = parsed.date
        reference = parsed.referenceCode
        category = parsed.category
        isParsing = false
        let foundFields = parsed.merchant != "Store Receipt" || parsed.total > 0 || !parsed.referenceCode.isEmpty
        if foundFields {
            Haptics.success()
        }
    }

    private func save() {
        focusedField = nil
        let name = merchant.trimmingCharacters(in: .whitespacesAndNewlines)
        let finalName = name.isEmpty ? "Store Receipt" : name
        let amount = ReceiptMoney.parse(totalText) ?? 0
        let subtotal = ReceiptMoney.parse(subtotalText) ?? 0
        let tax = ReceiptMoney.parse(taxText) ?? 0
        do {
            switch mode {
            case .new(let pages):
                guard !pages.isEmpty else {
                    saveError = "This scan has no pages to store."
                    return
                }
                try vault.saveNew(
                    merchant: finalName,
                    amount: amount,
                    subtotal: subtotal,
                    tax: tax,
                    date: date,
                    category: category,
                    referenceCode: reference.trimmingCharacters(in: .whitespacesAndNewlines),
                    pageData: pages
                )
            case .existing(let item):
                try vault.update(
                    item,
                    merchant: finalName,
                    amount: amount,
                    subtotal: subtotal,
                    tax: tax,
                    date: date,
                    category: category,
                    referenceCode: reference.trimmingCharacters(in: .whitespacesAndNewlines)
                )
            }
            Haptics.success()
            dismiss()
        } catch {
            saveError = error.localizedDescription
        }
    }

    private func moneyString(_ value: Double?) -> String {
        guard let value else { return "" }
        return String(format: "%.2f", value)
    }

    private func displayMoney(_ raw: String) -> String {
        guard let value = ReceiptMoney.parse(raw) else { return raw }
        return value.formatted(.currency(code: "USD"))
    }

    private enum Field: Hashable {
        case merchant
        case reference
        case subtotal
        case tax
        case total
    }
}
