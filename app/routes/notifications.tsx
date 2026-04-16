import type { Route } from "./+types/notifications";
import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { AppShell } from "~/components/layout/app-shell";
import { EmptyState } from "~/components/cards";
import { UserAvatar } from "~/components/user-avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { Button } from "~/components/ui/button";
import { IconBell, IconHeart, IconUser, IconMessageCircle, IconCheck, IconX, IconMail, IconEyeOff } from "~/components/icons";
import { useNotificationStore } from "~/stores/notification-store";
import { useFollowStore } from "~/stores/follow-store";
import { useAuthStore } from "~/stores/auth-store";
import { staggerContainer, staggerItemVariants, fadeInUp } from "~/components/animations";
import type { Notification } from "~/types";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Notifications - Exotic" },
    { name: "description", content: "Your notifications on Exotic" },
  ];
}

function getNotificationIcon(type: Notification["type"]) {
  switch (type) {
    case "question_received":
      return IconMessageCircle;
    case "follow":
      return IconUser;
    case "like":
      return IconHeart;
    case "comment":
      return IconMessageCircle;
    default:
      return IconBell;
  }
}

function getNotificationLink(notification: Notification): string {
  switch (notification.target_type) {
    case "question":
      return `/inbox`;
    case "answer":
      return `/`;
    case "user":
      return `/profile/${notification.actor?.username ?? notification.actor_id}`;
    case "comment":
      return `/`;
    default:
      return "/notifications";
  }
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString();
}

type FilterTab = "all" | "questions" | "follows" | "likes";

function filterNotifications(
  notifications: Notification[],
  tab: FilterTab
): Notification[] {
  if (tab === "all") return notifications;
  if (tab === "questions")
    return notifications.filter(
      (n) => n.type === "question_received" || n.type === "answer_posted"
    );
  if (tab === "follows")
    return notifications.filter((n) => n.type === "follow");
  if (tab === "likes")
    return notifications.filter(
      (n) => n.type === "like" || n.type === "comment"
    );
  return notifications;
}

function NotificationItem({
  notification,
  onRead,
  onUnread,
  onDelete,
}: {
  notification: Notification;
  onRead: (id: string) => void;
  onUnread: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const Icon = getNotificationIcon(notification.type);
  const link = getNotificationLink(notification);

  return (
    <motion.div variants={staggerItemVariants}>
      <div
        className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50 ${
          !notification.is_read ? "bg-muted/30" : ""
        }`}
      >
        <Link to={link} className="flex items-start gap-3 flex-1 min-w-0" onClick={() => {
          if (!notification.is_read) onRead(notification.id);
        }}>
          <div className="relative flex-shrink-0 mt-0.5">
            <UserAvatar user={notification.actor} name={notification.actor?.display_name ?? "?"} size="sm" />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-background flex items-center justify-center">
              <Icon size={12} />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm leading-snug">
              {notification.actor && (
                <span className="font-semibold">
                  {notification.actor.display_name}
                </span>
              )}{" "}
              <span className="text-muted-foreground">
                {notification.message}
              </span>
            </p>
            <span className="text-xs text-muted-foreground mt-0.5 block">
              {formatTimeAgo(notification.created_at)}
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-0.5 flex-shrink-0 mt-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (notification.is_read) {
                onUnread(notification.id);
              } else {
                onRead(notification.id);
              }
            }}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={notification.is_read ? "Mark as unread" : "Mark as read"}
          >
            {notification.is_read ? (
              <IconMail size={14} />
            ) : (
              <IconCheck size={14} />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(notification.id);
            }}
            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
            title="Delete notification"
          >
            <IconX size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function FollowRequestCard({
  request,
  onAccept,
  onReject,
}: {
  request: { id: string; follower_id: string; follower: any; created_at: string };
  onAccept: (followId: string, followerId: string) => void;
  onReject: (followId: string) => void;
}) {
  const [acting, setActing] = useState(false);

  return (
    <motion.div
      variants={staggerItemVariants}
      className="flex items-center gap-3 px-4 py-3"
    >
      <Link to={`/profile/${request.follower.username}`} className="flex-shrink-0">
        <UserAvatar user={request.follower} size="sm" />
      </Link>
      <Link to={`/profile/${request.follower.username}`} className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{request.follower.display_name}</p>
        <p className="text-xs text-muted-foreground truncate">@{request.follower.username}</p>
      </Link>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Button
          size="xl"
          className="bg-foreground text-background hover:opacity-90"
          disabled={acting}
          onClick={async () => {
            setActing(true);
            await onAccept(request.id, request.follower_id);
          }}
        >
          Accept
        </Button>
        <Button
          variant="outline"
          size="xl"
          disabled={acting}
          onClick={async () => {
            setActing(true);
            await onReject(request.id);
          }}
        >
          Decline
        </Button>
      </div>
    </motion.div>
  );
}

export default function Notifications() {
  const { notifications, unreadCount, markAsRead, markAsUnread, markAllAsRead, markAllAsUnread, deleteNotification, deleteAllNotifications, fetchNotifications } =
    useNotificationStore();
  const { followRequests, fetchFollowRequests, acceptFollowRequest, rejectFollowRequest } =
    useFollowStore();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  useEffect(() => {
    if (user?.id) {
      fetchNotifications(user.id);
      fetchFollowRequests(user.id);
    }
  }, [user?.id]);

  const handleRead = useCallback(
    (id: string) => {
      markAsRead(id);
    },
    [markAsRead]
  );

  const handleUnread = useCallback(
    (id: string) => {
      markAsUnread(id);
    },
    [markAsUnread]
  );

  const handleMarkAllRead = () => {
    if (user?.id) markAllAsRead(user.id);
  };

  const handleMarkAllUnread = () => {
    if (user?.id) markAllAsUnread(user.id);
  };

  const handleDelete = useCallback(
    (id: string) => {
      deleteNotification(id);
    },
    [deleteNotification]
  );

  const handleDeleteAll = () => {
    if (user?.id) deleteAllNotifications(user.id);
  };

  const handleAcceptRequest = async (followId: string, followerId: string) => {
    if (user?.id) await acceptFollowRequest(followId, followerId, user.id);
  };

  const handleRejectRequest = async (followId: string) => {
    await rejectFollowRequest(followId);
  };

  const filtered = filterNotifications(notifications, activeTab);
  const hasRequests = followRequests.length > 0 && user?.is_private;

  // When showing follow requests cards, filter out the "requested to follow you" notifications
  // for those same users to avoid duplicates
  const requestFollowerIds = new Set(followRequests.map((r) => r.follower_id));
  const displayFiltered = activeTab === 'follows' && hasRequests
    ? filtered.filter((n) => !(n.message === 'requested to follow you' && requestFollowerIds.has(n.actor_id)))
    : filtered;

  const allRead = notifications.length > 0 && unreadCount === 0;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold">Notifications</h1>
          {notifications.length > 0 && (
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="default"
                  onClick={handleMarkAllRead}
                  className="text-xs text-muted-foreground"
                >
                  <IconCheck size={14} />
                  Read all
                </Button>
              )}
              {allRead && (
                <Button
                  variant="ghost"
                  size="default"
                  onClick={handleMarkAllUnread}
                  className="text-xs text-muted-foreground"
                >
                  <IconMail size={14} />
                  Unread all
                </Button>
              )}
              <Button
                variant="ghost"
                size="default"
                onClick={handleDeleteAll}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                <IconX size={14} />
                Delete all
              </Button>
            </div>
          )}
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as FilterTab)}
        >
          <div className="px-4">
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1">
                All
              </TabsTrigger>
              <TabsTrigger value="questions" className="flex-1">
                Questions
              </TabsTrigger>
              <TabsTrigger value="follows" className="flex-1 relative">
                Follows
                {hasRequests && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-foreground text-background">
                    {followRequests.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="likes" className="flex-1">
                Likes
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value={activeTab}>
            <AnimatePresence mode="wait">
              {/* Follow Requests section (only in follows tab) */}
              {activeTab === "follows" && hasRequests && (
                <motion.div
                  key="requests"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border-b border-muted"
                >
                  <div className="px-4 py-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Follow Requests ({followRequests.length})
                    </h3>
                  </div>
                  <motion.div
                    variants={staggerContainer}
                    initial="initial"
                    animate="animate"
                    className="divide-y divide-muted/50"
                  >
                    {followRequests.map((request) => (
                      <FollowRequestCard
                        key={request.id}
                        request={request}
                        onAccept={handleAcceptRequest}
                        onReject={handleRejectRequest}
                      />
                    ))}
                  </motion.div>
                </motion.div>
              )}

              {displayFiltered.length === 0 && !(activeTab === "follows" && hasRequests) ? (
                <EmptyState
                  icon={IconBell}
                  title="No notifications"
                  description="When someone interacts with you, you'll see it here."
                />
              ) : displayFiltered.length > 0 ? (
                <motion.div
                  key={activeTab}
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                  className="divide-y divide-muted/50"
                >
                  {displayFiltered.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onRead={handleRead}
                      onUnread={handleUnread}
                      onDelete={handleDelete}
                    />
                  ))}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
