export type FeedSlot<T> = { type: 'item'; item: T } | { type: 'ad'; key: string };

/**
 * Intercala slots de publicidad en una lista de items: uno después del item
 * `frequency`, otro después del 2*`frequency`, etc. Es una costura dormida:
 * los slots solo se pintan si el feature flag de ads está encendido.
 */
export function insertAdSlots<T>(items: T[], frequency: number): FeedSlot<T>[] {
  if (frequency <= 0) return items.map((item) => ({ type: 'item', item }));

  const slots: FeedSlot<T>[] = [];
  items.forEach((item, index) => {
    slots.push({ type: 'item', item });
    if ((index + 1) % frequency === 0) {
      slots.push({ type: 'ad', key: `ad-${(index + 1) / frequency}` });
    }
  });
  return slots;
}
