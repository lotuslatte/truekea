import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, fontSizes, spacing } from '@/theme/tokens';

type Props = {
  value: number;
  count?: number | null;
  size?: number;
  onChange?: (stars: number) => void;
};

export function RatingStars({ value, count, size = 14, onChange }: Props) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <View
      style={styles.row}
      accessible={!onChange}
      accessibilityLabel={
        onChange ? undefined : `Calificación: ${Math.round(value)} de 5 estrellas`
      }
    >
      {stars.map((star) =>
        onChange ? (
          <Pressable
            key={star}
            onPress={() => onChange(star)}
            accessibilityRole="button"
            accessibilityLabel={star === 1 ? '1 estrella' : `${star} estrellas`}
            hitSlop={8}
          >
            <Text style={{ fontSize: size + 8, color: star <= value ? colors.warning : colors.inkFaint }}>
              {star <= value ? '★' : '☆'}
            </Text>
          </Pressable>
        ) : (
          <Text
            key={star}
            style={{ fontSize: size, color: star <= Math.round(value) ? colors.warning : colors.inkFaint }}
          >
            {star <= Math.round(value) ? '★' : '☆'}
          </Text>
        ),
      )}
      {count != null ? <Text style={styles.count}>({count})</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  count: {
    marginLeft: spacing.xs,
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.inkMuted,
  },
});
