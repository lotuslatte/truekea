import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import {
  useCreateOffer,
  useMyAvailableItems,
  type ItemWithPhotos,
} from '@/features/offers/api';
import { QuickPublish } from '@/features/offers/QuickPublish';
import { notify } from '@/lib/confirm';
import { publicPhotoUrl, supabase } from '@/lib/supabase';
import { colors, fonts, fontSizes, radius, shadows, spacing } from '@/theme/tokens';
import type { Profile } from '@/types/database';

type TargetItem = ItemWithPhotos & { owner: Profile };

function firstPhotoUrl(item: ItemWithPhotos): string | null {
  const sorted = [...item.item_photos].sort((a, b) => a.position - b.position);
  const photo = sorted[0];
  return photo ? publicPhotoUrl(photo.storage_path) : null;
}

export default function OfferModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: item, isPending: itemPending } = useQuery({
    queryKey: ['item', id],
    queryFn: async (): Promise<TargetItem> => {
      const { data, error } = await supabase
        .from('items')
        .select('*, item_photos(*), owner:profiles!items_owner_id_fkey(*)')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as unknown as TargetItem;
    },
  });

  const myItems = useMyAvailableItems();
  const createOffer = useCreateOffer();

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const isDonation = item?.is_donation ?? false;
  const availableItems = (myItems.data ?? []).filter((mine) => mine.id !== id);
  const needsItem = !isDonation;
  const canSubmit = !!item && (!needsItem || !!selectedItemId);

  const submit = () => {
    if (!item) return;
    createOffer.mutate(
      {
        itemId: item.id,
        offeredItemId: isDonation ? null : selectedItemId,
        message: message.trim() || null,
      },
      {
        onSuccess: () => {
          notify('¡Oferta enviada! 🌱', 'Te avisaremos cuando respondan.');
          router.back();
        },
        onError: (error) => {
          notify('No pudimos enviar tu oferta', error.message);
        },
      },
    );
  };

  if (itemPending || !item) {
    return (
      <View style={styles.loading}>
        <Skeleton style={{ height: 72, borderRadius: radius.md }} />
        <Skeleton style={{ height: 140, borderRadius: radius.md }} />
        <Skeleton style={{ height: 48, borderRadius: radius.md }} />
      </View>
    );
  }

  const targetPhoto = firstPhotoUrl(item);
  const targetIsKnowledge = item.kind === 'knowledge';

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Resumen de lo que quieres */}
        <View style={styles.summary}>
          {targetPhoto ? (
            <Image source={{ uri: targetPhoto }} style={styles.summaryThumb} contentFit="cover" />
          ) : (
            <View
              style={[
                styles.summaryThumb,
                styles.thumbFallback,
                targetIsKnowledge && styles.knowledgeFallback,
              ]}
            >
              <Text style={styles.thumbEmoji}>{targetIsKnowledge ? '🎓' : '📷'}</Text>
            </View>
          )}
          <View style={styles.summaryInfo}>
            <Text style={styles.summaryTitle} numberOfLines={2}>
              {item.title}
            </Text>
            {targetIsKnowledge || item.is_donation ? (
              <View style={styles.summaryBadges}>
                {targetIsKnowledge ? <Badge tone="accent" label="🧠 Saber" /> : null}
                {item.is_donation ? <Badge tone="donation" label="Regalo 🎁" /> : null}
              </View>
            ) : null}
          </View>
        </View>

        {isDonation ? (
          <View style={styles.donationNote}>
            <Text style={styles.donationText}>
              Este objeto es un regalo — solo envía un mensaje 🎁
            </Text>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>¿Qué ofreces a cambio?</Text>
            {myItems.isPending ? (
              <View style={styles.pickerRow}>
                <Skeleton style={styles.pickerSkeleton} />
                <Skeleton style={styles.pickerSkeleton} />
              </View>
            ) : availableItems.length === 0 ? (
              <QuickPublish targetTitle={item.title} onCreated={setSelectedItemId} />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pickerRow}
              >
                {availableItems.map((mine) => {
                  const selected = mine.id === selectedItemId;
                  const photo = firstPhotoUrl(mine);
                  const isKnowledge = mine.kind === 'knowledge';
                  return (
                    <Pressable
                      key={mine.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setSelectedItemId(selected ? null : mine.id)}
                      style={[styles.pickCard, selected && styles.pickCardSelected]}
                    >
                      {photo ? (
                        <Image source={{ uri: photo }} style={styles.pickPhoto} contentFit="cover" />
                      ) : (
                        <View
                          style={[
                            styles.pickPhoto,
                            styles.thumbFallback,
                            isKnowledge && styles.knowledgeFallback,
                          ]}
                        >
                          <Text style={styles.thumbEmoji}>{isKnowledge ? '🎓' : '📷'}</Text>
                        </View>
                      )}
                      <Text style={styles.pickTitle} numberOfLines={2}>
                        {mine.title}
                      </Text>
                      {isKnowledge ? (
                        <View style={styles.pickBadge}>
                          <Badge tone="accent" label="🧠 Saber" />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        )}

        <TextField
          label="Mensaje (opcional)"
          placeholder="Cuéntale por qué te interesa su objeto…"
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={3}
          style={styles.messageInput}
        />

        <Button
          title="Enviar oferta"
          onPress={submit}
          disabled={!canSubmit}
          loading={createOffer.isPending}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  loading: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  container: {
    padding: spacing.lg,
    gap: spacing.xl,
    paddingBottom: spacing.xxl * 2,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.card,
  },
  summaryThumb: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
  },
  thumbFallback: {
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knowledgeFallback: {
    backgroundColor: colors.primaryFaint,
  },
  thumbEmoji: {
    fontSize: 22,
  },
  summaryInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  summaryTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
  summaryBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  donationNote: {
    backgroundColor: colors.primaryFaint,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  donationText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.primary,
    textAlign: 'center',
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  pickerSkeleton: {
    width: 130,
    height: 150,
    borderRadius: radius.md,
  },
  pickCard: {
    width: 130,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  pickCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryFaint,
  },
  pickPhoto: {
    width: '100%',
    height: 84,
    borderRadius: radius.sm,
  },
  pickTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    color: colors.ink,
  },
  pickBadge: {
    flexDirection: 'row',
  },
  messageInput: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
});
