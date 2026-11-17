import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type Toast, useToasts } from '@/lib/toast';
import { colors, fonts, fontSizes, radius, shadows, spacing } from '@/theme/tokens';

const ICON: Record<Toast['kind'], keyof typeof Ionicons.glyphMap> = { success: 'checkmark-circle', error: 'alert-circle', info: 'information-circle' };
const TINT: Record<Toast['kind'], string> = { success: colors.primary, error: colors.danger, info: colors.inkMuted };

function ToastCard({ toast }: { toast: Toast }) {
  const dismiss = useToasts((s) => s.dismiss);
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start();
    AccessibilityInfo.announceForAccessibility(toast.message ? `${toast.title}. ${toast.message}` : toast.title);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(toast.kind === 'error' ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [anim, toast]);
  return (
    <Animated.View style={[styles.card, { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] }]}>
      <Pressable style={styles.row} onPress={() => dismiss(toast.id)} accessibilityRole="alert" accessibilityLabel={toast.message ? `${toast.title}. ${toast.message}` : toast.title} accessibilityHint="Toca para cerrar">
        <Ionicons name={ICON[toast.kind]} size={22} color={TINT[toast.kind]} />
        <View style={styles.text}>
          <Text style={styles.title}>{toast.title}</Text>
          {toast.message ? <Text style={styles.message}>{toast.message}</Text> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** Renders the queued toasts above every screen. Mounted once in the root layout. */
export function ToastHost() {
  const toasts = useToasts((s) => s.toasts);
  const insets = useSafeAreaInsets();
  if (!toasts.length) return null;
  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + spacing.sm }]}>
      {toasts.map((t) => <ToastCard key={t.id} toast={t} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: spacing.lg, right: spacing.lg, zIndex: 1000, gap: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, ...shadows.card },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.bodySemi, fontSize: fontSizes.md, color: colors.ink },
  message: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.inkMuted },
});
