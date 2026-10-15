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
    subtitle: 'Rand (R) • 15% VAT',
    taxName: 'VAT (15%)',
    taxRate: 0.15,
  },
  {
    code: 'USD',
    country: 'United States',
    flag: '🇺🇸',
    symbol: '$',
    subtitle: 'US dollar ($)',
    taxName: 'Sales tax',
    taxRate: 0,
  },
  {
    code: 'GBP',
    country: 'United Kingdom',
    flag: '🇬🇧',
    symbol: '£',
    subtitle: 'Pound (£) • 20% VAT',
    taxName: 'VAT (20%)',
    taxRate: 0.2,
  },
  {
    code: 'EUR',
    country: 'European Union',
    flag: '🇪🇺',
    symbol: '€',
    subtitle: 'Euro (€) • VAT',
    taxName: 'VAT',
    taxRate: 0,
  },
  {
    code: 'AUD',
    country: 'Australia',
    flag: '🇦🇺',
    symbol: 'A$',
    subtitle: 'Australian dollar (A$) • 10% GST',
    taxName: 'GST (10%)',
    taxRate: 0.1,
  },
  {
    code: 'CAD',
    country: 'Canada',
    flag: '🇨🇦',
    symbol: 'CA$',
    subtitle: 'Canadian dollar (CA$) • GST/HST',
    taxName: 'GST/HST',
    taxRate: 0,
  },
];

const EURO_AREA = new Set([
  'AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR',
  'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK',
]);

export function currencyForRegion(regionCode: string | null | undefined): CurrencyCode {
  const region = regionCode?.toUpperCase();
  switch (region) {
    case 'ZA':
      return 'ZAR';
    case 'US':
      return 'USD';
    case 'GB':
      return 'GBP';
    case 'AU':
      return 'AUD';
    case 'CA':
      return 'CAD';
    default:
      return region && EURO_AREA.has(region) ? 'EUR' : 'ZAR';
  }
}

export function isCurrencyCode(value: string): value is CurrencyCode {
  return LOCALES.some((locale) => locale.code === value);
}

export function localeByCode(code: CurrencyCode): LocaleProfile {
  return LOCALES.find((locale) => locale.code === code) ?? LOCALES[0];
}
