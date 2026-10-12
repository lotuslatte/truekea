import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chakana } from '@/features/intro/Chakana';
import { useIntroState } from '@/features/intro/introState';
import { fonts } from '@/theme/tokens';

type Scene = {
  bg: string;
  text: string;
  muted: string;
  accent: string;
  eyebrow: string;
  display: string;
  body: string;
  visual: 'chakana' | 'coin' | 'boxes' | 'return';
};

const SCENES: Scene[] = [
  {
    bg: '#241708',
    text: '#F2E3C4',
    muted: '#B99C6B',
    accent: '#E8B04B',
    eyebrow: 'EN LOS ANDES, HACE SIGLOS',
    display: 'Papa por pescado.\nLana por maíz.',
    body: 'El trueque unía a los pueblos del Tahuantinsuyo. También se intercambiaba lo que se sabía: dar y recibir era una forma de vivir.',
    visual: 'chakana',
  },
  {
    bg: '#37312C',
    text: '#D8CFC4',
    muted: '#8F857A',
    accent: '#9C938A',
    eyebrow: '1532 · LA CONQUISTA',
    display: 'Llegó la moneda.',
    body: 'El intercambio dejó de ser entre personas. Lo que antes era encuentro, se volvió mercancía.',
    visual: 'coin',
  },
  {
    bg: '#17191C',
    text: '#E8E8E6',
    muted: '#7A8288',
    accent: '#AEB6BC',
    eyebrow: 'HOY',
    display: 'Compramos.\nBotamos.\nRepetimos.',
    body: 'El consumismo llena la casa, vacía el bolsillo y ahoga al planeta.',
    visual: 'boxes',
  },
  {
    bg: '#FBFAF7',
    text: '#1B2620',
    muted: '#5D6E64',
    accent: '#12A150',
    eyebrow: 'TRUEKEA',
    display: 'Volvamos al trueke.',
    body: 'Cambia lo que ya no usas y lo que sabes hacer, con gente cerca de ti. Sin dinero. Como antes.',
    visual: 'return',
  },
];

function SceneVisual({ scene }: { scene: Scene }) {
  if (scene.visual === 'chakana' || scene.visual === 'return') {
    return <Chakana size={150} color={scene.accent} />;
  }
  if (scene.visual === 'coin') {
    return (
      <View style={styles.visualBox}>
        <View style={{ position: 'absolute' }}>
          <Chakana size={150} color={scene.muted} opacity={0.18} />
        </View>
        <View style={[styles.coin, { borderColor: scene.accent }]}>
          <View style={[styles.coinInner, { borderColor: scene.muted }]} />
        </View>
      </View>
    );
  }
  // boxes: la acumulación del consumo
  return (
    <View style={styles.boxGrid}>
      {Array.from({ length: 9 }, (_, i) => (
        <View
          key={i}
          style={[
            styles.box,
            { backgroundColor: i === 4 ? scene.accent : '#3A3F44' },
            i === 2 && { transform: [{ rotate: '6deg' }] },
            i === 6 && { transform: [{ rotate: '-4deg' }] },
          ]}
        />
      ))}
    </View>
  );
}

export default function IntroScreen() {
  const router = useRouter();
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const markSeen = useIntroState((s) => s.markSeen);
  const [index, setIndex] = useState(0);
  const [fade] = useState(() => new Animated.Value(1));
  const [rise] = useState(() => new Animated.Value(0));
  const transitioning = useRef(false);

  const scene = SCENES[index];
  const isLast = index === SCENES.length - 1;

  const finish = () => {
    if (replay) {
      router.back();
    } else {
      markSeen();
      router.replace('/');
    }
  };

  const advance = () => {
    if (transitioning.current) return;
    if (isLast) {
      finish();
      return;
    }
    transitioning.current = true;
    Animated.timing(fade, {
      toValue: 0,
      duration: 260,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setIndex((i) => i + 1);
      rise.setValue(16);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.timing(rise, {
          toValue: 0,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        transitioning.current = false;
      });
    });
  };

  return (
    <Pressable style={[styles.root, { backgroundColor: scene.bg }]} onPress={advance}>
      <SafeAreaView style={styles.safe}>
        {/* progreso: bandas tejidas, como las franjas de un textil andino */}
        <View style={styles.header}>
          <View style={styles.bands}>
            {SCENES.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.band,
                  {
                    backgroundColor: i <= index ? scene.accent : scene.muted,
                    opacity: i <= index ? 1 : 0.3,
                    flex: i === index ? 2.4 : 1,
                  },
                ]}
              />
            ))}
          </View>
          {!isLast ? (
            <Pressable onPress={finish} hitSlop={12} accessibilityRole="button">
              <Text style={[styles.skip, { color: scene.muted }]}>Saltar</Text>
            </Pressable>
          ) : null}
        </View>

        <Animated.View
          style={[styles.content, { opacity: fade, transform: [{ translateY: rise }] }]}
        >
          <View style={styles.visual}>
            <SceneVisual scene={scene} />
          </View>
          <Text style={[styles.eyebrow, { color: scene.muted }]}>{scene.eyebrow}</Text>
          <Text style={[styles.display, { color: scene.text }]}>{scene.display}</Text>
          <Text style={[styles.body, { color: scene.muted }]}>{scene.body}</Text>
        </Animated.View>

        <View style={styles.footer}>
          {isLast ? (
            <Pressable
              accessibilityRole="button"
              onPress={finish}
              style={[styles.cta, { backgroundColor: scene.accent }]}
            >
              <Text style={styles.ctaLabel}>Empezar 🌱</Text>
            </Pressable>
          ) : (
            <Text style={[styles.hint, { color: scene.muted }]}>Toca para continuar</Text>
          )}
        </View>
      </SafeAreaView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safe: {
    flex: 1,
    paddingHorizontal: 28,
    paddingVertical: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    minHeight: 24,
  },
  bands: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    height: 5,
  },
  band: {
    borderRadius: 3,
    height: '100%',
  },
  skip: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  visual: {
    alignItems: 'center',
    marginBottom: 44,
  },
  visualBox: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coin: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinInner: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 2,
    opacity: 0.6,
  },
  boxGrid: {
    width: 156,
    height: 156,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  box: {
    width: 48,
    height: 48,
    borderRadius: 6,
  },
  eyebrow: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 3,
    marginBottom: 14,
  },
  display: {
    fontFamily: fonts.heading,
    fontSize: 36,
    lineHeight: 42,
    marginBottom: 16,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
  },
  footer: {
    minHeight: 56,
    justifyContent: 'center',
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    opacity: 0.8,
  },
  cta: {
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  ctaLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 17,
    color: '#FFFFFF',
  },
});
