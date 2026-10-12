import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LeafConfetti } from '@/components/LeafConfetti';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  useCancelTrade,
  useConfirmTrade,
  useMeetingPoints,
  useMyRatingForTrade,
  useSetMeetingPoint,
  useTrade,
  type TradeItemWithPhotos,
} from '@/features/trades/api';
import { confirmAction, notify } from '@/lib/confirm';
import { publicPhotoUrl } from '@/lib/supabase';
import { colors, fonts, fontSizes, radius, shadows, spacing } from '@/theme/tokens';
import type { MeetingPoint } from '@/types/database';

function firstPhotoUrl(item: TradeItemWithPhotos): string | null {
  const sorted = [...item.item_photos].sort((a, b) => a.position - b.position);
  const photo = sorted[0];
  return photo ? publicPhotoUrl(photo.storage_path) : null;
}

function TradeItem({ item }: { item: TradeItemWithPhotos | null }) {
  if (!item) {
    return (
      <View style={styles.itemCard}>
        <View style={[styles.itemPhoto, styles.photoFallback]}>
          <Text style={styles.photoEmoji}>🎁</Text>
        </View>
        <Text style={styles.giftText}>Regalo</Text>
      </View>
    );
  }
  const photo = firstPhotoUrl(item);
  const isKnowledge = item.kind === 'knowledge';
  return (
    <View style={styles.itemCard}>
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
      {isKnowledge ? (
        <View style={styles.itemBadges}>
          <Badge tone="accent" label="🧠 Saber" />
        </View>
      ) : null}
    </View>
  );
}

function TimelineStep({
  done,
  title,
  subtitle,
  isLast,
}: {
  done: boolean;
  title: string;
  subtitle?: string;
  isLast?: boolean;
}) {
  return (
    <View style={styles.step}>
      <View style={styles.stepRail}>
        <View style={[styles.stepDot, done && styles.stepDotDone]}>
          <Text style={[styles.stepCheck, done && styles.stepCheckDone]}>{done ? '✓' : '•'}</Text>
        </View>
        {!isLast ? <View style={[styles.stepLine, done && styles.stepLineDone]} /> : null}
      </View>
      <View style={styles.stepBody}>
        <Text style={[styles.stepTitle, done && styles.stepTitleDone]}>{title}</Text>
        {subtitle ? <Text style={styles.stepSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export default function TradeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const uid = session?.user.id ?? '';

  const { data: trade, isPending, isError, refetch } = useTrade(id!);
  const meetingPoints = useMeetingPoints();
  const confirmTrade = useConfirmTrade();
  const cancelTrade = useCancelTrade();
  const setMeetingPoint = useSetMeetingPoint();
  const myRating = useMyRatingForTrade(id!);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [celebration, setCelebration] = useState(0);

  const groupedPoints = useMemo(() => {
    const groups = new Map<string, MeetingPoint[]>();
    for (const point of meetingPoints.data ?? []) {
      const list = groups.get(point.district) ?? [];
      list.push(point);
      groups.set(point.district, list);
    }
    return [...groups.entries()];
  }, [meetingPoints.data]);

  if (isError) {
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorText}>
          Ups, no pudimos cargar este trueke. Revisa tu conexión e inténtalo de nuevo.
        </Text>
        <Button title="Reintentar" variant="ghost" onPress={() => refetch()} />
      </View>
    );
  }

  if (isPending || !trade) {
    return (
      <View style={styles.loading}>
        <Skeleton style={{ height: 160, borderRadius: radius.lg }} />
        <Skeleton style={{ height: 120, borderRadius: radius.lg }} />
        <Skeleton style={{ height: 48, borderRadius: radius.full }} />
      </View>
    );
  }

  const iAmOwner = trade.owner_id === uid;
  const other = iAmOwner ? trade.offerer : trade.owner;
  const myConfirmedAt = iAmOwner ? trade.owner_confirmed_at : trade.offerer_confirmed_at;
  const otherConfirmedAt = iAmOwner ? trade.offerer_confirmed_at : trade.owner_confirmed_at;
  const isAgreed = trade.status === 'agreed';
  const isCompleted = trade.status === 'completed';
  const isCancelled = trade.status === 'cancelled';

  const deliverySubtitle = isCompleted
    ? 'Ambos confirmaron la entrega'
    : isCancelled
      ? undefined
      : myConfirmedAt && !otherConfirmedAt
        ? `Tú ✓ · Falta ${other.display_name}`
        : !myConfirmedAt && otherConfirmedAt
          ? `${other.display_name} ✓ · Faltas tú`
          : 'Ambos deben confirmar la entrega';

  const onConfirm = () => {
    confirmAction({
      title: '¿Confirmar la entrega?',
      message: 'Confirma solo cuando ya intercambiaron los objetos en persona.',
      confirmLabel: 'Confirmar',
      onConfirm: () =>
        confirmTrade.mutate(trade.id, {
          onSuccess: (status) => {
            if (status === 'completed') {
              // Fuiste quien cerró el trueke: llueven hojas para celebrarlo.
              setCelebration((count) => count + 1);
              notify('¡Trueke completado! 🎉', 'Gracias por darle una segunda vida a tus objetos.');
            } else {
              notify('¡Listo! ✓', `Ahora falta que ${other.display_name} confirme.`);
            }
          },
          onError: () =>
            notify('Ups, no pudimos confirmar la entrega', 'Inténtalo de nuevo en un momento.'),
        }),
    });
  };

  const onCancelTrade = () => {
    confirmAction({
      title: '¿Cancelar el trueke?',
      message: 'Ambos objetos volverán a estar disponibles para otras ofertas.',
      confirmLabel: 'Cancelar trueke',
      destructive: true,
      onConfirm: () =>
        cancelTrade.mutate(trade.id, {
          onSuccess: () => notify('Trueke cancelado', 'Tus objetos vuelven a estar disponibles.'),
          onError: () =>
            notify('Ups, no pudimos cancelar el trueke', 'Inténtalo de nuevo en un momento.'),
        }),
    });
  };

  const onPickPoint = (point: MeetingPoint) => {
    setMeetingPoint.mutate(
      { tradeId: trade.id, meetingPointId: point.id },
      {
        onSuccess: () => {
          setPickerOpen(false);
          notify('Punto de encuentro elegido 📍', point.name);
        },
        onError: () =>
          notify('Ups, no pudimos guardar el punto', 'Inténtalo de nuevo en un momento.'),
      },
    );
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
      {/* Header: los dos objetos */}
      <View style={styles.swapRow}>
        <TradeItem item={trade.owner_item} />
        <Text style={styles.swapArrow}>↔</Text>
        <TradeItem item={trade.offerer_item} />
      </View>

      {isCancelled ? (
        <View style={styles.centered}>
          <Badge tone="danger" label="Cancelado" />
        </View>
      ) : null}

      {/* La otra persona */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ver perfil de ${other.display_name}`}
        onPress={() => router.push(`/usuario/${other.id}`)}
        style={({ pressed }) => [styles.otherRow, pressed && { opacity: 0.85 }]}
      >
        <Avatar url={other.avatar_url} name={other.display_name} size={40} />
        <Text style={styles.otherName}>Trueke con {other.display_name}</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      {/* Timeline */}
      <View style={styles.timeline}>
        <TimelineStep done title="Acordado" subtitle="Ambos aceptaron el trueke" />
        <TimelineStep done={isCompleted} title="Entrega" subtitle={deliverySubtitle} />
        <TimelineStep done={isCompleted} title="Completado" isLast />
      </View>

      {/* Caja de seguridad */}
      <View style={styles.safetyBox}>
        <Text style={styles.safetyText}>
          🛡️ Reúnete en un lugar público y concurrido. Revisa el objeto antes de cerrar el trato.
        </Text>
      </View>

      {/* Punto de encuentro */}
      {!isCancelled ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Punto de encuentro</Text>
          {trade.meeting_point ? (
            <View style={styles.meetingCard}>
              <Text style={styles.meetingName}>📍 {trade.meeting_point.name}</Text>
              <Text style={styles.meetingAddress}>{trade.meeting_point.address}</Text>
              <Badge tone="muted" label={trade.meeting_point.district} />
            </View>
          ) : (
            <Text style={styles.meetingEmpty}>Aún no eligen dónde encontrarse.</Text>
          )}
          {isAgreed ? (
            <Button
              title={trade.meeting_point ? 'Cambiar punto seguro' : 'Elegir punto seguro'}
              variant="secondary"
              onPress={() => setPickerOpen(true)}
            />
          ) : null}
        </View>
      ) : null}

      {/* Acciones */}
      {isAgreed ? (
        <View style={styles.actions}>
          {trade.chat ? (
            <Button
              title="Abrir chat 💬"
              variant="secondary"
              onPress={() => router.push(`/chat/${trade.chat!.id}`)}
            />
          ) : null}
          {myConfirmedAt ? (
            <Button title={`Esperando a ${other.display_name}…`} disabled />
          ) : (
            <Button
              title="Confirmar entrega"
              onPress={onConfirm}
              loading={confirmTrade.isPending}
            />
          )}
          <Button
            title="Cancelar trueke"
            variant="ghost"
            onPress={onCancelTrade}
            loading={cancelTrade.isPending}
          />
        </View>
      ) : null}

      {isCompleted ? (
        <View style={styles.completedBox}>
          <Text style={styles.completedTitle}>¡Trueke completado! 🎉</Text>
          <Text style={styles.completedSubtitle}>
            Le diste una segunda vida a un objeto. Gracias por truekear.
          </Text>
          {myRating.isPending ? null : myRating.data ? (
            <Text style={styles.ratedText}>Ya calificaste este trueke ⭐</Text>
          ) : (
            <Button
              title={`Calificar a ${other.display_name} ⭐`}
              onPress={() => router.push(`/calificar/${trade.id}`)}
            />
          )}
        </View>
      ) : null}

      {/* Modal de puntos de encuentro */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Elige un punto seguro</Text>
            <Text style={styles.modalSubtitle}>
              Lugares públicos y concurridos, pensados para truekear tranquilo.
            </Text>
            <ScrollView contentContainerStyle={styles.modalList}>
              {meetingPoints.isPending ? (
                <>
                  <Skeleton style={styles.modalSkeleton} />
                  <Skeleton style={styles.modalSkeleton} />
                </>
              ) : meetingPoints.isError ? (
                <>
                  <Text style={styles.errorText}>
                    Ups, no pudimos cargar los puntos seguros. Inténtalo de nuevo.
                  </Text>
                  <Button
                    title="Reintentar"
                    variant="ghost"
                    onPress={() => meetingPoints.refetch()}
                  />
                </>
              ) : (
                groupedPoints.map(([district, points]) => (
                  <View key={district} style={styles.districtGroup}>
                    <Text style={styles.districtTitle}>{district}</Text>
                    {points.map((point) => (
                      <Pressable
                        key={point.id}
                        accessibilityRole="button"
                        onPress={() => onPickPoint(point)}
                        disabled={setMeetingPoint.isPending}
                        style={({ pressed }) => [
                          styles.pointRow,
                          pressed && { backgroundColor: colors.primaryFaint },
                        ]}
                      >
                        <Text style={styles.pointName}>📍 {point.name}</Text>
                        <Text style={styles.pointAddress}>{point.address}</Text>
                      </Pressable>
                    ))}
                  </View>
                ))
              )}
            </ScrollView>
            <Button title="Cerrar" variant="ghost" onPress={() => setPickerOpen(false)} />
          </View>
        </View>
      </Modal>
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
  itemPhoto: {
    width: '100%',
    height: 100,
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
  },
  giftText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.donation,
    textAlign: 'center',
  },
  centered: {
    alignItems: 'center',
  },
  otherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.card,
  },
  otherName: {
    flex: 1,
    fontFamily: fonts.bodySemi,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
  chevron: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xl,
    color: colors.inkFaint,
  },
  timeline: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
  step: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  stepRail: {
    alignItems: 'center',
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: {
    backgroundColor: colors.primary,
  },
  stepCheck: {
    fontSize: fontSizes.xs,
    color: colors.inkFaint,
    fontFamily: fonts.bodySemi,
  },
  stepCheckDone: {
    color: colors.surface,
  },
  stepLine: {
    flex: 1,
    width: 2,
    minHeight: 18,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  stepLineDone: {
    backgroundColor: colors.primaryLight,
  },
  stepBody: {
    flex: 1,
    paddingBottom: spacing.md,
    gap: 2,
  },
  stepTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
  },
  stepTitleDone: {
    color: colors.ink,
  },
  stepSubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.inkMuted,
  },
  safetyBox: {
    backgroundColor: colors.primaryFaint,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  safetyText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.primary,
    lineHeight: 20,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
  meetingCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadows.card,
  },
  meetingName: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
  meetingAddress: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
  },
  meetingEmpty: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
  },
  actions: {
    gap: spacing.md,
  },
  completedBox: {
    backgroundColor: colors.primaryFaint,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
    ...shadows.card,
  },
  completedTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    color: colors.primary,
    textAlign: 'center',
  },
  completedSubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  ratedText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.success,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.sand,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.sm,
    maxHeight: '80%',
  },
  modalTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    color: colors.ink,
  },
  modalSubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
  },
  modalList: {
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  modalSkeleton: {
    height: 72,
    borderRadius: radius.md,
  },
  districtGroup: {
    gap: spacing.sm,
  },
  districtTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: fontSizes.sm,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pointRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  pointName: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSizes.sm,
    color: colors.ink,
  },
  pointAddress: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.inkMuted,
  },
});
