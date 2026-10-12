import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { LeafConfetti } from '@/components/LeafConfetti';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { RatingStars } from '@/components/ui/RatingStars';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/features/auth/AuthProvider';
import { useMyAvailableItems } from '@/features/offers/api';
import { useRequireAuth } from '@/features/auth/useRequireAuth';
import { useCategories } from '@/features/categories';
import {
  useCheckinMember,
  useCircleChat,
  useCircleMembers,
  useCircleOccupancy,
  useCompleteCircle,
  useJoinCircle,
  useLeaveCircle,
  useMyCircleRating,
  useMyMembership,
  useRateCircle,
  useRespondCircleRequest,
} from '@/features/circles/api';
import { confirmAction, notify } from '@/lib/confirm';
import { timeAgo } from '@/lib/format';
import { hapticTap } from '@/lib/haptics';
import { shareItem } from '@/lib/share';
import { publicPhotoUrl, supabase } from '@/lib/supabase';
import { colors, fonts, fontSizes, radius, shadows, spacing } from '@/theme/tokens';
import type { Item, ItemKind, ItemPhoto, Profile, ReportReason } from '@/types/database';

type ItemDetail = Item & { item_photos: ItemPhoto[]; owner: Profile };

const PHOTO_HEIGHT = 300;

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'prohibido', label: 'Artículo prohibido' },
  { value: 'estafa', label: 'Posible estafa' },
  { value: 'ofensivo', label: 'Contenido ofensivo' },
  { value: 'spam', label: 'Spam' },
  { value: 'otro', label: 'Otro' },
];

function formatEventDate(iso: string): string {
  const date = new Date(iso);
  const day = format(date, "EEEE d 'de' MMMM", { locale: es });
  const time = `${format(date, 'h:mm')} ${date.getHours() < 12 ? 'am' : 'pm'}`;
  return `${day}, ${time}`;
}

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { requireAuth } = useRequireAuth();
  const { data: categories } = useCategories();
  const [reportVisible, setReportVisible] = useState(false);
  const [joinVisible, setJoinVisible] = useState(false);
  const [confettiBurst, setConfettiBurst] = useState(0);
  const membershipQuery = useMyMembership(id ?? '');

  const itemQuery = useQuery({
    queryKey: ['item', id],
    enabled: !!id,
    queryFn: async (): Promise<ItemDetail> => {
      const { data, error } = await supabase
        .from('items')
        .select('*, item_photos(*), owner:profiles!items_owner_id_fkey(*)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const item = itemQuery.data;
  // "Ahora" congelado al montar, para los cálculos de perecibles (pureza).
  const [mountedAt] = useState(() => Date.now());

  if (itemQuery.isPending) {
    return (
      <View style={styles.screen}>
        <Skeleton style={{ height: PHOTO_HEIGHT, borderRadius: 0 }} />
        <View style={styles.content}>
          <Skeleton style={{ height: 24, width: '70%' }} />
          <Skeleton style={{ height: 16, width: '40%' }} />
          <Skeleton style={{ height: 60 }} />
        </View>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.notFound}>No encontramos esta publicación 😕</Text>
      </View>
    );
  }

  const isMine = session?.user.id === item.owner_id;
  const category = categories?.find((c) => c.id === item.category_id);
  const photos = [...item.item_photos].sort((a, b) => a.position - b.position);
  const isCircle = item.kind === 'knowledge' && item.format === 'circle';
  // Regalos perecibles: hora límite de recojo. Vencida, se apaga la oferta.
  // "Ahora" se congela al montar (regla de pureza del compilador de React).
  const pickupUntil = item.pickup_until ? new Date(item.pickup_until) : null;
  const pickupRemainingMs = pickupUntil ? pickupUntil.getTime() - mountedAt : null;
  const pickupExpired = pickupRemainingMs !== null && pickupRemainingMs <= 0;
  const pickupUrgent =
    pickupRemainingMs !== null && pickupRemainingMs > 0 && pickupRemainingMs < 3 * 60 * 60 * 1000;
  const pickupLabel =
    item.pickup_until && !pickupExpired ? formatEventDate(item.pickup_until) : null;
  const showOfferCta = !isMine && item.status === 'available' && !isCircle && !pickupExpired;
  const membership = membershipQuery.data ?? null;
  const hasActiveMembership = !!membership && membership.status !== 'cancelled';
  const showJoinCta =
    isCircle &&
    !isMine &&
    item.status === 'available' &&
    !hasActiveMembership &&
    !membershipQuery.isLoading;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: showOfferCta || showJoinCta ? 120 : spacing.xxl }}
      >
        <PhotoCarousel
          photos={photos}
          title={item.title}
          kind={item.kind}
          isCircle={isCircle}
          categoryIcon={category?.icon ?? null}
        />

        <View style={styles.content}>
          <View style={styles.badgeRow}>
            {item.kind === 'knowledge' ? (
              isCircle ? (
                <Badge label="⭕ Círculo" tone="accent" />
              ) : (
                <Badge label="🧠 Saber" tone="accent" />
              )
            ) : null}
            {item.status === 'reserved' ? <Badge label="Reservado" tone="warning" /> : null}
            {item.status === 'traded' ? (
              <Badge label={isCircle ? 'Círculo realizado' : 'Ya truekeado'} tone="muted" />
            ) : null}
            {isMine ? <Badge label="Tu publicación" tone="primary" /> : null}
          </View>

          <View style={styles.titleRow}>
            <Text style={[styles.title, styles.titleFlex]}>{item.title}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Compartir publicación"
              onPress={() => {
                hapticTap();
                void shareItem({ id: item.id, title: item.title });
              }}
              hitSlop={8}
              style={styles.shareButton}
            >
              <Ionicons name="share-social-outline" size={20} color={colors.inkMuted} />
            </Pressable>
          </View>

          {item.is_donation ? <Badge label="🎁 Regalo" tone="donation" /> : null}
          {pickupExpired ? <Badge label="⏰ Venció el recojo" tone="muted" /> : null}

          {pickupLabel ? (
            <View style={[styles.pickupBox, pickupUrgent && styles.pickupBoxUrgent]}>
              <Text style={[styles.pickupTitle, pickupUrgent && styles.pickupTitleUrgent]}>
                ⏰ Recoger hasta {pickupLabel}
              </Text>
              <Text style={styles.pickupSubtext}>
                Coordina el recojo por chat apenas ofertes — este regalo vuela
              </Text>
            </View>
          ) : null}

          {isMine && (item.status === 'available' || item.status === 'paused') ? (
            <Button
              title="Editar publicación ✏️"
              variant="secondary"
              onPress={() => router.push(`/item/${item.id}/editar`)}
            />
          ) : null}

          {isCircle ? <CircleEventBlock item={item} /> : null}

          {item.looking_for ? (
            <View style={styles.lookingFor}>
              <Text style={styles.lookingForLabel}>
                {isCircle ? '¿Qué debe traer cada asistente?' : 'Busca a cambio'}
              </Text>
              <Text style={styles.lookingForText}>{item.looking_for}</Text>
            </View>
          ) : null}

          <Text style={styles.description}>{item.description}</Text>

          {item.pickup_until ? (
            <Text style={styles.foodSafetyNote}>
              🙏 Revisa el estado de la comida al recogerla. Comparte y recibe con confianza.
            </Text>
          ) : null}

          {isCircle && isMine ? (
            <CircleHostSection
              item={item}
              onCompleted={() => setConfettiBurst((prev) => prev + 1)}
            />
          ) : null}
          {isCircle && !isMine ? <CircleVisitorSection item={item} /> : null}

          <View style={styles.metaRow}>
            {category ? (
              <Text style={styles.metaText}>
                {category.icon} {category.name}
              </Text>
            ) : null}
            <Text style={styles.metaText}>📍 {item.district}</Text>
            <Text style={styles.metaText}>{timeAgo(item.created_at)}</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Ver perfil de ${item.owner.display_name}`}
            onPress={() => requireAuth(() => router.push(`/usuario/${item.owner.id}`))}
            style={styles.ownerCard}
          >
            <Avatar url={item.owner.avatar_url} name={item.owner.display_name} size={48} />
            <View style={styles.ownerInfo}>
              <Text style={styles.ownerName}>{item.owner.display_name}</Text>
              <Text style={styles.ownerUsername}>@{item.owner.username}</Text>
              <RatingStars value={item.owner.rating_avg ?? 0} count={item.owner.rating_count} size={12} />
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>

          {!isMine ? (
            <Pressable onPress={() => requireAuth(() => setReportVisible(true))} hitSlop={8}>
              <Text style={styles.reportLink}>Reportar publicación</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      {showOfferCta ? (
        <View style={styles.ctaBar}>
          <Button
            title="Ofrecer trueke 🌱"
            onPress={() => requireAuth(() => router.push(`/item/${item.id}/ofertar`))}
          />
        </View>
      ) : null}

      {showJoinCta ? (
        <View style={styles.ctaBar}>
          <Button title="Pedir mi cupo ⭕" onPress={() => requireAuth(() => setJoinVisible(true))} />
        </View>
      ) : null}

      <ReportModal
        visible={reportVisible}
        itemId={item.id}
        onClose={() => setReportVisible(false)}
      />

      {isCircle ? (
        <JoinCircleModal visible={joinVisible} item={item} onClose={() => setJoinVisible(false)} />
      ) : null}

      <LeafConfetti burst={confettiBurst} />
    </View>
  );
}

function CircleEventBlock({ item }: { item: ItemDetail }) {
  const { data: occupancy } = useCircleOccupancy(item.id);
  const occupied = occupancy ?? 0;

  return (
    <View style={styles.eventBox}>
      {item.event_at ? <Text style={styles.eventText}>📅 {formatEventDate(item.event_at)}</Text> : null}
      {item.capacity != null ? (
        <Text style={styles.eventText}>
          🪑 {occupied}/{item.capacity} cupos ocupados
        </Text>
      ) : null}
      <Text style={styles.eventText}>
        {item.modality === 'virtual' ? '💻 Virtual' : `📍 ${item.district}`}
      </Text>
    </View>
  );
}

function CircleVisitorSection({ item }: { item: ItemDetail }) {
  const router = useRouter();
  const { data: membership } = useMyMembership(item.id);
  const { data: chat } = useCircleChat(item.id);
  const leave = useLeaveCircle();

  if (!membership || membership.status === 'cancelled') return null;

  if (membership.status === 'requested') {
    return (
      <View style={styles.circleSection}>
        <Badge label="Cupo pedido — esperando al anfitrión" tone="warning" />
        <Button
          title="Cancelar solicitud"
          variant="ghost"
          loading={leave.isPending}
          onPress={() =>
            leave.mutate(item.id, {
              onError: (error) => notify('Ups', error.message),
            })
          }
        />
      </View>
    );
  }

  if (membership.status === 'rejected') {
    return (
      <View style={styles.circleSection}>
        <Text style={styles.mutedText}>No hubo cupo esta vez.</Text>
      </View>
    );
  }

  // accepted o checked_in
  return (
    <View style={styles.circleSection}>
      <Badge label="¡Tienes cupo! 🎉" tone="success" />
      {chat ? (
        <Button
          title="Abrir chat del círculo"
          variant="secondary"
          onPress={() => router.push(`/chat/${chat.id}`)}
        />
      ) : null}
      {item.status !== 'traded' ? (
        <Button
          title="Ya no puedo ir"
          variant="ghost"
          loading={leave.isPending}
          onPress={() =>
            confirmAction({
              title: '¿Ya no puedes ir?',
              message: 'Se liberará tu cupo para otra persona.',
              confirmLabel: 'Dejar el círculo',
              destructive: true,
              onConfirm: () =>
                leave.mutate(item.id, {
                  onError: (error) => notify('Ups', error.message),
                }),
            })
          }
        />
      ) : null}
      {item.status === 'traded' && membership.status === 'checked_in' ? (
        <CircleRatingCard item={item} />
      ) : null}
    </View>
  );
}

function CircleRatingCard({ item }: { item: ItemDetail }) {
  const ratingQuery = useMyCircleRating(item.id);
  const rate = useRateCircle();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');

  if (ratingQuery.isLoading) return null;

  if (ratingQuery.data) {
    return <Text style={styles.mutedText}>Ya calificaste este círculo. ¡Gracias! 💚</Text>;
  }

  return (
    <View style={styles.ratingCard}>
      <Text style={styles.sectionTitle}>¿Cómo estuvo el círculo?</Text>
      <RatingStars value={stars} onChange={setStars} size={20} />
      <TextField
        placeholder="Cuéntanos cómo te fue (opcional)"
        value={comment}
        onChangeText={setComment}
        multiline
      />
      <Button
        title="Enviar calificación"
        disabled={stars === 0}
        loading={rate.isPending}
        onPress={() =>
          rate.mutate(
            { circleItemId: item.id, rateeId: item.owner_id, stars, comment },
            {
              onSuccess: () => notify('¡Gracias!', 'Tu calificación ayuda a la comunidad.'),
              onError: (error) => notify('Ups', error.message),
            },
          )
        }
      />
    </View>
  );
}

function CircleHostSection({
  item,
  onCompleted,
}: {
  item: ItemDetail;
  onCompleted: () => void;
}) {
  const router = useRouter();
  const { data: members } = useCircleMembers(item.id);
  const { data: chat } = useCircleChat(item.id);
  const respond = useRespondCircleRequest();
  const checkin = useCheckinMember();
  const complete = useCompleteCircle();

  const visible = (members ?? []).filter((m) => m.status !== 'cancelled');
  const occupied = visible.filter(
    (m) => m.status === 'accepted' || m.status === 'checked_in',
  ).length;

  const now = new Date();
  const eventDate = item.event_at ? new Date(item.event_at) : null;
  const isEventDayOrLater = eventDate ? now >= startOfDay(eventDate) : false;
  const eventPassed = eventDate ? now > eventDate : false;
  const canComplete =
    eventPassed && (item.status === 'available' || item.status === 'reserved');

  const respondingTo = respond.isPending ? respond.variables : undefined;

  return (
    <View style={styles.circleSection}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Solicitudes</Text>
        {item.capacity != null ? (
          <Text style={styles.mutedText}>
            {occupied}/{item.capacity} cupos
          </Text>
        ) : null}
      </View>

      {visible.length === 0 ? (
        <Text style={styles.mutedText}>Aún nadie pide su cupo. ¡Comparte tu círculo! 🌱</Text>
      ) : null}

      {visible.map((member) => (
        <View key={member.id} style={styles.memberRow}>
          <Avatar
            url={member.member.avatar_url}
            name={member.member.display_name}
            size={40}
          />
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{member.member.display_name}</Text>
            {member.offered_item ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/item/${member.offered_item!.id}` as never)}
              >
                <Text style={styles.memberOfferedItem}>
                  {member.offered_item.kind === 'knowledge' ? '🎓' : '📦'} Ofrece:{' '}
                  {member.offered_item.title} →
                </Text>
              </Pressable>
            ) : null}
            {member.offering ? (
              <Text style={styles.memberOffering}>“{member.offering}”</Text>
            ) : null}
          </View>
          {member.status === 'requested' ? (
            <View style={styles.memberActions}>
              <Button
                title="Aceptar"
                variant="secondary"
                style={styles.smallButton}
                loading={respondingTo?.memberId === member.id && respondingTo.accept}
                onPress={() =>
                  respond.mutate(
                    { memberId: member.id, accept: true },
                    { onError: (error) => notify('Ups', error.message) },
                  )
                }
              />
              <Button
                title="Rechazar"
                variant="danger"
                style={styles.smallButton}
                loading={respondingTo?.memberId === member.id && !respondingTo.accept}
                onPress={() =>
                  respond.mutate(
                    { memberId: member.id, accept: false },
                    { onError: (error) => notify('Ups', error.message) },
                  )
                }
              />
            </View>
          ) : null}
          {member.status === 'accepted' ? (
            <View style={styles.memberActions}>
              <Badge label="Aceptado" tone="success" />
              {isEventDayOrLater && item.status !== 'traded' ? (
                <Button
                  title="Check-in ✓"
                  variant="secondary"
                  style={styles.smallButton}
                  loading={checkin.isPending && checkin.variables === member.id}
                  onPress={() =>
                    checkin.mutate(member.id, {
                      onError: (error) => notify('Ups', error.message),
                    })
                  }
                />
              ) : null}
            </View>
          ) : null}
          {member.status === 'checked_in' ? <Badge label="Asistió ✓" tone="primary" /> : null}
          {member.status === 'rejected' ? <Badge label="Sin cupo" tone="muted" /> : null}
        </View>
      ))}

      {chat ? (
        <Button
          title="Abrir chat del círculo"
          variant="secondary"
          onPress={() => router.push(`/chat/${chat.id}`)}
        />
      ) : null}

      {canComplete ? (
        <Button
          title="Completar círculo 🏔️"
          loading={complete.isPending}
          onPress={() =>
            confirmAction({
              title: '¿Completar el círculo?',
              message:
                'Suma a tu Ayni como anfitrión y habilita que quienes asistieron te califiquen.',
              confirmLabel: 'Completar',
              onConfirm: () =>
                complete.mutate(item.id, {
                  onSuccess: () => {
                    onCompleted();
                    notify('¡Círculo completado! 🏔️', 'Gracias por compartir tu saber.');
                  },
                  onError: (error) => notify('Ups', error.message),
                }),
            })
          }
        />
      ) : null}
    </View>
  );
}

function JoinCircleModal({
  visible,
  item,
  onClose,
}: {
  visible: boolean;
  item: ItemDetail;
  onClose: () => void;
}) {
  const [offering, setOffering] = useState('');
  const [offeredItemId, setOfferedItemId] = useState<string | null>(null);
  const join = useJoinCircle();
  const myItems = useMyAvailableItems();

  const canSubmit = offering.trim().length > 0 || offeredItemId !== null;

  const submit = () => {
    if (!canSubmit) return;
    join.mutate(
      { itemId: item.id, offering: offering.trim() || null, offeredItemId },
      {
        onSuccess: () => {
          setOffering('');
          setOfferedItemId(null);
          onClose();
          notify('¡Cupo pedido!', 'Te avisamos cuando el anfitrión responda.');
        },
        onError: (error) => notify('Ups', error.message),
      },
    );
  };

  const pickable = (myItems.data ?? []).filter((mine) => mine.id !== item.id);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <Text style={styles.modalTitle}>Pide tu cupo ⭕</Text>
          {pickable.length > 0 ? (
            <View style={styles.offerPickerSection}>
              <Text style={styles.offerPickerLabel}>Ofrece algo de tu vitrina</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.offerPickerRow}>
                  {pickable.map((mine) => {
                    const photo = [...(mine.item_photos ?? [])].sort(
                      (a, b) => a.position - b.position,
                    )[0];
                    const selected = offeredItemId === mine.id;
                    return (
                      <Pressable
                        key={mine.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => setOfferedItemId(selected ? null : mine.id)}
                        style={[styles.offerPickerCard, selected && styles.offerPickerCardSelected]}
                      >
                        {photo ? (
                          <Image
                            source={{ uri: publicPhotoUrl(photo.storage_path) }}
                            style={styles.offerPickerThumb}
                          />
                        ) : (
                          <View style={[styles.offerPickerThumb, styles.offerPickerThumbFallback]}>
                            <Text>{mine.kind === 'knowledge' ? '🎓' : '📦'}</Text>
                          </View>
                        )}
                        <Text style={styles.offerPickerTitle} numberOfLines={2}>
                          {mine.title}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          ) : null}
          <TextField
            label={pickable.length > 0 ? 'O descríbelo (o suma un detalle)' : '¿Qué ofreces a cambio?'}
            placeholder={item.looking_for ?? 'Cuéntale al anfitrión qué llevas al círculo'}
            value={offering}
            onChangeText={setOffering}
            multiline
          />
          <Button
            title="Pedir mi cupo"
            loading={join.isPending}
            disabled={!canSubmit}
            onPress={submit}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PhotoCarousel({
  photos,
  title,
  kind,
  isCircle,
  categoryIcon,
}: {
  photos: ItemPhoto[];
  title: string;
  kind: ItemKind;
  isCircle: boolean;
  categoryIcon: string | null;
}) {
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);

  // Hero temático para publicaciones sin foto: el icono de su categoría
  // en grande sobre un fondo tintado según el tipo.
  if (photos.length === 0) {
    return (
      <View
        style={[
          styles.heroFallback,
          isCircle
            ? styles.heroCircle
            : kind === 'knowledge'
              ? styles.heroKnowledge
              : styles.heroObject,
          { width },
        ]}
      >
        <Text style={styles.heroFallbackIcon}>
          {categoryIcon ?? (kind === 'knowledge' ? '🎓' : '📦')}
        </Text>
      </View>
    );
  }

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== page) setPage(next);
  };

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={64}
      >
        {photos.map((photo, index) => (
          <Image
            key={photo.id}
            source={{ uri: publicPhotoUrl(photo.storage_path) }}
            style={{ width, height: PHOTO_HEIGHT }}
            contentFit="cover"
            transition={200}
            accessibilityLabel={`Foto ${index + 1} de ${title}`}
          />
        ))}
      </ScrollView>
      {photos.length > 1 ? (
        <View style={styles.dots}>
          {photos.map((photo, index) => (
            <View key={photo.id} style={[styles.dot, index === page ? styles.dotActive : null]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ReportModal({
  visible,
  itemId,
  onClose,
}: {
  visible: boolean;
  itemId: string;
  onClose: () => void;
}) {
  const { session } = useAuth();
  const [reason, setReason] = useState<ReportReason | null>(null);

  const report = useMutation({
    mutationFn: async (selected: ReportReason) => {
      const uid = session?.user.id;
      if (!uid) throw new Error('Necesitas iniciar sesión para reportar.');
      const { error } = await supabase.from('reports').insert({
        reporter_id: uid,
        target_type: 'item',
        target_id: itemId,
        reason: selected,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      onClose();
      setReason(null);
      notify('Gracias', 'Revisaremos esta publicación.');
    },
    onError: () => {
      notify('Ups', 'No pudimos enviar tu reporte. Inténtalo de nuevo.');
    },
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <Text style={styles.modalTitle}>¿Qué pasa con esta publicación?</Text>
          <View style={styles.reasonList}>
            {REPORT_REASONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={reason === option.value}
                onPress={() => setReason(option.value)}
              />
            ))}
          </View>
          <Button
            title="Enviar reporte"
            loading={report.isPending}
            disabled={!reason}
            onPress={() => reason && report.mutate(reason)}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.sand,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFound: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.md,
    color: colors.inkMuted,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    color: colors.ink,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  titleFlex: {
    flex: 1,
  },
  shareButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  lookingFor: {
    backgroundColor: colors.primaryFaint,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  lookingForLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSizes.xs,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lookingForText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.ink,
  },
  description: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.ink,
    lineHeight: 22,
  },
  foodSafetyNote: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.inkMuted,
  },
  pickupBox: {
    backgroundColor: colors.accentFaint,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  pickupBoxUrgent: {
    backgroundColor: colors.dangerFaint,
  },
  pickupTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSizes.sm,
    color: colors.accent,
  },
  pickupTitleUrgent: {
    color: colors.danger,
  },
  pickupSubtext: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.inkMuted,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metaText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
  },
  ownerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.card,
  },
  ownerInfo: {
    flex: 1,
    gap: 2,
  },
  ownerName: {
    fontFamily: fonts.headingSemi,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
  ownerUsername: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.inkMuted,
  },
  chevron: {
    fontSize: fontSizes.xl,
    color: colors.inkFaint,
  },
  reportLink: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.inkMuted,
    textDecorationLine: 'underline',
    textAlign: 'center',
    marginTop: spacing.md,
  },
  ctaBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  heroFallback: {
    height: PHOTO_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroKnowledge: {
    backgroundColor: colors.primaryFaint,
  },
  heroObject: {
    backgroundColor: colors.goldFaint,
  },
  heroCircle: {
    backgroundColor: colors.festiveFaint,
  },
  heroFallbackIcon: {
    fontSize: 88,
  },
  dots: {
    position: 'absolute',
    bottom: spacing.md,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  dotActive: {
    backgroundColor: colors.surface,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  modalTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    color: colors.ink,
  },
  reasonList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  eventBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.card,
  },
  eventText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.ink,
  },
  circleSection: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.card,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
  mutedText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSizes.sm,
    color: colors.ink,
  },
  offerPickerSection: {
    gap: 6,
  },
  offerPickerLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.ink,
  },
  offerPickerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  offerPickerCard: {
    width: 96,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  offerPickerCardSelected: {
    borderColor: colors.primary,
  },
  offerPickerThumb: {
    width: '100%',
    height: 64,
  },
  offerPickerThumbFallback: {
    backgroundColor: colors.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerPickerTitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.ink,
    padding: 6,
  },
  memberOfferedItem: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSizes.xs,
    color: colors.primary,
    marginTop: 2,
  },
  memberOffering: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.inkMuted,
    fontStyle: 'italic',
  },
  memberActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  smallButton: {
    minHeight: 36,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  ratingCard: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
});
