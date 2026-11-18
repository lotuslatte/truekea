// Agenda "Mis encuentros": todo lo que tengo por vivir en Truekea —
// truekes pactados, círculos que dicto y círculos donde tengo cupo.

import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import type { Item, ItemStatus, MeetingPoint, Profile, Trade } from '@/types/database';

export type EncuentroRole = 'anfitrion' | 'asistente' | 'trueke';

export type Encuentro = {
  key: string;
  role: EncuentroRole;
  title: string;
  /** Con quién es el encuentro; null cuando el círculo lo dicto yo. */
  companion: string | null;
  /** Fecha ISO del encuentro; null → "por coordinar". */
  date: string | null;
  /** Punto de encuentro o distrito; null si es virtual o aún no hay punto. */
  place: string | null;
  isVirtual: boolean;
  /** Ruta de destino al tocar la tarjeta. */
  path: string;
};

type RawRel<T> = T | T[] | null;

function one<T>(value: RawRel<T> | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

type AgendaTradeRow = Trade & {
  owner: RawRel<Profile>;
  offerer: RawRel<Profile>;
  owner_item: RawRel<{ title: string }>;
  offerer_item: RawRel<{ title: string }>;
  meeting_point: RawRel<MeetingPoint>;
};

type AgendaMembershipRow = {
  id: string;
  item: RawRel<Item & { owner: RawRel<Profile> }>;
};

const ACTIVE_CIRCLE_STATUSES: ItemStatus[] = ['available', 'reserved'];

function circlePlace(item: Pick<Item, 'modality' | 'district'>): {
  place: string | null;
  isVirtual: boolean;
} {
  const isVirtual = item.modality === 'virtual';
  return { place: isVirtual ? null : item.district, isVirtual };
}

export function useEncuentros() {
  const { session } = useAuth();
  const uid = session?.user.id ?? '';

  return useQuery({
    queryKey: ['encuentros', uid],
    enabled: !!uid,
    queryFn: async (): Promise<Encuentro[]> => {
      const [tradesRes, hostedRes, membershipsRes] = await Promise.all([
        // (a) Truekes pactados donde participo.
        supabase
          .from('trades')
          .select(
            '*, owner:profiles!trades_owner_id_fkey(*), offerer:profiles!trades_offerer_id_fkey(*), owner_item:items!trades_owner_item_id_fkey(title), offerer_item:items!trades_offerer_item_id_fkey(title), meeting_point:meeting_points(*)',
          )
          .eq('status', 'agreed')
          .or(`owner_id.eq.${uid},offerer_id.eq.${uid}`),
        // (b) Círculos que dicto y siguen en pie.
        supabase
          .from('items')
          .select('*')
          .eq('owner_id', uid)
          .eq('format', 'circle')
          .in('status', ACTIVE_CIRCLE_STATUSES),
        // (c) Círculos donde tengo cupo aceptado.
        supabase
          .from('circle_members')
          .select('id, item:items(*, owner:profiles!items_owner_id_fkey(*))')
          .eq('user_id', uid)
          .in('status', ['accepted', 'checked_in']),
      ]);
      if (tradesRes.error) throw tradesRes.error;
      if (hostedRes.error) throw hostedRes.error;
      if (membershipsRes.error) throw membershipsRes.error;

      const encuentros: Encuentro[] = [];

      for (const row of (tradesRes.data ?? []) as unknown as AgendaTradeRow[]) {
        const other = one(row.owner_id === uid ? row.offerer : row.owner);
        const ownerItem = one(row.owner_item);
        const offererItem = one(row.offerer_item);
        const meetingPoint = one(row.meeting_point);
        encuentros.push({
          key: `trade-${row.id}`,
          role: 'trueke',
          title: `Trueke: ${ownerItem?.title ?? '…'} por ${offererItem?.title ?? 'un regalo'}`,
          companion: other?.display_name ?? null,
          date: null, // los truekes se coordinan en el chat, sin fecha en la BD
          place: meetingPoint ? `${meetingPoint.name} · ${meetingPoint.district}` : null,
          isVirtual: false,
          path: `/trueke/${row.id}`,
        });
      }

      for (const item of (hostedRes.data ?? []) as Item[]) {
        encuentros.push({
          key: `host-${item.id}`,
          role: 'anfitrion',
          title: item.title,
          companion: null,
          date: item.event_at,
          ...circlePlace(item),
          path: `/item/${item.id}`,
        });
      }

      for (const row of (membershipsRes.data ?? []) as unknown as AgendaMembershipRow[]) {
        const item = one(row.item);
        if (!item || !ACTIVE_CIRCLE_STATUSES.includes(item.status)) continue;
        const host = one(item.owner);
        encuentros.push({
          key: `asiste-${row.id}`,
          role: 'asistente',
          title: item.title,
          companion: host?.display_name ?? null,
          date: item.event_at,
          ...circlePlace(item),
          path: `/item/${item.id}`,
        });
      }

      // Con fecha primero (ascendente); lo demás queda "por coordinar".
      encuentros.sort((a, b) => {
        if (a.date && b.date) return a.date.localeCompare(b.date);
        if (a.date) return -1;
        if (b.date) return 1;
        return 0;
      });
      return encuentros;
    },
  });
}
