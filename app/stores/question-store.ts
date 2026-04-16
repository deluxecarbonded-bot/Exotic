import { create } from 'zustand';
import { supabase } from '~/lib/supabase';
import type { Question, Answer } from '~/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface QuestionState {
  inbox: Question[];
  feed: Answer[];
  isLoading: boolean;
  _channels: RealtimeChannel[];
  // Callbacks for profile-level realtime updates
  _onAnswerChange: Map<string, () => void>;
  setInbox: (questions: Question[]) => void;
  setFeed: (answers: Answer[]) => void;
  addQuestion: (question: Question) => void;
  removeQuestion: (id: string) => void;
  addAnswer: (answer: Answer) => void;
  toggleLike: (answerId: string, userId: string) => Promise<void>;
  askQuestion: (receiverId: string, content: string, isAnonymous: boolean, senderId?: string | null) => Promise<void>;
  answerQuestion: (questionId: string, content: string, userId: string) => Promise<void>;
  deleteQuestion: (questionId: string) => Promise<void>;
  deleteAnswer: (answerId: string) => Promise<void>;
  fetchInbox: (userId: string) => Promise<void>;
  fetchFeed: (followedIds?: string[]) => Promise<void>;
  fetchUserAnswers: (userId: string) => Promise<Answer[]>;
  fetchLikedAnswers: (userId: string) => Promise<Answer[]>;
  checkLikes: (userId: string) => Promise<void>;
  onAnswerChange: (userId: string, callback: () => void) => () => void;
  subscribeRealtime: (userId: string) => void;
  unsubscribe: () => void;
}

export const useQuestionStore = create<QuestionState>((set, get) => ({
  inbox: [],
  feed: [],
  isLoading: false,
  _channels: [],
  _onAnswerChange: new Map(),

  setInbox: (inbox) => set({ inbox }),
  setFeed: (feed) => set({ feed }),

  addQuestion: (question) => set((s) => ({ inbox: [question, ...s.inbox] })),

  removeQuestion: (id) => set((s) => ({
    inbox: s.inbox.filter((q) => q.id !== id),
  })),

  addAnswer: (answer) => set((s) => ({
    feed: [answer, ...s.feed],
    inbox: s.inbox.filter((q) => q.id !== answer.question_id),
  })),

  fetchInbox: async (userId) => {
    set({ isLoading: true });
    const { data } = await supabase
      .from('questions')
      .select('*, sender:profiles!questions_sender_id_fkey(*)')
      .eq('receiver_id', userId)
      .order('created_at', { ascending: false });
    set({ inbox: (data ?? []) as Question[], isLoading: false });
  },

  fetchFeed: async (followedIds) => {
    set({ isLoading: true });
    let query = supabase
      .from('answers')
      .select('*, user:profiles!answers_user_id_fkey(*), question:questions(*, sender:profiles!questions_sender_id_fkey(*))')
      .order('created_at', { ascending: false })
      .limit(50);

    if (followedIds && followedIds.length > 0) {
      query = query.in('user_id', followedIds);
    }

    const { data } = await query;
    const answers = (data ?? []).map((a: any) => ({ ...a, is_liked: false, shares_count: a.shares_count ?? 0 })) as Answer[];
    set({ feed: answers, isLoading: false });
  },

  fetchUserAnswers: async (userId) => {
    const { data } = await supabase
      .from('answers')
      .select('*, user:profiles!answers_user_id_fkey(*), question:questions(*, sender:profiles!questions_sender_id_fkey(*))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return (data ?? []).map((a: any) => ({ ...a, is_liked: false, shares_count: a.shares_count ?? 0 })) as Answer[];
  },

  fetchLikedAnswers: async (userId) => {
    const { data } = await supabase
      .from('answer_likes')
      .select('answer:answers(*, user:profiles!answers_user_id_fkey(*), question:questions(*, sender:profiles!questions_sender_id_fkey(*)))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return (data ?? [])
      .map((d: any) => d.answer)
      .filter(Boolean)
      .map((a: any) => ({ ...a, is_liked: true, shares_count: a.shares_count ?? 0 })) as Answer[];
  },

  checkLikes: async (userId) => {
    const { feed } = get();
    if (feed.length === 0) return;
    const answerIds = feed.map((a) => a.id);
    const { data } = await supabase
      .from('answer_likes')
      .select('answer_id')
      .eq('user_id', userId)
      .in('answer_id', answerIds);
    if (data) {
      const likedIds = new Set(data.map((d: any) => d.answer_id));
      set((s) => ({
        feed: s.feed.map((a) => ({ ...a, is_liked: likedIds.has(a.id) })),
      }));
    }
  },

  toggleLike: async (answerId, userId) => {
    set((s) => ({
      feed: s.feed.map((a) =>
        a.id === answerId
          ? { ...a, is_liked: !a.is_liked, likes_count: a.is_liked ? a.likes_count - 1 : a.likes_count + 1 }
          : a
      ),
    }));

    const answer = get().feed.find((a) => a.id === answerId);
    if (!answer) return;

    if (answer.is_liked) {
      const { error } = await supabase
        .from('answer_likes')
        .insert({ user_id: userId, answer_id: answerId });
      if (error) {
        set((s) => ({
          feed: s.feed.map((a) =>
            a.id === answerId
              ? { ...a, is_liked: false, likes_count: a.likes_count - 1 }
              : a
          ),
        }));
        return;
      }
      if (answer.user_id !== userId) {
        await supabase.from('notifications').insert({
          user_id: answer.user_id,
          type: 'like',
          actor_id: userId,
          target_id: answerId,
          target_type: 'answer',
          message: 'liked your answer',
        });
      }
    } else {
      const { error } = await supabase
        .from('answer_likes')
        .delete()
        .match({ user_id: userId, answer_id: answerId });
      if (error) {
        set((s) => ({
          feed: s.feed.map((a) =>
            a.id === answerId
              ? { ...a, is_liked: true, likes_count: a.likes_count + 1 }
              : a
          ),
        }));
      }
    }
  },

  askQuestion: async (receiverId, content, isAnonymous, senderId) => {
    const { error } = await supabase.from('questions').insert({
      content,
      receiver_id: receiverId,
      sender_id: isAnonymous ? null : senderId,
      is_anonymous: isAnonymous,
    });
    if (error) throw error;

    if (senderId) {
      await supabase.from('notifications').insert({
        user_id: receiverId,
        type: 'question_received',
        actor_id: senderId,
        target_id: receiverId,
        target_type: 'question',
        message: isAnonymous ? 'sent you an anonymous question' : 'sent you a question',
      });
    }
  },

  answerQuestion: async (questionId, content, userId) => {
    const { data: answer, error } = await supabase
      .from('answers')
      .insert({ question_id: questionId, content, user_id: userId })
      .select('*, user:profiles!answers_user_id_fkey(*), question:questions(*, sender:profiles!questions_sender_id_fkey(*))')
      .single();
    if (error) throw error;

    await supabase
      .from('questions')
      .update({ is_answered: true })
      .eq('id', questionId);

    if (answer) {
      set((s) => ({
        feed: [{ ...answer, is_liked: false, shares_count: 0 } as Answer, ...s.feed],
        inbox: s.inbox.map((q) => q.id === questionId ? { ...q, is_answered: true } : q),
      }));
    }
  },

  deleteQuestion: async (questionId) => {
    get().removeQuestion(questionId);
    await supabase.from('questions').delete().eq('id', questionId);
  },

  deleteAnswer: async (answerId) => {
    const answer = get().feed.find((a) => a.id === answerId);
    const questionId = answer?.question_id;
    set((s) => ({
      feed: s.feed.filter((a) => a.id !== answerId),
      inbox: questionId ? s.inbox.filter((q) => q.id !== questionId) : s.inbox,
    }));
    await supabase.from('answers').delete().eq('id', answerId);
    if (questionId) {
      await supabase.from('questions').delete().eq('id', questionId);
    }
  },

  // Register a callback for when answers change for a specific user (used by profile pages)
  onAnswerChange: (userId, callback) => {
    set((s) => {
      const newMap = new Map(s._onAnswerChange);
      newMap.set(userId, callback);
      return { _onAnswerChange: newMap };
    });
    return () => {
      set((s) => {
        const newMap = new Map(s._onAnswerChange);
        newMap.delete(userId);
        return { _onAnswerChange: newMap };
      });
    };
  },

  subscribeRealtime: (userId) => {
    const { unsubscribe } = get();
    unsubscribe();

    // Channel 1: Questions I receive
    const questionsChannel = supabase
      .channel('questions-realtime')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'questions', filter: `receiver_id=eq.${userId}` },
        async (payload) => {
          const { data } = await supabase
            .from('questions')
            .select('*, sender:profiles!questions_sender_id_fkey(*)')
            .eq('id', payload.new.id)
            .single();
          if (data) {
            set((s) => {
              if (s.inbox.some((q) => q.id === data.id)) return s;
              return { inbox: [data as Question, ...s.inbox] };
            });
          }
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'questions', filter: `receiver_id=eq.${userId}` },
        (payload) => {
          set((s) => ({
            inbox: s.inbox.map((q) =>
              q.id === payload.new.id ? { ...q, ...payload.new } as Question : q
            ),
          }));
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'questions', filter: `receiver_id=eq.${userId}` },
        (payload) => {
          set((s) => ({
            inbox: s.inbox.filter((q) => q.id !== payload.old.id),
          }));
        }
      )
      .subscribe();

    // Channel 2: New answers (feed) — listen for all new answers
    const answersChannel = supabase
      .channel('answers-realtime')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'answers' },
        async (payload) => {
          const { data } = await supabase
            .from('answers')
            .select('*, user:profiles!answers_user_id_fkey(*), question:questions(*, sender:profiles!questions_sender_id_fkey(*))')
            .eq('id', payload.new.id)
            .single();
          if (data) {
            set((s) => {
              if (s.feed.some((a) => a.id === data.id)) return s;
              return {
                feed: [{ ...data, is_liked: false, shares_count: 0 } as Answer, ...s.feed],
                inbox: s.inbox.map((q) => q.id === data.question_id ? { ...q, is_answered: true } : q),
              };
            });
            // Notify profile pages watching this user's answers
            const answerUserId = payload.new.user_id;
            const callback = get()._onAnswerChange.get(answerUserId);
            if (callback) callback();
          }
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'answers' },
        (payload) => {
          set((s) => ({
            feed: s.feed.filter((a) => a.id !== payload.old.id),
          }));
          // Notify profile pages
          const answerUserId = payload.old.user_id;
          if (answerUserId) {
            const callback = get()._onAnswerChange.get(answerUserId);
            if (callback) callback();
          }
        }
      )
      .subscribe();

    // Channel 3: Like count updates in real-time
    const likesChannel = supabase
      .channel('likes-realtime')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'answer_likes' },
        (payload) => {
          const answerId = payload.new.answer_id;
          set((s) => ({
            feed: s.feed.map((a) =>
              a.id === answerId ? { ...a, likes_count: a.likes_count + 1 } : a
            ),
          }));
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'answer_likes' },
        (payload) => {
          const answerId = payload.old.answer_id;
          set((s) => ({
            feed: s.feed.map((a) =>
              a.id === answerId ? { ...a, likes_count: Math.max(0, a.likes_count - 1) } : a
            ),
          }));
        }
      )
      .subscribe();

    set({ _channels: [questionsChannel, answersChannel, likesChannel] });
  },

  unsubscribe: () => {
    const { _channels } = get();
    _channels.forEach((ch) => supabase.removeChannel(ch));
    set({ _channels: [] });
  },
}));
