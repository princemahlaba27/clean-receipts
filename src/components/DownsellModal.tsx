import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useBilling, visibleBillingError } from '../services/purchases';
import { colors } from '../theme/tokens';

export function DownsellModal() {
  const billing = useBilling();
  return (
    <Modal animationType="fade" transparent visible={billing.downsellVisible} onRequestClose={billing.closeDownsell}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.kicker}>One-time offer</Text>
          <Text style={styles.title}>{billing.downsellIntro} for your first month</Text>
          <Text style={styles.body}>Then {billing.downsellRenewal}/month. Keep unlimited scans, PDF reports, and CSV exports.</Text>
          {visibleBillingError(billing.lastError) ? <Text style={styles.error}>{visibleBillingError(billing.lastError)}</Text> : null}
          <Pressable disabled={billing.loading} onPress={() => { void billing.purchaseMonthly(); }} style={styles.cta}>
            <Text style={styles.ctaText}>{billing.loading ? 'Working…' : `Start for ${billing.downsellIntro}`}</Text>
          </Pressable>
          <Pressable onPress={billing.closeDownsell}>
            <Text style={styles.later}>No thanks</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(16,24,40,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', backgroundColor: colors.bgCard, borderRadius: 28, padding: 24, borderWidth: 1, borderColor: colors.borderLight },
  kicker: { color: colors.accentEmerald, fontWeight: '800', letterSpacing: 0.4 },
  title: { marginTop: 8, fontSize: 28, fontWeight: '800', color: colors.textPrimary },
  body: { marginTop: 8, color: colors.textSecondary, fontSize: 16, lineHeight: 22 },
  error: { color: colors.destructive, marginTop: 8 },
  cta: { marginTop: 18, height: 56, borderRadius: 999, backgroundColor: colors.btnPrimaryBg, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#FFFFFF', fontWeight: '800', fontSize: 17 },
  later: { textAlign: 'center', marginTop: 14, color: colors.textSecondary, fontWeight: '700' },
});
