import type { LineItem } from '../types';
import { createId } from './ids';

const MONEY_PATTERN = /\$?\s*(?:\d{1,3}(?:[.,]\d{3})+[.,]\d{2}|\d+[.,]\d{2})/g;

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

export type ParsedReceipt = {
  merchant: string;
  date: string;
  category: Category;
  subtotal: number;
  tax: number;
  total: number;
  reference: string;
  lineItems: LineItem[];
  moneyCandidates: number[];
  dateCandidates: string[];
};

export function parseReceipt(lines: string[]): ParsedReceipt {
  const merchant = detectMerchant(lines) ?? 'Store Receipt';
  const subtotal = labeledAmount(lines, ['subtotal', 'sub-total', 'sub total']) ?? 0;
  const tax = labeledAmount(lines, ['tax', 'vat', 'gst']) ?? 0;
  const total = detectTotal(lines) ?? 0;
  const dateCandidates = uniqueDates(lines);
  const date = dateCandidates[0] ?? todayIso();
  const moneyCandidates = uniqueMoney(lines);
  return {
    merchant,
    date,
    category: suggestCategory(merchant, lines),
    subtotal,
    tax,
    total,
    reference: detectReference(lines),
    lineItems: detectLineItems(lines),
    moneyCandidates,
    dateCandidates,
  };
}

export function parseMoney(raw: string): number | null {
  let text = raw.replace(/\$/g, '').replace(/usd/gi, '').trim();
  text = text.replace(/[^0-9.,]/g, '');
  if (!text) return null;

  const hasComma = text.includes(',');
  const hasDot = text.includes('.');
  if (hasComma && hasDot) {
    if (text.lastIndexOf('.') > text.lastIndexOf(',')) {
      text = text.replace(/,/g, '');
    } else {
      text = text.replace(/\./g, '').replace(',', '.');
    }
  } else if (hasComma) {
    const parts = text.split(',');
    const fraction = parts[parts.length - 1] ?? '';
    text = parts.length === 2 && fraction.length <= 2 ? text.replace(',', '.') : text.replace(/,/g, '');
  }

  const value = Number(text);
  if (!Number.isFinite(value) || value < 0 || value >= 1_000_000) return null;
  return value;
}

export function moneyValues(line: string): number[] {
  return [...line.matchAll(MONEY_PATTERN)].flatMap((match) => {
    const value = parseMoney(match[0]);
    return value == null ? [] : [value];
  });
}

function uniqueMoney(lines: string[]): number[] {
  const seen = new Set<string>();
  const values: number[] = [];
  for (const line of lines) {
    for (const value of moneyValues(line)) {
      const key = value.toFixed(2);
      if (seen.has(key)) continue;
      seen.add(key);
      values.push(value);
    }
  }
  return values;
}

function uniqueDates(lines: string[]): string[] {
  const preferred = lines.filter((line) => line.toLowerCase().includes('date'));
  const remainder = lines.filter((line) => !preferred.includes(line));
  const seen = new Set<string>();
  const dates: string[] = [];
  for (const line of [...preferred, ...remainder]) {
    const found = firstDate(line);
    if (!found || seen.has(found)) continue;
    seen.add(found);
    dates.push(found);
  }
  return dates;
}

function detectMerchant(lines: string[]): string | null {
  const candidates = lines.slice(0, 6).map((line) => line.trim()).filter(isLikelyMerchant);
  return candidates.find((line) => line === line.toUpperCase() && letterCount(line) >= 3) ?? candidates[0] ?? null;
}

function isLikelyMerchant(line: string): boolean {
  if (line.length <= 2) return false;
  const lower = line.toLowerCase();
  const banned = [
    'cash receipt', 'receipt', 'thank you', 'description', 'price', 'subtotal', 'sub-total',
    'total', 'tax', 'qty', 'amount', 'change', 'visa', 'mastercard', 'debit',
    'credit', 'reference', 'approval', 'invoice', 'date:', 'date ', 'tel',
    'phone', 'www', 'http', 'address',
  ];
  if (banned.some((word) => lower.includes(word))) return false;
  if (line.includes('$') || line.includes('%')) return false;
  if (/^\d/.test(line)) return false;
  if (firstDate(line)) return false;
  return letterCount(line) >= 3;
}

function detectTotal(lines: string[]): number | null {
  const total = lastAmount(lines, (lower) =>
    lower.includes('total') && !lower.includes('subtotal') && !lower.includes('sub-total') && !lower.includes('sub total'),
  );
  if (total != null) return total;
  const due = lastAmount(lines, (lower) =>
    lower.includes('balance') || lower.includes('amount due') || lower.includes('amount paid'),
  );
  if (due != null) return due;
  const values = lines.flatMap(moneyValues);
  return values.length ? Math.max(...values) : null;
}

function labeledAmount(lines: string[], keywords: string[]): number | null {
  return lastAmount(lines, (lower) => keywords.some((keyword) => lower.includes(keyword)));
}

function lastAmount(lines: string[], predicate: (lower: string) => boolean): number | null {
  for (const line of [...lines].reverse()) {
    if (!predicate(line.toLowerCase())) continue;
    const values = moneyValues(line);
    if (values.length) return values[values.length - 1];
  }
  return null;
}

function detectReference(lines: string[]): string {
  const pattern = /\b(?:approval(?:\s*code)?|auth(?:orization)?(?:\s*code)?|ref(?:erence)?|invoice(?:\s*(?:no|number))?)\b\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{2,})/i;
  for (const line of lines) {
    const match = line.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

function detectLineItems(lines: string[]): LineItem[] {
  const skip = /subtotal|sub-total|sub total|\btotal\b|\btax\b|\bvat\b|\bgst\b|\bdate\b|reference|receipt|thank you/i;
  const items: LineItem[] = [];
  for (const line of lines) {
    if (skip.test(line)) continue;
    const values = moneyValues(line);
    if (values.length !== 1) continue;
    const label = line.replace(MONEY_PATTERN, '').replace(/[.$]/g, '').trim();
    if (label.length < 2) continue;
    items.push({ id: createId(), label, amount: values[0], qty: 1 });
  }
  return items;
}

function suggestCategory(merchant: string, lines: string[]): Category {
  const text = [merchant, ...lines.slice(0, 8)].join(' ').toLowerCase();
  const rules: Array<[Category, string[]]> = [
    ['Fuel & Mileage', ['shell', 'chevron', 'exxon', 'astron', 'fuel', 'gas station', 'petrol', 'mileage']],
    ['Software', ['adobe', 'github', 'software', 'saas', 'google workspace']],
    ['Travel', ['uber', 'lyft', 'airline', 'delta air', 'united air', 'hotel', 'airbnb', 'parking']],
    ['Tools & Equipment', ['home depot', 'tool', 'equipment']],
    ['Utilities', ['utility', 'electric', 'comcast', 'vodacom']],
    ['Supplies & Materials', ['staples', 'office depot', 'office supplies', 'supplies']],
    ['Business Meals', ['starbucks', 'cafe', 'coffee', 'restaurant', 'mcdonald', 'doordash', 'grubhub', 'dining', 'pizza']],
  ];
  for (const [category, keys] of rules) {
    if (keys.some((key) => text.includes(key))) return category;
  }
  return 'Other';
}

function firstDate(line: string): string | null {
  const patterns = [
    /\d{4}-\d{2}-\d{2}/,
    /\d{1,2}\/\d{1,2}\/\d{2,4}/,
    /\d{1,2}-\d{1,2}-\d{4}/,
    /[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4}/,
    /\d{1,2}\s+[A-Za-z]{3,9}\.?\s+\d{4}/,
  ];
  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (!match) continue;
    const parsed = parseDateToken(match[0].replace(/\./g, ''));
    if (parsed) return parsed;
  }
  return null;
}

function parseDateToken(token: string): string | null {
  const iso = token.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return plausible(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const slash = token.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) return plausible(expandYear(Number(slash[3])), Number(slash[1]), Number(slash[2]));

  const dashed = token.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashed) return plausible(Number(dashed[3]), Number(dashed[1]), Number(dashed[2]));

  const monthFirst = token.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (monthFirst) {
    const month = MONTHS[monthFirst[1].toLowerCase()];
    if (month) return plausible(Number(monthFirst[3]), month, Number(monthFirst[2]));
  }

  const dayFirst = token.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (dayFirst) {
    const month = MONTHS[dayFirst[2].toLowerCase()];
    if (month) return plausible(Number(dayFirst[3]), month, Number(dayFirst[1]));
  }
  return null;
}

function expandYear(year: number): number {
  if (year >= 100) return year;
  return year >= 70 ? 1900 + year : 2000 + year;
}

function plausible(year: number, month: number, day: number): string | null {
  if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  const limit = new Date();
  limit.setDate(limit.getDate() + 7);
  if (date > limit) return null;
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function todayIso(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-${dd}`;
}

function letterCount(line: string): number {
  return [...line].filter((char) => /\p{L}/u.test(char)).length;
}

export type Category =
  | 'Supplies & Materials'
  | 'Fuel & Mileage'
  | 'Business Meals'
  | 'Tools & Equipment'
  | 'Software'
  | 'Travel'
  | 'Utilities'
  | 'Other';

export const CATEGORIES: readonly Category[] = [
  'Supplies & Materials',
  'Fuel & Mileage',
  'Business Meals',
  'Tools & Equipment',
  'Software',
  'Travel',
  'Utilities',
  'Other',
];

export const CATEGORY_EMOJI: Record<Category, string> = {
  'Supplies & Materials': '📎',
  'Fuel & Mileage': '⛽',
  'Business Meals': '🍔',
  'Tools & Equipment': '🛠️',
  Software: '🖥️',
  Travel: '✈️',
  Utilities: '⚡',
  Other: '🧾',
};

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}
