import { create } from 'zustand';
import { supabase } from '~/lib/supabase';
import type { Notification } from '~/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  _channel: RealtimeChannel | null;
  _onFollowAccepted: (() => void) | null;
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
  markAsUnread: (id: string) => void;
  markAllAsRead: (userId: string) => void;
  markAllAsUnread: (userId: string) => void;
  deleteNotification: (id: string) => Promise<void>;
  deleteAllNotifications: (userId: string) => Promise<void>;
  clearAll: () => void;
  fetchNotifications: (userId: string) => Promise<void>;
  setOnFollowAccepted: (callback: () => void) => void;
  subscribeRealtime: (userId: string) => void;
  unsubscribe: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  _channel: null,
  _onFollowAccepted: null,

  setNotifications: (notifications) => set({
    notifications,
    unreadCount: notifications.filter((n) => !n.is_read).length,
  }),

  addNotification: (notification) => set((s) => ({
    notifications: [notification, ...s.notifications],
    unreadCount: s.unreadCount + (notification.is_read ? 0 : 1),
  })),

  fetchNotifications: async (userId) => {
    set({ isLoading: true });
    const { data } = await supabase
      .from('notifications')
      .select('*, actor:profiles!notifications_actor_id_fkey(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    const notifs = (data ?? []) as Notification[];
    set({
      notifications: notifs,
      unreadCount: notifs.filter((n) => !n.is_read).length,
      isLoading: false,
    });
  },

  markAsRead: async (id) => {
    const notif = get().notifications.find((n) => n.id === id);
    if (!notif || notif.is_read) return;

    set((s) => ({
      notifications: s.notifications.map((n) => n.id === id ? { ...n, is_read: true } : n),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }));

    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  },

  markAsUnread: async (id) => {
    const notif = get().notifications.find((n) => n.id === id);
    if (!notif || !notif.is_read) return;

    set((s) => ({
      notifications: s.notifications.map((n) => n.id === id ? { ...n, is_read: false } : n),
      unreadCount: s.unreadCount + 1,
    }));

    await supabase.from('notifications').update({ is_read: false }).eq('id', id);
  },

  markAllAsRead: async (userId) => {
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    }));

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
  },

  markAllAsUnread: async (userId) => {
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, is_read: false })),
      unreadCount: s.notifications.length,
    }));

    await supabase
      .from('notifications')
      .update({ is_read: false })
      .eq('user_id', userId)
      .eq('is_read', true);
  },

  clearAll: () => set({ notifications: [], unreadCount: 0 }),

  deleteNotification: async (id) => {
    set((s) => {
      const filtered = s.notifications.filter((n) => n.id !== id);
      return {
        notifications: filtered,
        unreadCount: filtered.filter((n) => !n.is_read).length,
      };
    });
    await supabase.from('notifications').delete().eq('id', id);
  },

  deleteAllNotifications: async (userId) => {
    set({ notifications: [], unreadCount: 0 });
    await supabase.from('notifications').delete().eq('user_id', userId);
  },

  setOnFollowAccepted: (callback) => set({ _onFollowAccepted: callback }),

  subscribeRealtime: (userId) => {
    get().unsubscribe();
    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        async (payload) => {
          const newNotif = payload.new as any;

          // When we receive a "follow accepted" notification, refresh follow state
          if (newNotif.type === 'follow' && newNotif.message?.includes('accepted')) {
            const cb = get()._onFollowAccepted;
            if (cb) cb();
          }

          // Fetch full notification with actor profile
          const { data } = await supabase
            .from('notifications')
            .select('*, actor:profiles!notifications_actor_id_fkey(*)')
            .eq('id', newNotif.id)
            .single();
          if (data) {
            set((s) => {
              if (s.notifications.some((n) => n.id === data.id)) return s;
              return {
                notifications: [data as Notification, ...s.notifications],
                unreadCount: s.unreadCount + 1,
              };
            });
          }
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          set((s) => {
            const updated = s.notifications.map((n) =>
              n.id === payload.new.id ? { ...n, ...payload.new } as Notification : n
            );
            return {
              notifications: updated,
              unreadCount: updated.filter((n) => !n.is_read).length,
            };
          });
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          set((s) => {
            const filtered = s.notifications.filter((n) => n.id !== payload.old.id);
            return {
              notifications: filtered,
              unreadCount: filtered.filter((n) => !n.is_read).length,
            };
          });
        }
      )
      .subscribe();
    set({ _channel: channel });
  },

  unsubscribe: () => {
    const { _channel } = get();
    if (_channel) supabase.removeChannel(_channel);
    set({ _channel: null });
  },
}));
