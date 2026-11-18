import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Thumb } from '@/components/Thumb';
import { Icon } from '@/components/ui/Icon';
import { IconText } from '@/components/ui/IconText';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ChakanaSpinner } from '@/components/ui/ChakanaSpinner';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { RatingStars } from '@/components/ui/RatingStars';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/features/auth/AuthProvider';
import { AyniBadge } from '@/features/ayni/AyniBadge';
import { getCo2SavedKg, getProfileBadges } from '@/features/ayni/badges';
import { useProfileStats } from '@/features/ayni/useProfileStats';
import { useCircleOccupancy, useHostCircles, type HostCircle } from '@/features/circles/api';
import { useBlockUser, useIsBlocked, useReport, useUnblockUser } from '@/features/moderation/api';
import { useUserRatings } from '@/features/ratings/api';
import { confirmAction, notify } from '@/lib/confirm';
import { timeAgo } from '@/lib/format';
import { publicPhotoUrl, supabase } from '@/lib/supabase';
import { colors, fonts, fontSizes, radius, spacing } from '@/theme/tokens';
import type { Item, ItemPhoto, Profile, ReportReason } from '@/types/database';

type ItemWithPhotos = Item & { item_photos: ItemPhoto[] };

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'prohibido', label: 'Publica algo prohibido' },
  { value: 'estafa', label: 'Estafa o engaño' },
  { value: 'ofensivo', label: 'Comportamiento ofensivo' },
  { value: 'spam', label: 'Spam' },
  { value: 'otro', label: 'Otro' },
];

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const uid = session?.user.id ?? '';
  const isMe = id === uid;

  const profileQuery = useQuery({
    queryKey: ['profile', id],
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const itemsQuery = useQuery({
    queryKey: ['userItems', id],
    queryFn: async (): Promise<ItemWithPhotos[]> => {
      const { data, error } = await supabase
        .from('items')
        .select('*, item_photos(*)')
        .eq('owner_id', id)
        .eq('status', 'available')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ItemWithPhotos[];
    },
    enabled: !!id,
  });

  const ratingsQuery = useUserRatings(id ?? '');
  const statsQuery = useProfileStats(id ?? '');

  const profile = profileQuery.data;

  if (profileQuery.isPending) {
    return (
      <View style={styles.loading}>
        <ChakanaSpinner label="Cargando perfil…" />
      </View>
    );
  }

  if (profileQuery.isError || !profile) {
    return (
      <EmptyState
        emoji="😕"
        title="No encontramos este perfil"
        subtitle="Puede que la cuenta ya no exista."
        actionTitle="Volver"
        onAction={() => router.back()}
      />
    );
  }

  const profileBadges = getProfileBadges(profile, statsQuery.data ?? null);
  // Los círculos tienen su propia vitrina más arriba: aquí solo lo demás.
  const publicaciones = (itemsQuery.data ?? []).filter((item) => item.format !== 'circle');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Avatar url={profile.avatar_url} name={profile.display_name} size={72} />
        <Text style={styles.name}>{profile.display_name}</Text>
        <Text style={styles.username}>@{profile.username}</Text>
        {profile.district ? <IconText icon="location" style={styles.district}>{profile.district}</IconText> : null}
        <View style={styles.badges}>
          {profile.phone_verified ? <Badge icon="phone" label="Teléfono verificado" tone="success" /> : null}
          <AyniBadge
            tradesCompleted={profile.trades_completed}
            circlesHosted={profile.circles_hosted}
          />
        </View>
        {profileBadges.length > 0 ? (
          <View style={styles.badges}>
            {profileBadges.map((badge) => (
              <Badge key={badge.key} label={`${badge.emoji} ${badge.label}`} tone="gold" />
            ))}
          </View>
        ) : null}
        <View style={styles.statsRow}>
          <View style={styles.statTile}>
            <IconText icon="repeat" style={styles.statValue}>{profile.trades_completed}</IconText>
            <Text style={styles.statLabel}>truekes</Text>
          </View>
          <View style={styles.statTile}>
            <IconText icon="people" style={styles.statValue}>{profile.circles_hosted}</IconText>
            <Text style={styles.statLabel}>círculos</Text>
          </View>
          <View style={styles.statTile}>
            <IconText icon="gift" style={styles.statValue}>{profile.donations_given}</IconText>
            <Text style={styles.statLabel}>regalos</Text>
          </View>
          <View style={styles.statTile}>
            <IconText icon="planet" style={styles.statValue}>{getCo2SavedKg(profile)}</IconText>
            <Text style={styles.statLabel}>kg CO₂ evitados</Text>
          </View>
        </View>
        <RatingStars value={profile.rating_avg ?? 0} count={profile.rating_count} size={16} />
        {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
      </View>

      {id ? <HostCirclesShowcase userId={id} circlesHosted={profile.circles_hosted} /> : null}

      <Text style={styles.sectionTitle}>Sus publicaciones</Text>
      {itemsQuery.isPending ? (
        <Skeleton style={{ height: 64, borderRadius: radius.md }} />
      ) : publicaciones.length === 0 ? (
        <Text style={styles.emptyText}>Por ahora no tiene nada publicado.</Text>
      ) : (
        <View style={styles.list}>
          {publicaciones.map((item) => {
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                style={({ pressed }) => [styles.itemRow, pressed ? styles.rowPressed : null]}
                onPress={() => router.push(`/item/${item.id}` as never)}
              >
                <Thumb item={item} style={styles.thumb} />
                <View style={styles.itemInfo}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.itemValue}>
                    {item.is_donation ? 'Regalo' : item.kind === 'knowledge' ? 'Saber' : 'Objeto'}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      <Text style={styles.sectionTitle}>Calificaciones</Text>
      {ratingsQuery.isPending ? (
        <Skeleton style={{ height: 64, borderRadius: radius.md }} />
      ) : (ratingsQuery.data ?? []).length === 0 ? (
        <EmptyState
          emoji="⭐"
          title="Aún sin calificaciones"
          subtitle="Cuando complete truekes, aquí verás lo que opina la comunidad."
        />
      ) : (
        <View style={styles.list}>
          {(ratingsQuery.data ?? []).map((rating) => (
            <View key={rating.id} style={styles.ratingRow}>
              <Avatar url={rating.rater.avatar_url} name={rating.rater.display_name} size={40} />
              <View style={styles.ratingBody}>
                <View style={styles.ratingHeader}>
                  <Text style={styles.raterName} numberOfLines={1}>
                    {rating.rater.display_name}
                  </Text>
                  <Text style={styles.ratingTime}>{timeAgo(rating.created_at)}</Text>
                </View>
                <RatingStars value={rating.stars} />
                {rating.comment ? <Text style={styles.ratingComment}>{rating.comment}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      )}

      {!isMe && id && uid ? <ModerationActions otherId={id} otherName={profile.display_name} /> : null}
    </ScrollView>
  );
}

// "sáb 12 jul · 4pm": fecha corta y cálida para las tarjetas de círculos.
function formatCircleDate(iso: string): string {
  const date = new Date(iso);
  const day = format(date, 'EEE d MMM', { locale: es }).replace(/\./g, '');
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const suffix = hours >= 12 ? 'pm' : 'am';
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  const time = minutes === 0 ? `${h12}${suffix}` : `${h12}:${String(minutes).padStart(2, '0')}${suffix}`;
  return `${day} · ${time}`;
}

// Próximos = con fecha futura y aún abiertos (available/reserved); lo demás
// ya se realizó o se retiró. (Helper a nivel de módulo para no leer el reloj
// directamente durante el render.)
function upcomingHostCircles(circles: HostCircle[]): HostCircle[] {
  const now = Date.now();
  return circles.filter(
    (circle) =>
      circle.event_at != null &&
      new Date(circle.event_at).getTime() > now &&
      (circle.status === 'available' || circle.status === 'reserved'),
  );
}

// Vitrina de anfitrión: su historial de círculos dictados y los que vienen.
// Solo aparece si hay algo que mostrar (historial o círculos programados).
function HostCirclesShowcase({ userId, circlesHosted }: { userId: string; circlesHosted: number }) {
  const circlesQuery = useHostCircles(userId);

  const upcoming = useMemo(() => upcomingHostCircles(circlesQuery.data ?? []), [circlesQuery.data]);

  if (circlesHosted <= 0 && upcoming.length === 0) return null;

  return (
    <>
      <Text style={styles.sectionTitle}>Sus círculos</Text>
      {circlesHosted > 0 ? (
        <IconText icon="people" style={styles.circlesHistory}>
          {circlesHosted} {circlesHosted === 1 ? 'círculo dictado' : 'círculos dictados'}
        </IconText>
      ) : null}
      {upcoming.length === 0 ? (
        <Text style={styles.emptyText}>Por ahora no tiene círculos programados.</Text>
      ) : (
        <View style={styles.list}>
          {upcoming.map((circle) => (
            <HostCircleCard key={circle.id} circle={circle} />
          ))}
        </View>
      )}
    </>
  );
}

function HostCircleCard({ circle }: { circle: HostCircle }) {
  const occupancy = useCircleOccupancy(circle.id);
  const photo = [...circle.item_photos].sort((a, b) => a.position - b.position)[0];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Círculo: ${circle.title}`}
      style={({ pressed }) => [styles.circleRow, pressed ? styles.rowPressed : null]}
      onPress={() => router.push(`/item/${circle.id}` as never)}
    >
      {photo ? (
        <Image source={{ uri: publicPhotoUrl(photo.storage_path) }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <Icon name="people" size={20} color={colors.accentInk} />
        </View>
      )}
      <View style={styles.itemInfo}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {circle.title}
        </Text>
        {circle.event_at ? (
          <IconText icon="calendar" style={styles.circleDate}>{formatCircleDate(circle.event_at)}</IconText>
        ) : null}
        {circle.capacity != null ? (
          <IconText icon="seats" style={styles.circleSeats}>
            {occupancy.data ?? 0}/{circle.capacity} cupos
          </IconText>
        ) : null}
      </View>
    </Pressable>
  );
}

function ModerationActions({ otherId, otherName }: { otherId: string; otherName: string }) {
  const isBlockedQuery = useIsBlocked(otherId);
  const blockUser = useBlockUser();
  const unblockUser = useUnblockUser();
  const report = useReport();

  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');

  const blocked = isBlockedQuery.data === true;

  const toggleBlock = () => {
    if (blocked) {
      confirmAction({
        title: `¿Desbloquear a ${otherName}?`,
        message: 'Volverán a verse mutuamente en la app.',
        confirmLabel: 'Desbloquear',
        onConfirm: () => {
          unblockUser.mutate(otherId, {
            onSuccess: () => notify('Listo', `Desbloqueaste a ${otherName}.`),
          });
        },
      });
    } else {
      confirmAction({
        title: `¿Bloquear a ${otherName}?`,
        message:
          'Dejarán de verse mutuamente: no verás sus publicaciones ni podrán escribirse. Puedes desbloquear cuando quieras desde Ajustes.',
        confirmLabel: 'Bloquear',
        destructive: true,
        onConfirm: () => {
          blockUser.mutate(otherId, {
            onSuccess: () => notify('Usuario bloqueado', 'Ya no se verán mutuamente en Truekea.'),
          });
        },
      });
    }
  };

  const sendReport = () => {
    if (!reason) return;
    report.mutate(
      { targetType: 'user', targetId: otherId, reason, details },
      {
        onSuccess: () => {
          setReportOpen(false);
          setReason(null);
          setDetails('');
          notify('Gracias por avisarnos', 'Revisaremos este perfil para cuidar a la comunidad.');
        },
        onError: () => notify('Ups', 'No pudimos enviar tu reporte. Inténtalo de nuevo.'),
      },
    );
  };

  return (
    <View style={styles.moderation}>
      <Pressable accessibilityRole="button" onPress={toggleBlock} hitSlop={8}>
        <Text style={styles.moderationLink}>
          {blocked ? 'Desbloquear usuario' : 'Bloquear usuario'}
        </Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => setReportOpen(true)} hitSlop={8}>
        <Text style={styles.moderationLink}>Reportar usuario</Text>
      </Pressable>

      <Modal
        visible={reportOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setReportOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reportar a {otherName}</Text>
            <Text style={styles.modalSubtitle}>¿Qué pasó? Tu reporte es confidencial.</Text>
            <View style={styles.reasonChips}>
              {REPORT_REASONS.map((r) => (
                <Chip
                  key={r.value}
                  label={r.label}
                  selected={reason === r.value}
                  onPress={() => setReason(r.value)}
                />
              ))}
            </View>
            <TextField
              placeholder="Cuéntanos más (opcional)"
              value={details}
              onChangeText={setDetails}
              multiline
              maxLength={1000}
              style={styles.detailsInput}
            />
            <Button
              title="Enviar reporte"
              onPress={sendReport}
              disabled={!reason}
              loading={report.isPending}
            />
            <Button title="Cancelar" variant="ghost" onPress={() => setReportOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    gap: spacing.lg,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  header: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  name: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    color: colors.ink,
    marginTop: spacing.sm,
  },
  username: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
  },
  district: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginVertical: spacing.sm,
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  statTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
  statLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  bio: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.ink,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  sectionTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: fontSizes.lg,
    color: colors.ink,
    marginTop: spacing.lg,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
  },
  list: {
    gap: spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  rowPressed: {
    opacity: 0.8,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
  },
  thumbFallback: {
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
  itemValue: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
  },
  circlesHistory: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSizes.sm,
    color: colors.goldInk,
  },
  circleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.festiveFaint,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.festive,
    padding: spacing.sm,
  },
  circleDate: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSizes.xs,
    color: colors.festiveInk,
  },
  circleSeats: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    color: colors.inkMuted,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  ratingBody: {
    flex: 1,
    gap: spacing.xs,
  },
  ratingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  raterName: {
    flex: 1,
    fontFamily: fonts.bodySemi,
    fontSize: fontSizes.sm,
    color: colors.ink,
  },
  ratingTime: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.inkFaint,
  },
  ratingComment: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.ink,
    lineHeight: 20,
  },
  moderation: {
    marginTop: spacing.xl,
    gap: spacing.lg,
    alignItems: 'center',
  },
  moderationLink: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.danger,
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
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
  reasonChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  detailsInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
