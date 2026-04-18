import type { Route } from "./+types/live";
import { useState, useEffect } from "react";
import { Link, useNavigate, useFetcher } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { AppShell } from "~/components/layout/app-shell";
import { EmptyState } from "~/components/cards";
import { UserAvatar } from "~/components/user-avatar";
import {
  IconRadio,
  IconUsers,
  IconMonitor,
  IconVideo,
  IconCamera,
  IconLayers,
  IconSmartphone,
  IconGlobe,
} from "~/components/icons";
import { useLiveStore } from "~/stores/live-store";
import { useAuthStore } from "~/stores/auth-store";
import { getServerSupabase } from "~/lib/supabase.server";
import { createLiveInput } from "~/lib/cloudflare-stream.server";
import type { MediaSourceType } from "~/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { fadeInUp } from "~/components/animations";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Live - Exotic" },
    { name: "description", content: "Watch and start live streams on Exotic" },
  ];
}

// ─── Server action for RTMP stream creation ───
export async function action({ request, context }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create-rtmp-stream") {
    const userId = formData.get("userId") as string;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;

    const env = context.cloudflare.env as any;
    const accountId: string = env.CF_ACCOUNT_ID ?? "";
    const token: string = env.CF_STREAM_TOKEN ?? "";

    if (!accountId || !token) {
      return { error: "Cloudflare Stream is not configured. Add CF_ACCOUNT_ID and CF_STREAM_TOKEN to your environment." };
    }

    let liveInput;
    try {
      liveInput = await createLiveInput(accountId, token, title);
    } catch (e: any) {
      return { error: e.message ?? "Failed to create Cloudflare Stream live input" };
    }

    const sb = getServerSupabase(env);

    // End any existing live streams for this user
    const { data: existing } = await sb
      .from("live_streams")
      .select("id, cf_live_input_uid")
      .eq("user_id", userId)
      .eq("status", "live");

    if (existing?.length) {
      for (const s of existing) {
        if (s.cf_live_input_uid && accountId && token) {
          try { await (await import("~/lib/cloudflare-stream.server")).deleteLiveInput(accountId, token, s.cf_live_input_uid); } catch {}
        }
      }
      const ids = existing.map((s: any) => s.id);
      await sb.from("live_viewers").delete().in("stream_id", ids);
      await sb.from("live_messages").delete().in("stream_id", ids);
      await sb.from("live_streams").delete().in("id", ids);
    }

    const { data, error } = await sb
      .from("live_streams")
      .insert({
        user_id: userId,
        title,
        description,
        media_type: "rtmp",
        rtmp_url: liveInput.rtmpsUrl,
        rtmp_key: liveInput.rtmpsKey,
        cf_live_input_uid: liveInput.uid,
        cf_embed_url: liveInput.embedUrl,
      })
      .select("id")
      .single();

    if (error) return { error: error.message };
    await sb.from("live_viewers").insert({ stream_id: data.id, user_id: userId });

    return { streamId: data.id };
  }

  return { error: "Unknown intent" };
}

function LiveStreamCard({ stream }: { stream: any }) {
  return (
    <Link to={`/live/${stream.id}`}>
      <motion.div
        className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
        whileTap={{ scale: 0.98 }}
      >
        <div className="relative flex-shrink-0">
          <UserAvatar user={stream.user} size="sm" />
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 border-2 border-background">
            <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{stream.title}</p>
          <p className="text-xs text-muted-foreground truncate">
            @{stream.user?.username ?? "unknown"}
          </p>
          {stream.description && (
            <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
              {stream.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0">
          <div className="relative">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            <span className="absolute inset-0 w-2 h-2 rounded-full bg-red-500 animate-ping opacity-75" />
          </div>
          <IconUsers size={14} />
          <span>{stream.viewer_count ?? 0}</span>
        </div>
      </motion.div>
    </Link>
  );
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => {
      const ua = navigator.userAgent;
      const mobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua) || window.innerWidth < 768;
      setIsMobile(mobile);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

function MediaSourceDialog({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (source: MediaSourceType) => void;
}) {
  const isMobile = useIsMobile();

  const desktopOptions: { type: MediaSourceType; icon: typeof IconMonitor; label: string; desc: string }[] = [
    { type: "screen", icon: IconMonitor, label: "Screen", desc: "Share your desktop screen" },
    { type: "camera", icon: IconVideo, label: "Webcam", desc: "Use your webcam" },
    { type: "both", icon: IconLayers, label: "Screen + Camera", desc: "Screen with webcam overlay" },
    { type: "browser", icon: IconGlobe, label: "Browser", desc: "Capture a browser window" },
    { type: "browser_camera", icon: IconLayers, label: "Browser + Camera", desc: "Browser window with webcam overlay" },
    { type: "rtmp", icon: IconMonitor, label: "OBS / RTMP", desc: "Stream from OBS Studio or Prism Live" },
  ];

  const mobileOptions: { type: MediaSourceType; icon: typeof IconMonitor; label: string; desc: string }[] = [
    { type: "screen", icon: IconSmartphone, label: "Screen", desc: "Share your mobile screen" },
    { type: "camera", icon: IconCamera, label: "Camera", desc: "Use your camera" },
    { type: "both", icon: IconLayers, label: "Screen + Camera", desc: "Screen with camera overlay" },
    { type: "browser", icon: IconGlobe, label: "Browser", desc: "Capture a browser window" },
    { type: "browser_camera", icon: IconLayers, label: "Browser + Camera", desc: "Browser window with camera overlay" },
    { type: "rtmp", icon: IconMonitor, label: "Prism Live / RTMP", desc: "Stream from Prism Live or any RTMP app" },
  ];

  const options = isMobile ? mobileOptions : desktopOptions;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Choose Media Source</DialogTitle>
          <DialogDescription>
            Select how you want to stream to your viewers.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {options.map((opt) => (
            opt.type === "rtmp" ? (
              <div
                key={opt.type}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/30 opacity-60 cursor-not-allowed text-left"
              >
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <opt.icon size={20} className="text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{opt.label}</p>
                    <span className="px-1.5 py-0.5 rounded-full bg-foreground/10 text-foreground/50 text-[9px] font-bold uppercase tracking-wider">
                      Coming Soon
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </div>
              </div>
            ) : (
              <motion.button
                key={opt.type}
                whileTap={{ scale: 0.97 }}
                onClick={() => onSelect(opt.type)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                  <opt.icon size={20} className="text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </div>
              </motion.button>
            )
          ))}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => onSelect("none")}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <IconRadio size={20} className="text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-muted-foreground">Chat only</p>
              <p className="text-xs text-muted-foreground/70">No video, just live chat</p>
            </div>
          </motion.button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GoLiveDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuthStore();
  const { createStream } = useLiveStore();
  const navigate = useNavigate();
  const rtmpFetcher = useFetcher<{ streamId?: string; error?: string }>();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  // Navigate when RTMP stream is created via server action
  useEffect(() => {
    if (rtmpFetcher.state === "idle" && rtmpFetcher.data) {
      if (rtmpFetcher.data.error) {
        setError(rtmpFetcher.data.error);
        setSubmitting(false);
      } else if (rtmpFetcher.data.streamId) {
        setTitle("");
        setDescription("");
        setSubmitting(false);
        onClose();
        setTimeout(() => navigate(`/live/${rtmpFetcher.data!.streamId}`), 50);
      }
    }
  }, [rtmpFetcher.state, rtmpFetcher.data]);

  const handleSubmit = async () => {
    if (!title.trim() || submitting || !user?.id) return;
    setError("");
    setShowMediaPicker(true);
  };

  const handleMediaSelect = async (mediaType: MediaSourceType) => {
    if (!user?.id) return;
    setShowMediaPicker(false);
    setSubmitting(true);

    if (mediaType === "rtmp") {
      // Server-side: create Cloudflare Stream live input
      rtmpFetcher.submit(
        { intent: "create-rtmp-stream", userId: user.id, title: title.trim(), description: description.trim() },
        { method: "post", action: "/live" },
      );
      return;
    }

    try {
      const streamId = await createStream(user.id, title.trim(), description.trim(), mediaType);
      if (!streamId) throw new Error("Failed to create stream");
      setTitle("");
      setDescription("");
      setSubmitting(false);
      onClose();
      setTimeout(() => navigate(`/live/${streamId}`), 50);
    } catch (e: any) {
      setError(e?.message ?? "Failed to start stream");
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open && !showMediaPicker} onOpenChange={(v) => {
        if (!v && !submitting) {
          onClose();
          setTitle("");
          setDescription("");
          setError("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Go Live</DialogTitle>
            <DialogDescription>
              Start a live stream and chat with your followers in real-time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="What's your stream about?"
                maxLength={100}
                className="w-full px-4 py-2 rounded-full bg-muted text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-foreground/20"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell viewers what to expect..."
                maxLength={300}
                rows={3}
                className="w-full px-4 py-2 rounded-2xl bg-muted text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-foreground/20 resize-none"
              />
            </div>
            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleSubmit}
              disabled={!title.trim() || submitting}
              className="w-full py-2.5 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <IconRadio size={16} />
              {submitting ? "Starting..." : "Next"}
            </motion.button>
          </div>
        </DialogContent>
      </Dialog>

      <MediaSourceDialog
        open={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        onSelect={handleMediaSelect}
      />
    </>
  );
}

export default function LivePage() {
  const { streams, isLoading } = useLiveStore();
  const [showGoLive, setShowGoLive] = useState(false);

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-4 sm:px-6 sm:py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <IconRadio size={20} className="text-red-500" />
            <h1 className="text-lg font-bold">Live</h1>
            {streams.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 text-xs font-semibold">
                {streams.length} live
              </span>
            )}
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowGoLive(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
          >
            <IconRadio size={14} />
            Go Live
          </motion.button>
        </div>

        {/* Stream List */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div key="skeleton" {...fadeInUp} className="space-y-0">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-4 animate-pulse">
                  <div className="w-10 h-10 bg-muted rounded-full" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-32 bg-muted rounded" />
                    <div className="h-2 w-20 bg-muted rounded" />
                  </div>
                  <div className="h-3 w-10 bg-muted rounded" />
                </div>
              ))}
            </motion.div>
          ) : streams.length > 0 ? (
            <motion.div
              key="streams"
              {...fadeInUp}
              className="divide-y divide-muted/50 rounded-xl border border-muted overflow-hidden"
            >
              {streams.map((stream) => (
                <LiveStreamCard key={stream.id} stream={stream} />
              ))}
            </motion.div>
          ) : (
            <motion.div key="empty" {...fadeInUp}>
              <EmptyState
                icon={IconRadio}
                title="No one is live right now"
                description="Be the first to go live and start chatting with your followers in real-time!"
                action={
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowGoLive(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
                  >
                    <IconRadio size={14} />
                    Start a stream
                  </motion.button>
                }
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <GoLiveDialog
        open={showGoLive}
        onClose={() => setShowGoLive(false)}
      />
    </AppShell>
  );
}
