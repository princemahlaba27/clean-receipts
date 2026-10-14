import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getLocales } from 'expo-localization';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatMoney } from '../format';
import { currencyForRegion, LOCALES, type CurrencyCode, type LocaleProfile } from '../services/currency';
import { useCurrency } from '../services/CurrencyContext';
import { colors } from '../theme/tokens';

const LOSS_OPTIONS = [
  { id: 'mid', emoji: '💸', title: '$500 – $1,500 / R10,000+' },
  { id: 'over', emoji: '📉', title: '$1,500 – $5,000+ / R30,000+' },
  { id: 'unknown', emoji: '😰', title: 'I have no clue, I scramble at tax deadline' },
];

const FRUSTRATION_OPTIONS = [
  { id: 'audit', emoji: '🛡️', title: 'Fear of IRS / SARS Audit Penalties' },
  { id: 'proofs', emoji: '📄', title: 'Bank statements lack itemized receipt proofs' },
  { id: 'manual', emoji: '⏳', title: 'Wasting hours manually building spreadsheets' },
];

export function OnboardingScreen() {
  const currency = useCurrency();
  const [step, setStep] = useState(0);
  const [country, setCountry] = useState<CurrencyCode>(() => currencyForRegion(getLocales()[0]?.regionCode));
  const [loss, setLoss] = useState<string | null>(null);
  const [frustration, setFrustration] = useState<string | null>(null);
  const locale = LOCALES.find((item) => item.code === country) ?? LOCALES[0];

  const canContinue = step === 0 || (step === 1 && loss != null) || (step === 2 && frustration != null);

  async function finish(destination: 'vault' | 'scanner') {
    await currency.completeSetup(country, destination);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.progress}>
        {Array.from({ length: 4 }, (_, index) => (
          <View key={index} style={[styles.segment, index <= step && styles.segmentOn]} />
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {step === 0 ? (
          <Step title="Currency and tax rules" subtitle="Matched to your region. One tap switches it.">
            {LOCALES.map((item) => (
              <Choice
                key={item.code}
                emoji={item.flag}
                title={item.country}
                body={item.subtitle}
                selected={country === item.code}
                onPress={() => setCountry(item.code)}
              />
            ))}
          </Step>
        ) : null}
        {step === 1 ? (
          <Step
            title="How much money in tax deductions do you lose every year to lost receipts?"
            subtitle="Choose one"
          >
            {LOSS_OPTIONS.map((item) => (
              <Choice
                key={item.id}
                emoji={item.emoji}
                title={item.title}
                body={item.body}
                selected={loss === item.id}
                onPress={() => setLoss(item.id)}
              />
            ))}
          </Step>
        ) : null}
        {step === 2 ? (
          <Step title="What is your biggest tax filing frustration?" subtitle="Choose one">
            {FRUSTRATION_OPTIONS.map((item) => (
              <Choice
                key={item.id}
                emoji={item.emoji}
                title={item.title}
                body={item.body}
                selected={frustration === item.id}
                onPress={() => setFrustration(item.id)}
              />
            ))}
          </Step>
        ) : null}
        {step === 3 ? <BankPreview locale={locale} /> : null}
      </ScrollView>
      <View style={styles.footer}>
        {step < 3 ? (
          <Pressable
            accessibilityRole="button"
            disabled={!canContinue}
            onPress={() => setStep((value) => value + 1)}
            style={[styles.cta, !canContinue && styles.ctaOff]}
          >
            <Text style={[styles.ctaText, !canContinue && styles.ctaTextOff]}>Continue</Text>
          </Pressable>
        ) : (
          <>
            <Pressable accessibilityRole="button" onPress={() => { void finish('scanner'); }} style={styles.cta}>
              <Text style={styles.ctaText}>Scan Your First Receipt</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => { void finish('vault'); }}>
              <Text style={styles.skip}>Skip to Tax Vault</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function Step({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.list}>{children}</View>
    </View>
  );
}

function Choice({
  emoji,
  title,
  body,
  selected,
  onPress,
}: {
  emoji: string;
  title: string;
  body?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.choice, selected && styles.choiceOn]}>
      <View style={styles.emojiBox}>
        <Text style={styles.emoji}>{emoji}</Text>
      </View>
      <View style={styles.choiceCopy}>
        <Text style={styles.choiceTitle}>{title}</Text>
        {body ? <Text style={styles.choiceBody}>{body}</Text> : null}
      </View>
    </Pressable>
  );
}

function BankPreview({ locale }: { locale: LocaleProfile }) {
  return (
    <View>
      <Text style={styles.title}>It's really that easy to match a bank statement.</Text>
      <Text style={styles.subtitle}>The charge below uses your selected currency.</Text>
      <View style={styles.report}>
        <Text style={styles.kicker}>BANK STATEMENT</Text>
        <Text style={styles.reportTitle}>{locale.country}</Text>
        <Text style={styles.reportMeta}>{locale.code} · {locale.taxName}</Text>
        <View style={styles.reportRow}>
          <View style={styles.choiceCopy}>
            <Text style={styles.choiceTitle}>Card debit</Text>
            <Text style={styles.choiceBody}>Receipt on file</Text>
          </View>
          <Text style={styles.reportTotal}>{formatMoney(142.06, locale)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgCanvas },
  progress: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingTop: 8 },
  segment: { flex: 1, height: 4, borderRadius: 99, backgroundColor: colors.borderLight },
  segmentOn: { backgroundColor: colors.btnPrimaryBg },
  content: { flexGrow: 1, padding: 20, paddingBottom: 24 },
  title: { fontSize: 30, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.6 },
  subtitle: { marginTop: 8, fontSize: 16, color: colors.textSecondary },
  list: { marginTop: 18, gap: 10 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 14,
  },
  choiceOn: { borderWidth: 2, borderColor: colors.btnPrimaryBg },
  emojiBox: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.bgSubtle, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 24 },
  choiceCopy: { flex: 1 },
  choiceTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  choiceBody: { marginTop: 2, fontSize: 13, color: colors.textSecondary },
  footer: { paddingHorizontal: 20, paddingBottom: 12, gap: 12 },
  cta: { height: 56, borderRadius: 999, backgroundColor: colors.btnPrimaryBg, alignItems: 'center', justifyContent: 'center' },
  ctaOff: { backgroundColor: '#98A2B3' },
  ctaText: { color: colors.btnPrimaryText, fontSize: 17, fontWeight: '700' },
  ctaTextOff: { color: '#FFFFFF' },
  skip: { textAlign: 'center', color: colors.accentBlue, fontSize: 16, fontWeight: '700', paddingVertical: 4 },
  kicker: { letterSpacing: 1.4, color: colors.textSecondary, fontWeight: '700', fontSize: 12 },
  report: {
    marginTop: 18,
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 18,
    gap: 10,
  },
  reportTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  reportMeta: { color: colors.textSecondary, marginBottom: 6 },
  reportRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  reportTotal: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
});
