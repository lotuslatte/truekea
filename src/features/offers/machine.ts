import type { OfferStatus, TradeStatus } from '@/types/database';

// Client-side mirror of the offer and trade state machine. The database is
// the authority (RPCs in supabase/migrations/0004_functions.sql); this module
// only decides which buttons to show, with the same rules.

/** Where an offer can go from each status. Everything but `pending` is final. */
export const OFFER_TRANSITIONS: Record<OfferStatus, readonly OfferStatus[]> = {
  pending: ['accepted', 'rejected', 'countered', 'cancelled', 'expired'],
  accepted: [],
  rejected: [],
  countered: [],
  cancelled: [],
  expired: [],
};

/** A trade starts `agreed` and ends `completed` or `cancelled`. */
export const TRADE_TRANSITIONS: Record<TradeStatus, readonly TradeStatus[]> = {
  agreed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function canOfferMove(from: OfferStatus, to: OfferStatus): boolean {
  return OFFER_TRANSITIONS[from].includes(to);
}

export function canTradeMove(from: TradeStatus, to: TradeStatus): boolean {
  return TRADE_TRANSITIONS[from].includes(to);
}

export type OfferActions = {
  canAccept: boolean;
  canReject: boolean;
  canCounter: boolean;
  canCancel: boolean;
};

type OfferLike = { status: OfferStatus; offerer_id: string; offered_item_id: string | null };

/**
 * What `uid` may do with an offer. The owner of the target item answers
 * (accept, reject, counter); the offerer can only withdraw. A gift request
 * (nothing offered) cannot be countered.
 */
export function offerActions(offer: OfferLike, itemOwnerId: string | null | undefined, uid: string): OfferActions {
  const pending = offer.status === 'pending';
  const isOwner = !!uid && itemOwnerId === uid;
  const isOfferer = !!uid && offer.offerer_id === uid;
  return {
    canAccept: pending && isOwner,
    canReject: pending && isOwner,
    canCounter: pending && isOwner && offer.offered_item_id != null,
    canCancel: pending && isOfferer,
  };
}

type TradeLike = {
  status: TradeStatus;
  owner_id: string;
  offerer_id: string;
  owner_confirmed_at: string | null;
  offerer_confirmed_at: string | null;
};

export type TradeView = {
  isParticipant: boolean;
  iConfirmed: boolean;
  otherConfirmed: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  canRate: boolean;
};

/** The trade as seen by `uid`: who confirmed the handover and what is still allowed. */
export function tradeView(trade: TradeLike, uid: string): TradeView {
  const iAmOwner = trade.owner_id === uid;
  const isParticipant = !!uid && (iAmOwner || trade.offerer_id === uid);
  const mine = iAmOwner ? trade.owner_confirmed_at : trade.offerer_confirmed_at;
  const theirs = iAmOwner ? trade.offerer_confirmed_at : trade.owner_confirmed_at;
  const agreed = trade.status === 'agreed';
  return {
    isParticipant,
    iConfirmed: isParticipant && mine != null,
    otherConfirmed: isParticipant && theirs != null,
    canConfirm: isParticipant && agreed && mine == null,
    canCancel: isParticipant && agreed,
    canRate: isParticipant && trade.status === 'completed',
  };
}
