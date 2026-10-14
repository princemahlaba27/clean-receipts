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
import { Platform } from 'react-native';
import Purchases, {
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesIntroPrice,
  type PurchasesPackage,
  type PurchasesStoreProduct,
} from 'react-native-purchases';

import {
  ANNUAL_PRODUCT_ID,
  ENTITLEMENT_IDS,
  FALLBACK_PRICES,
  MONTHLY_PRODUCT_ID,
  REVENUECAT_API_KEY,
  WEEKLY_PRODUCT_ID,
} from '../config';
import { scheduleTrialReminder } from './trialReminder';

type Prices = {
  annualLine: string;
  weeklyLine: string;
  downsellIntro: string;
  downsellRenewal: string;
};

type BillingContextValue = Prices & {
  isPro: boolean;
  isProNow: () => boolean;
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
const FALLBACK: Prices = {
  annualLine: `3-day free trial, then ${FALLBACK_PRICES.annual}/year`,
  weeklyLine: `${FALLBACK_PRICES.weeklyIntro} for 7 days, then ${FALLBACK_PRICES.weeklyRenewal}/week`,
  downsellIntro: FALLBACK_PRICES.downsellIntro,
  downsellRenewal: FALLBACK_PRICES.downsellRenewal,
};

let configured = false;

export function BillingProvider({ children }: { children: ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const isProRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [downsellVisible, setDownsellVisible] = useState(false);
  const [prices, setPrices] = useState<Prices>(FALLBACK);
  const packages = useRef<{ weekly: PurchasesPackage | null; annual: PurchasesPackage | null; monthly: PurchasesPackage | null }>({
    weekly: null,
    annual: null,
    monthly: null,
  });
  const pending = useRef<(() => void) | null>(null);
  const setPro = useCallback((active: boolean) => {
    isProRef.current = active;
    setIsPro(active);
  }, []);

  const refresh = useCallback(async () => {
    if (Platform.OS !== 'ios') return;
    const info = await Purchases.getCustomerInfo();
    setPro(hasAccess(info));
    const offerings = await Purchases.getOfferings();
    const available = Object.values(offerings.all).flatMap((offering) => offering.availablePackages);
    const weekly = findPackage(available, WEEKLY_PRODUCT_ID);
    const annual = findPackage(available, ANNUAL_PRODUCT_ID);
    const monthly = findPackage(available, MONTHLY_PRODUCT_ID);
    packages.current = { weekly, annual, monthly };
    const annualProduct = annual?.product ?? null;
    const weeklyProduct = weekly?.product ?? null;
    setPrices({
      annualLine: annualProduct ? annualLine(annualProduct) : FALLBACK.annualLine,
      weeklyLine: weeklyProduct ? weeklyLine(weeklyProduct) : FALLBACK.weeklyLine,
      downsellIntro: monthly?.product.introPrice?.priceString ?? monthly?.product.priceString ?? FALLBACK.downsellIntro,
      downsellRenewal: monthly?.product.priceString ?? FALLBACK.downsellRenewal,
    });
  }, [setPro]);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (!configured) {
      Purchases.configure({ apiKey: REVENUECAT_API_KEY });
      configured = true;
    }
    const listener = (info: CustomerInfo) => setPro(hasAccess(info));
    Purchases.addCustomerInfoUpdateListener(listener);
    refresh().catch(() => {
      setPrices(FALLBACK);
    });
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [refresh, setPro]);

  const grant = useCallback((info: CustomerInfo) => {
    const active = hasAccess(info);
    setPro(active);
    if (!active) return;
    setPaywallVisible(false);
    setDownsellVisible(false);
    setLastError(null);
    const next = pending.current;
    pending.current = null;
    next?.();
  }, [setPro]);

  const buy = useCallback(async (productId: string, current: PurchasesPackage | null) => {
    if (Platform.OS !== 'ios') {
      setLastError('Purchases open in the iOS app.');
      return;
    }
    setLoading(true);
    setLastError(null);
    try {
      let selected = current;
      if (!selected) {
        await refresh();
        selected = productId === WEEKLY_PRODUCT_ID
          ? packages.current.weekly
          : productId === ANNUAL_PRODUCT_ID
            ? packages.current.annual
            : packages.current.monthly;
      }
      const result = selected
        ? await Purchases.purchasePackage(selected)
        : await purchaseStoreProduct(productId);
      const unlocked = hasAccess(result.customerInfo);
      if (unlocked && productId === ANNUAL_PRODUCT_ID) {
        await scheduleTrialReminder();
      }
      grant(result.customerInfo);
      if (!unlocked) {
        setLastError('The App Store purchase finished, but access is not active yet. Try Restore Purchases.');
      }
    } catch (error: unknown) {
      if (isCancelled(error)) return;
      if (isCode(error, PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR)) {
        const info = await Purchases.restorePurchases();
        grant(info);
        if (!hasAccess(info)) setLastError('This Apple ID already purchased the plan. Restore did not find an active subscription.');
        return;
      }
      const message = purchaseMessage(error);
      if (message == null) {
        setPrices(FALLBACK);
        setLastError(null);
        return;
      }
      setLastError(message);
    } finally {
      setLoading(false);
    }
  }, [grant, refresh]);

  const value = useMemo<BillingContextValue>(() => ({
    ...prices,
    isPro,
    isProNow: () => isProRef.current,
    loading,
    lastError,
    paywallVisible,
    downsellVisible,
    requestAccess: (onGranted) => {
      if (isProRef.current) {
        onGranted();
        return;
      }
      pending.current = onGranted;
      setLastError(null);
      setDownsellVisible(false);
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
    purchaseWeekly: () => buy(WEEKLY_PRODUCT_ID, packages.current.weekly),
    purchaseAnnual: () => buy(ANNUAL_PRODUCT_ID, packages.current.annual),
    purchaseMonthly: () => buy(MONTHLY_PRODUCT_ID, packages.current.monthly),
    restore: async () => {
      if (Platform.OS !== 'ios') {
        setLastError('Purchases open in the iOS app.');
        return;
      }
      setLoading(true);
      setLastError(null);
      try {
        const info = await Purchases.restorePurchases();
        if (!hasAccess(info)) setLastError('No active subscription was found for this Apple ID.');
        grant(info);
      } catch (error: unknown) {
        if (isCancelled(error)) return;
        const message = purchaseMessage(error);
        if (message == null) {
          setPrices(FALLBACK);
          setLastError(null);
          return;
        }
        setLastError(message);
      } finally {
        setLoading(false);
      }
    },
  }), [buy, downsellVisible, grant, isPro, lastError, loading, paywallVisible, prices]);

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}

export function useBilling(): BillingContextValue {
  const value = useContext(BillingContext);
  if (!value) throw new Error('useBilling must be used within BillingProvider');
  return value;
}

async function purchaseStoreProduct(productId: string) {
  const products = await Purchases.getProducts([productId]);
  const product = products.find((item) => item.identifier === productId || item.identifier.startsWith(`${productId}:`));
  if (!product) throw new Error('This plan is not available in the App Store yet.');
  return Purchases.purchaseStoreProduct(product);
}

function findPackage(available: PurchasesPackage[], productId: string): PurchasesPackage | null {
  return available.find((pack) => {
    const id = pack.product.identifier;
    return id === productId || id.startsWith(`${productId}:`);
  }) ?? null;
}

function hasAccess(info: CustomerInfo): boolean {
  const active = info.entitlements.active;
  if (ENTITLEMENT_IDS.some((id) => active[id])) return true;
  return Object.keys(active).length > 0;
}

function annualLine(product: PurchasesStoreProduct | null): string {
  if (!product) return FALLBACK.annualLine;
  const perMonth = product.pricePerMonthString ? ` (${product.pricePerMonthString}/mo)` : '';
  const intro = product.introPrice;
  if (intro && intro.price === 0 && intro.periodUnit === 'DAY') {
    return `${intro.periodNumberOfUnits}-day free trial, then ${product.priceString}/year${perMonth}`;
  }
  if (intro && intro.price === 0) return `Free trial, then ${product.priceString}/year${perMonth}`;
  return `${product.priceString}/year${perMonth}`;
}

function weeklyLine(product: PurchasesStoreProduct | null): string {
  if (!product) return FALLBACK.weeklyLine;
  const intro = product.introPrice;
  if (intro && intro.price > 0) return `${intro.priceString} for ${introPhrase(intro)}, then ${product.priceString}/week`;
  return `${product.priceString}/week`;
}

function introPhrase(intro: PurchasesIntroPrice): string {
  const count = intro.periodNumberOfUnits;
  if (intro.periodUnit === 'DAY') return count === 1 ? '1 day' : `${count} days`;
  if (intro.periodUnit === 'WEEK') return count === 1 ? '7 days' : `${count} weeks`;
  if (intro.periodUnit === 'MONTH') return count === 1 ? 'the first month' : `${count} months`;
  if (intro.periodUnit === 'YEAR') return count === 1 ? '1 year' : `${count} years`;
  return intro.period;
}

function isCancelled(error: unknown): boolean {
  return isCode(error, PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) || (typeof error === 'object' && error != null && 'userCancelled' in error && Boolean((error as { userCancelled?: boolean }).userCancelled));
}

function isCode(error: unknown, code: PURCHASES_ERROR_CODE): boolean {
  return typeof error === 'object' && error != null && 'code' in error && (error as { code?: string }).code === code;
}

function isConfigurationProblem(error: unknown): boolean {
  if (isCode(error, PURCHASES_ERROR_CODE.CONFIGURATION_ERROR)) return true;
  if (isCode(error, PURCHASES_ERROR_CODE.INVALID_CREDENTIALS_ERROR)) return true;
  const message = error instanceof Error ? error.message : '';
  return /configuration|rev\.cat|revenuecat|none of the products registered|offerings-empty/i.test(message);
}

export function visibleBillingError(message: string | null): string | null {
  if (!message) return null;
  if (/configuration|rev\.cat|revenuecat|none of the products registered|offerings-empty/i.test(message)) return null;
  return message;
}

function purchaseMessage(error: unknown): string | null {
  if (isConfigurationProblem(error)) return null;
  if (isCode(error, PURCHASES_ERROR_CODE.NETWORK_ERROR) || isCode(error, PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR)) {
    return 'The App Store could not be reached. Check your connection and try again.';
  }
  if (isCode(error, PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR)) {
    return 'This plan is not available in the App Store yet.';
  }
  if (isCode(error, PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR)) {
    return 'Purchases are not allowed on this device.';
  }
  if (isCode(error, PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR)) {
    return 'The payment is pending approval.';
  }
  if (isCode(error, PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR)) {
    return 'The App Store could not complete the payment. Please try again.';
  }
  if (error instanceof Error && error.message && error.message.length <= 160) return error.message;
  return 'The purchase could not be completed.';
}
