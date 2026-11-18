import AsyncStorage from '@react-native-async-storage/async-storage';

// Small persisted yes/no marks ("already explained", "dismissed"). Storage
// failures are swallowed: a mark that is lost only means asking once more.
export async function getFlag(key: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(`truekea:${key}`)) === '1';
  } catch {
    return false;
  }
}

export async function setFlag(key: string): Promise<void> {
  try {
    await AsyncStorage.setItem(`truekea:${key}`, '1');
  } catch {
    // Not persisted; the session continues.
  }
}
