import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useEncuentros, type Encuentro, type EncuentroRole } from '@/features/agenda/api';
import { colors, fonts, fontSizes, radius, shadows, spacing } from '@/theme/tokens';

const ROLE_BADGE: Record<EncuentroRole, { label: string; tone: 'gold' | 'primary' | 'accent' }> = {
  anfitrion: { label: 'Anfitrión', tone: 'gold' },
  asistente: { label: 'Asistente', tone: 'primary' },
  trueke: { label: 'Trueke', tone: 'accent' },
};

function formatFecha(iso: string): string {
  const legible = format(new Date(iso), "EEEE d 'de' MMMM · HH:mm 'h'", { locale: es });
  return legible.charAt(0).toUpperCase() + legible.slice(1);
}

function EncuentroCard({ encuentro, onPress }: { encuentro: Encuentro; onPress: () => void }) {
  const roleBadge = ROLE_BADGE[encuentro.role];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={encuentro.title}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardTop}>
        <Text style={[styles.date, !encuentro.date && styles.dateMissing]} numberOfLines={1}>
          {encuentro.date
            ? `📅 ${formatFecha(encuentro.date)}`
            : 'Sin fecha aún — coordínala en el chat'}
        </Text>
        <Badge label={roleBadge.label} tone={roleBadge.tone} />
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {encuentro.title}
      </Text>
      <Text style={styles.companion} numberOfLines={1}>
        {encuentro.companion ? `Con ${encuentro.companion}` : 'Tú lo dictas'}
      </Text>
      <Text style={styles.place} numberOfLines={1}>
        {encuentro.isVirtual
          ? '💻 Virtual'
          : encuentro.place
            ? `📍 ${encuentro.place}`
            : '📍 Punto por definir'}
      </Text>
    </Pressable>
  );
}

export default function EncuentrosScreen() {
  const router = useRouter();
  const { data: encuentros, isPending, isError, refetch } = useEncuentros();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  if (isPending) {
    return (
      <View style={styles.skeletons}>
        <Skeleton style={styles.skeletonCard} />
        <Skeleton style={styles.skeletonCard} />
        <Skeleton style={styles.skeletonCard} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorText}>
          Ups, no pudimos cargar tu agenda. Revisa tu conexión e inténtalo de nuevo.
        </Text>
        <Button title="Reintentar" variant="ghost" onPress={() => refetch()} />
      </View>
    );
  }

  const all = encuentros ?? [];
  const proximos = all.filter((e) => e.date != null);
  const porCoordinar = all.filter((e) => e.date == null);
  const sections = [
    ...(proximos.length > 0 ? [{ title: 'Próximos', data: proximos }] : []),
    ...(porCoordinar.length > 0 ? [{ title: 'Por coordinar', data: porCoordinar }] : []),
  ];

  return (
    <SectionList
      sections={sections}
      keyExtractor={(encuentro) => encuentro.key}
      renderItem={({ item }) => (
        <EncuentroCard encuentro={item} onPress={() => router.push(item.path as never)} />
      )}
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionTitle}>{section.title}</Text>
      )}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <EmptyState
            emoji="📅"
            title="Nada agendado todavía"
            subtitle="Cuando pactes un trueke o tengas cupo en un círculo, tu agenda vivirá aquí."
          />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.md,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  sectionTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    color: colors.ink,
    marginTop: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadows.card,
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  date: {
    flex: 1,
    fontFamily: fonts.bodySemi,
    fontSize: fontSizes.sm,
    color: colors.primary,
  },
  dateMissing: {
    fontFamily: fonts.bodyMedium,
    color: colors.inkMuted,
  },
  title: {
    fontFamily: fonts.headingSemi,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
  companion: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
  },
  place: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
  },
  skeletons: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  skeletonCard: {
    height: 120,
    borderRadius: radius.lg,
  },
  errorBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
