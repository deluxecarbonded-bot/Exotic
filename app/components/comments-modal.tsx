import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { IconHeart, IconTrash, IconSend, IconX, IconMessageCircle } from '~/components/icons';
import { UserAvatar } from '~/components/user-avatar';
import { VerifiedBadge, OwnerBadge } from '~/components/badges';
import { useAuthStore } from '~/stores/auth-store';
import { supabase } from '~/lib/supabase';

interface Comment {
  id: string;
  content: string;
  user_id: string;
  post_id: string;
  parent_id: string | null;
  likes_count: number;
  created_at: string;
  is_liked?: boolean;
  user: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    is_verified?: boolean;
    is_owner?: boolean;
  } | null;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(dateStr).toLocaleDateString();
}

function CommentItem({
  comment,
  currentUserId,
  onDelete,
  onReply,
  onLike,
  isReply = false,
}: {
  comment: Comment;
  currentUserId?: string;
  onDelete: (id: string) => void;
  onReply: (username: string, commentId: string) => void;
  onLike: (id: string, liked: boolean) => void;
  isReply?: boolean;
}) {
  const [liked, setLiked] = useState(comment.is_liked ?? false);
  const [likeCount, setLikeCount] = useState(comment.likes_count);
  const isOwner = currentUserId === comment.user_id;

  const handleLike = () => {
    const next = !liked;
    setLiked(next);
    setLikeCount(c => c + (next ? 1 : -1));
    onLike(comment.id, next);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className={`flex gap-2.5 ${isReply ? 'ml-9' : ''}`}
    >
      {comment.user ? (
        <Link to={`/profile/${comment.user.username}`} className="flex-shrink-0 mt-0.5">
          <UserAvatar user={comment.user as any} size="xs" />
        </Link>
      ) : (
        <div className="w-7 h-7 rounded-full bg-muted flex-shrink-0 mt-0.5" />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <span className="text-xs font-semibold mr-1.5">
              {comment.user?.display_name ?? 'Unknown'}
            </span>
            {comment.user?.is_owner && <OwnerBadge />}
            {comment.user?.is_verified && <VerifiedBadge />}
            <span className="text-sm leading-snug break-words">{comment.content}</span>
          </div>
          {/* Like button */}
          <button
            onClick={handleLike}
            className="ghost-btn flex flex-col items-center flex-shrink-0 pt-0.5"
            style={{ background: 'none', border: 'none', boxShadow: 'none', backdropFilter: 'none', padding: 0 }}
          >
            <motion.div whileTap={{ scale: 0.8 }}>
              <IconHeart
                size={13}
                filled={liked}
                className={liked ? 'text-red-500' : 'text-muted-foreground'}
              />
            </motion.div>
            {likeCount > 0 && (
              <span className="text-[9px] text-muted-foreground leading-none mt-0.5">{likeCount}</span>
            )}
          </button>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[11px] text-muted-foreground">{timeAgo(comment.created_at)}</span>
          <button
            onClick={() => onReply(comment.user?.username ?? '', comment.id)}
            className="ghost-btn text-[11px] text-muted-foreground hover:text-foreground font-medium transition-colors"
            style={{ background: 'none', border: 'none', boxShadow: 'none', backdropFilter: 'none', padding: 0 }}
          >
            Reply
          </button>
          {isOwner && (
            <button
              onClick={() => onDelete(comment.id)}
              className="ghost-btn text-[11px] text-destructive/70 hover:text-destructive font-medium transition-colors"
              style={{ background: 'none', border: 'none', boxShadow: 'none', backdropFilter: 'none', padding: 0 }}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function CommentsModal({
  open,
  onClose,
  postId,
  onCommentCountChange,
}: {
  open: boolean;
  onClose: () => void;
  postId: string;
  onCommentCountChange?: (count: number) => void;
}) {
  const { user } = useAuthStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<{ username: string; parentId: string } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch comments whenever modal opens
  useEffect(() => {
    if (!open || !postId) return;
    load();
  }, [open, postId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('post_comments')
      .select('*, user:profiles!post_comments_user_id_fkey(id,username,display_name,avatar_url,is_verified,is_owner)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (data) {
      setComments(data.map(c => ({ ...c, is_liked: false })) as Comment[]);
      onCommentCountChange?.(data.length);
    }
    setLoading(false);
  }

  const handleReply = (username: string, parentId: string) => {
    setReplyTo({ username, parentId });
    setText(`@${username} `);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const clearReply = () => {
    setReplyTo(null);
    setText('');
  };

  const handleSubmit = async () => {
    if (!user?.id || !text.trim() || submitting) return;
    setSubmitting(true);
    const payload: any = {
      post_id: postId,
      user_id: user.id,
      content: text.trim(),
    };
    if (replyTo) payload.parent_id = replyTo.parentId;

    const { data, error } = await supabase
      .from('post_comments')
      .insert(payload)
      .select('*, user:profiles!post_comments_user_id_fkey(id,username,display_name,avatar_url,is_verified,is_owner)')
      .single();

    if (!error && data) {
      const newComment = { ...data, is_liked: false } as Comment;
      setComments(prev => [...prev, newComment]);
      onCommentCountChange?.(comments.length + 1);
      setText('');
      setReplyTo(null);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

      // Send notification to post owner
      const { data: post } = await supabase
        .from('posts')
        .select('user_id')
        .eq('id', postId)
        .single();
      if (post && post.user_id !== user.id) {
        await supabase.from('notifications').insert({
          user_id: post.user_id,
          type: 'post_comment',
          actor_id: user.id,
          target_id: postId,
          target_type: 'post',
          message: 'commented on your post',
        });
      }
    }
    setSubmitting(false);
  };

  const handleDelete = async (commentId: string) => {
    await supabase.from('post_comments').delete().eq('id', commentId);
    setComments(prev => {
      const next = prev.filter(c => c.id !== commentId && c.parent_id !== commentId);
      onCommentCountChange?.(next.length);
      return next;
    });
  };

  const handleLike = async (commentId: string, liked: boolean) => {
    if (!user?.id) return;
    // Update local state immediately (optimistic)
    setComments(prev => prev.map(c =>
      c.id === commentId
        ? { ...c, likes_count: Math.max(0, c.likes_count + (liked ? 1 : -1)), is_liked: liked }
        : c
    ));
    // Persist to DB
    const target = comments.find(c => c.id === commentId);
    if (target) {
      await supabase
        .from('post_comments')
        .update({ likes_count: Math.max(0, (target.likes_count ?? 0) + (liked ? 1 : -1)) })
        .eq('id', commentId);
    }
  };

  // Separate top-level and replies
  const topLevel = comments.filter(c => !c.parent_id);
  const replies = comments.filter(c => !!c.parent_id);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 gap-0 flex flex-col max-h-[85vh]">
        <DialogHeader className="px-4 py-3 border-b border-border flex-shrink-0">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <IconMessageCircle size={16} />
            Comments
            {comments.length > 0 && (
              <span className="text-muted-foreground font-normal text-xs">({comments.length})</span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5 min-h-0">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-2.5 animate-pulse">
                  <div className="w-7 h-7 rounded-full bg-muted flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-24 bg-muted rounded" />
                    <div className="h-3 w-3/4 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <IconMessageCircle size={32} className="text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No comments yet</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">Be the first to comment</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {topLevel.map(comment => (
                <div key={comment.id} className="space-y-3">
                  <CommentItem
                    comment={comment}
                    currentUserId={user?.id}
                    onDelete={handleDelete}
                    onReply={handleReply}
                    onLike={handleLike}
                  />
                  {/* Replies */}
                  {replies.filter(r => r.parent_id === comment.id).map(reply => (
                    <CommentItem
                      key={reply.id}
                      comment={reply}
                      currentUserId={user?.id}
                      onDelete={handleDelete}
                      onReply={handleReply}
                      onLike={handleLike}
                      isReply
                    />
                  ))}
                </div>
              ))}
            </AnimatePresence>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        {user && (
          <div className="flex-shrink-0 border-t border-border px-4 py-3">
            {/* Reply indicator */}
            <AnimatePresence>
              {replyTo && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center justify-between mb-2 px-3 py-1.5 bg-muted rounded-full"
                >
                  <span className="text-xs text-muted-foreground">
                    Replying to <span className="font-semibold text-foreground">@{replyTo.username}</span>
                  </span>
                  <button onClick={clearReply} className="text-muted-foreground hover:text-foreground rounded-full p-1" style={{ background: 'none', border: 'none', boxShadow: 'none', backdropFilter: 'none' }}>
                    <IconX size={13} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-2.5">
              <UserAvatar user={user as any} size="xs" />
              <div className="relative flex-1">
                <textarea
                  ref={inputRef}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="Add a comment…"
                  rows={1}
                  className="w-full rounded-full border border-input bg-input/20 pl-4 pr-10 py-2.5 text-sm resize-none focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground leading-snug max-h-24 overflow-y-auto transition-colors dark:bg-input/30"
                  style={{ scrollbarWidth: 'none' }}
                />
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={handleSubmit}
                  disabled={!text.trim() || submitting}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex-shrink-0 text-foreground disabled:text-muted-foreground/40 transition-colors rounded-full p-1"
                  style={{ background: 'none', border: 'none', boxShadow: 'none', backdropFilter: 'none' }}
                >
                  {submitting ? (
                    <motion.div
                      className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                    />
                  ) : (
                    <IconSend size={16} />
                  )}
                </motion.button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
