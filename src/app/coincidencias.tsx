import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Thumb } from '@/components/Thumb';
import { Appear } from '@/components/ui/Appear';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Skeleton } from '@/components/ui/Skeleton';
import { useMatches } from '@/features/matches/api';
import { formatDistance } from '@/lib/format';
import { colors, fonts, fontSizes, radius, shadows, spacing } from '@/theme/tokens';
import type { MatchRow } from '@/types/database';

type Tab = 'they_want' | 'i_want';

function Row({ match, index, onPress }: { match: MatchRow; index: number; onPress: () => void }) {
  const theyWant = match.direction === 'they_want';
  const where = match.distance_km != null ? `${match.district}, ${formatDistance(Number(match.distance_km))}` : match.district;
  return (
    <Appear delay={Math.min(index, 8) * 30}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={
          theyWant
            ? `${match.other_display_name} busca algo como tu ${match.item_title}. Ver su perfil.`
            : `${match.item_title}, de ${match.other_display_name}. Calza con tu deseo ${match.wish_query ?? ''}.`
        }
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Thumb
          item={{ kind: match.item_kind, title: match.item_title, item_photos: match.photo_path ? [{ storage_path: match.photo_path, position: 0 }] : [] }}
          size={64}
        />
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={2}>
            {theyWant ? `Buscan algo como tu «${match.item_title}»` : match.item_title}
          </Text>
          <View style={styles.person}>
            <Avatar url={match.other_avatar_url} name={match.other_display_name} size={20} />
            <Text style={styles.meta} numberOfLines={1}>
              {match.other_display_name}
              {theyWant ? '' : `, ${where}`}
            </Text>
          </View>
          <Text style={styles.reason} numberOfLines={1}>
            {theyWant ? 'Mira qué publica y propón el trueke' : `Calza con tu deseo «${match.wish_query}»`}
          </Text>
        </View>
        <Icon name="chevron" size={18} color={colors.inkFaint} />
      </Pressable>
    </Appear>
  );
}

export default function MatchesScreen() {
  const router = useRouter();
  const matches = useMatches();
  const [tab, setTab] = useState<Tab>('they_want');
  const theyWant = matches.data?.theyWant ?? [];
  const iWant = matches.data?.iWant ?? [];
  const rows = tab === 'they_want' ? theyWant : iWant;

  const open = (match: MatchRow) =>
    router.push((match.direction === 'they_want' ? `/usuario/${match.other_id}` : `/item/${match.item_id}`) as never);

  return (
    <View style={styles.screen}>
      <SegmentedControl
        options={[
          { key: 'they_want', label: 'Te buscan', count: theyWant.length },
          { key: 'i_want', label: 'Tú buscas', count: iWant.length },
        ]}
        value={tab}
        onChange={setTab}
        style={styles.segments}
      />
      {matches.isPending ? (
        <View style={styles.skeletons}>
          <Skeleton style={styles.skeleton} />
          <Skeleton style={styles.skeleton} />
          <Skeleton style={styles.skeleton} />
        </View>
      ) : matches.isError ? (
        <View style={styles.error}>
          <Text style={styles.errorText}>No pudimos cargar tus coincidencias. Revisa tu conexión e inténtalo de nuevo.</Text>
          <Button title="Reintentar" variant="ghost" onPress={() => matches.refetch()} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(m) => `${m.direction}-${m.item_id}-${m.other_id}`}
          renderItem={({ item, index }) => <Row match={item} index={index} onPress={() => open(item)} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={matches.isRefetching} onRefresh={() => matches.refetch()} tintColor={colors.primary} colors={[colors.primary]} />
          }
          ListHeaderComponent={
            rows.length > 0 ? (
              <Text style={styles.lead}>
                {tab === 'they_want'
                  ? 'Personas cerca de ti con un deseo que calza con algo que publicaste.'
                  : 'Publicaciones disponibles que calzan con lo que anotaste en tus deseos.'}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            tab === 'they_want' ? (
              <EmptyState
                icon="target"
                title="Nadie busca todavía lo que publicaste"
                subtitle="Mientras más publiques, más fácil es que calce con el deseo de alguien."
                actionTitle="Publicar algo"
                onAction={() => router.push('/item/nuevo')}
              />
            ) : (
              <EmptyState
                icon="search"
                title="Todavía no aparece lo que buscas"
                subtitle="Anota lo que te gustaría conseguir y aquí verás las publicaciones que calcen."
                actionTitle="Ir a mis deseos"
                onAction={() => router.push('/deseos')}
              />
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  segments: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md, flexGrow: 1 },
  lead: { fontFamily: fonts.body, fontSize: fontSizes.sm, lineHeight: 20, color: colors.inkMuted },
  skeletons: { padding: spacing.lg, gap: spacing.md },
  skeleton: { height: 88, borderRadius: radius.lg },
  error: { padding: spacing.xl, gap: spacing.md, alignItems: 'center' },
  errorText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.inkMuted, textAlign: 'center', lineHeight: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  pressed: { opacity: 0.85 },
  body: { flex: 1, gap: spacing.xs },
  title: { fontFamily: fonts.bodySemi, fontSize: fontSizes.md, color: colors.ink },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  meta: { flex: 1, fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.inkMuted },
  reason: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, color: colors.primary },
});
