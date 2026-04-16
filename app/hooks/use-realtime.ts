import { useEffect } from 'react';
import { useAuthStore } from '~/stores/auth-store';
import { useQuestionStore } from '~/stores/question-store';
import { useNotificationStore } from '~/stores/notification-store';
import { useFollowStore } from '~/stores/follow-store';
import { usePostStore } from '~/stores/post-store';
import { useLiveStore } from '~/stores/live-store';
import { supabase } from '~/lib/supabase';

export function useRealtimeSubscriptions() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const subscribeQuestions = useQuestionStore((s) => s.subscribeRealtime);
  const unsubscribeQuestions = useQuestionStore((s) => s.unsubscribe);

  const subscribeNotifications = useNotificationStore((s) => s.subscribeRealtime);
  const unsubscribeNotifications = useNotificationStore((s) => s.unsubscribe);
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);
  const setOnFollowAccepted = useNotificationStore((s) => s.setOnFollowAccepted);

  const subscribeFollows = useFollowStore((s) => s.subscribeRealtime);
  const unsubscribeFollows = useFollowStore((s) => s.unsubscribe);
  const fetchFollowing = useFollowStore((s) => s.fetchFollowing);

  const subscribePosts = usePostStore((s) => s.subscribeRealtime);
  const unsubscribePosts = usePostStore((s) => s.unsubscribe);

  const fetchLiveStreams = useLiveStore((s) => s.fetchLiveStreams);
  const subscribeToStreamList = useLiveStore((s) => s.subscribeToStreamList);
  const unsubscribeLive = useLiveStore((s) => s.unsubscribe);

  useEffect(() => {
    if (!user?.id) return;

    // Wire up: when a "follow accepted" notification arrives, refresh follow state
    setOnFollowAccepted(() => {
      fetchFollowing(user.id);
    });

    // Subscribe all realtime channels
    subscribeQuestions(user.id);
    subscribeNotifications(user.id);
    subscribeFollows(user.id);
    subscribePosts();
    subscribeToStreamList();

    // Initial data fetch for global state
    fetchNotifications(user.id);
    fetchFollowing(user.id);
    fetchLiveStreams();

    // Subscribe to own profile changes (e.g. follower count updates from triggers)
    const profileChannel = supabase
      .channel('own-profile-realtime')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          const current = useAuthStore.getState().user;
          if (current) {
            setUser({ ...current, ...payload.new } as any);
          }
        }
      )
      .subscribe();

    return () => {
      unsubscribeQuestions();
      unsubscribeNotifications();
      unsubscribeFollows();
      unsubscribePosts();
      unsubscribeLive();
      supabase.removeChannel(profileChannel);
    };
  }, [user?.id]);
}
