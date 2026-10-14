import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { ESTIMATED_TAX_RATE } from '../config';
import { formatIsoDate, formatMoney } from '../format';
import type { StoredReceipt } from '../types';
import type { LocaleProfile } from './currency';
import { writeCacheText } from './files';

const PROOF_WIDTH = 1125;

export async function exportDossier(
  receipts: StoredReceipt[],
  periodTitle: string,
  locale: LocaleProfile,
  kind: 'pdf' | 'csv',
): Promise<void> {
  const sorted = [...receipts].sort((left, right) => left.date.localeCompare(right.date) || left.createdAt - right.createdAt);
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  if (kind === 'csv') {
    const csvUri = writeCacheText(fileName(periodTitle, 'csv'), renderCsv(sorted, locale));
    await Sharing.shareAsync(csvUri, {
      mimeType: 'text/csv',
      UTI: 'public.comma-separated-values-text',
      dialogTitle: 'Export Expense Report',
    });
    return;
  }
  const proofs = [];
  for (const receipt of sorted) {
    proofs.push(await downscaleProof(receipt.imagePath));
  }
  const html = renderHtml(sorted, proofs, periodTitle, locale);
  const pdf = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(pdf.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Tax Expense Statement',
  });
}

async function downscaleProof(uri: string): Promise<string> {
  try {
    const saved = await manipulateAsync(uri, [{ resize: { width: PROOF_WIDTH } }], {
      compress: 0.72,
      format: SaveFormat.JPEG,
    });
    return saved.uri;
  } catch {
    return uri;
  }
}

function renderHtml(receipts: StoredReceipt[], proofs: string[], periodTitle: string, locale: LocaleProfile): string {
  const rows = receipts
    .map((receipt) => {
      return `<tr>
        <td>${escapeHtml(formatIsoDate(receipt.date))}</td>
        <td>${escapeHtml(receipt.merchant)}</td>
        <td>${escapeHtml(receipt.category)}</td>
        <td class="num">${escapeHtml(formatMoney(receipt.tax, locale))}</td>
        <td class="num">${escapeHtml(formatMoney(receipt.total, locale))}</td>
      </tr>`;
    })
    .join('');
  const gross = receipts.reduce((sum, receipt) => sum + receipt.total, 0);
  const deductible = receipts.reduce((sum, receipt) => sum + (receipt.deductible ? receipt.total : 0), 0);
  const savings = deductible * ESTIMATED_TAX_RATE;
  const figures = receipts
    .map((receipt, index) => {
      const src = proofs[index]?.replace(/"/g, '%22');
      if (!src) return '';
      return `<figure><figcaption>${escapeHtml(formatIsoDate(receipt.date))} · ${escapeHtml(receipt.merchant)} · ${escapeHtml(formatMoney(receipt.total, locale))}</figcaption><img src="${src}" alt="" /></figure>`;
    })
    .filter(Boolean)
    .join('');
  const proofsSection = figures ? `<section class="proofs">${figures}</section>` : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
    <style>
      @page { margin: 0; }
      body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #101828; background: #fff; margin: 0; }
      .statement { padding: 32px; }
      h1 { font-size: 28px; margin: 0; }
      .meta { color: #667085; margin: 8px 0 24px; line-height: 1.5; }
      table { width: 100%; border-collapse: collapse; }
      th { text-align: left; font-size: 11px; letter-spacing: 0.04em; color: #667085; border-bottom: 1px solid #E4E7EC; padding: 8px 6px; }
      td { border-bottom: 1px solid #F2F4F7; padding: 10px 6px; font-size: 13px; vertical-align: top; }
      th.num, td.num { text-align: right; white-space: nowrap; }
      .totals { margin-top: 22px; margin-left: auto; width: 340px; }
      .totals div { display: flex; justify-content: flex-end; gap: 18px; padding: 7px 0; border-bottom: 1px solid #F2F4F7; }
      .totals span { color: #667085; }
      .totals strong { min-width: 120px; text-align: right; }
      .proofs { page-break-before: always; break-before: page; }
      figure { margin: 0; page-break-inside: avoid; break-inside: avoid; }
      figcaption { font-size: 12px; color: #667085; padding: 16px 16px 8px; }
      img {
        width: 100%;
        height: auto;
        display: block;
        filter: grayscale(1) contrast(1.5);
        -webkit-filter: grayscale(1) contrast(1.5);
      }
    </style></head><body>
    <section class="statement">
      <h1>Tax Expense Statement</h1>
      <p class="meta">Period ${escapeHtml(periodTitle)}<br/>Generated ${escapeHtml(todayLabel())}<br/>Currency ${escapeHtml(locale.code)}</p>
      <table>
        <thead><tr><th>Date</th><th>Vendor / Merchant</th><th>Category</th><th class="num">VAT / Tax</th><th class="num">Total</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5">No receipts in this period.</td></tr>'}</tbody>
      </table>
      <div class="totals">
        <div><span>Total Gross Expenses</span><strong>${escapeHtml(formatMoney(gross, locale))}</strong></div>
        <div><span>Total Deductibles</span><strong>${escapeHtml(formatMoney(deductible, locale))}</strong></div>
        <div><span>Estimated Tax Savings</span><strong>${escapeHtml(formatMoney(savings, locale))}</strong></div>
      </div>
    </section>
    ${proofsSection}
    </body></html>`;
}

function todayLabel(): string {
  const now = new Date();
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return formatIsoDate(iso);
}

function renderCsv(receipts: StoredReceipt[], locale: LocaleProfile): string {
  const header = ['#', 'Date', 'Merchant', 'Category', 'VAT/Tax', 'Total', 'Currency'];
  const lines = [header.join(',')];
  receipts.forEach((receipt, index) => {
    lines.push(
      [
        String(index + 1),
        receipt.date,
        csv(receipt.merchant),
        csv(receipt.category),
        csv(formatMoney(receipt.tax, locale)),
        csv(formatMoney(receipt.total, locale)),
        locale.code,
      ].join(','),
    );
  });
  return lines.join('\n');
}

function csv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fileName(periodTitle: string, extension: string): string {
  const slug = periodTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `expense-report-${slug || 'vault'}.${extension}`;
}
