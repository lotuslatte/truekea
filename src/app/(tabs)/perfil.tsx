import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { LeafConfetti } from '@/components/LeafConfetti';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { RatingStars } from '@/components/ui/RatingStars';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/features/auth/AuthProvider';
import { AyniBadge } from '@/features/ayni/AyniBadge';
import { getAchievements, getCo2SavedKg, getProfileBadges } from '@/features/ayni/badges';
import { useProfileStats } from '@/features/ayni/useProfileStats';
import { useMyItems, useSetItemStatus, type MyItem } from '@/features/items/api';
import { confirmAction, notify } from '@/lib/confirm';
import { publicPhotoUrl } from '@/lib/supabase';
import { colors, fonts, fontSizes, radius, shadows, spacing } from '@/theme/tokens';
import type { ItemStatus } from '@/types/database';

const STATUS_BADGE: Record<ItemStatus, { label: string; tone: 'success' | 'warning' | 'muted' }> = {
  available: { label: 'Disponible', tone: 'success' },
  reserved: { label: 'Reservado', tone: 'warning' },
  traded: { label: 'Truekeado', tone: 'muted' },
  paused: { label: 'Pausado', tone: 'muted' },
  draft: { label: 'Borrador', tone: 'muted' },
  removed: { label: 'Eliminado', tone: 'muted' },
};

// Insignias que la persona ya vio celebradas; sirve para detectar las nuevas.
const BADGES_SEEN_KEY = 'truekea:badges_seen';

export default function PerfilScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { data: items, isLoading, isRefetching, refetch } = useMyItems();
  const statsQuery = useProfileStats(profile?.id ?? '');
  const setStatus = useSetItemStatus();
  const [confettiBurst, setConfettiBurst] = useState(0);
  const celebrationChecked = useRef(false);

  // La celebración espera a que las estadísticas estén resueltas (con éxito o
  // error): comparar a mitad de carga celebraría insignias en falso.
  const statsResolved = statsQuery.isSuccess || statsQuery.isError;
  const stats = statsQuery.data ?? null;

  useEffect(() => {
    if (!profile || !statsResolved || celebrationChecked.current) return;
    celebrationChecked.current = true;
    const unlocked = getAchievements(profile, stats).filter((badge) => badge.unlocked);
    const currentKeys = unlocked.map((badge) => badge.key);
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(BADGES_SEEN_KEY);
        if (raw !== null) {
          const seen = new Set(JSON.parse(raw) as string[]);
          const fresh = unlocked.find((badge) => !seen.has(badge.key));
          if (fresh) {
            setConfettiBurst((prev) => prev + 1);
            notify('¡Nueva insignia! 🏅', `${fresh.emoji} ${fresh.label} — ${fresh.hint}`);
          }
        }
        // Primera vez (sin key): guarda sin celebrar. Luego, actualiza el set.
        await AsyncStorage.setItem(BADGES_SEEN_KEY, JSON.stringify(currentKeys));
      } catch {
        // Si el almacenamiento falla, no rompemos el perfil.
      }
    })();
  }, [profile, statsResolved, stats]);

  const changeStatus = (itemId: string, status: 'available' | 'paused' | 'removed') => {
    setStatus.mutate(
      { itemId, status },
      {
        onError: (e) => notify('Ups, no pudimos actualizar', e.message),
      },
    );
  };

  const removeItem = (item: MyItem) => {
    confirmAction({
      title: '¿Eliminar publicación?',
      message: `"${item.title}" dejará de mostrarse a los demás truekeros. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      destructive: true,
      onConfirm: () => changeStatus(item.id, 'removed'),
    });
  };

  const renderItem = ({ item }: { item: MyItem }) => {
    const firstPhoto = [...item.item_photos].sort((a, b) => a.position - b.position)[0];
    const badge = STATUS_BADGE[item.status];
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.title}
        onPress={() => router.push(`/item/${item.id}`)}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        {firstPhoto ? (
          <Image
            source={{ uri: publicPhotoUrl(firstPhoto.storage_path) }}
            style={styles.thumbnail}
            contentFit="cover"
          />
        ) : (
          <View
            style={[
              styles.thumbnail,
              styles.thumbnailEmpty,
              item.kind === 'knowledge' && styles.thumbnailKnowledge,
            ]}
          >
            <Text style={styles.thumbnailEmoji}>
              {item.kind === 'knowledge' ? '🎓' : '📦'}
            </Text>
          </View>
        )}
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.badgesRow}>
            {item.kind === 'knowledge' ? <Badge label="🧠 Saber" tone="accent" /> : null}
            {item.is_donation ? <Badge label="Regalo" tone="donation" /> : null}
            <Badge label={badge.label} tone={badge.tone} />
          </View>
          <View style={styles.actionsRow}>
            {item.status === 'available' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => changeStatus(item.id, 'paused')}
                hitSlop={6}
              >
                <Text style={styles.actionLink}>⏸ Pausar</Text>
              </Pressable>
            ) : null}
            {item.status === 'paused' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => changeStatus(item.id, 'available')}
                hitSlop={6}
              >
                <Text style={styles.actionLink}>▶️ Reactivar</Text>
              </Pressable>
            ) : null}
            {item.status === 'available' || item.status === 'paused' ? (
              <Pressable accessibilityRole="button" onPress={() => removeItem(item)} hitSlop={6}>
                <Text style={[styles.actionLink, styles.actionDanger]}>🗑 Eliminar</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  };

  const profileBadges = profile ? getProfileBadges(profile, stats) : [];
  const co2Saved = profile ? getCo2SavedKg(profile) : 0;
  const statTiles = [
    { key: 'truekes', emoji: '🔁', value: profile?.trades_completed ?? 0, label: 'truekes' },
    { key: 'circulos', emoji: '⭕', value: profile?.circles_hosted ?? 0, label: 'círculos' },
    { key: 'regalos', emoji: '🎁', value: profile?.donations_given ?? 0, label: 'regalos' },
    { key: 'co2', emoji: '🌎', value: co2Saved, label: 'kg CO₂ evitados' },
  ];

  const header = (
    <View style={styles.header}>
      <View style={styles.headerCard}>
        <Avatar url={profile?.avatar_url ?? null} name={profile?.display_name ?? '?'} size={72} />
        <Text style={styles.displayName}>{profile?.display_name}</Text>
        <Text style={styles.username}>@{profile?.username}</Text>
        {profile?.district ? <Text style={styles.district}>📍 {profile.district}</Text> : null}
        <RatingStars value={profile?.rating_avg ?? 0} count={profile?.rating_count ?? 0} />
        <AyniBadge
          tradesCompleted={profile?.trades_completed ?? 0}
          circlesHosted={profile?.circles_hosted ?? 0}
          showProgress
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver todas mis insignias"
          onPress={() => router.push('/insignias')}
          style={({ pressed }) => [styles.profileBadges, pressed && styles.badgesPressed]}
        >
          {profileBadges.map((badge) => (
            <Badge key={badge.key} label={`${badge.emoji} ${badge.label}`} tone="gold" />
          ))}
          <View style={styles.seeAllChip}>
            <Text style={styles.seeAllText}>Ver todas →</Text>
          </View>
        </Pressable>
        <Text style={styles.tradesCount}>
          {profile?.trades_completed === 1
            ? '1 trueke hecho'
            : `${profile?.trades_completed ?? 0} truekes hechos`}
        </Text>
        {/* Columna compacta de accesos: encuentros, deseos/guardados y ajustes. */}
        <Button
          title="Mis encuentros 📅"
          variant="secondary"
          onPress={() => router.push('/encuentros')}
          style={styles.settingsButton}
        />
        <Button
          title="Deseos y guardados ❤️"
          variant="secondary"
          onPress={() => router.push('/deseos')}
          style={styles.compactButton}
        />
        <Button
          title="Ajustes"
          variant="secondary"
          onPress={() => router.push('/ajustes')}
          style={styles.compactButton}
        />
      </View>
      <View style={styles.statsRow}>
        {statTiles.map((stat) => (
          <View key={stat.key} style={styles.statTile}>
            <Text style={styles.statEmoji}>{stat.emoji}</Text>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel} numberOfLines={2}>
              {stat.label}
            </Text>
          </View>
        ))}
      </View>
      <Text style={styles.sectionTitle}>Mis publicaciones</Text>
      {isLoading ? (
        <View style={styles.skeletons}>
          <Skeleton style={styles.skeletonRow} />
          <Skeleton style={styles.skeletonRow} />
          <Skeleton style={styles.skeletonRow} />
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={items ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState
              emoji="📦"
              title="Todavía no publicas nada"
              subtitle="Dale una segunda vida a lo que ya no usas y consigue algo que te encante."
              actionTitle="Publicar mi primer objeto"
              onAction={() => router.push('/item/nuevo')}
            />
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        style={styles.list}
        contentContainerStyle={styles.listContent}
      />
      <LeafConfetti burst={confettiBurst} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.sand,
  },
  list: {
    flex: 1,
    backgroundColor: colors.sand,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  header: {
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.card,
  },
  displayName: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    color: colors.ink,
    textAlign: 'center',
  },
  username: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
  },
  district: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
  },
  tradesCount: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.inkFaint,
  },
  profileBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgesPressed: {
    opacity: 0.7,
  },
  seeAllChip: {
    backgroundColor: colors.goldFaint,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  seeAllText: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSizes.xs,
    color: colors.goldInk,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    gap: 2,
    ...shadows.card,
  },
  statEmoji: {
    fontSize: fontSizes.md,
  },
  statValue: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    color: colors.ink,
  },
  statLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  settingsButton: {
    marginTop: spacing.sm,
    alignSelf: 'stretch',
  },
  // Los botones siguientes no repiten el margen: el gap de la tarjeta basta.
  compactButton: {
    alignSelf: 'stretch',
  },
  sectionTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    color: colors.ink,
  },
  skeletons: {
    gap: spacing.md,
  },
  skeletonRow: {
    height: 96,
    borderRadius: radius.lg,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.card,
  },
  cardPressed: {
    opacity: 0.85,
  },
  thumbnail: {
    width: 88,
    height: 88,
    borderRadius: radius.md,
    backgroundColor: colors.sand,
  },
  thumbnailEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailKnowledge: {
    backgroundColor: colors.primaryFaint,
  },
  thumbnailEmoji: {
    fontSize: fontSizes.xl,
  },
  cardBody: {
    flex: 1,
    gap: spacing.xs,
  },
  cardTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  actionLink: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSizes.sm,
    color: colors.primary,
  },
  actionDanger: {
    color: colors.danger,
  },
});
