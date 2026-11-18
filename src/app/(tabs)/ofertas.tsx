import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { StatusBadge } from '@/components/StatusBadge';
import { Thumb } from '@/components/Thumb';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  useReceivedOffers,
  useSentOffers,
  type OfferWithRelations,
} from '@/features/offers/api';
import { timeAgo } from '@/lib/format';
import { colors, fonts, fontSizes, radius, shadows, spacing } from '@/theme/tokens';

type Segment = 'received' | 'sent';

const SEGMENTS = [
  { key: 'received', label: 'Recibidas' },
  { key: 'sent', label: 'Enviadas' },
] as const;

function offerLine(offer: OfferWithRelations, segment: Segment): string {
  // The target item can be missing when it was removed after the offer.
  const target = offer.item?.title ?? 'una publicación que ya no está';
  if (segment === 'received') {
    return offer.offered_item
      ? `Te ofrecen «${offer.offered_item.title}» por «${target}»`
      : `Te piden «${target}», que es un regalo`;
  }
  return offer.offered_item
    ? `Ofreciste «${offer.offered_item.title}» por «${target}»`
    : `Pediste «${target}», que es un regalo`;
}

function OfferRow({ offer, segment }: { offer: OfferWithRelations; segment: Segment }) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/oferta/${offer.id}`)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.thumbs}>
        <Thumb item={offer.item} />
        <Icon name="swap" size={18} color={colors.inkMuted} label="por" />
        <Thumb item={offer.offered_item} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {offerLine(offer, segment)}
        </Text>
        <View style={styles.badges}>
          <StatusBadge offer={offer.status} />
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
      <SegmentedControl options={SEGMENTS} value={segment} onChange={setSegment} style={styles.segments} />

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
