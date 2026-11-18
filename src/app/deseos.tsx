import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { IconText } from '@/components/ui/IconText';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Thumb } from '@/components/Thumb';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SelectField } from '@/components/ui/SelectField';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { useCategories } from '@/features/categories';
import { useSavedItems, type SavedEntry } from '@/features/saved/api';
import {
  useCreateWishlist,
  useDeleteWishlist,
  useMyWishlists,
  useToggleWishlistActive,
  type Wishlist,
} from '@/features/wishlist/api';
import { confirmAction, notify } from '@/lib/confirm';
import { colors, fonts, fontSizes, radius, shadows, spacing } from '@/theme/tokens';
import type { Category } from '@/types/database';

type Segment = 'guardados' | 'deseos';

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'guardados', label: 'Guardados' },
  { key: 'deseos', label: 'Mis deseos' },
];

const RADIUS_OPTIONS = [3, 5, 10, 20] as const;
const ALL_CATEGORIES_LABEL = 'Todas las categorías';

function categoryLabel(category: Category): string {
  return `${category.icon} ${category.name}`;
}

// ---------- Guardados ----------

function SavedRow({ entry, onPress }: { entry: SavedEntry; onPress: () => void }) {
  const { item } = entry;
  const available = item.status === 'available';
  const isKnowledge = item.kind === 'knowledge';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.savedRow,
        pressed && styles.rowPressed,
        !available && styles.savedRowUnavailable,
      ]}
    >
      <Thumb item={item} style={styles.thumb} />
      <View style={styles.savedBody}>
        <Text style={styles.savedTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={styles.savedBadges}>
          {isKnowledge ? (
            <Badge icon="knowledge" label="Saber" tone="accent" />
          ) : (
            <Badge icon="object" label="Objeto" tone="muted" />
          )}
          {item.is_donation ? <Badge icon="gift" label="Regalo" tone="donation" /> : null}
          {!available ? <Badge label="Ya no disponible" tone="muted" /> : null}
        </View>
        {entry.ownerName ? (
          <Text style={styles.savedOwner} numberOfLines={1}>
            de {entry.ownerName}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function GuardadosTab() {
  const router = useRouter();
  const { data: saved, isLoading, isError, refetch } = useSavedItems();

  if (isLoading) {
    return (
      <View style={styles.skeletons}>
        <Skeleton style={styles.skeletonRow} />
        <Skeleton style={styles.skeletonRow} />
        <Skeleton style={styles.skeletonRow} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorText}>
          Ups, no pudimos cargar tus guardados. Revisa tu conexión e inténtalo de nuevo.
        </Text>
        <Button title="Reintentar" variant="ghost" onPress={() => refetch()} />
      </View>
    );
  }

  return (
    <FlatList
      data={saved ?? []}
      keyExtractor={(entry) => entry.itemId}
      renderItem={({ item: entry }) => (
        <SavedRow entry={entry} onPress={() => router.push(`/item/${entry.itemId}`)} />
      )}
      ListEmptyComponent={
        <EmptyState
          emoji="❤️"
          title="Nada guardado aún"
          subtitle="Toca el corazón de cualquier publicación para verla aquí."
        />
      }
      contentContainerStyle={styles.listContent}
      keyboardShouldPersistTaps="handled"
    />
  );
}

// ---------- Mis deseos ----------

function WishlistRow({
  wish,
  categories,
  onToggle,
  onDelete,
}: {
  wish: Wishlist;
  categories: Category[];
  onToggle: (isActive: boolean) => void;
  onDelete: () => void;
}) {
  const category = categories.find((c) => c.id === wish.category_id);
  const subtitle = `${category ? categoryLabel(category) : 'Cualquier categoría'} · hasta ${wish.radius_km} km`;

  return (
    <View style={[styles.wishRow, !wish.is_active && styles.wishRowInactive]}>
      <View style={styles.wishBody}>
        <Text style={styles.wishQuery} numberOfLines={2}>
          {wish.query}
        </Text>
        <Text style={styles.wishMeta} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.wishActions}>
        <Switch
          accessibilityLabel={
            wish.is_active ? 'Pausar alertas de este deseo' : 'Activar alertas de este deseo'
          }
          value={wish.is_active}
          onValueChange={onToggle}
          trackColor={{ false: colors.border, true: colors.primaryLight }}
          thumbColor={colors.surface}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Eliminar deseo ${wish.query}`}
          hitSlop={10}
          onPress={onDelete}
        >
          <Icon name="trash" size={20} color={colors.danger} />
        </Pressable>
      </View>
    </View>
  );
}

function DeseosTab() {
  const { data: wishlists, isLoading, isError, refetch } = useMyWishlists();
  const { data: categories } = useCategories();
  const createWishlist = useCreateWishlist();
  const toggleActive = useToggleWishlistActive();
  const deleteWishlist = useDeleteWishlist();

  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [error, setError] = useState<string | null>(null);

  const categoryOptions = [
    { label: ALL_CATEGORIES_LABEL, value: ALL_CATEGORIES_LABEL },
    ...(categories ?? []).map((c) => ({ label: categoryLabel(c), value: categoryLabel(c) })),
  ];
  const selectedCategory = (categories ?? []).find((c) => c.id === categoryId);

  const submit = () => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setError('Cuéntanos qué buscas, con una palabrita basta');
      return;
    }
    setError(null);
    createWishlist.mutate(
      { query: trimmed, categoryId, radiusKm },
      {
        onSuccess: () => {
          setQuery('');
          setCategoryId(null);
          setRadiusKm(10);
        },
        onError: () =>
          notify('Ups, no pudimos crear tu deseo', 'Inténtalo de nuevo en un momento.'),
      },
    );
  };

  const removeWish = (wish: Wishlist) => {
    confirmAction({
      title: '¿Eliminar este deseo?',
      message: `Dejaremos de avisarte cuando aparezca "${wish.query}".`,
      confirmLabel: 'Eliminar',
      destructive: true,
      onConfirm: () =>
        deleteWishlist.mutate(wish.id, {
          onError: () =>
            notify('Ups, no pudimos eliminarlo', 'Inténtalo de nuevo en un momento.'),
        }),
    });
  };

  const header = (
    <View style={styles.formCard}>
      <Text style={styles.formIntro}>
        Te avisamos cuando alguien publique lo que buscas cerca de ti 🔔
      </Text>
      <TextField
        label="¿Qué buscas?"
        placeholder="ej: tablet, bici aro 26"
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          if (error) setError(null);
        }}
        error={error ?? undefined}
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <SelectField
        label="Categoría (opcional)"
        placeholder={ALL_CATEGORIES_LABEL}
        value={selectedCategory ? categoryLabel(selectedCategory) : null}
        options={categoryOptions}
        onChange={(value) => {
          const match = (categories ?? []).find((c) => categoryLabel(c) === value);
          setCategoryId(match ? match.id : null);
        }}
      />
      <View style={styles.radiusGroup}>
        <Text style={styles.radiusLabel}>¿Qué tan cerca?</Text>
        <View style={styles.radiusChips}>
          {RADIUS_OPTIONS.map((km) => {
            const selected = radiusKm === km;
            return (
              <Pressable
                key={km}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setRadiusKm(km)}
                style={[styles.radiusChip, selected && styles.radiusChipSelected]}
              >
                <Text style={[styles.radiusChipLabel, selected && styles.radiusChipLabelSelected]}>
                  {km} km
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Button title="Crear deseo" onPress={submit} loading={createWishlist.isPending} />
      {(wishlists?.length ?? 0) > 0 ? <Text style={styles.wishListTitle}>Tus deseos</Text> : null}
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.skeletons}>
        <Skeleton style={styles.skeletonRow} />
        <Skeleton style={styles.skeletonRow} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorText}>
          Ups, no pudimos cargar tus deseos. Revisa tu conexión e inténtalo de nuevo.
        </Text>
        <Button title="Reintentar" variant="ghost" onPress={() => refetch()} />
      </View>
    );
  }

  return (
    <FlatList
      data={wishlists ?? []}
      keyExtractor={(wish) => wish.id}
      ListHeaderComponent={header}
      renderItem={({ item: wish }) => (
        <WishlistRow
          wish={wish}
          categories={categories ?? []}
          onToggle={(isActive) =>
            toggleActive.mutate(
              { id: wish.id, isActive },
              {
                onError: () =>
                  notify('Ups, no pudimos actualizar', 'Inténtalo de nuevo en un momento.'),
              },
            )
          }
          onDelete={() => removeWish(wish)}
        />
      )}
      ListEmptyComponent={
        <EmptyState
          emoji="🔔"
          title="Aún no tienes deseos"
          subtitle="Cuéntanos qué buscas y te avisamos apenas alguien lo publique cerca de ti."
        />
      }
      contentContainerStyle={styles.listContent}
      keyboardShouldPersistTaps="handled"
    />
  );
}

// ---------- Pantalla ----------

export default function DeseosScreen() {
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>('guardados');

  return (
    <View style={styles.screen}>
      <SegmentedControl options={SEGMENTS} value={segment} onChange={setSegment} style={styles.segments} />

      {segment === 'deseos' ? (
        <Pressable
          onPress={() => router.push('/coincidencias' as never)}
          accessibilityRole="link"
          style={styles.matchesLink}
        >
          <IconText icon="arrow" after style={styles.matchesLinkText}>
            Ver las publicaciones que calzan con tus deseos
          </IconText>
        </Pressable>
      ) : null}
      {segment === 'guardados' ? <GuardadosTab /> : <DeseosTab />}
    </View>
  );
}

const styles = StyleSheet.create({
  matchesLink: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, minHeight: 44, justifyContent: 'center' },
  matchesLinkText: { fontFamily: fonts.bodySemi, fontSize: fontSizes.sm, color: colors.primary },
  screen: {
    flex: 1,
    backgroundColor: colors.sand,
  },
  segments: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    gap: 2,
  },
  segment: {
    flex: 1,
    borderRadius: radius.full,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  segmentLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
    color: colors.inkMuted,
  },
  segmentLabelActive: {
    color: colors.surface,
    fontFamily: fonts.bodySemi,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    flexGrow: 1,
  },
  skeletons: {
    padding: spacing.lg,
    gap: spacing.md,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  skeletonRow: {
    height: 80,
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
  // Guardados
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.card,
  },
  savedRowUnavailable: {
    opacity: 0.55,
  },
  rowPressed: {
    opacity: 0.85,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.sand,
  },
  thumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldFaint,
  },
  thumbKnowledge: {
    backgroundColor: colors.primaryFaint,
  },
  thumbEmoji: {
    fontSize: fontSizes.lg,
  },
  savedBody: {
    flex: 1,
    gap: spacing.xs,
  },
  savedTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSizes.sm,
    color: colors.ink,
  },
  savedBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  savedOwner: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.inkMuted,
  },
  // Mis deseos
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  formIntro: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
    lineHeight: 20,
  },
  radiusGroup: {
    gap: spacing.xs,
  },
  radiusLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.ink,
  },
  radiusChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  radiusChip: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.sand,
    borderWidth: 1,
    borderColor: colors.border,
  },
  radiusChipSelected: {
    backgroundColor: colors.festiveFaint,
    borderColor: colors.festive,
  },
  radiusChipLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.ink,
  },
  radiusChipLabelSelected: {
    fontFamily: fonts.bodySemi,
    color: colors.festiveInk,
  },
  wishListTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    color: colors.ink,
    marginTop: spacing.xs,
    marginBottom: -spacing.xs,
  },
  wishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.card,
  },
  wishRowInactive: {
    opacity: 0.6,
  },
  wishBody: {
    flex: 1,
    gap: 2,
  },
  wishQuery: {
    fontFamily: fonts.headingSemi,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
  wishMeta: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.inkMuted,
  },
  wishActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  wishDelete: {
    fontSize: fontSizes.lg,
  },
});
