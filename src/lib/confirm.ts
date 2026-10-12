import { Alert, Platform } from 'react-native';

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

export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
