import { create } from 'zustand';
import { supabase } from '~/lib/supabase';
import type { User } from '~/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface FollowRequest {
  id: string;
  follower_id: string;
  follower: User;
  created_at: string;
}

interface FollowState {
  following: Set<string>;
  requested: Set<string>;
  followers: Map<string, User[]>;
  followingList: Map<string, User[]>;
  followRequests: FollowRequest[];
  _channels: RealtimeChannel[];
  _optimisticFollowing: Set<string>;
  _optimisticRequested: Set<string>;
  _optimisticRemovals: Set<string>;
  isFollowing: (userId: string) => boolean;
  isRequested: (userId: string) => boolean;
  toggleFollow: (userId: string, currentUserId: string, targetIsPrivate?: boolean) => Promise<void>;
  setFollowing: (userIds: string[]) => void;
  fetchFollowing: (userId: string) => Promise<void>;
  fetchFollowers: (userId: string) => Promise<User[]>;
  fetchFollowingUsers: (userId: string) => Promise<User[]>;
  fetchFollowRequests: (userId: string) => Promise<void>;
  acceptFollowRequest: (followId: string, followerId: string, userId: string) => Promise<void>;
  rejectFollowRequest: (followId: string) => Promise<void>;
  subscribeRealtime: (userId: string) => void;
  unsubscribe: () => void;
}

export const useFollowStore = create<FollowState>((set, get) => ({
  following: new Set<string>(),
  requested: new Set<string>(),
  followers: new Map(),
  followingList: new Map(),
  followRequests: [],
  _channels: [],
  _optimisticFollowing: new Set<string>(),
  _optimisticRequested: new Set<string>(),
  _optimisticRemovals: new Set<string>(),

  isFollowing: (userId) => {
    const s = get();
    if (s._optimisticRemovals.has(userId)) return false;
    return s.following.has(userId) || s._optimisticFollowing.has(userId);
  },

  isRequested: (userId) => {
    const s = get();
    if (s._optimisticRemovals.has(userId)) return false;
    // If DB says we're already following, don't show requested
    if (s.following.has(userId) || s._optimisticFollowing.has(userId)) return false;
    return s.requested.has(userId) || s._optimisticRequested.has(userId);
  },

  fetchFollowing: async (userId) => {
    const { data: acceptedData } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId)
      .eq('status', 'accepted');

    const { data: pendingData } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId)
      .eq('status', 'pending');

    const acceptedIds = new Set((acceptedData ?? []).map((f: any) => f.following_id));
    const pendingIds = new Set((pendingData ?? []).map((f: any) => f.following_id));

    set((s) => {
      const mergedFollowing = new Set(acceptedIds);
      const mergedRequested = new Set(pendingIds);

      // Merge optimistic following, but skip if DB already shows them as pending
      for (const id of s._optimisticFollowing) {
        if (!s._optimisticRemovals.has(id) && !pendingIds.has(id)) {
          mergedFollowing.add(id);
        }
      }
      // Merge optimistic requested, but skip if DB already shows them as accepted
      for (const id of s._optimisticRequested) {
        if (!s._optimisticRemovals.has(id) && !acceptedIds.has(id)) {
          mergedRequested.add(id);
        }
      }
      for (const id of s._optimisticRemovals) {
        mergedFollowing.delete(id);
        mergedRequested.delete(id);
      }

      // Clean up stale optimistic state that DB has confirmed
      const cleanOptFollowing = new Set(s._optimisticFollowing);
      const cleanOptRequested = new Set(s._optimisticRequested);
      for (const id of acceptedIds) {
        cleanOptFollowing.delete(id);
        cleanOptRequested.delete(id);
      }
      for (const id of pendingIds) {
        cleanOptFollowing.delete(id);
        cleanOptRequested.delete(id);
      }

      return {
        following: mergedFollowing,
        requested: mergedRequested,
        _optimisticFollowing: cleanOptFollowing,
        _optimisticRequested: cleanOptRequested,
      };
    });
  },

  fetchFollowers: async (userId) => {
    const { data } = await supabase
      .from('follows')
      .select('follower:profiles!follows_follower_id_fkey(*)')
      .eq('following_id', userId)
      .eq('status', 'accepted');
    const users = (data ?? []).map((f: any) => f.follower).filter(Boolean) as User[];
    set((s) => {
      const newMap = new Map(s.followers);
      newMap.set(userId, users);
      return { followers: newMap };
    });
    return users;
  },

  fetchFollowingUsers: async (userId) => {
    const { data } = await supabase
      .from('follows')
      .select('following:profiles!follows_following_id_fkey(*)')
      .eq('follower_id', userId)
      .eq('status', 'accepted');
    const users = (data ?? []).map((f: any) => f.following).filter(Boolean) as User[];
    set((s) => {
      const newMap = new Map(s.followingList);
      newMap.set(userId, users);
      return { followingList: newMap };
    });
    return users;
  },

  fetchFollowRequests: async (userId) => {
    const { data } = await supabase
      .from('follows')
      .select('id, follower_id, created_at, follower:profiles!follows_follower_id_fkey(*)')
      .eq('following_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    const requests = (data ?? []).map((r: any) => ({
      id: r.id,
      follower_id: r.follower_id,
      follower: r.follower as User,
      created_at: r.created_at,
    }));

    set({ followRequests: requests });
  },

  acceptFollowRequest: async (followId, followerId, userId) => {
    set((s) => ({
      followRequests: s.followRequests.filter((r) => r.id !== followId),
    }));

    // Use .select() to verify the update actually happened (RLS might block it silently)
    const { data, error } = await supabase
      .from('follows')
      .update({ status: 'accepted' })
      .eq('id', followId)
      .select('id')
      .maybeSingle();

    if (error || !data) {
      // Update failed or was blocked by RLS — restore the request
      get().fetchFollowRequests(userId);
      return;
    }

    get().fetchFollowers(userId);

    // Delete any existing "requested to follow you" notification from this follower
    await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId)
      .eq('actor_id', followerId)
      .eq('type', 'follow')
      .eq('message', 'requested to follow you');

    // Send "accepted" notification — but first check there isn't already one
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', followerId)
      .eq('actor_id', userId)
      .eq('type', 'follow')
      .eq('message', 'accepted your follow request')
      .maybeSingle();

    if (!existing) {
      await supabase.from('notifications').insert({
        user_id: followerId,
        type: 'follow',
        actor_id: userId,
        target_id: userId,
        target_type: 'user',
        message: 'accepted your follow request',
      });
    }
  },

  rejectFollowRequest: async (followId) => {
    set((s) => ({
      followRequests: s.followRequests.filter((r) => r.id !== followId),
    }));

    await supabase.from('follows').delete().eq('id', followId);
  },

  toggleFollow: async (userId, currentUserId, targetIsPrivate = false) => {
    const s = get();
    const wasFollowing = s.isFollowing(userId);
    const wasRequested = s.isRequested(userId);

    if (wasFollowing) {
      set((prev) => {
        const newFollowing = new Set(prev.following);
        newFollowing.delete(userId);
        const newOptFollowing = new Set(prev._optimisticFollowing);
        newOptFollowing.delete(userId);
        const newRemovals = new Set(prev._optimisticRemovals);
        newRemovals.add(userId);
        return { following: newFollowing, _optimisticFollowing: newOptFollowing, _optimisticRemovals: newRemovals };
      });

      const { error } = await supabase
        .from('follows')
        .delete()
        .match({ follower_id: currentUserId, following_id: userId });

      set((prev) => {
        const newRemovals = new Set(prev._optimisticRemovals);
        newRemovals.delete(userId);
        if (error) {
          const newFollowing = new Set(prev.following);
          newFollowing.add(userId);
          return { following: newFollowing, _optimisticRemovals: newRemovals };
        }
        return { _optimisticRemovals: newRemovals };
      });
    } else if (wasRequested) {
      set((prev) => {
        const newRequested = new Set(prev.requested);
        newRequested.delete(userId);
        const newOptRequested = new Set(prev._optimisticRequested);
        newOptRequested.delete(userId);
        const newRemovals = new Set(prev._optimisticRemovals);
        newRemovals.add(userId);
        return { requested: newRequested, _optimisticRequested: newOptRequested, _optimisticRemovals: newRemovals };
      });

      const { error } = await supabase
        .from('follows')
        .delete()
        .match({ follower_id: currentUserId, following_id: userId });

      set((prev) => {
        const newRemovals = new Set(prev._optimisticRemovals);
        newRemovals.delete(userId);
        if (error) {
          const newRequested = new Set(prev.requested);
          newRequested.add(userId);
          return { requested: newRequested, _optimisticRemovals: newRemovals };
        }
        return { _optimisticRemovals: newRemovals };
      });
    } else {
      const status = targetIsPrivate ? 'pending' : 'accepted';

      if (status === 'pending') {
        set((prev) => {
          const newRequested = new Set(prev.requested);
          newRequested.add(userId);
          const newOptRequested = new Set(prev._optimisticRequested);
          newOptRequested.add(userId);
          return { requested: newRequested, _optimisticRequested: newOptRequested };
        });
      } else {
        set((prev) => {
          const newFollowing = new Set(prev.following);
          newFollowing.add(userId);
          const newOptFollowing = new Set(prev._optimisticFollowing);
          newOptFollowing.add(userId);
          return { following: newFollowing, _optimisticFollowing: newOptFollowing };
        });
      }

      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: currentUserId, following_id: userId, status });

      if (error) {
        if (status === 'pending') {
          set((prev) => {
            const newRequested = new Set(prev.requested);
            newRequested.delete(userId);
            const newOptRequested = new Set(prev._optimisticRequested);
            newOptRequested.delete(userId);
            return { requested: newRequested, _optimisticRequested: newOptRequested };
          });
        } else {
          set((prev) => {
            const newFollowing = new Set(prev.following);
            newFollowing.delete(userId);
            const newOptFollowing = new Set(prev._optimisticFollowing);
            newOptFollowing.delete(userId);
            return { following: newFollowing, _optimisticFollowing: newOptFollowing };
          });
        }
        return;
      }

      // DB confirmed — clear optimistic flag
      if (status === 'pending') {
        set((prev) => {
          const newOptRequested = new Set(prev._optimisticRequested);
          newOptRequested.delete(userId);
          return { _optimisticRequested: newOptRequested };
        });
      } else {
        set((prev) => {
          const newOptFollowing = new Set(prev._optimisticFollowing);
          newOptFollowing.delete(userId);
          return { _optimisticFollowing: newOptFollowing };
        });
      }

      // Delete any previous follow notification from this user before creating new one
      await supabase
        .from('notifications')
        .delete()
        .eq('user_id', userId)
        .eq('actor_id', currentUserId)
        .eq('type', 'follow');

      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'follow',
        actor_id: currentUserId,
        target_id: currentUserId,
        target_type: 'user',
        message: status === 'pending' ? 'requested to follow you' : 'started following you',
      });
    }
  },

  setFollowing: (userIds) => set({ following: new Set(userIds) }),

  subscribeRealtime: (userId) => {
    get().unsubscribe();

    // Channel 1: Follows directed at me (someone follows/unfollows/requests me)
    const incomingChannel = supabase
      .channel('follows-incoming')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'follows', filter: `following_id=eq.${userId}` },
        () => { get().fetchFollowers(userId); get().fetchFollowRequests(userId); }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'follows', filter: `following_id=eq.${userId}` },
        () => { get().fetchFollowers(userId); get().fetchFollowRequests(userId); }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'follows', filter: `following_id=eq.${userId}` },
        () => { get().fetchFollowers(userId); get().fetchFollowRequests(userId); }
      )
      .subscribe();

    // Channel 2: My outgoing follows — separate handlers for each event type
    const outgoingChannel = supabase
      .channel('follows-outgoing')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'follows', filter: `follower_id=eq.${userId}` },
        () => { get().fetchFollowing(userId); }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'follows', filter: `follower_id=eq.${userId}` },
        (payload) => {
          const newRow = payload.new as any;
          if (newRow?.status === 'accepted') {
            // My request was accepted — immediately move from requested to following
            const targetId = newRow.following_id;
            set((s) => {
              const newFollowing = new Set(s.following);
              newFollowing.add(targetId);
              const newRequested = new Set(s.requested);
              newRequested.delete(targetId);
              const newOptRequested = new Set(s._optimisticRequested);
              newOptRequested.delete(targetId);
              const newOptFollowing = new Set(s._optimisticFollowing);
              newOptFollowing.delete(targetId);
              const newRemovals = new Set(s._optimisticRemovals);
              newRemovals.delete(targetId);
              return {
                following: newFollowing,
                requested: newRequested,
                _optimisticFollowing: newOptFollowing,
                _optimisticRequested: newOptRequested,
                _optimisticRemovals: newRemovals,
              };
            });
          }
          // Always also refetch to ensure consistency
          get().fetchFollowing(userId);
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'follows', filter: `follower_id=eq.${userId}` },
        () => { get().fetchFollowing(userId); }
      )
      .subscribe();

    set({ _channels: [incomingChannel, outgoingChannel] });
  },

  unsubscribe: () => {
    const { _channels } = get();
    _channels.forEach((ch) => supabase.removeChannel(ch));
    set({ _channels: [] });
  },
}));
