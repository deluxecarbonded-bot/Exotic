import type { Route } from "./+types/live.$streamId";
import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate, useFetcher } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { AppShell } from "~/components/layout/app-shell";
import { Button } from "~/components/ui/button";
import { UserAvatar } from "~/components/user-avatar";
import { getServerSupabase } from "~/lib/supabase.server";
import { deleteLiveInput } from "~/lib/cloudflare-stream.server";
import {
  IconArrowLeft,
  IconRadio,
  IconUsers,
  IconSend,
  IconPin,
  IconX,
  IconMonitor,
  IconVideo,
  IconLayers,
  IconGlobe,
} from "~/components/icons";
import { useLiveStore } from "~/stores/live-store";
import { useAuthStore } from "~/stores/auth-store";
import { useWebRTCHost, useWebRTCViewer } from "~/hooks/use-webrtc";
import { useMediaDevices } from "~/hooks/use-media-devices";
import type { LiveMessage, MediaSourceType } from "~/types";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Live Stream - Exotic" }];
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { streamId } = params;
  if (!streamId) return { error: "No stream ID" };

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete-stream") {
    const env = context.cloudflare.env as any;
    const sb = getServerSupabase(env);

    // Fetch stream to get CF live input UID (if RTMP)
    const { data: stream } = await sb
      .from("live_streams")
      .select("cf_live_input_uid")
      .eq("id", streamId)
      .single();

    // Delete Cloudflare Stream live input if present
    const cfUid = stream?.cf_live_input_uid;
    if (cfUid && env.CF_ACCOUNT_ID && env.CF_STREAM_TOKEN) {
      try {
        await deleteLiveInput(env.CF_ACCOUNT_ID, env.CF_STREAM_TOKEN, cfUid);
      } catch (e) {
        console.error("[delete-stream] Failed to delete CF live input:", e);
      }
    }

    await sb.from("live_viewers").delete().eq("stream_id", streamId);
    await sb.from("live_messages").delete().eq("stream_id", streamId);
    await sb.from("live_streams").delete().eq("id", streamId);
    return { ok: true };
  }

  return { error: "Unknown intent" };
}

// ─── RTMP Host Setup Panel ───
function RtmpHostPanel({ stream }: { stream: any }) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const copy = async (text: string, setFlag: (v: boolean) => void) => {
    await navigator.clipboard.writeText(text);
    setFlag(true);
    setTimeout(() => setFlag(false), 2000);
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-5 py-4 overflow-y-auto">
      <div className="text-center mb-1">
        <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-2">
          <IconMonitor size={20} className="text-red-400" />
        </div>
        <p className="text-white text-sm font-semibold">OBS / Prism Live Setup</p>
        <p className="text-white/40 text-[11px] mt-0.5">Enter these settings in your streaming app</p>
      </div>

      <div className="w-full max-w-xs space-y-2.5">
        {/* Server URL */}
        <div>
          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1">
            Server URL (RTMPS)
          </p>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10">
            <code className="flex-1 text-xs text-green-300 truncate font-mono">
              {stream.rtmp_url ?? "rtmps://live.cloudflare.com/live/"}
            </code>
            <button
              onClick={() => copy(stream.rtmp_url ?? "rtmps://live.cloudflare.com/live/", setCopiedUrl)}
              className="text-[10px] font-semibold text-white/50 hover:text-white transition-colors flex-shrink-0"
            >
              {copiedUrl ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* Stream Key */}
        <div>
          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1">
            Stream Key
          </p>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10">
            <code className="flex-1 text-xs text-yellow-300 truncate font-mono">
              {stream.rtmp_key ?? "—"}
            </code>
            <button
              onClick={() => copy(stream.rtmp_key ?? "", setCopiedKey)}
              className="text-[10px] font-semibold text-white/50 hover:text-white transition-colors flex-shrink-0"
            >
              {copiedKey ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* OBS instructions */}
        <div className="rounded-lg bg-white/5 px-3 py-2.5 text-[11px] text-white/50 leading-relaxed space-y-1">
          <p className="font-semibold text-white/70">In OBS Studio:</p>
          <p>Settings → Stream → Service: <span className="text-white/80">Custom</span></p>
          <p>Paste the Server URL and Stream Key above</p>
          <p className="font-semibold text-white/70 pt-1">In Prism Live:</p>
          <p>Settings → Custom RTMP → paste both values</p>
        </div>

        <p className="text-[10px] text-white/30 text-center">
          Viewers will see your stream as soon as you go live in OBS/Prism
        </p>
      </div>
    </div>
  );
}

// ─── RTMP Viewer (Cloudflare Stream embed) ───
function RtmpViewer({ embedUrl }: { embedUrl: string }) {
  return (
    <iframe
      src={`${embedUrl}?autoplay=true&muted=false`}
      className="w-full h-full border-0"
      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
      allowFullScreen
    />
  );
}
function StreamVideo({
  stream,
  muted = false,
  mirror = false,
  className = "",
}: {
  stream: MediaStream | null;
  muted?: boolean;
  mirror?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={className}
      style={mirror ? { transform: "scaleX(-1)" } : undefined}
    />
  );
}

// ─── Badges overlay ───
function LiveBadges({ mediaType }: { mediaType: string }) {
  return (
    <>
      <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-500/90 text-white text-[10px] font-bold z-10">
        <span className="relative w-1.5 h-1.5">
          <span className="absolute inset-0 rounded-full bg-white" />
          <span className="absolute inset-0 rounded-full bg-white animate-ping opacity-75" />
        </span>
        LIVE
      </div>
      {mediaType !== "none" && (
        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md bg-black/50 text-white/70 text-[10px] z-10">
          {mediaType === "screen" && <><IconMonitor size={10} /> Screen</>}
          {mediaType === "camera" && <><IconVideo size={10} /> Camera</>}
          {mediaType === "both" && <><IconLayers size={10} /> Screen+Cam</>}
          {mediaType === "browser" && <><IconGlobe size={10} /> Browser</>}
          {mediaType === "browser_camera" && <><IconLayers size={10} /> Browser+Cam</>}
          {mediaType === "rtmp" && <><IconMonitor size={10} /> OBS/RTMP</>}
        </div>
      )}
    </>
  );
}

// ─── Device Select ───
function DeviceSelect({
  label,
  devices,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  devices: { deviceId: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
}) {
  return (
    <div className="w-full">
      <label className="block text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 rounded-lg bg-white/10 text-white text-xs outline-none focus:ring-1 focus:ring-white/20 appearance-none cursor-pointer"
      >
        <option value="">{placeholder}</option>
        {devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Host Pre-Capture Panel (with device picker) ───
function HostPreCapture({
  mediaType,
  host,
}: {
  mediaType: MediaSourceType;
  host: ReturnType<typeof useWebRTCHost>;
}) {
  const { cameras, mics, loading } = useMediaDevices();
  const [videoDeviceId, setVideoDeviceId] = useState("");
  const [audioDeviceId, setAudioDeviceId] = useState("");

  const showCamera = mediaType === "camera" || mediaType === "both" || mediaType === "browser_camera";
  // Show mic for all types (mic can overlay screen/browser captures too)
  const showMic = mediaType !== "none";

  const startLabel =
    mediaType === "both" ? "Start Screen & Camera" :
    mediaType === "screen" ? "Start Screen Share" :
    mediaType === "browser" ? "Start Browser Capture" :
    mediaType === "browser_camera" ? "Start Browser & Camera" :
    "Start Camera";

  const Icon =
    mediaType === "screen" ? IconMonitor :
    mediaType === "camera" ? IconVideo :
    mediaType === "browser" || mediaType === "browser_camera" ? IconGlobe :
    IconLayers;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6">
      <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-1">
        <Icon size={24} className="text-white/60" />
      </div>

      {!loading && (
        <div className="w-full max-w-xs space-y-2">
          {showCamera && cameras.length > 0 && (
            <DeviceSelect
              label="Webcam"
              devices={cameras}
              value={videoDeviceId}
              onChange={setVideoDeviceId}
              placeholder="Default camera"
            />
          )}
          {showMic && mics.length > 0 && (
            <DeviceSelect
              label="Microphone"
              devices={mics}
              value={audioDeviceId}
              onChange={setAudioDeviceId}
              placeholder="Default microphone"
            />
          )}
        </div>
      )}

      {host.error === 'permission-denied' ? (
        <div className="flex flex-col items-center gap-3 text-center px-5">
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
            <IconX size={20} className="text-red-400" />
          </div>
          <div>
            <p className="text-white text-sm font-semibold mb-1">Permission Denied</p>
            <p className="text-white/50 text-[11px] leading-relaxed">
              Your browser blocked access to your {
                mediaType === 'screen' || mediaType === 'browser' ? 'screen' :
                mediaType === 'both' || mediaType === 'browser_camera' ? 'screen and camera' :
                'camera/microphone'
              }.
            </p>
          </div>
          <div className="w-full max-w-xs rounded-lg bg-white/5 px-3 py-2.5 text-left text-[11px] text-white/50 space-y-1">
            <p className="font-semibold text-white/70">To fix this:</p>
            <p>1. Click the <span className="text-white/80">lock icon</span> or <span className="text-white/80">camera icon</span> in your browser's address bar</p>
            <p>2. Set Camera, Microphone and Screen sharing to <span className="text-white/80">Allow</span></p>
            <p>3. Reload the page and try again</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => window.location.reload()}
            className="px-5 py-2 rounded-full bg-white/10 text-white text-xs font-semibold hover:bg-white/20 transition-colors"
          >
            Reload & Retry
          </motion.button>
        </div>
      ) : host.error ? (
        <p className="text-xs text-red-400 text-center px-4">{host.error}</p>
      ) : host.capturing ? (
        <p className="text-xs text-white/50">Starting capture...</p>
      ) : (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() =>
            host.startCapture(
              mediaType,
              videoDeviceId || undefined,
              audioDeviceId || undefined,
            )
          }
          className="mt-1 px-5 py-2 rounded-full bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition-colors"
        >
          {startLabel}
        </motion.button>
      )}
    </div>
  );
}

// ─── Video Player Component ───
function LiveVideoPlayer({
  mediaType,
  isHost,
  host,
  viewer,
  hostUser,
  currentStream,
}: {
  mediaType: MediaSourceType;
  isHost: boolean;
  host: ReturnType<typeof useWebRTCHost>;
  viewer: ReturnType<typeof useWebRTCViewer>;
  hostUser: any;
  currentStream: any;
}) {
  // Still loading stream data
  if (mediaType === "none") {
    return (
      <div className="relative w-full bg-black/90 overflow-hidden flex-shrink-0" style={{ aspectRatio: "16/9", maxHeight: "40vh" }}>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <IconRadio size={24} className="text-white/30 animate-pulse" />
          <p className="text-[11px] text-white/30">Loading stream...</p>
        </div>
      </div>
    );
  }

  // ── RTMP MODE ──
  if (mediaType === "rtmp") {
    return (
      <div className="relative w-full bg-black overflow-hidden flex-shrink-0" style={{ aspectRatio: "16/9", maxHeight: "40vh" }}>
        {isHost ? (
          <RtmpHostPanel stream={currentStream} />
        ) : currentStream?.cf_embed_url ? (
          <RtmpViewer embedUrl={currentStream.cf_embed_url} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-white/30 text-xs">Waiting for stream...</p>
          </div>
        )}
        <LiveBadges mediaType={mediaType} />
      </div>
    );
  }

  const aspectRatio = mediaType === "camera" ? "4/3" : "16/9";

  // ── HOST VIEW ──
  if (isHost) {
    const hasCapture = !!host.localStream && host.localStream.getTracks().length > 0;

    return (
      <div
        className="relative w-full bg-black overflow-hidden flex-shrink-0"
        style={{ aspectRatio, maxHeight: "40vh" }}
      >
        {hasCapture ? (
          <>
            {/* Main video: screen or camera */}
            {(mediaType === "screen" || mediaType === "camera") && (
              <StreamVideo
                stream={host.localStream}
                muted
                mirror={mediaType === "camera"}
                className="w-full h-full object-contain"
              />
            )}

            {/* Browser only */}
            {mediaType === "browser" && host.screenStream && (
              <StreamVideo
                stream={host.screenStream}
                muted
                className="w-full h-full object-contain"
              />
            )}

            {/* Both mode: screen as main */}
            {mediaType === "both" && host.screenStream && (
              <StreamVideo
                stream={host.screenStream}
                muted
                className="w-full h-full object-contain"
              />
            )}

            {/* Both mode: camera PiP */}
            {mediaType === "both" && host.cameraStream && (
              <div className="absolute bottom-3 right-3 w-28 h-20 sm:w-36 sm:h-28 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl z-10">
                <StreamVideo
                  stream={host.cameraStream}
                  muted
                  mirror
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Browser + Camera: browser as main */}
            {mediaType === "browser_camera" && host.screenStream && (
              <StreamVideo
                stream={host.screenStream}
                muted
                className="w-full h-full object-contain"
              />
            )}

            {/* Browser + Camera: camera PiP */}
            {mediaType === "browser_camera" && host.cameraStream && (
              <div className="absolute bottom-3 right-3 w-28 h-20 sm:w-36 sm:h-28 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl z-10">
                <StreamVideo
                  stream={host.cameraStream}
                  muted
                  mirror
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </>
        ) : (
          <HostPreCapture mediaType={mediaType} host={host} />
        )}

        <LiveBadges mediaType={mediaType} />
      </div>
    );
  }

  // ── VIEWER VIEW ──
  return (
    <div
      className="relative w-full bg-black overflow-hidden flex-shrink-0"
      style={{ aspectRatio, maxHeight: "40vh" }}
    >
      {viewer.connected && viewer.remoteStream ? (
        <StreamVideo
          stream={viewer.remoteStream}
          className="w-full h-full object-contain"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="relative">
            <UserAvatar user={hostUser} size="lg" />
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-red-500 border-2 border-black">
              <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
            </span>
          </div>
          {viewer.connecting ? (
            <div className="flex items-center gap-2 text-white/50 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
              Connecting to stream...
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-white/50 text-xs">
                <IconRadio size={14} />
                <span>Waiting for host video...</span>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={viewer.connect}
                className="px-3 py-1.5 rounded-full bg-white/10 text-white/70 text-xs hover:bg-white/20 transition-colors"
              >
                Retry connection
              </motion.button>
            </div>
          )}
        </div>
      )}

      <LiveBadges mediaType={mediaType} />
    </div>
  );
}

// ─── Pinned Banner ───
function PinnedBanner({
  message,
  isHost,
  onUnpin,
}: {
  message: LiveMessage;
  isHost: boolean;
  onUnpin: () => void;
}) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="bg-foreground/5 border-b border-muted px-4 py-2"
    >
      <div className="flex items-start gap-2">
        <IconPin size={12} className="text-foreground/50 mt-1 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-semibold text-foreground/50 uppercase tracking-wider">
            Pinned
          </span>
          <p className="text-xs text-foreground truncate">{message.content}</p>
        </div>
        {isHost && (
          <button
            onClick={onUnpin}
            className="text-muted-foreground hover:text-foreground p-0.5 flex-shrink-0"
          >
            <IconX size={12} />
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Chat Message ───
function ChatMessage({
  message,
  isHost,
  isStreamHost,
  onPin,
}: {
  message: LiveMessage;
  isHost: boolean;
  isStreamHost: boolean;
  onPin: () => void;
}) {
  const [showActions, setShowActions] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group flex items-start gap-2 px-4 py-1.5 ${isHost ? "bg-foreground/[0.03]" : ""}`}
      onClick={() => isStreamHost && setShowActions(!showActions)}
    >
      <Link to={`/profile/${message.user?.username ?? "unknown"}`} className="flex-shrink-0 mt-0.5">
        <UserAvatar user={message.user} size="xs" />
      </Link>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold">
          {message.user?.display_name ?? "User"}
          {isHost && (
            <span className="ml-1 px-1 py-px rounded text-[9px] font-bold bg-red-500/10 text-red-500">
              HOST
            </span>
          )}
        </span>
        <span className="text-xs text-foreground ml-1.5">{message.content}</span>
      </div>
      <AnimatePresence>
        {showActions && isStreamHost && !message.is_pinned && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={(e) => {
              e.stopPropagation();
              onPin();
              setShowActions(false);
            }}
            className="flex-shrink-0 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <IconPin size={12} />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Stream Ended Overlay ───
function StreamEndedOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-20 flex items-center justify-center bg-background/90 backdrop-blur-sm"
    >
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
          <IconRadio size={24} className="text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold mb-1">Stream ended</p>
        <p className="text-xs text-muted-foreground mb-4">This live stream has ended.</p>
        <Button asChild size="lg">
          <Link to="/live">Browse live streams</Link>
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Main Page ───
export default function LiveStreamPage() {
  const { streamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const currentStream = useLiveStore((s) => s.currentStream);
  const messages = useLiveStore((s) => s.messages);
  const viewers = useLiveStore((s) => s.viewers);
  const fetchStream = useLiveStore((s) => s.fetchStream);
  const fetchMessages = useLiveStore((s) => s.fetchMessages);
  const fetchViewers = useLiveStore((s) => s.fetchViewers);
  const joinStream = useLiveStore((s) => s.joinStream);
  const sendMessage = useLiveStore((s) => s.sendMessage);
  const pinMessage = useLiveStore((s) => s.pinMessage);
  const unpinMessage = useLiveStore((s) => s.unpinMessage);
  const subscribeToStream = useLiveStore((s) => s.subscribeToStream);
  const unsubscribe = useLiveStore((s) => s.unsubscribe);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const deleteFetcher = useFetcher();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const isHost = currentStream?.user_id === user?.id;
  const isEnded = currentStream?.status === "ended";
  const pinnedMessage = messages.find((m) => m.is_pinned);
  const mediaType: MediaSourceType = (currentStream?.media_type as MediaSourceType) ?? "none";

  // Debug: log stream state
  useEffect(() => {
    console.log('[LiveStream] currentStream:', currentStream?.id, 'mediaType:', currentStream?.media_type, 'isHost:', currentStream?.user_id === user?.id);
  }, [currentStream, user?.id]);

  // WebRTC hooks
  const host = useWebRTCHost(streamId, user?.id, isHost);
  const viewer = useWebRTCViewer(
    streamId,
    user?.id,
    currentStream?.user_id,
  );

  // Host picks devices manually in the HostPreCapture panel — no auto-start

  // Mount: fetch data, join, subscribe
  useEffect(() => {
    if (!streamId || !user?.id) return;

    fetchStream(streamId);
    fetchMessages(streamId);
    fetchViewers(streamId);
    joinStream(streamId, user.id);
    subscribeToStream(streamId);

    return () => {
      unsubscribe();
    };
  }, [streamId, user?.id]);

  // Auto-scroll on new messages
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    if (isNearBottom) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  const handleSend = async () => {
    if (!input.trim() || !streamId || !user?.id || sending || isEnded) return;
    setSending(true);
    await sendMessage(streamId, user.id, input.trim());
    setInput("");
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Navigate away once the server delete action completes
  useEffect(() => {
    if (deleteFetcher.state === "idle" && (deleteFetcher.data as any)?.ok) {
      // Clean up client state then navigate
      unsubscribe();
      navigate("/live");
    }
  }, [deleteFetcher.state, deleteFetcher.data]);

  const handleEndStream = () => {
    if (!streamId || ending) return;
    setEnding(true);
    host.stopCapture();
    // Submit server action which deletes with service role key
    deleteFetcher.submit(
      { intent: "delete-stream" },
      { method: "post", action: `/live/${streamId}` },
    );
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto relative flex flex-col h-[calc(100vh-8rem)] lg:h-[calc(100vh-2rem)]">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-muted flex-shrink-0">
          <button
            onClick={() => navigate("/live")}
            className="p-1 -ml-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <IconArrowLeft size={20} />
          </button>
          {currentStream ? (
            <>
              {currentStream.user && (
                <Link to={`/profile/${currentStream.user.username}`} className="flex-shrink-0">
                  <UserAvatar user={currentStream.user} size="xs" />
                </Link>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold truncate">{currentStream.title}</p>
                  {!isEnded && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 text-[10px] font-bold flex-shrink-0">
                      <span className="relative w-1.5 h-1.5">
                        <span className="absolute inset-0 rounded-full bg-red-500" />
                        <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
                      </span>
                      LIVE
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>@{currentStream.user?.username ?? "..."}</span>
                  <span className="flex items-center gap-0.5">
                    <IconUsers size={12} />
                    {viewers.length}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center gap-2 animate-pulse">
              <div className="w-7 h-7 rounded-full bg-muted" />
              <div className="space-y-1">
                <div className="h-3 w-28 bg-muted rounded" />
                <div className="h-2 w-16 bg-muted rounded" />
              </div>
            </div>
          )}
          {/* End Stream button — always in header for host */}
          {isHost && !isEnded && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleEndStream}
              disabled={ending}
              className="px-3 py-1.5 rounded-full bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 flex-shrink-0"
            >
              {ending ? "Ending..." : "End Stream"}
            </motion.button>
          )}
        </div>

        {/* Video Player — always rendered, handles its own states */}
        <LiveVideoPlayer
          mediaType={mediaType}
          isHost={isHost}
          host={host}
          viewer={viewer}
          hostUser={currentStream?.user}
          currentStream={currentStream}
        />

        {/* Pinned message */}
        <AnimatePresence>
          {pinnedMessage && (
            <PinnedBanner
              message={pinnedMessage}
              isHost={isHost}
              onUnpin={() => unpinMessage(pinnedMessage.id)}
            />
          )}
        </AnimatePresence>

        {/* Chat messages */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto py-2">
          {messages.length === 0 && !isEnded && (
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
              No messages yet. Say hi!
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              isHost={msg.user_id === currentStream?.user_id}
              isStreamHost={isHost}
              onPin={() => pinMessage(msg.id)}
            />
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Chat Input */}
        {!isEnded && (
          <div className="px-4 py-3 border-t border-muted flex-shrink-0">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Send a message..."
                maxLength={500}
                className="flex-1 px-3 py-2 rounded-full bg-muted text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-foreground/20"
              />
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className="p-2 rounded-full bg-foreground text-background disabled:opacity-30 transition-opacity"
              >
                <IconSend size={16} />
              </motion.button>
            </div>
          </div>
        )}

        {/* Ended overlay */}
        <AnimatePresence>{isEnded && <StreamEndedOverlay />}</AnimatePresence>
      </div>
    </AppShell>
  );
}
