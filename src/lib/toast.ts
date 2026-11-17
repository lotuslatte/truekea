import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info';
export interface Toast { id: number; title: string; message?: string; kind: ToastKind }

interface ToastState { toasts: Toast[]; show: (t: Omit<Toast, 'id'>) => void; dismiss: (id: number) => void }

let nextId = 1;
const DURATION_MS = 4200;

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  show: (t) => {
    const id = nextId++;
    // Keep at most two on screen: the newest and the one before it.
    set({ toasts: [...get().toasts.slice(-1), { ...t, id }] });
    setTimeout(() => get().dismiss(id), t.kind === 'error' ? DURATION_MS + 2000 : DURATION_MS);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),
}));

/** Non-blocking message at the top of the screen. */
export function toast(title: string, message?: string, kind: ToastKind = 'info') {
  useToasts.getState().show({ title, message, kind });
}
