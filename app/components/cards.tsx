import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router';
import { useState, useRef, useCallback } from 'react';
import { IconHeart, IconMessageCircle, IconShare, IconMoreHorizontal, IconTrash, IconEyeOff, IconCopy, IconPlay, IconCheck } from '~/components/icons';
import { heartBeat, fadeInUp, staggerItem, staggerItemVariants } from '~/components/animations';
import { useQuestionStore } from '~/stores/question-store';
import { usePostStore } from '~/stores/post-store';
import { useFollowStore } from '~/stores/follow-store';
import { useAuthStore } from '~/stores/auth-store';
import { useToastStore } from '~/stores/toast-store';
import { useIsViewMode, LoginPromptModal } from '~/components/view-mode';
import { UserAvatar, AnonAvatar } from '~/components/user-avatar';
import { VerifiedBadge, OwnerBadge } from '~/components/badges';
import { parseMediaType } from '~/components/media-editor';
import { CommentsModal } from '~/components/comments-modal';
import { ShareModal } from '~/components/share-modal';
import type { Answer, Question, User, Post } from '~/types';

/** Hook that returns a gated action — shows login prompt if in view mode, otherwise runs the action */
function useGatedAction() {
  const isViewMode = useIsViewMode();
  const [showPrompt, setShowPrompt] = useState(false);

  const gate = useCallback(<T extends (...args: any[]) => any>(action: T) => {
    if (isViewMode) {
      return ((..._args: any[]) => setShowPrompt(true)) as unknown as T;
    }
    return action;
  }, [isViewMode]);

  const promptEl = showPrompt ? <LoginPromptModal onClose={() => setShowPrompt(false)} /> : null;

  return { gate, promptEl, isViewMode };
}

function CopyLinkButton({ url, onDone }: { url: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    useToastStore.getState().addToast('Link copied to clipboard', 'success');
    setTimeout(() => {
      setCopied(false);
      onDone();
    }, 1000);
  };

  return (
    <button
      className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-muted text-left"
      onClick={handleCopy}
    >
      {copied ? <IconCheck size={14} className="text-green-500" /> : <IconCopy size={14} />}
      {copied ? 'Copied!' : 'Copy link'}
    </button>
  );
}

export function AnswerCard({ answer }: { answer: Answer }) {
  const { user } = useAuthStore();
  const { toggleLike, deleteAnswer } = useQuestionStore();
  const { gate, promptEl } = useGatedAction();
  const [liked, setLiked] = useState(answer.is_liked);
  const [likesCount, setLikesCount] = useState(answer.likes_count);
  const [showMenu, setShowMenu] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleLike = gate(async () => {
    if (!user?.id) return;
    setLiked(!liked);
    setLikesCount(liked ? likesCount - 1 : likesCount + 1);
    await toggleLike(answer.id, user.id);
  });

  const handleDelete = async () => {
    setDeleting(true);
    setShowMenu(false);
    await deleteAnswer(answer.id);
  };

  const handleHide = () => {
    setShowMenu(false);
    setHidden(true);
  };

  const answerUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/profile/${answer.user?.username}`;

  const handleShare = gate(async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${answer.user?.display_name}'s answer on Exotic`,
          url: answerUrl,
        });
      } else {
        navigator.clipboard.writeText(answerUrl);
        useToastStore.getState().addToast('Link copied to clipboard', 'success');
      }
    } catch {}
  });

  const isOwner = user?.id === answer.user_id;

  if (hidden || deleting) return null;

  return (
    <>
    {promptEl}
    <motion.article
      className="p-4 sm:p-6"
      variants={staggerItemVariants}
    >
      {/* Question */}
      {answer.question && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1">
            {answer.question.is_anonymous ? (
              <AnonAvatar size="xs" />
            ) : answer.question.sender ? (
              <Link to={`/profile/${answer.question.sender.username}`} className="flex items-center gap-2">
                <UserAvatar user={answer.question.sender} size="xs" />
                <span className="text-xs font-medium">{answer.question.sender.display_name}</span>
              </Link>
            ) : null}
            {answer.question.is_anonymous && (
              <span className="text-xs text-muted-foreground">Anonymous</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{answer.question.content}</p>
        </div>
      )}

      {/* Answer */}
      <div className="mb-3">
        {answer.user && (
          <Link to={`/profile/${answer.user.username}`} className="flex items-center gap-2 mb-2">
            <UserAvatar user={answer.user} size="sm" />
            <div>
              <span className="text-sm font-semibold">{answer.user.display_name}</span>
              {answer.user.is_owner && <OwnerBadge />}
              {answer.user.is_verified && <VerifiedBadge />}
              <span className="text-xs text-muted-foreground ml-2">@{answer.user.username}</span>
            </div>
          </Link>
        )}
        <p className="text-sm leading-relaxed">{answer.content}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 text-muted-foreground">
        <motion.button
          className="flex items-center gap-1.5 text-xs hover:text-foreground transition-colors"
          onClick={handleLike}
          whileTap={{ scale: 0.9 }}
        >
          <motion.div animate={liked ? heartBeat : {}}>
            <IconHeart size={16} filled={liked} className={liked ? 'text-red-500' : ''} />
          </motion.div>
          <span>{likesCount > 0 ? likesCount : ''}</span>
        </motion.button>

        <button className="flex items-center gap-1.5 text-xs hover:text-foreground transition-colors">
          <IconMessageCircle size={16} />
          <span>{answer.comments_count > 0 ? answer.comments_count : ''}</span>
        </button>

        <button
          className="flex items-center gap-1.5 text-xs hover:text-foreground transition-colors"
          onClick={handleShare}
        >
          <IconShare size={16} />
        </button>

        <div className="relative ml-auto">
          <button
            className="p-1 hover:text-foreground transition-colors"
            onClick={() => setShowMenu(!showMenu)}
          >
            <IconMoreHorizontal size={16} />
          </button>
          <AnimatePresence>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-5" onClick={() => setShowMenu(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute right-0 top-8 w-40 bg-background shadow-lg rounded-lg z-10 py-1 overflow-hidden border border-muted"
                >
                  <CopyLinkButton url={answerUrl} onDone={() => setShowMenu(false)} />
                  <button
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-muted text-left"
                    onClick={handleHide}
                  >
                    <IconEyeOff size={14} />
                    Hide
                  </button>
                  {isOwner && (
                    <button
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-muted text-left text-destructive"
                      onClick={handleDelete}
                    >
                      <IconTrash size={14} />
                      Delete
                    </button>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.article>
    </>
  );
}

export function QuestionCard({ question, onAnswer, onDelete }: { question: Question; onAnswer?: (id: string) => void; onDelete?: (id: string) => void }) {
  return (
    <motion.article
      className="p-4 sm:p-6"
      variants={staggerItemVariants}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {question.is_anonymous ? (
            <>
              <AnonAvatar size="sm" />
              <span className="text-sm font-medium text-muted-foreground">Anonymous</span>
            </>
          ) : question.sender ? (
            <Link to={`/profile/${question.sender.username}`} className="flex items-center gap-2">
              <UserAvatar user={question.sender} size="sm" />
              <span className="text-sm font-semibold">{question.sender.display_name}</span>
            </Link>
          ) : null}
        </div>
        <span className="text-xs text-muted-foreground">{new Date(question.created_at).toLocaleDateString()}</span>
      </div>

      <p className="text-sm leading-relaxed mb-4">{question.content}</p>

      <div className="flex items-center gap-2">
        {onAnswer && !question.is_answered && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            className="px-5 py-2.5 text-sm font-medium rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity"
            onClick={() => onAnswer(question.id)}
          >
            Answer
          </motion.button>
        )}
        {onDelete && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            className="px-5 py-2.5 text-sm font-medium rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => onDelete(question.id)}
          >
            Delete
          </motion.button>
        )}
        {question.is_answered && (
          <span className="text-xs text-muted-foreground italic">Answered</span>
        )}
      </div>
    </motion.article>
  );
}

export function UserCard({ user, onFollow }: { user: User; onFollow?: (id: string) => void }) {
  const { user: authUser } = useAuthStore();
  const { isFollowing: checkIsFollowing, isRequested: checkIsRequested, toggleFollow } = useFollowStore();
  const { gate, promptEl } = useGatedAction();
  const isFollowing = checkIsFollowing(user.id);
  const isRequested = checkIsRequested(user.id);
  const isSelf = authUser?.id === user.id;

  const handleFollow = gate(async () => {
    if (!authUser) return;
    await toggleFollow(user.id, authUser.id, user.is_private);
    onFollow?.(user.id);
  });

  return (
    <>
    {promptEl}
    <motion.div
      className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
      variants={staggerItemVariants}
    >
      <Link to={`/profile/${user.username}`} className="flex-shrink-0">
        <UserAvatar user={user} size="md" />
      </Link>
      <Link to={`/profile/${user.username}`} className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate flex items-center gap-1 flex-wrap">
          {user.display_name}
          {user.is_owner && <OwnerBadge />}
          {user.is_verified && <VerifiedBadge />}
        </p>
        <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
        {user.bio && <p className="text-xs text-muted-foreground mt-0.5 truncate">{user.bio}</p>}
      </Link>
      {!isSelf && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          className={`px-5 py-2 text-sm font-medium rounded-full transition-colors ${
            isFollowing || isRequested
              ? 'bg-muted text-muted-foreground hover:text-foreground'
              : 'bg-foreground text-background hover:opacity-90'
          }`}
          onClick={handleFollow}
        >
          {isFollowing ? 'Following' : isRequested ? 'Requested' : 'Follow'}
        </motion.button>
      )}
    </motion.div>
    </>
  );
}

export function PostCard({ post }: { post: Post }) {
  const { user } = useAuthStore();
  const { toggleLike, deletePost } = usePostStore();
  const { gate, promptEl } = useGatedAction();
  const [liked, setLiked] = useState(post.is_liked);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [commentsCount, setCommentsCount] = useState(post.comments_count);
  const [showMenu, setShowMenu] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [activeMedia, setActiveMedia] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copyDone, setCopyDone] = useState(false);
  const [doubleTapHeart, setDoubleTapHeart] = useState(false);
  const lastTapRef = useRef<number>(0);

  const handleLike = gate(async () => {
    if (!user?.id) return;
    setLiked(!liked);
    setLikesCount(liked ? likesCount - 1 : likesCount + 1);
    await toggleLike(post.id, user.id);
  });

  const handleDoubleTap = gate(async () => {
    if (!user?.id) return;
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (!liked) {
        setLiked(true);
        setLikesCount(c => c + 1);
        await toggleLike(post.id, user.id);
      }
      setDoubleTapHeart(true);
      setTimeout(() => setDoubleTapHeart(false), 900);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  });

  const handleDelete = async () => {
    setDeleting(true);
    setShowMenu(false);
    await deletePost(post.id);
  };

  const handleHide = () => {
    setShowMenu(false);
    setHidden(true);
  };

  const postUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/posts/${post.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(postUrl).catch(() => {
      const el = document.createElement('input');
      el.value = postUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    });
    useToastStore.getState().addToast('Link copied to clipboard', 'success');
    setCopyDone(true);
    setTimeout(() => { setCopyDone(false); setShowMenu(false); }, 1200);
  };

  const isOwner = user?.id === post.user_id;

  function formatTimeAgo(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = now - then;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return new Date(dateStr).toLocaleDateString();
  }

  if (hidden || deleting) return null;

  return (
    <>
      {promptEl}
      <CommentsModal
        open={showComments}
        onClose={() => setShowComments(false)}
        postId={post.id}
        onCommentCountChange={setCommentsCount}
      />
      <ShareModal
        open={showShare}
        onClose={() => setShowShare(false)}
        url={postUrl}
        text={`Check out ${post.user?.display_name ?? 'this'}'s post on Exotic!`}
      />

      <motion.article className="p-4 sm:p-5" variants={staggerItemVariants}>
        {/* User header */}
        {post.user && (
          <div className="flex items-center justify-between mb-3">
            <Link to={`/profile/${post.user.username}`} className="flex items-center gap-2">
              <UserAvatar user={post.user} size="sm" />
              <div>
                <span className="text-sm font-semibold">{post.user.display_name}</span>
                {post.user.is_owner && <OwnerBadge />}
                {post.user.is_verified && <VerifiedBadge />}
                <span className="text-xs text-muted-foreground ml-2">@{post.user.username}</span>
              </div>
            </Link>
            <span className="text-xs text-muted-foreground">{formatTimeAgo(post.created_at)}</span>
          </div>
        )}

        {/* Media */}
        {post.media_urls.length > 0 && (() => {
          const raw = post.media_types[activeMedia] ?? 'image';
          const { isVideo, filter, zoom } = parseMediaType(raw);
          const mediaStyle: React.CSSProperties = {
            filter: filter !== 'none' ? filter : undefined,
            transform: zoom !== 1 ? `scale(${zoom})` : undefined,
            transition: 'filter 0.2s, transform 0.2s',
          };
          return (
            <div
              className="relative rounded-xl overflow-hidden mb-3 bg-muted"
              onClick={handleDoubleTap}
            >
              {isVideo ? (
                <video
                  src={post.media_urls[activeMedia]}
                  controls
                  className="w-full max-h-[500px] object-contain"
                  preload="metadata"
                  style={mediaStyle}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <img
                  src={post.media_urls[activeMedia]}
                  alt=""
                  className="w-full max-h-[500px] object-contain"
                  loading="lazy"
                  style={mediaStyle}
                />
              )}
              {post.media_urls.length > 1 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                  {post.media_urls.map((_, i) => (
                    <button
                      key={i}
                      onClick={e => { e.stopPropagation(); setActiveMedia(i); }}
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${i === activeMedia ? 'bg-white' : 'bg-white/50'}`}
                    />
                  ))}
                </div>
              )}

              {/* Double-tap heart burst — inside the image */}
              <AnimatePresence>
                {doubleTapHeart && (
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    initial={{ opacity: 0, scale: 0.3 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.5 }}
                    transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                  >
                    <motion.div
                      animate={{ scale: [1, 1.15, 0.95, 1] }}
                      transition={{ duration: 0.45, ease: 'easeOut' }}
                    >
                      <IconHeart size={96} filled className="text-red-500 drop-shadow-[0_2px_12px_rgba(239,68,68,0.6)]" />
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })()}

        {/* Caption */}
        {post.caption && <p className="text-sm leading-relaxed mb-3">{post.caption}</p>}

        {/* Actions — icon only, no background ever */}
        <div className="flex items-center gap-5">
          {/* Like */}
          <motion.button
            className="ghost-btn flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors p-0"
            onClick={handleLike}
            whileTap={{ scale: 0.88 }}
            style={{ background: 'none', border: 'none', boxShadow: 'none', backdropFilter: 'none' }}
          >
            <motion.div animate={liked ? heartBeat : {}}>
              <IconHeart size={17} filled={liked} className={liked ? 'text-red-500' : ''} />
            </motion.div>
            {likesCount > 0 && <span>{likesCount}</span>}
          </motion.button>

          {/* Comments */}
          <button
            className="ghost-btn flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors p-0"
            onClick={gate(() => setShowComments(true))}
            style={{ background: 'none', border: 'none', boxShadow: 'none', backdropFilter: 'none' }}
          >
            <IconMessageCircle size={17} />
            {commentsCount > 0 && <span>{commentsCount}</span>}
          </button>

          {/* Share */}
          <button
            className="ghost-btn flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors p-0"
            onClick={gate(() => setShowShare(true))}
            style={{ background: 'none', border: 'none', boxShadow: 'none', backdropFilter: 'none' }}
          >
            <IconShare size={17} />
          </button>

          {/* Three-dot menu */}
          <div className="relative ml-auto">
            <button
              className="ghost-btn text-muted-foreground hover:text-foreground transition-colors p-0"
              onClick={() => setShowMenu(!showMenu)}
              style={{ background: 'none', border: 'none', boxShadow: 'none', backdropFilter: 'none' }}
            >
              <IconMoreHorizontal size={17} />
            </button>
            <AnimatePresence>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-[9]" onClick={() => setShowMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: -4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 top-8 w-44 bg-background rounded-xl z-10 py-1.5 overflow-hidden border border-border shadow-lg"
                  >
                    {/* Copy link */}
                    <button
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs hover:bg-muted text-left transition-colors"
                      onClick={handleCopyLink}
                    >
                      {copyDone
                        ? <IconCheck size={14} className="text-green-500" />
                        : <IconCopy size={14} />}
                      {copyDone ? 'Copied!' : 'Copy link'}
                    </button>

                    {/* Hide post */}
                    <button
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs hover:bg-muted text-left transition-colors"
                      onClick={handleHide}
                    >
                      <IconEyeOff size={14} />
                      Hide post
                    </button>

                    {/* Delete — owner only */}
                    {isOwner && (
                      <>
                        <div className="my-1 border-t border-border" />
                        <button
                          className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs hover:bg-muted text-left text-destructive transition-colors"
                          onClick={handleDelete}
                        >
                          <IconTrash size={14} />
                          Delete post
                        </button>
                      </>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.article>
    </>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
      {...fadeInUp}
    >
      <Icon size={48} className="text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  );
}
