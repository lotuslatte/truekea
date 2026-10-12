import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { supabase } from '@/lib/supabase';
import { colors, fonts, fontSizes, spacing } from '@/theme/tokens';

export default function CorreoScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const sendLink = async () => {
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setError('Ingresa un correo válido');
      return;
    }
    setError(undefined);
    setSending(true);
    const { error: otpError } = await supabase.auth.signInWithOtp({ email: clean });
    setSending(false);
    if (otpError) {
      setError('Ups, no pudimos enviar el enlace. Inténtalo de nuevo en un momento.');
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <View style={styles.container}>
        <Text style={styles.bigEmoji} accessible={false} importantForAccessibility="no">
          📬
        </Text>
        <Text style={styles.title}>Revisa tu correo</Text>
        <Text style={styles.subtitle}>
          Te enviamos un enlace a {email.trim().toLowerCase()}. Tócalo y volverás aquí con tu
          sesión iniciada.
        </Text>
        <Button title="Reenviar enlace" variant="ghost" onPress={sendLink} loading={sending} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.title}>¿Cuál es tu correo?</Text>
        <Text style={styles.subtitle}>
          Te enviaremos un enlace de acceso — sin contraseñas que recordar.
        </Text>
        <TextField
          placeholder="tucorreo@ejemplo.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
          error={error}
          autoFocus
        />
        <Button title="Enviarme el enlace" onPress={sendLink} loading={sending} />
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
  bigEmoji: {
    fontSize: 44,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
    lineHeight: 20,
  },
});
