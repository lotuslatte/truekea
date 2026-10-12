import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import type {
  CircleMember,
  FeedItemRow,
  Item,
  ItemPhoto,
  Profile,
  Rating,
  Tables,
} from '@/types/database';

type Chat = Tables<'chats'>;

export type HostCircle = Item & { item_photos: ItemPhoto[] };

export type CircleMemberWithProfile = CircleMember & {
  member: Profile;
  offered_item: { id: string; title: string; kind: string } | null;
};

export function useCircleMembers(itemId: string) {
  return useQuery({
    queryKey: ['circleMembers', itemId],
    enabled: !!itemId,
    queryFn: async (): Promise<CircleMemberWithProfile[]> => {
      const { data, error } = await supabase
        .from('circle_members')
        .select(
          '*, member:profiles!circle_members_user_id_fkey(*), offered_item:items!circle_members_offered_item_id_fkey(id, title, kind)',
        )
        .eq('item_id', itemId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as CircleMemberWithProfile[];
    },
  });
}

// Círculos con cupo cerca del usuario, para la franja "Círculos esta semana"
// del feed. Reusa el RPC del feed fijando formato círculo y un radio amplio.
export function useUpcomingCircles(coords: { lat: number; lng: number }) {
  return useQuery({
    queryKey: ['upcomingCircles', coords.lat, coords.lng],
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<FeedItemRow[]> => {
      const { data, error } = await supabase.rpc('feed_items', {
        p_lat: coords.lat,
        p_lng: coords.lng,
        p_radius_km: 50,
        p_format: 'circle',
        p_limit: 10,
      });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// Todos los círculos publicados por un anfitrión (para su vitrina pública).
// El consumidor separa próximos (event_at futuro y status available/reserved)
// de los ya realizados (status traded).
export function useHostCircles(userId: string) {
  return useQuery({
    queryKey: ['hostCircles', userId],
    enabled: !!userId,
    queryFn: async (): Promise<HostCircle[]> => {
      const { data, error } = await supabase
        .from('items')
        .select('*, item_photos(*)')
        .eq('owner_id', userId)
        .eq('format', 'circle')
        .order('event_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as HostCircle[];
    },
  });
}

// Cupos ocupados vía RPC security definer: la RLS oculta la lista de miembros
// a los visitantes, pero la ocupación es pública (igual que en el feed).
export function useCircleOccupancy(itemId: string) {
  return useQuery({
    queryKey: ['circleOccupancy', itemId],
    enabled: !!itemId,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('circle_occupancy', { p_item_id: itemId });
      if (error) throw error;
      return data ?? 0;
    },
  });
}

export function useMyMembership(itemId: string) {
  const { session } = useAuth();
  const uid = session?.user.id ?? '';

  return useQuery({
    queryKey: ['circleMembership', itemId, uid],
    enabled: !!itemId && !!uid,
    queryFn: async (): Promise<CircleMember | null> => {
      const { data, error } = await supabase
        .from('circle_members')
        .select('*')
        .eq('item_id', itemId)
        .eq('user_id', uid)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

function invalidateCircleQueries(queryClient: ReturnType<typeof useQueryClient>) {
  for (const queryKey of [['circleMembers'], ['circleMembership'], ['item'], ['feed'], ['chats']]) {
    queryClient.invalidateQueries({ queryKey });
  }
}

export function useJoinCircle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      itemId: string;
      offering?: string | null;
      offeredItemId?: string | null;
    }): Promise<string> => {
      const { data, error } = await supabase.rpc('join_circle', {
        p_item_id: input.itemId,
        p_offering: input.offering ?? null,
        p_offered_item_id: input.offeredItemId ?? null,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      invalidateCircleQueries(queryClient);
    },
  });
}

export function useRespondCircleRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { memberId: string; accept: boolean }): Promise<void> => {
      const { error } = await supabase.rpc('respond_circle_request', {
        p_member_id: input.memberId,
        p_accept: input.accept,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidateCircleQueries(queryClient);
    },
  });
}

export function useLeaveCircle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string): Promise<void> => {
      const { error } = await supabase.rpc('leave_circle', { p_item_id: itemId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidateCircleQueries(queryClient);
    },
  });
}

export function useCheckinMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memberId: string): Promise<void> => {
      const { error } = await supabase.rpc('checkin_circle_member', { p_member_id: memberId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidateCircleQueries(queryClient);
    },
  });
}

export function useCompleteCircle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string): Promise<void> => {
      const { error } = await supabase.rpc('complete_circle', { p_item_id: itemId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidateCircleQueries(queryClient);
    },
  });
}

export function useCircleChat(itemId: string) {
  return useQuery({
    queryKey: ['circleChat', itemId],
    enabled: !!itemId,
    queryFn: async (): Promise<Chat | null> => {
      const { data, error } = await supabase
        .from('chats')
        .select('*')
        .eq('circle_item_id', itemId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export type CircleRatingInput = {
  circleItemId: string;
  rateeId: string;
  stars: number;
  comment: string;
};

export function useRateCircle() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const uid = session?.user.id ?? '';

  return useMutation({
    mutationFn: async (input: CircleRatingInput): Promise<void> => {
      const { error } = await supabase.from('ratings').insert({
        circle_item_id: input.circleItemId,
        rater_id: uid,
        ratee_id: input.rateeId,
        stars: input.stars,
        comment: input.comment.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ratings'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useMyCircleRating(itemId: string) {
  const { session } = useAuth();
  const uid = session?.user.id ?? '';

  return useQuery({
    queryKey: ['ratings', 'circle', itemId, uid],
    enabled: !!itemId && !!uid,
    queryFn: async (): Promise<Rating | null> => {
      const { data, error } = await supabase
        .from('ratings')
        .select('*')
        .eq('circle_item_id', itemId)
        .eq('rater_id', uid)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
