import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, fontSizes, radius, spacing } from '@/theme/tokens';

type Tone = 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'donation' | 'muted' | 'gold';

const tones: Record<Tone, { bg: string; fg: string }> = {
  primary: { bg: colors.primaryFaint, fg: colors.primary },
  accent: { bg: colors.accentFaint, fg: colors.accentInk },
  success: { bg: colors.primaryFaint, fg: colors.success },
  warning: { bg: colors.goldFaint, fg: colors.goldInk },
  danger: { bg: colors.dangerFaint, fg: colors.danger },
  donation: { bg: colors.primaryFaint, fg: colors.donation },
  muted: { bg: colors.sand, fg: colors.inkMuted },
  gold: { bg: colors.goldFaint, fg: colors.goldInk },
};

export function Badge({ label, tone = 'primary' }: { label: string; tone?: Tone }) {
  const { bg, fg } = tones[tone];
  return (
    <View style={[styles.base, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSizes.xs,
  },
});
