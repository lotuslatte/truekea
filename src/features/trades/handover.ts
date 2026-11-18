import { useMutation, useQueryClient } from '@tanstack/react-query';
import qrcodeGenerator from 'qrcode-generator';

import { supabase } from '@/lib/supabase';
import type { TradeStatus } from '@/types/database';

/** Deep link drawn in the QR: the phone camera opens the trade with the code filled in. */
export function handoverLink(tradeId: string, code: string): string {
  return `truekea://trueke/${tradeId}?codigo=${code}`;
}

/** Six digits out of whatever was typed or came in the link, or '' if it is not a code. */
export function cleanCode(input: string | undefined | null): string {
  const digits = (input ?? '').replace(/\D/g, '');
  return digits.length === 6 ? digits : '';
}

/** QR modules for `text` as rows of booleans (true = dark). */
export function qrMatrix(text: string): boolean[][] {
  const qr = qrcodeGenerator(0, 'M');
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => qr.isDark(row, col)));
}

/** One SVG path for the dark modules: a single node draws the whole code. */
export function qrPath(matrix: boolean[][]): string {
  let d = '';
  matrix.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x += 1;
        continue;
      }
      let end = x;
      while (end < row.length && row[end]) end += 1;
      d += `M${x} ${y}h${end - x}v1h-${end - x}z`;
      x = end;
    }
  });
  return d;
}

export function useIssueHandoverCode() {
  return useMutation({
    mutationFn: async (tradeId: string): Promise<{ code: string; expiresAt: string }> => {
      const { data, error } = await supabase.rpc('issue_handover_code', { p_trade_id: tradeId });
      if (error) throw error;
      const row = data?.[0];
      if (!row) throw new Error('No se pudo generar el código.');
      return { code: row.code, expiresAt: row.expires_at };
    },
  });
}

export function useRedeemHandoverCode() {
  const queryClient = useQueryClient();
  return useMutation({
    /** Resolves to the new trade status, or null when the code was wrong. */
    mutationFn: async (input: { tradeId: string; code: string }): Promise<TradeStatus | null> => {
      const { data, error } = await supabase.rpc('redeem_handover_code', {
        p_trade_id: input.tradeId,
        p_code: input.code,
      });
      if (error) throw error;
      return data ?? null;
    },
    onSuccess: () => {
      for (const queryKey of [['trade'], ['myItems'], ['chats']]) queryClient.invalidateQueries({ queryKey });
    },
  });
}
