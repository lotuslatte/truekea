import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInDown, FadeOut, ReduceMotion } from 'react-native-reanimated';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Milliseconds to wait before entering, to stagger a short list. */
  delay?: number;
};

/**
 * Fades its content in with a short rise and fades it out when it unmounts.
 * For banners and cards that appear in response to something; not for long
 * lists. Skipped when the system asks for reduced motion.
 */
export function Appear({ children, style, delay = 0 }: Props) {
  return (
    <Animated.View
      style={style}
      entering={FadeInDown.duration(220).delay(delay).reduceMotion(ReduceMotion.System)}
      exiting={FadeOut.duration(140).reduceMotion(ReduceMotion.System)}
    >
      {children}
    </Animated.View>
  );
}
