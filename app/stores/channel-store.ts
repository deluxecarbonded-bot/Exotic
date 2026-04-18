import { create } from 'zustand';
import { supabase } from '~/lib/supabase';
import type { Channel, ChannelPost, ChannelPostComment, ChannelInvite } from '~/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface ChannelState {
  channels: Channel[];
  subscribedChannels: Channel[];
  isLoading: boolean;
  _listChannels: RealtimeChannel[];
  _detailChannels: RealtimeChannel[];

  fetchChannels: (userId?: string) => Promise<void>;
  fetchSubscribed: (userId: string) => Promise<void>;
  searchChannels: (query: string) => Promise<Channel[]>;
  createChannel: (data: { name: string; handle: string; description?: string; avatar_url?: string; is_public: boolean }, ownerId: string) => Promise<Channel | null>;
  updateChannel: (channelId: string, updates: Partial<Pick<Channel, 'name' | 'handle' | 'description' | 'avatar_url' | 'is_public'>>) => Promise<Channel | null>;
  deleteChannel: (channelId: string) => Promise<void>;
  subscribe: (channelId: string, userId: string) => Promise<void>;
  unsubscribe: (channelId: string, userId: string) => Promise<void>;

  // Posts
  fetchPosts: (channelId: string) => Promise<ChannelPost[]>;
  createPost: (channelId: string, userId: string, content: string, mediaFiles: File[], postedAs?: 'channel' | 'user', scheduledFor?: string | null) => Promise<ChannelPost | null>;
  editPost: (postId: string, content: string) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  pinPost: (postId: string, pinned: boolean) => Promise<void>;
  reactToPost: (postId: string, userId: string, emoji: string) => Promise<void>;
  removeReaction: (postId: string, userId: string, emoji: string) => Promise<void>;
  recordView: (postId: string) => Promise<void>;

  // Scheduled posts
  fetchScheduledPosts: (channelId: string) => Promise<ChannelPost[]>;
  publishScheduledPost: (postId: string) => Promise<void>;

  // Comments
  fetchComments: (postId: string) => Promise<ChannelPostComment[]>;
  createComment: (postId: string, userId: string, content: string, parentId?: string) => Promise<ChannelPostComment | null>;
  deleteComment: (commentId: string) => Promise<void>;

  // Admin management
  updateMemberRole: (channelId: string, userId: string, newRole: 'admin' | 'member') => Promise<void>;
  removeMember: (channelId: string, userId: string) => Promise<void>;

  // Mute
  muteChannel: (channelId: string, userId: string) => Promise<void>;
  unmuteChannel: (channelId: string, userId: string) => Promise<void>;

  // Invite links
  createInviteLink: (channelId: string, userId: string, options?: { expiresInHours?: number; maxUses?: number }) => Promise<ChannelInvite | null>;
  fetchInviteLinks: (channelId: string) => Promise<ChannelInvite[]>;
  revokeInviteLink: (inviteId: string) => Promise<void>;
  joinViaInvite: (code: string, userId: string) => Promise<Channel | null>;

  // Real-time
  subscribeChannelsList: (userId?: string) => void;
  subscribeChannelDetail: (
    channelId: string,
    userId: string | undefined,
    onNewPost: (post: ChannelPost) => void,
    onDeletePost: (postId: string) => void,
    onUpdatePost: (post: Partial<ChannelPost> & { id: string }) => void,
    onReactionChange: (postId: string) => void,
    onMemberChange: () => void
  ) => void;
  unsubscribeChannelsList: () => void;
  unsubscribeChannelDetail: () => void;
}

export const useChannelStore = create<ChannelState>((set, get) => ({
  channels: [],
  subscribedChannels: [],
  isLoading: false,
  _listChannels: [],
  _detailChannels: [],

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

      // Check mutes
      const { data: mutes } = await supabase
        .from('channel_mutes')
        .select('channel_id')
        .eq('user_id', userId)
        .in('channel_id', ids);
      const muteSet = new Set((mutes ?? []).map((m: any) => m.channel_id));

      enriched = data.map((c: any) => ({
        ...c,
        is_subscribed: map.has(c.id),
        member_role: map.get(c.id) ?? null,
        is_muted: muteSet.has(c.id),
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

    // Check mutes
    const channelIds = data.map((m: any) => m.channel?.id).filter(Boolean);
    const { data: mutes } = await supabase
      .from('channel_mutes')
      .select('channel_id')
      .eq('user_id', userId)
      .in('channel_id', channelIds);
    const muteSet = new Set((mutes ?? []).map((m: any) => m.channel_id));

    const channels = data.map((m: any) => ({
      ...m.channel,
      is_subscribed: true,
      member_role: m.role,
      is_muted: muteSet.has(m.channel?.id),
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

    await supabase.from('channel_members').insert({ channel_id: data.id, user_id: ownerId, role: 'owner' });
    const channel = { ...data, is_subscribed: true, member_role: 'owner' } as Channel;
    set(s => ({ channels: [channel, ...s.channels], subscribedChannels: [channel, ...s.subscribedChannels] }));
    return channel;
  },

  updateChannel: async (channelId, updates) => {
    const cleanUpdates: any = {};
    if (updates.name !== undefined) cleanUpdates.name = updates.name;
    if (updates.handle !== undefined) cleanUpdates.handle = updates.handle.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (updates.description !== undefined) cleanUpdates.description = updates.description || null;
    if (updates.avatar_url !== undefined) cleanUpdates.avatar_url = updates.avatar_url || null;
    if (updates.is_public !== undefined) cleanUpdates.is_public = updates.is_public;

    const { data, error } = await supabase
      .from('channels')
      .update(cleanUpdates)
      .eq('id', channelId)
      .select('*, owner:profiles!channels_owner_id_fkey(id,username,display_name,avatar_url,is_verified,is_owner)')
      .single();

    if (error || !data) return null;
    const updated = data as Channel;
    set(s => ({
      channels: s.channels.map(c => c.id === channelId ? { ...c, ...updated } : c),
      subscribedChannels: s.subscribedChannels.map(c => c.id === channelId ? { ...c, ...updated } : c),
    }));
    return updated;
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

  // ─── Posts ────────────────────────────────────────────────────────────────────
  fetchPosts: async (channelId) => {
    const { data } = await supabase
      .from('channel_posts')
      .select('*, user:profiles!channel_posts_user_id_fkey(id,username,display_name,avatar_url,is_verified,is_owner)')
      .eq('channel_id', channelId)
      .eq('is_draft', false)
      .order('created_at', { ascending: true })
      .limit(50);
    return (data ?? []) as ChannelPost[];
  },

  createPost: async (channelId, userId, content, mediaFiles, postedAs = 'channel', scheduledFor = null) => {
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

    const payload: any = {
      channel_id: channelId,
      user_id: userId,
      content: content || null,
      media_urls: mediaUrls,
      media_types: mediaTypes,
      posted_as: postedAs,
    };

    if (scheduledFor) {
      payload.scheduled_for = scheduledFor;
      payload.is_draft = true;
    }

    const { data, error } = await supabase
      .from('channel_posts')
      .insert(payload)
      .select('*, user:profiles!channel_posts_user_id_fkey(id,username,display_name,avatar_url,is_verified,is_owner)')
      .single();

    if (error || !data) return null;
    return data as ChannelPost;
  },

  editPost: async (postId, content) => {
    await supabase
      .from('channel_posts')
      .update({ content, edited_at: new Date().toISOString() })
      .eq('id', postId);
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

  recordView: async (postId) => {
    await supabase.rpc('increment_post_views', { p_post_id: postId }).catch(() => {});
  },

  // ─── Scheduled Posts ──────────────────────────────────────────────────────────
  fetchScheduledPosts: async (channelId) => {
    const { data } = await supabase
      .from('channel_posts')
      .select('*, user:profiles!channel_posts_user_id_fkey(id,username,display_name,avatar_url,is_verified,is_owner)')
      .eq('channel_id', channelId)
      .eq('is_draft', true)
      .order('scheduled_for', { ascending: true });
    return (data ?? []) as ChannelPost[];
  },

  publishScheduledPost: async (postId) => {
    await supabase
      .from('channel_posts')
      .update({ is_draft: false, scheduled_for: null })
      .eq('id', postId);
  },

  // ─── Comments ─────────────────────────────────────────────────────────────────
  fetchComments: async (postId) => {
    const { data } = await supabase
      .from('channel_post_comments')
      .select('*, user:profiles!channel_post_comments_user_id_fkey(id,username,display_name,avatar_url,is_verified,is_owner)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    return (data ?? []) as ChannelPostComment[];
  },

  createComment: async (postId, userId, content, parentId) => {
    const payload: any = { post_id: postId, user_id: userId, content };
    if (parentId) payload.parent_id = parentId;

    const { data, error } = await supabase
      .from('channel_post_comments')
      .insert(payload)
      .select('*, user:profiles!channel_post_comments_user_id_fkey(id,username,display_name,avatar_url,is_verified,is_owner)')
      .single();

    if (error || !data) return null;

    // Increment comments_count
    await supabase.rpc('increment_channel_post_comments', { p_post_id: postId }).catch(() => {});

    return data as ChannelPostComment;
  },

  deleteComment: async (commentId) => {
    // Get the post_id first for decrementing
    const { data: comment } = await supabase
      .from('channel_post_comments')
      .select('post_id')
      .eq('id', commentId)
      .single();

    await supabase.from('channel_post_comments').delete().eq('id', commentId);

    if (comment?.post_id) {
      await supabase.rpc('decrement_channel_post_comments', { p_post_id: comment.post_id }).catch(() => {});
    }
  },

  // ─── Admin Management ─────────────────────────────────────────────────────────
  updateMemberRole: async (channelId, userId, newRole) => {
    await supabase
      .from('channel_members')
      .update({ role: newRole })
      .match({ channel_id: channelId, user_id: userId });
  },

  removeMember: async (channelId, userId) => {
    await supabase.from('channel_members').delete().match({ channel_id: channelId, user_id: userId });
    await supabase.rpc('decrement_channel_subscribers', { cid: channelId }).catch(() => {});
  },

  // ─── Mute ─────────────────────────────────────────────────────────────────────
  muteChannel: async (channelId, userId) => {
    await supabase.from('channel_mutes').upsert({ channel_id: channelId, user_id: userId });
    set(s => ({
      channels: s.channels.map(c => c.id === channelId ? { ...c, is_muted: true } : c),
      subscribedChannels: s.subscribedChannels.map(c => c.id === channelId ? { ...c, is_muted: true } : c),
    }));
  },

  unmuteChannel: async (channelId, userId) => {
    await supabase.from('channel_mutes').delete().match({ channel_id: channelId, user_id: userId });
    set(s => ({
      channels: s.channels.map(c => c.id === channelId ? { ...c, is_muted: false } : c),
      subscribedChannels: s.subscribedChannels.map(c => c.id === channelId ? { ...c, is_muted: false } : c),
    }));
  },

  // ─── Invite Links ─────────────────────────────────────────────────────────────
  createInviteLink: async (channelId, userId, options) => {
    const code = Array.from({ length: 12 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 62)]).join('');
    const payload: any = {
      channel_id: channelId,
      created_by: userId,
      code,
      is_active: true,
    };
    if (options?.expiresInHours) {
      payload.expires_at = new Date(Date.now() + options.expiresInHours * 3600000).toISOString();
    }
    if (options?.maxUses) payload.max_uses = options.maxUses;

    const { data, error } = await supabase
      .from('channel_invites')
      .insert(payload)
      .select()
      .single();

    if (error || !data) return null;
    return data as ChannelInvite;
  },

  fetchInviteLinks: async (channelId) => {
    const { data } = await supabase
      .from('channel_invites')
      .select('*')
      .eq('channel_id', channelId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    return (data ?? []) as ChannelInvite[];
  },

  revokeInviteLink: async (inviteId) => {
    await supabase.from('channel_invites').update({ is_active: false }).eq('id', inviteId);
  },

  joinViaInvite: async (code, userId) => {
    // Find invite
    const { data: invite } = await supabase
      .from('channel_invites')
      .select('*')
      .eq('code', code)
      .eq('is_active', true)
      .single();

    if (!invite) return null;

    // Check expiry
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) return null;
    // Check max uses
    if (invite.max_uses && invite.uses_count >= invite.max_uses) return null;

    // Check if already a member
    const { data: existing } = await supabase
      .from('channel_members')
      .select('id')
      .match({ channel_id: invite.channel_id, user_id: userId })
      .maybeSingle();

    if (!existing) {
      // Subscribe
      await get().subscribe(invite.channel_id, userId);
    }

    // Increment uses
    await supabase
      .from('channel_invites')
      .update({ uses_count: invite.uses_count + 1 })
      .eq('id', invite.id);

    // Fetch channel
    const { data: ch } = await supabase
      .from('channels')
      .select('*, owner:profiles!channels_owner_id_fkey(id,username,display_name,avatar_url,is_verified,is_owner)')
      .eq('id', invite.channel_id)
      .single();

    return ch ? { ...ch, is_subscribed: true, member_role: 'member' } as Channel : null;
  },

  // ─── Real-time: channels list ───────────────────────────────────────────────
  subscribeChannelsList: (userId) => {
    get().unsubscribeChannelsList();

    const ch = supabase
      .channel('channels-list-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'channels' }, async (payload) => {
        const { data } = await supabase
          .from('channels')
          .select('*, owner:profiles!channels_owner_id_fkey(id,username,display_name,avatar_url,is_verified,is_owner)')
          .eq('id', payload.new.id)
          .single();
        if (data) {
          const enriched = userId ? { ...data, is_subscribed: false, member_role: null } : data;
          set(s => ({
            channels: s.channels.some(c => c.id === data.id) ? s.channels : [enriched as Channel, ...s.channels],
          }));
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'channels' }, (payload) => {
        set(s => ({
          channels: s.channels.map(c => c.id === payload.new.id ? { ...c, ...payload.new } : c),
          subscribedChannels: s.subscribedChannels.map(c => c.id === payload.new.id ? { ...c, ...payload.new } : c),
        }));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'channels' }, (payload) => {
        set(s => ({
          channels: s.channels.filter(c => c.id !== payload.old.id),
          subscribedChannels: s.subscribedChannels.filter(c => c.id !== payload.old.id),
        }));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'channel_members' }, async (payload) => {
        if (userId && payload.new.user_id === userId) {
          const { data } = await supabase
            .from('channels')
            .select('*, owner:profiles!channels_owner_id_fkey(id,username,display_name,avatar_url,is_verified,is_owner)')
            .eq('id', payload.new.channel_id)
            .single();
          if (data) {
            const enriched = { ...data, is_subscribed: true, member_role: payload.new.role } as Channel;
            set(s => ({
              subscribedChannels: s.subscribedChannels.some(c => c.id === data.id)
                ? s.subscribedChannels
                : [enriched, ...s.subscribedChannels],
              channels: s.channels.map(c => c.id === data.id ? { ...c, is_subscribed: true, member_role: payload.new.role, subscribers_count: c.subscribers_count + 1 } : c),
            }));
          }
        } else {
          set(s => ({
            channels: s.channels.map(c => c.id === payload.new.channel_id ? { ...c, subscribers_count: c.subscribers_count + 1 } : c),
          }));
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'channel_members' }, (payload) => {
        if (userId && payload.old.user_id === userId) {
          set(s => ({
            subscribedChannels: s.subscribedChannels.filter(c => c.id !== payload.old.channel_id),
            channels: s.channels.map(c => c.id === payload.old.channel_id ? { ...c, is_subscribed: false, member_role: null, subscribers_count: Math.max(0, c.subscribers_count - 1) } : c),
          }));
        } else {
          set(s => ({
            channels: s.channels.map(c => c.id === payload.old.channel_id ? { ...c, subscribers_count: Math.max(0, c.subscribers_count - 1) } : c),
          }));
        }
      })
      .subscribe();

    set({ _listChannels: [ch] });
  },

  // ─── Real-time: channel detail (posts / reactions / members) ────────────────
  subscribeChannelDetail: (channelId, userId, onNewPost, onDeletePost, onUpdatePost, onReactionChange, onMemberChange) => {
    get().unsubscribeChannelDetail();

    const postsChannel = supabase
      .channel(`channel-posts-${channelId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'channel_posts', filter: `channel_id=eq.${channelId}` }, async (payload) => {
        // Skip drafts
        if (payload.new.is_draft) return;
        const { data } = await supabase
          .from('channel_posts')
          .select('*, user:profiles!channel_posts_user_id_fkey(id,username,display_name,avatar_url,is_verified,is_owner)')
          .eq('id', payload.new.id)
          .single();
        if (data) onNewPost({ ...data, my_reaction: null, reactions: [] } as ChannelPost);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'channel_posts', filter: `channel_id=eq.${channelId}` }, (payload) => {
        onDeletePost(payload.old.id);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'channel_posts', filter: `channel_id=eq.${channelId}` }, (payload) => {
        onUpdatePost(payload.new as Partial<ChannelPost> & { id: string });
      })
      .subscribe();

    const reactionsChannel = supabase
      .channel(`channel-reactions-${channelId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'channel_post_reactions' }, (payload) => {
        onReactionChange(payload.new.post_id);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'channel_post_reactions' }, (payload) => {
        onReactionChange(payload.old.post_id);
      })
      .subscribe();

    const membersChannel = supabase
      .channel(`channel-members-${channelId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'channel_members', filter: `channel_id=eq.${channelId}` }, () => onMemberChange())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'channel_members', filter: `channel_id=eq.${channelId}` }, () => onMemberChange())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'channel_members', filter: `channel_id=eq.${channelId}` }, () => onMemberChange())
      .subscribe();

    set({ _detailChannels: [postsChannel, reactionsChannel, membersChannel] });
  },

  unsubscribeChannelsList: () => {
    get()._listChannels.forEach(ch => supabase.removeChannel(ch));
    set({ _listChannels: [] });
  },

  unsubscribeChannelDetail: () => {
    get()._detailChannels.forEach(ch => supabase.removeChannel(ch));
    set({ _detailChannels: [] });
  },
}));
