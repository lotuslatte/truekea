import { DarkTheme, DefaultTheme } from 'expo-router';

import { colorScheme, colors } from '@/theme/tokens';

const base = colorScheme === 'dark' ? DarkTheme : DefaultTheme;

/**
 * React Navigation draws its own backgrounds during transitions and behind
 * modals. Without this they stay white in dark mode.
 */
export const navigationTheme: typeof DefaultTheme = {
  ...base,
  dark: colorScheme === 'dark',
  colors: {
    ...base.colors,
    primary: colors.primary,
    background: colors.sand,
    card: colors.sand,
    text: colors.ink,
    border: colors.border,
    notification: colors.danger,
  },
};
