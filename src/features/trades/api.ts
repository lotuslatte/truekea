import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import type {
  Item,
  ItemPhoto,
  MeetingPoint,
  Profile,
  Rating,
  Tables,
  Trade,
  TradeStatus,
} from '@/types/database';

type Chat = Tables<'chats'>;

export type TradeItemWithPhotos = Item & { item_photos: ItemPhoto[] };

export type TradeWithRelations = Trade & {
  owner: Profile;
  offerer: Profile;
  owner_item: TradeItemWithPhotos;
  offerer_item: TradeItemWithPhotos | null;
  meeting_point: MeetingPoint | null;
  chat: Chat | null;
};

const TRADE_SELECT =
  '*, owner:profiles!trades_owner_id_fkey(*), offerer:profiles!trades_offerer_id_fkey(*), owner_item:items!trades_owner_item_id_fkey(*, item_photos(*)), offerer_item:items!trades_offerer_item_id_fkey(*, item_photos(*)), meeting_point:meeting_points(*), chat:chats(*)';

export function useTrade(id: string) {
  return useQuery({
    queryKey: ['trade', id],
    queryFn: async (): Promise<TradeWithRelations> => {
      const { data, error } = await supabase
        .from('trades')
        .select(TRADE_SELECT)
        .eq('id', id)
        .single();
      if (error) throw error;
      // chats es 1:1 con trades, pero PostgREST puede devolverlo como array.
      const row = data as unknown as Omit<TradeWithRelations, 'chat'> & {
        chat: Chat | Chat[] | null;
      };
      const chat = Array.isArray(row.chat) ? (row.chat[0] ?? null) : row.chat;
      return { ...row, chat };
    },
  });
}

function invalidateTradeQueries(queryClient: ReturnType<typeof useQueryClient>) {
  for (const queryKey of [['trade'], ['myItems'], ['chats']]) {
    queryClient.invalidateQueries({ queryKey });
  }
}

export function useConfirmTrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tradeId: string): Promise<TradeStatus> => {
      const { data, error } = await supabase.rpc('confirm_trade', { p_trade_id: tradeId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateTradeQueries(queryClient);
    },
  });
}

export function useCancelTrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tradeId: string): Promise<void> => {
      const { error } = await supabase.rpc('cancel_trade', { p_trade_id: tradeId });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateTradeQueries(queryClient);
    },
  });
}

export function useSetMeetingPoint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { tradeId: string; meetingPointId: number }): Promise<void> => {
      const { error } = await supabase.rpc('set_meeting_point', {
        p_trade_id: input.tradeId,
        p_meeting_point_id: input.meetingPointId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateTradeQueries(queryClient);
    },
  });
}

export function useMyRatingForTrade(tradeId: string) {
  const { session } = useAuth();
  const uid = session?.user.id ?? '';

  return useQuery({
    queryKey: ['ratings', 'mine', tradeId],
    queryFn: async (): Promise<Rating | null> => {
      const { data, error } = await supabase
        .from('ratings')
        .select('*')
        .eq('trade_id', tradeId)
        .eq('rater_id', uid)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useProposeMeetingTime() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { tradeId: string; at: Date }): Promise<void> => {
      const { error } = await supabase.rpc('propose_meeting_time', {
        p_trade_id: input.tradeId,
        p_at: input.at.toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateTradeQueries(queryClient);
    },
  });
}

export function useAcceptMeetingTime() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tradeId: string): Promise<void> => {
      const { error } = await supabase.rpc('accept_meeting_time', { p_trade_id: tradeId });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateTradeQueries(queryClient);
    },
  });
}
