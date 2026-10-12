import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { SelectField } from '@/components/ui/SelectField';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { LIMA_DISTRICTS, districtCentroid, toWkt } from '@/constants/districts';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCategories } from '@/features/categories';
import { notify } from '@/lib/confirm';
import { supabase } from '@/lib/supabase';
import { colors, fonts, fontSizes, radius, spacing } from '@/theme/tokens';
import type {
  Item,
  ItemCondition,
  ItemPhoto,
  KnowledgeModality,
  Profile,
} from '@/types/database';

type ItemDetail = Item & { item_photos: ItemPhoto[]; owner: Profile };

const DISTRICT_OPTIONS = LIMA_DISTRICTS.map((d) => ({ label: d.name, value: d.name }));

const MODALITY_OPTIONS: { value: KnowledgeModality; label: string }[] = [
  { value: 'in_person', label: '🤝 Presencial' },
  { value: 'virtual', label: '💻 Virtual' },
];

const CONDITION_OPTIONS: { value: ItemCondition; label: string }[] = [
  { value: 'new', label: 'Nuevo' },
  { value: 'like_new', label: 'Como nuevo' },
  { value: 'used', label: 'Con uso' },
  { value: 'for_repair', label: 'Para reparar' },
];

export default function EditarItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();

  // Misma forma y key que el detalle (['item', id]) para compartir caché.
  const itemQuery = useQuery({
    queryKey: ['item', id],
    enabled: !!id,
    queryFn: async (): Promise<ItemDetail> => {
      const { data, error } = await supabase
        .from('items')
        .select('*, item_photos(*), owner:profiles!items_owner_id_fkey(*)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const item = itemQuery.data;

  if (itemQuery.isPending) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Editar publicación' }} />
        <View style={styles.loading}>
          <Skeleton style={{ height: 48 }} />
          <Skeleton style={{ height: 120 }} />
          <Skeleton style={{ height: 48 }} />
        </View>
      </View>
    );
  }

  const isMine = !!item && session?.user.id === item.owner_id;
  const isEditable = !!item && item.status !== 'reserved' && item.status !== 'traded';

  if (!item || !isMine || !isEditable) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Editar publicación' }} />
        <EmptyState
          emoji="🔒"
          title="No puedes editar esta publicación"
          subtitle={
            item && isMine
              ? 'Está reservada o ya se truekeó. ¡Buen viaje para ella! 🌱'
              : 'Solo quien la publicó puede hacerle cambios.'
          }
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Editar publicación' }} />
      <EditForm item={item} />
    </View>
  );
}

// Componente aparte para sembrar el estado del formulario recién cuando
// el item ya cargó, sin efectos de sincronización.
function EditForm({ item }: { item: ItemDetail }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const isKnowledge = item.kind === 'knowledge';
  const isCircle = isKnowledge && item.format === 'circle';
  const { data: categories } = useCategories(item.kind);

  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description);
  const [categoryId, setCategoryId] = useState<number>(item.category_id);
  const [district, setDistrict] = useState<string>(item.district);
  const [lookingFor, setLookingFor] = useState(item.looking_for ?? '');
  const [condition, setCondition] = useState<ItemCondition | null>(item.condition);
  const [modality, setModality] = useState<KnowledgeModality | null>(item.modality);
  const [isDonation, setIsDonation] = useState(item.is_donation);
  const [error, setError] = useState<string | undefined>();

  const save = useMutation({
    mutationFn: async () => {
      const payload: {
        title: string;
        description: string;
        category_id: number;
        looking_for: string | null;
        district: string;
        location?: string;
        condition?: ItemCondition | null;
        is_donation?: boolean;
        modality?: KnowledgeModality | null;
      } = {
        title: title.trim(),
        description: description.trim(),
        category_id: categoryId,
        looking_for: lookingFor.trim() || null,
        district,
      };

      // Si cambió el distrito, la ubicación aproximada lo sigue.
      if (district !== item.district) {
        const centroid = districtCentroid(district);
        if (!centroid) throw new Error('No reconocemos ese distrito, elige uno de la lista.');
        payload.location = toWkt(centroid);
      }

      if (!isKnowledge) {
        payload.condition = condition;
        payload.is_donation = isDonation;
      } else {
        payload.modality = modality;
      }

      const { error: updateError } = await supabase
        .from('items')
        .update(payload)
        .eq('id', item.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item', item.id] });
      queryClient.invalidateQueries({ queryKey: ['myItems'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      notify('¡Guardado!', 'Tu publicación quedó al día.');
      router.back();
    },
    onError: (e) => {
      notify('Ups, no pudimos guardar', e.message);
    },
  });

  const submit = () => {
    if (title.trim().length < 3) {
      setError('Ponle un título a tu publicación (mínimo 3 caracteres)');
      return;
    }
    if (description.trim().length < 10) {
      setError('Cuéntanos un poco más en la descripción (mínimo 10 caracteres)');
      return;
    }
    if (!isKnowledge && condition == null) {
      setError('Cuéntanos en qué estado está tu objeto');
      return;
    }
    setError(undefined);
    save.mutate();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TextField
          label="Título"
          placeholder={
            isKnowledge ? 'ej: Clases de piano para principiantes' : 'ej: Bicicleta montañera aro 26'
          }
          value={title}
          onChangeText={setTitle}
          maxLength={80}
        />

        <TextField
          label="Descripción"
          placeholder={
            isKnowledge
              ? '¿Qué enseñas? Tu experiencia, duración de la sesión, modalidad…'
              : 'Estado, tiempo de uso, detalles que debería saber quien lo reciba…'
          }
          value={description}
          onChangeText={setDescription}
          maxLength={2000}
          multiline
          numberOfLines={5}
          style={styles.multiline}
        />

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Categoría</Text>
          <View style={styles.chips}>
            {(categories ?? []).map((cat) => (
              <Chip
                key={cat.id}
                label={`${cat.icon} ${cat.name}`}
                selected={categoryId === cat.id}
                onPress={() => setCategoryId(cat.id)}
              />
            ))}
          </View>
        </View>

        <SelectField
          label="Distrito"
          placeholder="Elige tu distrito"
          value={district}
          options={DISTRICT_OPTIONS}
          onChange={setDistrict}
          searchable
        />

        {!isKnowledge ? (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Estado</Text>
            <View style={styles.chips}>
              {CONDITION_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={condition === option.value}
                  onPress={() => setCondition(option.value)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {isKnowledge ? (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Modalidad</Text>
            <View style={styles.chips}>
              {MODALITY_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={modality === option.value}
                  onPress={() => setModality(option.value)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {!isKnowledge ? (
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Es un regalo 🎁</Text>
            <Switch
              value={isDonation}
              onValueChange={setIsDonation}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={colors.surface}
              accessibilityLabel="Es un regalo"
            />
          </View>
        ) : null}

        <TextField
          label={isCircle ? '¿Qué debe traer cada asistente?' : '¿Qué buscas?'}
          placeholder={
            isCircle
              ? 'ej: un libro usado, algo para compartir'
              : isKnowledge
                ? 'ej: otro saber, un objeto, lo que me sorprenda'
                : 'ej: bici, tablet, lo que me sorprenda'
          }
          value={lookingFor}
          onChangeText={setLookingFor}
          maxLength={200}
        />

        <Text style={styles.photosNote}>Las fotos no se pueden cambiar por ahora</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button title="Guardar cambios" onPress={submit} loading={save.isPending} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.sand,
  },
  flex: {
    flex: 1,
  },
  loading: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  container: {
    padding: spacing.xl,
    gap: spacing.lg,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  multiline: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  fieldGroup: {
    gap: spacing.sm,
  },
  fieldLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.ink,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  switchLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
  photosNote: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  error: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.danger,
    textAlign: 'center',
  },
});
