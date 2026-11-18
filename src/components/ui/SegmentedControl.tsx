import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, fontSizes, radius, spacing } from '@/theme/tokens';

type Option<T extends string> = { key: T; label: string; count?: number };

type Props<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (key: T) => void;
  style?: StyleProp<ViewStyle>;
};

/** Two to four equal pills that switch what a screen lists. */
export function SegmentedControl<T extends string>({ options, value, onChange, style }: Props<T>) {
  return (
    <View style={[styles.row, style]} accessibilityRole="tablist">
      {options.map(({ key, label, count }) => {
        const selected = key === value;
        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={count ? `${label}, ${count}` : label}
            onPress={() => onChange(key)}
            style={[styles.pill, selected && styles.pillSelected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
              {label}
              {count ? ` (${count})` : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  pill: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { fontFamily: fonts.bodySemi, fontSize: fontSizes.sm, color: colors.inkMuted },
  labelSelected: { color: colors.surface },
});
