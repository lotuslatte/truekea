import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import type { Profile, ReportReason, ReportTarget } from '@/types/database';

export function useIsBlocked(otherId: string) {
  const { session } = useAuth();
  const uid = session?.user.id ?? '';

  return useQuery({
    queryKey: ['blocked', otherId],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from('blocks')
        .select('blocked_id')
        .eq('blocker_id', uid)
        .eq('blocked_id', otherId)
        .maybeSingle();
      if (error) throw error;
      return data != null;
    },
  });
}

function useInvalidateBlocks() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['blocked'] });
    queryClient.invalidateQueries({ queryKey: ['feed'] });
    queryClient.invalidateQueries({ queryKey: ['chats'] });
    queryClient.invalidateQueries({ queryKey: ['blockedList'] });
  };
}

export function useBlockUser() {
  const { session } = useAuth();
  const uid = session?.user.id ?? '';
  const invalidate = useInvalidateBlocks();

  return useMutation({
    mutationFn: async (blockedId: string) => {
      const { error } = await supabase
        .from('blocks')
        .insert({ blocker_id: uid, blocked_id: blockedId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useUnblockUser() {
  const { session } = useAuth();
  const uid = session?.user.id ?? '';
  const invalidate = useInvalidateBlocks();

  return useMutation({
    mutationFn: async (blockedId: string) => {
      const { error } = await supabase
        .from('blocks')
        .delete()
        .eq('blocker_id', uid)
        .eq('blocked_id', blockedId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export type BlockedUserRow = {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
  blocked: Profile;
};

export function useBlockedUsers() {
  const { session } = useAuth();
  const uid = session?.user.id ?? '';

  return useQuery({
    queryKey: ['blockedList'],
    queryFn: async (): Promise<BlockedUserRow[]> => {
      const { data, error } = await supabase
        .from('blocks')
        .select('*, blocked:profiles!blocks_blocked_id_fkey(*)')
        .eq('blocker_id', uid)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as BlockedUserRow[];
    },
  });
}

export type ReportInput = {
  targetType: ReportTarget;
  targetId: string;
  reason: ReportReason;
  details?: string;
};

export function useReport() {
  const { session } = useAuth();
  const uid = session?.user.id ?? '';

  return useMutation({
    mutationFn: async (input: ReportInput) => {
      const { error } = await supabase.from('reports').insert({
        reporter_id: uid,
        target_type: input.targetType,
        target_id: input.targetId,
        reason: input.reason,
        details: input.details?.trim() || null,
      });
      if (error) throw error;
    },
  });
}
