import { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { FREE_RECEIPT_LIMIT } from '../config';
import { countReceipts, insertReceipt } from '../db/vault';
import { formatIsoDate, formatPlainMoney } from '../format';
import { persistImage } from '../services/files';
import { useBilling } from '../services/purchases';
import { createId } from '../services/ids';
import { CATEGORIES, type Category, type RootStackParamList } from '../types';
import { colors, fonts, radius } from '../theme/tokens';
import { GlassCard, YellowButton } from '../theme/ui';

type Route = RouteProp<RootStackParamList, 'ReceiptDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList, 'ReceiptDetail'>;
type ActiveField = 'subtotal' | 'tax' | 'total' | 'date';

export function ReceiptDetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const billing = useBilling();
  const draft = route.params.draft;
  const [merchant, setMerchant] = useState(draft.merchant);
  const [date, setDate] = useState(draft.date);
  const [category, setCategory] = useState<Category>(draft.category);
  const [subtotal, setSubtotal] = useState(draft.subtotal);
  const [tax, setTax] = useState(draft.tax);
  const [total, setTotal] = useState(draft.total);
  const [reference, setReference] = useState(draft.reference);
  const [active, setActive] = useState<ActiveField>('total');
  const [zoom, setZoom] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function assignMoney(value: number) {
    const field: ActiveField = active === 'date' ? 'total' : active;
    setActive(field);
    if (field === 'subtotal') setSubtotal(value);
    if (field === 'tax') setTax(value);
    if (field === 'total') setTotal(value);
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
        date,
        category,
        subtotal,
        tax,
        total,
        reference: reference.trim(),
        imagePath,
        lineItems: draft.lineItems,
      });
      navigation.popToTop();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'The receipt could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <GlassCard style={styles.previewCard}>
          <Image source={{ uri: draft.imageUri }} style={styles.preview} resizeMode="contain" />
          <Pressable accessibilityLabel="Zoom receipt" onPress={() => setZoom(true)} style={styles.zoom}>
            <Text style={styles.zoomLabel}>⤢</Text>
          </Pressable>
          <Text style={styles.proof}>Audit Proof Attached</Text>
        </GlassCard>

        <Text style={styles.label}>MERCHANT</Text>
        <GlassCard style={styles.field}>
          <TextInput
            value={merchant}
            onChangeText={setMerchant}
            placeholder="Merchant"
            placeholderTextColor={colors.slate}
            style={styles.input}
          />
        </GlassCard>

        <Text style={styles.label}>ITEMS</Text>
        <GlassCard style={styles.table}>
          {draft.lineItems.map((item) => (
            <Leader key={item.id} label={item.label} amount={formatPlainMoney(item.amount)} />
          ))}
          <Leader label="Subtotal" amount={formatPlainMoney(subtotal)} active={active === 'subtotal'} onPress={() => setActive('subtotal')} />
          <Leader label="Tax (VAT)" amount={formatPlainMoney(tax)} active={active === 'tax'} onPress={() => setActive('tax')} />
          <Leader label="Total" amount={formatPlainMoney(total)} active={active === 'total'} onPress={() => setActive('total')} strong />
        </GlassCard>

        <Pressable onPress={() => setActive('date')}>
          <Text style={[styles.label, active === 'date' && styles.labelActive]}>DATE · {formatIsoDate(date)}</Text>
        </Pressable>
        <Text style={styles.hint}>Tap a chip to fill {active === 'date' ? 'the date' : active}.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {draft.moneyCandidates.map((value) => (
            <Pressable key={`m-${value}`} onPress={() => assignMoney(value)} style={styles.chip}>
              <Text style={styles.chipText}>{formatPlainMoney(value)}</Text>
            </Pressable>
          ))}
          {draft.dateCandidates.map((value) => (
            <Pressable key={`d-${value}`} onPress={() => { setActive('date'); setDate(value); }} style={styles.chip}>
              <Text style={styles.chipText}>{formatIsoDate(value)}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.label}>CATEGORY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {CATEGORIES.map((item) => (
            <Pressable key={item} onPress={() => setCategory(item)} style={[styles.chip, category === item && styles.chipOn]}>
              <Text style={[styles.chipText, category === item && styles.chipTextOn]}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.label}>REFERENCE</Text>
        <GlassCard style={styles.field}>
          <TextInput
            value={reference}
            onChangeText={setReference}
            autoCapitalize="characters"
            placeholder="Reference"
            placeholderTextColor={colors.slate}
            style={styles.input}
          />
        </GlassCard>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <View style={styles.footer}>
        <YellowButton disabled={saving} label={saving ? 'Saving…' : 'Save to Vault'} onPress={() => { void save(); }} />
      </View>
      <Modal visible={zoom} animationType="fade" onRequestClose={() => setZoom(false)}>
        <View style={styles.zoomScreen}>
          <Pressable accessibilityLabel="Close preview" onPress={() => setZoom(false)} style={styles.zoomClose}>
            <Text style={styles.zoomCloseLabel}>✕</Text>
          </Pressable>
          <Image source={{ uri: draft.imageUri }} style={styles.zoomImage} resizeMode="contain" />
        </View>
      </Modal>
    </View>
  );
}

function Leader({
  label,
  amount,
  active,
  strong,
  onPress,
}: {
  label: string;
  amount: string;
  active?: boolean;
  strong?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={styles.leader}>
      <Text style={[styles.leaderLabel, strong && styles.leaderStrong, active && styles.leaderActive]}>{label}</Text>
      <View style={styles.dots} />
      <Text style={[styles.leaderAmount, strong && styles.leaderTotal, active && styles.leaderActive]}>{amount}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.obsidian, flex: 1 },
  content: { padding: 20, paddingBottom: 24 },
  previewCard: { height: 230, marginBottom: 16, overflow: 'hidden' },
  preview: { backgroundColor: colors.white, flex: 1 },
  zoom: {
    alignItems: 'center',
    backgroundColor: colors.yellow,
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    right: 12,
    top: 12,
    width: 32,
  },
  zoomLabel: { color: colors.black, fontWeight: '800' },
  proof: {
    backgroundColor: colors.obsidian,
    borderRadius: 999,
    color: colors.emerald,
    fontSize: 12,
    fontWeight: '700',
    left: 12,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
    position: 'absolute',
    top: 12,
  },
  label: { color: colors.slate, fontSize: 12, fontWeight: '700', letterSpacing: 0.4, marginBottom: 8, marginTop: 8 },
  labelActive: { color: colors.yellow },
  hint: { color: colors.slate, marginBottom: 8 },
  field: { marginBottom: 8, paddingHorizontal: 14, paddingVertical: 12 },
  input: { color: colors.white, fontSize: 18, fontWeight: '600' },
  table: { marginBottom: 8, padding: 16 },
  leader: { alignItems: 'flex-end', flexDirection: 'row', marginVertical: 6 },
  leaderLabel: { color: colors.slate },
  leaderStrong: { color: colors.white, fontWeight: '700' },
  leaderActive: { color: colors.yellow },
  leaderAmount: { color: colors.white, ...fonts.mono },
  leaderTotal: { color: colors.yellow, fontSize: 18 },
  dots: { borderBottomColor: colors.hairline, borderBottomWidth: 1, borderStyle: 'dotted', flex: 1, marginBottom: 4, marginHorizontal: 8 },
  chips: { gap: 8, paddingBottom: 8 },
  chip: {
    backgroundColor: colors.glass,
    borderColor: colors.hairline,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: colors.yellow, borderColor: colors.yellow },
  chipText: { color: colors.white, fontWeight: '600' },
  chipTextOn: { color: colors.black },
  error: { color: colors.danger, marginTop: 8 },
  footer: { padding: 20, paddingBottom: 28 },
  zoomScreen: { backgroundColor: colors.obsidian, flex: 1, justifyContent: 'center' },
  zoomClose: {
    alignItems: 'center',
    backgroundColor: colors.glass,
    borderColor: colors.hairline,
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    left: 20,
    position: 'absolute',
    top: 58,
    width: 36,
  },
  zoomCloseLabel: { color: colors.white, fontWeight: '700' },
  zoomImage: { height: '70%', width: '100%' },
});
