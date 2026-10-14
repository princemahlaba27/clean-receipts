import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { FREE_RECEIPT_LIMIT } from '../config';
import { countReceipts } from '../db/vault';
import { recognizeLines } from '../services/ocr';
import { parseReceipt } from '../services/receiptParser';
import { scanDocument } from '../services/scanner';
import { useBilling } from '../services/purchases';
import { colors } from '../theme/tokens';
import type { RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Scanner'>;

export function ScannerScreen() {
  const navigation = useNavigation<Nav>();
  const billing = useBilling();
  const started = useRef(false);
  const scanning = useRef(false);
  const left = useRef(false);
  const waitingForAccess = useRef(false);

  function leaveQuietly() {
    if (left.current) return;
    left.current = true;
    if (navigation.canGoBack()) navigation.goBack();
  }

  async function capture() {
    if (scanning.current || left.current) return;
    scanning.current = true;
    try {
      const images = await scanDocument();
      const imageUri = images?.[0];
      if (!imageUri) {
        leaveQuietly();
        return;
      }
      let lines: string[] = [];
      try {
        lines = await recognizeLines(imageUri);
      } catch {
        lines = [];
      }
      const parsed = parseReceipt(lines);
      if (left.current) return;
      left.current = true;
      navigation.replace('ReceiptDetail', { draft: { ...parsed, imageUri, deductible: true } });
    } catch {
      leaveQuietly();
    } finally {
      scanning.current = false;
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        const count = await countReceipts();
        if (count >= FREE_RECEIPT_LIMIT && !billing.isProNow()) {
          waitingForAccess.current = true;
          billing.requestAccess(() => {
            waitingForAccess.current = false;
            void capture();
          });
          return;
        }
        await capture();
      } catch {
        leaveQuietly();
      }
    })();
    // The camera opens once, as soon as this screen is shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!waitingForAccess.current || scanning.current || left.current) return;
    if (billing.paywallVisible || billing.downsellVisible || billing.isProNow()) return;
    leaveQuietly();
  }, [billing.downsellVisible, billing.paywallVisible, billing.isPro]);

  return (
    <View style={styles.screen}>
      <ActivityIndicator color={colors.textPrimary} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgCanvas, alignItems: 'center', justifyContent: 'center' },
});
