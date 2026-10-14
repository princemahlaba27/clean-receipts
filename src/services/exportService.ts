import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

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
    dialogTitle: 'Export Expense Report',
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
    .map((receipt, index) => {
      return `<tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(formatIsoDate(receipt.date))}</td>
        <td>${escapeHtml(receipt.merchant)}</td>
        <td>${escapeHtml(receipt.category)}</td>
        <td>${escapeHtml(formatMoney(receipt.tax, locale))}</td>
        <td>${escapeHtml(formatMoney(receipt.total, locale))}</td>
      </tr>`;
    })
    .join('');
  const byCategory = new Map<string, number>();
  for (const receipt of receipts) {
    byCategory.set(receipt.category, (byCategory.get(receipt.category) ?? 0) + receipt.total);
  }
  const summary = [...byCategory.entries()]
    .map(
      ([category, amount]) =>
        `<tr><td>${escapeHtml(category)}</td><td>${escapeHtml(formatMoney(amount, locale))}</td></tr>`,
    )
    .join('');
  const taxTotal = receipts.reduce((sum, receipt) => sum + receipt.tax, 0);
  const total = receipts.reduce((sum, receipt) => sum + receipt.total, 0);
  const images = receipts
    .map((receipt, index) => {
      const src = proofs[index];
      if (!src) return '';
      return `<figure><figcaption>#${index + 1} ${escapeHtml(receipt.merchant)} · ${escapeHtml(formatMoney(receipt.total, locale))}</figcaption><img src="${src}" /></figure>`;
    })
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
    <style>
      body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #101828; background: #fff; margin: 32px; }
      h1 { font-size: 28px; margin: 0; }
      .meta { color: #667085; margin: 6px 0 24px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
      th { text-align: left; font-size: 11px; letter-spacing: 0.06em; color: #667085; border-bottom: 1px solid #E4E7EC; padding: 8px 6px; }
      td { border-bottom: 1px solid #F2F4F7; padding: 10px 6px; font-size: 13px; }
      h2 { font-size: 16px; margin: 28px 0 8px; }
      figure { margin: 0 0 18px; page-break-inside: avoid; }
      figcaption { font-size: 12px; color: #667085; margin-bottom: 6px; }
      img { width: 280px; border: 1px solid #E4E7EC; border-radius: 12px; }
    </style></head><body>
    <h1>Expense Report</h1>
    <p class="meta">${escapeHtml(periodTitle)} · Currency ${escapeHtml(locale.code)} · ${escapeHtml(locale.taxName)}</p>
    <table>
      <thead><tr><th>#</th><th>DATE</th><th>MERCHANT</th><th>CATEGORY</th><th>VAT/TAX</th><th>TOTAL</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6">No receipts in this period.</td></tr>'}</tbody>
    </table>
    <h2>Summary</h2>
    <table>
      <thead><tr><th>CATEGORY</th><th>AMOUNT</th></tr></thead>
      <tbody>${summary}</tbody>
    </table>
    <p><strong>${escapeHtml(locale.taxName)}</strong> ${escapeHtml(formatMoney(taxTotal, locale))}<br/>
    <strong>Total</strong> ${escapeHtml(formatMoney(total, locale))}</p>
    <h2>Receipts</h2>
    ${images}
    </body></html>`;
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
        formatMoney(receipt.tax, locale),
        formatMoney(receipt.total, locale),
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
