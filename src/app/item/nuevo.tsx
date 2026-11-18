import { format as formatDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { Appear } from '@/components/ui/Appear';
import { DistrictPicker } from '@/components/DistrictPicker';
import { Icon, type IconName } from '@/components/ui/Icon';
import { IconText } from '@/components/ui/IconText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { DateTimeField } from '@/components/ui/DateTimeField';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCategories } from '@/features/categories';
import { useCreateItem } from '@/features/items/api';
import { clearDraft, loadDraft, saveDraft, type PublishDraft } from '@/features/items/draft';
import { PhotoGridEditor } from '@/features/items/PhotoGridEditor';
import { MAX_PHOTOS, type EditablePhoto } from '@/features/items/photos';
import { notify } from '@/lib/confirm';
import { timeAgo } from '@/lib/format';
import { track } from '@/lib/telemetry';
import { primeNotifications } from '@/lib/notifications';
import { colors, fonts, fontSizes, radius, spacing } from '@/theme/tokens';
import type {
  ItemCondition,
  ItemKind,
  KnowledgeFormat,
  KnowledgeModality,
} from '@/types/database';

const STEP_LABELS = ['Fotos', 'Detalles', '¿Qué buscas?'];

const KIND_OPTIONS: { value: ItemKind; icon: IconName; title: string; subtitle: string }[] = [
  { value: 'object', icon: 'object', title: 'Un objeto', subtitle: 'Algo que ya no usas' },
  { value: 'knowledge', icon: 'knowledge', title: 'Un saber', subtitle: 'Clase, asesoría, taller' },
];

const FORMAT_OPTIONS: { value: KnowledgeFormat; icon: IconName; title: string; subtitle: string }[] =
  [
    { value: 'one_on_one', icon: 'person', title: '1 a 1', subtitle: 'Una persona por vez' },
    { value: 'circle', icon: 'people', title: 'Círculo', subtitle: 'Grupal, tipo evento' },
  ];

const MODALITY_OPTIONS: { value: KnowledgeModality; label: string }[] = [
  { value: 'in_person', label: 'Presencial' },
  { value: 'virtual', label: 'Virtual' },
];

const CONDITION_OPTIONS: { value: ItemCondition; label: string }[] = [
  { value: 'new', label: 'Nuevo' },
  { value: 'like_new', label: 'Como nuevo' },
  { value: 'used', label: 'Con uso' },
  { value: 'for_repair', label: 'Para reparar' },
];

const CONDITION_LABELS: Record<ItemCondition, string> = {
  new: 'Nuevo',
  like_new: 'Como nuevo',
  used: 'Con uso',
  for_repair: 'Para reparar',
};


function startOfTomorrow(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 1);
  return date;
}

export default function NuevoItemScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const createItem = useCreateItem();

  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | undefined>();

  // Paso 1
  const [kind, setKind] = useState<ItemKind>('object');
  const [format, setFormat] = useState<KnowledgeFormat>('one_on_one');
  const [modality, setModality] = useState<KnowledgeModality>('in_person');
  const [photos, setPhotos] = useState<EditablePhoto[]>([]);

  // Paso 2
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [district, setDistrict] = useState<string | null>(profile?.district ?? null);
  const [condition, setCondition] = useState<ItemCondition | null>(null);
  const [eventAt, setEventAt] = useState<Date | null>(null);
  const [capacity, setCapacity] = useState('');

  // Paso 3
  const [isDonation, setIsDonation] = useState(false);
  const [isPerishable, setIsPerishable] = useState(false);
  const [pickupAt, setPickupAt] = useState<Date | null>(null);
  const [lookingFor, setLookingFor] = useState('');

  const isKnowledge = kind === 'knowledge';
  const isCircle = isKnowledge && format === 'circle';
  const isPerishableGift = isDonation && isPerishable;

  // Las categorías del paso 2 siguen al tipo elegido en el paso 1:
  // un saber solo ve categorías de saber y un objeto las de objeto
  // (las de kind null, como Otros, aplican a ambos).
  const { data: categories } = useCategories(kind);

  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);

  // Saved draft: offered once when the screen opens, then kept up to date.
  const [storedDraft, setStoredDraft] = useState<PublishDraft | null>(null);
  const [draftChecked, setDraftChecked] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadDraft().then((draft) => {
      if (!mounted) return;
      setStoredDraft(draft);
      setDraftChecked(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const resumeDraft = () => {
    const d = storedDraft;
    if (!d) return;
    const now = Date.now();
    setKind(d.kind);
    setFormat(d.format);
    setModality(d.modality);
    setPhotos(d.photos.map((uri) => ({ uri })));
    setTitle(d.title);
    setDescription(d.description);
    setCategoryId(d.categoryId);
    setDistrict(d.district ?? profile?.district ?? null);
    setCondition(d.condition);
    // Dates that already passed are dropped: the person picks again.
    setEventAt(d.eventAt && new Date(d.eventAt).getTime() > now ? new Date(d.eventAt) : null);
    setCapacity(d.capacity);
    setIsDonation(d.isDonation);
    setIsPerishable(d.isPerishable);
    setPickupAt(d.pickupAt && new Date(d.pickupAt).getTime() > now ? new Date(d.pickupAt) : null);
    setLookingFor(d.lookingFor);
    setStep(d.step);
    setStoredDraft(null);
  };

  const discardDraft = () => {
    setStoredDraft(null);
    void clearDraft();
  };

  const eventAtIso = eventAt ? eventAt.toISOString() : null;
  const pickupAtIso = pickupAt ? pickupAt.toISOString() : null;
  const photoUris = photos.map((p) => p.uri).join('\n');
  const publishing = createItem.isPending || createItem.isSuccess;

  useEffect(() => {
    // While an older draft is still on offer, typing must not overwrite it.
    if (!draftChecked || storedDraft || publishing) return;
    const timer = setTimeout(() => {
      void saveDraft({
        step,
        kind,
        format,
        modality,
        photos: photoUris ? photoUris.split('\n') : [],
        title,
        description,
        categoryId,
        district,
        condition,
        eventAt: eventAtIso,
        capacity,
        isDonation,
        isPerishable,
        pickupAt: pickupAtIso,
        lookingFor,
        savedAt: new Date().toISOString(),
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [
    draftChecked, storedDraft, publishing, step, kind, format, modality, photoUris, title, description, categoryId,
    district, condition, eventAtIso, capacity, isDonation, isPerishable, pickupAtIso, lookingFor,
  ]);

  const goNext = () => {
    if (step === 1 && !isKnowledge && photos.length === 0) {
      setError('Agrega al menos una foto para que vean tu objeto');
      return;
    }
    if (step === 2) {
      if (title.trim().length < 3) {
        setError('Ponle un título a tu publicación (mínimo 3 caracteres)');
        return;
      }
      if (description.trim().length < 10) {
        setError('Cuéntanos un poco más en la descripción (mínimo 10 caracteres)');
        return;
      }
      if (categoryId == null) {
        setError('Elige una categoría para tu publicación');
        return;
      }
      if (!district) {
        setError('Elige tu distrito');
        return;
      }
      if (!isKnowledge && condition == null) {
        setError('Cuéntanos en qué estado está tu objeto');
        return;
      }
      if (isCircle) {
        if (!eventAt) {
          setError('Elige el día y la hora de tu círculo');
          return;
        }
        if (eventAt < startOfTomorrow()) {
          setError('Tu círculo debe ser a partir de mañana');
          return;
        }
        const cupos = Number(capacity.trim());
        if (!Number.isInteger(cupos) || cupos < 2 || cupos > 50) {
          setError('Los cupos deben ser entre 2 y 50');
          return;
        }
      }
    }
    setError(undefined);
    setStep((s) => Math.min(3, s + 1));
  };

  const goBack = () => {
    setError(undefined);
    setStep((s) => Math.max(1, s - 1));
  };

  const publish = () => {
    if (!district || categoryId == null) {
      setStep(2);
      setError('Nos falta la categoría o el distrito de tu publicación');
      return;
    }
    if (isCircle && !eventAt) {
      setStep(2);
      setError('Elige el día y la hora de tu círculo');
      return;
    }
    if (isPerishableGift) {
      if (!pickupAt) {
        setError('Elige hasta cuándo se puede recoger');
        return;
      }
      if (pickupAt <= new Date()) {
        setError('Esa hora ya pasó');
        return;
      }
    }
    setError(undefined);
    createItem.mutate(
      {
        title,
        description,
        categoryId,
        kind,
        format: isKnowledge ? format : null,
        modality: isKnowledge ? modality : null,
        condition: isKnowledge ? null : condition,
        eventAt: isCircle && eventAt ? eventAt.toISOString() : null,
        capacity: isCircle ? Number(capacity.trim()) : null,
        pickupUntil: isPerishableGift && pickupAt ? pickupAt.toISOString() : null,
        lookingFor,
        isDonation,
        district,
        photos,
        onPhotoProgress: (done, total) => setUploadProgress({ done, total }),
      },
      {
        onSuccess: () => {
          void clearDraft();
          track('item_published', { kind, is_donation: isDonation, photos: photos.length });
          notify(
            '¡Publicado!',
            isCircle
              ? 'Tu círculo ya está visible. ¡Que se llenen los cupos!'
              : isKnowledge
                ? 'Tu saber ya está visible para los truekeros cerca de ti.'
                : 'Tu objeto ya está visible para los truekeros cerca de ti.',
          );
          router.replace('/(tabs)/perfil');
          void primeNotifications('publish');
        },
        onError: (e) => {
          setUploadProgress(null);
          notify('No pudimos publicar', `${e.message} Tu borrador sigue guardado.`);
        },
      },
    );
  };

  const selectedCategory = categories?.find((c) => c.id === categoryId);
  const selectedKind = KIND_OPTIONS.find((k) => k.value === kind);
  const summaryEventAt = isCircle ? eventAt : null;
  const summaryPickupAt = isPerishableGift ? pickupAt : null;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Indicador de progreso */}
        <View style={styles.progressRow}>
          {STEP_LABELS.map((label, i) => {
            const n = i + 1;
            const active = n === step;
            const done = n < step;
            return (
              <View key={label} style={styles.progressStep}>
                <View style={[styles.progressDot, (active || done) && styles.progressDotActive]}>
                  <Text
                    style={[
                      styles.progressNumber,
                      (active || done) && styles.progressNumberActive,
                    ]}
                  >
                    {done ? '' : n}
                  </Text>
                  {done ? <Icon name="check" size={14} color={colors.surface} weight="bold" /> : null}
                </View>
                <Text style={[styles.progressLabel, active && styles.progressLabelActive]}>
                  {label}
                </Text>
              </View>
            );
          })}
        </View>

        {storedDraft ? (
          <Appear style={styles.draftBanner}>
            <Text style={styles.draftTitle}>Tienes un borrador guardado</Text>
            <Text style={styles.draftText}>
              {storedDraft.title.trim() ? `«${storedDraft.title.trim()}», ` : ''}
              {timeAgo(storedDraft.savedAt)}.
            </Text>
            <View style={styles.draftActions}>
              <Button title="Continuar" onPress={resumeDraft} style={styles.draftButton} />
              <Button title="Descartar" variant="ghost" onPress={discardDraft} style={styles.draftButton} />
            </View>
          </Appear>
        ) : null}

        {step === 1 ? (
          <View style={styles.section}>
            <Text style={styles.stepTitle}>¿Qué publicas?</Text>
            <View style={styles.kindRow}>
              {KIND_OPTIONS.map((option) => {
                const selected = kind === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityLabel={option.title}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      if (option.value !== kind) setCategoryId(null);
                      setKind(option.value);
                      setError(undefined);
                    }}
                    style={[styles.kindCard, selected && styles.kindCardSelected]}
                  >
                    <Icon name={option.icon} size={32} color={selected ? colors.primary : colors.inkMuted} />
                    <Text style={[styles.kindTitle, selected && styles.kindTitleSelected]}>
                      {option.title}
                    </Text>
                    <Text style={styles.kindSubtitle}>{option.subtitle}</Text>
                  </Pressable>
                );
              })}
            </View>

            {isKnowledge ? (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>¿En qué formato lo compartes?</Text>
                  <View style={styles.kindRow}>
                    {FORMAT_OPTIONS.map((option) => {
                      const selected = format === option.value;
                      return (
                        <Pressable
                          key={option.value}
                          accessibilityRole="button"
                          accessibilityLabel={option.title}
                          accessibilityState={{ selected }}
                          onPress={() => {
                            setFormat(option.value);
                            setError(undefined);
                          }}
                          style={[styles.kindCard, selected && styles.kindCardSelected]}
                        >
                          <Icon name={option.icon} size={32} color={selected ? colors.primary : colors.inkMuted} />
                          <Text style={[styles.kindTitle, selected && styles.kindTitleSelected]}>
                            {option.title}
                          </Text>
                          <Text style={styles.kindSubtitle}>{option.subtitle}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

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
              </>
            ) : null}

            <Text style={styles.stepTitle}>
              {isKnowledge ? 'Ponle cara a tu saber 📸' : 'Muestra tu objeto 📸'}
            </Text>
            <Text style={styles.stepSubtitle}>
              {isKnowledge
                ? `Puedes publicar tu saber sin foto. Si agregas una (hasta ${MAX_PHOTOS}), la primera será la portada.`
                : `Hasta ${MAX_PHOTOS} fotos. La primera será la portada.`}
            </Text>
            <PhotoGridEditor
              photos={photos}
              onChange={(next) => {
                setError(undefined);
                setPhotos(next);
              }}
            />
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.section}>
            <Text style={styles.stepTitle}>
              {isKnowledge ? 'Cuéntanos sobre tu saber' : 'Cuéntanos sobre tu objeto'}
            </Text>
            <TextField
              label="Título"
              placeholder={
                isKnowledge
                  ? 'ej: Clases de piano para principiantes'
                  : 'ej: Bicicleta montañera aro 26'
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
            <DistrictPicker value={district} onChange={setDistrict} />
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
            {isCircle ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>¿Cuándo es tu círculo?</Text>
                <DateTimeField
                  label="Día y hora"
                  value={eventAt}
                  onChange={setEventAt}
                  days={60}
                  startOffset={1}
                  hint="A partir de mañana"
                />
                <TextField
                  label="Cupos"
                  placeholder="ej: 8"
                  value={capacity}
                  onChangeText={setCapacity}
                  keyboardType="number-pad"
                  maxLength={2}
                  hint="Entre 2 y 50 asistentes"
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.section}>
            <Text style={styles.stepTitle}>¿Qué te gustaría a cambio?</Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Es un regalo</Text>
              <Switch
                value={isDonation}
                onValueChange={setIsDonation}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={colors.surface}
                accessibilityLabel="Es un regalo"
              />
            </View>
            {isDonation ? (
              <Text style={styles.donationNote}>
                Qué lindo gesto. Tu publicación aparecerá como regalo.
              </Text>
            ) : null}
            {isDonation ? (
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Es perecible ⏰ (comida, cosecha…)</Text>
                <Switch
                  value={isPerishable}
                  onValueChange={setIsPerishable}
                  trackColor={{ false: colors.border, true: colors.primaryLight }}
                  thumbColor={colors.surface}
                  accessibilityLabel="Es perecible"
                />
              </View>
            ) : null}
            {isPerishableGift ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>¿Hasta cuándo se puede recoger?</Text>
                <DateTimeField
                  label="Hora límite de recojo"
                  value={pickupAt}
                  onChange={setPickupAt}
                  days={2}
                  hint="Al vencer, tu regalo se retira solo del feed"
                />
                <Text style={styles.perishableSafetyNote}>
                  Comparte solo comida en buen estado: sellada, refrigerada o recién preparada 🙏
                </Text>
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
              hint={
                isDonation
                  ? 'Opcional: cuéntale a la comunidad a quién te gustaría regalarlo'
                  : isCircle
                    ? 'Cada asistente pedirá su cupo ofreciendo esto'
                    : 'Dales una pista a los truekeros para recibir mejores ofertas'
              }
            />

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Resumen</Text>
              {photos[0] ? (
                <Image
                  source={{ uri: photos[0].uri }}
                  style={styles.summaryPhoto}
                  contentFit="cover"
                />
              ) : isKnowledge ? (
                <View style={[styles.summaryPhoto, styles.summaryKnowledgeFallback]}>
                  <Icon name="knowledge" size={40} color={colors.accentInk} />
                </View>
              ) : null}
              <Text style={styles.summaryItemTitle}>{title.trim() || 'Sin título'}</Text>
              <Text style={styles.summaryLine}>
                {selectedCategory ? `${selectedCategory.icon} ${selectedCategory.name}` : ''}
                {district ? `  ·  ${district}` : ''}
              </Text>
              {isKnowledge ? (
                <Text style={styles.summaryLine}>
                  {modality === 'virtual' ? 'Virtual' : 'Presencial'}
                  {!isCircle ? '  ·  1 a 1' : ''}
                </Text>
              ) : condition ? (
                <Text style={styles.summaryLine}>Estado: {CONDITION_LABELS[condition]}</Text>
              ) : null}
              {isCircle && summaryEventAt ? (
                <IconText icon="calendar" style={styles.summaryLine}>
                  {formatDate(summaryEventAt, "EEEE d 'de' MMMM, h:mm aaaa", { locale: es })}
                </IconText>
              ) : null}
              {isCircle && capacity.trim() ? (
                <IconText icon="seats" style={styles.summaryLine}>{capacity.trim()} cupos</IconText>
              ) : null}
              {summaryPickupAt ? (
                <IconText icon="clock" style={styles.summaryLine}>
                  Recoger hasta{' '}
                  {formatDate(summaryPickupAt, "EEEE d 'de' MMMM, h:mm aaaa", { locale: es })}
                </IconText>
              ) : null}
              <View style={styles.summaryBadges}>
                {selectedKind ? (
                  <Badge
                    icon={isCircle ? 'people' : selectedKind.icon}
                    label={isCircle ? 'Círculo' : isKnowledge ? 'Saber' : 'Objeto'}
                    tone={isKnowledge ? 'accent' : 'muted'}
                  />
                ) : null}
                {isDonation ? <Badge icon="gift" label="Regalo" tone="donation" /> : null}
              </View>
              <Text style={styles.summaryLine}>
                {photos.length === 0
                  ? 'Sin fotos'
                  : `${photos.length} ${photos.length === 1 ? 'foto' : 'fotos'}`}
              </Text>
            </View>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.footer}>
          {step > 1 ? (
            <Button
              title="Atrás"
              variant="secondary"
              onPress={goBack}
              disabled={createItem.isPending}
              style={styles.footerButton}
            />
          ) : null}
          {step < 3 ? (
            <Button title="Siguiente" onPress={goNext} style={styles.footerButton} />
          ) : (
            <Button
              title="Publicar"
              onPress={publish}
              loading={createItem.isPending}
              style={styles.footerButton}
            />
          )}
        </View>
        {createItem.isPending && photos.length > 0 ? (
          <Text style={styles.uploadNote} accessibilityLiveRegion="polite">
            {uploadProgress
              ? `Subiendo fotos: ${uploadProgress.done} de ${uploadProgress.total}`
              : 'Preparando tus fotos'}
          </Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  draftBanner: { padding: spacing.md, gap: spacing.xs, borderRadius: radius.lg, backgroundColor: colors.goldFaint },
  draftTitle: { fontFamily: fonts.bodySemi, fontSize: fontSizes.md, color: colors.goldInk },
  draftText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.goldInk },
  draftActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  draftButton: { flex: 1, minHeight: 44, paddingVertical: 10 },
  uploadNote: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.inkMuted, textAlign: 'center' },
  flex: {
    flex: 1,
    backgroundColor: colors.sand,
  },
  container: {
    padding: spacing.xl,
    gap: spacing.xl,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  progressStep: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  progressNumber: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSizes.xs,
    color: colors.inkMuted,
  },
  progressNumberActive: {
    color: colors.surface,
  },
  progressLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    color: colors.inkMuted,
  },
  progressLabelActive: {
    color: colors.primary,
  },
  section: {
    gap: spacing.lg,
  },
  stepTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    color: colors.ink,
  },
  stepSubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
  },
  kindRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  kindCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  kindCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryFaint,
  },
  kindEmoji: {
    fontSize: 32,
  },
  kindTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
  kindTitleSelected: {
    color: colors.primary,
  },
  kindSubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.inkMuted,
    textAlign: 'center',
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
  donationNote: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.donation,
  },
  perishableSafetyNote: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.inkMuted,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  summaryTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: fontSizes.md,
    color: colors.inkMuted,
  },
  summaryPhoto: {
    width: '100%',
    height: 160,
    borderRadius: radius.md,
  },
  summaryKnowledgeFallback: {
    backgroundColor: colors.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryKnowledgeEmoji: {
    fontSize: 56,
    opacity: 0.55,
  },
  summaryItemTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    color: colors.ink,
  },
  summaryLine: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
  },
  summaryBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  error: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.danger,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  footerButton: {
    flex: 1,
  },
});
