import { FlatList, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { getAchievements, type AchievementBadge } from '@/features/ayni/badges';
import { useProfileStats } from '@/features/ayni/useProfileStats';
import { colors, fonts, fontSizes, radius, shadows, spacing } from '@/theme/tokens';

// Galería coleccionable de insignias: siempre muestra las 38, agrupadas por
// tema; las que faltan aparecen apagadas con una pista de cómo lograrlas.
// Mientras llegan las estadísticas del servidor se muestra lo que ya se sabe
// por el perfil, con un avisito de que seguimos contando.

type BadgeSection = { title: string; badges: AchievementBadge[] };

const COLUMNS = 3;

/** Parte una lista en filas de `size` para armar la grilla a mano. */
function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

/** Agrupa las insignias por `group` respetando el orden de aparición. */
function toSections(achievements: AchievementBadge[]): BadgeSection[] {
  const sections: BadgeSection[] = [];
  for (const badge of achievements) {
    const last = sections[sections.length - 1];
    if (last && last.title === badge.group) {
      last.badges.push(badge);
    } else {
      sections.push({ title: badge.group, badges: [badge] });
    }
  }
  return sections;
}

export default function InsigniasScreen() {
  const { profile } = useAuth();
  const statsQuery = useProfileStats(profile?.id ?? '');
  const achievements = profile ? getAchievements(profile, statsQuery.data ?? null) : [];
  const sections = toSections(achievements);
  const unlockedCount = achievements.filter((badge) => badge.unlocked).length;
  const total = achievements.length;
  const percent = total > 0 ? (unlockedCount / total) * 100 : 0;
  const countingStats = statsQuery.isPending && !!profile;

  const header = (
    <View style={styles.summary}>
      <Text style={styles.summaryText}>
        {unlockedCount} de {total} desbloqueadas
      </Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percent}%` }]} />
      </View>
      {countingStats ? (
        <Text style={styles.countingText}>Contando tus logros…</Text>
      ) : null}
      <Text style={styles.summaryHint}>
        Cada trueke, círculo y regalo suma. ¡Sigue así, truekero/a! 💪
      </Text>
    </View>
  );

  return (
    <FlatList
      data={sections}
      keyExtractor={(section) => section.title}
      renderItem={({ item }) => <BadgeSectionView section={item} />}
      ListHeaderComponent={header}
      style={styles.list}
      contentContainerStyle={styles.content}
    />
  );
}

function BadgeSectionView({ section }: { section: BadgeSection }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      {chunk(section.badges, COLUMNS).map((row) => (
        <View key={row[0]?.key ?? 'fila'} style={styles.row}>
          {row.map((badge) => (
            <BadgeCard key={badge.key} badge={badge} />
          ))}
          {/* Rellenos invisibles para que la última fila no se estire. */}
          {Array.from({ length: COLUMNS - row.length }).map((_, index) => (
            <View key={`filler-${index}`} style={styles.filler} />
          ))}
        </View>
      ))}
    </View>
  );
}

function BadgeCard({ badge }: { badge: AchievementBadge }) {
  return (
    <View style={[styles.card, badge.unlocked ? styles.cardUnlocked : styles.cardLocked]}>
      <Text style={[styles.emoji, !badge.unlocked && styles.emojiLocked]}>{badge.emoji}</Text>
      <Text
        style={[styles.label, !badge.unlocked && styles.labelLocked]}
        numberOfLines={2}
      >
        {badge.label}
      </Text>
      {!badge.unlocked ? (
        <Text style={styles.hint} numberOfLines={2}>
          {badge.hint}
        </Text>
      ) : null}
      {!badge.unlocked && badge.progress ? (
        <Text style={styles.progressLabel}>{badge.progress}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: colors.sand,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  summary: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: 'center',
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  summaryText: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    color: colors.ink,
  },
  progressTrack: {
    alignSelf: 'stretch',
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.goldFaint,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.gold,
  },
  countingText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    color: colors.inkMuted,
  },
  summaryHint: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: fontSizes.sm,
    color: colors.primary,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  filler: {
    flex: 1,
  },
  card: {
    flex: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 120,
  },
  cardUnlocked: {
    backgroundColor: colors.goldFaint,
    borderWidth: 1.5,
    borderColor: colors.gold,
  },
  cardLocked: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emoji: {
    fontSize: 36,
  },
  emojiLocked: {
    opacity: 0.25,
  },
  label: {
    fontFamily: fonts.headingSemi,
    fontSize: fontSizes.xs,
    color: colors.ink,
    textAlign: 'center',
  },
  labelLocked: {
    color: colors.inkMuted,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  progressLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSizes.xs,
    color: colors.goldInk,
  },
});
