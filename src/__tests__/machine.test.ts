import { OFFER_TRANSITIONS, canOfferMove, canTradeMove, offerActions, tradeView } from '@/features/offers/machine';
import type { OfferStatus } from '@/types/database';

const OWNER = 'owner-1';
const OFFERER = 'offerer-1';
const STRANGER = 'someone-else';

const offer = (status: OfferStatus, offered: string | null = 'item-b') => ({
  status,
  offerer_id: OFFERER,
  offered_item_id: offered,
});

describe('offer transitions', () => {
  it('lets a pending offer reach every final status', () => {
    for (const to of ['accepted', 'rejected', 'countered', 'cancelled', 'expired'] as const) {
      expect(canOfferMove('pending', to)).toBe(true);
    }
  });

  it('treats every other status as final', () => {
    const all = Object.keys(OFFER_TRANSITIONS) as OfferStatus[];
    for (const from of all.filter((s) => s !== 'pending')) {
      for (const to of all) expect(canOfferMove(from, to)).toBe(false);
    }
  });

  it('never moves back to pending', () => {
    expect(canOfferMove('pending', 'pending')).toBe(false);
    expect(canOfferMove('rejected', 'pending')).toBe(false);
  });
});

describe('offerActions', () => {
  it('gives accept, reject and counter to the owner of the target item', () => {
    expect(offerActions(offer('pending'), OWNER, OWNER)).toEqual({
      canAccept: true,
      canReject: true,
      canCounter: true,
      canCancel: false,
    });
  });

  it('gives only cancel to the offerer', () => {
    expect(offerActions(offer('pending'), OWNER, OFFERER)).toEqual({
      canAccept: false,
      canReject: false,
      canCounter: false,
      canCancel: true,
    });
  });

  it('does not allow countering a gift request', () => {
    expect(offerActions(offer('pending', null), OWNER, OWNER).canCounter).toBe(false);
    expect(offerActions(offer('pending', null), OWNER, OWNER).canAccept).toBe(true);
  });

  it('gives nothing to a third person or to a visitor', () => {
    const none = { canAccept: false, canReject: false, canCounter: false, canCancel: false };
    expect(offerActions(offer('pending'), OWNER, STRANGER)).toEqual(none);
    expect(offerActions(offer('pending'), OWNER, '')).toEqual(none);
    expect(offerActions(offer('pending'), undefined, '')).toEqual(none);
  });

  it('gives nothing once the offer is answered', () => {
    for (const status of ['accepted', 'rejected', 'countered', 'cancelled', 'expired'] as const) {
      expect(Object.values(offerActions(offer(status), OWNER, OWNER))).not.toContain(true);
      expect(Object.values(offerActions(offer(status), OWNER, OFFERER))).not.toContain(true);
    }
  });
});

describe('trade', () => {
  const trade = (over: Partial<Parameters<typeof tradeView>[0]> = {}) => ({
    status: 'agreed' as const,
    owner_id: OWNER,
    offerer_id: OFFERER,
    owner_confirmed_at: null,
    offerer_confirmed_at: null,
    ...over,
  });

  it('only leaves agreed, towards completed or cancelled', () => {
    expect(canTradeMove('agreed', 'completed')).toBe(true);
    expect(canTradeMove('agreed', 'cancelled')).toBe(true);
    expect(canTradeMove('completed', 'cancelled')).toBe(false);
    expect(canTradeMove('cancelled', 'agreed')).toBe(false);
  });

  it('lets both sides confirm and cancel while agreed', () => {
    expect(tradeView(trade(), OWNER)).toMatchObject({ canConfirm: true, canCancel: true, canRate: false });
    expect(tradeView(trade(), OFFERER)).toMatchObject({ canConfirm: true, canCancel: true, canRate: false });
  });

  it('tracks each confirmation from the right side', () => {
    const half = trade({ owner_confirmed_at: '2026-11-17T10:00:00Z' });
    expect(tradeView(half, OWNER)).toMatchObject({ iConfirmed: true, otherConfirmed: false, canConfirm: false });
    expect(tradeView(half, OFFERER)).toMatchObject({ iConfirmed: false, otherConfirmed: true, canConfirm: true });
  });

  it('allows rating only after completion, and nothing after cancelling', () => {
    const done = trade({ status: 'completed', owner_confirmed_at: 'x', offerer_confirmed_at: 'y' });
    expect(tradeView(done, OWNER)).toMatchObject({ canConfirm: false, canCancel: false, canRate: true });
    expect(tradeView(trade({ status: 'cancelled' }), OWNER)).toMatchObject({ canConfirm: false, canCancel: false, canRate: false });
  });

  it('gives nothing to someone outside the trade', () => {
    expect(tradeView(trade(), STRANGER)).toEqual({
      isParticipant: false,
      iConfirmed: false,
      otherConfirmed: false,
      canConfirm: false,
      canCancel: false,
      canRate: false,
    });
  });
});
