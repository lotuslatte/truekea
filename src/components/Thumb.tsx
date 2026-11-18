import { Image } from 'expo-image';
import { StyleSheet, View, type ImageStyle, type StyleProp } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { publicPhotoUrl } from '@/lib/supabase';
import { colors, radius } from '@/theme/tokens';
import type { ItemKind } from '@/types/database';

export type ThumbItem = {
  kind: ItemKind;
  title?: string;
  item_photos?: { storage_path: string; position: number }[] | null;
};

/** Public URL of the cover photo (lowest position), or null without photos. */
export function coverUrl(item: Pick<ThumbItem, 'item_photos'> | null | undefined): string | null {
  const photos = item?.item_photos ?? [];
  if (photos.length === 0) return null;
  const cover = photos.reduce((best, p) => (p.position < best.position ? p : best));
  return publicPhotoUrl(cover.storage_path);
}

type Props = {
  /** null or undefined draws the gift placeholder: an offer with nothing in exchange. */
  item: ThumbItem | null | undefined;
  size?: number;
  /** Overrides the square default, for cards that set their own box. */
  style?: StyleProp<ImageStyle>;
};

/** Cover photo of an item, or an icon when it has none. One look for every list. */
export function Thumb({ item, size = 48, style }: Props) {
  const box = [styles.box, { width: size, height: size }, style];
  const url = coverUrl(item);
  if (item && url) {
    return <Image source={{ uri: url }} style={box} contentFit="cover" accessibilityLabel={item.title ? `Foto de ${item.title}` : undefined} />;
  }
  const flat = StyleSheet.flatten<ImageStyle>(box);
  const side = typeof flat.width === 'number' ? flat.width : size;
  const isKnowledge = item?.kind === 'knowledge';
  return (
    <View style={[box, styles.fallback, isKnowledge && styles.knowledge]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Icon
        name={!item ? 'gift' : isKnowledge ? 'knowledge' : 'image'}
        size={Math.max(18, Math.min(40, Math.round(side * 0.42)))}
        color={isKnowledge ? colors.accentInk : colors.inkMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.sm },
  fallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sand, borderWidth: 1, borderColor: colors.border },
  knowledge: { backgroundColor: colors.accentFaint, borderColor: colors.accentFaint },
});
