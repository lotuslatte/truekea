import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { colors } from '@/theme/tokens';

type Props = {
  icon: IconName;
  children: React.ReactNode;
  /** Style of the text; the icon takes its colour and a matching size. */
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  numberOfLines?: number;
  /** Puts the icon after the text, for links such as «Ver trueke». */
  after?: boolean;
};

/** A line of metadata with its icon: district, date, seats. */
export function IconText({ icon, children, style, containerStyle, numberOfLines, after }: Props) {
  const flat = StyleSheet.flatten(style) ?? {};
  const fontSize = typeof flat.fontSize === 'number' ? flat.fontSize : 14;
  const color = typeof flat.color === 'string' ? flat.color : colors.inkMuted;
  return (
    <View style={[styles.row, after && styles.reverse, containerStyle]}>
      <Icon name={icon} size={Math.round(fontSize * 1.15)} color={color} />
      <Text style={[styles.text, style]} numberOfLines={numberOfLines}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  reverse: { flexDirection: 'row-reverse', justifyContent: 'flex-end' },
  text: { flexShrink: 1 },
});
