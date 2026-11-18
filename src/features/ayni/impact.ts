export type ImpactStats = { trades: number; gifts: number; circles: number; co2Kg: number };

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** The lines of the impact card: only what the person has actually done. */
export function impactLines(stats: ImpactStats): string[] {
  const lines: string[] = [];
  if (stats.trades > 0) lines.push(count(stats.trades, 'trueke completado', 'truekes completados'));
  if (stats.gifts > 0) lines.push(count(stats.gifts, 'regalo entregado', 'regalos entregados'));
  if (stats.circles > 0) lines.push(count(stats.circles, 'círculo organizado', 'círculos organizados'));
  return lines;
}

/** Text shared from the impact card. Null when there is nothing to tell yet. */
export function impactMessage(stats: ImpactStats, url?: string | null): string | null {
  const lines = impactLines(stats);
  if (lines.length === 0) return null;
  const list = lines.length === 1 ? lines[0] : `${lines.slice(0, -1).join(', ')} y ${lines[lines.length - 1]}`;
  const co2 = stats.co2Kg > 0 ? ` Eso evita cerca de ${stats.co2Kg} kg de CO₂.` : '';
  // The link is added only when the public address is configured (EXPO_PUBLIC_WEB_URL).
  const invite = url ? ` Cambia lo que no usas por lo que necesitas: ${url}` : ' Cambia lo que no usas por lo que necesitas.';
  return `Mi impacto en Truekea: ${list}.${co2}${invite}`;
}
