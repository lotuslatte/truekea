import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LeafConfetti } from '@/components/LeafConfetti';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { RatingStars } from '@/components/ui/RatingStars';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  useAcceptOffer,
  useCancelOffer,
  useCounterOffer,
  useMyAvailableItems,
  useOffer,
  useRejectOffer,
  type ItemWithPhotos,
} from '@/features/offers/api';
import { confirmAction, notify } from '@/lib/confirm';
import { timeAgo } from '@/lib/format';
import { publicPhotoUrl, supabase } from '@/lib/supabase';
import { colors, fonts, fontSizes, radius, shadows, spacing } from '@/theme/tokens';
import type { OfferStatus } from '@/types/database';

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

function ItemCard({ item, caption }: { item: ItemWithPhotos; caption: string }) {
  const photo = firstPhotoUrl(item);
  const isKnowledge = item.kind === 'knowledge';
  return (
    <View style={styles.itemCard}>
      <Text style={styles.itemCaption}>{caption}</Text>
      {photo ? (
        <Image source={{ uri: photo }} style={styles.itemPhoto} contentFit="cover" />
      ) : (
        <View
          style={[
            styles.itemPhoto,
            styles.photoFallback,
            isKnowledge && styles.knowledgeFallback,
          ]}
        >
          <Text style={styles.photoEmoji}>{isKnowledge ? '🎓' : '📷'}</Text>
        </View>
      )}
      <Text style={styles.itemTitle} numberOfLines={2}>
        {item.title}
      </Text>
      {isKnowledge || item.is_donation ? (
        <View style={styles.itemBadges}>
          {isKnowledge ? <Badge tone="accent" label="🧠 Saber" /> : null}
          {item.is_donation ? <Badge tone="donation" label="Regalo 🎁" /> : null}
        </View>
      ) : null}
    </View>
  );
}

export default function OfferDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const uid = session?.user.id ?? '';

  const { data: offer, isPending, isError, refetch } = useOffer(id!);

  const accept = useAcceptOffer();
  const reject = useRejectOffer();
  const cancel = useCancelOffer();
  const counter = useCounterOffer();
  const myItems = useMyAvailableItems();

  const [counterOpen, setCounterOpen] = useState(false);
  const [counterItemId, setCounterItemId] = useState<string | null>(null);
  const [counterMessage, setCounterMessage] = useState('');
  const [celebration, setCelebration] = useState(0);

  const { data: acceptedTradeId } = useQuery({
    queryKey: ['offerTrade', id],
    enabled: offer?.status === 'accepted',
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase
        .from('trades')
        .select('id')
        .eq('offer_id', id!)
        .single();
      if (error) throw error;
      return data.id;
    },
  });

  if (isError) {
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorText}>
          Ups, no pudimos cargar esta oferta. Revisa tu conexión e inténtalo de nuevo.
        </Text>
        <Button title="Reintentar" variant="ghost" onPress={() => refetch()} />
      </View>
    );
  }

  if (isPending || !offer) {
    return (
      <View style={styles.loading}>
        <Skeleton style={{ height: 200, borderRadius: radius.lg }} />
        <Skeleton style={{ height: 64, borderRadius: radius.md }} />
        <Skeleton style={{ height: 48, borderRadius: radius.full }} />
      </View>
    );
  }

  const isOwner = offer.item.owner_id === uid;
  const isOfferer = offer.offerer_id === uid;
  const meta = STATUS_META[offer.status];
  // Solo se puede contraofertar cuando hay un objeto ofrecido (no donaciones).
  const canCounter = isOwner && offer.status === 'pending' && offer.offered_item_id != null;
  const counterItems = (myItems.data ?? []).filter((mine) => mine.id !== offer.item_id);

  const onAccept = () => {
    accept.mutate(offer.id, {
      onSuccess: (tradeId) => {
        // Celebración: hojas cayendo y un respiro festivo antes de navegar.
        setCelebration((count) => count + 1);
        notify('¡Trueke acordado! 🤝', 'Coordina la entrega por el chat.');
        setTimeout(() => router.replace(`/trueke/${tradeId}`), 700);
      },
      onError: () =>
        notify('Ups, no pudimos aceptar la oferta', 'Inténtalo de nuevo en un momento.'),
    });
  };

  const onReject = () => {
    confirmAction({
      title: '¿Rechazar esta oferta?',
      message: 'Le avisaremos a la otra persona. Esta acción no se puede deshacer.',
      confirmLabel: 'Rechazar',
      destructive: true,
      onConfirm: () =>
        reject.mutate(offer.id, {
          onSuccess: () => notify('Oferta rechazada'),
          onError: () =>
            notify('Ups, no pudimos rechazar la oferta', 'Inténtalo de nuevo en un momento.'),
        }),
    });
  };

  const onCancel = () => {
    confirmAction({
      title: '¿Cancelar tu oferta?',
      message: 'Podrás enviar una nueva cuando quieras.',
      confirmLabel: 'Cancelar oferta',
      destructive: true,
      onConfirm: () =>
        cancel.mutate(offer.id, {
          onSuccess: () => notify('Oferta cancelada'),
          onError: () =>
            notify('Ups, no pudimos cancelar la oferta', 'Inténtalo de nuevo en un momento.'),
        }),
    });
  };

  const onSendCounter = () => {
    if (!counterItemId) return;
    counter.mutate(
      {
        offerId: offer.id,
        offeredItemId: counterItemId,
        message: counterMessage.trim() || null,
      },
      {
        onSuccess: (newOfferId) => {
          notify('¡Contraoferta enviada! 🌱', 'Te avisaremos cuando respondan.');
          router.replace(`/oferta/${newOfferId}`);
        },
        onError: () =>
          notify('Ups, no pudimos enviar tu contraoferta', 'Inténtalo de nuevo en un momento.'),
      },
    );
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.statusRow}>
        <Badge tone={meta.tone} label={meta.label} />
        <Text style={styles.time}>{timeAgo(offer.created_at)}</Text>
      </View>

      {/* Los dos lados del trueke */}
      <View style={styles.swapRow}>
        <ItemCard item={offer.item} caption={isOwner ? 'Tu objeto' : 'Su objeto'} />
        <Text style={styles.swapArrow}>↔</Text>
        {offer.offered_item ? (
          <ItemCard item={offer.offered_item} caption={isOfferer ? 'Tu objeto' : 'Ofrecen'} />
        ) : (
          <View style={styles.itemCard}>
            <Text style={styles.itemCaption}>A cambio</Text>
            <View style={[styles.itemPhoto, styles.photoFallback]}>
              <Text style={styles.photoEmoji}>🎁</Text>
            </View>
            <Text style={styles.giftText}>Sin objeto a cambio — es un regalo</Text>
          </View>
        )}
      </View>

      {offer.message ? (
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>“{offer.message}”</Text>
        </View>
      ) : null}

      {/* Quién ofrece */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ver perfil de ${offer.offerer.display_name}`}
        onPress={() => router.push(`/usuario/${offer.offerer.id}`)}
        style={({ pressed }) => [styles.offererRow, pressed && { opacity: 0.85 }]}
      >
        <Avatar url={offer.offerer.avatar_url} name={offer.offerer.display_name} size={44} />
        <View style={styles.offererInfo}>
          <Text style={styles.offererName}>{offer.offerer.display_name}</Text>
          <RatingStars value={offer.offerer.rating_avg ?? 0} count={offer.offerer.rating_count} />
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      {/* Acciones */}
      {isOwner && offer.status === 'pending' ? (
        <View style={styles.actions}>
          <Button title="Aceptar" onPress={onAccept} loading={accept.isPending} />
          <Button title="Rechazar" variant="danger" onPress={onReject} loading={reject.isPending} />
          {canCounter ? (
            <Button
              title={counterOpen ? 'Ocultar contraoferta' : 'Contraofertar'}
              variant="secondary"
              onPress={() => setCounterOpen((open) => !open)}
            />
          ) : null}

          {counterOpen && canCounter ? (
            <View style={styles.counterBox}>
              <Text style={styles.counterTitle}>Tu contraoferta</Text>
              <Text style={styles.counterSubtitle}>
                Pides su {offer.offered_item?.title} y ofreces uno de tus objetos.
              </Text>
              {counterItems.length === 0 ? (
                <Text style={styles.counterEmpty}>
                  No tienes objetos disponibles para contraofertar. 📦
                </Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.pickerRow}
                >
                  {counterItems.map((mine) => {
                    const selected = mine.id === counterItemId;
                    const photo = firstPhotoUrl(mine);
                    const isKnowledge = mine.kind === 'knowledge';
                    return (
                      <Pressable
                        key={mine.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => setCounterItemId(selected ? null : mine.id)}
                        style={[styles.pickCard, selected && styles.pickCardSelected]}
                      >
                        {photo ? (
                          <Image
                            source={{ uri: photo }}
                            style={styles.pickPhoto}
                            contentFit="cover"
                          />
                        ) : (
                          <View
                            style={[
                              styles.pickPhoto,
                              styles.photoFallback,
                              isKnowledge && styles.knowledgeFallback,
                            ]}
                          >
                            <Text style={styles.photoEmoji}>{isKnowledge ? '🎓' : '📷'}</Text>
                          </View>
                        )}
                        <Text style={styles.pickTitle} numberOfLines={2}>
                          {mine.title}
                        </Text>
                        {isKnowledge ? (
                          <View style={styles.itemBadges}>
                            <Badge tone="accent" label="🧠 Saber" />
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              <TextField
                placeholder="Mensaje (opcional)"
                value={counterMessage}
                onChangeText={setCounterMessage}
                multiline
                numberOfLines={2}
                style={styles.counterMessage}
              />

              <Button
                title="Enviar contraoferta"
                onPress={onSendCounter}
                disabled={!counterItemId}
                loading={counter.isPending}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {isOfferer && offer.status === 'pending' ? (
        <View style={styles.actions}>
          <Button
            title="Cancelar oferta"
            variant="danger"
            onPress={onCancel}
            loading={cancel.isPending}
          />
        </View>
      ) : null}

      {offer.status === 'accepted' ? (
        <View style={styles.actions}>
          <Button
            title="Ver trueke"
            onPress={() => {
              if (acceptedTradeId) router.push(`/trueke/${acceptedTradeId}`);
            }}
            disabled={!acceptedTradeId}
          />
        </View>
      ) : null}
      </ScrollView>
      <LeafConfetti burst={celebration} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  loading: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.lg,
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
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  time: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.inkMuted,
  },
  swapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  swapArrow: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    color: colors.inkMuted,
  },
  itemCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
    ...shadows.card,
  },
  itemCaption: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemPhoto: {
    width: '100%',
    height: 110,
    borderRadius: radius.md,
  },
  photoFallback: {
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knowledgeFallback: {
    backgroundColor: colors.primaryFaint,
  },
  photoEmoji: {
    fontSize: 32,
  },
  itemTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: fontSizes.sm,
    color: colors.ink,
  },
  itemBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  giftText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    color: colors.donation,
  },
  messageBox: {
    backgroundColor: colors.surface,
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  messageText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.ink,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  offererRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.card,
  },
  offererInfo: {
    flex: 1,
    gap: 2,
  },
  offererName: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
  chevron: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xl,
    color: colors.inkFaint,
  },
  actions: {
    gap: spacing.md,
  },
  counterBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  counterTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
  counterSubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.inkMuted,
  },
  counterEmpty: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pickCard: {
    width: 110,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  pickCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryFaint,
  },
  pickPhoto: {
    width: '100%',
    height: 70,
    borderRadius: radius.sm,
  },
  pickTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    color: colors.ink,
  },
  counterMessage: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
});
