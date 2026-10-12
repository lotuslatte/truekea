import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import type { Item, ItemPhoto, Offer, Profile } from '@/types/database';

export type ItemWithPhotos = Item & { item_photos: ItemPhoto[] };

export type OfferWithRelations = Offer & {
  item: ItemWithPhotos;
  offered_item: ItemWithPhotos | null;
  offerer: Profile;
};

const OFFER_SELECT =
  '*, item:items!offers_item_id_fkey(*, item_photos(*)), offered_item:items!offers_offered_item_id_fkey(*, item_photos(*)), offerer:profiles!offers_offerer_id_fkey(*)';

const OFFER_SELECT_INNER =
  '*, item:items!offers_item_id_fkey!inner(*, item_photos(*)), offered_item:items!offers_offered_item_id_fkey(*, item_photos(*)), offerer:profiles!offers_offerer_id_fkey(*)';

export function useReceivedOffers() {
  const { session } = useAuth();
  const uid = session?.user.id ?? '';

  return useQuery({
    queryKey: ['offers', 'received'],
    queryFn: async (): Promise<OfferWithRelations[]> => {
      const { data, error } = await supabase
        .from('offers')
        .select(OFFER_SELECT_INNER)
        .eq('item.owner_id', uid)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as OfferWithRelations[];
    },
  });
}

export function useSentOffers() {
  const { session } = useAuth();
  const uid = session?.user.id ?? '';

  return useQuery({
    queryKey: ['offers', 'sent'],
    queryFn: async (): Promise<OfferWithRelations[]> => {
      const { data, error } = await supabase
        .from('offers')
        .select(OFFER_SELECT)
        .eq('offerer_id', uid)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as OfferWithRelations[];
    },
  });
}

export function useOffer(id: string) {
  return useQuery({
    queryKey: ['offer', id],
    queryFn: async (): Promise<OfferWithRelations> => {
      const { data, error } = await supabase
        .from('offers')
        .select(OFFER_SELECT)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as unknown as OfferWithRelations;
    },
  });
}

export type NewOfferInput = {
  itemId: string;
  offeredItemId: string | null;
  message: string | null;
};

export function useCreateOffer() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const uid = session?.user.id ?? '';

  return useMutation({
    mutationFn: async (input: NewOfferInput): Promise<Offer> => {
      const { data, error } = await supabase
        .from('offers')
        .insert({
          item_id: input.itemId,
          offerer_id: uid,
          offered_item_id: input.offeredItemId,
          // Trueque puro: la app no maneja dinero, siempre 0.
          cash_top_up_pen: 0,
          message: input.message,
        })
        .select()
        .single();
      if (error) {
        if (error.code === '23505') {
          throw new Error('Ya tienes una oferta pendiente por este objeto');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers'] });
    },
  });
}

function invalidateOfferQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  extraKeys: string[][] = [],
) {
  const keys = [['offers'], ['myItems'], ['feed'], ...extraKeys];
  for (const queryKey of keys) {
    queryClient.invalidateQueries({ queryKey });
  }
}

export function useAcceptOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (offerId: string): Promise<string> => {
      const { data, error } = await supabase.rpc('accept_offer', { p_offer_id: offerId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateOfferQueries(queryClient, [['chats']]);
    },
  });
}

export function useRejectOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (offerId: string): Promise<void> => {
      const { error } = await supabase.rpc('reject_offer', { p_offer_id: offerId });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateOfferQueries(queryClient);
    },
  });
}

export function useCancelOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (offerId: string): Promise<void> => {
      const { error } = await supabase.rpc('cancel_offer', { p_offer_id: offerId });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateOfferQueries(queryClient);
    },
  });
}

export type CounterOfferInput = {
  offerId: string;
  offeredItemId: string;
  message: string | null;
};

export function useCounterOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CounterOfferInput): Promise<string> => {
      const { data, error } = await supabase.rpc('counter_offer', {
        p_offer_id: input.offerId,
        p_offered_item_id: input.offeredItemId,
        // Trueque puro: la app no maneja dinero, siempre 0.
        p_cash_top_up_pen: 0,
        p_message: input.message,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateOfferQueries(queryClient);
    },
  });
}

export function useMyAvailableItems() {
  const { session } = useAuth();
  const uid = session?.user.id ?? '';

  return useQuery({
    queryKey: ['myItems', 'available'],
    queryFn: async (): Promise<ItemWithPhotos[]> => {
      const { data, error } = await supabase
        .from('items')
        .select('*, item_photos(*)')
        .eq('owner_id', uid)
        .eq('status', 'available')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ItemWithPhotos[];
    },
  });
}
