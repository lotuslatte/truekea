import { Alert, Platform } from 'react-native';

import { toast, type ToastKind } from '@/lib/toast';

// Alert.alert is a no-op on react-native-web; fall back to window.confirm there.
export function confirmAction(opts: {
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  if (Platform.OS === 'web') {
    const ok = window.confirm(opts.message ? `${opts.title}\n\n${opts.message}` : opts.title);
    if (ok) opts.onConfirm();
    return;
  }
  Alert.alert(opts.title, opts.message, [
    { text: 'Volver', style: 'cancel' },
    {
      text: opts.confirmLabel ?? 'Confirmar',
      style: opts.destructive ? 'destructive' : 'default',
      onPress: opts.onConfirm,
    },
  ]);
}

// Messages that do not need a decision are shown as a toast, never as a blocking alert.
const ERROR_HINT = /no se pudo|no pudimos|error|ups|falló|inválid|revisa/i;

export function notify(title: string, message?: string, kind?: ToastKind) {
  toast(title, message, kind ?? (ERROR_HINT.test(title) ? 'error' : 'success'));
}
