import type { Coords } from '@/lib/location';

/** Great-circle distance in kilometres. */
export function haversineKm(a: Coords, b: Coords): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Copies `points` with `distanceKm` from `origin`, nearest first. */
export function sortByDistance<T extends Coords>(points: readonly T[], origin: Coords): (T & { distanceKm: number })[] {
  return points
    .map((point) => ({ ...point, distanceKm: haversineKm(origin, point) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
