import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ESTIMATED_TAX_RATE, FREE_RECEIPT_LIMIT } from '../config';
import { countReceipts, listReceipts } from '../db/vault';
import { formatIsoDate, formatMoney, quarterOf, yearOf } from '../format';
import { CATEGORY_EMOJI } from '../services/receiptParser';
import { exportDossier } from '../services/exportService';
import { useBilling } from '../services/purchases';
import { LOCALES } from '../services/currency';
import { useCurrency } from '../services/CurrencyContext';
import { cardShadow, colors } from '../theme/tokens';
import type { RootStackParamList, StoredReceipt } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Vault'>;
type Quarter = 'all' | 1 | 2 | 3 | 4;

export function VaultScreen() {
  const navigation = useNavigation<Nav>();
  const billing = useBilling();
  const currency = useCurrency();
  const [receipts, setReceipts] = useState<StoredReceipt[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [quarter, setQuarter] = useState<Quarter>('all');
  const [sheet, setSheet] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setReceipts(await listReceipts());
  }, []);

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  useEffect(() => {
    if (!currency.openScannerAfterSetup) return;
    currency.consumeScannerIntent();
    navigation.navigate('Scanner');
  }, [currency, navigation]);

  const filtered = receipts.filter((receipt) => {
    if (yearOf(receipt.date) !== year) return false;
    return quarter === 'all' || quarterOf(receipt.date) === quarter;
  });
  const balance = filtered.reduce((sum, receipt) => sum + (receipt.deductible ? receipt.total : 0), 0);
  const savings = balance * ESTIMATED_TAX_RATE;
  const period = quarter === 'all' ? String(year) : `${year} Q${quarter}`;

  async function runExport(kind: 'pdf' | 'csv') {
    try {
      await exportDossier(filtered, period, currency.locale, kind);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'The report could not be exported.');
    }
  }

  function beginExport(kind: 'pdf' | 'csv') {
    if (!billing.isPro) {
      billing.requestAccess(() => { void runExport(kind); });
      return;
    }
    void runExport(kind);
  }

  async function beginScan() {
    const count = await countReceipts();
    if (count >= FREE_RECEIPT_LIMIT && !billing.isProNow()) {
      billing.requestAccess(() => navigation.navigate('Scanner'));
      return;
    }
    navigation.navigate('Scanner');
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.hello}>Tax Vault 👋</Text>
            <Text style={styles.ready}>Ready to organize your deductions?</Text>
          </View>
          <Pressable onPress={() => setSheet(true)} style={styles.currencyPill}>
            <Text style={styles.currencyText}>{currency.locale.flag} {currency.locale.code} • {year} ▾</Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Current Deductible Balance</Text>
          <Text style={styles.heroAmount}>{formatMoney(balance, currency.locale)}</Text>
          <View style={styles.savings}>
            <Text style={styles.savingsText}>📈 +{formatMoney(savings, currency.locale)} Est. Tax Savings</Text>
          </View>
          <Pressable onPress={() => { void beginScan(); }} style={styles.scanPill}>
            <Text style={styles.scanPillText}>Scan Receipt</Text>
          </Pressable>
          <View style={styles.exportRow}>
            <Pressable onPress={() => beginExport('pdf')} style={styles.exportPill}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.exportText}>Export PDF Statement</Text>
            </Pressable>
            <Pressable onPress={() => beginExport('csv')} style={styles.exportPill}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.exportText}>Export CSV</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.segments}>
          {(['all', 1, 2, 3, 4] as const).map((item) => {
            const active = quarter === item;
            return (
              <Pressable key={String(item)} onPress={() => setQuarter(item)} style={[styles.segment, active && styles.segmentOn]}>
                <Text style={[styles.segmentText, active && styles.segmentTextOn]}>{item === 'all' ? 'All' : `Q${item}`}</Text>
              </Pressable>
            );
          })}
        </View>

        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="book-outline" size={36} color="#111111" />
              </View>
              <Text style={styles.emptyTitle}>Your Vault is Empty</Text>
              <Pressable onPress={() => { void beginScan(); }} style={styles.emptyButton}>
                <Text style={styles.emptyButtonText}>Scan Your First Receipt</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.list}>
            <View style={styles.sectionRow}>
              <Text style={styles.section}>🧾 Recent Receipts</Text>
              <Pressable onPress={() => beginExport('pdf')}><Text style={styles.link}>Export Report</Text></Pressable>
            </View>
            {message ? <Text style={styles.message}>{message}</Text> : null}
            {filtered.map((receipt) => (
              <View key={receipt.id} style={styles.row}>
                <View style={styles.rowEmoji}><Text style={styles.rowEmojiText}>{CATEGORY_EMOJI[receipt.category]}</Text></View>
                <View style={styles.rowCopy}>
                  <Text style={styles.merchant}>{receipt.merchant}</Text>
                  <Text style={styles.meta}>{formatIsoDate(receipt.date)} · {receipt.category}</Text>
                </View>
                <Text style={styles.amount}>{formatMoney(receipt.total, currency.locale)}</Text>
              </View>
            ))}
          </View>
        )}
        {filtered.length === 0 && message ? <Text style={styles.message}>{message}</Text> : null}
      </ScrollView>
      <Modal animationType="slide" transparent visible={sheet} onRequestClose={() => setSheet(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSheet(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>Currency & tax year</Text>
            {LOCALES.map((item) => (
              <Pressable key={item.code} onPress={() => { void currency.setCurrency(item.code); }} style={styles.sheetRow}>
                <Text style={styles.sheetRowText}>{item.flag} {item.country} ({item.code})</Text>
                {currency.locale.code === item.code ? <Text>✓</Text> : null}
              </Pressable>
            ))}
            <View style={styles.yearRow}>
              {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map((value) => (
                <Pressable key={value} onPress={() => setYear(value)} style={[styles.yearChip, year === value && styles.yearChipOn]}>
                  <Text style={[styles.yearChipText, year === value && styles.yearChipTextOn]}>{value}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => { setSheet(false); void currency.rerunSetup(); }} style={styles.rerun}>
              <Text style={styles.link}>Re-run Setup / Currency</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgCanvas },
  content: { flexGrow: 1, padding: 20, paddingBottom: 24 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headerCopy: { flex: 1 },
  hello: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
  ready: { marginTop: 4, fontSize: 14, color: colors.textSecondary },
  currencyPill: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.borderLight, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  currencyText: { color: colors.textPrimary, fontWeight: '700', fontSize: 13 },
  hero: { marginTop: 16, backgroundColor: colors.bgCard, borderRadius: 28, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: colors.borderLight, ...cardShadow },
  heroLabel: { fontSize: 13, color: colors.textSecondary },
  heroAmount: { marginTop: 8, fontSize: 42, fontWeight: '800', color: colors.textPrimary },
  savings: { marginTop: 12, backgroundColor: colors.accentEmeraldBg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  savingsText: { color: colors.accentEmerald, fontWeight: '700' },
  scanPill: { marginTop: 22, height: 54, width: '100%', borderRadius: 999, backgroundColor: '#111111', alignItems: 'center', justifyContent: 'center' },
  scanPillText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  exportRow: { marginTop: 10, width: '100%', flexDirection: 'row', gap: 10 },
  exportPill: { flex: 1, minHeight: 44, borderRadius: 999, backgroundColor: '#F2F4F7', borderWidth: 1, borderColor: '#E4E7EC', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  exportText: { color: colors.textPrimary, fontWeight: '700', fontSize: 13, textAlign: 'center' },
  segments: { marginTop: 24, flexDirection: 'row', backgroundColor: colors.bgSubtle, borderRadius: 999, padding: 4 },
  segment: { flex: 1, borderRadius: 999, paddingVertical: 8, alignItems: 'center' },
  segmentOn: { backgroundColor: colors.btnPrimaryBg },
  segmentText: { color: colors.textSecondary, fontWeight: '700' },
  segmentTextOn: { color: '#FFFFFF' },
  list: { marginTop: 24, gap: 12 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  section: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  link: { color: colors.accentBlue, fontWeight: '700' },
  message: { color: colors.destructive },
  emptyWrap: { marginTop: 24, flexGrow: 1, justifyContent: 'center' },
  empty: { backgroundColor: colors.bgCard, borderRadius: 28, borderWidth: 1, borderColor: colors.borderLight, padding: 28, alignItems: 'center', ...cardShadow },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.bgSubtle, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { marginTop: 12, fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  emptyButton: { marginTop: 16, backgroundColor: '#111111', borderRadius: 999, paddingHorizontal: 18, height: 48, alignItems: 'center', justifyContent: 'center' },
  emptyButtonText: { color: '#FFFFFF', fontWeight: '700' },
  row: { backgroundColor: colors.bgCard, borderRadius: 18, borderWidth: 1, borderColor: colors.borderLight, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowEmoji: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bgSubtle, alignItems: 'center', justifyContent: 'center' },
  rowEmojiText: { fontSize: 20 },
  rowCopy: { flex: 1 },
  merchant: { fontWeight: '700', color: colors.textPrimary, fontSize: 16 },
  meta: { color: colors.textSecondary, marginTop: 2, fontSize: 13 },
  amount: { fontWeight: '800', color: colors.textPrimary },
  backdrop: { flex: 1, backgroundColor: 'rgba(16,24,40,0.35)', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: colors.bgCard, borderRadius: 28, borderWidth: 1, borderColor: colors.borderLight, padding: 20, gap: 8 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 8 },
  sheetRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  sheetRowText: { color: colors.textPrimary, fontSize: 16 },
  yearRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  yearChip: { borderRadius: 999, backgroundColor: colors.bgSubtle, paddingHorizontal: 14, paddingVertical: 8 },
  yearChipOn: { backgroundColor: colors.btnPrimaryBg },
  yearChipText: { color: colors.textPrimary, fontWeight: '700' },
  yearChipTextOn: { color: '#FFFFFF' },
  rerun: { alignItems: 'center', paddingVertical: 14 },
});
