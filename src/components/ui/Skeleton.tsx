import { useEffect, useState } from 'react';
import { Animated, type ViewStyle } from 'react-native';

import { colors, radius } from '@/theme/tokens';

export function Skeleton({ style }: { style?: ViewStyle }) {
  // useState initializer instead of useRef: react-native-web has no useAnimatedValue.
  const [opacity] = useState(() => new Animated.Value(0.4));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      accessible={false}
      importantForAccessibility="no"
      style={[{ backgroundColor: colors.border, borderRadius: radius.sm, opacity }, style]}
    />
  );
}
