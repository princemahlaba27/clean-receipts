import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const colors = {
  bgCanvas: '#F7F8FA',
  bgCard: '#FFFFFF',
  bgSubtle: '#F2F4F7',
  borderLight: '#E4E7EC',
  textPrimary: '#101828',
  textSecondary: '#667085',
  btnPrimaryBg: '#111111',
  btnPrimaryText: '#FFFFFF',
  accentEmerald: '#059669',
  accentEmeraldBg: '#ECFDF5',
  accentBlue: '#0066FF',
  accentBlueBg: '#EEF4FF',
  destructive: '#E11D48',
};

export const radius = 28;

export const cardShadow: ViewStyle = {
  shadowColor: '#000',
  shadowOpacity: 0.05,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
};

export const fonts = {
  currency: Platform.select<TextStyle>({
    ios: { fontWeight: '800', letterSpacing: -0.8 },
    default: { fontWeight: '800' },
  }),
  mono: Platform.select<TextStyle>({
    ios: { fontFamily: 'Menlo', fontVariant: ['tabular-nums'] },
    android: { fontFamily: 'monospace' },
    default: { fontFamily: 'monospace' },
  }),
};
