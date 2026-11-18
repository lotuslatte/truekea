import { useMutation } from '@tanstack/react-query';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

/**
 * Resizes a picked image to 512 px, uploads it to the `avatars` bucket under
 * `${uid}/` (required by storage RLS) and points the profile at it. The
 * previous file is removed afterwards when it lived in the same folder.
 */
export function useUploadAvatar() {
  const { session, profile, refreshProfile } = useAuth();
  const uid = session?.user.id ?? '';

  return useMutation({
    mutationFn: async (uri: string): Promise<void> => {
      if (!uid) throw new Error('Inicia sesión para cambiar tu foto.');
      const resized = await manipulateAsync(uri, [{ resize: { width: 512 } }], {
        compress: 0.8,
        format: SaveFormat.JPEG,
      });
      const buf = await (await fetch(resized.uri)).arrayBuffer();
      const path = `${uid}/avatar-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, buf, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { error } = await supabase.from('profiles').update({ avatar_url: path }).eq('id', uid);
      if (error) {
        await supabase.storage.from('avatars').remove([path]).catch(() => undefined);
        throw error;
      }
      const previous = profile?.avatar_url;
      if (previous && previous.startsWith(`${uid}/`)) {
        await supabase.storage.from('avatars').remove([previous]).catch(() => undefined);
      }
      await refreshProfile();
    },
  });
}
