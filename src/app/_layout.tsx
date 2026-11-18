import { Baloo2_600SemiBold, Baloo2_700Bold, useFonts } from '@expo-google-fonts/baloo-2';
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, ThemeProvider, usePathname, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';

import { Appearance, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { ToastHost } from '@/components/ui/ToastHost';
import { useIntroState } from '@/features/intro/introState';
import { useNotificationsRealtime } from '@/features/notifications/api';
import { useForegroundNotifications, usePushNotificationRouting, usePushRegistration } from '@/lib/notifications';
import { queryClient } from '@/lib/queryClient';
import { initTelemetry, trackScreen } from '@/lib/telemetry';
import { toast } from '@/lib/toast';
import { navigationTheme } from '@/theme/navigation';
import { colorScheme, colors, fonts } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();
// No-op unless EXPO_PUBLIC_SENTRY_DSN is set (see .env.example).
initTelemetry();

// Rutas que un visitante sin cuenta no puede abrir por URL directa.
// Mirar (feed, detalle de item) es libre; actuar pide cuenta.
// A visitor may open a public profile: seeing who is behind a listing builds trust before signing up.
const PROTECTED_TOP = new Set(['oferta', 'chat', 'trueke', 'calificar', 'ajustes', 'encuentros', 'insignias', 'deseos', 'notificaciones', 'coincidencias', 'impacto']);
const PROTECTED_TABS = new Set(['ofertas', 'chats', 'perfil', 'publicar']);

function RootNavigator() {
  const { session, profile, loading } = useAuth();
  const introSeen = useIntroState((s) => s.seen);
  const loadIntro = useIntroState((s) => s.load);
  const segments = useSegments();
  const router = useRouter();

  usePushRegistration();
  usePushNotificationRouting();
  useForegroundNotifications();
  useNotificationsRealtime();

  useEffect(() => {
    loadIntro();
  }, [loadIntro]);

  const pathname = usePathname();
  useEffect(() => {
    trackScreen(pathname);
  }, [pathname]);

  useEffect(() => {
    if (loading || introSeen === null) return;
    const parts = segments as string[];
    const top = parts[0];
    const second = parts[1];

    // 1. The feed is the first screen. The welcome sheet opens over it once
    // (WelcomeSheet); the trueke story is optional and reached from there.
    if (top === 'intro') return;

    // 2. Cuenta creada pero sin perfil: completar el registro.
    if (session && !profile) {
      if (second !== 'profile-setup') router.replace('/profile-setup');
      return;
    }

    // 3. Ya autenticado: fuera de las pantallas de auth.
    if (session && profile && (top === '(auth)' || top === 'unete')) {
      router.replace('/');
      return;
    }

    // 4. Visitante intentando abrir una ruta de acción por URL directa.
    if (!session) {
      const isProtected =
        (top && PROTECTED_TOP.has(top)) ||
        (top === 'item' && (second === 'nuevo' || parts[2] === 'ofertar')) ||
        (top === '(tabs)' && !!second && PROTECTED_TABS.has(second));
      if (isProtected) router.replace('/unete');
    }
  }, [loading, introSeen, session, profile, segments, router]);

  // No screen mounts until the session hydrates from storage: otherwise a
  // deep-link reload fires queries without the auth token and caches junk.
  if (loading || introSeen === null) return null;

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
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="intro" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="unete" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="item/nuevo" options={{ presentation: 'modal', title: 'Publicar' }} />
      <Stack.Screen name="item/[id]/index" options={{ title: '' }} />
      <Stack.Screen name="item/[id]/ofertar" options={{ presentation: 'modal', title: 'Ofrecer trueke' }} />
      <Stack.Screen name="oferta/[id]" options={{ title: 'Oferta' }} />
      <Stack.Screen name="chat/[id]" options={{ title: 'Chat' }} />
      <Stack.Screen name="trueke/[id]" options={{ title: 'Trueke' }} />
      <Stack.Screen name="calificar/[tradeId]" options={{ presentation: 'modal', title: 'Calificar' }} />
      <Stack.Screen name="usuario/[id]" options={{ title: 'Perfil' }} />
      <Stack.Screen name="encuentros" options={{ title: 'Mis encuentros' }} />
      <Stack.Screen name="insignias" options={{ title: 'Mis insignias' }} />
      <Stack.Screen name="notificaciones" options={{ title: 'Notificaciones' }} />
      <Stack.Screen name="impacto" options={{ title: 'Mi impacto' }} />
      <Stack.Screen name="coincidencias" options={{ title: 'Coincidencias' }} />
      <Stack.Screen name="deseos" options={{ title: 'Deseos y guardados' }} />
      <Stack.Screen name="puntos-seguros" options={{ title: 'Puntos seguros' }} />
      <Stack.Screen name="terminos" options={{ title: 'Términos de uso' }} />
      <Stack.Screen name="privacidad" options={{ title: 'Privacidad' }} />
      <Stack.Screen name="ajustes" options={{ title: 'Ajustes' }} />
    </Stack>
  );
}

// En desktop la app vive en un marco central tipo teléfono: legible y elegante
// sin duplicar layouts. El feed interno ya es responsive dentro del marco.
function DesktopFrame({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  if (Platform.OS !== 'web' || width < 768) return <>{children}</>;
  return (
    <View style={frameStyles.backdrop}>
      <View style={frameStyles.frame}>{children}</View>
    </View>
  );
}

const frameStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colorScheme === 'dark' ? '#0B0E0C' : '#ECEFE9',
    alignItems: 'center',
    paddingVertical: 24,
  },
  frame: {
    flex: 1,
    width: 480,
    maxWidth: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.sand,
    ...{
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.18,
      shadowRadius: 40,
    },
  },
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Baloo2_600SemiBold,
    Baloo2_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  // The palette is resolved once at launch (static StyleSheets). When the
  // system switches between light and dark while the app is open, the web
  // reloads to pick it up; on a phone it applies the next time the app opens.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.sand).catch(() => undefined);
    const subscription = Appearance.addChangeListener(({ colorScheme: next }) => {
      if (!next || next === colorScheme) return;
      if (Platform.OS === 'web') window.location.reload();
      else toast('Cambió el tema del sistema', 'Truekea lo aplicará la próxima vez que la abras.');
    });
    return () => subscription.remove();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <ThemeProvider value={navigationTheme}>
          <DesktopFrame>
            <RootNavigator />
            <ToastHost />
          </DesktopFrame>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
