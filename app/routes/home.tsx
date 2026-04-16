import type { Route } from "./+types/home";
import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { AppShell } from "~/components/layout/app-shell";
import { AnswerCard, PostCard, EmptyState } from "~/components/cards";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { ShareModal } from "~/components/share-modal";
import { IconShare, IconMessageCircle, IconCompass, IconRadio } from "~/components/icons";
import { useAuthStore } from "~/stores/auth-store";
import { useQuestionStore } from "~/stores/question-store";
import { usePostStore } from "~/stores/post-store";
import { useFollowStore } from "~/stores/follow-store";
import { useLiveStore } from "~/stores/live-store";
import type { Answer, Post } from "~/types";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Exotic - Ask me anything" },
    { name: "description", content: "Anonymous Q&A social platform" },
  ];
}

function PromptCard({
  username,
  onShare,
}: {
  username?: string;
  onShare: () => void;
}) {
  const askUrl = username ? `/ask/${username}` : "#";

  return (
    <div className="bg-foreground text-background p-6 sm:p-8 rounded-xl mx-4 mt-4">
      <h2 className="text-lg font-bold mb-1">Ask me anything</h2>
      <p className="text-sm opacity-70 mb-4">
        Share your profile link and let people ask you questions anonymously.
      </p>
      <div className="flex items-center gap-2">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onShare}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-background text-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <IconShare size={16} />
          Share your link
        </motion.button>
        <Link
          to={askUrl}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#fff] text-black dark:bg-[#000] dark:text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <IconMessageCircle size={16} />
          Ask
        </Link>
      </div>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-px">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-background p-4 sm:p-6 animate-pulse">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 bg-muted rounded-full" />
            <div className="h-3 w-20 bg-muted rounded" />
          </div>
          <div className="h-3 w-3/4 bg-muted mb-4 rounded" />
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-muted rounded-full" />
            <div className="h-3 w-24 bg-muted rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full bg-muted rounded" />
            <div className="h-3 w-2/3 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

type FeedItem = { type: 'answer'; data: Answer; time: number } | { type: 'post'; data: Post; time: number };

function MixedFeedList({ answers, posts }: { answers: Answer[]; posts: Post[] }) {
  const items: FeedItem[] = useMemo(() => {
    const all: FeedItem[] = [
      ...answers.map((a) => ({ type: 'answer' as const, data: a, time: new Date(a.created_at).getTime() })),
      ...posts.map((p) => ({ type: 'post' as const, data: p, time: new Date(p.created_at).getTime() })),
    ];
    return all.sort((a, b) => b.time - a.time);
  }, [answers, posts]);

  if (items.length === 0) {
    return (
      <EmptyState
        icon={IconCompass}
        title="Nothing here yet"
        description="Follow people to see their activity in your feed, or discover new users to follow."
        action={
          <Link
            to="/discover"
            className="inline-flex px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Discover people
          </Link>
        }
      />
    );
  }

  return (
    <div className="divide-y divide-muted/50">
      {items.map((item) =>
        item.type === 'answer' ? (
          <AnswerCard key={`a-${item.data.id}`} answer={item.data as Answer} />
        ) : (
          <PostCard key={`p-${item.data.id}`} post={item.data as Post} />
        )
      )}
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuthStore();
  const { feed, isLoading, fetchFeed, checkLikes } = useQuestionStore();
  const { posts, isLoading: postsLoading, fetchPosts, checkLikes: checkPostLikes } = usePostStore();
  const { following, fetchFollowing } = useFollowStore();
  const liveCount = useLiveStore((s) => s.liveCount);
  const [activeTab, setActiveTab] = useState("for-you");
  const [refreshing, setRefreshing] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const shareUrl = typeof window !== "undefined" && user?.username
    ? `${window.location.origin}/ask/${user.username}`
    : "";

  useEffect(() => {
    if (!user?.id) return;
    fetchFollowing(user.id).then(() => {
      const followedIds = Array.from(useFollowStore.getState().following);
      const idsWithSelf = followedIds.length > 0 ? [...followedIds, user.id] : undefined;
      fetchFeed(idsWithSelf).then(() => checkLikes(user.id));
      fetchPosts(idsWithSelf).then(() => checkPostLikes(user.id));
    });
  }, [user?.id]);

  const forYouAnswers = useMemo(() => feed, [feed]);
  const forYouPosts = useMemo(() => posts, [posts]);
  const followingAnswers = useMemo(
    () => feed.filter((a) => following.has(a.user_id)),
    [feed, following]
  );
  const followingPosts = useMemo(
    () => posts.filter((p) => following.has(p.user_id)),
    [posts, following]
  );

  const handleRefresh = async () => {
    if (!user?.id) return;
    setRefreshing(true);
    const followedIds = Array.from(following);
    const idsWithSelf = followedIds.length > 0 ? [...followedIds, user.id] : undefined;
    await Promise.all([
      fetchFeed(idsWithSelf),
      fetchPosts(idsWithSelf),
    ]);
    await Promise.all([
      checkLikes(user.id),
      checkPostLikes(user.id),
    ]);
    setRefreshing(false);
  };

  const loading = isLoading || postsLoading;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        <PromptCard
          username={user?.username}
          onShare={() => setShowShare(true)}
        />

        <div className="mt-2">
          {/* Live banner */}
          <AnimatePresence>
            {liveCount > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
              >
                <Link
                  to="/live"
                  className="flex items-center gap-2 mx-4 mb-2 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/15 transition-colors"
                >
                  <span className="relative w-2 h-2 flex-shrink-0">
                    <span className="absolute inset-0 rounded-full bg-red-500" />
                    <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
                  </span>
                  <span className="text-xs font-semibold text-red-500">
                    {liveCount} live now
                  </span>
                  <IconRadio size={14} className="text-red-500 ml-auto" />
                </Link>
              </motion.div>
            )}
          </AnimatePresence>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="px-4 pt-2">
              <TabsList variant="line" className="w-full">
                <TabsTrigger value="for-you" className="flex-1">
                  For You
                </TabsTrigger>
                <TabsTrigger value="following" className="flex-1">
                  Following
                </TabsTrigger>
              </TabsList>
            </div>

            <AnimatePresence mode="wait">
              {refreshing && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 40, opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="flex items-center justify-center"
                >
                  <motion.div
                    className="w-5 h-5 border-2 border-foreground border-t-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <TabsContent value="for-you">
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <FeedSkeleton />
                  </motion.div>
                ) : (
                  <motion.div key="feed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <MixedFeedList answers={forYouAnswers} posts={forYouPosts} />
                  </motion.div>
                )}
              </AnimatePresence>
            </TabsContent>

            <TabsContent value="following">
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <FeedSkeleton />
                  </motion.div>
                ) : (
                  <motion.div key="following-feed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <MixedFeedList answers={followingAnswers} posts={followingPosts} />
                  </motion.div>
                )}
              </AnimatePresence>
            </TabsContent>
          </Tabs>
        </div>

        {!loading && user && (
          <div className="flex justify-center py-4">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleRefresh}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {refreshing ? "Refreshing..." : "Refresh feed"}
            </motion.button>
          </div>
        )}
      </div>

      {shareUrl && (
        <ShareModal
          open={showShare}
          onClose={() => setShowShare(false)}
          url={shareUrl}
        />
      )}
    </AppShell>
  );
}
