import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';

import { districtCentroid, toWkt } from '@/constants/districts';
import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import type {
  Item,
  ItemCondition,
  ItemKind,
  ItemPhoto,
  ItemStatus,
  KnowledgeFormat,
  KnowledgeModality,
} from '@/types/database';

export type MyItem = Item & { item_photos: ItemPhoto[] };

export type NewItemInput = {
  title: string;
  description: string;
  categoryId: number;
  kind: ItemKind;
  // Contextuales: format/modality solo para saberes, condition solo para
  // objetos, eventAt/capacity solo para círculos. Null donde no aplica.
  format: KnowledgeFormat | null;
  modality: KnowledgeModality | null;
  condition: ItemCondition | null;
  eventAt: string | null;
  capacity: number | null;
  // Solo regalos perecibles: hora límite de recojo en ISO (constraint en BD:
  // solo permitido cuando is_donation es true). Null si no aplica.
  pickupUntil?: string | null;
  lookingFor: string;
  isDonation: boolean;
  district: string;
  photos: { uri: string }[];
};

export function useMyItems() {
  const { session } = useAuth();
  const uid = session?.user.id ?? '';

  return useQuery({
    queryKey: ['myItems'],
    queryFn: async (): Promise<MyItem[]> => {
      const { data, error } = await supabase
        .from('items')
        .select('*, item_photos(*)')
        .eq('owner_id', uid)
        .neq('status', 'removed')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as MyItem[];
    },
  });
}

export function useCreateItem() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const uid = session?.user.id ?? '';

  return useMutation({
    mutationFn: async (input: NewItemInput): Promise<Item> => {
      const centroid = districtCentroid(input.district);
      if (!centroid) throw new Error('No reconocemos ese distrito, elige uno de la lista.');

      const { data: item, error } = await supabase
        .from('items')
        .insert({
          owner_id: uid,
          category_id: input.categoryId,
          title: input.title.trim(),
          description: input.description.trim(),
          kind: input.kind,
          format: input.format,
          modality: input.modality,
          condition: input.condition,
          event_at: input.eventAt,
          capacity: input.capacity,
          pickup_until: input.pickupUntil ?? null,
          estimated_value_pen: null,
          looking_for: input.lookingFor.trim() || null,
          is_donation: input.isDonation,
          district: input.district,
          location: toWkt(centroid),
          status: 'available',
        })
        .select()
        .single();
      if (error) throw error;

      for (let i = 0; i < input.photos.length; i++) {
        const photo = input.photos[i];
        if (!photo) continue;
        const resized = await manipulateAsync(photo.uri, [{ resize: { width: 1600 } }], {
          compress: 0.8,
          format: SaveFormat.JPEG,
        });
        const res = await fetch(resized.uri);
        const buf = await res.arrayBuffer();
        const storagePath = `${uid}/${item.id}-${i}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('item-photos')
          .upload(storagePath, buf, { contentType: 'image/jpeg' });
        if (uploadError) throw uploadError;

        const { error: photoError } = await supabase
          .from('item_photos')
          .insert({ item_id: item.id, storage_path: storagePath, position: i });
        if (photoError) throw photoError;
      }

      return item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myItems'] });
    },
  });
}

export function useSetItemStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      status,
    }: {
      itemId: string;
      status: Extract<ItemStatus, 'available' | 'paused' | 'removed'>;
    }) => {
      const { error } = await supabase.from('items').update({ status }).eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myItems'] });
    },
  });
}
