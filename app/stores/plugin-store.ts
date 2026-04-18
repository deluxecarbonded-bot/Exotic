import { create } from 'zustand';

export interface Plugin {
  id: string;
  name: string;
  description: string;
  icon: string;
  installed: boolean;
}

interface PluginState {
  plugins: Plugin[];
  isInstalled: (id: string) => boolean;
  install: (id: string) => void;
  uninstall: (id: string) => void;
}

const STORAGE_KEY = 'exotic-plugins';

function loadInstalled(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveInstalled(ids: Set<string>) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  }
}

const AVAILABLE_PLUGINS: Omit<Plugin, 'installed'>[] = [
  {
    id: 'exotic-glass',
    name: 'Exotic Glass',
    description: 'Frosted-glass surfaces with animated mesh backgrounds throughout the entire app.',
    icon: '💎',
  },
];

export const usePluginStore = create<PluginState>((set, get) => {
  const installed = loadInstalled();

  return {
    plugins: AVAILABLE_PLUGINS.map((p) => ({ ...p, installed: installed.has(p.id) })),

    isInstalled: (id) => get().plugins.find((p) => p.id === id)?.installed ?? false,

    install: (id) => {
      set((state) => {
        const next = state.plugins.map((p) => p.id === id ? { ...p, installed: true } : p);
        const ids = new Set(next.filter((p) => p.installed).map((p) => p.id));
        saveInstalled(ids);
        return { plugins: next };
      });
    },

    uninstall: (id) => {
      set((state) => {
        const next = state.plugins.map((p) => p.id === id ? { ...p, installed: false } : p);
        const ids = new Set(next.filter((p) => p.installed).map((p) => p.id));
        saveInstalled(ids);
        return { plugins: next };
      });
    },
  };
});
