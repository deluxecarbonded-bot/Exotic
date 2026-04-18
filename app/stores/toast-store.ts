import { create } from 'zustand';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

let toastCounter = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (message, type = 'info') => {
    const id = `toast-${++toastCounter}`;
    const toast: Toast = { id, message, type };

    set((state) => {
      const next = [...state.toasts, toast];
      // Max 3 visible at once — drop the oldest
      if (next.length > 3) {
        return { toasts: next.slice(next.length - 3) };
      }
      return { toasts: next };
    });

    // Auto-remove after 2500ms
    setTimeout(() => {
      get().removeToast(id);
    }, 2500);
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));
