import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { useRequireAuth } from '@/features/auth/useRequireAuth';
import { useMyChats } from '@/features/chat/api';
import { Chakana } from '@/features/intro/Chakana';
import { usePendingOfferCount, useUnreadNotificationCount } from '@/features/notifications/api';
import { colors, fonts, spacing } from '@/theme/tokens';

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
  bell: {
    marginRight: spacing.lg,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellCount: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    lineHeight: 16,
    color: colors.surface,
  },
});

// Bell in the Explorar header: the way into the notifications inbox.
function InboxBell({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `Notificaciones, ${count} sin leer` : 'Notificaciones'}
      style={wordmarkStyles.bell}
    >
      <Icon name="bell" weight={count > 0 ? 'fill' : 'regular'} size={24} color={colors.ink} />
      {count > 0 ? (
        <View style={wordmarkStyles.bellDot}>
          <Text style={wordmarkStyles.bellCount}>{count > 9 ? '9+' : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function badge(count: number): string | number | undefined {
  if (count <= 0) return undefined;
  return count > 99 ? '99+' : count;
}

export default function TabsLayout() {
  const router = useRouter();
  const { isAuthenticated } = useRequireAuth();
  const insets = useSafeAreaInsets();
  const pendingOffers = usePendingOfferCount().data ?? 0;
  const unreadNotifications = useUnreadNotificationCount().data ?? 0;
  const chats = useMyChats(isAuthenticated);
  const unreadChats = (chats.data ?? []).reduce((sum, c) => sum + Number(c.unread_count ?? 0), 0);

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
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 12 },
        tabBarBadgeStyle: { backgroundColor: colors.danger, color: colors.surface, fontFamily: fonts.bodySemi, fontSize: 12 },
        // Taller than the default 49: icon plus a 12 px label were clipped.
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 60 + insets.bottom, paddingTop: 4 },
        sceneStyle: { backgroundColor: colors.sand },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Explorar',
          headerTitle: () => <Wordmark />,
          headerRight: () => (
            <InboxBell
              count={unreadNotifications}
              onPress={() => router.push((isAuthenticated ? '/notificaciones' : '/unete') as never)}
            />
          ),
          tabBarIcon: ({ color, size, focused }) => <Icon name="explore" color={color} size={size} weight={focused ? 'fill' : 'regular'} />,
        }}
      />
      <Tabs.Screen
        name="ofertas"
        options={{
          title: 'Ofertas',
          tabBarBadge: badge(pendingOffers),
          tabBarAccessibilityLabel: pendingOffers > 0 ? `Ofertas, ${pendingOffers} por responder` : 'Ofertas',
          tabBarIcon: ({ color, size, focused }) => <Icon name="swap" color={color} size={size} weight={focused ? 'bold' : 'regular'} />,
        }}
        listeners={gated()}
      />
      <Tabs.Screen
        name="publicar"
        options={{
          title: 'Publicar',
          tabBarIcon: ({ color, size }) => <Icon name="publish" color={color} size={size + 6} weight="fill" />,
        }}
        listeners={gated('/item/nuevo')}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
          tabBarBadge: badge(unreadChats),
          tabBarAccessibilityLabel: unreadChats > 0 ? `Chats, ${unreadChats} mensajes sin leer` : 'Chats',
          tabBarIcon: ({ color, size, focused }) => <Icon name="chats" color={color} size={size} weight={focused ? 'fill' : 'regular'} />,
        }}
        listeners={gated()}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size, focused }) => <Icon name="person" color={color} size={size} weight={focused ? 'fill' : 'regular'} />,
        }}
        listeners={gated()}
      />
    </Tabs>
  );
}
