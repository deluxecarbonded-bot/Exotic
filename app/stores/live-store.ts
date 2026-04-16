import { create } from 'zustand';
import { supabase } from '~/lib/supabase';
import type { LiveStream, LiveMessage, LiveViewer, MediaSourceType } from '~/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

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
    const { data } = await supabase
      .from('live_streams')
      .select('*, user:profiles!live_streams_user_id_fkey(*)')
      .eq('status', 'live')
      .order('viewer_count', { ascending: false })
      .order('started_at', { ascending: false });
    const streams = (data ?? []) as LiveStream[];
    set({ streams, liveCount: streams.length, isLoading: false });
  },

  fetchStream: async (streamId) => {
    const { data } = await supabase
      .from('live_streams')
      .select('*, user:profiles!live_streams_user_id_fkey(*)')
      .eq('id', streamId)
      .single();
    if (data) {
      const stream = data as LiveStream;
      set({ currentStream: stream });
      return stream;
    }
    return null;
  },

  findActiveStream: async (userId) => {
    const { data } = await supabase
      .from('live_streams')
      .select('*, user:profiles!live_streams_user_id_fkey(*)')
      .eq('user_id', userId)
      .eq('status', 'live')
      .limit(1)
      .maybeSingle();
    return (data as LiveStream) ?? null;
  },

  createStream: async (userId, title, description, mediaType = 'none') => {
    // End any existing live streams first to avoid unique constraint violation
    await get().endAllUserStreams(userId);

    const { data, error } = await supabase
      .from('live_streams')
      .insert({ user_id: userId, title, description, media_type: mediaType })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    const streamId = data.id;

    // Auto-join as viewer (the host)
    await supabase.from('live_viewers').insert({ stream_id: streamId, user_id: userId });

    return streamId;
  },

  endStream: async (streamId) => {
    await supabase
      .from('live_streams')
      .update({ status: 'ended' })
      .eq('id', streamId);
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
    await supabase
      .from('live_viewers')
      .delete()
      .match({ stream_id: streamId, user_id: userId });
  },

  fetchMessages: async (streamId) => {
    const { data } = await supabase
      .from('live_messages')
      .select('*, user:profiles!live_messages_user_id_fkey(*)')
      .eq('stream_id', streamId)
      .order('created_at', { ascending: true })
      .limit(200);
    set({ messages: (data ?? []) as LiveMessage[] });
  },

  sendMessage: async (streamId, userId, content) => {
    // Optimistic: add the message immediately with user info from auth store
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

    const { data, error } = await supabase.from('live_messages').insert({
      stream_id: streamId,
      user_id: userId,
      content,
    }).select('id').single();

    if (error) {
      // Remove optimistic message on failure
      set((s) => ({ messages: s.messages.filter((m) => m.id !== tempId) }));
      console.error('sendMessage error:', error.message);
      return;
    }

    // Replace temp ID with real ID so realtime deduplication works
    if (data) {
      set((s) => ({
        messages: s.messages.map((m) => m.id === tempId ? { ...m, id: data.id } : m),
      }));
    }
  },

  pinMessage: async (messageId) => {
    // Unpin all existing pinned messages in the same stream first
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
    const { data } = await supabase
      .from('live_viewers')
      .select('*, user:profiles!live_viewers_user_id_fkey(*)')
      .eq('stream_id', streamId);
    set({ viewers: (data ?? []) as LiveViewer[] });
  },

  endAllUserStreams: async (userId) => {
    // Delete viewers and messages for all active streams by this user, then end them
    const { data: activeStreams } = await supabase
      .from('live_streams')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'live');

    if (activeStreams && activeStreams.length > 0) {
      const ids = activeStreams.map((s) => s.id);
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
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'live_streams' },
        async (payload) => {
          const { data } = await supabase
            .from('live_streams')
            .select('*, user:profiles!live_streams_user_id_fkey(*)')
            .eq('id', payload.new.id)
            .single();
          if (data && data.status === 'live') {
            set((s) => {
              if (s.streams.some((st) => st.id === data.id)) return s;
              return { streams: [data as LiveStream, ...s.streams], liveCount: s.liveCount + 1 };
            });
          }
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_streams' },
        (payload) => {
          if (payload.new.status === 'ended') {
            set((s) => ({
              streams: s.streams.filter((st) => st.id !== payload.new.id),
              liveCount: Math.max(0, s.liveCount - 1),
            }));
          } else {
            set((s) => ({
              streams: s.streams.map((st) =>
                st.id === payload.new.id ? { ...st, ...payload.new, user: st.user } as LiveStream : st
              ),
            }));
          }
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'live_streams' },
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
    // Messages channel
    const messagesChannel = supabase
      .channel(`live-messages-${streamId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'live_messages', filter: `stream_id=eq.${streamId}` },
        async (payload) => {
          const { data } = await supabase
            .from('live_messages')
            .select('*, user:profiles!live_messages_user_id_fkey(*)')
            .eq('id', payload.new.id)
            .single();
          if (data) {
            set((s) => {
              if (s.messages.some((m) => m.id === data.id)) return s;
              return { messages: [...s.messages, data as LiveMessage] };
            });
          }
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

    // Viewers channel
    const viewersChannel = supabase
      .channel(`live-viewers-${streamId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'live_viewers', filter: `stream_id=eq.${streamId}` },
        async () => {
          get().fetchViewers(streamId);
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'live_viewers', filter: `stream_id=eq.${streamId}` },
        async () => {
          get().fetchViewers(streamId);
        }
      )
      .subscribe();

    // Stream status channel
    const streamChannel = supabase
      .channel(`live-stream-${streamId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_streams', filter: `id=eq.${streamId}` },
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
