import SwiftData
import SwiftUI
import UIKit
import VisionKit

private struct PendingScan: Identifiable {
    let id = UUID()
    var pages: [Data]
}

private struct CategoryRequest: Identifiable {
    let id: PersistentIdentifier
}

private struct SharePayload: Identifiable {
    let id = UUID()
    var urls: [URL]
}

struct VaultListView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(SubscriptionManager.self) private var subscriptions
    @Query(sort: \ReceiptItem.date, order: .reverse) private var receipts: [ReceiptItem]

    @State private var selectedYear = Calendar.current.component(.year, from: Date())
    @State private var selectedQuarter: TaxQuarter = .all
    @State private var showScanner = false
    @State private var didOfferScanner = false
    @State private var pendingScan: PendingScan?
    @State private var showPaywall = false
    @State private var showDownsell = false
    @State private var paywallPurchased = false
    @State private var downsellPurchased = false
    @State private var showExportChooser = false
    @State private var sharePayload: SharePayload?
    @State private var alertMessage: String?
    @State private var categoryRequest: CategoryRequest?
    @State private var isExporting = false
    @State private var exportProgress: Double = 0
    @State private var exportGeneration = 0
    @ScaledMetric(relativeTo: .largeTitle) private var totalSize: CGFloat = 48

    private var vault: VaultViewModel { VaultViewModel(context: modelContext) }
    private let calendar = Calendar.current

    private var years: [Int] {
        let found = Set(receipts.map { calendar.component(.year, from: $0.date) })
        let current = calendar.component(.year, from: Date())
        return Array(found.union([current, selectedYear])).sorted(by: >)
    }

    private var filteredReceipts: [ReceiptItem] {
        receipts.filter { item in
            let year = calendar.component(.year, from: item.date)
            let month = calendar.component(.month, from: item.date)
            return year == selectedYear && selectedQuarter.contains(month: month)
        }
    }

    private var sections: [MonthSection] {
        VaultMath.monthSections(from: filteredReceipts, calendar: calendar)
    }

    private var periodTotal: Double {
        VaultMath.total(of: filteredReceipts)
    }

    private var periodTitle: String {
        selectedQuarter == .all ? String(selectedYear) : "\(selectedYear) \(selectedQuarter.title)"
    }

    private var focusTitle: String {
        if let section = sections.first {
            return VaultMath.monthTitle(year: section.year, month: section.month, calendar: calendar)
        }
        return periodTitle
    }

    private var focusTotal: Double {
        sections.first?.total ?? 0
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    hero
                        .listRowInsets(EdgeInsets(top: 4, leading: 20, bottom: 4, trailing: 20))
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                    quarterPicker
                        .listRowInsets(EdgeInsets(top: 0, leading: 20, bottom: 8, trailing: 20))
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                }
                if filteredReceipts.isEmpty {
                    Section {
                        ContentUnavailableView {
                            Label("No Receipts", systemImage: "doc.text.viewfinder")
                        } description: {
                            Text("Scan a receipt, or import a sample to try the vault without a camera.")
                        } actions: {
                            Button("Import Sample", action: importSample)
                                .buttonStyle(.bordered)
                                .tint(Color.industrialYellow)
                        }
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                    }
                } else {
                    ForEach(sections) { section in
                        Section {
                            ForEach(section.receipts) { item in
                                NavigationLink(value: item.persistentModelID) {
                                    ReceiptRowView(item: item)
                                }
                                .tint(Color.white)
                                .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                                .listRowBackground(Color.clear)
                                .listRowSeparator(.hidden)
                                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                    Button(role: .destructive) {
                                        delete(item)
                                    } label: {
                                        Label("Delete", systemImage: "trash")
                                    }
                                    .tint(Color.destructiveRed)
                                }
                                .swipeActions(edge: .leading, allowsFullSwipe: false) {
                                    Button {
                                        categoryRequest = CategoryRequest(id: item.persistentModelID)
                                    } label: {
                                        Label("Category", systemImage: "tag")
                                    }
                                    .tint(Color(red: 0.18, green: 0.22, blue: 0.34))
                                }
                                .contextMenu {
                                    ForEach(ReceiptCategory.allCases) { category in
                                        Button {
                                            recategorize(item, to: category)
                                        } label: {
                                            Label(category.rawValue, systemImage: category.symbolName)
                                        }
                                    }
                                }
                            }
                        } header: {
                            HStack {
                                Text(VaultMath.monthTitle(year: section.year, month: section.month, calendar: calendar))
                                    .foregroundStyle(.white)
                                Spacer()
                                Text(section.total, format: .currency(code: "USD"))
                                    .font(.system(.subheadline, design: .rounded).weight(.bold))
                                    .foregroundStyle(Color.industrialYellow)
                            }
                        }
                    }
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(Color.obsidian)
            .navigationTitle("Tax Vault")
            .navigationBarTitleDisplayMode(.large)
            .toolbarBackground(Color.obsidian, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Menu {
                        ForEach(years, id: \.self) { year in
                            Button(String(year)) { selectedYear = year }
                        }
                    } label: {
                        Label(String(selectedYear), systemImage: "calendar")
                    }
                    .accessibilityLabel("Year \(selectedYear)")
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Import Sample", action: importSample)
                }
            }
            .navigationDestination(for: PersistentIdentifier.self) { id in
                if let item = receipts.first(where: { $0.persistentModelID == id }) {
                    ReceiptDetailView(mode: .existing(item), showsCloseButton: false)
                } else {
                    ContentUnavailableView("Receipt Unavailable", systemImage: "doc")
                        .background(Color.obsidian)
                }
            }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                bottomBar
            }
        }
        .background(Color.obsidian.ignoresSafeArea())
        .task {
            guard !didOfferScanner else { return }
            didOfferScanner = true
            let count = (try? modelContext.fetchCount(FetchDescriptor<ReceiptItem>())) ?? receipts.count
            if count == 0 {
                presentScanner()
            }
        }
        .fullScreenCover(isPresented: $showScanner) {
            DocumentScannerView(
                onScan: { images in
                    let pages = images.compactMap { $0.jpegData(compressionQuality: 0.85) }
                    showScanner = false
                    guard !pages.isEmpty else {
                        alertMessage = "The scan did not include a usable page."
                        return
                    }
                    Task { @MainActor in
                        try? await Task.sleep(nanoseconds: 400_000_000)
                        pendingScan = PendingScan(pages: pages)
                    }
                },
                onCancel: { showScanner = false },
                onFailure: { message in
                    showScanner = false
                    alertMessage = message
                }
            )
            .ignoresSafeArea()
        }
        .sheet(item: $pendingScan) { scan in
            NavigationStack {
                ReceiptDetailView(mode: .new(pages: scan.pages), showsCloseButton: true)
            }
            .presentationBackground(Color.obsidian)
        }
        .sheet(isPresented: $showPaywall, onDismiss: handlePaywallDismiss) {
            PaywallView(onPurchased: { paywallPurchased = true })
        }
        .sheet(isPresented: $showDownsell, onDismiss: handleDownsellDismiss) {
            DownsellSheetView(onPurchased: { downsellPurchased = true })
        }
        .confirmationDialog("Export Tax Report", isPresented: $showExportChooser, titleVisibility: .visible) {
            Button("Export PDF") { performExport(.pdf) }
            Button("Export CSV") { performExport(.csv) }
            Button("Export PDF and CSV") { performExport(.both) }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Audit-ready files for \(periodTitle).")
        }
        .sheet(item: $categoryRequest) { request in
            CategoryPickerSheet { category in
                if let item = receipts.first(where: { $0.persistentModelID == request.id }) {
                    recategorize(item, to: category)
                }
                categoryRequest = nil
            }
        }
        .sheet(item: $sharePayload) { payload in
            ShareSheet(items: payload.urls)
        }
        .overlay {
            if isExporting {
                ZStack {
                    Color.black.opacity(0.45).ignoresSafeArea()
                    VStack(spacing: 14) {
                        ProgressView(value: exportProgress)
                            .tint(Color.industrialYellow)
                        Text("Preparing tax report")
                            .font(.headline)
                            .foregroundStyle(.white)
                        Text("\(Int((exportProgress * 100).rounded()))%")
                            .font(.subheadline.monospacedDigit())
                            .foregroundStyle(Color.labelSecondary)
                    }
                    .padding(24)
                    .frame(maxWidth: 280)
                    .glassCard()
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Preparing tax report, \(Int((exportProgress * 100).rounded())) percent")
            }
        }
        .alert("Clean Receipts", isPresented: Binding(
            get: { alertMessage != nil },
            set: { if !$0 { alertMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(alertMessage ?? "")
        }
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(focusTitle)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color.labelSecondary)
            Text(focusTotal, format: .currency(code: "USD"))
                .font(.system(size: totalSize, weight: .bold, design: .rounded))
                .foregroundStyle(Color.industrialYellow)
                .minimumScaleFactor(0.45)
                .lineLimit(1)
                .accessibilityLabel("Monthly deductible \(focusTotal.formatted(.currency(code: "USD")))")
            Text(savingsLine)
                .font(.caption)
                .foregroundStyle(Color.labelSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.bottom, 4)
    }

    private var savingsLine: String {
        let savings = VaultMath.estimatedSavings(for: periodTotal)
        let deductible = periodTotal.formatted(.currency(code: "USD"))
        let savingsText = savings.formatted(.currency(code: "USD"))
        return "\(periodTitle) deductible \(deductible). Est. tax savings \(savingsText) at 24%. This is an estimate, not tax advice."
    }

    private var quarterPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(TaxQuarter.allCases) { quarter in
                    Button {
                        selectedQuarter = quarter
                    } label: {
                        Text(quarter.title)
                            .font(.subheadline.weight(.semibold))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .foregroundStyle(selectedQuarter == quarter ? Color.obsidian : Color.white)
                            .background(
                                selectedQuarter == quarter ? Color.industrialYellow : Color.surfaceGlass,
                                in: Capsule()
                            )
                            .overlay {
                                Capsule().strokeBorder(
                                    selectedQuarter == quarter ? Color.clear : Color.surfaceBorder,
                                    lineWidth: 1
                                )
                            }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var bottomBar: some View {
        VStack(spacing: 12) {
            HStack {
                Spacer()
                Button(action: presentScanner) {
                    Image(systemName: "camera.fill")
                        .font(.title2.weight(.bold))
                        .foregroundStyle(Color.obsidian)
                        .frame(width: 62, height: 62)
                        .background(Color.industrialYellow, in: Circle())
                        .shadow(color: Color.industrialYellow.opacity(0.28), radius: 14, y: 6)
                }
                .buttonStyle(ScanButtonStyle())
                .accessibilityLabel("Scan receipt")
            }
            .padding(.horizontal, 20)

            Button(action: beginExport) {
                VStack(spacing: 2) {
                    Text("Export Tax Report (PDF & CSV)")
                    Text(periodTitle)
                        .font(.caption.weight(.semibold))
                        .opacity(0.7)
                }
            }
            .buttonStyle(YellowCapsuleButtonStyle(enabled: !isExporting))
            .disabled(isExporting)
            .padding(.horizontal, 20)
            .accessibilityLabel("Export Tax Report for \(periodTitle)")
        }
        .padding(.top, 18)
        .padding(.bottom, 8)
        .background {
            LinearGradient(
                colors: [Color.obsidian.opacity(0), Color.obsidian, Color.obsidian],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea(edges: .bottom)
        }
    }

    private func presentScanner() {
        guard VNDocumentCameraViewController.isSupported else {
            alertMessage = "This device does not support the document scanner. Use Import Sample to try the vault."
            return
        }
        showScanner = true
    }

    private func importSample() {
        let image = SampleReceiptRenderer.makeImage()
        guard let data = image.jpegData(compressionQuality: 0.95) else {
            alertMessage = "The sample receipt could not be created."
            return
        }
        pendingScan = PendingScan(pages: [data])
    }

    private func beginExport() {
        guard !filteredReceipts.isEmpty else {
            alertMessage = "No receipts in \(periodTitle) to export."
            return
        }
        if subscriptions.isPro {
            showExportChooser = true
        } else {
            showPaywall = true
        }
    }

    private func handlePaywallDismiss() {
        if paywallPurchased {
            paywallPurchased = false
            presentExportChooserAfterSheet()
        } else {
            Haptics.impact(.light)
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 350_000_000)
                showDownsell = true
            }
        }
    }

    private func handleDownsellDismiss() {
        if downsellPurchased {
            downsellPurchased = false
            presentExportChooserAfterSheet()
        }
    }

    private func presentExportChooserAfterSheet() {
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 350_000_000)
            showExportChooser = true
        }
    }

    private func performExport(_ kind: ExportKind) {
        guard !isExporting else { return }
        let items = filteredReceipts
        guard !items.isEmpty else {
            alertMessage = "No receipts in \(periodTitle) to export."
            return
        }
        let snapshot = TaxReportSnapshot(
            periodTitle: periodTitle,
            receipts: items.map { item in
                TaxReportReceipt(
                    merchant: item.merchant,
                    formattedDate: item.formattedDate,
                    category: item.category.rawValue,
                    amount: item.amount,
                    currencyCode: item.currencyCode,
                    pageImageData: item.orderedPages.map(\.imageData)
                )
            }
        )
        let period = periodTitle
        exportGeneration += 1
        let generation = exportGeneration
        isExporting = true
        exportProgress = 0
        Task { @MainActor in
            var urls: [URL] = []
            if kind == .pdf || kind == .both {
                let data = await ExportService.shared.generateTaxPDF(snapshot: snapshot) { fraction in
                    Task { @MainActor in
                        guard exportGeneration == generation else { return }
                        exportProgress = fraction
                    }
                }
                let name = ExportService.shared.exportFilename(period: period, ext: "pdf")
                if let url = try? ExportService.shared.writeTemp(data: data, filename: name) {
                    urls.append(url)
                }
            }
            if kind == .csv || kind == .both {
                let data = ExportService.shared.generateCSV(for: items)
                let name = ExportService.shared.exportFilename(period: period, ext: "csv")
                if let url = try? ExportService.shared.writeTemp(data: data, filename: name) {
                    urls.append(url)
                }
            }
            guard exportGeneration == generation else { return }
            isExporting = false
            guard !urls.isEmpty else {
                alertMessage = "The report could not be created."
                return
            }
            sharePayload = SharePayload(urls: urls)
        }
    }

    private func delete(_ item: ReceiptItem) {
        do {
            try vault.delete(item)
        } catch {
            alertMessage = error.localizedDescription
        }
    }

    private func recategorize(_ item: ReceiptItem, to category: ReceiptCategory) {
        do {
            try vault.recategorize(item, to: category)
        } catch {
            alertMessage = error.localizedDescription
        }
    }
}

private struct ReceiptRowView: View {
    let item: ReceiptItem

    var body: some View {
        HStack(spacing: 12) {
            Text(badge)
                .font(.headline.weight(.bold))
                .foregroundStyle(Color.obsidian)
                .frame(width: 44, height: 44)
                .background(Color.industrialYellow, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            VStack(alignment: .leading, spacing: 4) {
                Text(item.merchant)
                    .font(.headline)
                    .foregroundStyle(.white)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    Text(item.date.formatted(date: .abbreviated, time: .omitted))
                    Text("·")
                    Text(item.category.rawValue)
                }
                .font(.caption)
                .foregroundStyle(Color.labelSecondary)
                .lineLimit(1)
            }
            Spacer(minLength: 8)
            Text(item.amount, format: .currency(code: item.currencyCode))
                .font(.system(.body, design: .rounded).weight(.bold))
                .foregroundStyle(.white)
        }
        .padding(14)
        .glassCard()
    }

    private var badge: String {
        let letter = item.merchant.first { $0.isLetter } ?? "?"
        return String(letter).uppercased()
    }
}

private struct CategoryPickerSheet: View {
    var onSelect: (ReceiptCategory) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                ForEach(ReceiptCategory.allCases) { category in
                    Button {
                        onSelect(category)
                        dismiss()
                    } label: {
                        Label(category.rawValue, systemImage: category.symbolName)
                            .foregroundStyle(.white)
                    }
                    .listRowBackground(Color.surfaceGlass)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.obsidian)
            .navigationTitle("Recategorize")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .toolbarBackground(Color.obsidian, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
        .presentationBackground(Color.obsidian)
    }
}

private struct ScanButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(configuration.isPressed ? Color.industrialYellowDim : Color.clear, in: Circle())
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

#Preview {
    VaultListView()
        .modelContainer(for: [ReceiptItem.self, ReceiptPage.self], inMemory: true)
        .environment(SubscriptionManager.shared)
        .preferredColorScheme(.dark)
}
