import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '~/stores/auth-store';
import { useChannelStore } from '~/stores/channel-store';
import { useToastStore } from '~/stores/toast-store';
import { supabase } from '~/lib/supabase';
import { parseMediaType } from '~/components/media-editor';
import {
  IconArrowLeft, IconUsers, IconLock, IconGlobe, IconMoreHorizontal,
  IconTrash, IconPin, IconX, IconSend, IconImage, IconMegaphone,
  IconChevronRight, IconCrown, IconShield, IconEye, IconMessageCircle,
  IconEdit, IconShare2, IconBell, IconBellOff, IconLink, IconCopy,
  IconClock, IconSettings, IconUserMinus, IconCheck,
} from '~/components/icons';
import { UserAvatar } from '~/components/user-avatar';
import { VerifiedBadge, OwnerBadge } from '~/components/badges';
import type { Channel, ChannelPost, ChannelMember, ChannelPostComment, ChannelInvite } from '~/types';

const QUICK_REACTIONS = ['👍', '❤️', '🔥', '😂', '😮', '👎'];

function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ─── Channel Avatar ────────────────────────────────────────────────────────────
function ChannelAvatar({ channel, size = 48 }: { channel: Channel; size?: number }) {
  if (channel.avatar_url) return <img src={channel.avatar_url} alt={channel.name} className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />;
  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500', 'bg-indigo-500'];
  const color = colors[channel.name.charCodeAt(0) % colors.length];
  return (
    <div className={`${color} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`} style={{ width: size, height: size, fontSize: size * 0.35 }}>
      {channel.name.slice(0, 2).toUpperCase()}
    </div>
  );
}

// ─── Reaction Bar ──────────────────────────────────────────────────────────────
function ReactionBar({ post, onReact, onRemove }: {
  post: ChannelPost;
  onReact: (emoji: string) => void;
  onRemove: (emoji: string) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);

  const handleEmoji = (emoji: string) => {
    if (post.my_reaction === emoji) onRemove(emoji);
    else onReact(emoji);
    setShowPicker(false);
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-2">
      {(post.reactions ?? []).map(({ emoji, count }) => (
        <motion.button key={emoji} whileTap={{ scale: 0.88 }} onClick={() => handleEmoji(emoji)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-colors ${
            post.my_reaction === emoji ? 'bg-foreground text-background' : 'bg-muted hover:bg-muted/80 text-foreground'
          }`}>
          <span>{emoji}</span>
          {count > 0 && <span className="font-medium">{count}</span>}
        </motion.button>
      ))}
      <div className="relative">
        <motion.button whileTap={{ scale: 0.88 }} onClick={() => setShowPicker(v => !v)}
          className="ghost-btn flex items-center justify-center w-7 h-7 rounded-full bg-muted hover:bg-muted/80 text-sm text-muted-foreground transition-colors">
          😊
        </motion.button>
        <AnimatePresence>
          {showPicker && (
            <>
              <div className="fixed inset-0 z-[9]" onClick={() => setShowPicker(false)} />
              <motion.div initial={{ opacity: 0, scale: 0.9, y: 4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                className="absolute bottom-9 left-0 z-10 flex gap-1 bg-background border border-border rounded-2xl p-2 shadow-xl">
                {QUICK_REACTIONS.map(e => (
                  <button key={e} onClick={() => handleEmoji(e)} className="ghost-btn w-8 h-8 flex items-center justify-center text-lg hover:scale-110 transition-transform rounded-full hover:bg-muted">{e}</button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Comments Panel ─────────────────────────────────────────────────────────────
function CommentsPanel({ postId, onClose, onCountChange }: {
  postId: string;
  onClose: () => void;
  onCountChange: (count: number) => void;
}) {
  const { user } = useAuthStore();
  const { fetchComments, createComment, deleteComment } = useChannelStore();
  const [comments, setComments] = useState<ChannelPostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetchComments(postId).then(data => {
      setComments(data);
      onCountChange(data.length);
      setLoading(false);
    });
  }, [postId]);

  const handleSubmit = async () => {
    if (!user?.id || !text.trim() || submitting) return;
    setSubmitting(true);
    const comment = await createComment(postId, user.id, text.trim(), replyTo?.id);
    if (comment) {
      setComments(prev => [...prev, comment]);
      onCountChange(comments.length + 1);
      setText('');
      setReplyTo(null);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    await deleteComment(id);
    setComments(prev => {
      const next = prev.filter(c => c.id !== id && c.parent_id !== id);
      onCountChange(next.length);
      return next;
    });
  };

  const topLevel = comments.filter(c => !c.parent_id);
  const replies = comments.filter(c => !!c.parent_id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
      className="border-t border-border bg-background"
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <span className="text-xs font-semibold flex items-center gap-1.5">
          <IconMessageCircle size={14} /> Comments {comments.length > 0 && `(${comments.length})`}
        </span>
        <button onClick={onClose} className="ghost-btn text-muted-foreground hover:text-foreground p-1" style={{ background: 'none', border: 'none', boxShadow: 'none', backdropFilter: 'none' }}>
          <IconX size={14} />
        </button>
      </div>

      <div className="max-h-64 overflow-y-auto px-4 py-2 space-y-3">
        {loading ? (
          <div className="flex justify-center py-4">
            <motion.div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-foreground rounded-full" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No comments yet</p>
        ) : (
          topLevel.map(comment => (
            <div key={comment.id}>
              <CommentRow comment={comment} currentUserId={user?.id} onDelete={handleDelete} onReply={(username) => { setReplyTo({ id: comment.id, username }); setText(`@${username} `); }} />
              {replies.filter(r => r.parent_id === comment.id).map(reply => (
                <div key={reply.id} className="ml-8">
                  <CommentRow comment={reply} currentUserId={user?.id} onDelete={handleDelete} onReply={(username) => { setReplyTo({ id: comment.id, username }); setText(`@${username} `); }} />
                </div>
              ))}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {user && (
        <div className="px-4 py-2 border-t border-border">
          {replyTo && (
            <div className="flex items-center justify-between mb-1.5 px-3 py-1 bg-muted rounded-full">
              <span className="text-[10px] text-muted-foreground">
                Replying to <span className="font-semibold text-foreground">@{replyTo.username}</span>
              </span>
              <button onClick={() => { setReplyTo(null); setText(''); }} className="text-muted-foreground hover:text-foreground p-0.5" style={{ background: 'none', border: 'none', boxShadow: 'none', backdropFilter: 'none' }}>
                <IconX size={10} />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
              placeholder="Add a comment…"
              className="flex-1 rounded-full border border-input bg-input/20 px-3 py-2 text-xs focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground dark:bg-input/30"
            />
            <motion.button whileTap={{ scale: 0.9 }} onClick={handleSubmit} disabled={!text.trim() || submitting}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-foreground text-background disabled:opacity-40 text-xs flex-shrink-0">
              <IconSend size={12} />
            </motion.button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function CommentRow({ comment, currentUserId, onDelete, onReply }: {
  comment: ChannelPostComment;
  currentUserId?: string;
  onDelete: (id: string) => void;
  onReply: (username: string) => void;
}) {
  return (
    <div className="flex gap-2">
      {comment.user ? (
        <Link to={`/profile/${comment.user.username}`} className="flex-shrink-0 mt-0.5">
          <UserAvatar user={comment.user as any} size="xs" />
        </Link>
      ) : (
        <div className="w-6 h-6 rounded-full bg-muted flex-shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <div>
          <span className="text-[10px] font-semibold mr-1">{comment.user?.display_name ?? 'Unknown'}</span>
          {comment.user?.is_verified && <VerifiedBadge />}
          <span className="text-xs leading-snug">{comment.content}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[9px] text-muted-foreground">{timeAgo(comment.created_at)}</span>
          <button onClick={() => onReply(comment.user?.username ?? '')}
            className="text-[9px] text-muted-foreground hover:text-foreground font-medium"
            style={{ background: 'none', border: 'none', boxShadow: 'none', backdropFilter: 'none', padding: 0 }}>
            Reply
          </button>
          {currentUserId === comment.user_id && (
            <button onClick={() => onDelete(comment.id)}
              className="text-[9px] text-destructive/70 hover:text-destructive font-medium"
              style={{ background: 'none', border: 'none', boxShadow: 'none', backdropFilter: 'none', padding: 0 }}>
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Post Card ─────────────────────────────────────────────────────────────────
function ChannelPostCard({ post, channel, canAdmin, currentUserId, onDelete, onPin, onReact, onRemoveReaction, onEdit, onShare, onCommentCountChange }: {
  post: ChannelPost & { posted_as?: 'channel' | 'user' };
  channel: Channel;
  canAdmin: boolean;
  currentUserId?: string;
  onDelete: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onReact: (postId: string, emoji: string) => void;
  onRemoveReaction: (postId: string, emoji: string) => void;
  onEdit: (postId: string, content: string) => void;
  onShare: (postId: string) => void;
  onCommentCountChange: (postId: string, count: number) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [activeMedia, setActiveMedia] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(post.content ?? '');
  const [showComments, setShowComments] = useState(false);
  const [copied, setCopied] = useState(false);
  const postedAs = (post as any).posted_as ?? 'channel';
  const postRef = useRef<HTMLDivElement>(null);

  // Views tracking
  const viewedRef = useRef(false);
  const { recordView } = useChannelStore();
  useEffect(() => {
    if (viewedRef.current || !postRef.current) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !viewedRef.current) {
        viewedRef.current = true;
        recordView(post.id);
        obs.disconnect();
      }
    }, { threshold: 0.5 });
    obs.observe(postRef.current);
    return () => obs.disconnect();
  }, [post.id]);

  const handleSaveEdit = () => {
    onEdit(post.id, editText);
    setEditing(false);
  };

  const handleShare = () => {
    onShare(post.id);
    setCopied(true);
    useToastStore.getState().addToast('Link copied to clipboard', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      ref={postRef}
      id={`post-${post.id}`}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={`px-4 py-4 ${post.is_pinned ? 'bg-muted/30 border-l-2 border-foreground/20' : ''}`}
    >
      {post.is_pinned && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-2">
          <IconPin size={10} /><span>Pinned</span>
        </div>
      )}

      {/* Sender identity */}
      <div className="flex items-center gap-2 mb-3">
        {postedAs === 'channel' ? (
          <>
            <ChannelAvatar channel={channel} size={32} />
            <div>
              <span className="text-xs font-semibold">{channel.name}</span>
              <p className="text-[10px] text-muted-foreground">@{channel.handle}</p>
            </div>
          </>
        ) : (
          post.user && (
            <>
              <UserAvatar user={post.user as any} size="xs" />
              <div>
                <span className="text-xs font-semibold">{post.user.display_name}</span>
                {post.user.is_verified && <VerifiedBadge />}
                <p className="text-[10px] text-muted-foreground">@{post.user.username}</p>
              </div>
            </>
          )
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[11px] text-muted-foreground">{timeAgo(post.created_at)}</span>
          {post.edited_at && <span className="text-[9px] text-muted-foreground italic">(edited)</span>}
        </div>
      </div>

      {/* Media */}
      {post.media_urls.length > 0 && (() => {
        const raw = post.media_types[activeMedia] ?? 'image';
        const { isVideo, filter, zoom } = parseMediaType(raw);
        const style: React.CSSProperties = { filter: filter !== 'none' ? filter : undefined, transform: zoom !== 1 ? `scale(${zoom})` : undefined };
        return (
          <div className="relative rounded-2xl overflow-hidden mb-3 bg-muted">
            {isVideo
              ? <video src={post.media_urls[activeMedia]} controls className="w-full max-h-[480px] object-contain" preload="metadata" style={style} />
              : <img src={post.media_urls[activeMedia]} alt="" className="w-full max-h-[480px] object-contain" loading="lazy" style={style} />
            }
            {post.media_urls.length > 1 && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {post.media_urls.map((_, i) => (
                  <button key={i} onClick={() => setActiveMedia(i)} className={`w-1.5 h-1.5 rounded-full ${i === activeMedia ? 'bg-white' : 'bg-white/50'}`} />
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Content / Edit mode */}
      {editing ? (
        <div className="mb-2">
          <textarea
            value={editText}
            onChange={e => setEditText(e.target.value)}
            className="w-full bg-muted rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-foreground/20 min-h-[60px]"
          />
          <div className="flex gap-2 mt-1.5">
            <button onClick={handleSaveEdit} className="px-3 py-1 text-xs font-medium rounded-full bg-foreground text-background">Save</button>
            <button onClick={() => { setEditing(false); setEditText(post.content ?? ''); }} className="px-3 py-1 text-xs font-medium rounded-full bg-muted text-muted-foreground">Cancel</button>
          </div>
        </div>
      ) : (
        post.content && <p className="text-sm leading-relaxed mb-2 whitespace-pre-wrap">{post.content}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <ReactionBar post={post} onReact={e => onReact(post.id, e)} onRemove={e => onRemoveReaction(post.id, e)} />
        </div>

        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          {/* Views */}
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <IconEye size={12} />
            {post.views_count > 0 ? formatCount(post.views_count) : '0'}
          </span>

          {/* Comments button */}
          <button onClick={() => setShowComments(v => !v)}
            className="ghost-btn flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground ml-1"
            style={{ background: 'none', border: 'none', boxShadow: 'none', backdropFilter: 'none', padding: '2px 4px' }}>
            <IconMessageCircle size={12} />
            {(post.comments_count ?? 0) > 0 && <span>{post.comments_count}</span>}
          </button>

          {/* Share */}
          <button onClick={handleShare}
            className="ghost-btn flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
            style={{ background: 'none', border: 'none', boxShadow: 'none', backdropFilter: 'none', padding: '2px 4px' }}>
            {copied ? <IconCheck size={12} className="text-green-500" /> : <IconShare2 size={12} />}
          </button>

          {/* Admin menu */}
          {canAdmin && (
            <div className="relative">
              <button onClick={() => setShowMenu(v => !v)} className="ghost-btn text-muted-foreground hover:text-foreground"
                style={{ background: 'none', border: 'none', boxShadow: 'none', backdropFilter: 'none', padding: '2px' }}>
                <IconMoreHorizontal size={15} />
              </button>
              <AnimatePresence>
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-[9]" onClick={() => setShowMenu(false)} />
                    <motion.div initial={{ opacity: 0, scale: 0.92, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
                      className="absolute right-0 bottom-7 w-40 bg-background border border-border rounded-xl z-10 py-1.5 shadow-lg">
                      {(canAdmin || currentUserId === post.user_id) && (
                        <button className="ghost-btn flex items-center gap-2 w-full px-4 py-2 text-xs hover:bg-muted text-left"
                          onClick={() => { setEditing(true); setEditText(post.content ?? ''); setShowMenu(false); }}>
                          <IconEdit size={13} />Edit
                        </button>
                      )}
                      <button className="ghost-btn flex items-center gap-2 w-full px-4 py-2 text-xs hover:bg-muted text-left"
                        onClick={() => { onPin(post.id, !post.is_pinned); setShowMenu(false); }}>
                        <IconPin size={13} />{post.is_pinned ? 'Unpin' : 'Pin post'}
                      </button>
                      <div className="border-t border-border my-1" />
                      <button className="ghost-btn flex items-center gap-2 w-full px-4 py-2 text-xs hover:bg-muted text-left text-destructive"
                        onClick={() => { onDelete(post.id); setShowMenu(false); }}>
                        <IconTrash size={13} />Delete
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Comments panel */}
      <AnimatePresence>
        {showComments && (
          <CommentsPanel
            postId={post.id}
            onClose={() => setShowComments(false)}
            onCountChange={(count) => onCommentCountChange(post.id, count)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Post Composer ─────────────────────────────────────────────────────────────
function PostComposer({ channel, user, onPosted }: {
  channel: Channel;
  user: { id: string; display_name: string; avatar_url: string | null; username: string };
  onPosted: (p: ChannelPost) => void;
}) {
  const { createPost } = useChannelStore();
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [postedAs, setPostedAs] = useState<'channel' | 'user'>('channel');
  const [showIdentityPicker, setShowIdentityPicker] = useState(false);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledFor, setScheduledFor] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    setFiles(f => [...f, ...picked]);
    setPreviews(p => [...p, ...picked.map(f => URL.createObjectURL(f))]);
    e.target.value = '';
  };

  const removeFile = (i: number) => {
    setFiles(f => f.filter((_, idx) => idx !== i));
    setPreviews(p => p.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async () => {
    if ((!text.trim() && files.length === 0) || submitting) return;
    if (scheduleMode && !scheduledFor) return;
    setSubmitting(true);
    const post = await createPost(channel.id, user.id, text, files, postedAs, scheduleMode ? new Date(scheduledFor).toISOString() : null);
    if (post) {
      if (!scheduleMode) {
        onPosted({ ...post, posted_as: postedAs } as any);
      }
      setText('');
      setFiles([]);
      setPreviews([]);
      setScheduleMode(false);
      setScheduledFor('');
    }
    setSubmitting(false);
  };

  return (
    <div className="border-t border-border bg-background">
      {/* Post as selector strip */}
      <div className="px-4 pt-2.5 pb-1 flex items-center justify-between">
        <div className="relative inline-block">
          <button
            onClick={() => setShowIdentityPicker(v => !v)}
            className="ghost-btn flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {postedAs === 'channel'
              ? <ChannelAvatar channel={channel} size={18} />
              : user.avatar_url
                ? <img src={user.avatar_url} className="w-[18px] h-[18px] rounded-full object-cover" alt="" />
                : <div className="w-[18px] h-[18px] rounded-full bg-muted flex items-center justify-center text-[9px] font-bold">{user.display_name?.[0]}</div>
            }
            <span>Post as <span className="font-semibold text-foreground">{postedAs === 'channel' ? channel.name : user.display_name}</span></span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          <AnimatePresence>
            {showIdentityPicker && (
              <>
                <div className="fixed inset-0 z-[49]" onClick={() => setShowIdentityPicker(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 4 }}
                  className="absolute bottom-7 left-0 z-[50] w-52 bg-background border border-border rounded-2xl overflow-hidden shadow-xl"
                >
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-4 pt-3 pb-1">Post as</p>
                  <button
                    onClick={() => { setPostedAs('channel'); setShowIdentityPicker(false); }}
                    className={`ghost-btn flex items-center gap-2.5 w-full px-4 py-2.5 text-left hover:bg-muted transition-colors ${postedAs === 'channel' ? 'text-foreground' : 'text-muted-foreground'}`}
                  >
                    <ChannelAvatar channel={channel} size={28} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{channel.name}</p>
                      <p className="text-[10px] text-muted-foreground">@{channel.handle}</p>
                    </div>
                    {postedAs === 'channel' && <div className="w-2 h-2 rounded-full bg-foreground flex-shrink-0" />}
                  </button>
                  <button
                    onClick={() => { setPostedAs('user'); setShowIdentityPicker(false); }}
                    className={`ghost-btn flex items-center gap-2.5 w-full px-4 py-2.5 pb-3 text-left hover:bg-muted transition-colors ${postedAs === 'user' ? 'text-foreground' : 'text-muted-foreground'}`}
                  >
                    {user.avatar_url
                      ? <img src={user.avatar_url} className="w-7 h-7 rounded-full object-cover flex-shrink-0" alt="" />
                      : <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold flex-shrink-0">{user.display_name?.[0]}</div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{user.display_name}</p>
                      <p className="text-[10px] text-muted-foreground">@{user.username}</p>
                    </div>
                    {postedAs === 'user' && <div className="w-2 h-2 rounded-full bg-foreground flex-shrink-0" />}
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Schedule mode */}
      <AnimatePresence>
        {scheduleMode && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="px-4 pb-1">
            <div className="flex items-center gap-2 bg-muted rounded-full px-3 py-1.5">
              <IconClock size={12} className="text-muted-foreground" />
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={e => setScheduledFor(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="flex-1 bg-transparent text-xs focus:outline-none"
              />
              <button onClick={() => { setScheduleMode(false); setScheduledFor(''); }}
                className="text-muted-foreground hover:text-foreground" style={{ background: 'none', border: 'none', boxShadow: 'none', backdropFilter: 'none', padding: 0 }}>
                <IconX size={12} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Media previews */}
      <AnimatePresence>
        {previews.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="flex gap-2 px-4 pb-1 overflow-x-auto">
            {previews.map((p, i) => (
              <div key={i} className="relative flex-shrink-0">
                <img src={p} alt="" className="w-14 h-14 object-cover rounded-xl" />
                <button onClick={() => removeFile(i)} className="ghost-btn absolute -top-1.5 -right-1.5 bg-background border border-border rounded-full w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground">
                  <IconX size={10} />
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input row */}
      <div className="flex items-end gap-2 px-3 pb-3">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
          placeholder={`Message as ${postedAs === 'channel' ? channel.name : user.display_name}…`}
          rows={1}
          className="flex-1 bg-muted rounded-full px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-foreground/20 max-h-28 min-h-[38px]"
          style={{ scrollbarWidth: 'none' }}
        />
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setScheduleMode(v => !v)}
          className={`ghost-btn w-9 h-9 flex items-center justify-center rounded-full transition-colors flex-shrink-0 self-end ${scheduleMode ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          <IconClock size={18} />
        </motion.button>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => fileRef.current?.click()}
          className="ghost-btn w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 self-end">
          <IconImage size={18} />
        </motion.button>
        <motion.button whileTap={{ scale: 0.9 }} onClick={handleSubmit}
          disabled={(!text.trim() && files.length === 0) || submitting || (scheduleMode && !scheduledFor)}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-foreground text-background disabled:opacity-40 transition-opacity flex-shrink-0 self-end">
          {submitting
            ? <motion.div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7, ease: 'linear' }} />
            : scheduleMode ? <IconClock size={16} /> : <IconSend size={16} />}
        </motion.button>
      </div>
      <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleFiles} />
    </div>
  );
}

// ─── Edit Channel Modal ─────────────────────────────────────────────────────────
function EditChannelModal({ channel, onClose, onUpdated }: {
  channel: Channel;
  onClose: () => void;
  onUpdated: (c: Channel) => void;
}) {
  const { updateChannel } = useChannelStore();
  const [name, setName] = useState(channel.name);
  const [handle, setHandle] = useState(channel.handle);
  const [description, setDescription] = useState(channel.description ?? '');
  const [isPublic, setIsPublic] = useState(channel.is_public);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !handle.trim()) return;
    setLoading(true);
    setError('');
    const updated = await updateChannel(channel.id, { name: name.trim(), handle, description: description.trim(), is_public: isPublic });
    if (!updated) {
      setError('Handle already taken or update failed.');
      setLoading(false);
      return;
    }
    onUpdated(updated);
    onClose();
  };

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div className="relative w-full max-w-md bg-background rounded-2xl overflow-hidden shadow-2xl"
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-bold text-base">Edit Channel</h2>
          <button onClick={onClose} className="ghost-btn text-muted-foreground hover:text-foreground"><IconX size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Channel Name</label>
            <input value={name} onChange={e => setName(e.target.value)} maxLength={64} required
              className="w-full bg-muted rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Handle</label>
            <div className="flex items-center bg-muted rounded-full overflow-hidden focus-within:ring-2 focus-within:ring-foreground/20">
              <span className="pl-4 text-sm text-muted-foreground select-none">@</span>
              <input value={handle} onChange={e => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 32))}
                maxLength={32} required className="flex-1 bg-transparent px-2 py-3 text-sm focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={256} rows={2}
              className="w-full bg-muted rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-none" />
          </div>
          <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
            <div className="flex items-center gap-3">
              {isPublic ? <IconGlobe size={18} className="text-muted-foreground" /> : <IconLock size={18} className="text-muted-foreground" />}
              <div>
                <p className="text-sm font-medium">{isPublic ? 'Public' : 'Private'}</p>
                <p className="text-xs text-muted-foreground">{isPublic ? 'Anyone can find and join' : 'Invite only'}</p>
              </div>
            </div>
            <button type="button" onClick={() => setIsPublic(!isPublic)}
              className={`relative w-11 h-6 rounded-full transition-colors ${isPublic ? 'bg-foreground' : 'bg-muted-foreground/30'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-background rounded-full shadow transition-transform ${isPublic ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={loading || !name.trim() || !handle.trim()}
            className="w-full py-3 bg-foreground text-background rounded-xl font-semibold text-sm disabled:opacity-50 transition-opacity">
            {loading ? 'Saving…' : 'Save Changes'}
          </motion.button>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─── Invite Link Modal ──────────────────────────────────────────────────────────
function InviteLinkModal({ channel, onClose }: { channel: Channel; onClose: () => void }) {
  const { createInviteLink, fetchInviteLinks, revokeInviteLink } = useChannelStore();
  const { user } = useAuthStore();
  const [invites, setInvites] = useState<ChannelInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    fetchInviteLinks(channel.id).then(data => { setInvites(data); setLoading(false); });
  }, [channel.id]);

  const handleCreate = async () => {
    if (!user?.id) return;
    setCreating(true);
    const invite = await createInviteLink(channel.id, user.id);
    if (invite) setInvites(prev => [invite, ...prev]);
    setCreating(false);
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/channels/invite/${code}`);
    setCopied(code);
    useToastStore.getState().addToast('Invite link copied', 'success');
    setTimeout(() => setCopied(''), 2000);
  };

  const handleRevoke = async (id: string) => {
    await revokeInviteLink(id);
    setInvites(prev => prev.filter(i => i.id !== id));
    useToastStore.getState().addToast('Invite link deleted', 'success');
  };

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div className="relative w-full max-w-md bg-background rounded-2xl overflow-hidden shadow-2xl"
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-bold text-base">Invite Links</h2>
          <button onClick={onClose} className="ghost-btn text-muted-foreground hover:text-foreground"><IconX size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleCreate} disabled={creating}
            className="w-full py-3 bg-foreground text-background rounded-xl font-semibold text-sm disabled:opacity-50">
            {creating ? 'Creating…' : 'Create New Link'}
          </motion.button>

          {loading ? (
            <div className="flex justify-center py-4">
              <motion.div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-foreground rounded-full" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} />
            </div>
          ) : invites.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No active invite links</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {invites.map(invite => (
                <div key={invite.id} className="flex items-center gap-2 p-3 bg-muted rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono truncate">{window.location.origin}/channels/invite/{invite.code}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {invite.uses_count} uses
                      {invite.expires_at && ` · Expires ${new Date(invite.expires_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <button onClick={() => handleCopy(invite.code)}
                    className="ghost-btn p-1.5 text-muted-foreground hover:text-foreground"
                    style={{ background: 'none', border: 'none', boxShadow: 'none', backdropFilter: 'none' }}>
                    {copied === invite.code ? <IconCheck size={14} className="text-green-500" /> : <IconCopy size={14} />}
                  </button>
                  <button onClick={() => handleRevoke(invite.id)}
                    className="ghost-btn p-1.5 text-destructive/70 hover:text-destructive"
                    style={{ background: 'none', border: 'none', boxShadow: 'none', backdropFilter: 'none' }}>
                    <IconTrash size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Right Sidebar ─────────────────────────────────────────────────────────────
function ChannelSidebar({ channel, members, posts, onClose, isMobile, onMemberAction }: {
  channel: Channel;
  members: ChannelMember[];
  posts: ChannelPost[];
  onClose?: () => void;
  isMobile?: boolean;
  onMemberAction?: () => void;
}) {
  const { user } = useAuthStore();
  const { updateMemberRole, removeMember } = useChannelStore();
  const [memberMenu, setMemberMenu] = useState<string | null>(null);
  const admins = members.filter(m => m.role === 'owner' || m.role === 'admin');
  const regularMembers = members.filter(m => m.role === 'member');
  const isOwner = channel.member_role === 'owner';

  const RoleIcon = ({ role }: { role: string }) => {
    if (role === 'owner') return <IconCrown size={11} className="text-yellow-500" />;
    if (role === 'admin') return <IconShield size={11} className="text-blue-500" />;
    return null;
  };

  const handlePromote = async (userId: string) => {
    await updateMemberRole(channel.id, userId, 'admin');
    setMemberMenu(null);
    onMemberAction?.();
  };

  const handleDemote = async (userId: string) => {
    await updateMemberRole(channel.id, userId, 'member');
    setMemberMenu(null);
    onMemberAction?.();
  };

  const handleRemove = async (userId: string) => {
    await removeMember(channel.id, userId);
    setMemberMenu(null);
    onMemberAction?.();
  };

  const MemberRow = ({ m }: { m: ChannelMember }) => (
    <div className="flex items-center gap-2.5 group relative">
      <Link to={`/profile/${m.user?.username}`} className="flex items-center gap-2.5 flex-1 min-w-0 hover:opacity-80 transition-opacity">
        {m.user && <UserAvatar user={m.user as any} size="xs" />}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{m.user?.display_name ?? 'Unknown'}</p>
          <p className="text-[10px] text-muted-foreground truncate">@{m.user?.username}</p>
        </div>
      </Link>
      <RoleIcon role={m.role} />
      {isOwner && m.role !== 'owner' && m.user_id !== user?.id && (
        <div className="relative">
          <button onClick={() => setMemberMenu(memberMenu === m.id ? null : m.id)}
            className="ghost-btn opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity p-0.5"
            style={{ background: 'none', border: 'none', boxShadow: 'none', backdropFilter: 'none' }}>
            <IconMoreHorizontal size={14} />
          </button>
          <AnimatePresence>
            {memberMenu === m.id && (
              <>
                <div className="fixed inset-0 z-[9]" onClick={() => setMemberMenu(null)} />
                <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
                  className="absolute right-0 top-6 w-44 bg-background border border-border rounded-xl z-10 py-1.5 shadow-lg">
                  {m.role === 'member' ? (
                    <button onClick={() => handlePromote(m.user_id)}
                      className="ghost-btn flex items-center gap-2 w-full px-4 py-2 text-xs hover:bg-muted text-left">
                      <IconShield size={12} /> Promote to Admin
                    </button>
                  ) : (
                    <button onClick={() => handleDemote(m.user_id)}
                      className="ghost-btn flex items-center gap-2 w-full px-4 py-2 text-xs hover:bg-muted text-left">
                      <IconUsers size={12} /> Demote to Member
                    </button>
                  )}
                  <div className="border-t border-border my-1" />
                  <button onClick={() => handleRemove(m.user_id)}
                    className="ghost-btn flex items-center gap-2 w-full px-4 py-2 text-xs hover:bg-muted text-left text-destructive">
                    <IconUserMinus size={12} /> Remove
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );

  return (
    <div className={`flex flex-col h-full bg-background ${isMobile ? '' : 'border-l border-border'}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <span className="font-semibold text-sm">Channel Info</span>
        {isMobile && onClose && (
          <button onClick={onClose} className="ghost-btn text-muted-foreground hover:text-foreground">
            <IconX size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-start gap-3 mb-3">
            <ChannelAvatar channel={channel} size={52} />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm leading-tight">{channel.name}</p>
              <p className="text-xs text-muted-foreground">@{channel.handle}</p>
              <div className="flex items-center gap-1 mt-1">
                {channel.is_public ? <IconGlobe size={11} className="text-muted-foreground" /> : <IconLock size={11} className="text-muted-foreground" />}
                <span className="text-[11px] text-muted-foreground">{channel.is_public ? 'Public' : 'Private'}</span>
              </div>
            </div>
          </div>
          {channel.description && (
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">{channel.description}</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-muted rounded-xl px-3 py-2 text-center">
              <p className="font-bold text-sm">{formatCount(channel.subscribers_count)}</p>
              <p className="text-[10px] text-muted-foreground">Subscribers</p>
            </div>
            <div className="bg-muted rounded-xl px-3 py-2 text-center">
              <p className="font-bold text-sm">{posts.length}</p>
              <p className="text-[10px] text-muted-foreground">Posts</p>
            </div>
          </div>
        </div>

        {admins.length > 0 && (
          <div className="px-4 py-3 border-b border-border">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Admins · {admins.length}
            </p>
            <div className="space-y-2">
              {admins.map(m => <MemberRow key={m.id} m={m} />)}
            </div>
          </div>
        )}

        <div className="px-4 py-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Members · {formatCount(channel.subscribers_count)}
          </p>
          {regularMembers.length === 0 ? (
            <p className="text-xs text-muted-foreground">No members yet</p>
          ) : (
            <div className="space-y-2">
              {regularMembers.slice(0, 20).map(m => <MemberRow key={m.id} m={m} />)}
              {channel.subscribers_count > 20 && (
                <p className="text-[11px] text-muted-foreground pt-1">
                  +{formatCount(channel.subscribers_count - 20)} more
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Scheduled Posts Panel ──────────────────────────────────────────────────────
function ScheduledPostsPanel({ channel, onClose }: { channel: Channel; onClose: () => void }) {
  const { fetchScheduledPosts, publishScheduledPost, deletePost } = useChannelStore();
  const [posts, setPosts] = useState<ChannelPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchScheduledPosts(channel.id).then(data => { setPosts(data); setLoading(false); });
  }, [channel.id]);

  const handlePublish = async (postId: string) => {
    await publishScheduledPost(postId);
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  const handleDelete = async (postId: string) => {
    await deletePost(postId);
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div className="relative w-full max-w-md bg-background rounded-2xl overflow-hidden shadow-2xl max-h-[80vh] flex flex-col"
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <h2 className="font-bold text-base flex items-center gap-2"><IconClock size={16} /> Scheduled Posts</h2>
          <button onClick={onClose} className="ghost-btn text-muted-foreground hover:text-foreground"><IconX size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <motion.div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-foreground rounded-full" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} />
            </div>
          ) : posts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No scheduled posts</p>
          ) : (
            posts.map(post => (
              <div key={post.id} className="p-3 bg-muted rounded-xl">
                <p className="text-sm mb-2 line-clamp-3">{post.content || '📎 Media post'}</p>
                <p className="text-[10px] text-muted-foreground mb-2">
                  Scheduled for {post.scheduled_for ? new Date(post.scheduled_for).toLocaleString() : 'unknown'}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => handlePublish(post.id)}
                    className="px-3 py-1 text-xs font-medium rounded-full bg-foreground text-background">
                    Publish Now
                  </button>
                  <button onClick={() => handleDelete(post.id)}
                    className="px-3 py-1 text-xs font-medium rounded-full bg-muted-foreground/10 text-destructive">
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ChannelDetailPage() {
  const { handle } = useParams<{ handle: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { subscribe, unsubscribe, deleteChannel, deletePost, pinPost, editPost, reactToPost, removeReaction, muteChannel, unmuteChannel, subscribeChannelDetail, unsubscribeChannelDetail, fetchScheduledPosts, publishScheduledPost } = useChannelStore();

  const [channel, setChannel] = useState<Channel | null>(null);
  const [posts, setPosts] = useState<(ChannelPost & { posted_as?: 'channel' | 'user' })[]>([]);
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [subLoading, setSubLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showEditChannel, setShowEditChannel] = useState(false);
  const [showInviteLinks, setShowInviteLinks] = useState(false);
  const [showScheduled, setShowScheduled] = useState(false);
  const feedEndRef = useRef<HTMLDivElement>(null);

  const canAdmin = channel?.member_role === 'owner' || channel?.member_role === 'admin';

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    feedEndRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => { if (handle) loadChannel(); }, [handle, user?.id]);

  // Auto-publish due scheduled posts
  useEffect(() => {
    if (!channel?.id || !canAdmin) return;
    fetchScheduledPosts(channel.id).then(scheduled => {
      const now = new Date();
      scheduled.forEach(p => {
        if (p.scheduled_for && new Date(p.scheduled_for) <= now) {
          publishScheduledPost(p.id);
        }
      });
    });
  }, [channel?.id, canAdmin]);

  // Wire real-time once channel is loaded
  useEffect(() => {
    if (!channel?.id) return;
    subscribeChannelDetail(
      channel.id,
      user?.id,
      (newPost) => {
        setPosts(ps => ps.some(p => p.id === newPost.id) ? ps : [...ps, newPost as any]);
        setTimeout(() => feedEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      },
      (postId) => setPosts(ps => ps.filter(p => p.id !== postId)),
      (updated) => setPosts(ps => ps.map(p => p.id === updated.id ? { ...p, ...updated } : p)),
      async (postId) => {
        const { data } = await supabase
          .from('channel_post_reactions')
          .select('emoji')
          .eq('post_id', postId);
        const countMap = new Map<string, number>();
        (data ?? []).forEach((r: any) => countMap.set(r.emoji, (countMap.get(r.emoji) ?? 0) + 1));
        const reactions = Array.from(countMap.entries()).map(([emoji, count]) => ({ emoji, count }));
        let myReaction: string | null = null;
        if (user?.id) {
          const { data: mine } = await supabase
            .from('channel_post_reactions')
            .select('emoji')
            .match({ post_id: postId, user_id: user.id })
            .maybeSingle();
          myReaction = mine?.emoji ?? null;
        }
        setPosts(ps => ps.map(p => p.id === postId ? { ...p, reactions, my_reaction: myReaction } : p));
      },
      async () => {
        const { data: mems } = await supabase
          .from('channel_members')
          .select('*, user:profiles!channel_members_user_id_fkey(id,username,display_name,avatar_url,is_verified,is_owner)')
          .eq('channel_id', channel.id)
          .order('role')
          .limit(50);
        setMembers((mems ?? []) as ChannelMember[]);
        const { data: ch } = await supabase.from('channels').select('subscribers_count').eq('id', channel.id).single();
        if (ch) setChannel(c => c ? { ...c, subscribers_count: ch.subscribers_count } : c);
      }
    );
    return () => unsubscribeChannelDetail();
  }, [channel?.id]);

  // Scroll to bottom when posts first load + handle hash scroll
  useEffect(() => {
    if (posts.length > 0 && !loading) {
      const hash = window.location.hash;
      if (hash?.startsWith('#post-')) {
        const el = document.getElementById(hash.slice(1));
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
          el.classList.add('bg-foreground/5');
          setTimeout(() => el.classList.remove('bg-foreground/5'), 2000);
          return;
        }
      }
      scrollToBottom('auto');
    }
  }, [loading]);

  async function loadChannel() {
    setLoading(true);
    const { data: ch } = await supabase
      .from('channels')
      .select('*, owner:profiles!channels_owner_id_fkey(id,username,display_name,avatar_url,is_verified,is_owner)')
      .eq('handle', handle!).single();
    if (!ch) { setLoading(false); return; }

    let enriched: Channel = ch as Channel;
    if (user?.id) {
      const { data: m } = await supabase.from('channel_members').select('role').match({ channel_id: ch.id, user_id: user.id }).single();
      const { data: mute } = await supabase.from('channel_mutes').select('id').match({ channel_id: ch.id, user_id: user.id }).maybeSingle();
      enriched = { ...ch, is_subscribed: !!m, member_role: m?.role ?? null, is_muted: !!mute } as Channel;
    }
    setChannel(enriched);

    // Posts
    const { fetchPosts } = useChannelStore.getState();
    const rawPosts = await fetchPosts(ch.id);
    let myReactions = new Map<string, string>();
    if (user?.id && rawPosts.length > 0) {
      const { data: rxns } = await supabase.from('channel_post_reactions').select('post_id,emoji').eq('user_id', user.id).in('post_id', rawPosts.map(p => p.id));
      myReactions = new Map((rxns ?? []).map((r: any) => [r.post_id, r.emoji]));
    }
    const countMap = new Map<string, Map<string, number>>();
    if (rawPosts.length > 0) {
      const { data: rxnCounts } = await supabase.from('channel_post_reactions').select('post_id,emoji').in('post_id', rawPosts.map(p => p.id));
      (rxnCounts ?? []).forEach((r: any) => {
        if (!countMap.has(r.post_id)) countMap.set(r.post_id, new Map());
        const m = countMap.get(r.post_id)!;
        m.set(r.emoji, (m.get(r.emoji) ?? 0) + 1);
      });
    }
    setPosts(rawPosts.map(p => ({
      ...p,
      posted_as: (p as any).posted_as ?? 'channel',
      my_reaction: myReactions.get(p.id) ?? null,
      reactions: Array.from(countMap.get(p.id)?.entries() ?? []).map(([emoji, count]) => ({ emoji, count })),
    })));

    // Members
    const { data: mems } = await supabase
      .from('channel_members')
      .select('*, user:profiles!channel_members_user_id_fkey(id,username,display_name,avatar_url,is_verified,is_owner)')
      .eq('channel_id', ch.id)
      .order('role')
      .limit(50);
    setMembers((mems ?? []) as ChannelMember[]);
    setLoading(false);
  }

  const handleSubscribe = async () => {
    if (!user?.id || !channel) return;
    setSubLoading(true);
    if (channel.is_subscribed) {
      await unsubscribe(channel.id, user.id);
      setChannel(c => c ? { ...c, is_subscribed: false, member_role: null, subscribers_count: Math.max(0, c.subscribers_count - 1) } : c);
      setMembers(m => m.filter(x => x.user_id !== user.id));
    } else {
      await subscribe(channel.id, user.id);
      setChannel(c => c ? { ...c, is_subscribed: true, member_role: 'member', subscribers_count: c.subscribers_count + 1 } : c);
    }
    setSubLoading(false);
  };

  const handleDeleteChannel = async () => {
    if (!channel || !confirm('Delete this channel permanently?')) return;
    await deleteChannel(channel.id);
    navigate('/channels');
  };

  const handleDeletePost = async (postId: string) => {
    await deletePost(postId);
    setPosts(p => p.filter(x => x.id !== postId));
  };

  const handlePinPost = async (postId: string, pinned: boolean) => {
    await pinPost(postId, pinned);
    setPosts(p => p.map(x => x.id === postId ? { ...x, is_pinned: pinned } : x));
  };

  const handleEditPost = async (postId: string, content: string) => {
    await editPost(postId, content);
    setPosts(p => p.map(x => x.id === postId ? { ...x, content, edited_at: new Date().toISOString() } : x));
  };

  const handleSharePost = (postId: string) => {
    const url = `${window.location.origin}/channels/${handle}#post-${postId}`;
    navigator.clipboard.writeText(url);
    useToastStore.getState().addToast('Link copied to clipboard', 'success');
  };

  const handleReact = async (postId: string, emoji: string) => {
    if (!user?.id) return;
    await reactToPost(postId, user.id, emoji);
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const old = p.my_reaction;
      let reactions = [...(p.reactions ?? [])];
      if (old) reactions = reactions.map(r => r.emoji === old ? { ...r, count: Math.max(0, r.count - 1) } : r).filter(r => r.count > 0);
      const exists = reactions.find(r => r.emoji === emoji);
      if (exists) reactions = reactions.map(r => r.emoji === emoji ? { ...r, count: r.count + 1 } : r);
      else reactions = [...reactions, { emoji, count: 1 }];
      return { ...p, my_reaction: emoji, reactions };
    }));
  };

  const handleRemoveReaction = async (postId: string, emoji: string) => {
    if (!user?.id) return;
    await removeReaction(postId, user.id, emoji);
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      return { ...p, my_reaction: null, reactions: (p.reactions ?? []).map(r => r.emoji === emoji ? { ...r, count: Math.max(0, r.count - 1) } : r).filter(r => r.count > 0) };
    }));
  };

  const handleMuteToggle = async () => {
    if (!user?.id || !channel) return;
    if (channel.is_muted) {
      await unmuteChannel(channel.id, user.id);
      setChannel(c => c ? { ...c, is_muted: false } : c);
    } else {
      await muteChannel(channel.id, user.id);
      setChannel(c => c ? { ...c, is_muted: true } : c);
    }
  };

  const handleCommentCountChange = (postId: string, count: number) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: count } : p));
  };

  if (loading) return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button onClick={() => navigate('/channels')} className="ghost-btn text-muted-foreground md:hidden"><IconArrowLeft size={20} /></button>
        <div className="flex items-center gap-2 flex-1 animate-pulse"><div className="w-9 h-9 rounded-full bg-muted" /><div className="h-4 w-32 bg-muted rounded" /></div>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <motion.div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-foreground rounded-full" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} />
      </div>
    </div>
  );

  if (!channel) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
      <IconMegaphone size={40} className="text-muted-foreground/30" />
      <p className="font-semibold">Channel not found</p>
      <button onClick={() => navigate('/channels')} className="text-sm text-muted-foreground hover:underline">← Back</button>
    </div>
  );

  const pinnedPost = posts.find(p => p.is_pinned);

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* ── Main column ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-xl border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2 px-3 py-2.5">
            <button onClick={() => navigate('/channels')} className="ghost-btn text-muted-foreground hover:text-foreground flex-shrink-0 md:hidden">
              <IconArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <ChannelAvatar channel={channel} size={36} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm truncate">{channel.name}</span>
                  {!channel.is_public && <IconLock size={10} className="text-muted-foreground" />}
                </div>
                <p className="text-[11px] text-muted-foreground">{formatCount(channel.subscribers_count)} subscribers</p>
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Mute toggle */}
              {user && channel.is_subscribed && (
                <button onClick={handleMuteToggle}
                  className="ghost-btn p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                  style={{ background: 'none', border: 'none', boxShadow: 'none', backdropFilter: 'none' }}
                  title={channel.is_muted ? 'Unmute' : 'Mute'}>
                  {channel.is_muted ? <IconBellOff size={16} /> : <IconBell size={16} />}
                </button>
              )}

              {/* Invite link - for owner/admin of any channel */}
              {canAdmin && (
                <button onClick={() => setShowInviteLinks(true)}
                  className="ghost-btn p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                  style={{ background: 'none', border: 'none', boxShadow: 'none', backdropFilter: 'none' }}
                  title="Invite Links">
                  <IconLink size={16} />
                </button>
              )}

              {/* Scheduled posts */}
              {canAdmin && (
                <button onClick={() => setShowScheduled(true)}
                  className="ghost-btn p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                  style={{ background: 'none', border: 'none', boxShadow: 'none', backdropFilter: 'none' }}
                  title="Scheduled Posts">
                  <IconClock size={16} />
                </button>
              )}

              {/* Edit channel settings */}
              {canAdmin && (
                <button onClick={() => setShowEditChannel(true)}
                  className="ghost-btn p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                  style={{ background: 'none', border: 'none', boxShadow: 'none', backdropFilter: 'none' }}
                  title="Settings">
                  <IconSettings size={16} />
                </button>
              )}

              {user && channel.member_role !== 'owner' && (
                <motion.button whileTap={{ scale: 0.93 }} onClick={handleSubscribe} disabled={subLoading}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${channel.is_subscribed ? 'bg-muted text-muted-foreground' : 'bg-foreground text-background'}`}>
                  {subLoading ? '…' : channel.is_subscribed ? 'Joined' : 'Join'}
                </motion.button>
              )}
              <button onClick={() => setShowSidebar(true)} className="ghost-btn flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors xl:hidden"
                style={{ background: 'none', border: 'none', boxShadow: 'none', backdropFilter: 'none', padding: '6px' }}>
                <IconUsers size={18} />
              </button>
              {channel.member_role === 'owner' && (
                <button onClick={handleDeleteChannel} className="ghost-btn text-destructive/70 hover:text-destructive p-1"
                  style={{ background: 'none', border: 'none', boxShadow: 'none', backdropFilter: 'none' }}>
                  <IconTrash size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Pinned post banner */}
          {pinnedPost && (
            <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-t border-border text-xs">
              <IconPin size={12} className="text-muted-foreground flex-shrink-0" />
              <p className="text-muted-foreground truncate flex-1">
                <span className="font-medium text-foreground">Pinned: </span>
                {pinnedPost.content ?? (pinnedPost.media_urls.length > 0 ? '📎 Media' : '')}
              </p>
            </div>
          )}
        </div>

        {/* Posts feed */}
        <div className="flex-1 overflow-y-auto">
          {posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <IconMegaphone size={36} className="text-muted-foreground/30 mb-3" />
              <p className="font-semibold text-sm">No posts yet</p>
              {canAdmin && <p className="text-xs text-muted-foreground mt-1">Post something to get started</p>}
            </div>
          ) : (
            <div className="py-2">
              <AnimatePresence initial={false}>
                {posts.map(post => (
                  <ChannelPostCard
                    key={post.id}
                    post={post}
                    channel={channel}
                    canAdmin={canAdmin}
                    currentUserId={user?.id}
                    onDelete={handleDeletePost}
                    onPin={handlePinPost}
                    onReact={handleReact}
                    onRemoveReaction={handleRemoveReaction}
                    onEdit={handleEditPost}
                    onShare={handleSharePost}
                    onCommentCountChange={handleCommentCountChange}
                  />
                ))}
              </AnimatePresence>
              <div ref={feedEndRef} />
            </div>
          )}
        </div>

        {/* Composer */}
        {canAdmin && user && (
          <PostComposer
            channel={channel}
            user={user as any}
            onPosted={post => {
              setPosts(prev => [...prev, post as any]);
              setTimeout(() => scrollToBottom('smooth'), 50);
            }}
          />
        )}
      </div>

      {/* ── Desktop right sidebar ── */}
      <div className="hidden xl:flex xl:w-72 flex-shrink-0 flex-col overflow-hidden">
        <ChannelSidebar channel={channel} members={members} posts={posts} onMemberAction={loadChannel} />
      </div>

      {/* ── Mobile sidebar drawer ── */}
      <AnimatePresence>
        {showSidebar && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm xl:hidden"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowSidebar(false)}
            />
            <motion.div
              className="fixed right-0 top-0 bottom-0 z-50 w-80 max-w-[85vw] xl:hidden overflow-hidden"
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              <ChannelSidebar channel={channel} members={members} posts={posts} isMobile onClose={() => setShowSidebar(false)} onMemberAction={loadChannel} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {showEditChannel && (
          <EditChannelModal
            channel={channel}
            onClose={() => setShowEditChannel(false)}
            onUpdated={(updated) => setChannel(c => c ? { ...c, ...updated } : c)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showInviteLinks && (
          <InviteLinkModal channel={channel} onClose={() => setShowInviteLinks(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showScheduled && (
          <ScheduledPostsPanel channel={channel} onClose={() => setShowScheduled(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
