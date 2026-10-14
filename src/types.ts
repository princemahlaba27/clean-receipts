import type { Category } from './services/receiptParser';

export type { Category };
export { CATEGORIES } from './services/receiptParser';

export type LineItem = {
  id: string;
  label: string;
  amount: number;
  qty: number;
};

export type ReceiptDraft = {
  merchant: string;
  date: string;
  category: Category;
  subtotal: number;
  tax: number;
  total: number;
  reference: string;
  imageUri: string;
  deductible: boolean;
  lineItems: LineItem[];
  moneyCandidates: number[];
  dateCandidates: string[];
};

export type StoredReceipt = {
  id: string;
  merchant: string;
  date: string;
  category: Category;
  subtotal: number;
  tax: number;
  total: number;
  reference: string;
  imagePath: string;
  deductible: boolean;
  createdAt: number;
  lineItems: LineItem[];
};

export type RootStackParamList = {
  Vault: undefined;
  Scanner: undefined;
  ReceiptDetail: { draft: ReceiptDraft };
};
