import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { formatIsoDate, formatMoney } from '../format';
import type { StoredReceipt } from '../types';
import { writeCacheText } from './files';

const PROOF_WIDTH = 1125;

export async function exportDossier(receipts: StoredReceipt[], periodTitle: string): Promise<void> {
  const sorted = [...receipts].sort((left, right) => left.date.localeCompare(right.date) || left.createdAt - right.createdAt);
  const proofs = [];
  for (const receipt of sorted) {
    proofs.push({ receipt, uri: await downscaleProof(receipt.imagePath) });
  }
  const html = renderHtml(sorted, proofs.map((item) => item.uri), periodTitle);
  const pdf = await Print.printToFileAsync({ html });
  const csvUri = writeCacheText(fileName(periodTitle, 'csv'), renderCsv(sorted));
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(pdf.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Export Audit Dossier',
  });
  await Sharing.shareAsync(csvUri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: 'Export Audit Dossier CSV',
  });
}

async function downscaleProof(uri: string): Promise<string> {
  try {
    const saved = await manipulateAsync(
      uri,
      [{ resize: { width: PROOF_WIDTH } }],
      { compress: 0.72, format: SaveFormat.JPEG },
    );
    return saved.uri;
  } catch {
    return uri;
  }
}

function renderCsv(receipts: StoredReceipt[]): string {
  const header = ['Date', 'Merchant', 'Category', 'Tax', 'Amount'];
  const rows = receipts.map((receipt) => [
    receipt.date,
    receipt.merchant,
    receipt.category,
    receipt.tax.toFixed(2),
    receipt.total.toFixed(2),
  ]);
  const grand = receipts.reduce((sum, receipt) => sum + receipt.total, 0);
  const tax = receipts.reduce((sum, receipt) => sum + receipt.tax, 0);
  rows.push(['', 'Grand Total', '', tax.toFixed(2), grand.toFixed(2)]);
  return [header, ...rows].map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n';
}

function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function renderHtml(receipts: StoredReceipt[], proofUris: string[], periodTitle: string): string {
  const grand = receipts.reduce((sum, receipt) => sum + receipt.total, 0);
  const rows = receipts.map((receipt) => `
    <tr>
      <td>${escapeHtml(formatIsoDate(receipt.date))}</td>
      <td>${escapeHtml(receipt.merchant)}</td>
      <td>${escapeHtml(receipt.category)}</td>
      <td class="num">${escapeHtml(formatMoney(receipt.tax))}</td>
      <td class="num">${escapeHtml(formatMoney(receipt.total))}</td>
    </tr>
  `).join('');
  const proofs = proofUris.map((uri, index) => {
    const receipt = receipts[index];
    const stamp = new Date().toISOString();
    return `
      <section class="proof">
        <h2>Receipt proof ${index + 1} of ${proofUris.length}</h2>
        <p>${escapeHtml(receipt?.merchant ?? '')} · ${escapeHtml(receipt ? formatIsoDate(receipt.date) : '')} · Verified ${escapeHtml(stamp)}</p>
        <img src="${escapeHtml(uri)}" alt="Receipt scan" />
      </section>
    `;
  }).join('');
  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #111; margin: 32px; }
        h1 { font-size: 22px; margin-bottom: 4px; }
        p { color: #444; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border-bottom: 1px solid #ddd; text-align: left; padding: 8px 6px; font-size: 12px; }
        th { font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; }
        .num { text-align: right; font-family: ui-monospace, Menlo, Consolas, monospace; }
        .total { font-weight: 700; }
        .proof { page-break-before: always; }
        img { width: 100%; max-width: 1125px; filter: grayscale(1); margin-top: 12px; }
      </style>
    </head>
    <body>
      <h1>Tax Receipts Audit Dossier</h1>
      <p>Period ${escapeHtml(periodTitle)} · ${receipts.length} receipt${receipts.length === 1 ? '' : 's'} · Generated ${escapeHtml(new Date().toISOString())}</p>
      <table>
        <thead>
          <tr><th>Date</th><th>Merchant</th><th>Category</th><th>Tax</th><th>Amount</th></tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="total"><td></td><td>Grand Total</td><td></td><td></td><td class="num">${escapeHtml(formatMoney(grand))}</td></tr>
        </tbody>
      </table>
      ${proofs}
    </body>
  </html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fileName(periodTitle: string, ext: string): string {
  const safe = periodTitle.replace(/[^\w.-]+/g, '-');
  return `TaxReceipts-${safe}.${ext}`;
}
