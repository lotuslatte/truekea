import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Wrappers defensivos de expo-haptics: no-op en web y nunca lanzan
// (en dispositivos sin motor háptico la promesa puede rechazar).

export function hapticCelebrate(): void {
  if (Platform.OS === 'web') return;
  try {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
      // Silencioso: la celebración visual sigue su curso.
    });
  } catch {
    // Silencioso.
  }
}

export function hapticTap(): void {
  if (Platform.OS === 'web') return;
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
      // Silencioso.
    });
  } catch {
    // Silencioso.
  }
}
