import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native';

import { hapticCelebrate } from '@/lib/haptics';

// Lluvia de hojas para celebrar hitos del trueke. Sin dependencias:
// Animated clásico, cross-platform (web + nativo). Cada vez que `burst`
// incrementa (>0) se dispara una tanda de partículas que caen, se balancean,
// giran y se desvanecen; al terminar se desmontan solas.

const LEAF_EMOJIS = ['🍃', '🌿', '✨'];
const PARTICLE_COUNT = 16;

type Particle = {
  key: string;
  burstId: number;
  emoji: string;
  left: number;
  size: number;
  duration: number;
  delay: number;
  sway: number;
  spin: string;
  progress: Animated.Value;
};

function makeParticles(burstId: number, width: number): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, index) => ({
    key: `${burstId}-${index}`,
    burstId,
    emoji: LEAF_EMOJIS[Math.floor(Math.random() * LEAF_EMOJIS.length)] ?? '🍃',
    left: Math.random() * Math.max(width - 32, 1),
    size: 18 + Math.random() * 12,
    duration: 1400 + Math.random() * 600,
    delay: Math.random() * 350,
    sway: (16 + Math.random() * 40) * (Math.random() < 0.5 ? -1 : 1),
    spin: `${Math.round((180 + Math.random() * 420) * (Math.random() < 0.5 ? -1 : 1))}deg`,
    progress: new Animated.Value(0),
  }));
}

export function LeafConfetti({ burst }: { burst: number }) {
  const { width, height } = useWindowDimensions();
  const [particles, setParticles] = useState<Particle[]>([]);
  const lastBurst = useRef(0);

  useEffect(() => {
    if (burst <= 0 || burst === lastBurst.current) return;
    lastBurst.current = burst;

    // Una sola vibración de celebración por tanda de hojas.
    hapticCelebrate();

    const batch = makeParticles(burst, width);
    setParticles((prev) => [...prev, ...batch]);

    Animated.parallel(
      batch.map((particle) =>
        Animated.timing(particle.progress, {
          toValue: 1,
          duration: particle.duration,
          delay: particle.delay,
          easing: Easing.in(Easing.sin),
          useNativeDriver: true,
        }),
      ),
    ).start(() => {
      setParticles((prev) => prev.filter((particle) => particle.burstId !== burst));
    });
  }, [burst, width]);

  if (particles.length === 0) return null;

  return (
    <Animated.View pointerEvents="none" style={styles.overlay}>
      {particles.map((particle) => (
        <Animated.Text
          key={particle.key}
          style={[
            styles.particle,
            {
              left: particle.left,
              fontSize: particle.size,
              opacity: particle.progress.interpolate({
                inputRange: [0, 0.7, 1],
                outputRange: [1, 1, 0],
              }),
              transform: [
                {
                  translateY: particle.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, height + 100],
                  }),
                },
                {
                  translateX: particle.progress.interpolate({
                    inputRange: [0, 0.25, 0.5, 0.75, 1],
                    outputRange: [
                      0,
                      particle.sway,
                      -particle.sway * 0.8,
                      particle.sway * 0.6,
                      0,
                    ],
                  }),
                },
                {
                  rotate: particle.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', particle.spin],
                  }),
                },
              ],
            },
          ]}
        >
          {particle.emoji}
        </Animated.Text>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1000,
    overflow: 'hidden',
  },
  particle: {
    position: 'absolute',
    top: -40,
  },
});
