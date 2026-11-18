import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCategories } from '@/features/categories';
import { useCreateItem } from '@/features/items/api';
import { notify } from '@/lib/confirm';
import { pickPhotos } from '@/lib/photos';
import { colors, fonts, fontSizes, radius, spacing } from '@/theme/tokens';

/**
 * Publish an object without leaving the offer: a title and, if the person wants,
 * one photo. The rest (category, description, condition) gets sensible defaults
 * and can be completed later from the profile.
 */
export function QuickPublish({ targetTitle, onCreated }: { targetTitle: string; onCreated: (itemId: string) => void }) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const categories = useCategories('object');
  const createItem = useCreateItem();
  const [title, setTitle] = useState('');
  const [photo, setPhoto] = useState<{ uri: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async (source: 'camera' | 'library') => {
    const [uri] = await pickPhotos(source);
    if (uri) setPhoto({ uri });
  };

  const submit = () => {
    const clean = title.trim();
    if (clean.length < 3) {
      setError('Escribe qué ofreces, con al menos 3 letras.');
      return;
    }
    const list = categories.data ?? [];
    // "Otros" has no kind; fall back to the first category if it is missing.
    const category = list.find((c) => c.kind === null) ?? list[0];
    if (!category || !profile?.district) {
      setError('No pudimos preparar la publicación. Usa «Publicar» desde la pestaña del medio.');
      return;
    }
    setError(null);
    createItem.mutate(
      {
        title: clean,
        description: `Lo ofrezco a cambio de «${targetTitle}».`,
        categoryId: category.id,
        kind: 'object',
        format: null,
        modality: null,
        condition: 'used',
        eventAt: null,
        capacity: null,
        lookingFor: '',
        isDonation: false,
        district: profile.district,
        photos: photo ? [photo] : [],
      },
      {
        onSuccess: async (item) => {
          await queryClient.invalidateQueries({ queryKey: ['myItems'] });
          onCreated(item.id);
          notify('Listo, ya está publicado', 'Puedes completar la descripción y las fotos desde tu perfil.');
        },
        onError: () => setError('No se pudo publicar. Revisa tu conexión e inténtalo otra vez.'),
      },
    );
  };

  return (
    <View style={styles.box}>
      <Text style={styles.lead}>Aún no tienes nada publicado. Cuéntanos qué ofreces y lo publicamos por ti.</Text>
      <TextField
        label="¿Qué ofreces?"
        value={title}
        onChangeText={(t) => { setTitle(t); if (error) setError(null); }}
        placeholder="Ej.: guitarra acústica, clases de inglés…"
        maxLength={80}
        error={error ?? undefined}
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <View style={styles.photoRow}>
        {photo ? (
          <Pressable onPress={() => setPhoto(null)} accessibilityRole="button" accessibilityLabel="Quitar la foto">
            <Image source={{ uri: photo.uri }} style={styles.photo} contentFit="cover" />
          </Pressable>
        ) : null}
        <View style={styles.photoButtons}>
          {Platform.OS !== 'web' ? <Button variant="secondary" title="Tomar foto" onPress={() => pick('camera')} /> : null}
          <Button variant="secondary" title={photo ? 'Cambiar foto' : 'Elegir foto'} onPress={() => pick('library')} />
        </View>
      </View>
      <Text style={styles.hint}>La foto es opcional, pero las publicaciones con foto reciben más respuestas.</Text>
      <Button title="Publicar y ofrecer" onPress={submit} loading={createItem.isPending} disabled={createItem.isPending} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  lead: { fontFamily: fonts.body, fontSize: fontSizes.md, color: colors.ink },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  photo: { width: 72, height: 72, borderRadius: radius.md },
  photoButtons: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hint: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.inkMuted },
});
