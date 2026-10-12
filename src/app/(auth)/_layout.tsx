import { Stack } from 'expo-router';

import { colors, fonts } from '@/theme/tokens';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.sand },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontFamily: fonts.headingSemi },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.sand },
      }}
    >
      <Stack.Screen name="phone" options={{ title: 'Tu celular' }} />
      <Stack.Screen name="correo" options={{ title: 'Tu correo' }} />
      <Stack.Screen name="otp" options={{ title: 'Verificación' }} />
      <Stack.Screen name="profile-setup" options={{ title: 'Crea tu perfil', headerBackVisible: false }} />
    </Stack>
  );
}
