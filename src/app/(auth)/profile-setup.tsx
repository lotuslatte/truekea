import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { DistrictPicker } from '@/components/DistrictPicker';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { districtCentroid, toWkt } from '@/constants/districts';
import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { colors, fonts, fontSizes, spacing } from '@/theme/tokens';

export default function ProfileSetupScreen() {
  const { session, refreshProfile, signOut } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [district, setDistrict] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!session) return;
    const cleanUsername = username.trim().toLowerCase();
    if (displayName.trim().length < 2) {
      setError('Cuéntanos tu nombre');
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
      setError('El usuario debe tener 3-20 caracteres: letras minúsculas, números o _');
      return;
    }
    if (!district) {
      setError('Elige tu distrito para mostrarte truekes cercanos');
      return;
    }
    setError(undefined);
    setSaving(true);
    const centroid = districtCentroid(district);
    const { error: insertError } = await supabase.from('profiles').insert({
      id: session.user.id,
      username: cleanUsername,
      display_name: displayName.trim(),
      district,
      location: centroid ? toWkt(centroid) : null,
    });
    setSaving(false);
    if (insertError) {
      setError(
        insertError.code === '23505'
          ? 'Ese nombre de usuario ya está tomado, prueba otro'
          : 'Ups, no pudimos crear tu perfil. Inténtalo de nuevo en un momento.',
      );
      return;
    }
    await refreshProfile();
    // The root guard moves us to the tabs once the profile exists.
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>¡Ya casi! Crea tu perfil</Text>
      <TextField
        label="Tu nombre"
        placeholder="María Fernández"
        value={displayName}
        onChangeText={setDisplayName}
        maxLength={50}
      />
      <TextField
        label="Nombre de usuario"
        placeholder="maria_f"
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
        maxLength={20}
        hint="Así te verán los demás truekeros"
      />
      <DistrictPicker value={district} onChange={setDistrict} label="Tu distrito" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Empezar a truekear" onPress={save} loading={saving} />
      <Pressable onPress={signOut} accessibilityRole="button" hitSlop={8}>
        <Text style={styles.signOut}>Usar otro número</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    gap: spacing.lg,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    color: colors.ink,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.ink,
  },
  districtSection: {
    gap: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  districtChosen: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.primary,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.danger,
  },
  signOut: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
    textAlign: 'center',
    textDecorationLine: 'underline',
    paddingVertical: spacing.sm,
  },
});
