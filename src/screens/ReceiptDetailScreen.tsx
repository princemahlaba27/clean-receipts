import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FREE_RECEIPT_LIMIT } from '../config';
import { countReceipts, insertReceipt } from '../db/vault';
import { formatIsoDate, formatMoney } from '../format';
import { persistImage } from '../services/files';
import { useBilling } from '../services/purchases';
import { createId } from '../services/ids';
import { parseMoney } from '../services/receiptParser';
import { useCurrency } from '../services/CurrencyContext';
import { CATEGORIES, type Category, type LineItem, type RootStackParamList } from '../types';
import { CATEGORY_EMOJI } from '../services/receiptParser';
import { cardShadow, colors } from '../theme/tokens';

type Route = RouteProp<RootStackParamList, 'ReceiptDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList, 'ReceiptDetail'>;

const PILL_CATEGORIES = CATEGORIES.filter((category) => category !== 'Other');

export function ReceiptDetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const billing = useBilling();
  const { locale } = useCurrency();
  const draft = route.params.draft;
  const [merchant, setMerchant] = useState(draft.merchant);
  const [category, setCategory] = useState<Category>(draft.category);
  const [tax, setTax] = useState(draft.tax);
  const [taxText, setTaxText] = useState(draft.tax.toFixed(2));
  const [total, setTotal] = useState(draft.total);
  const [deductible, setDeductible] = useState(draft.deductible);
  const [items, setItems] = useState<LineItem[]>(draft.lineItems);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subtotal = items.reduce((sum, item) => sum + item.amount * (item.qty || 1), 0);

  function applyAmount(value: number) {
    setTotal(value);
  }

  async function save(bypassGate = false) {
    setError(null);
    const count = await countReceipts();
    if (!bypassGate && count >= FREE_RECEIPT_LIMIT && !billing.isPro) {
      billing.requestAccess(() => { void save(true); });
      return;
    }
    setSaving(true);
    try {
      const extension = draft.imageUri.toLowerCase().includes('.png') ? 'png' : 'jpg';
      const imagePath = await persistImage(draft.imageUri, `${createId()}.${extension}`);
      await insertReceipt({
        merchant: merchant.trim() || 'Store Receipt',
        date: draft.date,
        category,
        subtotal,
        tax,
        total,
        reference: draft.reference,
        imagePath,
        deductible,
        lineItems: items,
      });
      navigation.popToTop();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'The receipt could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.nav}>
        <Pressable accessibilityLabel="Back" onPress={() => navigation.goBack()} style={styles.navButton}>
          <Text style={styles.navGlyph}>←</Text>
        </Pressable>
        <Text style={styles.navTitle}>Recognized Items</Text>
        <Pressable accessibilityLabel="Edit items" onPress={() => setEditing((value) => !value)} style={styles.navButton}>
          <Text style={styles.navGlyph}>•••</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.paper}>
          <TextInput value={merchant} onChangeText={setMerchant} style={styles.merchant} textAlign="center" />
          <Text style={styles.scanned}>Scanned on {formatIsoDate(draft.date)} • Ref #{draft.reference || 'INV-204'}</Text>
          <View style={styles.itemsHeader}>
            <Text style={styles.itemsTitle}>🧾 Items</Text>
            <Pressable onPress={() => setEditing((value) => !value)}><Text style={styles.edit}>✏️ Edit Items</Text></Pressable>
          </View>
          {items.map((item, index) => (
            <View key={item.id} style={styles.item}>
              {editing ? (
                <TextInput
                  value={item.label}
                  onChangeText={(label) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, label } : row))}
                  style={styles.itemInput}
                />
              ) : (
                <Text style={styles.itemLabel}>{item.qty || 1}x  {item.label}</Text>
              )}
              <Text style={styles.itemPrice}>{formatMoney(item.amount, locale)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}><Text style={styles.muted}>Subtotal</Text><Text style={styles.muted}>{formatMoney(subtotal, locale)}</Text></View>
          <View style={styles.totalRow}>
            <Text style={styles.muted}>{locale.taxName}</Text>
            <View style={styles.taxField}>
              <Text style={styles.itemPrice}>{locale.symbol}</Text>
              <TextInput
                keyboardType="decimal-pad"
                value={taxText}
                onChangeText={(text) => {
                  setTaxText(text);
                  setTax(parseMoney(text) ?? 0);
                }}
                style={styles.taxInput}
              />
            </View>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatMoney(total, locale)}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {draft.moneyCandidates.map((value) => {
              const selected = value === total;
              return (
                <Pressable key={String(value)} onPress={() => applyAmount(value)} style={[styles.chip, selected && styles.chipOn]}>
                  <Text style={[styles.chipText, selected && styles.chipTextOn]}>{formatMoney(value, locale)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.card}>
          <View style={styles.toggle}>
            <Pressable onPress={() => setDeductible(true)} style={[styles.toggleItem, deductible && styles.toggleOn]}>
              <Text style={[styles.toggleText, deductible && styles.toggleTextOn]}>100% Tax Deductible</Text>
            </Pressable>
            <Pressable onPress={() => setDeductible(false)} style={[styles.toggleItem, !deductible && styles.toggleOn]}>
              <Text style={[styles.toggleText, !deductible && styles.toggleTextOn]}>Personal</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {PILL_CATEGORIES.map((item) => {
              const selected = category === item;
              return (
                <Pressable key={item} onPress={() => setCategory(item)} style={[styles.chip, selected && styles.chipOn]}>
                  <Text style={[styles.chipText, selected && styles.chipTextOn]}>{CATEGORY_EMOJI[item]} {item}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable disabled={saving} onPress={() => { void save(); }} style={styles.save}>
          <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save to Tax Vault'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgCanvas, justifyContent: 'space-between' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  navButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderLight },
  navGlyph: { fontWeight: '700', color: colors.textPrimary },
  navTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  content: { flexGrow: 1, padding: 16, paddingBottom: 16, gap: 16, justifyContent: 'space-between' },
  footer: { paddingHorizontal: 16, paddingBottom: 16 },
  paper: { backgroundColor: colors.bgCard, borderRadius: 28, padding: 24, borderWidth: 1, borderColor: colors.borderLight, ...cardShadow },
  merchant: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  scanned: { textAlign: 'center', color: colors.textSecondary, fontSize: 13, marginBottom: 16 },
  itemsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  itemsTitle: { fontWeight: '800', color: colors.textPrimary },
  edit: { color: colors.accentBlue, fontWeight: '700' },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderStyle: 'dashed', borderColor: colors.borderLight },
  itemLabel: { flex: 1, color: colors.textPrimary },
  itemInput: { flex: 1, color: colors.textPrimary, fontSize: 16 },
  itemPrice: { fontWeight: '700', color: colors.textPrimary },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  muted: { color: colors.textSecondary },
  taxField: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  taxInput: { minWidth: 72, textAlign: 'right', color: colors.textPrimary, fontWeight: '700', padding: 0 },
  totalLabel: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  totalValue: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  chips: { gap: 8, paddingTop: 16 },
  chip: { backgroundColor: colors.bgSubtle, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: colors.btnPrimaryBg },
  chipText: { color: colors.textPrimary, fontWeight: '700' },
  chipTextOn: { color: '#FFFFFF' },
  card: { backgroundColor: colors.bgCard, borderRadius: 28, padding: 20, borderWidth: 1, borderColor: colors.borderLight, gap: 14 },
  toggle: { flexDirection: 'row', backgroundColor: colors.bgSubtle, borderRadius: 999, padding: 4 },
  toggleItem: { flex: 1, borderRadius: 999, paddingVertical: 10, alignItems: 'center' },
  toggleOn: { backgroundColor: colors.bgCard },
  toggleText: { color: colors.textSecondary, fontWeight: '700', fontSize: 13 },
  toggleTextOn: { color: colors.textPrimary },
  error: { color: colors.destructive, textAlign: 'center' },
  save: { height: 58, borderRadius: 999, backgroundColor: colors.btnPrimaryBg, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#FFFFFF', fontWeight: '800', fontSize: 17 },
});
