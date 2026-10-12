import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { useFeatureFlag } from '@/features/ads/useFeatureFlag';
import { colors, fonts, fontSizes, radius, shadows, spacing } from '@/theme/tokens';

/**
 * Slot de publicidad dormido. Comparte la silueta de la ItemCard compacta
 * (imagen cuadrada, radius y sombra, flex: 1) para encajar como una celda
 * más del grid cuando se conecte un SDK de ads real. Hoy solo pinta un
 * placeholder si el flag `ads_feed` está encendido; sin flag, no ocupa espacio.
 */
export function AdSlot() {
  const { data: flag } = useFeatureFlag('ads_feed');

  if (!flag?.enabled) return null;

  return (
    <View style={styles.card}>
      <View style={styles.media}>
        <View style={styles.badge}>
          <Badge label="Publicidad" tone="muted" />
        </View>
        <Text style={styles.placeholder}>Tu anuncio aquí</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    ...shadows.card,
  },
  media: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  badge: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
  },
  placeholder: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    color: colors.inkFaint,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
});
