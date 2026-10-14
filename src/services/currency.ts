export type CurrencyCode = 'ZAR' | 'USD' | 'GBP' | 'EUR' | 'AUD' | 'CAD';

export type LocaleProfile = {
  code: CurrencyCode;
  country: string;
  flag: string;
  symbol: string;
  subtitle: string;
  taxName: string;
  taxRate: number;
};

export const LOCALES: readonly LocaleProfile[] = [
  {
    code: 'ZAR',
    country: 'South Africa',
    flag: '🇿🇦',
    symbol: 'R',
    subtitle: 'Rand (R • ZAR) • SARS & 15% VAT',
    taxName: 'VAT (15%)',
    taxRate: 0.15,
  },
  {
    code: 'USD',
    country: 'United States',
    flag: '🇺🇸',
    symbol: '$',
    subtitle: 'Dollar ($ • USD) • IRS Schedule C',
    taxName: 'Sales tax',
    taxRate: 0,
  },
  {
    code: 'GBP',
    country: 'United Kingdom',
    flag: '🇬🇧',
    symbol: '£',
    subtitle: 'Pound (£ • GBP) • HMRC & 20% VAT',
    taxName: 'VAT (20%)',
    taxRate: 0.2,
  },
  {
    code: 'EUR',
    country: 'European Union',
    flag: '🇪🇺',
    symbol: '€',
    subtitle: 'Euro (€ • EUR) • Local VAT',
    taxName: 'VAT',
    taxRate: 0,
  },
  {
    code: 'AUD',
    country: 'Australia',
    flag: '🇦🇺',
    symbol: 'A$',
    subtitle: 'Dollar (A$ • AUD) • ATO & 10% GST',
    taxName: 'GST (10%)',
    taxRate: 0.1,
  },
  {
    code: 'CAD',
    country: 'Canada',
    flag: '🇨🇦',
    symbol: 'CA$',
    subtitle: 'Dollar (CA$ • CAD) • CRA & GST/HST',
    taxName: 'GST/HST',
    taxRate: 0,
  },
];

export function isCurrencyCode(value: string): value is CurrencyCode {
  return LOCALES.some((locale) => locale.code === value);
}

export function localeByCode(code: CurrencyCode): LocaleProfile {
  return LOCALES.find((locale) => locale.code === code) ?? LOCALES[0];
}
