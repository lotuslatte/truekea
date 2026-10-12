import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { RatingStars } from '@/components/ui/RatingStars';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCreateRating } from '@/features/ratings/api';
import { notify } from '@/lib/confirm';
import { supabase } from '@/lib/supabase';
import { colors, fonts, fontSizes, spacing } from '@/theme/tokens';
import type { Profile, Trade } from '@/types/database';

type TradeWithProfiles = Trade & { owner: Profile; offerer: Profile };

export default function RateTradeScreen() {
  const { tradeId } = useLocalSearchParams<{ tradeId: string }>();
  const { session } = useAuth();
  const uid = session?.user.id ?? '';

  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const createRating = useCreateRating();

  const tradeQuery = useQuery({
    queryKey: ['trade', tradeId, 'rate'],
    queryFn: async (): Promise<TradeWithProfiles> => {
      const { data, error } = await supabase
        .from('trades')
        .select('*, owner:profiles!trades_owner_id_fkey(*), offerer:profiles!trades_offerer_id_fkey(*)')
        .eq('id', tradeId)
        .single();
      if (error) throw error;
      return data as TradeWithProfiles;
    },
    enabled: !!tradeId,
  });

  const myRatingQuery = useQuery({
    queryKey: ['ratings', 'mine', tradeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ratings')
        .select('id')
        .eq('trade_id', tradeId)
        .eq('rater_id', uid)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tradeId,
  });

  if (tradeQuery.isPending || myRatingQuery.isPending) {
    return (
      <View style={styles.centered}>
        <Skeleton style={{ width: 72, height: 72, borderRadius: 36 }} />
        <Skeleton style={{ width: 180, height: 20 }} />
        <Skeleton style={{ width: 240, height: 16 }} />
      </View>
    );
  }

  const trade = tradeQuery.data;
  if (tradeQuery.isError || !trade) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notice}>No encontramos este trueke 😕</Text>
        <Button title="Volver" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  if (myRatingQuery.data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.noticeTitle}>Ya calificaste este trueke ⭐</Text>
        <Text style={styles.notice}>Gracias por ayudar a que la comunidad confíe más.</Text>
        <Button title="Volver" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  if (trade.status !== 'completed') {
    return (
      <View style={styles.centered}>
        <Text style={styles.noticeTitle}>Aún no se puede calificar</Text>
        <Text style={styles.notice}>
          Podrás calificar cuando ambos confirmen que el trueke se completó.
        </Text>
        <Button title="Volver" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const other = trade.owner_id === uid ? trade.offerer : trade.owner;

  const submit = () => {
    if (stars === 0) return;
    createRating.mutate(
      { tradeId: trade.id, rateeId: other.id, stars, comment },
      {
        onSuccess: () => {
          notify('¡Gracias! 🌱', 'Tu calificación ayuda a la comunidad.');
          router.back();
        },
        onError: () => {
          notify('Ups', 'No pudimos guardar tu calificación. Inténtalo de nuevo.');
        },
      },
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Avatar url={other.avatar_url} name={other.display_name} size={72} />
        <Text style={styles.name}>{other.display_name}</Text>
        <Text style={styles.question}>¿Cómo fue tu trueke con {other.display_name}?</Text>
      </View>
      <View style={styles.stars}>
        <RatingStars value={stars} size={28} onChange={setStars} />
      </View>
      <TextField
        label="Cuéntanos más (opcional)"
        placeholder="Puntual, amable, el objeto estaba como lo describió…"
        value={comment}
        onChangeText={setComment}
        multiline
        maxLength={500}
        style={styles.commentInput}
      />
      <Button
        title="Enviar calificación"
        onPress={submit}
        disabled={stars === 0}
        loading={createRating.isPending}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    gap: spacing.xl,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  header: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    color: colors.ink,
  },
  question: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  stars: {
    alignItems: 'center',
  },
  commentInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  noticeTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    color: colors.ink,
    textAlign: 'center',
  },
  notice: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.inkMuted,
    textAlign: 'center',
  },
});
