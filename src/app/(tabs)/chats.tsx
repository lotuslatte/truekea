import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/features/auth/AuthProvider';
import { useMyChats } from '@/features/chat/api';
import { timeAgo } from '@/lib/format';
import { colors, fonts, fontSizes, radius, spacing } from '@/theme/tokens';
import type { MyChatRow } from '@/types/database';

function ChatRow({ chat, uid, onPress }: { chat: MyChatRow; uid: string; onPress: () => void }) {
  // Para círculos, other_* trae al anfitrión y owner_item_title el título del círculo.
  const isMyCircle = chat.is_circle && chat.other_id === uid;
  const title = chat.is_circle ? chat.owner_item_title : chat.other_display_name;
  const exchange = `«${chat.owner_item_title}» ↔ «${chat.offerer_item_title ?? '🎁 regalo'}»`;
  const preview = chat.last_message
    ? chat.last_sender_id === uid
      ? `Tú: ${chat.last_message}`
      : chat.last_message
    : 'Todavía no hay mensajes — ¡saluda! 👋';
  const hasUnread = chat.unread_count > 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        chat.is_circle ? `Chat del círculo ${chat.owner_item_title}` : `Chat con ${chat.other_display_name}`
      }
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Avatar url={chat.other_avatar_url} name={chat.other_display_name} size={48} />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.name} numberOfLines={1}>
            {title}
          </Text>
          {chat.last_message_at ? (
            <Text style={styles.time}>{timeAgo(chat.last_message_at)}</Text>
          ) : null}
        </View>
        {chat.is_circle ? (
          <View style={styles.circleLine}>
            <Badge label="⭕ Círculo" tone="accent" />
            <Text style={styles.circleHost} numberOfLines={1}>
              {isMyCircle ? 'Tu círculo' : `Anfitrión: ${chat.other_display_name}`}
            </Text>
          </View>
        ) : (
          <Text style={styles.exchange} numberOfLines={1}>
            {exchange}
          </Text>
        )}
        <View style={styles.rowBottom}>
          <Text style={[styles.preview, hasUnread && styles.previewUnread]} numberOfLines={1}>
            {preview}
          </Text>
          {chat.trade_status === 'completed' ? (
            <Badge label="Completado" tone="success" />
          ) : chat.trade_status === 'cancelled' ? (
            <Badge label="Cancelado" tone="muted" />
          ) : null}
          {hasUnread ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>
                {chat.unread_count > 99 ? '99+' : chat.unread_count}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function ChatsSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.row}>
          <Skeleton style={styles.skeletonAvatar} />
          <View style={styles.skeletonLines}>
            <Skeleton style={styles.skeletonLineWide} />
            <Skeleton style={styles.skeletonLineNarrow} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function ChatsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const uid = session?.user.id ?? '';
  const { data: chats, isPending, isError, refetch } = useMyChats();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  if (isPending) return <ChatsSkeleton />;

  if (isError) {
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorText}>
          Ups, no pudimos cargar tus chats. Revisa tu conexión e inténtalo de nuevo.
        </Text>
        <Button title="Reintentar" variant="ghost" onPress={() => refetch()} />
      </View>
    );
  }

  return (
    <FlatList
      data={chats ?? []}
      keyExtractor={(chat) => chat.chat_id}
      renderItem={({ item }) => (
        <ChatRow chat={item} uid={uid} onPress={() => router.push(`/chat/${item.chat_id}`)} />
      )}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <EmptyState
            emoji="💬"
            title="Aún no tienes chats"
            subtitle="Cuando aceptes o te acepten una oferta, el chat aparece aquí"
          />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flexGrow: 1,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPressed: {
    backgroundColor: colors.primaryFaint,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: {
    flex: 1,
    fontFamily: fonts.bodySemi,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
  time: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.inkFaint,
  },
  exchange: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    color: colors.primary,
  },
  circleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  circleHost: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    color: colors.inkMuted,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  preview: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
  },
  previewUnread: {
    fontFamily: fonts.bodySemi,
    color: colors.ink,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: radius.full,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSizes.xs,
    color: colors.surface,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
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
  skeletonWrap: {
    paddingVertical: spacing.sm,
  },
  skeletonAvatar: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
  },
  skeletonLines: {
    flex: 1,
    gap: spacing.sm,
  },
  skeletonLineWide: {
    height: 14,
    width: '70%',
  },
  skeletonLineNarrow: {
    height: 12,
    width: '45%',
  },
});
