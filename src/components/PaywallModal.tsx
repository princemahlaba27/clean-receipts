import { useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PRIVACY_URL, TERMS_URL } from '../config';
import { useBilling } from '../services/purchases';
import { colors } from '../theme/tokens';

const STEPS = [
  { icon: '✓', title: 'Set up Tax Receipts', body: 'You configured your local currency & tax categories', done: true },
  { icon: '🔓', title: 'Today: Get Full Access', body: 'Unlimited receipt scans, PDF audit reports & Excel/CSV exports', done: false },
  { icon: '🔔', title: 'Day 2: Trial Reminder', body: 'Reminder before your trial ends. Zero surprises.', done: false },
  { icon: '⭐', title: 'Day 3: Trial Ends', body: 'Cancel anytime in 1 tap in iPhone Settings.', done: false },
];

export function PaywallModal() {
  const billing = useBilling();
  const [annual, setAnnual] = useState(true);
  if (!billing.paywallVisible) return null;
  return (
    <Modal animationType="slide" visible onRequestClose={billing.closePaywall}>
      <SafeAreaView style={styles.screen}>
          <View style={styles.top}>
            <Pressable accessibilityLabel="Close" onPress={billing.closePaywall}><Text style={styles.close}>✕</Text></Pressable>
            <Pressable onPress={() => { void billing.restore(); }}><Text style={styles.restore}>Restore</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>How your free trial works</Text>
            {STEPS.map((step) => (
              <View key={step.title} style={styles.step}>
                <View style={[styles.icon, step.done && styles.iconDone]}><Text>{step.icon}</Text></View>
                <View style={styles.stepCopy}>
                  <Text style={[styles.stepTitle, step.done && styles.stepDone]}>{step.title}</Text>
                  <Text style={styles.stepBody}>{step.body}</Text>
                </View>
              </View>
            ))}
            <Pressable onPress={() => setAnnual(true)} style={[styles.plan, annual && styles.planOn]}>
              <View style={styles.planRow}>
                <Text style={styles.planTitle}>Annual</Text>
                <Text style={styles.badge}>SAVE 89%</Text>
              </View>
              <Text style={styles.planBody}>3-day free trial, then {billing.annual}/year ($3.33/mo)</Text>
            </Pressable>
            <Pressable onPress={() => setAnnual(false)} style={[styles.plan, !annual && styles.planOn]}>
              <Text style={styles.planTitle}>Weekly</Text>
              <Text style={styles.planBody}>{billing.weeklyIntro} for 7 days, then {billing.weeklyRenewal}/week</Text>
            </Pressable>
            {billing.lastError ? <Text style={styles.error}>{billing.lastError}</Text> : null}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable
              disabled={billing.loading}
              onPress={() => { void (annual ? billing.purchaseAnnual() : billing.purchaseWeekly()); }}
              style={styles.cta}
            >
              <Text style={styles.ctaText}>{billing.loading ? 'Working…' : 'Start My Free Trial'}</Text>
            </Pressable>
            <Text style={styles.legal}>
              <Text onPress={() => { void billing.restore(); }}>Restore Purchases</Text>
              {'  •  '}
              <Text onPress={() => { void Linking.openURL(TERMS_URL); }}>Terms of Use (EULA)</Text>
              {'  •  '}
              <Text onPress={() => { void Linking.openURL(PRIVACY_URL); }}>Privacy Policy</Text>
            </Text>
          </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgCanvas, justifyContent: 'space-between' },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 12 },
  footer: { paddingHorizontal: 20, paddingBottom: 12 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8 },
  close: { fontSize: 20, color: colors.textPrimary, fontWeight: '700' },
  restore: { color: colors.accentBlue, fontWeight: '700' },
  title: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, marginBottom: 18 },
  step: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgSubtle, alignItems: 'center', justifyContent: 'center' },
  iconDone: { backgroundColor: colors.accentEmeraldBg },
  stepCopy: { flex: 1 },
  stepTitle: { fontWeight: '800', color: colors.textPrimary, fontSize: 16 },
  stepDone: { color: colors.accentEmerald, textDecorationLine: 'line-through' },
  stepBody: { color: colors.textSecondary, marginTop: 2 },
  plan: { backgroundColor: colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: colors.borderLight, padding: 14, marginBottom: 10 },
  planOn: { borderWidth: 2, borderColor: colors.btnPrimaryBg },
  planRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planTitle: { fontWeight: '800', color: colors.textPrimary, fontSize: 16 },
  planBody: { color: colors.textSecondary, marginTop: 4 },
  badge: { backgroundColor: colors.accentEmeraldBg, color: colors.accentEmerald, overflow: 'hidden', fontWeight: '800', fontSize: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  error: { color: colors.destructive, marginBottom: 8 },
  cta: { height: 58, borderRadius: 999, backgroundColor: colors.btnPrimaryBg, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  ctaText: { color: '#FFFFFF', fontWeight: '800', fontSize: 17 },
  legal: { textAlign: 'center', color: colors.textSecondary, marginTop: 14, marginBottom: 12, lineHeight: 20 },
});
