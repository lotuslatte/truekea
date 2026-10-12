import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import type { Profile, Rating } from '@/types/database';

export type RatingWithRater = Rating & { rater: Profile };

export function useUserRatings(userId: string) {
  return useQuery({
    queryKey: ['ratings', userId],
    queryFn: async (): Promise<RatingWithRater[]> => {
      const { data, error } = await supabase
        .from('ratings')
        .select('*, rater:profiles!ratings_rater_id_fkey(*)')
        .eq('ratee_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as RatingWithRater[];
    },
  });
}

export type NewRatingInput = {
  tradeId: string;
  rateeId: string;
  stars: number;
  comment: string;
};

export function useCreateRating() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const uid = session?.user.id ?? '';

  return useMutation({
    mutationFn: async (input: NewRatingInput) => {
      const { error } = await supabase.from('ratings').insert({
        trade_id: input.tradeId,
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
      queryClient.invalidateQueries({ queryKey: ['trade'] });
    },
  });
}
