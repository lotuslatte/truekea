// Pure helpers for the date and time picker. Everything works on local time.

export type DayOption = { key: string; date: Date; label: string };

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `count` consecutive days starting `startOffset` days after `now` (0 = today). */
export function dayOptions(now: Date, count: number, startOffset = 0): DayOption[] {
  const days: DayOption[] = [];
  for (let i = 0; i < count; i++) {
    const offset = startOffset + i;
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const label =
      offset === 0 ? 'Hoy' : offset === 1 ? 'Mañana' : `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
    days.push({ key: dayKey(date), date, label });
  }
  return days;
}

/** Slots as "HH:MM" from `fromHour` to `toHour` inclusive, every `stepMinutes`. */
export function timeSlots(stepMinutes = 30, fromHour = 6, toHour = 22): string[] {
  const slots: string[] = [];
  for (let m = fromHour * 60; m <= toHour * 60; m += stepMinutes) {
    slots.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  }
  return slots;
}

/** The given day at "HH:MM", or null when the slot is malformed. */
export function withTime(day: Date, slot: string): Date | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(slot);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes, 0, 0);
}

export function slotOf(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "4:30 p. m." */
export function formatTime(date: Date): string {
  const h = date.getHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(date.getMinutes())} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

/** "vie 20 nov, 4:30 p. m." with "hoy" and "mañana" relative to `now`. */
export function formatWhen(date: Date, now: Date = new Date()): string {
  const key = dayKey(date);
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const day =
    key === dayKey(now)
      ? 'hoy'
      : key === dayKey(tomorrow)
        ? 'mañana'
        : `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return `${day}, ${formatTime(date)}`;
}
