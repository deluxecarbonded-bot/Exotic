import { create } from 'zustand';
import type { ThemeMode } from '~/types';

interface ThemeState {
  mode: ThemeMode;
  resolved: 'light' | 'dark';
  liquidGlass: boolean;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
  setLiquidGlass: (enabled: boolean) => void;
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
  mode: typeof window !== 'undefined' ? ((localStorage.getItem('exotic-theme') as ThemeMode) || 'light') : 'light',
  resolved: typeof window !== 'undefined'
    ? resolveTheme((localStorage.getItem('exotic-theme') as ThemeMode) || 'light')
    : 'light',
  liquidGlass: typeof window !== 'undefined' ? localStorage.getItem('exotic-liquid-glass') === '1' : false,

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
    get().setMode(resolved === 'light' ? 'dark' : 'light');
  },

  setLiquidGlass: (enabled) => {
    set({ liquidGlass: enabled });
    if (typeof window !== 'undefined') {
      localStorage.setItem('exotic-liquid-glass', enabled ? '1' : '0');
      document.documentElement.classList.toggle('liquid-glass', enabled);
    }
  },
}));

