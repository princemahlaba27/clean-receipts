import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { cardShadow, colors, radius } from './tokens';

export function GlassCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PrimaryButton({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
    >
      <Text style={styles.label}>{title}</Text>
    </Pressable>
  );
}

export const YellowButton = PrimaryButton;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...cardShadow,
  },
  button: {
    minHeight: 58,
    borderRadius: 999,
    backgroundColor: colors.btnPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.86 },
  label: { color: colors.btnPrimaryText, fontSize: 17, fontWeight: '700' },
});
