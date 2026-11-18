import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { announceInApp } from '@/features/notifications/api';
import { confirmAction } from '@/lib/confirm';
import { getFlag, setFlag } from '@/lib/flags';
import { supabase } from '@/lib/supabase';

/**
 * Registers the device's Expo push token for the given user.
 * Defensive on purpose: it must never crash on web, Expo Go or simulators,
 * where push simply stays off. With `request: false` (the default) the system
 * dialog is never shown: the token is saved only if access was already given.
 */
export async function registerPushToken(userId: string, opts: { request?: boolean } = {}): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    if (!Device.isDevice) return false;

    let { status } = await Notifications.getPermissionsAsync();
    if (status === 'undetermined' && opts.request) {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return false;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'General',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await supabase
      .from('push_tokens')
      .upsert(
        { user_id: userId, expo_token: token, platform: Platform.OS },
        { onConflict: 'expo_token' },
      );
    return true;
  } catch {
    // Without push the app keeps working.
    return false;
  }
}

export type PrimeReason = 'offer' | 'publish' | 'question';

const PRIME_COPY: Record<PrimeReason, { title: string; message: string }> = {
  offer: {
    title: '¿Te avisamos cuando respondan tu oferta?',
    message: 'Te llegará una notificación cuando acepten, rechacen o te hagan una contraoferta. Puedes apagarlas cuando quieras en los ajustes del teléfono.',
  },
  publish: {
    title: '¿Te avisamos cuando te ofrezcan un trueke?',
    message: 'Te llegará una notificación cuando alguien ofrezca algo por tu publicación o te escriba. Puedes apagarlas cuando quieras en los ajustes del teléfono.',
  },
  question: {
    title: '¿Te avisamos cuando respondan tu pregunta?',
    message: 'Te llegará una notificación con la respuesta. Puedes apagarlas cuando quieras en los ajustes del teléfono.',
  },
};

/**
 * Explains why notifications help right after an action that will get an
 * answer later, and only then opens the system dialog. Asked once: a "no"
 * here is remembered and the system dialog stays unused for a later moment.
 */
export async function primeNotifications(reason: PrimeReason): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const userId = (await supabase.auth.getSession()).data.session?.user.id;
    if (!userId) return;
    if (!Device.isDevice) return;
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'undetermined') return;
    if (await getFlag('notifications_primed')) return;
    await setFlag('notifications_primed');
    confirmAction({
      ...PRIME_COPY[reason],
      confirmLabel: 'Activar avisos',
      cancelLabel: 'Ahora no',
      onConfirm: () => void registerPushToken(userId, { request: true }),
    });
  } catch {
    // Priming is optional.
  }
}

/**
 * Routes the user when they tap a push notification whose payload carries
 * a `url` (e.g. { url: '/chat/abc' }). No-op on web.
 */
export function usePushNotificationRouting(): void {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let subscription: Notifications.EventSubscription | undefined;
    try {
      subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        try {
          const url = response.notification.request.content.data?.url;
          if (typeof url === 'string' && url.length > 0) {
            router.push(url as never);
          }
        } catch {
          // Ignoramos payloads malformados.
        }
      });
    } catch {
      // expo-notifications no disponible (p. ej. Expo Go nuevo): seguimos sin push.
    }
    return () => {
      subscription?.remove();
    };
  }, []);
}

/**
 * Saves the push token once per signed-in session when access was already
 * given. It never asks: `primeNotifications` does, at a useful moment.
 */
export function usePushRegistration(): void {
  const { session } = useAuth();
  const registeredFor = useRef<string | null>(null);
  const uid = session?.user.id ?? null;

  useEffect(() => {
    if (!uid || registeredFor.current === uid) return;
    registeredFor.current = uid;
    void registerPushToken(uid);
  }, [uid]);
}

/**
 * While the app is open the system banner stays hidden and the push becomes a
 * toast, so the person is not interrupted twice. No-op on web.
 */
export function useForegroundNotifications(): void {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let subscription: Notifications.EventSubscription | undefined;
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: false,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
      subscription = Notifications.addNotificationReceivedListener((notification) => {
        const { title, body, data } = notification.request.content;
        const url = typeof data?.url === 'string' ? data.url : '';
        if (title) announceInApp(title, body ?? '', url, pathRef.current);
      });
    } catch {
      // expo-notifications unavailable: Realtime still announces new rows.
    }
    return () => {
      subscription?.remove();
    };
  }, []);
}
