import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { createDeduper, notificationCopy } from '@/features/notifications/copy';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import type { AppNotification } from '@/types/database';

const PAGE = 60;

export function useNotifications() {
  const { session } = useAuth();
  const uid = session?.user.id ?? '';
  return useQuery({
    queryKey: ['notifications', 'list', uid],
    enabled: !!uid,
    queryFn: async (): Promise<AppNotification[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(PAGE);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Unread rows that are not chat messages: those already count on the Chats tab. */
export function useUnreadNotificationCount() {
  const { session } = useAuth();
  const uid = session?.user.id ?? '';
  return useQuery({
    queryKey: ['notifications', 'unread', uid],
    enabled: !!uid,
    refetchInterval: 60_000,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid)
        .is('read_at', null)
        .neq('type', 'new_message');
      if (error) throw error;
      return count ?? 0;
    },
  });
}

/** Offers on my items that still wait for my answer. */
export function usePendingOfferCount() {
  const { session } = useAuth();
  const uid = session?.user.id ?? '';
  return useQuery({
    queryKey: ['offers', 'pendingCount', uid],
    enabled: !!uid,
    refetchInterval: 60_000,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('offers')
        .select('id, item:items!offers_item_id_fkey!inner(owner_id)', { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('item.owner_id', uid);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useMarkNotificationsRead() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const uid = session?.user.id ?? '';
  return useMutation({
    /** Pass an id to mark one row, or nothing to mark every unread row. */
    mutationFn: async (id?: string) => {
      let q = supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', uid).is('read_at', null);
      if (id) q = q.eq('id', id);
      const { error } = await q;
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

const alreadyAnnounced = createDeduper();

/**
 * Shows one toast per event while the app is open. Both the Realtime row and
 * the foreground push call this, so the same destination is announced once.
 */
export function announceInApp(title: string, body: string, url: string, currentPath: string) {
  if (url && currentPath === url) return; // already looking at it
  if (alreadyAnnounced(url || title)) return;
  toast(title, body, 'info');
}

/**
 * Keeps badges and the inbox fresh from Realtime and announces new rows.
 * Realtime only speeds the cache up; the queries above stay the source of truth.
 */
export function useNotificationsRealtime() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const uid = session?.user.id ?? '';
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(`notifications:${uid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        (payload) => {
          const row = payload.new as AppNotification;
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          if (row.type === 'new_message') queryClient.invalidateQueries({ queryKey: ['chats'] });
          else queryClient.invalidateQueries({ queryKey: ['offers'] });
          const copy = notificationCopy(row.type, row.payload);
          announceInApp(copy.title, copy.body, copy.url, pathRef.current);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [uid, queryClient]);
}
