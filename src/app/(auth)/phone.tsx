import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { supabase } from '@/lib/supabase';
import { colors, fonts, fontSizes, spacing } from '@/theme/tokens';

export default function PhoneScreen() {
  const router = useRouter();
  const [digits, setDigits] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [sending, setSending] = useState(false);

  const sendCode = async () => {
    const clean = digits.replace(/\D/g, '');
    if (clean.length !== 9) {
      setError('Ingresa un celular peruano de 9 dígitos');
      return;
    }
    setError(undefined);
    setSending(true);
    const phone = `+51${clean}`;
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone });
    setSending(false);
    if (otpError) {
      setError('Ups, no pudimos enviar el código. Inténtalo de nuevo en un momento.');
      return;
    }
    router.push({ pathname: '/otp', params: { phone } });
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.title}>¿Cuál es tu celular?</Text>
        <Text style={styles.subtitle}>
          Te enviaremos un código por SMS para verificar que eres tú. Así el trueke es más seguro
          para todos.
        </Text>
        <View style={styles.phoneRow}>
          <View style={styles.prefix}>
            <Text style={styles.prefixText}>🇵🇪 +51</Text>
          </View>
          <View style={styles.flex}>
            <TextField
              placeholder="987 654 321"
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              accessibilityLabel="Número de celular"
              value={digits}
              onChangeText={setDigits}
              error={error}
              maxLength={11}
              autoFocus
            />
          </View>
        </View>
        <Button title="Enviar código" onPress={sendCode} loading={sending} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    padding: spacing.xl,
    gap: spacing.lg,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
    lineHeight: 20,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  prefix: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  prefixText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
});
