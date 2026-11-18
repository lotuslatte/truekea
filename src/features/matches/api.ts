import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import type { MatchRow } from '@/types/database';

export type Matches = { theyWant: MatchRow[]; iWant: MatchRow[] };

/** Splits the RPC rows into the two lists of the screen. */
export function splitMatches(rows: MatchRow[]): Matches {
  return {
    theyWant: rows.filter((r) => r.direction === 'they_want'),
    iWant: rows.filter((r) => r.direction === 'i_want'),
  };
}

/** Items that match wishes, both ways: who looks for what I published, and what I look for. */
export function useMatches() {
  const { session } = useAuth();
  const uid = session?.user.id ?? '';
  return useQuery({
    queryKey: ['matches', uid],
    enabled: !!uid,
    staleTime: 60_000,
    queryFn: async (): Promise<Matches> => {
      const { data, error } = await supabase.rpc('my_matches', { p_limit: 40 });
      if (error) throw error;
      return splitMatches(data ?? []);
    },
  });
}
