import { Asset } from 'expo-asset';

import type { ReceiptDraft } from '../types';
import { createId } from './ids';

const sampleImage = require('../../assets/sample-receipt.png') as number;

export async function loadSampleDraft(): Promise<ReceiptDraft> {
  const asset = Asset.fromModule(sampleImage);
  if (!asset.localUri) await asset.downloadAsync();
  return {
    merchant: 'Starbucks',
    date: '2025-10-23',
    category: 'Meals & Dining',
    subtotal: 7.75,
    tax: 0.62,
    total: 8.37,
    reference: 'APL-987657',
    imageUri: asset.localUri ?? asset.uri,
    lineItems: [
      { id: createId(), label: 'Coffee', amount: 4.5 },
      { id: createId(), label: 'Muffin', amount: 3.25 },
    ],
    moneyCandidates: [4.5, 3.25, 7.75, 0.62, 8.37],
    dateCandidates: ['2025-10-23'],
  };
}
