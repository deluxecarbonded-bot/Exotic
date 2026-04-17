import { create } from 'zustand';
import { supabase } from '~/lib/supabase';
import type { User } from '~/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, displayName: string, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  initialize: () => Promise<void>;
  clearError: () => void;
}

async function fetchProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return data as User;
}

function trackSession(userId: string) {
  const key = `session_tracked_${userId}`;
  if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key)) return;

  const doTrack = (lat?: number, lon?: number) => {
    fetch('/api/track-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, latitude: lat, longitude: lon }),
    }).then(() => {
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, '1');
    }).catch(() => {});
  };

  // Request real GPS for 100% accurate location
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => doTrack(pos.coords.latitude, pos.coords.longitude),
      () => doTrack(), // permission denied — fall back to IP geo
      { timeout: 6000, maximumAge: 300000 }
    );
  } else {
    doTrack();
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  clearError: () => set({ error: null }),

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        set({ user: profile, isAuthenticated: !!profile, isLoading: false });
        if (profile) trackSession(profile.id);
      } else {
        set({ isLoading: false });
      }

      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const profile = await fetchProfile(session.user.id);
          set({ user: profile, isAuthenticated: !!profile });
        } else if (event === 'SIGNED_OUT') {
          set({ user: null, isAuthenticated: false });
        }
      });
    } catch {
      set({ isLoading: false });
    }
  },

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    // Resolve username → email via server (uses service role key)
    const res = await fetch('/api/resolve-username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    const resolved = await res.json();
    if (!res.ok || !resolved.email) {
      set({ isLoading: false, error: resolved.error ?? 'No account found with that username.' });
      return false;
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email: resolved.email, password });
    if (error) {
      set({ isLoading: false, error: error.message });
      return false;
    }
    if (data.user) {
      const profile = await fetchProfile(data.user.id);
      set({ user: profile, isAuthenticated: !!profile, isLoading: false });
      // Track session (IP, device, location) — fire and forget
      if (profile) trackSession(profile.id);
    }
    return true;
  },

  register: async (username, displayName, email, password) => {
    set({ isLoading: true, error: null });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, display_name: displayName },
      },
    });
    if (error) {
      set({ isLoading: false, error: error.message });
      return false;
    }
    if (data.user) {
      // Wait a moment for the trigger to create the profile
      await new Promise((r) => setTimeout(r, 500));
      const profile = await fetchProfile(data.user.id);
      set({ user: profile, isAuthenticated: !!profile, isLoading: false });
    }
    return true;
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, isAuthenticated: false });
  },

  updateProfile: async (updates) => {
    const { user } = get();
    if (!user) return;
    // Optimistic update
    set({ user: { ...user, ...updates } });
    const { error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) {
      // Revert on error
      set({ user });
    }
  },
}));
