import type { Route } from "./+types/profile.$username";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Link } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { AppShell } from "~/components/layout/app-shell";
import { AnswerCard, UserCard, EmptyState, PostCard } from "~/components/cards";
import {
  IconSettings,
  IconShare,
  IconEdit,
  IconLink,
  IconUsers,
  IconMessageCircle,
  IconHeart,
  IconEyeOff,
  IconSend,
  IconX,
  IconCheck,
  IconArrowLeft,
  IconLock,
  IconImage,
  IconMask,
} from "~/components/icons";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { ShareModal } from "~/components/share-modal";
import { useAuthStore } from "~/stores/auth-store";
import { useFollowStore } from "~/stores/follow-store";
import { useQuestionStore } from "~/stores/question-store";
import { usePostStore } from "~/stores/post-store";
import { supabase } from "~/lib/supabase";
import { UserAvatar } from "~/components/user-avatar";
import type { User, Answer, Post } from "~/types";

const AVATAR_COLORS = [
  "#000000",
  "#1a1a1a",
  "#333333",
  "#4d4d4d",
  "#666666",
  "#808080",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function ProfileAvatar({
  name,
  size = "lg",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "w-10 h-10 text-sm",
    md: "w-16 h-16 text-xl",
    lg: "w-24 h-24 text-3xl",
  };

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold text-white`}
      style={{ backgroundColor: getAvatarColor(name) }}
    >
      {getInitials(name)}
    </div>
  );
}

function StatButton({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick?: () => void;
}) {
  return (
    <motion.button
      className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg hover:bg-muted/50 transition-colors"
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
    >
      <span className="text-lg font-bold">
        {value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </motion.button>
  );
}

function AskQuestionBox({
  receiverId,
  username,
  allowAnonymous,
}: {
  receiverId: string;
  username: string;
  allowAnonymous: boolean;
}) {
  const [question, setQuestion] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [sent, setSent] = useState(false);
  const { askQuestion } = useQuestionStore();
  const { user } = useAuthStore();

  const handleSend = async () => {
    if (!question.trim() || !receiverId) return;
    try {
      await askQuestion(receiverId, question.trim(), isAnonymous, user?.id ?? null);
      setQuestion("");
      setSent(true);
      setTimeout(() => setSent(false), 2000);
    } catch (e) {
      console.error('Failed to send question:', e);
    }
  };

  return (
    <div className="bg-muted/30 rounded-xl p-4 sm:p-6">
      <h3 className="text-sm font-semibold mb-3">Ask @{username} a question</h3>
      <div className="space-y-3">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Type your question..."
          rows={3}
          maxLength={500}
          className="w-full bg-background rounded-lg px-3 py-2.5 text-sm resize-none placeholder:text-muted-foreground focus:outline-none"
        />
        <div className="flex items-center justify-between">
          {allowAnonymous && (
            <div className="flex items-center gap-2">
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsAnonymous(!isAnonymous)}
                className={`relative inline-flex items-center h-[28px] w-[50px] rounded-full transition-colors ${
                  isAnonymous
                    ? "bg-foreground"
                    : "bg-input dark:bg-input/80"
                }`}
              >
                <motion.div
                  className={`flex items-center justify-center w-[22px] h-[22px] rounded-full transition-colors ${
                    isAnonymous ? "bg-background" : "bg-background dark:bg-foreground"
                  }`}
                  animate={{ x: isAnonymous ? 24 : 3 }}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                >
                  <IconMask size={12} className={isAnonymous ? "text-foreground" : "text-muted-foreground dark:text-background"} />
                </motion.div>
              </motion.button>
              <span className="text-xs text-muted-foreground">
                {isAnonymous ? "Anonymous" : "Not anonymous"}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <AnimatePresence>
              {sent && (
                <motion.span
                  className="text-xs text-muted-foreground flex items-center gap-1"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                >
                  <IconCheck size={14} />
                  Sent
                </motion.span>
              )}
            </AnimatePresence>
            <motion.button
              whileTap={{ scale: 0.9 }}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-opacity ${
                question.trim()
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground"
              }`}
              disabled={!question.trim()}
              onClick={handleSend}
            >
              <IconSend size={14} />
              Send
            </motion.button>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground text-right">
          {question.length}/500
        </p>
      </div>
    </div>
  );
}

function UserListDialog({
  open,
  onOpenChange,
  title,
  users,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  users: User[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[70vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto -mx-4 custom-scrollbar">
          {users.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              No users yet
            </p>
          ) : (
            users.map((user) => (
              <UserCard key={user.id} user={user} />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function meta({ params }: Route.MetaArgs) {
  const username = params.username === "me" ? "My Profile" : `@${params.username}`;
  return [
    { title: `${username} - Exotic` },
    { name: "description", content: `View ${username} on Exotic` },
  ];
}

export default function ProfilePage({ params }: Route.ComponentProps) {
  const { username } = params;
  const { user: authUser } = useAuthStore();
  const { toggleFollow, fetchFollowers, fetchFollowingUsers, fetchFollowing } = useFollowStore();

  const isOwnProfile = username === "me" || authUser?.username === username;

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [likedAnswers, setLikedAnswers] = useState<Answer[]>([]);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [followers, setFollowers] = useState<User[]>([]);
  const [followingUsers, setFollowingUsers] = useState<User[]>([]);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState("answers");
  const [copied, setCopied] = useState(false);
  const [showShare, setShowShare] = useState(false);

  // Direct local follow status — queried from DB, not from store
  const [followStatus, setFollowStatus] = useState<'none' | 'pending' | 'accepted'>('none');

  const { fetchUserAnswers, fetchLikedAnswers, onAnswerChange } = useQuestionStore();
  const { fetchUserPosts, onPostChange } = usePostStore();

  // Check follow status directly from DB
  const checkFollowStatus = useCallback(async (targetId: string) => {
    if (!authUser?.id || !targetId || authUser.id === targetId) return;
    const { data } = await supabase
      .from('follows')
      .select('status')
      .eq('follower_id', authUser.id)
      .eq('following_id', targetId)
      .maybeSingle();
    if (data) {
      setFollowStatus(data.status as 'pending' | 'accepted');
    } else {
      setFollowStatus('none');
    }
  }, [authUser?.id]);

  // Realtime callback to refresh answers when they change
  const refreshAnswers = useCallback(async () => {
    if (!profileUser?.id) return;
    const [ans, liked] = await Promise.all([
      fetchUserAnswers(profileUser.id),
      fetchLikedAnswers(profileUser.id),
    ]);
    setAnswers(ans);
    setLikedAnswers(liked);
  }, [profileUser?.id]);

  // Realtime callback to refresh posts when they change
  const refreshPosts = useCallback(async () => {
    if (!profileUser?.id) return;
    const posts = await fetchUserPosts(profileUser.id);
    setUserPosts(posts);
  }, [profileUser?.id]);

  // Fetch profile data
  useEffect(() => {
    async function loadProfile() {
      setLoading(true);

      if (isOwnProfile && authUser) {
        setProfileUser(authUser);
        const [ans, liked, posts] = await Promise.all([
          fetchUserAnswers(authUser.id),
          fetchLikedAnswers(authUser.id),
          fetchUserPosts(authUser.id),
        ]);
        setAnswers(ans);
        setLikedAnswers(liked);
        setUserPosts(posts);
        const [f, fg] = await Promise.all([
          fetchFollowers(authUser.id),
          fetchFollowingUsers(authUser.id),
        ]);
        setFollowers(f);
        setFollowingUsers(fg);
        setLoading(false);
        return;
      }

      // Fetch profile by username
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single();

      if (profile) {
        setProfileUser(profile as User);
        const [ans, liked, f, fg, posts] = await Promise.all([
          fetchUserAnswers(profile.id),
          fetchLikedAnswers(profile.id),
          fetchFollowers(profile.id),
          fetchFollowingUsers(profile.id),
          fetchUserPosts(profile.id),
        ]);
        setAnswers(ans);
        setLikedAnswers(liked);
        setFollowers(f);
        setFollowingUsers(fg);
        setUserPosts(posts);
        // Check follow status directly from DB
        checkFollowStatus(profile.id);
      }
      setLoading(false);
    }

    loadProfile();
  }, [username, authUser?.id]);

  // Subscribe to profile realtime updates (profile data + answers + follow status)
  useEffect(() => {
    if (!profileUser?.id) return;

    // Listen for profile field changes
    const channel = supabase
      .channel(`profile-${profileUser.id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${profileUser.id}` },
        (payload) => {
          setProfileUser((prev) => prev ? { ...prev, ...payload.new } as User : prev);
        }
      )
      .subscribe();

    // Listen for answer changes on this profile
    const unsubAnswers = onAnswerChange(profileUser.id, refreshAnswers);

    // Listen for post changes on this profile
    const unsubPosts = onPostChange(profileUser.id, refreshPosts);

    // Listen for ANY changes to follow rows involving this profile — recheck status from DB
    const followChannel = supabase
      .channel(`profile-follows-${profileUser.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'follows', filter: `following_id=eq.${profileUser.id}` },
        async () => {
          const f = await fetchFollowers(profileUser.id);
          setFollowers(f);
          checkFollowStatus(profileUser.id);
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'follows', filter: `following_id=eq.${profileUser.id}` },
        async () => {
          const f = await fetchFollowers(profileUser.id);
          setFollowers(f);
          // This fires when someone's request is accepted — recheck our status
          checkFollowStatus(profileUser.id);
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'follows', filter: `following_id=eq.${profileUser.id}` },
        async () => {
          const f = await fetchFollowers(profileUser.id);
          setFollowers(f);
          checkFollowStatus(profileUser.id);
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'follows', filter: `follower_id=eq.${profileUser.id}` },
        async () => {
          const fg = await fetchFollowingUsers(profileUser.id);
          setFollowingUsers(fg);
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'follows', filter: `follower_id=eq.${profileUser.id}` },
        async () => {
          const fg = await fetchFollowingUsers(profileUser.id);
          setFollowingUsers(fg);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(followChannel);
      unsubAnswers();
      unsubPosts();
    };
  }, [profileUser?.id, refreshAnswers, refreshPosts, checkFollowStatus]);

  const following = followStatus === 'accepted';
  const requested = followStatus === 'pending';
  const isPrivateAndRestricted = profileUser?.is_private && !isOwnProfile && !following;

  const handleFollow = async () => {
    if (!profileUser || !authUser) return;

    if (following) {
      // Unfollow — optimistic
      setFollowStatus('none');
      await supabase
        .from('follows')
        .delete()
        .match({ follower_id: authUser.id, following_id: profileUser.id });
    } else if (requested) {
      // Cancel request — optimistic
      setFollowStatus('none');
      await supabase
        .from('follows')
        .delete()
        .match({ follower_id: authUser.id, following_id: profileUser.id });
    } else {
      // New follow/request — optimistic
      const status = profileUser.is_private ? 'pending' : 'accepted';
      setFollowStatus(status);
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: authUser.id, following_id: profileUser.id, status });
      if (error) {
        setFollowStatus('none');
        // Re-verify from DB
        checkFollowStatus(profileUser.id);
        return;
      }
      await supabase.from('notifications').insert({
        user_id: profileUser.id,
        type: 'follow',
        actor_id: authUser.id,
        target_id: authUser.id,
        target_type: 'user',
        message: status === 'pending' ? 'requested to follow you' : 'started following you',
      });
    }

    // Refetch profile to get updated counts + sync global store
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profileUser.id)
      .single();
    if (data) setProfileUser(data as User);
    fetchFollowing(authUser.id);
    // Re-verify actual status from DB
    checkFollowStatus(profileUser.id);
  };

  const shareUrl = typeof window !== "undefined" && profileUser
    ? `${window.location.origin}/ask/${profileUser.username}`
    : "";

  if (loading || !profileUser) {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="flex flex-col items-center gap-4 animate-pulse">
            <div className="w-24 h-24 rounded-full bg-muted" />
            <div className="h-5 w-32 bg-muted rounded" />
            <div className="h-3 w-20 bg-muted rounded" />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        {/* Profile Header */}
        <section className="px-4 pt-4 sm:px-6 sm:pt-6">
          {/* Top actions bar */}
          <div className="flex items-center justify-between mb-6">
            <Link
              to="/"
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <IconArrowLeft size={20} />
            </Link>
            <div className="flex items-center gap-1">
              {isOwnProfile && (
                <Link
                  to="/settings"
                  className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <IconSettings size={18} />
                </Link>
              )}
              <motion.button
                whileTap={{ scale: 0.9 }}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowShare(true)}
              >
                <IconShare size={18} />
              </motion.button>
            </div>
          </div>

          {/* Avatar + Info */}
          <div className="flex flex-col items-center text-center mb-6">
            <UserAvatar user={profileUser} size="xl" />
            <h1 className="text-xl font-bold mt-4 flex items-center gap-1.5">
              {profileUser.display_name}
              {profileUser.is_private && (
                <IconLock size={16} className="text-muted-foreground" />
              )}
            </h1>
            <p className="text-sm text-muted-foreground">
              @{profileUser.username}
            </p>
            {profileUser.bio && (
              <p className="text-sm text-muted-foreground mt-2 max-w-sm leading-relaxed">
                {profileUser.bio}
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <StatButton
              label="Followers"
              value={profileUser.followers_count}
              onClick={() => setShowFollowers(true)}
            />
            <StatButton
              label="Following"
              value={profileUser.following_count}
              onClick={() => setShowFollowing(true)}
            />
            <StatButton label="Answers" value={profileUser.answers_count} />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-3 mb-6">
            {isOwnProfile ? (
              <Link
                to="/settings"
                className="flex items-center gap-2 px-7 py-3 text-sm font-medium rounded-full bg-muted text-foreground hover:bg-muted/80 transition-colors"
              >
                <IconEdit size={14} />
                Edit Profile
              </Link>
            ) : (
              <>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  className={`flex items-center gap-2 px-7 py-3 text-sm font-medium rounded-full transition-colors ${
                    following
                      ? "bg-muted text-muted-foreground hover:text-foreground"
                      : requested
                      ? "bg-muted text-muted-foreground hover:text-foreground"
                      : "bg-foreground text-background hover:opacity-90"
                  }`}
                  onClick={handleFollow}
                >
                  {following ? "Following" : requested ? "Requested" : "Follow"}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 px-5 py-3 text-sm font-medium rounded-full bg-muted text-foreground hover:bg-muted/80 transition-colors"
                  onClick={() => {
                    const el = document.getElementById("ask-box");
                    el?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  <IconMessageCircle size={14} />
                  Ask
                </motion.button>
              </>
            )}
          </div>
        </section>

        {/* Ask Question Box */}
        {!isOwnProfile && !isPrivateAndRestricted && (
          <div id="ask-box" className="px-4 sm:px-6 mb-6">
            <AskQuestionBox
              receiverId={profileUser.id}
              username={profileUser.username}
              allowAnonymous={profileUser.allow_anonymous}
            />
          </div>
        )}

        {/* Privacy Wall */}
        {isPrivateAndRestricted ? (
          <div className="px-4 sm:px-6 py-12">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center text-center"
            >
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <IconLock size={28} className="text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">This account is private</h3>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                Follow this account to see their answers, likes, and activity.
              </p>
              {!authUser ? (
                <Link
                  to="/login"
                  className="mt-6 flex items-center gap-2 px-7 py-3 text-sm font-medium rounded-full bg-foreground text-background hover:opacity-90 transition-opacity"
                >
                  Sign in to follow
                </Link>
              ) : (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  className={`mt-6 flex items-center gap-2 px-7 py-3 text-sm font-medium rounded-full transition-opacity ${
                    requested
                      ? "bg-muted text-muted-foreground hover:text-foreground"
                      : "bg-foreground text-background hover:opacity-90"
                  }`}
                  onClick={handleFollow}
                >
                  {requested ? "Requested" : "Follow to see content"}
                </motion.button>
              )}
            </motion.div>
          </div>
        ) : (
        /* Tabs */
        <div className="px-4 sm:px-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList variant="line" className="w-full justify-start gap-0 mb-4">
              <TabsTrigger value="answers" className="flex-1">
                Answers
              </TabsTrigger>
              <TabsTrigger value="posts" className="flex-1">
                Posts
              </TabsTrigger>
              <TabsTrigger value="likes" className="flex-1">
                Likes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="answers">
              <AnimatePresence mode="wait">
                {answers.length > 0 ? (
                  <div
                    key="answers-list"
                    className="space-y-1"
                  >
                    {answers.map((answer) => (
                      <AnswerCard key={answer.id} answer={answer} />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={IconMessageCircle}
                    title="No answers yet"
                    description={
                      isOwnProfile
                        ? "Answer questions from your inbox to see them here."
                        : `${profileUser.display_name} hasn't answered any questions yet.`
                    }
                  />
                )}
              </AnimatePresence>
            </TabsContent>

            <TabsContent value="posts">
              <AnimatePresence mode="wait">
                {userPosts.length > 0 ? (
                  <div
                    key="posts-list"
                    className="space-y-1"
                  >
                    {userPosts.map((post) => (
                      <PostCard key={post.id} post={post} />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={IconImage}
                    title="No posts yet"
                    description={
                      isOwnProfile
                        ? "Share photos and videos to see them here."
                        : `${profileUser.display_name} hasn't posted anything yet.`
                    }
                  />
                )}
              </AnimatePresence>
            </TabsContent>

            <TabsContent value="likes">
              <AnimatePresence mode="wait">
                {likedAnswers.length > 0 ? (
                  <div
                    key="likes-list"
                    className="space-y-1"
                  >
                    {likedAnswers.map((answer) => (
                      <AnswerCard key={answer.id} answer={answer} />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={IconHeart}
                    title="No likes yet"
                    description={
                      isOwnProfile
                        ? "Answers you like will appear here."
                        : `${profileUser.display_name} hasn't liked any answers yet.`
                    }
                  />
                )}
              </AnimatePresence>
            </TabsContent>
          </Tabs>
        </div>
        )}

        {/* Follower / Following Dialogs */}
        <UserListDialog
          open={showFollowers}
          onOpenChange={setShowFollowers}
          title="Followers"
          users={followers}
        />
        <UserListDialog
          open={showFollowing}
          onOpenChange={setShowFollowing}
          title="Following"
          users={followingUsers}
        />
      </div>

      {shareUrl && (
        <ShareModal
          open={showShare}
          onClose={() => setShowShare(false)}
          url={shareUrl}
          text={`Ask ${profileUser.display_name} anything anonymously on Exotic!`}
        />
      )}
    </AppShell>
  );
}
