import { Badge } from '@/components/ui/Badge';
import type { OfferStatus, TradeStatus } from '@/types/database';

type Tone = React.ComponentProps<typeof Badge>['tone'];
type Meta = { label: string; tone: Tone };

export const OFFER_STATUS_META: Record<OfferStatus, Meta> = {
  pending: { label: 'Pendiente', tone: 'warning' },
  accepted: { label: 'Aceptada', tone: 'success' },
  rejected: { label: 'Rechazada', tone: 'danger' },
  countered: { label: 'Contraofertada', tone: 'accent' },
  cancelled: { label: 'Cancelada', tone: 'muted' },
  expired: { label: 'Vencida', tone: 'muted' },
};

export const TRADE_STATUS_META: Record<TradeStatus, Meta> = {
  agreed: { label: 'En curso', tone: 'warning' },
  completed: { label: 'Completado', tone: 'success' },
  cancelled: { label: 'Cancelado', tone: 'muted' },
};

/** The one badge for the state of an offer or of a trade. */
export function StatusBadge(props: { offer: OfferStatus } | { trade: TradeStatus }) {
  const meta = 'offer' in props ? OFFER_STATUS_META[props.offer] : TRADE_STATUS_META[props.trade];
  return <Badge label={meta.label} tone={meta.tone} />;
}
