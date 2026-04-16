import type { Route } from "./+types/live.$streamId";
import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { AppShell } from "~/components/layout/app-shell";
import { UserAvatar } from "~/components/user-avatar";
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
} from "~/components/icons";
import { useLiveStore } from "~/stores/live-store";
import { useAuthStore } from "~/stores/auth-store";
import { useWebRTCHost, useWebRTCViewer } from "~/hooks/use-webrtc";
import type { LiveMessage, MediaSourceType } from "~/types";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Live Stream - Exotic" }];
}

// ─── Video element that attaches a MediaStream ───
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

// ─── Host Video Display ───
function HostVideoDisplay({
  mediaType,
  host,
}: {
  mediaType: MediaSourceType;
  host: ReturnType<typeof useWebRTCHost>;
}) {
  if (mediaType === "none") return null;

  const hasCapture = !!host.localStream && host.localStream.getTracks().length > 0;

  return (
    <div
      className="relative w-full bg-black/95 overflow-hidden"
      style={{ aspectRatio: mediaType === "camera" ? "4/3" : "16/9", maxHeight: "40vh" }}
    >
      {/* Screen share or single camera (main view) */}
      {hasCapture && (mediaType === "screen" || mediaType === "camera") && (
        <StreamVideo
          stream={host.localStream}
          muted
          mirror={mediaType === "camera"}
          className="w-full h-full object-contain"
        />
      )}

      {/* Both mode: screen as main */}
      {hasCapture && mediaType === "both" && host.screenStream && (
        <StreamVideo
          stream={host.screenStream}
          muted
          className="w-full h-full object-contain"
        />
      )}

      {/* Both mode: camera PiP */}
      {hasCapture && mediaType === "both" && host.cameraStream && (
        <div className="absolute bottom-3 right-3 w-28 h-20 sm:w-36 sm:h-28 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl">
          <StreamVideo
            stream={host.cameraStream}
            muted
            mirror
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* No capture — start button */}
      {!hasCapture && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
            {mediaType === "screen" && <IconMonitor size={28} className="text-white/60" />}
            {mediaType === "camera" && <IconVideo size={28} className="text-white/60" />}
            {mediaType === "both" && <IconLayers size={28} className="text-white/60" />}
          </div>
          {host.error ? (
            <p className="text-xs text-red-400 text-center px-4">{host.error}</p>
          ) : host.capturing ? (
            <p className="text-xs text-white/50">Starting capture...</p>
          ) : (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => host.startCapture(mediaType)}
              className="px-4 py-2 rounded-full bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition-colors"
            >
              Start{" "}
              {mediaType === "both"
                ? "Screen & Camera"
                : mediaType === "screen"
                ? "Screen Share"
                : "Camera"}
            </motion.button>
          )}
        </div>
      )}

      <Badges mediaType={mediaType} />
    </div>
  );
}

// ─── Viewer Video Display ───
function ViewerVideoDisplay({
  mediaType,
  viewer,
  hostUser,
}: {
  mediaType: MediaSourceType;
  viewer: ReturnType<typeof useWebRTCViewer>;
  hostUser: any;
}) {
  if (mediaType === "none") return null;

  return (
    <div
      className="relative w-full bg-black/95 overflow-hidden"
      style={{ aspectRatio: mediaType === "camera" ? "4/3" : "16/9", maxHeight: "40vh" }}
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

      <Badges mediaType={mediaType} />
    </div>
  );
}

// ─── Shared badges ───
function Badges({ mediaType }: { mediaType: MediaSourceType }) {
  return (
    <>
      <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-500/90 text-white text-[10px] font-bold">
        <span className="relative w-1.5 h-1.5">
          <span className="absolute inset-0 rounded-full bg-white" />
          <span className="absolute inset-0 rounded-full bg-white animate-ping opacity-75" />
        </span>
        LIVE
      </div>
      <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md bg-black/50 text-white/70 text-[10px]">
        {mediaType === "screen" && <><IconMonitor size={10} /> Screen</>}
        {mediaType === "camera" && <><IconVideo size={10} /> Camera</>}
        {mediaType === "both" && <><IconLayers size={10} /> Both</>}
      </div>
    </>
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
      className="absolute inset-0 z-10 flex items-center justify-center bg-background/90 backdrop-blur-sm"
    >
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
          <IconRadio size={24} className="text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold mb-1">Stream ended</p>
        <p className="text-xs text-muted-foreground mb-4">This live stream has ended.</p>
        <Link
          to="/live"
          className="inline-flex px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Browse live streams
        </Link>
      </div>
    </motion.div>
  );
}

// ─── Main Page ───
export default function LiveStreamPage() {
  const { streamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    currentStream,
    messages,
    viewers,
    fetchStream,
    fetchMessages,
    fetchViewers,
    joinStream,
    sendMessage,
    pinMessage,
    unpinMessage,
    endStream,
    subscribeToStream,
    unsubscribe,
  } = useLiveStore();

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const isHost = currentStream?.user_id === user?.id;
  const isEnded = currentStream?.status === "ended";
  const pinnedMessage = messages.find((m) => m.is_pinned);
  const mediaType: MediaSourceType = (currentStream?.media_type as MediaSourceType) ?? "none";

  // WebRTC hooks — enabled based on host/viewer role
  const host = useWebRTCHost(streamId, user?.id, isHost);
  const viewer = useWebRTCViewer(
    streamId,
    user?.id,
    currentStream?.user_id,
  );

  // Auto-start capture for host when stream loads
  useEffect(() => {
    if (isHost && mediaType !== "none" && currentStream && !host.localStream && !host.capturing) {
      host.startCapture(mediaType);
    }
  }, [isHost, mediaType, currentStream?.id]);

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

  const handleEndStream = async () => {
    if (!streamId || ending) return;
    setEnding(true);
    host.stopCapture();
    await endStream(streamId);
    setEnding(false);
    navigate("/live");
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto relative flex flex-col h-[calc(100vh-8rem)] lg:h-[calc(100vh-2rem)]">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-muted">
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
                  <p className="text-sm font-semibold truncate">
                    {currentStream.title}
                  </p>
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
          {/* End Stream — always visible for host, outside the loading conditional */}
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

        {/* Video display — show for any media type, regardless of host/viewer */}
        {mediaType !== "none" && (
          isHost ? (
            <HostVideoDisplay mediaType={mediaType} host={host} />
          ) : (
            <ViewerVideoDisplay
              mediaType={mediaType}
              viewer={viewer}
              hostUser={currentStream?.user}
            />
          )
        )}

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

        {/* Input */}
        {!isEnded && (
          <div className="px-4 py-3 border-t border-muted">
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
