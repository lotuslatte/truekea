import { formatDistanceToNowStrict } from 'date-fns';
import { es } from 'date-fns/locale';

export function formatPen(value: number | null | undefined): string {
  if (value == null) return '';
  return `S/ ${Number(value).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function timeAgo(iso: string): string {
  return formatDistanceToNowStrict(new Date(iso), { addSuffix: true, locale: es });
}

export function formatDistance(km: number): string {
  if (km < 1) return 'a menos de 1 km';
  return `a ${km.toLocaleString('es-PE', { maximumFractionDigits: 1 })} km`;
}
