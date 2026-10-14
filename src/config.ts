export const REVENUECAT_API_KEY = 'appl_bktuWdyiFioaDjjLrHLUpZfwpWv';

/** Dashboard entitlement is "Clean Receipts Pro". Older builds also check "pro". */
export const ENTITLEMENT_IDS = ['Clean Receipts Pro', 'pro'] as const;

export const WEEKLY_PRODUCT_ID = 'cleanreceipts_weekly_intro';
export const ANNUAL_PRODUCT_ID = 'cleanreceipts_annual_trial';
export const MONTHLY_PRODUCT_ID = 'cleanreceipts_monthly_downsell';

export const TERMS_URL = 'https://cleanreceipts.app/terms.html';
export const PRIVACY_URL = 'https://cleanreceipts.app/privacy.html';

export const ESTIMATED_TAX_RATE = 0.24;
export const FREE_RECEIPT_LIMIT = 5;

export const FALLBACK_PRICES = {
  weeklyIntro: '$0.99',
  weeklyRenewal: '$6.99',
  annual: '$39.99',
  downsellIntro: '$1.99',
  downsellRenewal: '$4.99',
};
