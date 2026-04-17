import { create } from 'zustand';
import { supabase } from '~/lib/supabase';
import type { Post } from '~/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface PostState {
  posts: Post[];
  isLoading: boolean;
  _channels: RealtimeChannel[];
  _onPostChange: Map<string, () => void>;
  fetchPosts: (followedIds?: string[]) => Promise<void>;
  fetchUserPosts: (userId: string) => Promise<Post[]>;
  fetchDiscoverPosts: () => Promise<Post[]>;
  createPost: (userId: string, caption: string, mediaFiles: File[], precomputedTypes?: string[]) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  toggleLike: (postId: string, userId: string) => Promise<void>;
  checkLikes: (userId: string) => Promise<void>;
  onPostChange: (userId: string, callback: () => void) => () => void;
  subscribeRealtime: () => void;
  unsubscribe: () => void;
}

export const usePostStore = create<PostState>((set, get) => ({
  posts: [],
  isLoading: false,
  _channels: [],
  _onPostChange: new Map(),

  fetchPosts: async (followedIds) => {
    set({ isLoading: true });
    let query = supabase
      .from('posts')
      .select('*, user:profiles!posts_user_id_fkey(*)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (followedIds && followedIds.length > 0) {
      query = query.in('user_id', followedIds);
    }

    const { data } = await query;
    const posts = (data ?? []).map((p: any) => ({ ...p, is_liked: false })) as Post[];
    set({ posts, isLoading: false });
  },

  fetchUserPosts: async (userId) => {
    const { data } = await supabase
      .from('posts')
      .select('*, user:profiles!posts_user_id_fkey(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return (data ?? []).map((p: any) => ({ ...p, is_liked: false })) as Post[];
  },

  fetchDiscoverPosts: async () => {
    const { data } = await supabase
      .from('posts')
      .select('*, user:profiles!posts_user_id_fkey(*)')
      .order('likes_count', { ascending: false })
      .limit(20);
    return (data ?? []).map((p: any) => ({ ...p, is_liked: false })) as Post[];
  },

  createPost: async (userId, caption, mediaFiles, precomputedTypes?) => {
    const mediaUrls: string[] = [];
    const mediaTypes: string[] = [];

    for (let i = 0; i < mediaFiles.length; i++) {
      const file = mediaFiles[i];
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('posts')
        .upload(filePath, file, { contentType: file.type || 'application/octet-stream' });

      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = supabase.storage.from('posts').getPublicUrl(filePath);
      mediaUrls.push(urlData.publicUrl);
      // Use precomputed type if provided (may encode video filter/zoom), else auto-detect
      mediaTypes.push(precomputedTypes?.[i] ?? (file.type.startsWith('video/') ? 'video' : 'image'));
    }

    const { error } = await supabase.from('posts').insert({
      user_id: userId,
      caption,
      media_urls: mediaUrls,
      media_types: mediaTypes,
    });

    if (error) throw new Error(error.message);
  },

  deletePost: async (postId) => {
    set((s) => ({
      posts: s.posts.filter((p) => p.id !== postId),
    }));
    await supabase.from('posts').delete().eq('id', postId);
  },

  toggleLike: async (postId, userId) => {
    // Check if already liked
    const { data: existing } = await supabase
      .from('post_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      await supabase.from('post_likes').delete().eq('id', existing.id);
      set((s) => ({
        posts: s.posts.map((p) =>
          p.id === postId
            ? { ...p, is_liked: false, likes_count: Math.max(0, p.likes_count - 1) }
            : p
        ),
      }));
    } else {
      await supabase.from('post_likes').insert({ post_id: postId, user_id: userId });
      set((s) => ({
        posts: s.posts.map((p) =>
          p.id === postId
            ? { ...p, is_liked: true, likes_count: p.likes_count + 1 }
            : p
        ),
      }));
    }
  },

  checkLikes: async (userId) => {
    const postIds = get().posts.map((p) => p.id);
    if (postIds.length === 0) return;

    const { data } = await supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', userId)
      .in('post_id', postIds);

    const likedIds = new Set((data ?? []).map((d: any) => d.post_id));
    set((s) => ({
      posts: s.posts.map((p) => ({ ...p, is_liked: likedIds.has(p.id) })),
    }));
  },

  onPostChange: (userId, callback) => {
    set((s) => {
      const newMap = new Map(s._onPostChange);
      newMap.set(userId, callback);
      return { _onPostChange: newMap };
    });
    return () => {
      set((s) => {
        const newMap = new Map(s._onPostChange);
        newMap.delete(userId);
        return { _onPostChange: newMap };
      });
    };
  },

  subscribeRealtime: () => {
    get().unsubscribe();

    // Channel 1: Posts INSERT/UPDATE/DELETE
    const postsChannel = supabase
      .channel('posts-realtime')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        async (payload) => {
          const newPost = payload.new as any;
          const { data } = await supabase
            .from('posts')
            .select('*, user:profiles!posts_user_id_fkey(*)')
            .eq('id', newPost.id)
            .single();
          if (data) {
            set((s) => {
              if (s.posts.some((p) => p.id === data.id)) return s;
              return { posts: [{ ...data, is_liked: false } as Post, ...s.posts] };
            });
            // Notify profile pages watching this user's posts
            const postUserId = newPost.user_id;
            const callback = get()._onPostChange.get(postUserId);
            if (callback) callback();
          }
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'posts' },
        (payload) => {
          set((s) => ({
            posts: s.posts.map((p) =>
              p.id === payload.new.id
                ? { ...p, ...payload.new, user: p.user } as Post
                : p
            ),
          }));
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'posts' },
        (payload) => {
          set((s) => ({
            posts: s.posts.filter((p) => p.id !== payload.old.id),
          }));
          // Notify profile pages
          const postUserId = payload.old.user_id;
          if (postUserId) {
            const callback = get()._onPostChange.get(postUserId);
            if (callback) callback();
          }
        }
      )
      .subscribe();

    // Channel 2: Post likes real-time count updates
    const postLikesChannel = supabase
      .channel('post-likes-realtime')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'post_likes' },
        (payload) => {
          const postId = payload.new.post_id;
          set((s) => ({
            posts: s.posts.map((p) =>
              p.id === postId ? { ...p, likes_count: p.likes_count + 1 } : p
            ),
          }));
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'post_likes' },
        (payload) => {
          const postId = payload.old.post_id;
          set((s) => ({
            posts: s.posts.map((p) =>
              p.id === postId ? { ...p, likes_count: Math.max(0, p.likes_count - 1) } : p
            ),
          }));
        }
      )
      .subscribe();

    set({ _channels: [postsChannel, postLikesChannel] });
  },

  unsubscribe: () => {
    const { _channels } = get();
    _channels.forEach((ch) => supabase.removeChannel(ch));
    set({ _channels: [] });
  },
}));
