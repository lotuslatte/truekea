import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { TextField } from '@/components/ui/TextField';
import { colors, fonts, fontSizes, radius, spacing } from '@/theme/tokens';

type Option = { label: string; value: string };

type Props = {
  label?: string;
  placeholder: string;
  value: string | null;
  options: Option[];
  onChange: (value: string) => void;
  searchable?: boolean;
  error?: string;
};

// Dropdown cross-platform: campo que abre un modal con lista (y buscador opcional).
export function SelectField({ label, placeholder, value, options, onChange, searchable, error }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ?? placeholder}
        accessibilityValue={value ? { text: value } : undefined}
        onPress={() => setOpen(true)}
        style={[styles.field, error ? styles.fieldError : null]}
      >
        <Text style={[styles.value, !value && styles.placeholder]}>{value ?? placeholder}</Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          style={styles.overlay}
          onPress={() => setOpen(false)}
        >
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{label ?? placeholder}</Text>
            {searchable ? (
              <TextField placeholder="Buscar…" value={query} onChangeText={setQuery} autoFocus />
            ) : null}
            <FlatList
              data={filtered}
              keyExtractor={(o) => o.value}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item: option }) => (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    onChange(option.value);
                    setQuery('');
                    setOpen(false);
                  }}
                  style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                >
                  <Text
                    style={[styles.optionLabel, option.value === value && styles.optionSelected]}
                  >
                    {option.label}
                  </Text>
                  {option.value === value ? <Text style={styles.check}>✓</Text> : null}
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.ink,
  },
  field: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldError: {
    borderColor: colors.danger,
  },
  value: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.ink,
    flex: 1,
  },
  placeholder: {
    color: colors.inkFaint,
  },
  chevron: {
    color: colors.inkMuted,
    fontSize: fontSizes.md,
    marginLeft: spacing.sm,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.danger,
  },
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sheet: {
    backgroundColor: colors.sand,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    maxHeight: '75%',
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  sheetTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: fontSizes.lg,
    color: colors.ink,
  },
  list: {
    flexGrow: 0,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionPressed: {
    backgroundColor: colors.primaryFaint,
  },
  optionLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
  optionSelected: {
    fontFamily: fonts.bodySemi,
    color: colors.primary,
  },
  check: {
    color: colors.primary,
    fontFamily: fonts.bodySemi,
  },
});
