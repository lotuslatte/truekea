import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { useEffect } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import type { ItemStatus, Message, MyChatRow, Profile, Trade } from '@/types/database';

export type ChatTrade = Trade & {
  owner: Profile | null;
  offerer: Profile | null;
  owner_item: { title: string } | null;
  offerer_item: { title: string } | null;
};

/** Círculo del chat grupal: el item de saber que lo origina, con su anfitrión. */
export type ChatCircle = {
  id: string;
  title: string;
  owner_id: string;
  event_at: string | null;
  status: ItemStatus;
  owner: Profile | null;
};

export type ChatInfo = {
  id: string;
  trade_id: string | null;
  circle_item_id: string | null;
  created_at: string;
  /** Discriminante: true si es el chat grupal de un círculo. */
  isCircle: boolean;
  trade: ChatTrade | null;
  circle: ChatCircle | null;
};

/** PostgREST puede devolver relaciones embebidas como objeto o como array de 1. */
function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function useMyChats(enabled = true) {
  return useQuery({
    queryKey: ['chats'],
    enabled,
    queryFn: async (): Promise<MyChatRow[]> => {
      const { data, error } = await supabase.rpc('my_chats');
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30_000,
  });
}

type RawRel<T> = T | T[] | null;

type RawChatInfo = {
  id: string;
  trade_id: string | null;
  circle_item_id: string | null;
  created_at: string;
  trade: RawRel<
    Trade & {
      owner: RawRel<Profile>;
      offerer: RawRel<Profile>;
      owner_item: RawRel<{ title: string }>;
      offerer_item: RawRel<{ title: string }>;
    }
  >;
  circle_item: RawRel<Omit<ChatCircle, 'owner'> & { owner: RawRel<Profile> }>;
};

export function useChatInfo(chatId: string) {
  return useQuery({
    queryKey: ['chatInfo', chatId],
    queryFn: async (): Promise<ChatInfo> => {
      const { data, error } = await supabase
        .from('chats')
        .select(
          '*, trade:trades(*, owner:profiles!trades_owner_id_fkey(*), offerer:profiles!trades_offerer_id_fkey(*), owner_item:items!trades_owner_item_id_fkey(title), offerer_item:items!trades_offerer_item_id_fkey(title)), circle_item:items!chats_circle_item_id_fkey(id, title, owner_id, event_at, status, owner:profiles!items_owner_id_fkey(*))',
        )
        .eq('id', chatId)
        .single();
      if (error) throw error;

      const raw = data as unknown as RawChatInfo;
      const rawTrade = one(raw.trade);
      const trade: ChatTrade | null = rawTrade
        ? {
            ...rawTrade,
            owner: one(rawTrade.owner),
            offerer: one(rawTrade.offerer),
            owner_item: one(rawTrade.owner_item),
            offerer_item: one(rawTrade.offerer_item),
          }
        : null;

      const rawCircle = one(raw.circle_item);
      const circle: ChatCircle | null = rawCircle
        ? { ...rawCircle, owner: one(rawCircle.owner) }
        : null;

      return {
        id: raw.id,
        trade_id: raw.trade_id,
        circle_item_id: raw.circle_item_id,
        created_at: raw.created_at,
        isCircle: raw.circle_item_id != null,
        trade,
        circle,
      };
    },
  });
}

export type MessageSender = Pick<Profile, 'display_name' | 'avatar_url'>;

/** Mensaje con su remitente embebido: en chats grupales hay que saber quién habla. */
export type MessageWithSender = Message & { sender: MessageSender | null };

export const MESSAGES_PAGE = 40;

/** Pages of messages, newest page first; each page is newest message first. */
export type MessagesData = InfiniteData<MessageWithSender[], string | null>;

/** Cursor for the next (older) page: the oldest timestamp loaded, or undefined at the start of the chat. */
export function olderCursor(lastPage: { created_at: string }[], pageSize = MESSAGES_PAGE): string | undefined {
  if (lastPage.length < pageSize) return undefined;
  return lastPage[lastPage.length - 1]?.created_at;
}

/** Applies `fn` to the newest page of the cached chat (optimistic sends, Realtime). */
function patchNewest(
  queryClient: QueryClient,
  chatId: string,
  fn: (newest: MessageWithSender[]) => MessageWithSender[],
) {
  queryClient.setQueryData<MessagesData>(['messages', chatId], (old) =>
    old
      ? { ...old, pages: [fn(old.pages[0] ?? []), ...old.pages.slice(1)] }
      : { pages: [fn([])], pageParams: [null] },
  );
}

/**
 * Messages in descending order (newest first) for an `inverted` FlatList,
 * loaded a page at a time: `fetchNextPage` brings the older ones. This fetch
 * is the source of truth; Realtime only speeds up new arrivals.
 */
export function useMessages(chatId: string) {
  return useInfiniteQuery({
    queryKey: ['messages', chatId],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<MessageWithSender[]> => {
      let query = supabase
        .from('messages')
        .select('*, sender:profiles!messages_sender_id_fkey(display_name, avatar_url)')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(MESSAGES_PAGE);
      if (pageParam) query = query.lt('created_at', pageParam);
      const { data, error } = await query;
      if (error) throw error;
      const rows = (data ?? []) as unknown as (Message & { sender: RawRel<MessageSender> })[];
      return rows.map((row) => ({ ...row, sender: one(row.sender) }));
    },
    getNextPageParam: (lastPage) => olderCursor(lastPage),
  });
}

let tempCounter = 0;

export function useSendMessage(chatId: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const uid = session?.user.id ?? '';

  return useMutation({
    mutationFn: async (body: string): Promise<MessageWithSender> => {
      const { data, error } = await supabase
        .from('messages')
        .insert({ chat_id: chatId, sender_id: uid, body })
        .select()
        .single();
      if (error) throw error;
      // Mensaje propio: no hace falta el perfil del remitente para pintarlo.
      return { ...data, sender: null };
    },
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: ['messages', chatId] });
      const tempId = `temp-${tempCounter++}`;
      const optimistic: MessageWithSender = {
        id: tempId,
        chat_id: chatId,
        sender_id: uid,
        body,
        image_path: null,
        created_at: new Date().toISOString(),
        read_at: null,
        sender: null,
      };
      patchNewest(queryClient, chatId, (newest) => [optimistic, ...newest]);
      return { tempId };
    },
    onError: (_error, _body, context) => {
      if (!context) return;
      patchNewest(queryClient, chatId, (newest) => newest.filter((m) => m.id !== context.tempId));
    },
    onSuccess: (message, _body, context) => {
      patchNewest(queryClient, chatId, (newest) => {
        const rest = newest.filter((m) => m.id !== context.tempId);
        // Si Realtime ya lo trajo, no lo dupliques.
        if (rest.some((m) => m.id === message.id)) return rest;
        return [message, ...rest];
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });
}

/** URL pública de una foto de chat (bucket 'chat-images', lectura pública). */
export function chatImageUrl(path: string): string {
  return supabase.storage.from('chat-images').getPublicUrl(path).data.publicUrl;
}

/**
 * Envía una foto al chat: redimensiona, sube al bucket 'chat-images'
 * (bajo `${uid}/…`, exigido por RLS) e inserta el mensaje con image_path.
 * Sin versión optimista: la pantalla muestra el estado de envío.
 */
export function useSendImage(chatId: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const uid = session?.user.id ?? '';

  return useMutation({
    mutationFn: async ({ uri }: { uri: string }): Promise<void> => {
      const resized = await manipulateAsync(uri, [{ resize: { width: 1280 } }], {
        compress: 0.8,
        format: SaveFormat.JPEG,
      });
      const res = await fetch(resized.uri);
      const buf = await res.arrayBuffer();
      const storagePath = `${uid}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(storagePath, buf, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { error } = await supabase
        .from('messages')
        .insert({ chat_id: chatId, sender_id: uid, image_path: storagePath, body: null });
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });
}

export function useChatRealtime(chatId: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const uid = session?.user.id ?? '';

  useEffect(() => {
    const channel = supabase
      .channel(`chat:${chatId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const message: MessageWithSender = { ...(payload.new as Message), sender: null };
          patchNewest(queryClient, chatId, (current) => {
            if (current.some((m) => m.id === message.id)) return current;
            // Si es un mensaje propio, reemplaza su versión optimista pendiente.
            const rest =
              message.sender_id === uid
                ? current.filter((m) => !(m.id.startsWith('temp-') && m.body === message.body))
                : current;
            return [message, ...rest];
          });

          if (message.sender_id !== uid) {
            // Realtime no trae el perfil embebido: refetch para conocer al remitente.
            void queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
            // Estamos con el chat abierto: márcalo leído al instante.
            void supabase
              .from('messages')
              .update({ read_at: new Date().toISOString() })
              .eq('id', message.id)
              .then(() => {
                void queryClient.invalidateQueries({ queryKey: ['chats'] });
              });
          }
        },
      )
      .subscribe((status) => {
        // Al (re)conectar, refetch: el fetch paginado manda por si algo se perdió.
        if (status === 'SUBSCRIBED') {
          void queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [chatId, queryClient, uid]);
}

/** Marca como leídos los mensajes del otro. Llamar al abrir el chat. */
export function useMarkChatRead(chatId: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const uid = session?.user.id ?? '';

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('chat_id', chatId)
        .neq('sender_id', uid)
        .is('read_at', null);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });
}
