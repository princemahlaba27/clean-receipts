import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { getSetting, setSetting } from '../db/vault';
import { LOCALES, isCurrencyCode, localeByCode, type CurrencyCode, type LocaleProfile } from './currency';

type CurrencyState = {
  ready: boolean;
  onboarded: boolean;
  locale: LocaleProfile;
  openScannerAfterSetup: boolean;
  completeSetup: (code: CurrencyCode, destination: 'vault' | 'scanner') => Promise<void>;
  setCurrency: (code: CurrencyCode) => Promise<void>;
  consumeScannerIntent: () => void;
  rerunSetup: () => Promise<void>;
};

const CurrencyContext = createContext<CurrencyState | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [locale, setLocale] = useState<LocaleProfile>(LOCALES[0]);
  const [openScannerAfterSetup, setOpenScannerAfterSetup] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const [code, done] = await Promise.all([getSetting('currency'), getSetting('onboarded')]);
      if (!active) return;
      if (code && isCurrencyCode(code)) {
        setLocale(localeByCode(code));
      }
      setOnboarded(done === '1');
      setReady(true);
    })().catch(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<CurrencyState>(
    () => ({
      ready,
      onboarded,
      locale,
      openScannerAfterSetup,
      completeSetup: async (code, destination) => {
        await setSetting('currency', code);
        await setSetting('onboarded', '1');
        setLocale(localeByCode(code));
        setOpenScannerAfterSetup(destination === 'scanner');
        setOnboarded(true);
      },
      setCurrency: async (code) => {
        await setSetting('currency', code);
        setLocale(localeByCode(code));
      },
      consumeScannerIntent: () => setOpenScannerAfterSetup(false),
      rerunSetup: async () => {
        await setSetting('onboarded', '0');
        setOnboarded(false);
      },
    }),
    [ready, onboarded, locale, openScannerAfterSetup],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyState {
  const value = useContext(CurrencyContext);
  if (!value) throw new Error('useCurrency must be used inside CurrencyProvider');
  return value;
}
