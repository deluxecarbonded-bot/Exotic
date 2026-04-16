import { create } from 'zustand';
import { supabase } from '~/lib/supabase';
import type { LiveStream, LiveMessage, LiveViewer, MediaSourceType } from '~/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ── Profile helpers (no FK constraints in this DB, fetch separately) ──

async function fetchProfileMap(userIds: string[]): Promise<Map<string, any>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return new Map();
  const { data } = await supabase.from('profiles').select('*').in('id', unique);
  const map = new Map<string, any>();
  (data ?? []).forEach((p: any) => map.set(p.id, p));
  return map;
}

async function withProfiles<T extends { user_id: string }>(rows: T[]): Promise<(T & { user: any })[]> {
  const profiles = await fetchProfileMap(rows.map((r) => r.user_id));
  return rows.map((r) => ({ ...r, user: profiles.get(r.user_id) ?? null }));
}

async function withProfile<T extends { user_id: string }>(row: T): Promise<T & { user: any }> {
  const profiles = await fetchProfileMap([row.user_id]);
  return { ...row, user: profiles.get(row.user_id) ?? null };
}

interface LiveState {
  streams: LiveStream[];
  currentStream: LiveStream | null;
  messages: LiveMessage[];
  viewers: LiveViewer[];
  isLoading: boolean;
  liveCount: number;
  _channels: RealtimeChannel[];

  fetchLiveStreams: () => Promise<void>;
  fetchStream: (streamId: string) => Promise<LiveStream | null>;
  findActiveStream: (userId: string) => Promise<LiveStream | null>;
  createStream: (userId: string, title: string, description: string, mediaType?: MediaSourceType) => Promise<string>;
  endStream: (streamId: string) => Promise<void>;
  joinStream: (streamId: string, userId: string) => Promise<void>;
  leaveStream: (streamId: string, userId: string) => Promise<void>;
  fetchMessages: (streamId: string) => Promise<void>;
  sendMessage: (streamId: string, userId: string, content: string) => Promise<void>;
  pinMessage: (messageId: string) => Promise<void>;
  unpinMessage: (messageId: string) => Promise<void>;
  fetchViewers: (streamId: string) => Promise<void>;
  endAllUserStreams: (userId: string) => Promise<void>;
  subscribeToStreamList: () => void;
  subscribeToStream: (streamId: string) => void;
  unsubscribe: () => void;
}

export const useLiveStore = create<LiveState>((set, get) => ({
  streams: [],
  currentStream: null,
  messages: [],
  viewers: [],
  isLoading: false,
  liveCount: 0,
  _channels: [],

  fetchLiveStreams: async () => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from('live_streams')
      .select('*')
      .eq('status', 'live')
      .order('viewer_count', { ascending: false })
      .order('started_at', { ascending: false });
    if (error) { console.error('fetchLiveStreams:', error.message); set({ isLoading: false }); return; }
    const streams = await withProfiles(data ?? []) as LiveStream[];
    set({ streams, liveCount: streams.length, isLoading: false });
  },

  fetchStream: async (streamId) => {
    const { data, error } = await supabase
      .from('live_streams')
      .select('*')
      .eq('id', streamId)
      .single();
    if (error || !data) { console.error('fetchStream:', error?.message); return null; }
    const stream = await withProfile(data) as LiveStream;
    set({ currentStream: stream });
    return stream;
  },

  findActiveStream: async (userId) => {
    const { data } = await supabase
      .from('live_streams')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'live')
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return await withProfile(data) as LiveStream;
  },

  createStream: async (userId, title, description, mediaType = 'none') => {
    await get().endAllUserStreams(userId);
    const { data, error } = await supabase
      .from('live_streams')
      .insert({ user_id: userId, title, description, media_type: mediaType })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    const streamId = data.id;
    await supabase.from('live_viewers').insert({ stream_id: streamId, user_id: userId });
    return streamId;
  },

  endStream: async (streamId) => {
    await supabase.from('live_viewers').delete().eq('stream_id', streamId);
    await supabase.from('live_messages').delete().eq('stream_id', streamId);
    await supabase.from('live_streams').delete().eq('id', streamId);
    set((s) => ({
      currentStream: s.currentStream?.id === streamId
        ? { ...s.currentStream, status: 'ended', ended_at: new Date().toISOString() }
        : s.currentStream,
      streams: s.streams.filter((st) => st.id !== streamId),
      liveCount: Math.max(0, s.liveCount - 1),
    }));
  },

  joinStream: async (streamId, userId) => {
    await supabase
      .from('live_viewers')
      .upsert({ stream_id: streamId, user_id: userId }, { onConflict: 'stream_id,user_id' });
  },

  leaveStream: async (streamId, userId) => {
    await supabase.from('live_viewers').delete().match({ stream_id: streamId, user_id: userId });
  },

  fetchMessages: async (streamId) => {
    const { data, error } = await supabase
      .from('live_messages')
      .select('*')
      .eq('stream_id', streamId)
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) { console.error('fetchMessages:', error.message); return; }
    const messages = await withProfiles(data ?? []) as LiveMessage[];
    set({ messages });
  },

  sendMessage: async (streamId, userId, content) => {
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const currentUser = (await import('~/stores/auth-store')).useAuthStore.getState().user;
    const optimisticMsg: LiveMessage = {
      id: tempId,
      stream_id: streamId,
      user_id: userId,
      user: currentUser ?? null,
      content,
      is_pinned: false,
      created_at: new Date().toISOString(),
    };
    set((s) => ({ messages: [...s.messages, optimisticMsg] }));

    const { data, error } = await supabase
      .from('live_messages')
      .insert({ stream_id: streamId, user_id: userId, content })
      .select('id')
      .single();

    if (error) {
      set((s) => ({ messages: s.messages.filter((m) => m.id !== tempId) }));
      console.error('sendMessage:', error.message);
      return;
    }
    if (data) {
      set((s) => ({
        messages: s.messages.map((m) => m.id === tempId ? { ...m, id: data.id } : m),
      }));
    }
  },

  pinMessage: async (messageId) => {
    const msg = get().messages.find((m) => m.id === messageId);
    if (msg) {
      const pinned = get().messages.filter((m) => m.is_pinned && m.stream_id === msg.stream_id);
      for (const p of pinned) {
        await supabase.from('live_messages').update({ is_pinned: false }).eq('id', p.id);
      }
    }
    await supabase.from('live_messages').update({ is_pinned: true }).eq('id', messageId);
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId ? { ...m, is_pinned: true } : { ...m, is_pinned: false }
      ),
    }));
  },

  unpinMessage: async (messageId) => {
    await supabase.from('live_messages').update({ is_pinned: false }).eq('id', messageId);
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId ? { ...m, is_pinned: false } : m
      ),
    }));
  },

  fetchViewers: async (streamId) => {
    const { data, error } = await supabase
      .from('live_viewers')
      .select('*')
      .eq('stream_id', streamId);
    if (error) { console.error('fetchViewers:', error.message); return; }
    const viewers = await withProfiles(data ?? []) as LiveViewer[];
    set({ viewers });
  },

  endAllUserStreams: async (userId) => {
    const { data: activeStreams } = await supabase
      .from('live_streams')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'live');

    if (activeStreams && activeStreams.length > 0) {
      const ids = activeStreams.map((s: any) => s.id);
      await supabase.from('live_viewers').delete().in('stream_id', ids);
      await supabase.from('live_messages').delete().in('stream_id', ids);
      await supabase
        .from('live_streams')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .in('id', ids);
      set((s) => ({
        streams: s.streams.filter((st) => !ids.includes(st.id)),
        liveCount: Math.max(0, s.liveCount - ids.length),
      }));
    }
  },

  subscribeToStreamList: () => {
    const channel = supabase
      .channel('live-streams-list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_streams' },
        async (payload) => {
          if (payload.new.status !== 'live') return;
          const { data } = await supabase.from('live_streams').select('*').eq('id', payload.new.id).single();
          if (!data) return;
          const stream = await withProfile(data) as LiveStream;
          set((s) => {
            if (s.streams.some((st) => st.id === stream.id)) return s;
            return { streams: [stream, ...s.streams], liveCount: s.liveCount + 1 };
          });
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_streams' },
        (payload) => {
          if (payload.new.status === 'ended') {
            set((s) => ({
              streams: s.streams.filter((st) => st.id !== payload.new.id),
              liveCount: Math.max(0, s.liveCount - 1),
            }));
          } else {
            set((s) => ({
              streams: s.streams.map((st) =>
                st.id === payload.new.id ? { ...st, ...payload.new } as LiveStream : st
              ),
            }));
          }
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'live_streams' },
        (payload) => {
          set((s) => ({
            streams: s.streams.filter((st) => st.id !== payload.old.id),
            liveCount: Math.max(0, s.liveCount - 1),
          }));
        }
      )
      .subscribe();
    set((s) => ({ _channels: [...s._channels, channel] }));
  },

  subscribeToStream: (streamId) => {
    const messagesChannel = supabase
      .channel(`live-messages-${streamId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'live_messages', filter: `stream_id=eq.${streamId}` },
        async (payload) => {
          const { data } = await supabase.from('live_messages').select('*').eq('id', payload.new.id).single();
          if (!data) return;
          const msg = await withProfile(data) as LiveMessage;
          set((s) => {
            if (s.messages.some((m) => m.id === msg.id)) return s;
            return { messages: [...s.messages, msg] };
          });
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_messages', filter: `stream_id=eq.${streamId}` },
        (payload) => {
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === payload.new.id ? { ...m, ...payload.new } as LiveMessage : m
            ),
          }));
        }
      )
      .subscribe();

    const viewersChannel = supabase
      .channel(`live-viewers-${streamId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_viewers', filter: `stream_id=eq.${streamId}` },
        async () => get().fetchViewers(streamId)
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'live_viewers', filter: `stream_id=eq.${streamId}` },
        async () => get().fetchViewers(streamId)
      )
      .subscribe();

    const streamChannel = supabase
      .channel(`live-stream-${streamId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_streams', filter: `id=eq.${streamId}` },
        (payload) => {
          set((s) => ({
            currentStream: s.currentStream
              ? { ...s.currentStream, ...payload.new } as LiveStream
              : s.currentStream,
          }));
        }
      )
      .subscribe();

    set((s) => ({ _channels: [...s._channels, messagesChannel, viewersChannel, streamChannel] }));
  },

  unsubscribe: () => {
    const { _channels } = get();
    _channels.forEach((ch) => supabase.removeChannel(ch));
    set({ _channels: [], messages: [], viewers: [], currentStream: null });
  },
}));
