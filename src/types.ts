export const CATEGORIES = [
  'Meals & Dining',
  'Travel',
  'Office Supplies',
  'Fuel',
  'Software',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];

export type LineItem = {
  id: string;
  label: string;
  amount: number;
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
  createdAt: number;
  lineItems: LineItem[];
};

export type RootStackParamList = {
  Vault: undefined;
  Scanner: undefined;
  ReceiptDetail: { draft: ReceiptDraft };
};
