import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
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
            <Icon
              name="star"
              size={size + 12}
              weight={star <= value ? 'fill' : 'regular'}
              color={star <= value ? colors.warning : colors.inkFaint}
            />
          </Pressable>
        ) : (
          <Icon
            key={star}
            name="star"
            size={size + 2}
            weight={star <= Math.round(value) ? 'fill' : 'regular'}
            color={star <= Math.round(value) ? colors.warning : colors.inkFaint}
          />
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
