import { create } from 'zustand';
import { supabase } from '~/lib/supabase';
import type { Channel, ChannelPost } from '~/types';

interface ChannelState {
  channels: Channel[];
  subscribedChannels: Channel[];
  isLoading: boolean;

  fetchChannels: (userId?: string) => Promise<void>;
  fetchSubscribed: (userId: string) => Promise<void>;
  searchChannels: (query: string) => Promise<Channel[]>;
  createChannel: (data: { name: string; handle: string; description?: string; avatar_url?: string; is_public: boolean }, ownerId: string) => Promise<Channel | null>;
  deleteChannel: (channelId: string) => Promise<void>;
  subscribe: (channelId: string, userId: string) => Promise<void>;
  unsubscribe: (channelId: string, userId: string) => Promise<void>;

  // Posts
  fetchPosts: (channelId: string) => Promise<ChannelPost[]>;
  createPost: (channelId: string, userId: string, content: string, mediaFiles: File[], postedAs?: 'channel' | 'user') => Promise<ChannelPost | null>;
  deletePost: (postId: string) => Promise<void>;
  pinPost: (postId: string, pinned: boolean) => Promise<void>;
  reactToPost: (postId: string, userId: string, emoji: string) => Promise<void>;
  removeReaction: (postId: string, userId: string, emoji: string) => Promise<void>;
}

export const useChannelStore = create<ChannelState>((set, get) => ({
  channels: [],
  subscribedChannels: [],
  isLoading: false,

  fetchChannels: async (userId) => {
    set({ isLoading: true });
    const { data } = await supabase
      .from('channels')
      .select('*, owner:profiles!channels_owner_id_fkey(id,username,display_name,avatar_url,is_verified,is_owner)')
      .eq('is_public', true)
      .order('subscribers_count', { ascending: false })
      .limit(50);

    if (!data) { set({ isLoading: false }); return; }

    let enriched = data as Channel[];
    if (userId) {
      const ids = data.map((c: any) => c.id);
      const { data: memberships } = await supabase
        .from('channel_members')
        .select('channel_id, role')
        .eq('user_id', userId)
        .in('channel_id', ids);
      const map = new Map((memberships ?? []).map((m: any) => [m.channel_id, m.role]));
      enriched = data.map((c: any) => ({
        ...c,
        is_subscribed: map.has(c.id),
        member_role: map.get(c.id) ?? null,
      }));
    }

    set({ channels: enriched, isLoading: false });
  },

  fetchSubscribed: async (userId) => {
    const { data } = await supabase
      .from('channel_members')
      .select('role, channel:channels!channel_members_channel_id_fkey(*, owner:profiles!channels_owner_id_fkey(id,username,display_name,avatar_url,is_verified,is_owner))')
      .eq('user_id', userId)
      .order('joined_at', { ascending: false });

    if (!data) return;
    const channels = data.map((m: any) => ({
      ...m.channel,
      is_subscribed: true,
      member_role: m.role,
    })) as Channel[];
    set({ subscribedChannels: channels });
  },

  searchChannels: async (query) => {
    const { data } = await supabase
      .from('channels')
      .select('*, owner:profiles!channels_owner_id_fkey(id,username,display_name,avatar_url)')
      .eq('is_public', true)
      .or(`name.ilike.%${query}%,handle.ilike.%${query}%`)
      .limit(20);
    return (data ?? []) as Channel[];
  },

  createChannel: async ({ name, handle, description, avatar_url, is_public }, ownerId) => {
    const { data, error } = await supabase
      .from('channels')
      .insert({ name, handle: handle.toLowerCase().replace(/[^a-z0-9_]/g, ''), description: description || null, avatar_url: avatar_url || null, owner_id: ownerId, is_public })
      .select('*, owner:profiles!channels_owner_id_fkey(id,username,display_name,avatar_url,is_verified,is_owner)')
      .single();
    if (error || !data) return null;

    // Auto-subscribe owner as owner
    await supabase.from('channel_members').insert({ channel_id: data.id, user_id: ownerId, role: 'owner' });
    const channel = { ...data, is_subscribed: true, member_role: 'owner' } as Channel;
    set(s => ({ channels: [channel, ...s.channels], subscribedChannels: [channel, ...s.subscribedChannels] }));
    return channel;
  },

  deleteChannel: async (channelId) => {
    await supabase.from('channels').delete().eq('id', channelId);
    set(s => ({
      channels: s.channels.filter(c => c.id !== channelId),
      subscribedChannels: s.subscribedChannels.filter(c => c.id !== channelId),
    }));
  },

  subscribe: async (channelId, userId) => {
    await supabase.from('channel_members').insert({ channel_id: channelId, user_id: userId, role: 'member' });
    // increment count
    await supabase.rpc('increment_channel_subscribers', { cid: channelId }).catch(() => {});
    set(s => ({
      channels: s.channels.map(c => c.id === channelId ? { ...c, is_subscribed: true, member_role: 'member', subscribers_count: c.subscribers_count + 1 } : c),
      subscribedChannels: s.subscribedChannels.some(c => c.id === channelId)
        ? s.subscribedChannels
        : [...s.subscribedChannels, s.channels.find(c => c.id === channelId)!].filter(Boolean).map(c => c.id === channelId ? { ...c, is_subscribed: true, member_role: 'member' } : c),
    }));
  },

  unsubscribe: async (channelId, userId) => {
    await supabase.from('channel_members').delete().match({ channel_id: channelId, user_id: userId });
    await supabase.rpc('decrement_channel_subscribers', { cid: channelId }).catch(() => {});
    set(s => ({
      channels: s.channels.map(c => c.id === channelId ? { ...c, is_subscribed: false, member_role: null, subscribers_count: Math.max(0, c.subscribers_count - 1) } : c),
      subscribedChannels: s.subscribedChannels.filter(c => c.id !== channelId),
    }));
  },

  fetchPosts: async (channelId) => {
    const { data } = await supabase
      .from('channel_posts')
      .select('*, user:profiles!channel_posts_user_id_fkey(id,username,display_name,avatar_url,is_verified,is_owner)')
      .eq('channel_id', channelId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);
    return (data ?? []) as ChannelPost[];
  },

  createPost: async (channelId, userId, content, mediaFiles, postedAs = 'channel') => {
    const mediaUrls: string[] = [];
    const mediaTypes: string[] = [];

    for (const file of mediaFiles) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `channels/${channelId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('posts').upload(path, file, { contentType: file.type });
      if (error) continue;
      const { data: url } = supabase.storage.from('posts').getPublicUrl(path);
      mediaUrls.push(url.publicUrl);
      mediaTypes.push(file.type.startsWith('video/') ? 'video' : 'image');
    }

    const { data, error } = await supabase
      .from('channel_posts')
      .insert({ channel_id: channelId, user_id: userId, content: content || null, media_urls: mediaUrls, media_types: mediaTypes, posted_as: postedAs })
      .select('*, user:profiles!channel_posts_user_id_fkey(id,username,display_name,avatar_url,is_verified,is_owner)')
      .single();

    if (error || !data) return null;
    return data as ChannelPost;
  },

  deletePost: async (postId) => {
    await supabase.from('channel_posts').delete().eq('id', postId);
  },

  pinPost: async (postId, pinned) => {
    await supabase.from('channel_posts').update({ is_pinned: pinned }).eq('id', postId);
  },

  reactToPost: async (postId, userId, emoji) => {
    await supabase.from('channel_post_reactions').upsert({ post_id: postId, user_id: userId, emoji });
  },

  removeReaction: async (postId, userId, emoji) => {
    await supabase.from('channel_post_reactions').delete().match({ post_id: postId, user_id: userId, emoji });
  },
}));
