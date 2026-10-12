import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { supabase } from '@/lib/supabase';
import { colors, fonts, fontSizes, spacing } from '@/theme/tokens';

const RESEND_SECONDS = 60;

// Verificación unificada: sirve para celular (SMS) y para correo (email OTP).
export default function OtpScreen() {
  const router = useRouter();
  const { phone, email } = useLocalSearchParams<{ phone?: string; email?: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  const target = phone ?? email;
  const channel = phone ? 'sms' : 'email';

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const verify = async () => {
    if (!target || code.length !== 6) {
      setError('Ingresa el código de 6 dígitos');
      return;
    }
    setError(undefined);
    setVerifying(true);
    const { error: verifyError } = phone
      ? await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' })
      : await supabase.auth.verifyOtp({ email: email!, token: code, type: 'email' });
    setVerifying(false);
    if (verifyError) {
      setError('Código incorrecto o vencido. Inténtalo de nuevo.');
      return;
    }
    // El guard decide: profile-setup si es cuenta nueva, o de vuelta a la app.
    router.dismissTo('/');
  };

  const resend = async () => {
    if (!target) return;
    setCooldown(RESEND_SECONDS);
    if (phone) await supabase.auth.signInWithOtp({ phone });
    else if (email) await supabase.auth.signInWithOtp({ email });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {channel === 'sms' ? 'Revisa tus mensajes' : 'Revisa tu correo'}
      </Text>
      <Text style={styles.subtitle}>Enviamos un código de 6 dígitos a {target}.</Text>
      <TextField
        placeholder="123456"
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        accessibilityLabel="Código de verificación de 6 dígitos"
        value={code}
        onChangeText={setCode}
        error={error}
        maxLength={6}
        autoFocus
        style={styles.codeInput}
      />
      <Button title="Verificar" onPress={verify} loading={verifying} />
      <Button
        title={cooldown > 0 ? `Reenviar código en ${cooldown}s` : 'Reenviar código'}
        variant="ghost"
        disabled={cooldown > 0}
        onPress={resend}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
  },
  codeInput: {
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 8,
  },
});
