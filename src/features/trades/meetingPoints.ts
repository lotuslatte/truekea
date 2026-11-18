import { useQuery } from '@tanstack/react-query';

import { districtCentroid } from '@/constants/districts';
import { useAuth } from '@/features/auth/AuthProvider';
import { sortByDistance } from '@/lib/geo';
import { getCurrentCoords } from '@/lib/location';
import { supabase } from '@/lib/supabase';

export type MeetingPointItem = {
  id: number;
  name: string;
  description: string | null;
  address: string;
  district: string;
  lat: number;
  lng: number;
  /** Present when there is an origin to measure from. */
  distanceKm?: number;
};

export type MeetingOrigin = 'device' | 'district' | 'none';

/**
 * Safe meeting points, nearest first. The origin is the device position when
 * access was already given (this never opens the permission dialog), else the
 * centre of the profile's district. Without either, the list keeps the
 * district order of the RPC and carries no distances.
 */
export function useMeetingPointsNear() {
  const { profile } = useAuth();
  const district = profile?.district ?? null;

  return useQuery({
    queryKey: ['meetingPointsNear', district],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<{ points: MeetingPointItem[]; origin: MeetingOrigin }> => {
      const { data, error } = await supabase.rpc('meeting_points_list');
      if (error) throw error;
      const points: MeetingPointItem[] = data ?? [];

      const home = district ? districtCentroid(district) : null;
      const located = await getCurrentCoords({ fallback: home });
      if (located.isFallback && !home) return { points, origin: 'none' };
      return {
        points: sortByDistance(points, located.coords),
        origin: located.isFallback ? 'district' : 'device',
      };
    },
  });
}
