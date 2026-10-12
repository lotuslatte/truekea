import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { ItemKind } from '@/types/database';

// kind: 'object' | 'knowledge' filtra a las categorías de ese tipo
// (las de kind null, como Otros, aplican a ambos). Sin kind: todas.
export function useCategories(kind?: ItemKind | null) {
  const query = useQuery({
    queryKey: ['categories'],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').order('sort_order');
      if (error) throw error;
      return data;
    },
  });
  const filtered = kind
    ? (query.data ?? []).filter((c) => c.kind === kind || c.kind === null)
    : query.data;
  return { ...query, data: filtered };
}
