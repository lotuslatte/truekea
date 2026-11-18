import { draftHasContent, parseDraft } from '@/features/items/draft';
import { photosUnchanged } from '@/features/items/photos';
import { createDeduper, notificationCopy } from '@/features/notifications/copy';
import { meetingState } from '@/features/trades/meeting';
import { dayOptions, formatTime, formatWhen, slotOf, timeSlots, withTime } from '@/lib/datetime';
import { haversineKm, sortByDistance } from '@/lib/geo';
import { runPool } from '@/lib/pool';
import { olderCursor } from '@/features/chat/api';
import { questionError } from '@/features/questions/api';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/supabase', () => ({ supabase: {}, publicPhotoUrl: (p: string) => `https://cdn.test/${p}` }));
jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: () => ({ session: null, profile: null }) }));

describe('datetime', () => {
  const now = new Date(2026, 10, 17, 15, 20); // Tue 17 Nov 2026, 3:20 p. m.

  it('labels today, tomorrow and later days', () => {
    const days = dayOptions(now, 3);
    expect(days.map((d) => d.label)).toEqual(['Hoy', 'Mañana', 'jue 19 nov']);
    expect(days[0]?.key).toBe('2026-11-17');
  });

  it('starts later when asked and crosses the month end', () => {
    const days = dayOptions(new Date(2026, 10, 29, 9), 3, 1);
    expect(days.map((d) => d.key)).toEqual(['2026-11-30', '2026-12-01', '2026-12-02']);
    expect(days[0]?.label).toBe('Mañana');
  });

  it('builds half-hour slots between the limits', () => {
    const slots = timeSlots(30, 6, 22);
    expect(slots[0]).toBe('06:00');
    expect(slots[slots.length - 1]).toBe('22:00');
    expect(slots).toHaveLength(33);
  });

  it('combines a day and a slot, and rejects bad slots', () => {
    const at = withTime(now, '16:30');
    expect(at?.getHours()).toBe(16);
    expect(at?.getMinutes()).toBe(30);
    expect(slotOf(at as Date)).toBe('16:30');
    expect(withTime(now, '25:00')).toBeNull();
    expect(withTime(now, 'tarde')).toBeNull();
  });

  it('formats times and relative days in Spanish', () => {
    expect(formatTime(new Date(2026, 10, 17, 0, 5))).toBe('12:05 a. m.');
    expect(formatTime(new Date(2026, 10, 17, 12, 0))).toBe('12:00 p. m.');
    expect(formatWhen(new Date(2026, 10, 17, 16, 30), now)).toBe('hoy, 4:30 p. m.');
    expect(formatWhen(new Date(2026, 10, 18, 9, 0), now)).toBe('mañana, 9:00 a. m.');
    expect(formatWhen(new Date(2026, 10, 20, 16, 30), now)).toBe('vie 20 nov, 4:30 p. m.');
  });
});

describe('geo', () => {
  const miraflores = { lat: -12.1211, lng: -77.0297 };
  const barranco = { lat: -12.1494, lng: -77.0208 };
  const comas = { lat: -11.9458, lng: -77.0586 };

  it('measures Miraflores to Barranco at about 3.3 km', () => {
    const km = haversineKm(miraflores, barranco);
    expect(km).toBeGreaterThan(3);
    expect(km).toBeLessThan(3.6);
    expect(haversineKm(miraflores, miraflores)).toBe(0);
  });

  it('sorts nearest first without touching the input', () => {
    const points = [{ id: 'comas', ...comas }, { id: 'barranco', ...barranco }, { id: 'miraflores', ...miraflores }];
    const sorted = sortByDistance(points, miraflores);
    expect(sorted.map((p) => p.id)).toEqual(['miraflores', 'barranco', 'comas']);
    expect(points[0]?.id).toBe('comas');
    expect(sorted[0]?.distanceKm).toBe(0);
  });
});

describe('runPool', () => {
  it('keeps input order, respects the limit and reports progress', async () => {
    let running = 0;
    let peak = 0;
    const progress: number[] = [];
    const out = await runPool(
      [30, 5, 20, 1, 10],
      2,
      async (ms, i) => {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((r) => setTimeout(r, ms));
        running -= 1;
        return i * 10;
      },
      (done) => progress.push(done),
    );
    expect(out).toEqual([0, 10, 20, 30, 40]);
    expect(peak).toBe(2);
    expect(progress).toEqual([1, 2, 3, 4, 5]);
  });

  it('rejects on the first failure and starts no more work', async () => {
    const started: number[] = [];
    await expect(
      runPool([1, 2, 3, 4], 1, async (n) => {
        started.push(n);
        if (n === 2) throw new Error('upload failed');
        return n;
      }),
    ).rejects.toThrow('upload failed');
    expect(started).toEqual([1, 2]);
  });

  it('handles an empty list', async () => {
    await expect(runPool([], 3, async () => 1)).resolves.toEqual([]);
  });
});

describe('meetingState', () => {
  const now = Date.parse('2026-11-17T12:00:00Z');
  const future = '2026-11-19T15:00:00Z';

  it('covers the whole negotiation', () => {
    expect(meetingState({ meeting_at: null, meeting_proposed_by: null, meeting_accepted_at: null }, 'a', now)).toBe('none');
    expect(meetingState({ meeting_at: future, meeting_proposed_by: 'a', meeting_accepted_at: null }, 'a', now)).toBe('proposed_by_me');
    expect(meetingState({ meeting_at: future, meeting_proposed_by: 'a', meeting_accepted_at: null }, 'b', now)).toBe('proposed_by_other');
    expect(meetingState({ meeting_at: future, meeting_proposed_by: 'a', meeting_accepted_at: '2026-11-17T12:30:00Z' }, 'b', now)).toBe('agreed');
  });

  it('expires an unanswered proposal, but keeps an accepted one', () => {
    const past = '2026-11-16T15:00:00Z';
    expect(meetingState({ meeting_at: past, meeting_proposed_by: 'a', meeting_accepted_at: null }, 'b', now)).toBe('expired');
    expect(meetingState({ meeting_at: past, meeting_proposed_by: 'a', meeting_accepted_at: past }, 'b', now)).toBe('agreed');
  });
});

describe('notificationCopy', () => {
  it('routes each type to its screen', () => {
    expect(notificationCopy('new_offer', { offer_id: 'o1', item_title: 'Bici' })).toEqual({
      title: 'Nueva oferta',
      body: 'Te ofrecen un trueke por «Bici».',
      url: '/oferta/o1',
    });
    expect(notificationCopy('offer_accepted', { trade_id: 't1', item_title: 'Bici' }).url).toBe('/trueke/t1');
    expect(notificationCopy('new_message', { chat_id: 'c1', preview: 'Hola' })).toMatchObject({ body: 'Hola', url: '/chat/c1' });
    expect(notificationCopy('item_question', { item_id: 'i1', item_title: 'Bici' }).url).toBe('/item/i1');
    expect(notificationCopy('meeting_proposed', { trade_id: 't1' }).url).toBe('/trueke/t1');
  });

  it('survives missing or malformed payloads', () => {
    expect(notificationCopy('new_message', { chat_id: 'c1', preview: null }).body).toBe('Te enviaron una foto.');
    expect(notificationCopy('new_offer', null).body).toContain('tu publicación');
    expect(notificationCopy('something_new', 'not an object').url).toBe('/notificaciones');
  });

  it('uses no emoji and no em dash in any message', () => {
    const types = ['new_offer', 'offer_countered', 'offer_accepted', 'offer_rejected', 'new_message', 'trade_completed', 'trade_cancelled', 'rating_received', 'wishlist_match', 'circle_request', 'circle_accepted', 'circle_completed', 'item_question', 'item_answer', 'meeting_proposed', 'meeting_accepted', 'unknown'];
    for (const type of types) {
      const { title, body } = notificationCopy(type, {});
      expect(`${title} ${body}`).not.toMatch(/[—\u{1F300}-\u{1FAFF}☀-➿]/u);
    }
  });
});

describe('createDeduper', () => {
  it('announces a key once inside the window and again after it', () => {
    let t = 1000;
    const seen = createDeduper(10_000, () => t);
    expect(seen('/chat/1')).toBe(false);
    expect(seen('/chat/1')).toBe(true);
    expect(seen('/chat/2')).toBe(false);
    t += 10_001;
    expect(seen('/chat/1')).toBe(false);
  });
});

describe('publish draft', () => {
  const base = { title: '', description: '', lookingFor: '', photos: [] as string[] };

  it('counts as content only what the person entered', () => {
    expect(draftHasContent(base)).toBe(false);
    expect(draftHasContent({ ...base, title: '   ' })).toBe(false);
    expect(draftHasContent({ ...base, title: 'Bici' })).toBe(true);
    expect(draftHasContent({ ...base, photos: ['file:///a.jpg'] })).toBe(true);
  });

  it('reads back a stored draft and repairs odd values', () => {
    const draft = parseDraft(JSON.stringify({ title: 'Bici', description: 'Aro 26', step: 9, kind: 'x', photos: ['a', 3], categoryId: '5' }));
    expect(draft).toMatchObject({ title: 'Bici', step: 1, kind: 'object', format: 'one_on_one', photos: ['a'], categoryId: null, isDonation: false });
  });

  it('treats empty, broken or foreign data as no draft', () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft('{not json')).toBeNull();
    expect(parseDraft('"text"')).toBeNull();
    expect(parseDraft(JSON.stringify({ title: '', description: '' }))).toBeNull();
  });
});

describe('small helpers', () => {
  it('validates a question', () => {
    expect(questionError('  ')).toBe('Escribe tu pregunta.');
    expect(questionError('¿Funciona?')).toBeNull();
    expect(questionError('x'.repeat(301))).toContain('300');
  });

  it('asks for an older chat page only after a full one', () => {
    const page = (n: number) => Array.from({ length: n }, (_, i) => ({ created_at: `2026-11-17T10:00:${String(59 - i).padStart(2, '0')}Z` }));
    expect(olderCursor(page(3), 5)).toBeUndefined();
    expect(olderCursor(page(5), 5)).toBe('2026-11-17T10:00:55Z');
    expect(olderCursor([], 5)).toBeUndefined();
  });

  it('detects whether the photo list of an item changed', () => {
    const stored = [
      { id: 'p2', item_id: 'i', storage_path: 'b.jpg', position: 1, created_at: '' },
      { id: 'p1', item_id: 'i', storage_path: 'a.jpg', position: 0, created_at: '' },
    ];
    const edited = [{ uri: 'a', existing: stored[1] }, { uri: 'b', existing: stored[0] }];
    expect(photosUnchanged(stored, edited)).toBe(true);
    expect(photosUnchanged(stored, [...edited].reverse())).toBe(false);
    expect(photosUnchanged(stored, [edited[0]!])).toBe(false);
    expect(photosUnchanged(stored, [...edited, { uri: 'file:///new.jpg' }])).toBe(false);
  });
});

describe('splitMatches', () => {
  it('separates the two directions and keeps their order', () => {
    const { splitMatches } = jest.requireActual('@/features/matches/api') as typeof import('@/features/matches/api');
    const row = (direction: 'i_want' | 'they_want', item_id: string) => ({
      direction,
      item_id,
      item_title: 'x',
      item_kind: 'object' as const,
      is_donation: false,
      district: 'Barranco',
      photo_path: null,
      other_id: 'u',
      other_display_name: 'U',
      other_avatar_url: null,
      wish_query: null,
      distance_km: null,
      matched_at: '2026-11-17T00:00:00Z',
    });
    const out = splitMatches([row('i_want', '1'), row('they_want', '2'), row('i_want', '3')]);
    expect(out.iWant.map((r) => r.item_id)).toEqual(['1', '3']);
    expect(out.theyWant.map((r) => r.item_id)).toEqual(['2']);
  });
});

describe('handover code', () => {
  const { cleanCode, handoverLink, qrMatrix, qrPath } = jest.requireActual('@/features/trades/handover') as typeof import('@/features/trades/handover');

  it('accepts six digits however they were typed', () => {
    expect(cleanCode('123 456')).toBe('123456');
    expect(cleanCode('12-34-56')).toBe('123456');
    expect(cleanCode('12345')).toBe('');
    expect(cleanCode('1234567')).toBe('');
    expect(cleanCode(undefined)).toBe('');
  });

  it('builds the deep link the trade screen reads', () => {
    expect(handoverLink('abc', '004200')).toBe('truekea://trueke/abc?codigo=004200');
  });

  it('draws a square QR with finder patterns and a path that covers every dark module', () => {
    const matrix = qrMatrix(handoverLink('3f2b8c1e-1111-4222-8333-444455556666', '123456'));
    const n = matrix.length;
    expect(n).toBeGreaterThanOrEqual(21);
    expect(matrix.every((row) => row.length === n)).toBe(true);
    // 7x7 finder pattern: dark border, light ring, dark 3x3 centre
    for (const [r, c] of [[0, 0], [0, n - 7], [n - 7, 0]] as const) {
      expect(matrix[r]?.slice(c, c + 7).every(Boolean)).toBe(true);
      expect(matrix[r + 1]?.[c + 1]).toBe(false);
      expect(matrix[r + 3]?.[c + 3]).toBe(true);
    }
    const dark = matrix.flat().filter(Boolean).length;
    const covered = [...qrPath(matrix).matchAll(/h(\d+)v1/g)].reduce((sum, m) => sum + Number(m[1]), 0);
    expect(covered).toBe(dark);
  });
});

describe('impact card', () => {
  const { impactLines, impactMessage } = jest.requireActual('@/features/ayni/impact') as typeof import('@/features/ayni/impact');

  it('tells only what happened, with singular and plural', () => {
    expect(impactLines({ trades: 1, gifts: 0, circles: 2, co2Kg: 5 })).toEqual(['1 trueke completado', '2 círculos organizados']);
  });

  it('writes one sentence and the link', () => {
    expect(impactMessage({ trades: 3, gifts: 1, circles: 0, co2Kg: 20 }, 'https://example.org')).toBe(
      'Mi impacto en Truekea: 3 truekes completados y 1 regalo entregado. Eso evita cerca de 20 kg de CO₂. Cambia lo que no usas por lo que necesitas: https://example.org',
    );
    expect(impactMessage({ trades: 1, gifts: 0, circles: 0, co2Kg: 5 })).toBe(
      'Mi impacto en Truekea: 1 trueke completado. Eso evita cerca de 5 kg de CO₂. Cambia lo que no usas por lo que necesitas.',
    );
  });

  it('has nothing to share before the first trade', () => {
    expect(impactMessage({ trades: 0, gifts: 0, circles: 0, co2Kg: 0 })).toBeNull();
  });
});
