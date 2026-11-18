import { StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Chakana } from '@/features/intro/Chakana';
import { colors, fonts, fontSizes, spacing } from '@/theme/tokens';

type Props = {
  /** Decorative emoji, or an icon name. One of the two. */
  emoji?: string;
  icon?: IconName;
  title: string;
  subtitle?: string;
  actionTitle?: string;
  onAction?: () => void;
};

export function EmptyState({ emoji, icon, title, subtitle, actionTitle, onAction }: Props) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.emblem} accessible={false} importantForAccessibility="no-hide-descendants">
        <View style={styles.watermark}>
          <Chakana size={104} color={colors.inkFaint} opacity={0.22} />
        </View>
        {icon ? <Icon name={icon} size={44} color={colors.inkMuted} /> : <Text style={styles.emoji}>{emoji}</Text>}
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionTitle && onAction ? (
        <Button title={actionTitle} onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    padding: spacing.xxl,
    gap: spacing.sm,
  },
  emblem: {
    width: 104,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
  },
  watermark: {
    position: 'absolute',
  },
  emoji: {
    fontSize: 44,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    color: colors.ink,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  action: {
    marginTop: spacing.lg,
  },
});
