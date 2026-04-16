import { create } from 'zustand';
import type { ThemeMode } from '~/types';

interface ThemeState {
  mode: ThemeMode;
  resolved: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }
  return mode;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'light',
  resolved: 'light',

  setMode: (mode) => {
    const resolved = resolveTheme(mode);
    set({ mode, resolved });
    if (typeof window !== 'undefined') {
      localStorage.setItem('exotic-theme', mode);
      document.documentElement.classList.toggle('dark', resolved === 'dark');
    }
  },

  toggle: () => {
    const { resolved } = get();
    const newMode = resolved === 'light' ? 'dark' : 'light';
    get().setMode(newMode);
  },
}));
