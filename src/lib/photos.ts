import * as ImagePicker from 'expo-image-picker';

import { notify } from '@/lib/confirm';

export type PhotoSource = 'camera' | 'library';

/**
 * Opens the camera or the gallery and returns the chosen image URIs (empty
 * when cancelled). The camera permission is requested here, at the moment the
 * person taps the camera button; a refusal is explained with a toast.
 */
export async function pickPhotos(
  source: PhotoSource,
  opts: { limit?: number; square?: boolean } = {},
): Promise<string[]> {
  const limit = opts.limit ?? 1;
  if (limit <= 0) return [];
  try {
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        notify('No pudimos abrir la cámara', 'Activa el permiso de cámara en los ajustes o elige una foto de tu galería.');
        return [];
      }
      const shot = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: !!opts.square,
        aspect: opts.square ? [1, 1] : undefined,
      });
      return shot.canceled ? [] : shot.assets.slice(0, 1).map((a) => a.uri);
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: limit > 1,
      selectionLimit: limit > 1 ? limit : undefined,
      allowsEditing: limit === 1 && !!opts.square,
      aspect: opts.square ? [1, 1] : undefined,
    });
    return picked.canceled ? [] : picked.assets.slice(0, limit).map((a) => a.uri);
  } catch {
    notify('No pudimos abrir tus fotos', 'Inténtalo de nuevo.');
    return [];
  }
}
