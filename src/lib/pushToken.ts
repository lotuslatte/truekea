import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

/**
 * Removes this device's push token before signing out. Without it the person
 * who signed out keeps receiving notifications on a phone that someone else
 * may now be using, and the next account cannot take over the token (RLS).
 * Must run while the session is still valid. Never throws.
 */
export async function unregisterPushToken(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (!Device.isDevice) return;
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await supabase.from('push_tokens').delete().eq('expo_token', token);
  } catch {
    // Signing out must not depend on this.
  }
}
