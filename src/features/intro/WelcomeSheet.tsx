import { useRouter } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Chakana } from '@/features/intro/Chakana';
import { useIntroState } from '@/features/intro/introState';
import { colors, fonts, fontSizes, radius, spacing } from '@/theme/tokens';

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'camera', title: 'Publica', text: 'Sube una foto de lo que ya no usas o cuenta lo que sabes hacer.' },
  { icon: 'swap', title: 'Ofrece', text: 'Propón un trueke por lo que te interesa. Aquí no se usa dinero.' },
  { icon: 'location', title: 'Encuéntrate', text: 'Coordina por chat y haz el cambio en un punto seguro.' },
];

/**
 * First-open welcome: one screen over the feed, which is already loaded
 * behind it. Any way of closing it counts as seen.
 */
export function WelcomeSheet() {
  const router = useRouter();
  const seen = useIntroState((s) => s.seen);
  const markSeen = useIntroState((s) => s.markSeen);
  if (seen !== false) return null;

  const close = () => void markSeen();

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Cerrar la bienvenida" />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.top}>
            <Chakana size={28} color={colors.primary} />
            <Pressable onPress={close} hitSlop={12} accessibilityRole="button">
              <Text style={styles.skip}>Saltar</Text>
            </Pressable>
          </View>
          <Text style={styles.title} accessibilityRole="header">
            Cambia lo que no usas por lo que necesitas
          </Text>
          <Text style={styles.lead}>Truekea junta a vecinos de Lima que intercambian objetos y saberes.</Text>
          <View style={styles.steps}>
            {STEPS.map((step) => (
              <View key={step.title} style={styles.step}>
                <View style={styles.stepIcon}>
                  <Icon name={step.icon} size={20} color={colors.primary} />
                </View>
                <View style={styles.stepBody}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepText}>{step.text}</Text>
                </View>
              </View>
            ))}
          </View>
          <Button title="Ver publicaciones" onPress={close} />
          <Button
            title="Conocer la historia del trueke"
            variant="ghost"
            onPress={() => {
              close();
              router.push('/intro?replay=1' as never);
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.sand,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skip: { fontFamily: fonts.bodySemi, fontSize: fontSizes.sm, color: colors.inkMuted },
  title: { fontFamily: fonts.heading, fontSize: fontSizes.xl, lineHeight: 28, color: colors.ink },
  lead: { fontFamily: fonts.body, fontSize: fontSizes.md, lineHeight: 22, color: colors.inkMuted },
  steps: { gap: spacing.md, marginVertical: spacing.sm },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  stepIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryFaint },
  stepBody: { flex: 1, gap: 2 },
  stepTitle: { fontFamily: fonts.bodySemi, fontSize: fontSizes.md, color: colors.ink },
  stepText: { fontFamily: fonts.body, fontSize: fontSizes.sm, lineHeight: 20, color: colors.inkMuted },
});
