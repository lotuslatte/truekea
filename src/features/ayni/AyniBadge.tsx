import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getAyniLevel } from '@/features/ayni/ayni';
import { notify } from '@/lib/confirm';
import { colors, fonts, fontSizes, radius, spacing } from '@/theme/tokens';

const explainAyni = () =>
  notify(
    '¿Qué es el Ayni?',
    'En los Andes, el ayni es la reciprocidad: hoy por ti, mañana por mí. Tu Ayni crece con cada trueke que completas, y crece doble con cada círculo que dictas.',
  );

export function AyniBadge({
  tradesCompleted,
  circlesHosted,
  showProgress = false,
}: {
  tradesCompleted: number;
  circlesHosted?: number;
  showProgress?: boolean;
}) {
  const { level, next, remaining } = getAyniLevel(tradesCompleted, circlesHosted);
  const hasCircles = (circlesHosted ?? 0) > 0;

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ayni ${level.name}. Toca para saber qué es el Ayni.`}
        onPress={explainAyni}
        hitSlop={6}
        style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
      >
        <Text style={styles.emoji}>{level.emoji}</Text>
        <Text style={styles.label}>Ayni · {level.name}</Text>
      </Pressable>
      {showProgress && next ? (
        <Text style={styles.progress}>
          {hasCircles
            ? `${remaining} ${remaining === 1 ? 'punto' : 'puntos'} de ayni para ser ${next.name} ${next.emoji} — cada trueke da 1, cada círculo dictado da 2`
            : `${remaining} ${remaining === 1 ? 'trueke' : 'truekes'} para ser ${next.name} ${next.emoji}`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.sand,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
  },
  pillPressed: {
    opacity: 0.7,
  },
  emoji: {
    fontSize: fontSizes.xs,
  },
  label: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSizes.xs,
    color: colors.gold,
  },
  progress: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.inkMuted,
    textAlign: 'center',
  },
});
