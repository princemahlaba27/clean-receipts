import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatMoney } from '../format';
import { LOCALES, type CurrencyCode, type LocaleProfile } from '../services/currency';
import { useCurrency } from '../services/CurrencyContext';
import { colors } from '../theme/tokens';

const GOALS = [
  { id: 'budget', emoji: '📊', title: 'Budgeting', body: 'Insights into spending and budgets', tint: '#E8F8EF' },
  { id: 'reports', emoji: '📝', title: 'Expense Reports', body: 'Professional PDF reports and reimbursements', tint: '#FFF6E8' },
  { id: 'tax', emoji: '💸', title: 'Tax Deductions', body: 'Maximize tax savings and deductions', tint: '#EAF8F1' },
];

const STORAGE = [
  { id: 'folder', emoji: '📁', title: 'Physical Folder', body: 'Paper receipts in a folder, drawer, or shoebox' },
  { id: 'camera', emoji: '📸', title: 'Camera Roll', body: "Photos saved in my phone's gallery" },
  { id: 'cloud', emoji: '☁️', title: 'Cloud Storage', body: 'Google Drive, Dropbox, or similar' },
  { id: 'email', emoji: '✉️', title: 'Email', body: 'Sitting in my inbox' },
  { id: 'app', emoji: '📱', title: 'Another App', body: 'Scattered across other apps' },
  { id: 'none', emoji: '🤷', title: "I Don't Keep Them", body: "I usually don't save my receipts" },
];

const INDUSTRIES = [
  { id: 'trades', emoji: '🛠️', title: 'Construction / Trades' },
  { id: 'creator', emoji: '💻', title: 'Freelancer / Creator' },
  { id: 'rideshare', emoji: '🚗', title: 'Rideshare & Delivery' },
  { id: 'business', emoji: '🏢', title: 'Small Business / Consultant' },
];

const WRITE_OFFS = [
  { emoji: '🚀', title: 'Shipping, Freight & Delivery', tint: '#F3E8FF' },
  { emoji: '🖥️', title: 'Software Subscriptions', tint: '#EDE9FE' },
  { emoji: '📎', title: 'Supplies & Materials', tint: '#FCE7F3' },
  { emoji: '🛠️', title: 'Tools & Equipment', tint: '#F3E8FF' },
  { emoji: '⚡', title: 'Utilities', tint: '#FEF3C7' },
  { emoji: '📢', title: 'Advertising', tint: '#FEE2E2' },
  { emoji: '🍽️', title: 'Business Meals', tint: '#FEF3C7' },
  { emoji: '✈️', title: 'Business Travel', tint: '#E0F2FE' },
  { emoji: '💵', title: 'Commissions & Fees', tint: '#ECFDF5' },
];

export function OnboardingScreen() {
  const currency = useCurrency();
  const [step, setStep] = useState(0);
  const [country, setCountry] = useState<CurrencyCode | null>(null);
  const [goals, setGoals] = useState<string[]>([]);
  const [storage, setStorage] = useState<string[]>([]);
  const [industry, setIndustry] = useState<string | null>(null);
  const [found, setFound] = useState(5);
  const locale = LOCALES.find((item) => item.code === country) ?? LOCALES[0];
  const industryTitle = INDUSTRIES.find((item) => item.id === industry)?.title ?? 'your work';

  useEffect(() => {
    if (step !== 4) return;
    setFound(5);
    const timer = setInterval(() => {
      setFound((value) => (value >= 22 ? 22 : value + 1));
    }, 90);
    return () => clearInterval(timer);
  }, [step]);

  function toggle(list: string[], id: string, setList: (next: string[]) => void) {
    setList(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }

  const canContinue =
    (step === 0 && country != null) ||
    (step === 1 && goals.length > 0) ||
    (step === 2 && storage.length > 0) ||
    (step === 3 && industry != null) ||
    step === 4;

  async function finish(destination: 'vault' | 'scanner') {
    await currency.completeSetup(country ?? 'ZAR', destination);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.progress}>
        {Array.from({ length: 6 }, (_, index) => (
          <View key={index} style={[styles.segment, index <= step && styles.segmentOn]} />
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {step === 0 ? (
          <Step
            title="Where do you file your taxes?"
            subtitle="We'll lock your exact currency and local tax/VAT rules."
          >
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
          <Step title="What are your main goals we can help with?" subtitle="Select all that apply">
            {GOALS.map((item) => (
              <Choice
                key={item.id}
                emoji={item.emoji}
                tint={item.tint}
                title={item.title}
                body={item.body}
                selected={goals.includes(item.id)}
                onPress={() => toggle(goals, item.id, setGoals)}
              />
            ))}
          </Step>
        ) : null}
        {step === 2 ? (
          <Step title="Where do your receipts live right now?" subtitle="Select all that apply">
            {STORAGE.map((item) => (
              <Choice
                key={item.id}
                emoji={item.emoji}
                title={item.title}
                body={item.body}
                selected={storage.includes(item.id)}
                onPress={() => toggle(storage, item.id, setStorage)}
              />
            ))}
          </Step>
        ) : null}
        {step === 3 ? (
          <Step title="What kind of work do you do?" subtitle="We'll match write-off categories to your industry.">
            {INDUSTRIES.map((item) => (
              <Choice
                key={item.id}
                emoji={item.emoji}
                title={item.title}
                selected={industry === item.id}
                onPress={() => setIndustry(item.id)}
              />
            ))}
          </Step>
        ) : null}
        {step === 4 ? <Analysis found={found} industry={industryTitle} /> : null}
        {step === 5 ? <ReportPreview locale={locale} /> : null}
      </ScrollView>
      <View style={styles.footer}>
        {step < 5 ? (
          <Pressable
            accessibilityRole="button"
            disabled={!canContinue}
            onPress={() => setStep((value) => value + 1)}
            style={[styles.cta, !canContinue && styles.ctaOff]}
          >
            <Text style={[styles.ctaText, !canContinue && styles.ctaTextOff]}>
              {(step === 1 || step === 2) && !canContinue ? 'Select all that apply' : 'Continue'}
            </Text>
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
  tint,
  onPress,
}: {
  emoji: string;
  title: string;
  body?: string;
  selected: boolean;
  tint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.choice, selected && styles.choiceOn]}>
      <View style={[styles.emojiBox, { backgroundColor: tint ?? colors.bgSubtle }]}>
        <Text style={styles.emoji}>{emoji}</Text>
      </View>
      <View style={styles.choiceCopy}>
        <Text style={styles.choiceTitle}>{title}</Text>
        {body ? <Text style={styles.choiceBody}>{body}</Text> : null}
      </View>
    </Pressable>
  );
}

function Analysis({ found, industry }: { found: number; industry: string }) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1.08, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [pulse]);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  return (
    <View>
      <Animated.View style={[styles.ring, ring]} />
      <Text style={styles.kicker}>AI ANALYSIS</Text>
      <Text style={styles.title}>Analyzing deductions for <Text style={styles.blue}>{industry}</Text> in your location</Text>
      <View style={styles.foundRow}>
        <Text style={styles.section}>WRITE OFF CATEGORIES</Text>
        <View style={styles.foundPill}><Text style={styles.foundText}>{found} FOUND</Text></View>
      </View>
      {found >= 22 ? <Text style={styles.processed}>🛡️ Processed deduction codes</Text> : null}
      {WRITE_OFFS.map((item) => (
        <View key={item.title} style={styles.writeOff}>
          <View style={[styles.emojiBox, { backgroundColor: item.tint }]}><Text style={styles.emoji}>{item.emoji}</Text></View>
          <Text style={styles.choiceTitle}>{item.title}</Text>
        </View>
      ))}
    </View>
  );
}

function ReportPreview({ locale }: { locale: LocaleProfile }) {
  return (
    <View>
      <Text style={styles.title}>It's really that easy to make a shareable expense report!</Text>
      <View style={styles.report}>
        <Text style={styles.reportTitle}>Expense Report</Text>
        <Text style={styles.reportMeta}>Astron Energy · Supplies & Materials · {locale.code}</Text>
        <View style={styles.reportRow}>
          <Text style={styles.choiceBody}>Subtotal</Text>
          <Text style={styles.choiceTitle}>{formatMoney(120.74, locale)}</Text>
        </View>
        <View style={styles.reportRow}>
          <Text style={styles.choiceBody}>{locale.taxName}</Text>
          <Text style={styles.choiceTitle}>{formatMoney(21.32, locale)}</Text>
        </View>
        <View style={styles.reportRow}>
          <Text style={styles.choiceTitle}>Total</Text>
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
  content: { padding: 20, paddingBottom: 24 },
  title: { fontSize: 30, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.6 },
  subtitle: { marginTop: 8, fontSize: 16, color: colors.textSecondary },
  blue: { color: colors.accentBlue },
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
  emojiBox: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
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
  ring: {
    alignSelf: 'center',
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 10,
    borderColor: '#D0D5DD',
    marginBottom: 16,
  },
  kicker: { textAlign: 'center', letterSpacing: 1.4, color: colors.textSecondary, fontWeight: '700', fontSize: 12 },
  foundRow: { marginTop: 22, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { fontSize: 13, fontWeight: '800', letterSpacing: 0.6, color: colors.textPrimary },
  foundPill: { backgroundColor: colors.accentBlueBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  foundText: { color: colors.accentBlue, fontWeight: '800', fontSize: 12 },
  processed: { color: colors.accentEmerald, fontWeight: '700', marginBottom: 10 },
  writeOff: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 12,
    marginBottom: 10,
  },
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
  reportRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reportTotal: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
});
