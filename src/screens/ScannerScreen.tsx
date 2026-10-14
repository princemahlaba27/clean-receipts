import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FREE_RECEIPT_LIMIT } from '../config';
import { countReceipts } from '../db/vault';
import { recognizeLines } from '../services/ocr';
import { parseReceipt } from '../services/receiptParser';
import { loadSampleDraft } from '../services/sampleReceipt';
import { scanDocument } from '../services/scanner';
import { useBilling } from '../services/purchases';
import { colors } from '../theme/tokens';
import type { RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Scanner'>;

export function ScannerScreen() {
  const navigation = useNavigation<Nav>();
  const billing = useBilling();
  const [reading, setReading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const laser = useSharedValue(0);

  useEffect(() => {
    laser.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [laser]);

  const laserStyle = useAnimatedStyle(() => ({
    top: 24 + laser.value * 220,
  }));

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
      navigation.navigate('ReceiptDetail', { draft: { ...parsed, imageUri, deductible: true } });
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'This device does not support the document scanner. Try the sample receipt.');
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
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <Pressable accessibilityLabel="Back" onPress={() => navigation.goBack()} style={styles.circle}>
          <Text style={styles.circleText}>←</Text>
        </Pressable>
        <Pressable accessibilityLabel="Currency and setup" onPress={() => navigation.goBack()} style={styles.circle}>
          <Text style={styles.circleText}>⚙️</Text>
        </Pressable>
      </SafeAreaView>
      <View style={styles.stage}>
        <View style={styles.paper}>
          <Text style={styles.paperMerchant}>Astron Energy</Text>
          <Text style={styles.paperLine}>Shop purchase</Text>
          <Text style={styles.paperLine}>VAT</Text>
          <Text style={styles.paperTotal}>Total</Text>
          <Animated.View style={[styles.laser, laserStyle]} />
        </View>
        <View style={styles.scanPill}><Text style={styles.scanPillText}>{reading ? 'Scanning Receipt...' : 'Scanning Receipt...'}</Text></View>
      </View>
      <View style={styles.sheet}>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <View style={styles.status}><Text style={styles.statusText}>✓ Ready to capture & extract on-device</Text></View>
        <Pressable disabled={reading} onPress={() => { void capture(); }} style={styles.primary}>
          <Text style={styles.primaryText}>📸 Open Camera Scanner</Text>
        </Pressable>
        <Pressable onPress={() => { void importSample(); }} style={styles.secondary}>
          <Text style={styles.secondaryText}>🧾 Try Instant Sample Receipt</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#1C1C1E' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  circle: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  circleText: { fontSize: 18 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  paper: {
    width: 230,
    height: 300,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 18,
    overflow: 'hidden',
  },
  paperMerchant: { fontWeight: '800', fontSize: 16, color: colors.textPrimary, textAlign: 'center' },
  paperLine: { marginTop: 16, color: colors.textSecondary },
  paperTotal: { marginTop: 24, fontWeight: '800', color: colors.textPrimary },
  laser: { position: 'absolute', left: 12, right: 12, height: 2, backgroundColor: colors.accentBlue },
  scanPill: { marginTop: 16, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  scanPillText: { fontWeight: '700', color: colors.textPrimary },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    gap: 12,
  },
  status: { alignSelf: 'center', backgroundColor: colors.accentEmeraldBg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  statusText: { color: colors.accentEmerald, fontWeight: '700' },
  primary: { height: 56, borderRadius: 999, backgroundColor: colors.btnPrimaryBg, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  secondary: { height: 52, borderRadius: 999, backgroundColor: colors.bgSubtle, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.textPrimary, fontWeight: '700', fontSize: 16 },
  message: { color: colors.destructive, textAlign: 'center' },
});
