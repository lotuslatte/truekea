import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Appear } from '@/components/ui/Appear';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/features/auth/AuthProvider';
import { useRequireAuth } from '@/features/auth/useRequireAuth';
import {
  ANSWER_MAX,
  QUESTION_MAX,
  questionError,
  useAnswerQuestion,
  useAskQuestion,
  useDeleteQuestion,
  useItemQuestions,
  type QuestionWithAsker,
} from '@/features/questions/api';
import { confirmAction, notify } from '@/lib/confirm';
import { timeAgo } from '@/lib/format';
import { primeNotifications } from '@/lib/notifications';
import { track } from '@/lib/telemetry';
import { colors, fonts, fontSizes, radius, spacing } from '@/theme/tokens';

type Props = { itemId: string; ownerId: string; ownerName: string; canAsk: boolean };

function QuestionCard({ q, itemId, isOwner, uid, ownerName }: { q: QuestionWithAsker; itemId: string; isOwner: boolean; uid: string; ownerName: string }) {
  const answer = useAnswerQuestion(itemId);
  const remove = useDeleteQuestion(itemId);
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const canDelete = isOwner || (q.asker_id === uid && !q.answer);

  const send = () => {
    if (!draft.trim()) return;
    answer.mutate(
      { id: q.id, answer: draft },
      {
        onSuccess: () => {
          setOpen(false);
          setDraft('');
          notify('Respuesta publicada');
        },
        onError: (e) => notify('No se pudo responder', e instanceof Error ? e.message : undefined),
      },
    );
  };

  return (
    <Appear style={styles.card}>
      <View style={styles.head}>
        <Avatar url={q.asker?.avatar_url ?? null} name={q.asker?.display_name ?? '?'} size={28} />
        <Text style={styles.asker} numberOfLines={1}>
          {q.asker_id === uid ? 'Tú' : (q.asker?.display_name ?? 'Alguien')}
        </Text>
        <Text style={styles.time}>{timeAgo(q.created_at)}</Text>
      </View>
      <Text style={styles.body}>{q.body}</Text>

      {q.answer ? (
        <View style={styles.answer}>
          <Text style={styles.answerLabel}>{isOwner ? 'Tu respuesta' : `Responde ${ownerName}`}</Text>
          <Text style={styles.body}>{q.answer}</Text>
        </View>
      ) : isOwner ? (
        open ? (
          <View style={styles.form}>
            <TextField
              label="Tu respuesta"
              value={draft}
              onChangeText={setDraft}
              maxLength={ANSWER_MAX}
              multiline
              placeholder="Responde para que todos lo vean"
            />
            <View style={styles.actions}>
              <Button title="Cancelar" variant="ghost" onPress={() => setOpen(false)} style={styles.flex} />
              <Button title="Responder" onPress={send} loading={answer.isPending} disabled={!draft.trim()} style={styles.flex} />
            </View>
          </View>
        ) : (
          <Button title="Responder" variant="secondary" onPress={() => setOpen(true)} />
        )
      ) : (
        <Text style={styles.pending}>Todavía sin respuesta</Text>
      )}

      {canDelete ? (
        <Pressable
          hitSlop={8}
          accessibilityRole="button"
          onPress={() =>
            confirmAction({
              title: '¿Borrar esta pregunta?',
              confirmLabel: 'Borrar',
              destructive: true,
              onConfirm: () => remove.mutate(q.id, { onError: () => notify('No se pudo borrar la pregunta') }),
            })
          }
        >
          <Text style={styles.delete}>Borrar pregunta</Text>
        </Pressable>
      ) : null}
    </Appear>
  );
}

/** Public questions and answers of an item, shown on its detail screen. */
export function QuestionsSection({ itemId, ownerId, ownerName, canAsk }: Props) {
  const { session } = useAuth();
  const { isAuthenticated, requireAuth } = useRequireAuth();
  const uid = session?.user.id ?? '';
  const isOwner = uid === ownerId;
  const questions = useItemQuestions(itemId);
  const ask = useAskQuestion(itemId);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const rows = questions.data ?? [];

  const send = () => {
    const problem = questionError(draft);
    setError(problem);
    if (problem) return;
    requireAuth(() =>
      ask.mutate(draft, {
        onSuccess: () => {
          setDraft('');
          notify('Pregunta enviada', `${ownerName} recibirá un aviso.`);
          void primeNotifications('question');
          track('question_asked');
        },
        onError: () => notify('No se pudo enviar tu pregunta', 'Revisa tu conexión e inténtalo de nuevo.'),
      }),
    );
  };

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Preguntas{rows.length > 0 ? ` (${rows.length})` : ''}</Text>

      {!isAuthenticated ? (
        <View style={styles.card}>
          <Text style={styles.body}>Crea tu cuenta para leer las preguntas y hacer la tuya.</Text>
          <Button title="Crear cuenta" variant="secondary" onPress={() => requireAuth(() => {})} />
        </View>
      ) : (
        <>
          {canAsk && !isOwner ? (
            <View style={styles.form}>
              <TextField
                label="Pregunta antes de ofrecer"
                value={draft}
                onChangeText={(t) => {
                  setDraft(t);
                  if (error) setError(null);
                }}
                maxLength={QUESTION_MAX}
                multiline
                placeholder="Por ejemplo: ¿funciona el cargador?"
                error={error ?? undefined}
                hint="La pregunta y la respuesta son públicas. No compartas tu teléfono ni tu dirección."
              />
              <Button title="Preguntar" variant="secondary" onPress={send} loading={ask.isPending} />
            </View>
          ) : null}

          {questions.isError ? (
            <View style={styles.card}>
              <Text style={styles.body}>No pudimos cargar las preguntas.</Text>
              <Button title="Reintentar" variant="ghost" onPress={() => questions.refetch()} />
            </View>
          ) : rows.length === 0 && !questions.isPending ? (
            <Text style={styles.pending}>
              {isOwner ? 'Nadie ha preguntado todavía. Te avisaremos cuando llegue una pregunta.' : 'Nadie ha preguntado todavía.'}
            </Text>
          ) : (
            rows.map((q) => <QuestionCard key={q.id} q={q} itemId={itemId} isOwner={isOwner} uid={uid} ownerName={ownerName} />)
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  heading: { fontFamily: fonts.headingSemi, fontSize: fontSizes.lg, color: colors.ink },
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  asker: { flex: 1, fontFamily: fonts.bodySemi, fontSize: fontSizes.sm, color: colors.ink },
  time: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.inkFaint },
  body: { fontFamily: fonts.body, fontSize: fontSizes.md, color: colors.ink, lineHeight: 22 },
  answer: { gap: 2, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.primaryFaint },
  answerLabel: { fontFamily: fonts.bodySemi, fontSize: fontSizes.xs, color: colors.primary },
  pending: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.inkMuted },
  form: { gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  delete: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.danger },
});
