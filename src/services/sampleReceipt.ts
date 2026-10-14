import { Asset } from 'expo-asset';

import type { ReceiptDraft } from '../types';
import { createId } from './ids';

const sampleImage = require('../../assets/sample-receipt.png') as number;

export async function loadSampleDraft(): Promise<ReceiptDraft> {
  const asset = Asset.fromModule(sampleImage);
  if (!asset.localUri) await asset.downloadAsync();
  return {
    merchant: 'Astron Energy',
    date: '2026-09-03',
    category: 'Supplies & Materials',
    subtotal: 120.74,
    tax: 21.32,
    total: 142.06,
    reference: 'INV-204',
    imageUri: asset.localUri ?? asset.uri,
    deductible: true,
    lineItems: [
      { id: createId(), label: 'Shop purchase', amount: 120.74, qty: 1 },
    ],
    moneyCandidates: [120.74, 21.32, 142.06],
    dateCandidates: ['2026-09-03'],
  };
}
