import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { FREE_RECEIPT_LIMIT } from '../config';
import { countReceipts } from '../db/vault';
import { formatIsoDate, formatMoney } from '../format';
import { recognizeLines } from '../services/ocr';
import { parseReceipt } from '../services/receiptParser';
import { loadSampleDraft } from '../services/sampleReceipt';
import { scanDocument } from '../services/scanner';
import { useBilling } from '../services/purchases';
import { colors, fonts, radius } from '../theme/tokens';
import { GlassCard, YellowButton } from '../theme/ui';
import type { ReceiptDraft, RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Scanner'>;

export function ScannerScreen() {
  const navigation = useNavigation<Nav>();
  const billing = useBilling();
  const [draft, setDraft] = useState<ReceiptDraft | null>(null);
  const [reading, setReading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const laser = useSharedValue(0);
  const sheet = useSharedValue(360);

  useEffect(() => {
    laser.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [laser]);

  const laserStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: laser.value * 280 }],
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheet.value }],
  }));

  useEffect(() => {
    sheet.value = withTiming(draft ? 0 : 360, { duration: 280 });
  }, [draft, sheet]);

  async function capture(bypassGate = false) {
    setMessage(null);
    if (!bypassGate) {
      const count = await countReceipts();
      if (count >= FREE_RECEIPT_LIMIT && !billing.isPro) {
        billing.requestAccess(() => { void capture(true); });
        return;
      }
    }
    try {
      const images = await scanDocument();
      const imageUri = images[0];
      if (!imageUri) {
        setMessage('The scan did not include a usable page.');
        return;
      }
      setReading(true);
      const lines = await recognizeLines(imageUri);
      const parsed = parseReceipt(lines);
      setDraft({ ...parsed, imageUri });
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'This device does not support the document scanner. Use Import Sample.');
    } finally {
      setReading(false);
    }
  }

  async function importSample() {
    const sample = await loadSampleDraft();
    navigation.navigate('ReceiptDetail', { draft: sample });
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Close scanner" onPress={() => navigation.goBack()}>
          <Text style={styles.close}>Close</Text>
        </Pressable>
      </View>
      <View style={styles.viewport}>
        <Brackets />
        {draft ? null : <Animated.View style={[styles.laser, laserStyle]} />}
        <GlassCard style={styles.pill}>
          <Text style={styles.pillText}>Align receipt within frame • Auto-snapping</Text>
        </GlassCard>
      </View>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {draft ? (
        <Animated.View style={sheetStyle}>
          <GlassCard style={styles.drawer}>
            <Text style={styles.merchant}>{draft.merchant}</Text>
            <Text style={styles.date}>{formatIsoDate(draft.date)}</Text>
            <Text style={styles.total}>{formatMoney(draft.total)}</Text>
            <YellowButton
              label="Verify Details →"
              onPress={() => navigation.navigate('ReceiptDetail', { draft })}
            />
          </GlassCard>
        </Animated.View>
      ) : (
        <View style={styles.shutterRow}>
          <Pressable accessibilityLabel="Import sample receipt" onPress={() => { void importSample(); }} style={styles.secondary}>
            <Text style={styles.secondaryLabel}>Import Sample</Text>
          </Pressable>
          <Pressable accessibilityLabel="Scan receipt" disabled={reading} onPress={() => { void capture(); }} style={styles.shutter}>
            <View style={styles.shutterCore} />
          </Pressable>
          <Text style={styles.reading}>{reading ? 'Reading…' : 'Scan'}</Text>
        </View>
      )}
    </View>
  );
}

function Brackets() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.corner, styles.nw]} />
      <View style={[styles.corner, styles.ne]} />
      <View style={[styles.corner, styles.sw]} />
      <View style={[styles.corner, styles.se]} />
    </View>
  );
}

const corner = 28;
const styles = StyleSheet.create({
  screen: { backgroundColor: colors.obsidian, flex: 1, paddingBottom: 28 },
  topBar: { paddingHorizontal: 20, paddingTop: 58 },
  close: { color: colors.yellow, fontSize: 17, fontWeight: '600' },
  viewport: {
    borderColor: colors.hairline,
    borderRadius: radius,
    borderWidth: 1,
    flex: 1,
    margin: 20,
    overflow: 'hidden',
  },
  laser: {
    backgroundColor: colors.yellow,
    height: 2,
    left: 36,
    opacity: 0.85,
    position: 'absolute',
    right: 36,
    top: 48,
  },
  pill: {
    alignSelf: 'center',
    borderRadius: 999,
    bottom: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    position: 'absolute',
  },
  pillText: { color: colors.white, fontSize: 12, fontWeight: '600' },
  message: { color: colors.slate, marginHorizontal: 24, marginBottom: 8 },
  drawer: { marginHorizontal: 20, padding: 18 },
  merchant: { color: colors.white, fontSize: 20, fontWeight: '700' },
  date: { color: colors.slate, marginTop: 4 },
  total: { color: colors.yellow, fontSize: 40, marginVertical: 10, ...fonts.currency },
  shutterRow: { alignItems: 'center', gap: 10 },
  shutter: {
    alignItems: 'center',
    borderColor: colors.yellow,
    borderRadius: 40,
    borderWidth: 3,
    height: 74,
    justifyContent: 'center',
    width: 74,
  },
  shutterCore: { backgroundColor: colors.yellow, borderRadius: 28, height: 56, width: 56 },
  secondary: { paddingVertical: 4 },
  secondaryLabel: { color: colors.yellow, fontWeight: '700' },
  reading: { color: colors.slate, fontSize: 12 },
  corner: { borderColor: colors.yellow, height: corner, position: 'absolute', width: corner },
  nw: { borderLeftWidth: 3, borderTopWidth: 3, left: 16, top: 16 },
  ne: { borderRightWidth: 3, borderTopWidth: 3, right: 16, top: 16 },
  sw: { borderBottomWidth: 3, borderLeftWidth: 3, bottom: 64, left: 16 },
  se: { borderBottomWidth: 3, borderRightWidth: 3, bottom: 64, right: 16 },
});
