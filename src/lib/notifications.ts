import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

/**
 * Registers the device's Expo push token for the given user.
 * Defensive on purpose: it must never crash on web, Expo Go or simulators —
 * push simply stays off there.
 */
export async function registerPushToken(userId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (!Device.isDevice) return;

    let { status } = await Notifications.getPermissionsAsync();
    if (status === 'undetermined') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return;

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
  } catch {
    // Silencioso: sin push no pasa nada, la app sigue funcionando.
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
 * Registers the push token once per signed-in session.
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
