import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import type { ItemQuestion, Profile } from '@/types/database';

export type QuestionAsker = Pick<Profile, 'display_name' | 'avatar_url'>;
export type QuestionWithAsker = ItemQuestion & { asker: QuestionAsker | null };

export const QUESTION_MIN = 3;
export const QUESTION_MAX = 300;
export const ANSWER_MAX = 500;

/** Returns the reason a question cannot be sent, or null when it is fine. */
export function questionError(body: string): string | null {
  const length = body.trim().length;
  if (length < QUESTION_MIN) return 'Escribe tu pregunta.';
  if (length > QUESTION_MAX) return `Usa como máximo ${QUESTION_MAX} caracteres.`;
  return null;
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/** Questions of an item, newest first. Signed-in only: RLS returns nothing to visitors. */
export function useItemQuestions(itemId: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['itemQuestions', itemId],
    enabled: !!itemId && !!session,
    queryFn: async (): Promise<QuestionWithAsker[]> => {
      const { data, error } = await supabase
        .from('item_questions')
        .select('*, asker:profiles!item_questions_asker_id_fkey(display_name, avatar_url)')
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      const rows = (data ?? []) as unknown as (ItemQuestion & { asker: QuestionAsker | QuestionAsker[] | null })[];
      return rows.map((row) => ({ ...row, asker: one(row.asker) }));
    },
  });
}

export function useAskQuestion(itemId: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const uid = session?.user.id ?? '';
  return useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.from('item_questions').insert({ item_id: itemId, asker_id: uid, body: body.trim() });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['itemQuestions', itemId] }),
  });
}

export function useAnswerQuestion(itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, answer }: { id: string; answer: string }) => {
      const { data, error } = await supabase.from('item_questions').update({ answer: answer.trim() }).eq('id', id).select('id');
      if (error) throw error;
      // RLS filters the row out for anyone but the item owner: no row, no answer saved.
      if (!data || data.length === 0) throw new Error('Solo quien publicó puede responder.');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['itemQuestions', itemId] }),
  });
}

export function useDeleteQuestion(itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('item_questions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['itemQuestions', itemId] }),
  });
}
