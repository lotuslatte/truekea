import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useRequireAuth } from '@/features/auth/useRequireAuth';
import { Chakana } from '@/features/intro/Chakana';
import { colors, fonts } from '@/theme/tokens';

// La marca vive donde más tiempo pasa la gente: el header de Explorar.
function Wordmark() {
  return (
    <View style={wordmarkStyles.row}>
      <Chakana size={22} color={colors.primary} />
      <Text style={wordmarkStyles.name}>Truekea</Text>
    </View>
  );
}

const wordmarkStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontFamily: fonts.heading,
    fontSize: 24,
    color: colors.ink,
  },
});

export default function TabsLayout() {
  const router = useRouter();
  const { isAuthenticated } = useRequireAuth();

  // Los visitantes exploran libremente; las pestañas de acción invitan a unirse.
  const gated = (screen?: string) => ({
    tabPress: (e: { preventDefault: () => void }) => {
      if (!isAuthenticated) {
        e.preventDefault();
        router.push('/unete');
      } else if (screen) {
        e.preventDefault();
        router.push(screen as never);
      }
    },
  });

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.sand },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontFamily: fonts.heading, fontSize: 22 },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 11 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.sand },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Explorar',
          headerTitle: () => <Wordmark />,
          tabBarIcon: ({ color, size }) => <Ionicons name="leaf" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="ofertas"
        options={{
          title: 'Ofertas',
          tabBarIcon: ({ color, size }) => <Ionicons name="swap-horizontal" color={color} size={size} />,
        }}
        listeners={gated()}
      />
      <Tabs.Screen
        name="publicar"
        options={{
          title: 'Publicar',
          tabBarIcon: ({ color, size }) => <Ionicons name="add-circle" color={color} size={size + 6} />,
        }}
        listeners={gated('/item/nuevo')}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" color={color} size={size} />,
        }}
        listeners={gated()}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} />,
        }}
        listeners={gated()}
      />
    </Tabs>
  );
}
