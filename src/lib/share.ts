import { Platform, Share } from 'react-native';

import { notify } from '@/lib/confirm';

// Comparte una publicación con el enlace web público. En nativo usa la hoja
// de compartir del sistema; en web intenta la Web Share API y, si no existe,
// copia el enlace al portapapeles.
export async function shareItem(input: { id: string; title: string }): Promise<void> {
  const base = process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:8081';
  const url = `${base}/item/${input.id}`;
  const message = `Mira «${input.title}» en Truekea 🌱 ${url}`;

  if (Platform.OS !== 'web') {
    try {
      await Share.share({ message });
    } catch {
      // Si la hoja de compartir falla o se cierra, no interrumpimos nada.
    }
    return;
  }

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: input.title, text: message, url });
    } catch {
      // Cancelar el diálogo de compartir lanza AbortError: lo ignoramos.
    }
    return;
  }

  try {
    await navigator.clipboard.writeText(url);
    notify('Enlace copiado', 'Pégalo donde quieras compartirlo.');
  } catch {
    // Sin portapapeles disponible (permisos/contexto): no hacemos nada.
  }
}

/** Shares plain text: system sheet on native, Web Share or the clipboard on web. */
export async function shareText(message: string, title = 'Truekea'): Promise<void> {
  if (Platform.OS !== 'web') {
    try {
      await Share.share({ message });
    } catch {
      // A closed or failed share sheet interrupts nothing.
    }
    return;
  }
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text: message });
    } catch {
      // Cancelling the dialog throws AbortError.
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(message);
    notify('Texto copiado', 'Pégalo donde quieras compartirlo.');
  } catch {
    notify('No se pudo copiar el texto');
  }
}
