import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '~/stores/auth-store';
import { useChannelStore } from '~/stores/channel-store';
import { supabase } from '~/lib/supabase';
import { parseMediaType } from '~/components/media-editor';
import {
  IconArrowLeft, IconUsers, IconLock, IconGlobe, IconMoreHorizontal,
  IconTrash, IconPin, IconPlus, IconX, IconSend, IconImage, IconCheck,
  IconMegaphone,
} from '~/components/icons';
import { UserAvatar } from '~/components/user-avatar';
import { VerifiedBadge, OwnerBadge } from '~/components/badges';
import type { Channel, ChannelPost } from '~/types';

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
  return new Date(d).toLocaleDateString();
}

function ChannelAvatar({ channel, size = 48 }: { channel: Channel; size?: number }) {
  if (channel.avatar_url) {
    return <img src={channel.avatar_url} alt={channel.name} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500', 'bg-indigo-500'];
  const color = colors[channel.name.charCodeAt(0) % colors.length];
  return (
    <div className={`${color} rounded-full flex items-center justify-center text-white font-bold`} style={{ width: size, height: size, fontSize: size * 0.35 }}>
      {channel.name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function ReactionBar({ post, userId, onReact, onRemove }: {
  post: ChannelPost;
  userId?: string;
  onReact: (emoji: string) => void;
  onRemove: (emoji: string) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);

  const handleEmoji = (emoji: string) => {
    if (post.my_reaction === emoji) onRemove(emoji);
    else onReact(emoji);
    setShowPicker(false);
  };

  const grouped = post.reactions ?? [];

  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-2">
      {grouped.map(({ emoji, count }) => (
        <motion.button
          key={emoji}
          whileTap={{ scale: 0.88 }}
          onClick={() => handleEmoji(emoji)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-colors ${
            post.my_reaction === emoji
              ? 'bg-foreground text-background'
              : 'bg-muted hover:bg-muted/80 text-foreground'
          }`}
        >
          <span>{emoji}</span>
          {count > 0 && <span className="font-medium">{count}</span>}
        </motion.button>
      ))}
      <div className="relative">
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={() => setShowPicker(!showPicker)}
          className="ghost-btn flex items-center justify-center w-7 h-7 rounded-full bg-muted hover:bg-muted/80 text-xs text-muted-foreground transition-colors"
        >
          😊
        </motion.button>
        <AnimatePresence>
          {showPicker && (
            <>
              <div className="fixed inset-0 z-[9]" onClick={() => setShowPicker(false)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 4 }}
                className="absolute bottom-9 left-0 z-10 flex gap-1 bg-background border border-border rounded-2xl p-2 shadow-xl"
              >
                {QUICK_REACTIONS.map(e => (
                  <button key={e} onClick={() => handleEmoji(e)} className="ghost-btn w-8 h-8 flex items-center justify-center text-lg hover:scale-110 transition-transform rounded-full hover:bg-muted">
                    {e}
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ChannelPostCard({ post, canAdmin, onDelete, onPin, onReact, onRemoveReaction, userId }: {
  post: ChannelPost;
  canAdmin: boolean;
  onDelete: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onReact: (postId: string, emoji: string) => void;
  onRemoveReaction: (postId: string, emoji: string) => void;
  userId?: string;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [activeMedia, setActiveMedia] = useState(0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`px-4 py-4 ${post.is_pinned ? 'bg-muted/30 border-l-2 border-foreground/20' : ''}`}
    >
      {post.is_pinned && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-2">
          <IconPin size={10} />
          <span>Pinned</span>
        </div>
      )}

      {/* Media */}
      {post.media_urls.length > 0 && (() => {
        const raw = post.media_types[activeMedia] ?? 'image';
        const { isVideo, filter, zoom } = parseMediaType(raw);
        const style: React.CSSProperties = {
          filter: filter !== 'none' ? filter : undefined,
          transform: zoom !== 1 ? `scale(${zoom})` : undefined,
        };
        return (
          <div className="relative rounded-2xl overflow-hidden mb-3 bg-muted">
            {isVideo ? (
              <video src={post.media_urls[activeMedia]} controls className="w-full max-h-[480px] object-contain" preload="metadata" style={style} />
            ) : (
              <img src={post.media_urls[activeMedia]} alt="" className="w-full max-h-[480px] object-contain" loading="lazy" style={style} />
            )}
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

      {/* Content */}
      {post.content && <p className="text-sm leading-relaxed mb-2 whitespace-pre-wrap">{post.content}</p>}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <ReactionBar
          post={post}
          userId={userId}
          onReact={e => onReact(post.id, e)}
          onRemove={e => onRemoveReaction(post.id, e)}
        />
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[11px] text-muted-foreground">{timeAgo(post.created_at)}</span>
          {canAdmin && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="ghost-btn text-muted-foreground hover:text-foreground transition-colors"
              >
                <IconMoreHorizontal size={15} />
              </button>
              <AnimatePresence>
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-[9]" onClick={() => setShowMenu(false)} />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.92, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.92 }}
                      className="absolute right-0 bottom-7 w-40 bg-background border border-border rounded-xl z-10 py-1.5 shadow-lg"
                    >
                      <button
                        className="ghost-btn flex items-center gap-2 w-full px-4 py-2 text-xs hover:bg-muted transition-colors text-left"
                        onClick={() => { onPin(post.id, !post.is_pinned); setShowMenu(false); }}
                      >
                        <IconPin size={13} />
                        {post.is_pinned ? 'Unpin' : 'Pin post'}
                      </button>
                      <div className="border-t border-border my-1" />
                      <button
                        className="ghost-btn flex items-center gap-2 w-full px-4 py-2 text-xs hover:bg-muted transition-colors text-left text-destructive"
                        onClick={() => { onDelete(post.id); setShowMenu(false); }}
                      >
                        <IconTrash size={13} />
                        Delete
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function PostComposer({ channelId, userId, onPosted }: { channelId: string; userId: string; onPosted: (p: ChannelPost) => void }) {
  const { createPost } = useChannelStore();
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    setFiles(picked);
    setPreviews(picked.map(f => URL.createObjectURL(f)));
    e.target.value = '';
  };

  const removeFile = (i: number) => {
    setFiles(f => f.filter((_, idx) => idx !== i));
    setPreviews(p => p.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async () => {
    if ((!text.trim() && files.length === 0) || submitting) return;
    setSubmitting(true);
    const post = await createPost(channelId, userId, text, files);
    if (post) {
      onPosted(post);
      setText('');
      setFiles([]);
      setPreviews([]);
    }
    setSubmitting(false);
  };

  return (
    <div className="border-t border-border px-4 py-3">
      {/* Media previews */}
      <AnimatePresence>
        {previews.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex gap-2 mb-3 overflow-x-auto pb-1"
          >
            {previews.map((p, i) => (
              <div key={i} className="relative flex-shrink-0">
                <img src={p} alt="" className="w-16 h-16 object-cover rounded-xl" />
                <button onClick={() => removeFile(i)} className="ghost-btn absolute -top-1.5 -right-1.5 bg-background border border-border rounded-full w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground">
                  <IconX size={10} />
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
          placeholder="Write a post…"
          rows={2}
          className="flex-1 bg-muted rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-foreground/20 max-h-32 overflow-y-auto"
          style={{ scrollbarWidth: 'none' }}
        />
        <div className="flex flex-col gap-1.5">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => fileRef.current?.click()} className="ghost-btn w-9 h-9 flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <IconImage size={17} />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleSubmit}
            disabled={(!text.trim() && files.length === 0) || submitting}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-foreground text-background disabled:opacity-40 transition-opacity"
          >
            {submitting ? (
              <motion.div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7, ease: 'linear' }} />
            ) : (
              <IconSend size={16} />
            )}
          </motion.button>
        </div>
      </div>
      <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleFiles} />
    </div>
  );
}

export default function ChannelDetailPage() {
  const { handle } = useParams<{ handle: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { subscribe, unsubscribe, deleteChannel, deletePost, pinPost, reactToPost, removeReaction } = useChannelStore();

  const [channel, setChannel] = useState<Channel | null>(null);
  const [posts, setPosts] = useState<ChannelPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [subLoading, setSubLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const canAdmin = channel?.member_role === 'owner' || channel?.member_role === 'admin';

  useEffect(() => {
    if (!handle) return;
    loadChannel();
  }, [handle, user?.id]);

  async function loadChannel() {
    setLoading(true);
    const { data: ch } = await supabase
      .from('channels')
      .select('*, owner:profiles!channels_owner_id_fkey(id,username,display_name,avatar_url,is_verified,is_owner)')
      .eq('handle', handle!)
      .single();

    if (!ch) { setLoading(false); return; }

    let enriched: Channel = ch as Channel;
    if (user?.id) {
      const { data: membership } = await supabase
        .from('channel_members')
        .select('role')
        .match({ channel_id: ch.id, user_id: user.id })
        .single();
      enriched = { ...ch, is_subscribed: !!membership, member_role: membership?.role ?? null } as Channel;
    }
    setChannel(enriched);

    // Fetch posts with reactions
    const { fetchPosts } = useChannelStore.getState();
    const rawPosts = await fetchPosts(ch.id);

    // Get my reactions
    let myReactions = new Map<string, string>();
    if (user?.id) {
      const { data: rxns } = await supabase
        .from('channel_post_reactions')
        .select('post_id, emoji')
        .eq('user_id', user.id)
        .in('post_id', rawPosts.map(p => p.id));
      myReactions = new Map((rxns ?? []).map((r: any) => [r.post_id, r.emoji]));
    }

    // Get reaction counts
    const { data: rxnCounts } = await supabase
      .from('channel_post_reactions')
      .select('post_id, emoji')
      .in('post_id', rawPosts.map(p => p.id));

    const countMap = new Map<string, Map<string, number>>();
    (rxnCounts ?? []).forEach((r: any) => {
      if (!countMap.has(r.post_id)) countMap.set(r.post_id, new Map());
      const m = countMap.get(r.post_id)!;
      m.set(r.emoji, (m.get(r.emoji) ?? 0) + 1);
    });

    const enrichedPosts = rawPosts.map(p => ({
      ...p,
      my_reaction: myReactions.get(p.id) ?? null,
      reactions: Array.from(countMap.get(p.id)?.entries() ?? []).map(([emoji, count]) => ({ emoji, count })),
    }));

    setPosts(enrichedPosts);
    setLoading(false);
  }

  const handleSubscribe = async () => {
    if (!user?.id || !channel) return;
    setSubLoading(true);
    if (channel.is_subscribed) {
      await unsubscribe(channel.id, user.id);
      setChannel(c => c ? { ...c, is_subscribed: false, member_role: null, subscribers_count: Math.max(0, c.subscribers_count - 1) } : c);
    } else {
      await subscribe(channel.id, user.id);
      setChannel(c => c ? { ...c, is_subscribed: true, member_role: 'member', subscribers_count: c.subscribers_count + 1 } : c);
    }
    setSubLoading(false);
  };

  const handleDeleteChannel = async () => {
    if (!channel) return;
    if (!confirm('Delete this channel permanently?')) return;
    await deleteChannel(channel.id);
    navigate('/channels');
  };

  const handleDeletePost = async (postId: string) => {
    await deletePost(postId);
    setPosts(p => p.filter(x => x.id !== postId));
  };

  const handlePinPost = async (postId: string, pinned: boolean) => {
    await pinPost(postId, pinned);
    setPosts(p => p.map(x => x.id === postId ? { ...x, is_pinned: pinned } : x).sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0)));
  };

  const handleReact = async (postId: string, emoji: string) => {
    if (!user?.id) return;
    await reactToPost(postId, user.id, emoji);
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const oldReaction = p.my_reaction;
      let reactions = [...(p.reactions ?? [])];
      // Remove old
      if (oldReaction) reactions = reactions.map(r => r.emoji === oldReaction ? { ...r, count: Math.max(0, r.count - 1) } : r).filter(r => r.count > 0);
      // Add new
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
      const reactions = (p.reactions ?? []).map(r => r.emoji === emoji ? { ...r, count: Math.max(0, r.count - 1) } : r).filter(r => r.count > 0);
      return { ...p, my_reaction: null, reactions };
    }));
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <button onClick={() => navigate(-1)} className="ghost-btn text-muted-foreground"><IconArrowLeft size={20} /></button>
          <div className="flex items-center gap-2 flex-1 animate-pulse">
            <div className="w-9 h-9 rounded-full bg-muted" />
            <div className="h-4 w-32 bg-muted rounded" />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <motion.div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-foreground rounded-full" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} />
        </div>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
        <IconMegaphone size={40} className="text-muted-foreground/30" />
        <p className="font-semibold">Channel not found</p>
        <button onClick={() => navigate('/channels')} className="text-sm hover:underline text-muted-foreground">← Back to Channels</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-xl border-b border-border">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button onClick={() => navigate('/channels')} className="ghost-btn text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
            <IconArrowLeft size={20} />
          </button>

          <button onClick={() => setShowInfo(!showInfo)} className="ghost-btn flex items-center gap-2.5 flex-1 min-w-0 hover:opacity-80 transition-opacity text-left">
            <ChannelAvatar channel={channel} size={36} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm truncate">{channel.name}</span>
                {!channel.is_public && <IconLock size={10} className="text-muted-foreground flex-shrink-0" />}
              </div>
              <p className="text-xs text-muted-foreground">{formatCount(channel.subscribers_count)} subscribers</p>
            </div>
          </button>

          <div className="flex items-center gap-1 flex-shrink-0">
            {user && channel.member_role !== 'owner' && (
              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={handleSubscribe}
                disabled={subLoading}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  channel.is_subscribed ? 'bg-muted text-muted-foreground' : 'bg-foreground text-background'
                }`}
              >
                {subLoading ? '…' : channel.is_subscribed ? 'Joined' : 'Join'}
              </motion.button>
            )}
            {channel.member_role === 'owner' && (
              <button onClick={handleDeleteChannel} className="ghost-btn text-destructive/70 hover:text-destructive transition-colors p-1">
                <IconTrash size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Channel info panel */}
        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-border"
            >
              <div className="px-4 py-3 space-y-2">
                {channel.description && <p className="text-sm text-muted-foreground">{channel.description}</p>}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><IconUsers size={12} /> {formatCount(channel.subscribers_count)} subscribers</span>
                  <span className="flex items-center gap-1">{channel.is_public ? <IconGlobe size={12} /> : <IconLock size={12} />} {channel.is_public ? 'Public' : 'Private'}</span>
                </div>
                {channel.owner && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-muted-foreground">Owner:</span>
                    <Link to={`/profile/${channel.owner.username}`} className="flex items-center gap-1.5 hover:underline">
                      <UserAvatar user={channel.owner as any} size="xs" />
                      <span className="text-xs font-medium">{channel.owner.display_name}</span>
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Posts feed */}
      <div className="flex-1 overflow-y-auto">
        {posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <IconMegaphone size={36} className="text-muted-foreground/30 mb-3" />
            <p className="font-semibold text-sm">No posts yet</p>
            {canAdmin && <p className="text-xs text-muted-foreground mt-1">Be the first to post in this channel</p>}
          </div>
        ) : (
          <div className="divide-y divide-border">
            <AnimatePresence initial={false}>
              {posts.map(post => (
                <ChannelPostCard
                  key={post.id}
                  post={post}
                  canAdmin={canAdmin}
                  onDelete={handleDeletePost}
                  onPin={handlePinPost}
                  onReact={handleReact}
                  onRemoveReaction={handleRemoveReaction}
                  userId={user?.id}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Composer — only for admins/owners */}
      {canAdmin && user && (
        <PostComposer
          channelId={channel.id}
          userId={user.id}
          onPosted={post => setPosts(prev => [post, ...prev])}
        />
      )}
    </div>
  );
}
