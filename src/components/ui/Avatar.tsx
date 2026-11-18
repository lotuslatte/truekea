import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { publicAvatarUrl } from '@/lib/supabase';
import { colors, fonts } from '@/theme/tokens';

type Props = {
  url: string | null;
  name: string;
  size?: number;
};

export function Avatar({ url, name, size = 40 }: Props) {
  const resolved = publicAvatarUrl(url);
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  if (resolved) {
    return (
      <Image
        source={{ uri: resolved }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        accessibilityLabel={`Avatar de ${name}`}
      />
    );
  }
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`Avatar de ${name}`}
      style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Text accessible={false} style={[styles.initials, { fontSize: Math.max(12, size * 0.4) }]}>
        {initials || '?'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.surface,
    fontFamily: fonts.bodySemi,
  },
});
