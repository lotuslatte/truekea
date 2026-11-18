import { Stack, useRouter } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Appear } from '@/components/ui/Appear';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useMarkNotificationsRead, useNotifications } from '@/features/notifications/api';
import { notificationCopy } from '@/features/notifications/copy';
import { timeAgo } from '@/lib/format';
import { colors, fonts, fontSizes, radius, spacing } from '@/theme/tokens';
import type { AppNotification, NotificationType } from '@/types/database';

const ICONS: Partial<Record<NotificationType, IconName>> = {
  new_offer: 'swap',
  offer_countered: 'repeat',
  offer_accepted: 'success',
  offer_rejected: 'rejected',
  new_message: 'chat',
  trade_completed: 'medal',
  trade_cancelled: 'error',
  rating_received: 'star',
  wishlist_match: 'search',
  circle_request: 'people',
  circle_accepted: 'people',
  circle_completed: 'people',
  item_question: 'chat',
  item_answer: 'chat',
  meeting_proposed: 'calendar',
  meeting_accepted: 'calendar',
};

function Row({ row, index, onPress }: { row: AppNotification; index: number; onPress: () => void }) {
  const copy = notificationCopy(row.type, row.payload);
  const unread = row.read_at == null;
  return (
    <Appear delay={Math.min(index, 8) * 30}>
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Sin leer. ' : ''}${copy.title}. ${copy.body}`}
      style={({ pressed }) => [styles.row, unread && styles.rowUnread, pressed && styles.pressed]}
    >
      <View style={[styles.icon, unread && styles.iconUnread]}>
        <Icon name={ICONS[row.type] ?? 'bell'} size={20} color={unread ? colors.primary : colors.inkMuted} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, unread && styles.titleUnread]}>{copy.title}</Text>
        <Text style={styles.text}>{copy.body}</Text>
        <Text style={styles.time}>{timeAgo(row.created_at)}</Text>
      </View>
      {unread ? <View style={styles.dot} /> : null}
    </Pressable>
    </Appear>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const list = useNotifications();
  const markRead = useMarkNotificationsRead();
  const rows = list.data ?? [];
  const hasUnread = rows.some((r) => r.read_at == null);

  const open = (row: AppNotification) => {
    if (row.read_at == null) markRead.mutate(row.id);
    const { url } = notificationCopy(row.type, row.payload);
    if (url !== '/notificaciones' && !url.includes('undefined')) router.push(url as never);
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          headerRight: () =>
            hasUnread ? (
              <Pressable onPress={() => markRead.mutate(undefined)} hitSlop={8} accessibilityRole="button">
                <Text style={styles.markAll}>Marcar todo leído</Text>
              </Pressable>
            ) : null,
        }}
      />
      {list.isPending ? (
        <View style={styles.skeletons}>
          <Skeleton style={styles.skeleton} />
          <Skeleton style={styles.skeleton} />
          <Skeleton style={styles.skeleton} />
        </View>
      ) : list.isError ? (
        <View style={styles.error}>
          <Text style={styles.text}>No pudimos cargar tus notificaciones. Revisa tu conexión e inténtalo de nuevo.</Text>
          <Button title="Reintentar" variant="ghost" onPress={() => list.refetch()} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          renderItem={({ item, index }) => <Row row={item} index={index} onPress={() => open(item)} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={list.isRefetching} onRefresh={() => list.refetch()} tintColor={colors.primary} colors={[colors.primary]} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="bell"
              title="Todavía no hay novedades"
              subtitle="Aquí verás las ofertas que recibes, las respuestas y los avisos de tus deseos."
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  skeletons: { padding: spacing.lg, gap: spacing.sm },
  skeleton: { height: 76, borderRadius: radius.lg },
  error: { padding: spacing.xl, gap: spacing.md, alignItems: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowUnread: { borderColor: colors.primaryLight },
  pressed: { opacity: 0.85 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sand },
  iconUnread: { backgroundColor: colors.primaryFaint },
  body: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.md, color: colors.ink },
  titleUnread: { fontFamily: fonts.bodySemi },
  text: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.inkMuted, lineHeight: 20 },
  time: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.inkFaint, marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginTop: 6 },
  markAll: { fontFamily: fonts.bodySemi, fontSize: fontSizes.sm, color: colors.primary },
});
