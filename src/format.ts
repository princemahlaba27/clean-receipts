import type { LocaleProfile } from './services/currency';

export function formatMoney(value: number, locale: LocaleProfile): string {
  const negative = value < 0;
  const digits = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const body = locale.code === 'ZAR' ? `${locale.symbol} ${digits}` : `${locale.symbol}${digits}`;
  return negative ? `-${body}` : body;
}

export function formatIsoDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function monthTitle(year: number, month: number): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

export function quarterOf(iso: string): number {
  const month = Number(iso.slice(5, 7));
  return Math.floor((month - 1) / 3) + 1;
}

export function currentQuarter(now = new Date()): number {
  return Math.floor(now.getMonth() / 3) + 1;
}

export function yearOf(iso: string): number {
  return Number(iso.slice(0, 4));
}
