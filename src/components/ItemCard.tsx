import { format as formatDate, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { RatingStars } from '@/components/ui/RatingStars';
import { useRequireAuth } from '@/features/auth/useRequireAuth';
import { useCategories } from '@/features/categories';
import { useSavedIds, useToggleSaved } from '@/features/saved/api';
import { formatDistance } from '@/lib/format';
import { publicPhotoUrl } from '@/lib/supabase';
import { colors, fonts, fontSizes, radius, shadows, spacing } from '@/theme/tokens';
import type { FeedItemRow, ItemCondition } from '@/types/database';

const CONDITION_LABELS: Record<ItemCondition, string> = {
  new: 'Nuevo',
  like_new: 'Como nuevo',
  used: 'Con uso',
  for_repair: 'Para reparar',
};

// "sáb 12 jul · 4pm" — día corto con date-fns (locale es) y hora estilo 4pm.
function formatEventShort(iso: string): string {
  const date = new Date(iso);
  const day = formatDate(date, 'EEE d MMM', { locale: es }).replace(/\./g, '');
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const suffix = hours < 12 ? 'am' : 'pm';
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  const time = minutes === 0 ? `${h12}${suffix}` : `${h12}:${String(minutes).padStart(2, '0')}${suffix}`;
  return `${day} · ${time}`;
}

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

// Regalos perecibles: "⏰ Hasta las 19:30" si vence hoy, "⏰ mié 15 · 9:00"
// si no. Devuelve null si ya venció (el feed igual los excluye, pero la
// caché puede servir alguno recién vencido).
function pickupBadge(iso: string): { label: string; urgent: boolean } | null {
  const until = new Date(iso);
  const remaining = until.getTime() - Date.now();
  if (remaining <= 0) return null;
  const time = formatDate(until, 'H:mm');
  const label = isToday(until)
    ? `⏰ Hasta las ${time}`
    : `⏰ ${formatDate(until, 'eee d', { locale: es }).replace(/\./g, '')} · ${time}`;
  return { label, urgent: remaining < THREE_HOURS_MS };
}

// Tarjeta compacta para el grid de 2+ columnas del feed. No define ancho:
// el grid (FlashList numColumns) decide; la celda solo hace flex: 1.
export function ItemCard({ item }: { item: FeedItemRow }) {
  const router = useRouter();
  const { requireAuth } = useRequireAuth();
  const { isSaved } = useSavedIds();
  const toggleSaved = useToggleSaved();
  const saved = isSaved(item.id);
  const isKnowledge = item.kind === 'knowledge';
  const isCircle = isKnowledge && item.format === 'circle';
  const isVirtual = isKnowledge && item.modality === 'virtual';
  const pickup = item.pickup_until ? pickupBadge(item.pickup_until) : null;

  // Ilustración temática para publicaciones sin foto: el icono de su
  // categoría en grande sobre un fondo tintado según el tipo. La query de
  // categorías es una sola compartida (staleTime Infinity), no una por card.
  const { data: categories } = useCategories();
  const categoryIcon =
    categories?.find((c) => c.id === item.category_id)?.icon ?? (isKnowledge ? '🎓' : '📦');

  return (
    <View style={styles.card}>
      {/* La tarjeta navega; el corazón es un botón HERMANO superpuesto
          (nunca anidado: en web dos <button> anidados son inválidos). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.title}
        onPress={() => router.push(`/item/${item.id}`)}
        style={({ pressed }) => (pressed ? styles.pressed : null)}
      >
      <View style={styles.imageWrapper}>
        {item.photo_path ? (
          <Image
            source={{ uri: publicPhotoUrl(item.photo_path) }}
            style={styles.image}
            contentFit="cover"
            transition={200}
            accessibilityLabel={`Foto de ${item.title}`}
          />
        ) : (
          <View
            style={[
              styles.image,
              styles.themedPlaceholder,
              isCircle
                ? styles.placeholderCircle
                : isKnowledge
                  ? styles.placeholderKnowledge
                  : styles.placeholderObject,
            ]}
          >
            <Text style={styles.placeholderIcon}>{categoryIcon}</Text>
          </View>
        )}
        <View style={styles.badgeStack}>
          {pickup ? (
            <Badge label={pickup.label} tone={pickup.urgent ? 'danger' : 'accent'} />
          ) : null}
          {isKnowledge ? (
            <Badge label={isCircle ? '⭕ Círculo' : '🧠 Saber'} tone="accent" />
          ) : null}
          {item.is_donation ? <Badge label="🎁 Regalo" tone="donation" /> : null}
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        {isCircle ? (
          <View style={styles.circleRow}>
            {item.event_at ? (
              <Text style={styles.circleMeta}>📅 {formatEventShort(item.event_at)}</Text>
            ) : null}
            {item.capacity != null ? (
              <Text style={styles.circleMeta}>
                🪑 {item.accepted_count}/{item.capacity} cupos
              </Text>
            ) : null}
          </View>
        ) : null}
        <Text style={styles.location} numberOfLines={1}>
          {isVirtual
            ? '💻 Virtual'
            : `📍 ${formatDistance(item.distance_km)}${
                !isKnowledge && item.condition ? ` · ${CONDITION_LABELS[item.condition]}` : ''
              }`}
        </Text>

        <View style={styles.ownerRow}>
          <Avatar url={item.owner_avatar_url} name={item.owner_display_name} size={18} />
          <Text style={styles.ownerName} numberOfLines={1}>
            {item.owner_display_name}
          </Text>
          {item.owner_rating_count > 0 ? (
            <RatingStars value={item.owner_rating_avg ?? 0} size={9} />
          ) : null}
        </View>
      </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={saved ? 'Quitar de guardados' : 'Guardar'}
        accessibilityState={{ selected: saved }}
        hitSlop={12}
        onPress={() => requireAuth(() => toggleSaved.mutate({ itemId: item.id, saved }))}
        style={({ pressed }) => [styles.heartButton, pressed && styles.heartPressed]}
      >
        <View style={styles.heartBackdrop} />
        <Text style={[styles.heartIcon, saved && styles.heartIconSaved]}>
          {saved ? '♥' : '♡'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    ...shadows.card,
  },
  pressed: {
    opacity: 0.9,
  },
  imageWrapper: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    aspectRatio: 1,
  },
  themedPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderKnowledge: {
    backgroundColor: colors.primaryFaint,
  },
  placeholderObject: {
    backgroundColor: colors.goldFaint,
  },
  placeholderCircle: {
    backgroundColor: colors.festiveFaint,
  },
  placeholderIcon: {
    fontSize: 48,
  },
  badgeStack: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  heartButton: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 30,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heartPressed: {
    transform: [{ scale: 0.92 }],
  },
  // Fondo semitransparente aparte para que el glifo del corazón quede opaco.
  heartBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    opacity: 0.85,
    borderRadius: radius.full,
  },
  heartIcon: {
    fontSize: 16,
    lineHeight: 19,
    color: colors.inkMuted,
  },
  heartIconSaved: {
    color: colors.festiveInk,
  },
  body: {
    padding: spacing.sm,
    gap: spacing.xs,
  },
  title: {
    fontFamily: fonts.bodySemi,
    fontSize: 13.5,
    lineHeight: 18,
    color: colors.ink,
  },
  location: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.inkMuted,
  },
  circleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.sm,
    rowGap: 2,
  },
  circleMeta: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    color: colors.accentInk,
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ownerName: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    color: colors.inkMuted,
    flexShrink: 1,
  },
});
