import { Image } from 'expo-image';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { MAX_PHOTOS, type EditablePhoto } from '@/features/items/photos';
import { pickPhotos, type PhotoSource } from '@/lib/photos';
import { colors, fonts, fontSizes, radius, spacing } from '@/theme/tokens';

type Props = {
  photos: EditablePhoto[];
  onChange: (photos: EditablePhoto[]) => void;
  disabled?: boolean;
};

/** Photo grid for publishing and editing: add from camera or gallery, remove, choose the cover. */
export function PhotoGridEditor({ photos, onChange, disabled }: Props) {
  const room = MAX_PHOTOS - photos.length;

  const add = async (source: PhotoSource) => {
    const uris = await pickPhotos(source, { limit: room });
    if (uris.length === 0) return;
    onChange([...photos, ...uris.map((uri) => ({ uri }))].slice(0, MAX_PHOTOS));
  };

  const remove = (index: number) => onChange(photos.filter((_, i) => i !== index));
  const makeCover = (index: number) => {
    const chosen = photos[index];
    if (!chosen) return;
    onChange([chosen, ...photos.filter((_, i) => i !== index)]);
  };

  return (
    <View style={styles.grid}>
      {photos.map((photo, i) => (
        <View key={`${photo.uri}-${i}`} style={styles.cell}>
          <Image source={{ uri: photo.uri }} style={styles.photo} contentFit="cover" accessibilityLabel={`Foto ${i + 1}`} />
          {i === 0 ? (
            <View style={styles.cover}>
              <Badge label="Portada" tone="accent" />
            </View>
          ) : (
            <Pressable
              disabled={disabled}
              onPress={() => makeCover(i)}
              accessibilityRole="button"
              accessibilityLabel={`Usar la foto ${i + 1} como portada`}
              style={styles.coverButton}
            >
              <Text style={styles.coverButtonText}>Portada</Text>
            </Pressable>
          )}
          <Pressable
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`Quitar foto ${i + 1}`}
            onPress={() => remove(i)}
            style={styles.remove}
            hitSlop={8}
          >
            <Icon name="close" size={16} color={colors.surface} />
          </Pressable>
        </View>
      ))}
      {room > 0 && Platform.OS !== 'web' ? (
        <Pressable
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="Tomar una foto"
          onPress={() => add('camera')}
          style={[styles.cell, styles.add]}
        >
          <Icon name="camera" size={28} color={colors.primary} />
          <Text style={styles.addLabel}>Cámara</Text>
        </Pressable>
      ) : null}
      {room > 0 ? (
        <Pressable
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="Elegir fotos de tu galería"
          onPress={() => add('library')}
          style={[styles.cell, styles.add]}
        >
          <Icon name="gallery" size={28} color={colors.primary} />
          <Text style={styles.addLabel}>Galería</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { width: '31.5%', aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface },
  photo: { width: '100%', height: '100%' },
  cover: { position: 'absolute', left: 4, bottom: 4 },
  coverButton: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.overlay,
  },
  coverButtonText: { fontFamily: fonts.bodySemi, fontSize: fontSizes.xs, color: '#FFFFFF' },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlay,
  },
  add: { alignItems: 'center', justifyContent: 'center', gap: 2, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primaryLight, backgroundColor: colors.primaryFaint },
  addLabel: { fontFamily: fonts.bodySemi, fontSize: fontSizes.xs, color: colors.primary },
});
