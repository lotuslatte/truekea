import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  useReceivedOffers,
  useSentOffers,
  type ItemWithPhotos,
  type OfferWithRelations,
} from '@/features/offers/api';
import { timeAgo } from '@/lib/format';
import { publicPhotoUrl } from '@/lib/supabase';
import { colors, fonts, fontSizes, radius, shadows, spacing } from '@/theme/tokens';
import type { OfferStatus } from '@/types/database';

type Segment = 'received' | 'sent';

type BadgeTone = 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'donation' | 'muted';

const STATUS_META: Record<OfferStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Pendiente', tone: 'warning' },
  accepted: { label: 'Aceptada', tone: 'success' },
  rejected: { label: 'Rechazada', tone: 'danger' },
  countered: { label: 'Contraofertada', tone: 'accent' },
  cancelled: { label: 'Cancelada', tone: 'muted' },
  expired: { label: 'Vencida', tone: 'muted' },
};

function firstPhotoUrl(item: ItemWithPhotos): string | null {
  const sorted = [...item.item_photos].sort((a, b) => a.position - b.position);
  const photo = sorted[0];
  return photo ? publicPhotoUrl(photo.storage_path) : null;
}

function Thumb({ item }: { item: ItemWithPhotos | null }) {
  if (!item) {
    return (
      <View style={[styles.thumb, styles.thumbFallback]}>
        <Text style={styles.thumbEmoji}>🎁</Text>
      </View>
    );
  }
  const photo = firstPhotoUrl(item);
  if (!photo) {
    const isKnowledge = item.kind === 'knowledge';
    return (
      <View
        style={[styles.thumb, styles.thumbFallback, isKnowledge && styles.knowledgeFallback]}
      >
        <Text style={styles.thumbEmoji}>{isKnowledge ? '🎓' : '📷'}</Text>
      </View>
    );
  }
  return <Image source={{ uri: photo }} style={styles.thumb} contentFit="cover" />;
}

function offerLine(offer: OfferWithRelations, segment: Segment): string {
  if (segment === 'received') {
    return offer.offered_item
      ? `Te ofrecen su ${offer.offered_item.title} por tu ${offer.item.title}`
      : `Te piden tu ${offer.item.title} — es un regalo`;
  }
  return offer.offered_item
    ? `Ofreciste tu ${offer.offered_item.title} por ${offer.item.title}`
    : `Pediste ${offer.item.title} — es un regalo`;
}

function OfferRow({ offer, segment }: { offer: OfferWithRelations; segment: Segment }) {
  const router = useRouter();
  const meta = STATUS_META[offer.status];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/oferta/${offer.id}`)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.thumbs}>
        <Thumb item={offer.item} />
        <Text style={styles.swapArrow}>↔</Text>
        <Thumb item={offer.offered_item} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {offerLine(offer, segment)}
        </Text>
        <View style={styles.badges}>
          <Badge tone={meta.tone} label={meta.label} />
        </View>
        <Text style={styles.time}>{timeAgo(offer.created_at)}</Text>
      </View>
    </Pressable>
  );
}

export default function OffersScreen() {
  const [segment, setSegment] = useState<Segment>('received');
  const received = useReceivedOffers();
  const sent = useSentOffers();
  const active = segment === 'received' ? received : sent;

  return (
    <View style={styles.screen}>
      <View style={styles.segments}>
        {(
          [
            { key: 'received', label: 'Recibidas' },
            { key: 'sent', label: 'Enviadas' },
          ] as const
        ).map(({ key, label }) => {
          const selected = segment === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setSegment(key)}
              style={[styles.pill, selected && styles.pillSelected]}
            >
              <Text style={[styles.pillLabel, selected && styles.pillLabelSelected]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {active.isPending ? (
        <View style={styles.skeletons}>
          <Skeleton style={styles.skeletonRow} />
          <Skeleton style={styles.skeletonRow} />
          <Skeleton style={styles.skeletonRow} />
        </View>
      ) : active.isError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            Ups, no pudimos cargar tus ofertas. Revisa tu conexión e inténtalo de nuevo.
          </Text>
          <Button title="Reintentar" variant="ghost" onPress={() => active.refetch()} />
        </View>
      ) : (
        <FlatList
          data={active.data ?? []}
          keyExtractor={(offer) => offer.id}
          renderItem={({ item }) => <OfferRow offer={item} segment={segment} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={active.isRefetching}
              onRefresh={() => active.refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            segment === 'received' ? (
              <EmptyState
                emoji="🤝"
                title="Aún no recibes ofertas"
                subtitle="Publica objetos con buenas fotos y las ofertas llegarán solitas."
              />
            ) : (
              <EmptyState
                emoji="🌱"
                title="Aún no envías ofertas"
                subtitle="Explora el feed y propón tu primer trueke."
              />
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  segments: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pill: {
    flex: 1,
    borderRadius: radius.full,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
  },
  pillLabelSelected: {
    color: colors.surface,
  },
  skeletons: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  errorBox: {
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  skeletonRow: {
    height: 96,
    borderRadius: radius.lg,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.card,
  },
  rowPressed: {
    opacity: 0.85,
  },
  thumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
  },
  thumbFallback: {
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knowledgeFallback: {
    backgroundColor: colors.primaryFaint,
  },
  thumbEmoji: {
    fontSize: 20,
  },
  swapArrow: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
  },
  rowBody: {
    flex: 1,
    gap: spacing.xs,
  },
  rowTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.ink,
    lineHeight: 19,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  time: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.inkFaint,
  },
});
