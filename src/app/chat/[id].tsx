import Ionicons from '@expo/vector-icons/Ionicons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  chatImageUrl,
  useChatInfo,
  useChatRealtime,
  useMarkChatRead,
  useMessages,
  useSendImage,
  useSendMessage,
  type MessageWithSender,
} from '@/features/chat/api';
import { notify } from '@/lib/confirm';
import { colors, fonts, fontSizes, radius, spacing } from '@/theme/tokens';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chatId = String(id);
  const router = useRouter();
  const { session } = useAuth();
  const uid = session?.user.id ?? '';

  const { data: chatInfo } = useChatInfo(chatId);
  const messagesQuery = useMessages(chatId);
  const sendMessage = useSendMessage(chatId);
  const sendImage = useSendImage(chatId);
  const { mutate: markRead } = useMarkChatRead(chatId);
  useChatRealtime(chatId);

  useEffect(() => {
    markRead();
  }, [markRead]);

  const [text, setText] = useState('');
  const [viewerPath, setViewerPath] = useState<string | null>(null);

  const trade = chatInfo?.trade ?? null;
  const circle = chatInfo?.circle ?? null;
  const isCircle = chatInfo?.isCircle ?? false;
  const other = trade ? (trade.owner_id === uid ? trade.offerer : trade.owner) : null;
  const circleClosed = circle != null && (circle.status === 'traded' || circle.status === 'removed');
  const readOnly = (trade != null && trade.status !== 'agreed') || circleClosed;
  const messages = messagesQuery.data ?? [];
  const showSafetyBanner = messagesQuery.isSuccess && messages.length === 0 && !readOnly;

  const handleSend = () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    sendMessage.mutate(body, {
      // A failed message goes back to the input so nothing typed is lost.
      onError: () => {
        setText((current) => (current.trim() ? current : body));
        notify('No se pudo enviar el mensaje', 'Revisa tu conexión. Tu texto sigue en el cuadro.');
      },
    });
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled) return;
    const uri = result.assets[0]?.uri;
    if (!uri) return;
    sendImage.mutate({ uri });
  };

  const renderItem = ({ item, index }: { item: MessageWithSender; index: number }) => {
    const mine = item.sender_id === uid;
    // Lista invertida: el vecino cronológicamente anterior está en index + 1.
    const older = messages[index + 1];
    const grouped = older?.sender_id === item.sender_id;
    const pending = item.id.startsWith('temp-');
    // En chats grupales, los mensajes ajenos muestran quién habla.
    const showSender = isCircle && !mine;
    const imagePath = item.image_path;

    return (
      <View
        style={[
          styles.messageRow,
          mine ? styles.messageRowMine : styles.messageRowTheirs,
          grouped ? styles.messageGrouped : styles.messageSpaced,
        ]}
      >
        {showSender ? (
          <View style={styles.senderAvatar}>
            {!grouped ? (
              <Avatar
                url={item.sender?.avatar_url ?? null}
                name={item.sender?.display_name ?? '?'}
                size={20}
              />
            ) : null}
          </View>
        ) : null}
        <View style={styles.bubbleColumn}>
          {showSender && !grouped ? (
            <Text style={styles.senderName} numberOfLines={1}>
              {item.sender?.display_name ?? 'Truekero'}
            </Text>
          ) : null}
          <View
            style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs, pending && styles.bubblePending]}
          >
            {imagePath ? (
              <Pressable
                accessibilityRole="imagebutton"
                accessibilityLabel="Ver foto completa"
                onPress={() => setViewerPath(imagePath)}
              >
                <Image
                  source={{ uri: chatImageUrl(imagePath) }}
                  style={styles.bubbleImage}
                  contentFit="cover"
                  transition={150}
                />
              </Pressable>
            ) : null}
            {item.body ? (
              <Text
                style={[
                  mine ? styles.bodyMine : styles.bodyTheirs,
                  imagePath != null && styles.bodyUnderImage,
                ]}
              >
                {item.body}
              </Text>
            ) : null}
            <Text style={mine ? styles.timeMine : styles.timeTheirs}>
              {formatTime(item.created_at)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        {circle ? (
          <>
            <Avatar
              url={circle.owner?.avatar_url ?? null}
              name={circle.owner?.display_name ?? '?'}
              size={40}
            />
            <View style={styles.headerBody}>
              <Text style={styles.headerName} numberOfLines={1}>
                {circle.title}
              </Text>
              <Text style={styles.headerMeta} numberOfLines={1}>
                ⭕ Círculo
                {circle.event_at
                  ? ` · ${format(new Date(circle.event_at), "d MMM, HH:mm 'h'", { locale: es })}`
                  : ''}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ver círculo"
              onPress={() => router.push(`/item/${circle.id}`)}
              style={({ pressed }) => [styles.headerLink, pressed && styles.headerLinkPressed]}
            >
              <Text style={styles.headerLinkText}>Ver círculo →</Text>
            </Pressable>
          </>
        ) : other ? (
          <>
            <Avatar url={other.avatar_url} name={other.display_name} size={40} />
            <View style={styles.headerBody}>
              <Text style={styles.headerName} numberOfLines={1}>
                {other.display_name}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ver trueke"
              onPress={() => router.push(`/trueke/${trade!.id}`)}
              style={({ pressed }) => [styles.headerLink, pressed && styles.headerLinkPressed]}
            >
              <Text style={styles.headerLinkText}>Ver trueke →</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Skeleton style={styles.headerSkeletonAvatar} />
            <Skeleton style={styles.headerSkeletonLine} />
          </>
        )}
      </View>

      {messagesQuery.isError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            Ups, no pudimos cargar los mensajes. Revisa tu conexión e inténtalo de nuevo.
          </Text>
          <Button title="Reintentar" variant="ghost" onPress={() => messagesQuery.refetch()} />
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          inverted
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {showSafetyBanner ? (
        <View style={styles.safetyBanner}>
          <Text style={styles.safetyText}>
            🛡️ Coordina en un punto de encuentro seguro. Nunca envíes dinero por adelantado.
          </Text>
        </View>
      ) : null}

      {readOnly ? (
        <View style={styles.closedNotice}>
          <Text style={styles.closedText}>
            {circleClosed
              ? 'Este círculo ya se realizó 🌱'
              : 'Este trueke finalizó — el chat quedó de solo lectura 🌱'}
          </Text>
        </View>
      ) : (
        <View style={styles.inputRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enviar una foto"
            onPress={handlePickImage}
            disabled={sendImage.isPending}
            style={({ pressed }) => [styles.photoButton, pressed && styles.sendButtonDim]}
          >
            {sendImage.isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="image-outline" size={24} color={colors.primary} />
            )}
          </Pressable>
          <View style={styles.inputWrap}>
            <TextField
              value={text}
              onChangeText={setText}
              placeholder="Escribe un mensaje…"
              accessibilityLabel="Escribe un mensaje"
              multiline
              style={styles.input}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enviar mensaje"
            onPress={handleSend}
            disabled={!text.trim()}
            style={({ pressed }) => [
              styles.sendButton,
              (!text.trim() || pressed) && styles.sendButtonDim,
            ]}
          >
            <Ionicons name="send" size={20} color={colors.surface} />
          </Pressable>
        </View>
      )}

      <Modal
        visible={viewerPath != null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerPath(null)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar foto"
          style={styles.viewerBackdrop}
          onPress={() => setViewerPath(null)}
        >
          {viewerPath ? (
            <Image
              source={{ uri: chatImageUrl(viewerPath) }}
              style={styles.viewerImage}
              contentFit="contain"
            />
          ) : null}
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.sand,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerBody: {
    flex: 1,
  },
  headerName: {
    fontFamily: fonts.headingSemi,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
  headerMeta: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    color: colors.inkMuted,
    marginTop: 1,
  },
  headerLink: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  headerLinkPressed: {
    opacity: 0.6,
  },
  headerLinkText: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSizes.sm,
    color: colors.primary,
  },
  headerSkeletonAvatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
  },
  headerSkeletonLine: {
    height: 16,
    width: 140,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
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
  messageRow: {
    flexDirection: 'row',
  },
  messageRowMine: {
    justifyContent: 'flex-end',
  },
  messageRowTheirs: {
    justifyContent: 'flex-start',
  },
  // Lista invertida: marginBottom se ve arriba (hacia el mensaje más antiguo).
  messageSpaced: {
    marginBottom: spacing.md,
  },
  messageGrouped: {
    marginBottom: 2,
  },
  senderAvatar: {
    width: 20,
    marginRight: spacing.xs,
    alignSelf: 'flex-end',
    marginBottom: 4,
  },
  senderName: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    color: colors.inkMuted,
    marginBottom: 2,
    marginLeft: spacing.sm,
  },
  bubbleColumn: {
    maxWidth: '78%',
  },
  bubble: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
  },
  bubblePending: {
    opacity: 0.6,
  },
  bubbleImage: {
    width: 200,
    height: 200,
    borderRadius: radius.md,
    backgroundColor: colors.border,
  },
  bodyUnderImage: {
    marginTop: spacing.xs,
    maxWidth: 200,
  },
  bodyMine: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    lineHeight: 21,
    color: colors.surface,
  },
  bodyTheirs: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    lineHeight: 21,
    color: colors.ink,
  },
  timeMine: {
    alignSelf: 'flex-end',
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.surface,
    opacity: 0.75,
  },
  timeTheirs: {
    alignSelf: 'flex-end',
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.inkMuted,
  },
  safetyBanner: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primaryFaint,
  },
  safetyText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    lineHeight: 20,
    color: colors.primary,
    textAlign: 'center',
  },
  closedNotice: {
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  closedText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  inputWrap: {
    flex: 1,
  },
  input: {
    maxHeight: 110,
    borderRadius: radius.xl,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDim: {
    opacity: 0.5,
  },
  photoButton: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryFaint,
  },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  viewerImage: {
    width: '100%',
    height: '100%',
  },
});
