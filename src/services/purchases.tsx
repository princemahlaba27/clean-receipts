import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';

import {
  ANNUAL_PRODUCT_ID,
  ENTITLEMENT_ID,
  FALLBACK_PRICES,
  MONTHLY_PRODUCT_ID,
  REVENUECAT_API_KEY,
  WEEKLY_PRODUCT_ID,
} from '../config';

type Prices = {
  weeklyIntro: string;
  weeklyRenewal: string;
  annual: string;
  downsellIntro: string;
  downsellRenewal: string;
};

type BillingContextValue = Prices & {
  isPro: boolean;
  loading: boolean;
  lastError: string | null;
  paywallVisible: boolean;
  downsellVisible: boolean;
  requestAccess: (onGranted: () => void) => void;
  closePaywall: () => void;
  closeDownsell: () => void;
  purchaseWeekly: () => Promise<void>;
  purchaseAnnual: () => Promise<void>;
  purchaseMonthly: () => Promise<void>;
  restore: () => Promise<void>;
};

const BillingContext = createContext<BillingContextValue | null>(null);

export function BillingProvider({ children }: { children: ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [downsellVisible, setDownsellVisible] = useState(false);
  const [prices, setPrices] = useState<Prices>(FALLBACK_PRICES);
  const [weekly, setWeekly] = useState<PurchasesPackage | null>(null);
  const [annual, setAnnual] = useState<PurchasesPackage | null>(null);
  const [monthly, setMonthly] = useState<PurchasesPackage | null>(null);
  const pending = useRef<(() => void) | null>(null);

  const refresh = useCallback(async () => {
    const info = await Purchases.getCustomerInfo();
    setIsPro(Boolean(info.entitlements.active[ENTITLEMENT_ID]));
    const offerings = await Purchases.getOfferings();
    const packages = Object.values(offerings.all).flatMap((offering) => offering.availablePackages);
    const weeklyPackage = findPackage(packages, WEEKLY_PRODUCT_ID);
    const annualPackage = findPackage(packages, ANNUAL_PRODUCT_ID);
    const monthlyPackage = findPackage(packages, MONTHLY_PRODUCT_ID);
    setWeekly(weeklyPackage);
    setAnnual(annualPackage);
    setMonthly(monthlyPackage);
    setPrices({
      weeklyIntro: weeklyPackage?.product.introPrice?.priceString ?? FALLBACK_PRICES.weeklyIntro,
      weeklyRenewal: weeklyPackage?.product.priceString ?? FALLBACK_PRICES.weeklyRenewal,
      annual: annualPackage?.product.priceString ?? FALLBACK_PRICES.annual,
      downsellIntro: monthlyPackage?.product.introPrice?.priceString ?? FALLBACK_PRICES.downsellIntro,
      downsellRenewal: monthlyPackage?.product.priceString ?? FALLBACK_PRICES.downsellRenewal,
    });
  }, []);

  useEffect(() => {
    Purchases.configure({ apiKey: REVENUECAT_API_KEY });
    refresh().catch((error: unknown) => {
      setLastError(error instanceof Error ? error.message : 'Plans could not be loaded.');
    });
  }, [refresh]);

  const grant = useCallback((active: boolean) => {
    setIsPro(active);
    if (!active) return;
    setPaywallVisible(false);
    setDownsellVisible(false);
    const next = pending.current;
    pending.current = null;
    next?.();
  }, []);

  const buy = useCallback(async (pack: PurchasesPackage | null) => {
    if (!pack) {
      setLastError('This plan is not available yet.');
      return;
    }
    setLoading(true);
    setLastError(null);
    try {
      const result = await Purchases.purchasePackage(pack);
      grant(Boolean(result.customerInfo.entitlements.active[ENTITLEMENT_ID]));
    } catch (error: unknown) {
      if (!isCancelled(error)) {
        setLastError(error instanceof Error ? error.message : 'The purchase could not be completed.');
      }
    } finally {
      setLoading(false);
    }
  }, [grant]);

  const value = useMemo<BillingContextValue>(() => ({
    ...prices,
    isPro,
    loading,
    lastError,
    paywallVisible,
    downsellVisible,
    requestAccess: (onGranted) => {
      if (isPro) {
        onGranted();
        return;
      }
      pending.current = onGranted;
      setLastError(null);
      setPaywallVisible(true);
    },
    closePaywall: () => {
      setPaywallVisible(false);
      setDownsellVisible(true);
    },
    closeDownsell: () => {
      setDownsellVisible(false);
      pending.current = null;
    },
    purchaseWeekly: () => buy(weekly),
    purchaseAnnual: () => buy(annual),
    purchaseMonthly: () => buy(monthly),
    restore: async () => {
      setLoading(true);
      setLastError(null);
      try {
        const info = await Purchases.restorePurchases();
        const active = Boolean(info.entitlements.active[ENTITLEMENT_ID]);
        if (!active) setLastError('No purchases to restore.');
        grant(active);
      } catch (error: unknown) {
        setLastError(error instanceof Error ? error.message : 'Restore failed.');
      } finally {
        setLoading(false);
      }
    },
  }), [annual, buy, downsellVisible, grant, isPro, lastError, loading, monthly, paywallVisible, prices, weekly]);

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}

export function useBilling(): BillingContextValue {
  const value = useContext(BillingContext);
  if (!value) throw new Error('useBilling must be used within BillingProvider');
  return value;
}

function findPackage(packages: PurchasesPackage[], productId: string): PurchasesPackage | null {
  return packages.find((pack) => pack.product.identifier === productId) ?? null;
}

function isCancelled(error: unknown): boolean {
  return typeof error === 'object' && error != null && 'userCancelled' in error && Boolean((error as { userCancelled?: boolean }).userCancelled);
}
