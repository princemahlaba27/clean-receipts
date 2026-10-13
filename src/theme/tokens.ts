import { Platform, type TextStyle } from 'react-native';

export const colors = {
  obsidian: '#07090E',
  glass: '#11151F',
  hairline: '#1D2333',
  yellow: '#FFE500',
  yellowPressed: '#CCB700',
  emerald: '#00E599',
  white: '#FFFFFF',
  slate: '#8A92A6',
  black: '#000000',
  danger: '#FF453A',
};

export const radius = 20;

export const fonts = {
  currency: Platform.select<TextStyle>({
    ios: { fontWeight: '700', letterSpacing: -0.6 },
    default: { fontWeight: '700' },
  }),
  mono: Platform.select<TextStyle>({
    ios: { fontFamily: 'Menlo', fontVariant: ['tabular-nums'] },
    android: { fontFamily: 'monospace' },
    default: { fontFamily: 'monospace' },
  }),
};
