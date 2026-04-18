import { create } from 'zustand';

export interface Plugin {
  id: string;
  name: string;
  description: string;
  size: string;
  sizeBytes: number;
  installed: boolean;
}

interface PluginState {
  plugins: Plugin[];
  downloading: Record<string, number>; // plugin id → progress 0-100
  isInstalled: (id: string) => boolean;
  isDownloading: (id: string) => boolean;
  getProgress: (id: string) => number;
  install: (id: string) => void;
  uninstall: (id: string) => void;
  cancelDownload: (id: string) => void;
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
    size: '2.4 MB',
    sizeBytes: 2516582,
  },
];

const activeTimers: Record<string, ReturnType<typeof setInterval>> = {};

export const usePluginStore = create<PluginState>((set, get) => {
  const installed = loadInstalled();

  return {
    plugins: AVAILABLE_PLUGINS.map((p) => ({ ...p, installed: installed.has(p.id) })),
    downloading: {},

    isInstalled: (id) => get().plugins.find((p) => p.id === id)?.installed ?? false,
    isDownloading: (id) => id in get().downloading,
    getProgress: (id) => get().downloading[id] ?? 0,

    install: (id) => {
      if (get().isDownloading(id) || get().isInstalled(id)) return;

      // Start download at 0%
      set((state) => ({ downloading: { ...state.downloading, [id]: 0 } }));

      // Simulate progressive download over ~2.5s
      let progress = 0;
      const interval = setInterval(() => {
        // Variable speed: fast start, slow middle, fast finish
        const remaining = 100 - progress;
        const step = Math.max(1, Math.min(8, Math.floor(Math.random() * remaining * 0.15) + 1));
        progress = Math.min(100, progress + step);

        set((state) => ({ downloading: { ...state.downloading, [id]: progress } }));

        if (progress >= 100) {
          clearInterval(interval);
          delete activeTimers[id];

          // Small delay after reaching 100% before marking installed
          setTimeout(() => {
            set((state) => {
              const { [id]: _, ...rest } = state.downloading;
              const next = state.plugins.map((p) => p.id === id ? { ...p, installed: true } : p);
              const ids = new Set(next.filter((p) => p.installed).map((p) => p.id));
              saveInstalled(ids);
              return { plugins: next, downloading: rest };
            });
          }, 400);
        }
      }, 60);

      activeTimers[id] = interval;
    },

    uninstall: (id) => {
      set((state) => {
        const next = state.plugins.map((p) => p.id === id ? { ...p, installed: false } : p);
        const ids = new Set(next.filter((p) => p.installed).map((p) => p.id));
        saveInstalled(ids);
        return { plugins: next };
      });
    },

    cancelDownload: (id) => {
      if (activeTimers[id]) {
        clearInterval(activeTimers[id]);
        delete activeTimers[id];
      }
      set((state) => {
        const { [id]: _, ...rest } = state.downloading;
        return { downloading: rest };
      });
    },
  };
});
