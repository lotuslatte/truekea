// Deseos 🔔: lo que la persona anda buscando. La UI solo gestiona la lista;
// el matcheo contra publicaciones nuevas y la notificación push los hace un
// trigger en el backend, sin que la app tenga que hacer nada.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type Wishlist = Tables<'wishlists'>;

export type NewWishlistInput = {
  query: string;
  categoryId: number | null;
  radiusKm: number;
};

export function useMyWishlists() {
  const { session } = useAuth();
  const uid = session?.user.id ?? '';

  return useQuery({
    queryKey: ['wishlists'],
    enabled: !!uid,
    queryFn: async (): Promise<Wishlist[]> => {
      const { data, error } = await supabase
        .from('wishlists')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateWishlist() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const uid = session?.user.id ?? '';

  return useMutation({
    mutationFn: async (input: NewWishlistInput): Promise<Wishlist> => {
      const { data, error } = await supabase
        .from('wishlists')
        .insert({
          user_id: uid,
          query: input.query.trim(),
          category_id: input.categoryId,
          radius_km: input.radiusKm,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlists'] });
    },
  });
}

// Pausar/reactivar un deseo. Optimista para que el Switch no se sienta lento;
// si la BD rechaza, se revierte solo.
export function useToggleWishlistActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.from('wishlists').update({ is_active: isActive }).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, isActive }) => {
      await queryClient.cancelQueries({ queryKey: ['wishlists'] });
      const previous = queryClient.getQueryData<Wishlist[]>(['wishlists']);
      queryClient.setQueryData<Wishlist[]>(['wishlists'], (old) =>
        (old ?? []).map((wish) => (wish.id === id ? { ...wish, is_active: isActive } : wish)),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['wishlists'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlists'] });
    },
  });
}

export function useDeleteWishlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('wishlists').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlists'] });
    },
  });
}
