import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { TextField } from '@/components/ui/TextField';
import { LIMA_DISTRICTS, districtCentroid, toWkt } from '@/constants/districts';
import { useAuth } from '@/features/auth/AuthProvider';
import { useBlockedUsers, useUnblockUser } from '@/features/moderation/api';
import { confirmAction, notify } from '@/lib/confirm';
import { supabase } from '@/lib/supabase';
import { colors, fonts, fontSizes, radius, spacing } from '@/theme/tokens';

export default function SettingsScreen() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [district, setDistrict] = useState<string | null>(profile?.district ?? null);
  const [districtQuery, setDistrictQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const blockedQuery = useBlockedUsers();
  const unblockUser = useUnblockUser();

  const filteredDistricts = LIMA_DISTRICTS.filter((d) =>
    d.name.toLowerCase().includes(districtQuery.toLowerCase()),
  );

  const saveProfile = async () => {
    if (!session) return;
    if (displayName.trim().length < 2) {
      notify('Un momento', 'Tu nombre necesita al menos 2 caracteres.');
      return;
    }
    setSaving(true);
    const districtChanged = district != null && district !== profile?.district;
    const centroid = districtChanged && district ? districtCentroid(district) : null;
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        district,
        ...(centroid ? { location: toWkt(centroid) } : {}),
      })
      .eq('id', session.user.id);
    setSaving(false);
    if (error) {
      notify('Ups', 'No pudimos guardar tus cambios. Inténtalo de nuevo.');
      return;
    }
    await refreshProfile();
    notify('¡Listo! 🌱', 'Tu perfil quedó actualizado.');
  };

  const deleteAccount = () => {
    confirmAction({
      title: '¿Eliminar tu cuenta?',
      message:
        'Esta acción es permanente: se borrarán tu perfil, tus publicaciones, tus chats y tus calificaciones. No podrás recuperarlos.',
      confirmLabel: 'Continuar',
      destructive: true,
      onConfirm: () => {
        confirmAction({
          title: '¿Estás realmente seguro?',
          message: 'Última confirmación. Tu cuenta se eliminará para siempre.',
          confirmLabel: 'Sí, eliminar mi cuenta',
          destructive: true,
          onConfirm: async () => {
            setDeleting(true);
            const { error } = await supabase.rpc('delete_account');
            setDeleting(false);
            if (error) {
              notify('Ups', 'No pudimos eliminar tu cuenta. Inténtalo de nuevo.');
              return;
            }
            await signOut();
          },
        });
      },
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.sectionTitle}>Mi perfil</Text>
      <TextField
        label="Tu nombre"
        placeholder="María Fernández"
        value={displayName}
        onChangeText={setDisplayName}
        maxLength={50}
      />
      <TextField
        label="Sobre ti"
        placeholder="Cuéntale a la comunidad qué te gusta truekear…"
        value={bio}
        onChangeText={setBio}
        multiline
        maxLength={300}
        style={styles.bioInput}
      />
      <View style={styles.districtSection}>
        <Text style={styles.label}>Tu distrito</Text>
        <TextField
          placeholder="Busca tu distrito…"
          value={districtQuery}
          onChangeText={setDistrictQuery}
        />
        <View style={styles.chips}>
          {(districtQuery ? filteredDistricts : LIMA_DISTRICTS).slice(0, 12).map((d) => (
            <Chip
              key={d.name}
              label={d.name}
              selected={district === d.name}
              onPress={() => setDistrict(d.name)}
            />
          ))}
        </View>
        {district ? <Text style={styles.districtChosen}>📍 {district}</Text> : null}
      </View>
      <Button title="Guardar cambios" onPress={saveProfile} loading={saving} />

      <Text style={styles.sectionTitle}>Usuarios bloqueados</Text>
      {blockedQuery.isError ? (
        <View style={styles.blockedError}>
          <Text style={styles.emptyText}>
            Ups, no pudimos cargar tu lista de bloqueados. Inténtalo de nuevo.
          </Text>
          <Button title="Reintentar" variant="ghost" onPress={() => blockedQuery.refetch()} />
        </View>
      ) : (blockedQuery.data ?? []).length === 0 ? (
        <Text style={styles.emptyText}>No tienes a nadie bloqueado. ¡Qué buena onda! 🌱</Text>
      ) : (
        <View style={styles.blockedList}>
          {(blockedQuery.data ?? []).map((row) => (
            <View key={row.blocked_id} style={styles.blockedRow}>
              <Avatar url={row.blocked.avatar_url} name={row.blocked.display_name} size={40} />
              <Text style={styles.blockedName} numberOfLines={1}>
                {row.blocked.display_name}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Desbloquear a ${row.blocked.display_name}`}
                onPress={() =>
                  unblockUser.mutate(row.blocked_id, {
                    onSuccess: () => notify('Listo', `Desbloqueaste a ${row.blocked.display_name}.`),
                    onError: () =>
                      notify('Ups, no pudimos desbloquear', 'Inténtalo de nuevo en un momento.'),
                  })
                }
                hitSlop={8}
              >
                <Text style={styles.unblockLink}>Desbloquear</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.sectionTitle}>Truekea</Text>
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push('/intro?replay=1' as never)}
        hitSlop={8}
      >
        <Text style={styles.legalLink}>Ver la historia del trueque 🌱</Text>
      </Pressable>
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push('/puntos-seguros')}
        hitSlop={8}
      >
        <Text style={styles.legalLink}>Puntos de encuentro seguros 🛡️</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Legal</Text>
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push('/terminos')}
        hitSlop={8}
      >
        <Text style={styles.legalLink}>Términos de uso</Text>
      </Pressable>
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push('/privacidad')}
        hitSlop={8}
      >
        <Text style={styles.legalLink}>Política de privacidad</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Cuenta</Text>
      <Button title="Cerrar sesión" variant="secondary" onPress={() => signOut()} />
      <Button
        title="Eliminar mi cuenta"
        variant="danger"
        onPress={deleteAccount}
        loading={deleting}
      />

      <Text style={styles.version}>Truekea v0.1.0 — hecho con 🌱 en Lima</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    gap: spacing.lg,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  sectionTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    color: colors.ink,
    marginTop: spacing.lg,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.ink,
  },
  bioInput: {
    minHeight: 80,
    textAlignVertical: 'top',
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
  emptyText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
  },
  blockedList: {
    gap: spacing.md,
  },
  blockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  blockedName: {
    flex: 1,
    fontFamily: fonts.bodySemi,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
  unblockLink: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  legalLink: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.primary,
    textDecorationLine: 'underline',
    paddingVertical: spacing.xs,
  },
  blockedError: {
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  version: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.inkFaint,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
