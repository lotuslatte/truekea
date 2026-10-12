// Guardados ❤️: publicaciones que la persona marcó con el corazón para
// volver a verlas después. Insert/delete directos sobre saved_items (RLS
// dueño-todo) con actualización optimista para que el corazón responda al toque.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import type { Item, ItemPhoto } from '@/types/database';

type RawRel<T> = T | T[] | null;

function one<T>(value: RawRel<T> | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

// Set de item_id guardados por la persona. Es la fuente para pintar los
// corazones del feed; la mutación de abajo lo edita de forma optimista.
export function useSavedIds() {
  const { session } = useAuth();
  const uid = session?.user.id ?? '';

  const query = useQuery({
    queryKey: ['saved', uid],
    enabled: !!uid,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from('saved_items')
        .select('item_id')
        .eq('user_id', uid);
      if (error) throw error;
      return new Set((data ?? []).map((row) => row.item_id));
    },
  });

  const isSaved = (itemId: string): boolean => query.data?.has(itemId) ?? false;

  return { ...query, isSaved };
}

// Guardar/quitar con optimismo: el corazón cambia al instante y se revierte
// solo si la base de datos dice que no.
export function useToggleSaved() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const uid = session?.user.id ?? '';

  return useMutation({
    mutationFn: async ({ itemId, saved }: { itemId: string; saved: boolean }) => {
      if (saved) {
        const { error } = await supabase
          .from('saved_items')
          .delete()
          .eq('user_id', uid)
          .eq('item_id', itemId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('saved_items')
          .insert({ user_id: uid, item_id: itemId });
        if (error) throw error;
      }
    },
    onMutate: async ({ itemId, saved }) => {
      await queryClient.cancelQueries({ queryKey: ['saved', uid] });
      const previous = queryClient.getQueryData<Set<string>>(['saved', uid]);
      queryClient.setQueryData<Set<string>>(['saved', uid], (old) => {
        const next = new Set(old ?? []);
        if (saved) {
          next.delete(itemId);
        } else {
          next.add(itemId);
        }
        return next;
      });
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['saved', uid], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['saved', uid] });
      queryClient.invalidateQueries({ queryKey: ['savedItems'] });
    },
  });
}

type SavedRow = {
  item_id: string;
  created_at: string;
  item: RawRel<Item & { item_photos: ItemPhoto[]; owner: RawRel<{ display_name: string }> }>;
};

export type SavedEntry = {
  itemId: string;
  savedAt: string;
  item: Item & { item_photos: ItemPhoto[] };
  ownerName: string | null;
};

// Lista completa para la pantalla de guardados, con foto y dueño. Los items
// que ya no existen (borrados de la BD) se filtran; los no disponibles se
// muestran apagados en la UI.
export function useSavedItems() {
  const { session } = useAuth();
  const uid = session?.user.id ?? '';

  return useQuery({
    queryKey: ['savedItems'],
    enabled: !!uid,
    queryFn: async (): Promise<SavedEntry[]> => {
      const { data, error } = await supabase
        .from('saved_items')
        .select(
          'item_id, created_at, item:items(*, item_photos(*), owner:profiles!items_owner_id_fkey(display_name))',
        )
        .eq('user_id', uid)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const entries: SavedEntry[] = [];
      for (const row of (data ?? []) as unknown as SavedRow[]) {
        const item = one(row.item);
        if (!item) continue;
        entries.push({
          itemId: row.item_id,
          savedAt: row.created_at,
          item,
          ownerName: one(item.owner)?.display_name ?? null,
        });
      }
      return entries;
    },
  });
}
