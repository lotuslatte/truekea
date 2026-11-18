import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { DateTimeField } from '@/components/ui/DateTimeField';
import { useAcceptMeetingTime, useProposeMeetingTime } from '@/features/trades/api';
import { meetingState } from '@/features/trades/meeting';
import { notify } from '@/lib/confirm';
import { formatWhen } from '@/lib/datetime';
import { track } from '@/lib/telemetry';
import { colors, fonts, fontSizes, radius, spacing } from '@/theme/tokens';
import type { Trade } from '@/types/database';

type Props = { trade: Trade; uid: string; otherName: string; editable: boolean };

/** Date and time of the handover: one side proposes, the other accepts or proposes again. */
export function MeetingTimeCard({ trade, uid, otherName, editable }: Props) {
  const propose = useProposeMeetingTime();
  const accept = useAcceptMeetingTime();
  const [draft, setDraft] = useState<Date | null>(null);
  const [changing, setChanging] = useState(false);
  const state = meetingState(trade, uid);
  const when = trade.meeting_at ? formatWhen(new Date(trade.meeting_at)) : '';

  const send = () => {
    if (!draft) return;
    propose.mutate(
      { tradeId: trade.id, at: draft },
      {
        onSuccess: () => {
          setChanging(false);
          setDraft(null);
          track('meeting_proposed');
          notify('Propuesta enviada', `${otherName} recibirá un aviso para confirmar.`);
        },
        onError: (e) => notify('No se pudo enviar la propuesta', e.message),
      },
    );
  };

  const confirm = () =>
    accept.mutate(trade.id, {
      onSuccess: () => {
        notify('Fecha confirmada', `Quedaron para ${when}.`);
      },
      onError: (e) => notify('No se pudo confirmar la fecha', e.message),
    });

  const showForm = editable && (state === 'none' || state === 'expired' || changing);

  return (
    <View style={styles.wrapper}>
      {state === 'agreed' ? (
        <View style={[styles.card, styles.cardAgreed]}>
          <Text style={styles.strong}>Quedaron para {when}</Text>
        </View>
      ) : state === 'proposed_by_me' ? (
        <View style={styles.card}>
          <Text style={styles.strong}>Propusiste {when}</Text>
          <Text style={styles.muted}>Falta que {otherName} confirme.</Text>
        </View>
      ) : state === 'proposed_by_other' ? (
        <View style={styles.card}>
          <Text style={styles.strong}>
            {otherName} propone {when}
          </Text>
          {editable ? <Button title="Aceptar esta fecha" onPress={confirm} loading={accept.isPending} /> : null}
        </View>
      ) : state === 'expired' ? (
        <Text style={styles.muted}>La fecha propuesta ({when}) ya pasó sin confirmarse.</Text>
      ) : (
        <Text style={styles.muted}>Todavía no tienen fecha ni hora.</Text>
      )}

      {showForm ? (
        <View style={styles.form}>
          <DateTimeField label="Día y hora del encuentro" value={draft} onChange={setDraft} days={30} hint="De día y con gente alrededor es más seguro." />
          <View style={styles.row}>
            {changing ? <Button title="Cancelar" variant="ghost" onPress={() => setChanging(false)} style={styles.flex} /> : null}
            <Button title="Proponer" onPress={send} disabled={!draft} loading={propose.isPending} style={styles.flex} />
          </View>
        </View>
      ) : editable && state !== 'none' ? (
        <Button title="Proponer otra fecha" variant="secondary" onPress={() => setChanging(true)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.md },
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cardAgreed: { backgroundColor: colors.primaryFaint, borderColor: colors.primaryFaint },
  strong: { fontFamily: fonts.bodySemi, fontSize: fontSizes.md, color: colors.ink },
  muted: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.inkMuted },
  form: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
