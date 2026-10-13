import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ESTIMATED_TAX_RATE, FREE_RECEIPT_LIMIT } from '../config';
import { countReceipts, listReceipts } from '../db/vault';
import { exportDossier } from '../services/exportService';
import { useBilling } from '../services/purchases';
import { loadSampleDraft } from '../services/sampleReceipt';
import { currentQuarter, formatIsoDate, formatMoney, monthTitle, quarterOf, yearOf } from '../format';
import { colors, fonts } from '../theme/tokens';
import { GlassCard, YellowButton } from '../theme/ui';
import type { RootStackParamList, StoredReceipt } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Vault'>;
const QUARTERS = [1, 2, 3, 4] as const;

export function VaultScreen() {
  const navigation = useNavigation<Nav>();
  const billing = useBilling();
  const [receipts, setReceipts] = useState<StoredReceipt[]>([]);
  const [quarter, setQuarter] = useState<(typeof QUARTERS)[number]>(currentQuarter());
  const [year, setYear] = useState(new Date().getFullYear());
  const [yearOpen, setYearOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const indicator = useSharedValue(quarter - 1);

  const reload = useCallback(() => {
    listReceipts().then(setReceipts).catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : 'The vault could not be opened.');
    });
  }, []);

  useFocusEffect(useCallback(() => {
    reload();
  }, [reload]));

  const filtered = useMemo(
    () => receipts.filter((receipt) => yearOf(receipt.date) === year && quarterOf(receipt.date) === quarter),
    [quarter, receipts, year],
  );
  const total = filtered.reduce((sum, receipt) => sum + receipt.total, 0);
  const savings = total * ESTIMATED_TAX_RATE;
  const years = useMemo(() => {
    const found = new Set(receipts.map((receipt) => yearOf(receipt.date)));
    found.add(new Date().getFullYear());
    found.add(year);
    return [...found].filter((value) => Number.isFinite(value)).sort((a, b) => b - a);
  }, [receipts, year]);
  const sections = useMemo(() => groupByMonth(filtered), [filtered]);

  function selectQuarter(next: (typeof QUARTERS)[number]) {
    setQuarter(next);
    indicator.value = withTiming(next - 1, { duration: 180 });
  }

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${indicator.value * 100}%` }],
  }));

  async function runExport() {
    if (!filtered.length) {
      setError(`No receipts in ${year} Q${quarter} to export.`);
      return;
    }
    setExporting(true);
    setError(null);
    try {
      await exportDossier(filtered, `${year} Q${quarter}`);
    } catch (exportError: unknown) {
      setError(exportError instanceof Error ? exportError.message : 'The dossier could not be created.');
    } finally {
      setExporting(false);
    }
  }

  function beginExport() {
    if (billing.isPro) {
      void runExport();
      return;
    }
    billing.requestAccess(() => { void runExport(); });
  }

  async function beginScan() {
    const count = await countReceipts();
    if (count >= FREE_RECEIPT_LIMIT && !billing.isPro) {
      billing.requestAccess(() => navigation.navigate('Scanner'));
      return;
    }
    navigation.navigate('Scanner');
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <GlassCard style={styles.hero}>
          <Text style={styles.kicker}>{year} Q{quarter} deductible</Text>
          <Text style={styles.total}>{formatMoney(total)}</Text>
          <Text style={styles.savings}>+{formatMoney(savings)} Est. Tax Savings (24%)</Text>
          <Text style={styles.note}>This is an estimate, not tax advice.</Text>
          <View style={styles.actions}>
            <Action label="Quick Scan" onPress={() => { void beginScan(); }} />
            <Action label="Import Sample" onPress={() => { void loadSampleDraft().then((draft) => navigation.navigate('ReceiptDetail', { draft })); }} />
            <Action label="Filter" onPress={() => setYearOpen(true)} />
          </View>
        </GlassCard>

        <View style={styles.segment} onLayout={() => { indicator.value = quarter - 1; }}>
          <Animated.View style={[styles.indicator, indicatorStyle]} />
          {QUARTERS.map((item) => (
            <Pressable key={item} onPress={() => selectQuarter(item)} style={styles.segmentItem}>
              <Text style={[styles.segmentLabel, quarter === item && styles.segmentLabelOn]}>Q{item}</Text>
            </Pressable>
          ))}
        </View>

        {sections.map((section) => (
          <View key={section.title}>
            <Text style={styles.month}>{section.title}</Text>
            {section.receipts.map((receipt) => (
              <GlassCard key={receipt.id} style={styles.row}>
                <View style={styles.badge}><Text style={styles.badgeText}>{badge(receipt.merchant)}</Text></View>
                <View style={styles.rowCopy}>
                  <Text style={styles.merchant} numberOfLines={1}>{receipt.merchant}</Text>
                  <Text style={styles.meta} numberOfLines={1}>{formatIsoDate(receipt.date)} · {receipt.category}</Text>
                </View>
                <Text style={styles.amount}>{formatMoney(receipt.total)}</Text>
              </GlassCard>
            ))}
          </View>
        ))}
        {!filtered.length ? <Text style={styles.empty}>No receipts in this quarter.</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <View style={styles.footer}>
        <YellowButton
          disabled={exporting}
          label={exporting ? 'Preparing dossier…' : 'Export Tax Dossier'}
          onPress={beginExport}
        />
      </View>
      <Modal transparent visible={yearOpen} animationType="fade" onRequestClose={() => setYearOpen(false)}>
        <Pressable style={styles.dim} onPress={() => setYearOpen(false)}>
          <GlassCard style={styles.yearSheet}>
            <Text style={styles.yearTitle}>Year</Text>
            {years.map((item) => (
              <Pressable key={item} onPress={() => { setYear(item); setYearOpen(false); }} style={styles.yearRow}>
                <Text style={[styles.yearText, item === year && styles.yearOn]}>{item}</Text>
              </Pressable>
            ))}
          </GlassCard>
        </Pressable>
      </Modal>
    </View>
  );
}

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} style={styles.action}>
      <View style={styles.actionCircle}><Text style={styles.actionMark}>{label.slice(0, 1)}</Text></View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

function groupByMonth(receipts: StoredReceipt[]) {
  const groups = new Map<string, StoredReceipt[]>();
  for (const receipt of receipts) {
    const title = monthTitle(receipt.date);
    const bucket = groups.get(title) ?? [];
    bucket.push(receipt);
    groups.set(title, bucket);
  }
  return [...groups.entries()].map(([title, items]) => ({ title, receipts: items }));
}

function badge(merchant: string): string {
  const letter = [...merchant].find((char) => /\p{L}/u.test(char));
  return (letter ?? '?').toUpperCase();
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.obsidian, flex: 1 },
  content: { padding: 20, paddingBottom: 24 },
  hero: { padding: 18 },
  kicker: { color: colors.slate, fontWeight: '600' },
  total: { color: colors.yellow, fontSize: 42, marginTop: 4, ...fonts.currency },
  savings: { color: colors.emerald, fontWeight: '700', marginTop: 8 },
  note: { color: colors.slate, fontSize: 12, marginTop: 4 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  action: { alignItems: 'center', width: 92 },
  actionCircle: {
    alignItems: 'center',
    backgroundColor: colors.obsidian,
    borderColor: colors.hairline,
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  actionMark: { color: colors.yellow, fontWeight: '800' },
  actionLabel: { color: colors.slate, fontSize: 11, marginTop: 6, textAlign: 'center' },
  segment: {
    backgroundColor: colors.glass,
    borderColor: colors.hairline,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    marginVertical: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  indicator: {
    backgroundColor: colors.yellow,
    borderRadius: 10,
    bottom: 3,
    left: 3,
    position: 'absolute',
    top: 3,
    width: '25%',
  },
  segmentItem: { alignItems: 'center', flex: 1, paddingVertical: 10 },
  segmentLabel: { color: colors.white, fontWeight: '700' },
  segmentLabelOn: { color: colors.black },
  month: { color: colors.white, fontWeight: '700', marginBottom: 8, marginTop: 8 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12, marginBottom: 10, padding: 14 },
  badge: { alignItems: 'center', backgroundColor: colors.yellow, borderRadius: 12, height: 44, justifyContent: 'center', width: 44 },
  badgeText: { color: colors.black, fontWeight: '800' },
  rowCopy: { flex: 1 },
  merchant: { color: colors.white, fontSize: 17, fontWeight: '700' },
  meta: { color: colors.slate, fontSize: 12, marginTop: 4 },
  amount: { color: colors.white, fontWeight: '700', ...fonts.currency },
  empty: { color: colors.slate, marginTop: 12 },
  error: { color: colors.danger, marginTop: 12 },
  footer: { padding: 20, paddingBottom: 28 },
  dim: { backgroundColor: 'rgba(0,0,0,0.45)', flex: 1, justifyContent: 'flex-end' },
  yearSheet: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 20 },
  yearTitle: { color: colors.white, fontSize: 17, fontWeight: '700', marginBottom: 8 },
  yearRow: { paddingVertical: 12 },
  yearText: { color: colors.white, fontSize: 17 },
  yearOn: { color: colors.yellow },
});
