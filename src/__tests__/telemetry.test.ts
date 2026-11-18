import { buildSentryEnvelope, parseDsn, reportError, scrubMessage, scrubPath, telemetryEnabled, track, trackScreen } from '@/lib/telemetry';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('telemetry is off without keys', () => {
  it('sends nothing when the env vars are absent', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null));
    expect(telemetryEnabled).toEqual({ errors: false, events: false });
    reportError(new Error('boom'), true);
    track('offer_sent');
    trackScreen('/item/3f2b8c1e-1111-4222-8333-444455556666');
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('parseDsn', () => {
  it('builds the envelope endpoint', () => {
    expect(parseDsn('https://abc123@o99.ingest.sentry.io/4507')).toEqual({
      url: 'https://o99.ingest.sentry.io/api/4507/envelope/',
      publicKey: 'abc123',
    });
    expect(parseDsn('https://abc123@sentry.example.org/prefix/7')?.url).toBe('https://sentry.example.org/prefix/api/7/envelope/');
  });

  it('rejects malformed values', () => {
    expect(parseDsn('')).toBeNull();
    expect(parseDsn('not a dsn')).toBeNull();
    expect(parseDsn('https://o99.ingest.sentry.io/4507')).toBeNull();
  });
});

describe('scrubbing', () => {
  it('removes ids and queries from routes', () => {
    expect(scrubPath('/item/3f2b8c1e-1111-4222-8333-444455556666/ofertar?ref=feed')).toBe('/item/:id/ofertar');
    expect(scrubPath('/chat/3F2B8C1E-1111-4222-8333-444455556666')).toBe('/chat/:id');
    expect(scrubPath('/puntos-seguros')).toBe('/puntos-seguros');
    expect(scrubPath('')).toBe('/');
  });

  it('removes ids and phone numbers from messages', () => {
    expect(scrubMessage('No row 3f2b8c1e-1111-4222-8333-444455556666 for +51987654321')).toBe('No row :id for :number');
    expect(scrubMessage('x'.repeat(500))).toHaveLength(300);
  });
});

describe('buildSentryEnvelope', () => {
  it('produces three JSON lines with the scrubbed event', () => {
    const error = new Error('Falló 3f2b8c1e-1111-4222-8333-444455556666');
    error.stack = 'Error: Falló\n    at save (app.js:1:1)\n    at press (app.js:2:2)';
    const envelope = buildSentryEnvelope(error, {
      route: '/trueke/3f2b8c1e-1111-4222-8333-444455556666',
      platform: 'android',
      fatal: true,
      eventId: 'a'.repeat(32),
      now: new Date('2026-11-17T12:00:00Z'),
    });
    const lines = envelope.trim().split('\n').map((l) => JSON.parse(l));
    expect(lines).toHaveLength(3);
    expect(lines[0]).toEqual({ event_id: 'a'.repeat(32), sent_at: '2026-11-17T12:00:00.000Z' });
    expect(lines[1]).toEqual({ type: 'event' });
    expect(lines[2].level).toBe('fatal');
    expect(lines[2].tags).toEqual({ os: 'android', route: '/trueke/:id' });
    expect(lines[2].exception.values[0].value).toBe('Falló :id');
    expect(lines[2].exception.values[0].stacktrace.frames.map((f: { function: string }) => f.function)).toEqual([
      'at press (app.js:2:2)',
      'at save (app.js:1:1)',
    ]);
    expect(JSON.stringify(lines[2])).not.toContain('3f2b8c1e');
  });
});
