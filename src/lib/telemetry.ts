import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Error reports (Sentry) and product events (PostHog), both off by default.
// Each one switches on only when its env var is set at build time; with the
// vars absent nothing here touches the network. They speak the public HTTP
// APIs of both services with fetch, so there is no SDK and no native code.
// What that costs: JavaScript errors only (no native crashes), and stack
// traces are not symbolicated unless source maps are uploaded to Sentry.
//
// Privacy: events carry an anonymous install id, the app version, the
// platform and a route with ids removed. No user id, name, phone or text
// typed by the person is sent.

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '';
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';
const RELEASE = 'truekea@0.1.0';

export type SentryTarget = { url: string; publicKey: string };

/** Envelope endpoint for a DSN such as https://key@o1.ingest.sentry.io/42, or null if malformed. */
export function parseDsn(dsn: string): SentryTarget | null {
  const match = /^(https?):\/\/([^@:/]+)(?::[^@]*)?@([^/]+)\/(?:(.+)\/)?(\d+)$/.exec(dsn.trim());
  if (!match) return null;
  const [, protocol, publicKey, host, path, projectId] = match;
  return { url: `${protocol}://${host}/${path ? `${path}/` : ''}api/${projectId}/envelope/`, publicKey: publicKey as string };
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Route without identifiers or query: "/item/3f…/ofertar?x=1" becomes "/item/:id/ofertar". */
export function scrubPath(path: string): string {
  const clean = (path.split(/[?#]/)[0] ?? '').replace(UUID, ':id').replace(/\/\d+(?=\/|$)/g, '/:id');
  return clean || '/';
}

/** Removes ids and long free text from an error message before it leaves the device. */
export function scrubMessage(message: string): string {
  return message.replace(UUID, ':id').replace(/\+?\d{7,}/g, ':number').slice(0, 300);
}

export function buildSentryEnvelope(
  error: { name?: string; message?: string; stack?: string },
  context: { route: string; platform: string; fatal: boolean; eventId: string; now: Date },
): string {
  const frames = (error.stack ?? '')
    .split('\n')
    .slice(1, 40)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ function: scrubMessage(line) }))
    .reverse();
  const event = {
    event_id: context.eventId,
    timestamp: context.now.getTime() / 1000,
    platform: 'javascript',
    level: context.fatal ? 'fatal' : 'error',
    release: RELEASE,
    tags: { os: context.platform, route: scrubPath(context.route) },
    exception: {
      values: [
        {
          type: error.name ?? 'Error',
          value: scrubMessage(error.message ?? ''),
          stacktrace: frames.length ? { frames } : undefined,
          mechanism: { handled: !context.fatal },
        },
      ],
    },
  };
  const header = { event_id: context.eventId, sent_at: context.now.toISOString() };
  return `${JSON.stringify(header)}\n${JSON.stringify({ type: 'event' })}\n${JSON.stringify(event)}\n`;
}

function hexId(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += Math.floor(Math.random() * 16).toString(16);
  return out;
}

let currentRoute = '/';
let installId: Promise<string> | null = null;

function getInstallId(): Promise<string> {
  installId ??= (async () => {
    try {
      const stored = await AsyncStorage.getItem('truekea:install_id');
      if (stored) return stored;
      const fresh = hexId(32);
      await AsyncStorage.setItem('truekea:install_id', fresh);
      return fresh;
    } catch {
      return hexId(32);
    }
  })();
  return installId;
}

export const telemetryEnabled = { errors: SENTRY_DSN.length > 0, events: POSTHOG_KEY.length > 0 };

/** Reports an error to Sentry. No-op without EXPO_PUBLIC_SENTRY_DSN. Never throws. */
export function reportError(error: unknown, fatal = false): void {
  const target = SENTRY_DSN ? parseDsn(SENTRY_DSN) : null;
  if (!target) return;
  try {
    const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Unknown error');
    const body = buildSentryEnvelope(err, {
      route: currentRoute,
      platform: Platform.OS,
      fatal,
      eventId: hexId(32),
      now: new Date(),
    });
    void fetch(target.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${target.publicKey}, sentry_client=truekea-fetch/1`,
      },
      body,
    }).catch(() => undefined);
  } catch {
    // Reporting must never break the app.
  }
}

export type TelemetryEvent =
  | 'screen'
  | 'item_published'
  | 'offer_sent'
  | 'offer_accepted'
  | 'trade_completed'
  | 'question_asked'
  | 'meeting_proposed';

/** Sends a product event to PostHog. No-op without EXPO_PUBLIC_POSTHOG_KEY. Never throws. */
export function track(event: TelemetryEvent, properties: Record<string, string | number | boolean> = {}): void {
  if (!POSTHOG_KEY) return;
  void getInstallId()
    .then((distinctId) =>
      fetch(`${POSTHOG_HOST.replace(/\/$/, '')}/capture/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: POSTHOG_KEY,
          event,
          distinct_id: distinctId,
          properties: { ...properties, $lib: 'truekea-fetch', release: RELEASE, os: Platform.OS, $process_person_profile: false },
          timestamp: new Date().toISOString(),
        }),
      }),
    )
    .catch(() => undefined);
}

/** Call on every route change: keeps the route for error reports and counts the screen. */
export function trackScreen(pathname: string): void {
  currentRoute = pathname;
  track('screen', { route: scrubPath(pathname) });
}

let installed = false;

/** Hooks uncaught errors once. Does nothing without EXPO_PUBLIC_SENTRY_DSN. */
export function initTelemetry(): void {
  if (installed || !SENTRY_DSN) return;
  installed = true;
  try {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return;
      window.addEventListener('error', (e) => reportError(e.error ?? e.message, true));
      window.addEventListener('unhandledrejection', (e) => reportError(e.reason, false));
      return;
    }
    const utils = (globalThis as { ErrorUtils?: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void } }).ErrorUtils;
    if (!utils) return;
    const previous = utils.getGlobalHandler();
    utils.setGlobalHandler((error, isFatal) => {
      reportError(error, !!isFatal);
      previous(error, isFatal);
    });
  } catch {
    // Telemetry is optional.
  }
}
