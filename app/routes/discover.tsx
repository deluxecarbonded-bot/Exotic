import type { Route } from "./+types/discover";
import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import { AppShell } from "~/components/layout/app-shell";
import { UserCard, PostCard, EmptyState } from "~/components/cards";
import { UserAvatar } from "~/components/user-avatar";
import {
  IconSearch,
  IconTrendingUp,
  IconUsers,
  IconChevronRight,
  IconImage,
  IconRadio,
} from "~/components/icons";
import { useFollowStore } from "~/stores/follow-store";
import { usePostStore } from "~/stores/post-store";
import { useAuthStore } from "~/stores/auth-store";
import { useLiveStore } from "~/stores/live-store";
import { supabase } from "~/lib/supabase";
import { VerifiedBadge, OwnerBadge } from "~/components/badges";
import type { User, Post } from "~/types";

const TOPICS = [
  "Music",
  "Sports",
  "Gaming",
  "Art",
  "Tech",
  "Travel",
  "Food",
  "Fashion",
  "Fitness",
  "Movies",
  "Books",
  "Photography",
  "Science",
  "Education",
  "Comedy",
  "Lifestyle",
];

function SectionHeader({
  icon: Icon,
  title,
  actionLabel,
  actionTo,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  actionLabel?: string;
  actionTo?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon size={18} className="text-foreground" />
        <h2 className="text-sm font-bold">{title}</h2>
      </div>
      {actionLabel && actionTo && (
        <Link
          to={actionTo}
          className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {actionLabel}
          <IconChevronRight size={14} />
        </Link>
      )}
    </div>
  );
}

function TopicChip({ topic }: { topic: string }) {
  return (
    <Link to={`/search?q=${encodeURIComponent(topic)}`}>
      <motion.div
        className="px-4 py-2 rounded-full bg-muted text-xs font-medium text-foreground hover:bg-foreground hover:text-background transition-colors cursor-pointer whitespace-nowrap"
        whileTap={{ scale: 0.95 }}
      >
        {topic}
      </motion.div>
    </Link>
  );
}

function TrendingUserCard({ user, rank }: { user: User; rank: number }) {
  const { isFollowing: checkIsFollowing, isRequested: checkIsRequested, toggleFollow } = useFollowStore();
  const { user: authUser } = useAuthStore();
  const isFollowing = checkIsFollowing(user.id);
  const isRequested = checkIsRequested(user.id);

  return (
    <div
      className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
    >
      <span className="text-lg font-bold text-muted-foreground/50 w-6 text-center flex-shrink-0">
        {rank}
      </span>
      <Link to={`/profile/${user.username}`} className="flex-shrink-0">
        <UserAvatar user={user} size="sm" />
      </Link>
      <Link to={`/profile/${user.username}`} className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate flex items-center gap-1 flex-wrap">
          {user.display_name}
          {user.is_owner && <OwnerBadge />}
          {user.is_verified && <VerifiedBadge />}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          @{user.username}
        </p>
      </Link>
      {authUser && authUser.id !== user.id && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          className={`px-5 py-2 text-sm font-medium rounded-full transition-colors flex-shrink-0 ${
            isFollowing || isRequested
              ? "bg-muted text-muted-foreground hover:text-foreground"
              : "bg-foreground text-background hover:opacity-90"
          }`}
          onClick={() => {
            if (authUser) toggleFollow(user.id, authUser.id, user.is_private);
          }}
        >
          {isFollowing ? "Following" : isRequested ? "Requested" : "Follow"}
        </motion.button>
      )}
    </div>
  );
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Discover - Exotic" },
    {
      name: "description",
      content: "Discover new people and topics on Exotic",
    },
  ];
}

export default function DiscoverPage() {
  const { user } = useAuthStore();
  const { following } = useFollowStore();
  const { fetchDiscoverPosts } = usePostStore();
  const { streams } = useLiveStore();
  const [trendingUsers, setTrendingUsers] = useState<User[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<User[]>([]);
  const [trendingPosts, setTrendingPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDiscover = useCallback(async () => {
    // Fetch trending users (most followers)
    const { data: trending } = await supabase
      .from('profiles')
      .select('*')
      .order('followers_count', { ascending: false })
      .limit(10);

    // Filter out current user from trending
    const filteredTrending = (trending ?? []).filter(
      (u: any) => u.id !== user?.id
    ) as User[];
    setTrendingUsers(filteredTrending);

    // Fetch suggested users (not already followed, not self)
    const followedIds = Array.from(following);
    const excludeIds = user ? [user.id, ...followedIds] : followedIds;

    let suggestedQuery = supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (excludeIds.length > 0) {
      for (const id of excludeIds.slice(0, 10)) {
        suggestedQuery = suggestedQuery.neq('id', id);
      }
    }

    const { data: suggested } = await suggestedQuery;
    setSuggestedUsers((suggested ?? []) as User[]);

    // Fetch trending posts
    const posts = await fetchDiscoverPosts();
    setTrendingPosts(posts);
  }, [user?.id, following.size]);

  useEffect(() => {
    setLoading(true);
    loadDiscover().then(() => setLoading(false));
  }, [loadDiscover]);

  // Realtime: refresh discover data when profiles or posts change
  useEffect(() => {
    const profileChannel = supabase
      .channel('discover-profiles')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => { loadDiscover(); }
      )
      .subscribe();

    const postChannel = supabase
      .channel('discover-posts')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'posts' },
        () => { loadDiscover(); }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'post_likes' },
        () => { loadDiscover(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(postChannel);
    };
  }, [loadDiscover]);

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-4 sm:px-6 sm:py-6">
        {/* Search Bar */}
        <div className="mb-8">
          <Link
            to="/search"
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <IconSearch size={18} />
            <span className="text-sm">Search people, topics, questions...</span>
          </Link>
        </div>

        {/* Live Now */}
        {streams.length > 0 && (
          <section className="mb-8">
            <SectionHeader
              icon={IconRadio}
              title="Live Now"
              actionLabel="See all"
              actionTo="/live"
            />
            <div className="divide-y divide-muted/50 rounded-xl border border-muted overflow-hidden">
              {streams.slice(0, 3).map((stream) => (
                <Link key={stream.id} to={`/live/${stream.id}`}>
                  <div className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors">
                    <div className="relative flex-shrink-0">
                      <UserAvatar user={stream.user} size="sm" />
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-background" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{stream.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        @{stream.user?.username ?? "unknown"} · {stream.viewer_count ?? 0} watching
                      </p>
                    </div>
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 text-[10px] font-bold flex-shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      LIVE
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Topics / Categories */}
        <section className="mb-8">
          <SectionHeader icon={IconSearch} title="Topics" />
          <div className="flex flex-wrap gap-2">
            {TOPICS.map((topic) => (
              <TopicChip key={topic} topic={topic} />
            ))}
          </div>
        </section>

        {/* Trending */}
        <section className="mb-8">
          <SectionHeader
            icon={IconTrendingUp}
            title="Trending"
            actionLabel="See all"
            actionTo="/search?tab=trending"
          />
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-4 animate-pulse">
                  <div className="w-6 h-4 bg-muted rounded" />
                  <div className="w-11 h-11 bg-muted rounded-full" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-24 bg-muted rounded" />
                    <div className="h-2 w-16 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : trendingUsers.length > 0 ? (
            <div className="space-y-0">
              {trendingUsers.map((user, i) => (
                <TrendingUserCard key={user.id} user={user} rank={i + 1} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={IconTrendingUp}
              title="No trending users yet"
              description="Trending users will appear here once the community grows."
            />
          )}
        </section>

        {/* Trending Posts */}
        {trendingPosts.length > 0 && (
          <section className="mb-8">
            <SectionHeader
              icon={IconImage}
              title="Popular Posts"
              actionLabel="See all"
              actionTo="/posts"
            />
            <div className="divide-y divide-muted/50 rounded-lg overflow-hidden border border-muted">
              {trendingPosts.slice(0, 5).map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          </section>
        )}

        {/* Suggested For You */}
        <section className="mb-8">
          <SectionHeader
            icon={IconUsers}
            title="Suggested for you"
            actionLabel="See all"
            actionTo="/search?tab=suggested"
          />
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-4 animate-pulse">
                  <div className="w-12 h-12 bg-muted rounded-full" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-24 bg-muted rounded" />
                    <div className="h-2 w-16 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : suggestedUsers.length > 0 ? (
            <div className="space-y-0">
              {suggestedUsers.map((user) => (
                <UserCard key={user.id} user={user} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={IconUsers}
              title="No suggestions yet"
              description="Suggested users will appear here based on your interests."
            />
          )}
        </section>
      </div>
    </AppShell>
  );
}
