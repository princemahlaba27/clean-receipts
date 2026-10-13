import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PRIVACY_URL, TERMS_URL } from '../config';
import { useBilling } from '../services/purchases';
import { colors, fonts, radius } from '../theme/tokens';
import { GlassCard, YellowButton } from '../theme/ui';

export function DownsellModal() {
  const billing = useBilling();
  return (
    <Modal animationType="slide" visible={billing.downsellVisible} onRequestClose={billing.closeDownsell}>
      <View style={styles.screen}>
        <View style={styles.toolbar}>
          <Pressable accessibilityLabel="Close" onPress={billing.closeDownsell} style={styles.close}>
            <Text style={styles.closeLabel}>✕</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.badge}>MONTH-END OFFER</Text>
          <Text style={styles.title}>Wait! Special Month-End Bookkeeping Offer</Text>
          <Text style={styles.body}>Get your first month of unlimited exports for just {billing.downsellIntro}.</Text>
          <GlassCard style={styles.priceCard}>
            <Text style={styles.kicker}>First month</Text>
            <Text style={styles.price}>{billing.downsellIntro}</Text>
            <Text style={styles.then}>Then {billing.downsellRenewal} per month</Text>
          </GlassCard>
          <YellowButton
            disabled={billing.loading}
            label={billing.loading ? 'Working…' : `Claim 1st Month for ${billing.downsellIntro}`}
            onPress={() => { void billing.purchaseMonthly(); }}
          />
          <Text style={styles.fine}>
            {billing.downsellIntro} for the first month, then {billing.downsellRenewal} per month. Subscription automatically renews until canceled. Cancel anytime in Settings &gt; Apple ID &gt; Subscriptions.
          </Text>
          {billing.lastError ? <Text style={styles.error}>{billing.lastError}</Text> : null}
          <Pressable onPress={billing.closeDownsell}>
            <Text style={styles.pass}>No thanks, I'll pass</Text>
          </Pressable>
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
  title: { color: colors.white, fontSize: 28, fontWeight: '700', marginVertical: 14 },
  body: { color: colors.slate, fontSize: 17, marginBottom: 16 },
  priceCard: { marginBottom: 16, padding: 18 },
  kicker: { color: colors.slate, fontSize: 12, fontWeight: '600' },
  price: { color: colors.yellow, fontSize: 40, ...fonts.currency },
  then: { color: colors.white, marginTop: 4 },
  fine: { color: colors.slate, fontSize: 12, lineHeight: 18, marginTop: 12 },
  error: { color: colors.danger, marginTop: 8 },
  pass: { color: colors.slate, fontWeight: '700', marginTop: 18, textAlign: 'center' },
  restore: { color: colors.yellow, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  links: { flexDirection: 'row', gap: 16, justifyContent: 'center', marginTop: 12 },
  link: { color: colors.slate, fontSize: 13 },
});
