import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

// Estadísticas de logros calculadas en el servidor (RPC `profile_stats`).
// Alimentan las insignias que no salen del Profile: perecibles, saberes,
// distritos, rachas, mensajes, ofertas, etc.

export type ProfileStats = Database['public']['Functions']['profile_stats']['Returns'][number];

export function useProfileStats(userId: string) {
  return useQuery({
    queryKey: ['profileStats', userId],
    enabled: !!userId,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<ProfileStats | null> => {
      const { data, error } = await supabase.rpc('profile_stats', { p_user_id: userId });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
}
