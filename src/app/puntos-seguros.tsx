import { useQuery } from '@tanstack/react-query';
import { Linking, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { supabase } from '@/lib/supabase';
import { colors, fonts, fontSizes, radius, shadows, spacing } from '@/theme/tokens';

type MeetingPointItem = {
  id: number;
  name: string;
  description: string | null;
  address: string;
  district: string;
  lat: number;
  lng: number;
};

function useMeetingPoints() {
  return useQuery({
    queryKey: ['meetingPointsList'],
    queryFn: async (): Promise<MeetingPointItem[]> => {
      const { data, error } = await supabase.rpc('meeting_points_list');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: Infinity,
  });
}

/** El RPC ya viene ordenado por distrito: agrupamos preservando ese orden. */
function groupByDistrict(points: MeetingPointItem[]) {
  const sections: { title: string; data: MeetingPointItem[] }[] = [];
  for (const point of points) {
    const last = sections[sections.length - 1];
    if (last && last.title === point.district) {
      last.data.push(point);
    } else {
      sections.push({ title: point.district, data: [point] });
    }
  }
  return sections;
}

function openInMaps(point: MeetingPointItem) {
  void Linking.openURL(
    `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}`,
  );
}

function MeetingPointCard({ point }: { point: MeetingPointItem }) {
  return (
    <View style={styles.card}>
      <Text style={styles.pointName}>{point.name}</Text>
      <Text style={styles.pointDetail}>📍 {point.address}</Text>
      {point.description ? <Text style={styles.pointDetail}>{point.description}</Text> : null}
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Cómo llegar a ${point.name}`}
        onPress={() => openInMaps(point)}
        hitSlop={8}
        style={({ pressed }) => pressed && styles.linkPressed}
      >
        <Text style={styles.mapsLink}>Cómo llegar →</Text>
      </Pressable>
    </View>
  );
}

export default function SafeMeetingPointsScreen() {
  const { data: points, isPending, isError, refetch } = useMeetingPoints();

  if (isPending) {
    return (
      <View style={styles.skeletons}>
        <Skeleton style={styles.skeletonCard} />
        <Skeleton style={styles.skeletonCard} />
        <Skeleton style={styles.skeletonCard} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorText}>
          Ups, no pudimos cargar los puntos seguros. Revisa tu conexión e inténtalo de nuevo.
        </Text>
        <Button title="Reintentar" variant="ghost" onPress={() => refetch()} />
      </View>
    );
  }

  const sections = groupByDistrict(points ?? []);

  return (
    <SectionList
      sections={sections}
      keyExtractor={(point) => String(point.id)}
      renderItem={({ item }) => <MeetingPointCard point={item} />}
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionTitle}>{section.title}</Text>
      )}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.intro}>
          <Text style={styles.introText}>
            Lugares públicos, concurridos y con vigilancia para hacer tus truekes 🛡️
          </Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <EmptyState
            emoji="🛡️"
            title="Aún no hay puntos registrados"
            subtitle="Pronto sumaremos lugares seguros cerca de ti. Mientras tanto, elige siempre sitios públicos y concurridos."
          />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.md,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  intro: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primaryFaint,
  },
  introText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    lineHeight: 20,
    color: colors.primary,
    textAlign: 'center',
  },
  sectionTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    color: colors.ink,
    marginTop: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadows.card,
  },
  pointName: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
  pointDetail: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    lineHeight: 17,
    color: colors.inkMuted,
  },
  mapsLink: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSizes.sm,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  linkPressed: {
    opacity: 0.6,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
  },
  skeletons: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  skeletonCard: {
    height: 110,
    borderRadius: radius.lg,
  },
  errorBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
