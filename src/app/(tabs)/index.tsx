import AsyncStorage from '@react-native-async-storage/async-storage';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { Appear } from '@/components/ui/Appear';
import { IconText } from '@/components/ui/IconText';
import { Icon } from '@/components/ui/Icon';
import { ItemCard } from '@/components/ItemCard';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ChakanaSpinner } from '@/components/ui/ChakanaSpinner';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { AdSlot } from '@/features/ads/AdSlot';
import { insertAdSlots, type FeedSlot } from '@/features/ads/insertAdSlots';
import { useFeatureFlag } from '@/features/ads/useFeatureFlag';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCategories } from '@/features/categories';
import { useUpcomingCircles } from '@/features/circles/api';
import { useFeed } from '@/features/feed/api';
import { WelcomeSheet } from '@/features/intro/WelcomeSheet';
import { getFlag, setFlag } from '@/lib/flags';
import { getCurrentCoords, type Coords, type LocationResult } from '@/lib/location';
import { supabase } from '@/lib/supabase';
import { useFilters } from '@/stores/filters';
import { colors, fonts, fontSizes, radius, shadows, spacing } from '@/theme/tokens';
import type {
  FeedItemRow,
  ItemCondition,
  KnowledgeFormat,
  KnowledgeModality,
} from '@/types/database';

const RADIUS_OPTIONS = [3, 5, 10, 20, 50];

const MODALITY_OPTIONS: { value: KnowledgeModality; label: string }[] = [
  { value: 'in_person', label: 'Presencial' },
  { value: 'virtual', label: 'Virtual' },
];

const FORMAT_OPTIONS: { value: KnowledgeFormat; label: string }[] = [
  { value: 'one_on_one', label: '1 a 1' },
  { value: 'circle', label: 'Círculos' },
];

const CONDITION_OPTIONS: { value: ItemCondition; label: string }[] = [
  { value: 'new', label: 'Nuevo' },
  { value: 'like_new', label: 'Como nuevo' },
  { value: 'used', label: 'Con uso' },
  { value: 'for_repair', label: 'Para reparar' },
];

export default function ExplorarScreen() {
  const [location, setLocation] = useState<LocationResult | null>(null);
  const [primerDismissed, setPrimerDismissed] = useState(true);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    let mounted = true;
    // Never opens the system dialog here: the banner below explains first.
    getCurrentCoords().then((result) => {
      if (mounted) setLocation(result);
    });
    getFlag('location_primer_dismissed').then((dismissed) => {
      if (mounted) setPrimerDismissed(dismissed);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const useMyLocation = async () => {
    setAsking(true);
    const result = await getCurrentCoords({ request: true });
    setLocation(result);
    setAsking(false);
  };

  const dismissPrimer = () => {
    setPrimerDismissed(true);
    void setFlag('location_primer_dismissed');
  };

  return (
    <View style={styles.screen}>
      <SearchRow />
      <TypeSegments />
      {location ? <CirclesCarousel coords={location.coords} /> : null}
      <ImpactBanner />
      <CoachPublicar />
      {location?.isFallback && location.canAsk && !primerDismissed ? (
        <Appear style={styles.primer}>
          <Text style={styles.primerTitle}>Mira primero lo que está cerca</Text>
          <Text style={styles.primerText}>
            Con tu ubicación ordenamos las publicaciones por distancia. Nadie más la ve: en tus publicaciones solo
            aparece el distrito.
          </Text>
          <View style={styles.primerActions}>
            <Button title="Usar mi ubicación" onPress={useMyLocation} loading={asking} style={styles.primerButton} />
            <Button title="Ahora no" variant="ghost" onPress={dismissPrimer} style={styles.primerButton} />
          </View>
        </Appear>
      ) : location?.isFallback ? (
        <Pressable
          style={styles.fallbackBanner}
          onPress={location.canAsk ? useMyLocation : undefined}
          disabled={!location.canAsk}
          accessibilityRole={location.canAsk ? 'button' : 'text'}
        >
          <Text style={styles.fallbackText}>
            {location.canAsk
              ? 'Mostrando Lima centro. Toca aquí para usar tu ubicación.'
              : 'Mostrando Lima centro. Activa la ubicación en los ajustes del teléfono para ver lo que está cerca.'}
          </Text>
        </Pressable>
      ) : null}
      {location ? <FeedList coords={location.coords} /> : <FeedSkeleton />}
      <WelcomeSheet />
    </View>
  );
}

function SearchRow() {
  const search = useFilters((s) => s.search);
  const setSearch = useFilters((s) => s.setSearch);
  const categoryId = useFilters((s) => s.categoryId);
  const radiusKm = useFilters((s) => s.radiusKm);
  const format = useFilters((s) => s.format);
  const modality = useFilters((s) => s.modality);
  const condition = useFilters((s) => s.condition);
  const [draft, setDraft] = useState(search);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(draft.trim()), 400);
    return () => clearTimeout(timer);
  }, [draft, setSearch]);

  const activeCount =
    (categoryId != null ? 1 : 0) +
    (radiusKm !== 10 ? 1 : 0) +
    (format != null ? 1 : 0) +
    (modality != null ? 1 : 0) +
    (condition != null ? 1 : 0);

  return (
    <View style={styles.searchRow}>
      <View style={styles.searchField}>
        <TextField
          placeholder="¿Qué buscas? ej: bici, tablet…"
          value={draft}
          onChangeText={setDraft}
          returnKeyType="search"
          autoCorrect={false}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Filtros"
        onPress={() => setModalVisible(true)}
        style={[styles.filterButton, activeCount > 0 && styles.filterButtonActive]}
      >
        <Icon
          name="filters"
          size={20}
          color={activeCount > 0 ? colors.surface : colors.ink}
        />
        {activeCount > 0 ? (
          <View style={styles.filterCount}>
            <Text style={styles.filterCountText}>{activeCount}</Text>
          </View>
        ) : null}
      </Pressable>
      <FiltersModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </View>
  );
}

// Un solo segmentador fijo en vez de una fila interminable de chips:
// el tipo es LA decisión de exploración; categorías y radio viven en Filtros.
const SEGMENTS = [
  { key: 'todo', label: 'Todo' },
  { key: 'object', label: 'Objetos' },
  { key: 'knowledge', label: 'Saberes' },
  { key: 'regalos', label: 'Regalos' },
] as const;

function TypeSegments() {
  const kind = useFilters((s) => s.kind);
  const setKind = useFilters((s) => s.setKind);
  const donationsOnly = useFilters((s) => s.donationsOnly);
  const setDonationsOnly = useFilters((s) => s.setDonationsOnly);

  const active = donationsOnly ? 'regalos' : (kind ?? 'todo');

  const select = (key: (typeof SEGMENTS)[number]['key']) => {
    if (key === 'regalos') {
      setDonationsOnly(true);
      setKind(null);
    } else {
      setDonationsOnly(false);
      setKind(key === 'todo' ? null : key);
    }
  };

  return (
    <View style={styles.segments}>
      {SEGMENTS.map((segment) => {
        const isActive = active === segment.key;
        return (
          <Pressable
            key={segment.key}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            onPress={() => select(segment.key)}
            style={[styles.segment, isActive && styles.segmentActive]}
          >
            <Text
              style={[styles.segmentLabel, isActive && styles.segmentLabelActive]}
              numberOfLines={1}
            >
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// "sáb 12 jul · 4pm": fecha corta y cálida para las tarjetas de círculos.
function formatCircleDate(iso: string): string {
  const date = new Date(iso);
  const day = format(date, 'EEE d MMM', { locale: es }).replace(/\./g, '');
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const suffix = hours >= 12 ? 'pm' : 'am';
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  const time = minutes === 0 ? `${h12}${suffix}` : `${h12}:${String(minutes).padStart(2, '0')}${suffix}`;
  return `${day} · ${time}`;
}

// Solo círculos con fecha dentro de los próximos 7 días: la franja promete
// "esta semana" y cumple. (Helper a nivel de módulo, como pickupBadge en
// ItemCard, para no leer el reloj directamente durante el render.)
function circlesThisWeek(circles: FeedItemRow[]): FeedItemRow[] {
  const now = Date.now();
  const weekAhead = now + 7 * 24 * 60 * 60 * 1000;
  return circles.filter((circle) => {
    if (!circle.event_at) return false;
    const eventTime = new Date(circle.event_at).getTime();
    return eventTime > now && eventTime <= weekAhead;
  });
}

// Franja horizontal de círculos con fecha en los próximos 7 días, cerca del
// usuario. Solo aparece en los segmentos Todo y Saberes, y solo si hay al
// menos uno: los círculos son citas, y una cita cercana merece vitrina.
function CirclesCarousel({ coords }: { coords: Coords }) {
  const router = useRouter();
  const kind = useFilters((s) => s.kind);
  const donationsOnly = useFilters((s) => s.donationsOnly);
  const { data } = useUpcomingCircles(coords);

  const upcoming = useMemo(() => circlesThisWeek(data ?? []), [data]);

  const visibleSegment = !donationsOnly && (kind == null || kind === 'knowledge');
  if (!visibleSegment || upcoming.length === 0) return null;

  return (
    <View style={styles.circlesSection}>
      <Text style={styles.circlesTitle}>Círculos esta semana</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.circlesRow}
      >
        {upcoming.map((circle) => (
          <Pressable
            key={circle.id}
            accessibilityRole="button"
            accessibilityLabel={`Círculo: ${circle.title}`}
            onPress={() => router.push(`/item/${circle.id}` as never)}
            style={({ pressed }) => [styles.circleCard, pressed && styles.circleCardPressed]}
          >
            <Text style={styles.circleTitle} numberOfLines={2}>
              {circle.title}
            </Text>
            <IconText icon="calendar" style={styles.circleDate}>{formatCircleDate(circle.event_at ?? '')}</IconText>
            {circle.capacity != null ? (
              <IconText icon="seats" style={styles.circleSeats}>
                {circle.accepted_count}/{circle.capacity} cupos
              </IconText>
            ) : null}
            <View style={styles.circleHost}>
              <Avatar
                url={circle.owner_avatar_url}
                name={circle.owner_display_name}
                size={18}
              />
              <Text style={styles.circleHostName} numberOfLines={1}>
                {circle.owner_display_name}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// Una línea discreta de orgullo colectivo entre el segmentador y el feed:
// cuánto ya salvó la comunidad. Solo aparece cuando hay algo que celebrar.
function ImpactBanner() {
  const { data: impact } = useQuery({
    queryKey: ['communityImpact'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('community_impact');
      if (error) throw error;
      return data[0] ?? null;
    },
  });

  if (!impact || impact.items_saved <= 0) return null;

  const objetos = impact.items_saved === 1 ? 'objeto' : 'objetos';
  const co2 =
    impact.co2_kg >= 10 ? String(Math.round(impact.co2_kg)) : impact.co2_kg.toFixed(1).replace(/\.0$/, '');

  return (
    <View style={styles.impactBanner}>
      <IconText icon="planet" style={styles.impactText}>
        Juntos ya salvamos {impact.items_saved} {objetos} y evitamos {co2} kg de CO₂
      </IconText>
    </View>
  );
}

const COACH_PUBLICAR_KEY = 'truekea:coach_publicar';

// Empujoncito amable para quien ya tiene cuenta pero aún no publica nada:
// una tarjeta sobre el feed con acceso directo a publicar. Se descarta con
// la ✕ (persistido en AsyncStorage) o desaparece sola al publicar algo.
function CoachPublicar() {
  const router = useRouter();
  const { session } = useAuth();
  const uid = session?.user.id;
  // null = aún leyendo AsyncStorage; evitamos parpadeos mientras tanto.
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(COACH_PUBLICAR_KEY)
      .then((value) => {
        if (mounted) setDismissed(value != null);
      })
      .catch(() => {
        if (mounted) setDismissed(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const { data: myItemsCount } = useQuery({
    queryKey: ['myItemsCount'],
    enabled: !!uid && dismissed === false,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('items')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', uid ?? '');
      if (error) throw error;
      return count ?? 0;
    },
  });

  if (!uid || dismissed !== false || myItemsCount == null || myItemsCount > 0) return null;

  const dismiss = () => {
    setDismissed(true);
    AsyncStorage.setItem(COACH_PUBLICAR_KEY, '1').catch(() => {
      // Si no se pudo persistir, igual queda descartado en esta sesión.
    });
  };

  return (
    <View style={styles.coachCard}>
      <View style={styles.coachHeader}>
        <Text style={styles.coachText}>
          👋 ¡Bienvenido/a! Publica tu primer objeto o saber para empezar a truekear
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Descartar bienvenida"
          onPress={dismiss}
          hitSlop={8}
        >
          <Icon name="close" size={18} color={colors.inkMuted} />
        </Pressable>
      </View>
      <Button
        title="Publicar"
        onPress={() => router.push('/item/nuevo')}
        style={styles.coachButton}
      />
    </View>
  );
}

function FiltersModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {visible ? <FiltersModalContent onClose={onClose} /> : null}
    </Modal>
  );
}

// Mounted only while the modal is open, so the drafts re-seed from the store
// on every open without needing a sync effect.
function FiltersModalContent({ onClose }: { onClose: () => void }) {
  const kind = useFilters((s) => s.kind);
  const donationsOnly = useFilters((s) => s.donationsOnly);
  // Las categorías siguen al segmento activo: en Objetos solo las de objeto,
  // en Saberes las de saber; en Todo y Regalos se muestran todas.
  const { data: categories } = useCategories(donationsOnly ? null : kind);
  const radiusKm = useFilters((s) => s.radiusKm);
  const setRadiusKm = useFilters((s) => s.setRadiusKm);
  const categoryId = useFilters((s) => s.categoryId);
  const setCategoryId = useFilters((s) => s.setCategoryId);
  const format = useFilters((s) => s.format);
  const setFormat = useFilters((s) => s.setFormat);
  const modality = useFilters((s) => s.modality);
  const setModality = useFilters((s) => s.setModality);
  const condition = useFilters((s) => s.condition);
  const setCondition = useFilters((s) => s.setCondition);
  const reset = useFilters((s) => s.reset);

  const [draftRadius, setDraftRadius] = useState(radiusKm);
  const [draftCategory, setDraftCategory] = useState(categoryId);
  const [draftFormat, setDraftFormat] = useState(format);
  const [draftModality, setDraftModality] = useState(modality);
  const [draftCondition, setDraftCondition] = useState(condition);

  // Las secciones contextuales siguen al segmento activo: saberes filtran por
  // modalidad/formato, objetos por estado, y regalos/todo solo radio+categoría.
  const showKnowledgeFilters = !donationsOnly && kind === 'knowledge';
  const showObjectFilters = !donationsOnly && kind === 'object';

  const apply = () => {
    setRadiusKm(draftRadius);
    setCategoryId(draftCategory);
    setFormat(showKnowledgeFilters ? draftFormat : null);
    setModality(showKnowledgeFilters ? draftModality : null);
    setCondition(showObjectFilters ? draftCondition : null);
    onClose();
  };

  const clear = () => {
    reset();
    onClose();
  };

  return (
    <Pressable style={styles.modalOverlay} onPress={onClose}>
      <Pressable style={styles.modalCard} onPress={() => {}}>
        <Text style={styles.modalTitle}>Filtros</Text>

        <Text style={styles.modalLabel}>¿A cuántos km?</Text>
        <View style={styles.radiusRow}>
          {RADIUS_OPTIONS.map((km) => (
            <Chip
              key={km}
              label={`${km} km`}
              selected={draftRadius === km}
              onPress={() => setDraftRadius(km)}
            />
          ))}
        </View>

        <Text style={styles.modalLabel}>Categoría</Text>
        <View style={styles.radiusRow}>
          {(categories ?? []).map((category) => (
            <Chip
              key={category.id}
              label={`${category.icon} ${category.name}`}
              selected={draftCategory === category.id}
              onPress={() =>
                setDraftCategory(draftCategory === category.id ? null : category.id)
              }
            />
          ))}
        </View>

        {showKnowledgeFilters ? (
          <>
            <Text style={styles.modalLabel}>Modalidad</Text>
            <View style={styles.radiusRow}>
              {MODALITY_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={draftModality === option.value}
                  onPress={() =>
                    setDraftModality(draftModality === option.value ? null : option.value)
                  }
                />
              ))}
            </View>

            <Text style={styles.modalLabel}>Formato</Text>
            <View style={styles.radiusRow}>
              {FORMAT_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={draftFormat === option.value}
                  onPress={() =>
                    setDraftFormat(draftFormat === option.value ? null : option.value)
                  }
                />
              ))}
            </View>
          </>
        ) : null}

        {showObjectFilters ? (
          <>
            <Text style={styles.modalLabel}>Estado</Text>
            <View style={styles.radiusRow}>
              {CONDITION_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={draftCondition === option.value}
                  onPress={() =>
                    setDraftCondition(draftCondition === option.value ? null : option.value)
                  }
                />
              ))}
            </View>
          </>
        ) : null}

        <View style={styles.modalActions}>
          <Button title="Limpiar" variant="secondary" onPress={clear} style={styles.modalAction} />
          <Button title="Aplicar" onPress={apply} style={styles.modalAction} />
        </View>
      </Pressable>
    </Pressable>
  );
}

// Columnas responsivas para el grid: 2 en teléfonos, 3 y 4 en anchos mayores.
// (En web la app vive en un marco de 480px, así que casi siempre serán 2.)
function useNumColumns() {
  const { width } = useWindowDimensions();
  // En web ancho la app vive en un marco central de 480px (ver DesktopFrame
  // en el _layout raíz): las columnas se calculan sobre el ancho efectivo.
  const effectiveWidth = Platform.OS === 'web' && width >= 768 ? 480 : width;
  if (effectiveWidth >= 900) return 4;
  if (effectiveWidth >= 640) return 3;
  return 2;
}

function FeedList({ coords }: { coords: Coords }) {
  const router = useRouter();
  const feed = useFeed(coords);
  const numColumns = useNumColumns();
  const { data: adsFlag } = useFeatureFlag('ads_feed');

  const resetFilters = useFilters((st) => st.reset);
  const filtersActive = useFilters(
    (st) =>
      st.search.trim() !== '' ||
      st.categoryId != null ||
      st.kind != null ||
      st.donationsOnly ||
      st.format != null ||
      st.modality != null ||
      st.condition != null,
  );

  const adFrequency = useMemo(() => {
    const payload = adsFlag?.payload;
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const raw = payload.frequency;
      if (typeof raw === 'number' && raw > 0) return raw;
    }
    return 10;
  }, [adsFlag]);

  const slots = useMemo(() => {
    const items = feed.data?.pages.flat() ?? [];
    return insertAdSlots(items, adFrequency);
  }, [feed.data, adFrequency]);

  if (feed.isPending) return <FeedSkeleton />;

  // A failed load must not look like an empty community.
  if (feed.isError && !feed.data) {
    return (
      <EmptyState
        emoji="📡"
        title="No pudimos cargar los truekes"
        subtitle="Revisa tu conexión e inténtalo de nuevo."
        actionTitle="Reintentar"
        onAction={() => feed.refetch()}
      />
    );
  }

  return (
    <FlashList<FeedSlot<FeedItemRow>>
      // Re-monta la lista al cambiar el número de columnas (rotación/resize).
      key={numColumns}
      numColumns={numColumns}
      data={slots}
      keyExtractor={(slot) => (slot.type === 'item' ? slot.item.id : slot.key)}
      renderItem={({ item: slot }) => (
        <View style={styles.gridCell}>
          {slot.type === 'item' ? <ItemCard item={slot.item} /> : <AdSlot />}
        </View>
      )}
      contentContainerStyle={styles.listContent}
      onEndReached={() => {
        if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
      }}
      onEndReachedThreshold={0.4}
      refreshControl={
        <RefreshControl
          refreshing={feed.isRefetching && !feed.isFetchingNextPage}
          onRefresh={() => feed.refetch()}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
      ListEmptyComponent={
        filtersActive ? (
          <EmptyState
            emoji="🔎"
            title="Nada coincide con tu búsqueda"
            subtitle="Prueba con otra palabra, amplía la distancia o quita los filtros."
            actionTitle="Limpiar filtros"
            onAction={resetFilters}
          />
        ) : (
          <EmptyState
            emoji="🌱"
            title="Aún no hay truekes por aquí"
            subtitle="¡Publica algo y empieza el intercambio!"
            actionTitle="Publicar mi primer objeto"
            onAction={() => router.push('/item/nuevo')}
          />
        )
      }
    />
  );
}

function FeedSkeleton() {
  return (
    <View>
      <ChakanaSpinner label="Buscando truekes cerca…" />
      <View style={[styles.listContent, styles.skeletonGrid]}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={styles.skeletonCell}>
            <View style={styles.skeletonCard}>
              <Skeleton style={styles.skeletonImage} />
              <View style={styles.skeletonBody}>
                <Skeleton style={styles.skeletonTitle} />
                <Skeleton style={styles.skeletonLine} />
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.sand,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  searchField: {
    flex: 1,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterCount: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterCountText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: colors.surface,
  },
  segments: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
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
  primer: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    gap: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryFaint,
  },
  primerTitle: { fontFamily: fonts.bodySemi, fontSize: fontSizes.md, color: colors.ink },
  primerText: { fontFamily: fonts.body, fontSize: fontSizes.sm, lineHeight: 20, color: colors.ink },
  primerActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  primerButton: { flex: 1, minHeight: 44, paddingVertical: 10, paddingHorizontal: spacing.md },
  fallbackBanner: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.primaryFaint,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  fallbackText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.primary,
  },
  coachCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.primaryFaint,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  coachHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  coachText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.ink,
    lineHeight: 20,
  },
  coachClose: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
  },
  coachButton: {
    alignSelf: 'flex-start',
    minHeight: 36,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  circlesSection: {
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  circlesTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: fontSizes.sm,
    color: colors.ink,
    paddingHorizontal: spacing.lg,
  },
  circlesRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  circleCard: {
    width: 260,
    backgroundColor: colors.festiveFaint,
    borderWidth: 1,
    borderColor: colors.festive,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  circleCardPressed: {
    opacity: 0.85,
  },
  circleTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: 15,
    color: colors.ink,
    lineHeight: 19,
    minHeight: 38,
  },
  circleDate: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSizes.xs,
    color: colors.festiveInk,
  },
  circleSeats: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    color: colors.inkMuted,
  },
  circleHost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  circleHostName: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.inkMuted,
  },
  impactBanner: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.goldFaint,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  impactText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    color: colors.ink,
  },
  // Gutter del grid: contenedor con paddingHorizontal md + celdas con padding
  // xs → spacing.sm entre columnas/filas y spacing.lg contra los bordes.
  listContent: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.md,
  },
  gridCell: {
    flex: 1,
    padding: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  modalTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    color: colors.ink,
  },
  modalLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
    marginTop: spacing.xs,
  },
  radiusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  modalAction: {
    flex: 1,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  skeletonCell: {
    width: '50%',
    padding: spacing.xs,
  },
  skeletonCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.card,
  },
  skeletonImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 0,
  },
  skeletonBody: {
    padding: spacing.sm,
    gap: spacing.sm,
  },
  skeletonTitle: {
    height: 14,
    width: '80%',
  },
  skeletonLine: {
    height: 11,
    width: '50%',
  },
});
