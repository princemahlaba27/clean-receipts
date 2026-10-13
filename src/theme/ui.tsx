import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius } from './tokens';

export function GlassCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function YellowButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: PressableProps['onPress'];
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: pressed ? colors.yellowPressed : colors.yellow, opacity: disabled ? 0.45 : 1 },
      ]}
    >
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.glass,
    borderColor: colors.hairline,
    borderRadius: radius,
    borderWidth: 1,
  },
  button: {
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  buttonLabel: {
    color: colors.black,
    fontSize: 17,
    fontWeight: '700',
  },
});
