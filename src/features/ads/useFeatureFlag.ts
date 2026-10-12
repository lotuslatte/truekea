import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/database';

export type FeatureFlag = { enabled: boolean; payload: Json };

export function useFeatureFlag(key: string) {
  return useQuery({
    queryKey: ['flag', key],
    staleTime: 15 * 60 * 1000,
    queryFn: async (): Promise<FeatureFlag | null> => {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('enabled, payload')
        .eq('key', key)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}
