import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import {
  cleanCode,
  handoverLink,
  qrMatrix,
  qrPath,
  useIssueHandoverCode,
  useRedeemHandoverCode,
} from '@/features/trades/handover';
import { notify } from '@/lib/confirm';
import { formatTime } from '@/lib/datetime';
import { colors, fonts, fontSizes, radius, spacing } from '@/theme/tokens';

type Props = {
  tradeId: string;
  otherName: string;
  /** Code that arrived in the link when the other person's QR was scanned. */
  initialCode?: string;
  onCompleted: () => void;
};

function QrCode({ text, size = 200 }: { text: string; size?: number }) {
  const matrix = qrMatrix(text);
  const n = matrix.length;
  const quiet = 4; // quiet zone, in modules
  return (
    // Always dark on white, in both themes: scanners need the contrast.
    <Svg width={size} height={size} viewBox={`${-quiet} ${-quiet} ${n + quiet * 2} ${n + quiet * 2}`} accessibilityLabel="Código QR de entrega">
      <Rect x={-quiet} y={-quiet} width={n + quiet * 2} height={n + quiet * 2} fill="#FFFFFF" />
      <Path d={qrPath(matrix)} fill="#000000" />
    </Svg>
  );
}

/**
 * Handover in person: one shows a code (QR and six digits), the other scans it
 * with the phone camera or types it. That confirms for both and closes the trade.
 */
export function HandoverCard({ tradeId, otherName, initialCode, onCompleted }: Props) {
  const issue = useIssueHandoverCode();
  const redeem = useRedeemHandoverCode();
  const [typed, setTyped] = useState(cleanCode(initialCode));
  const [wrong, setWrong] = useState(false);
  const shown = issue.data;

  const submit = () => {
    const code = cleanCode(typed);
    if (!code) {
      setWrong(true);
      return;
    }
    redeem.mutate(
      { tradeId, code },
      {
        onSuccess: (status) => {
          if (status === null) {
            setWrong(true);
            return;
          }
          if (status === 'completed') onCompleted();
        },
        onError: (e) => notify('No se pudo confirmar la entrega', e.message),
      },
    );
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.lead}>
        Cuando estén juntos y hayan revisado lo que intercambian, uno muestra su código y el otro lo ingresa. Eso confirma
        la entrega por los dos.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Mostrar mi código</Text>
        {shown ? (
          <View style={styles.codeBox}>
            <QrCode text={handoverLink(tradeId, shown.code)} />
            <Text style={styles.code} accessibilityLabel={`Código ${shown.code.split('').join(' ')}`} selectable>
              {shown.code.slice(0, 3)} {shown.code.slice(3)}
            </Text>
            <Text style={styles.muted}>
              {otherName} lo escanea con la cámara de su teléfono o escribe los seis dígitos. Vence a las{' '}
              {formatTime(new Date(shown.expiresAt))}.
            </Text>
          </View>
        ) : (
          <Text style={styles.muted}>Genera el código solo cuando ya estés con {otherName}. Dura 10 minutos.</Text>
        )}
        <Button
          title={shown ? 'Generar otro código' : 'Generar código'}
          variant="secondary"
          loading={issue.isPending}
          onPress={() => issue.mutate(tradeId, { onError: (e) => notify('No se pudo generar el código', e.message) })}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ingresar el código de {otherName}</Text>
        <TextField
          label="Código de 6 dígitos"
          value={typed}
          onChangeText={(t) => {
            setTyped(t.replace(/\D/g, '').slice(0, 6));
            setWrong(false);
          }}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="000000"
          error={wrong ? 'Ese código no coincide. Revísalo o pide uno nuevo.' : undefined}
        />
        <Button title="Confirmar entrega" onPress={submit} loading={redeem.isPending} disabled={typed.length !== 6} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.md },
  lead: { fontFamily: fonts.body, fontSize: fontSizes.sm, lineHeight: 20, color: colors.inkMuted },
  card: { gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontFamily: fonts.bodySemi, fontSize: fontSizes.md, color: colors.ink },
  codeBox: { alignItems: 'center', gap: spacing.sm },
  code: { fontFamily: fonts.heading, fontSize: 32, letterSpacing: 4, color: colors.ink },
  muted: { fontFamily: fonts.body, fontSize: fontSizes.sm, lineHeight: 20, color: colors.inkMuted, textAlign: 'center' },
});
