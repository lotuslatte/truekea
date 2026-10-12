import { useInfiniteQuery } from '@tanstack/react-query';

import { useFilters } from '@/stores/filters';
import { supabase } from '@/lib/supabase';
import type { Coords } from '@/lib/location';
import type { FeedItemRow } from '@/types/database';

const PAGE_SIZE = 20;

export function useFeed(coords: Coords) {
  const { categoryId, radiusKm, donationsOnly, kind, search, format, modality, condition } =
    useFilters();

  return useInfiniteQuery({
    queryKey: [
      'feed',
      categoryId,
      radiusKm,
      donationsOnly,
      kind,
      search,
      format,
      modality,
      condition,
      coords.lat,
      coords.lng,
    ],
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<FeedItemRow[]> => {
      const { data, error } = await supabase.rpc('feed_items', {
        p_lat: coords.lat,
        p_lng: coords.lng,
        p_radius_km: radiusKm,
        p_category: categoryId,
        p_search: search || null,
        p_donations_only: donationsOnly,
        p_kind: kind,
        p_format: format,
        p_modality: modality,
        p_condition: condition,
        p_offset: pageParam,
        p_limit: PAGE_SIZE,
      });
      if (error) throw error;
      return data ?? [];
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.reduce((total, page) => total + page.length, 0);
    },
  });
}
