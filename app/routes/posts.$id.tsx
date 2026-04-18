import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { motion } from 'framer-motion';
import { supabase } from '~/lib/supabase';
import { useAuthStore } from '~/stores/auth-store';
import { usePostStore } from '~/stores/post-store';
import { PostCard } from '~/components/cards';
import { IconArrowLeft } from '~/components/icons';
import type { Post } from '~/types';

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (id) fetchPost();
  }, [id, user?.id]);

  async function fetchPost() {
    setLoading(true);
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        user:profiles!posts_user_id_fkey(
          id, username, display_name, avatar_url, is_verified, is_owner
        )
      `)
      .eq('id', id!)
      .single();

    if (error || !data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let enriched: Post = data as Post;
    if (user?.id) {
      const { data: like } = await supabase
        .from('post_likes')
        .select('id')
        .match({ post_id: id, user_id: user.id })
        .maybeSingle();
      enriched = { ...data, is_liked: !!like } as Post;
    } else {
      enriched = { ...data, is_liked: false } as Post;
    }

    setPost(enriched);
    setLoading(false);
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-xl border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="ghost-btn text-muted-foreground hover:text-foreground transition-colors"
          >
            <IconArrowLeft size={20} />
          </button>
          <span className="font-semibold text-sm">Post</span>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col gap-4 p-5">
          {/* Skeleton */}
          <div className="flex items-center gap-3 animate-pulse">
            <div className="w-10 h-10 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 bg-muted rounded" />
              <div className="h-2.5 w-20 bg-muted rounded" />
            </div>
          </div>
          <div className="aspect-square w-full rounded-2xl bg-muted animate-pulse" />
          <div className="space-y-2 animate-pulse">
            <div className="h-3 w-full bg-muted rounded" />
            <div className="h-3 w-3/4 bg-muted rounded" />
          </div>
        </div>
      ) : notFound ? (
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/50">
              <rect x="3" y="3" width="18" height="18" rx="3"/>
              <path d="M9 9l6 6M15 9l-6 6"/>
            </svg>
          </div>
          <div>
            <p className="font-semibold">Post not found</p>
            <p className="text-sm text-muted-foreground mt-1">This post may have been deleted or doesn't exist.</p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-muted-foreground hover:text-foreground underline transition-colors"
          >
            Go back
          </button>
        </div>
      ) : post ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="border-b border-border"
        >
          <PostCard post={post} />
        </motion.div>
      ) : null}
    </div>
  );
}
