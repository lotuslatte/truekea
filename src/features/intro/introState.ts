import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const KEY = 'truekea:intro_seen';

type IntroState = {
  seen: boolean | null; // null = aún no se leyó del storage
  load: () => Promise<void>;
  markSeen: () => Promise<void>;
};

export const useIntroState = create<IntroState>((set) => ({
  seen: null,
  load: async () => {
    try {
      const value = await AsyncStorage.getItem(KEY);
      set({ seen: value === '1' });
    } catch {
      set({ seen: true }); // ante la duda, no bloquear la app
    }
  },
  markSeen: async () => {
    set({ seen: true });
    try {
      await AsyncStorage.setItem(KEY, '1');
    } catch {
      // sin storage igual continúa la sesión
    }
  },
}));
