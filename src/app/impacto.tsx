import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useAuth } from '@/features/auth/AuthProvider';
import { getCo2SavedKg } from '@/features/ayni/badges';
import { impactMessage, type ImpactStats } from '@/features/ayni/impact';
import { Chakana } from '@/features/intro/Chakana';
import { shareText } from '@/lib/share';
import { colors, fonts, fontSizes, radius, spacing } from '@/theme/tokens';

function Figure({ icon, value, label }: { icon: IconName; value: number; label: string }) {
  return (
    <View style={styles.figure} accessible accessibilityLabel={`${value} ${label}`}>
      <Icon name={icon} size={22} color={colors.primary} />
      <Text style={styles.figureValue}>{value}</Text>
      <Text style={styles.figureLabel}>{label}</Text>
    </View>
  );
}

export default function ImpactScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const stats: ImpactStats = {
    trades: profile?.trades_completed ?? 0,
    gifts: profile?.donations_given ?? 0,
    circles: profile?.circles_hosted ?? 0,
    co2Kg: profile ? getCo2SavedKg(profile) : 0,
  };
  const message = impactMessage(stats, process.env.EXPO_PUBLIC_WEB_URL);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <View style={styles.brand}>
          <Chakana size={22} color={colors.primary} />
          <Text style={styles.brandName}>Truekea</Text>
        </View>
        <Text style={styles.name}>{profile?.display_name ?? ''}</Text>
        <Text style={styles.headline}>
          {stats.co2Kg > 0 ? `Cerca de ${stats.co2Kg} kg de CO₂ que no se emitieron` : 'Tu primer trueke empieza aquí'}
        </Text>
        <View style={styles.figures}>
          <Figure icon="repeat" value={stats.trades} label={stats.trades === 1 ? 'trueke' : 'truekes'} />
          <Figure icon="gift" value={stats.gifts} label={stats.gifts === 1 ? 'regalo' : 'regalos'} />
          <Figure icon="people" value={stats.circles} label={stats.circles === 1 ? 'círculo' : 'círculos'} />
        </View>
        <Text style={styles.note}>
          Estimado: 5 kg de CO₂ por cada objeto que sigue en uso y no se compra nuevo.
        </Text>
      </View>

      {message ? (
        <Button title="Compartir mi impacto" onPress={() => void shareText(message, 'Mi impacto en Truekea')} />
      ) : (
        <>
          <Text style={styles.empty}>Cuando completes un trueke o regales algo, aquí tendrás tu tarjeta para compartir.</Text>
          <Button title="Ver publicaciones" variant="secondary" onPress={() => router.replace('/')} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.lg },
  card: {
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryFaint,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandName: { fontFamily: fonts.heading, fontSize: fontSizes.lg, color: colors.ink },
  name: { fontFamily: fonts.bodySemi, fontSize: fontSizes.md, color: colors.ink },
  headline: { fontFamily: fonts.heading, fontSize: fontSizes.xxl, lineHeight: 34, color: colors.ink },
  figures: { flexDirection: 'row', gap: spacing.sm },
  figure: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface },
  figureValue: { fontFamily: fonts.heading, fontSize: fontSizes.xl, color: colors.ink },
  figureLabel: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.inkMuted },
  note: { fontFamily: fonts.body, fontSize: fontSizes.xs, lineHeight: 17, color: colors.ink },
  empty: { fontFamily: fonts.body, fontSize: fontSizes.sm, lineHeight: 20, color: colors.inkMuted, textAlign: 'center' },
});
