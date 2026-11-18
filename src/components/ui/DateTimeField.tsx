import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { dayKey, dayOptions, formatWhen, slotOf, timeSlots, withTime } from '@/lib/datetime';
import { colors, fonts, fontSizes, radius, spacing } from '@/theme/tokens';

type Props = {
  label: string;
  value: Date | null;
  onChange: (value: Date) => void;
  placeholder?: string;
  /** How many days to offer, and how many days from today the first one is. */
  days?: number;
  startOffset?: number;
  stepMinutes?: number;
  hint?: string;
  error?: string;
};

/**
 * Date and time chosen by tapping: a strip of days and a grid of hours.
 * Written in plain React Native so it behaves the same on iOS, Android and web.
 */
export function DateTimeField({ label, value, onChange, placeholder = 'Elegir día y hora', days = 30, startOffset = 0, stepMinutes = 30, hint, error }: Props) {
  const [open, setOpen] = useState(false);
  const [now] = useState(() => new Date());
  const options = dayOptions(now, days, startOffset);
  const slots = timeSlots(stepMinutes);
  const [day, setDay] = useState<string>(value ? dayKey(value) : (options[0]?.key ?? ''));
  const [slot, setSlot] = useState<string | null>(value ? slotOf(value) : null);

  const selectedDay = options.find((o) => o.key === day) ?? options[0];
  const picked = selectedDay && slot ? withTime(selectedDay.date, slot) : null;

  const confirm = () => {
    if (picked) onChange(picked);
    setOpen(false);
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? formatWhen(value, now) : placeholder}`}
        style={[styles.field, error ? styles.fieldError : null]}
      >
        <Icon name="calendar" size={20} color={colors.inkMuted} />
        <Text style={[styles.value, !value && styles.placeholder]}>{value ? formatWhen(value, now) : placeholder}</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel="Cerrar" />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <Text style={styles.sectionLabel}>Día</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
              {options.map((o) => (
                <Chip key={o.key} label={o.label} selected={o.key === selectedDay?.key} onPress={() => setDay(o.key)} />
              ))}
            </ScrollView>
            <Text style={styles.sectionLabel}>Hora</Text>
            <ScrollView style={styles.slotScroll} contentContainerStyle={styles.slotGrid}>
              {slots.map((s) => {
                const at = selectedDay ? withTime(selectedDay.date, s) : null;
                const past = !!at && at.getTime() <= now.getTime();
                const selected = s === slot;
                return (
                  <Pressable
                    key={s}
                    disabled={past}
                    onPress={() => setSlot(s)}
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled: past }}
                    accessibilityLabel={s}
                    style={[styles.slot, selected && styles.slotSelected, past && styles.slotPast]}
                  >
                    <Text style={[styles.slotText, selected && styles.slotTextSelected]}>{s}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Button title={picked ? `Elegir ${formatWhen(picked, now)}` : 'Elige una hora'} onPress={confirm} disabled={!picked || picked.getTime() <= now.getTime()} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  label: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.ink },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  fieldError: { borderColor: colors.danger },
  value: { flex: 1, fontFamily: fonts.body, fontSize: fontSizes.md, color: colors.ink },
  placeholder: { color: colors.inkFaint },
  hint: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.inkMuted },
  error: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.danger },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: {
    maxHeight: '85%',
    backgroundColor: colors.sand,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  sheetTitle: { fontFamily: fonts.heading, fontSize: fontSizes.lg, color: colors.ink },
  sectionLabel: { fontFamily: fonts.bodySemi, fontSize: fontSizes.sm, color: colors.inkMuted },
  dayRow: { gap: spacing.sm, paddingRight: spacing.lg },
  slotScroll: { maxHeight: 240 },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slot: {
    minWidth: 72,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  slotSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  slotPast: { opacity: 0.35 },
  slotText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.ink },
  slotTextSelected: { color: colors.surface },
});
