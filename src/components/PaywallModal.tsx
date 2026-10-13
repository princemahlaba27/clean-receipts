import { useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PRIVACY_URL, TERMS_URL } from '../config';
import { useBilling } from '../services/purchases';
import { colors, radius } from '../theme/tokens';
import { YellowButton } from '../theme/ui';

type Plan = 'weekly' | 'annual';

const TIMELINE = [
  { title: 'Today', body: 'Instant access' },
  { title: 'Day 3', body: 'Reminder notification' },
  { title: 'Day 5', body: 'First charge' },
];

export function PaywallModal() {
  const billing = useBilling();
  const [plan, setPlan] = useState<Plan>('weekly');
  const cta = plan === 'weekly'
    ? `Start 7-Day Access for ${billing.weeklyIntro}`
    : 'Start 3-Day Free Trial';
  const disclosure = plan === 'weekly'
    ? `${billing.weeklyIntro} for the first 7 days, then ${billing.weeklyRenewal} per week. Subscription automatically renews until canceled. Cancel anytime in Settings > Apple ID > Subscriptions.`
    : `3-day free trial, then ${billing.annual} per year. Subscription automatically renews until canceled. Cancel anytime in Settings > Apple ID > Subscriptions.`;

  return (
    <Modal animationType="slide" visible={billing.paywallVisible} onRequestClose={billing.closePaywall}>
      <View style={styles.screen}>
        <View style={styles.toolbar}>
          <Pressable accessibilityLabel="Close" onPress={billing.closePaywall} style={styles.close}>
            <Text style={styles.closeLabel}>✕</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.badge}>TAX COMPLIANCE & EXPORT ENGINE</Text>
          <Text style={styles.title}>Export Audit-Ready Reports</Text>
          <Benefit text="Audit-ready PDF ledger with receipt images" />
          <Benefit text="CSV export for spreadsheets" />
          <Benefit text="On-device storage, included in your iPhone backup" />
          <PlanCard
            title="Weekly"
            price={`${billing.weeklyIntro} for 7 days`}
            detail={`then ${billing.weeklyRenewal}/week`}
            selected={plan === 'weekly'}
            onPress={() => setPlan('weekly')}
          />
          <PlanCard
            title="Annual"
            price={`${billing.annual} / year`}
            detail="3-day free trial · Save 89% · $3.33/mo"
            selected={plan === 'annual'}
            onPress={() => setPlan('annual')}
          />
          {plan === 'annual' ? <Timeline /> : null}
          <YellowButton
            disabled={billing.loading}
            label={billing.loading ? 'Working…' : cta}
            onPress={() => { void (plan === 'weekly' ? billing.purchaseWeekly() : billing.purchaseAnnual()); }}
          />
          <Text style={styles.fine}>{disclosure}</Text>
          {billing.lastError ? <Text style={styles.error}>{billing.lastError}</Text> : null}
          <Pressable onPress={() => { void billing.restore(); }}>
            <Text style={styles.restore}>Restore Purchases</Text>
          </Pressable>
          <View style={styles.links}>
            <Text style={styles.link} onPress={() => { void Linking.openURL(TERMS_URL); }}>Terms of Use (EULA)</Text>
            <Text style={styles.link} onPress={() => { void Linking.openURL(PRIVACY_URL); }}>Privacy Policy</Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Timeline() {
  return (
    <View style={styles.timeline}>
      {TIMELINE.map((step, index) => (
        <View key={step.title} style={styles.step}>
          <View style={styles.rail}>
            <View style={styles.dot} />
            {index < TIMELINE.length - 1 ? <View style={styles.line} /> : null}
          </View>
          <View style={styles.stepCopy}>
            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.stepBody}>{step.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function Benefit({ text }: { text: string }) {
  return (
    <View style={styles.benefit}>
      <View style={styles.benefitDot} />
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

function PlanCard({
  title,
  price,
  detail,
  selected,
  onPress,
}: {
  title: string;
  price: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.plan, selected && styles.planSelected]}>
      <View style={styles.planCopy}>
        <Text style={styles.planTitle}>{title}</Text>
        <Text style={styles.planPrice}>{price}</Text>
        <Text style={styles.planDetail}>{detail}</Text>
      </View>
      <Text style={[styles.check, !selected && styles.checkIdle]}>{selected ? '✓' : '○'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.obsidian, flex: 1 },
  toolbar: { alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 56 },
  close: { padding: 8 },
  closeLabel: { color: colors.slate, fontSize: 18, fontWeight: '700' },
  content: { padding: 24, paddingBottom: 48 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.yellow,
    borderRadius: 999,
    color: colors.obsidian,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  title: { color: colors.white, fontSize: 34, fontWeight: '700', marginVertical: 14 },
  benefit: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  benefitDot: { backgroundColor: colors.yellow, borderRadius: 4, height: 8, marginTop: 6, width: 8 },
  benefitText: { color: colors.white, flex: 1, fontSize: 15 },
  plan: {
    backgroundColor: colors.glass,
    borderColor: colors.hairline,
    borderRadius: radius,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 10,
    padding: 16,
  },
  planSelected: { borderColor: colors.yellow, borderWidth: 1.5 },
  planCopy: { flex: 1 },
  planTitle: { color: colors.white, fontSize: 17, fontWeight: '700' },
  planPrice: { color: colors.yellow, fontSize: 15, fontWeight: '600', marginTop: 4 },
  planDetail: { color: colors.slate, fontSize: 12, marginTop: 4 },
  check: { color: colors.yellow, fontSize: 22 },
  checkIdle: { color: colors.slate },
  timeline: { marginVertical: 16 },
  step: { flexDirection: 'row' },
  rail: { alignItems: 'center', width: 20 },
  dot: { backgroundColor: colors.emerald, borderRadius: 5, height: 10, width: 10 },
  line: { backgroundColor: colors.hairline, flex: 1, width: 1 },
  stepCopy: { flex: 1, paddingBottom: 14, paddingLeft: 10 },
  stepTitle: { color: colors.white, fontWeight: '700' },
  stepBody: { color: colors.slate, marginTop: 2 },
  fine: { color: colors.slate, fontSize: 12, lineHeight: 18, marginTop: 12 },
  error: { color: colors.danger, marginTop: 8 },
  restore: { color: colors.yellow, fontWeight: '700', marginTop: 18, textAlign: 'center' },
  links: { flexDirection: 'row', gap: 16, justifyContent: 'center', marginTop: 12 },
  link: { color: colors.slate, fontSize: 13 },
});
