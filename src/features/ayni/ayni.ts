// Ayni: la reciprocidad andina hecha reputación.
// "Hoy por ti, mañana por mí" — tu Ayni crece con cada trueke completado
// y crece doble con cada círculo que dictas.

export type AyniLevel = {
  key: string;
  name: string;
  emoji: string;
  min: number;
};

export const LEVELS: AyniLevel[] = [
  { key: 'semilla', name: 'Semilla', emoji: '🌱', min: 0 },
  { key: 'brote', name: 'Brote', emoji: '🌿', min: 1 },
  { key: 'arbol', name: 'Árbol', emoji: '🌳', min: 3 },
  { key: 'bosque', name: 'Bosque', emoji: '🌲', min: 10 },
];

/** Puntos de ayni: cada trueke completado da 1, cada círculo dictado da 2. */
export function getAyniPoints(tradesCompleted: number, circlesHosted = 0): number {
  const trades = Math.max(0, Math.floor(tradesCompleted));
  const circles = Math.max(0, Math.floor(circlesHosted));
  return trades + circles * 2;
}

export function getAyniLevel(
  tradesCompleted: number,
  circlesHosted?: number,
): {
  level: AyniLevel;
  next: AyniLevel | null;
  remaining: number;
  points: number;
} {
  const points = getAyniPoints(tradesCompleted, circlesHosted ?? 0);
  let index = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (points >= LEVELS[i].min) index = i;
  }
  const level = LEVELS[index];
  const next = index + 1 < LEVELS.length ? LEVELS[index + 1] : null;
  return { level, next, remaining: next ? next.min - points : 0, points };
}
