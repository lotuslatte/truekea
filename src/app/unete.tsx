import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Chakana } from '@/features/intro/Chakana';
import { colors, fonts, fontSizes, spacing } from '@/theme/tokens';

// Prompt de registro: aparece cuando un visitante intenta actuar
// (ofertar, publicar, chatear). Mirar es libre; truekear pide cuenta.
export default function UneteScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Chakana size={72} color={colors.primary} />
        <Text style={styles.title}>Únete al trueke</Text>
        <Text style={styles.subtitle}>
          Para ofrecer, publicar o chatear necesitas una cuenta. Toma menos de un minuto — y mirar
          sigue siendo libre.
        </Text>
        <View style={styles.actions}>
          <Button title="Continuar con mi celular" onPress={() => router.push('/phone')} />
          <Button
            title="Continuar con mi correo"
            variant="secondary"
            onPress={() => router.push('/correo')}
          />
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.back()}
            style={styles.browse}
          >
            <Text style={styles.browseLabel}>Solo estoy mirando</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.sand,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 28,
    color: colors.ink,
    marginTop: spacing.sm,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: 21,
  },
  actions: {
    alignSelf: 'stretch',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  browse: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  browseLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
    textDecorationLine: 'underline',
  },
});
