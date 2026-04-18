import type { Route } from "./+types/posts";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppShell } from "~/components/layout/app-shell";
import { PostCard, EmptyState } from "~/components/cards";
import { IconImage, IconX, IconCamera, IconPlay, IconEdit } from "~/components/icons";
import { useAuthStore } from "~/stores/auth-store";
import { usePostStore } from "~/stores/post-store";
import { useFollowStore } from "~/stores/follow-store";
import { fadeInUp } from "~/components/animations";
import { MediaEditorModal, applyEditsToImage, encodeVideoType, defaultEdit, type MediaEdit } from "~/components/media-editor";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Posts - Exotic" },
    { name: "description", content: "Share photos and videos on Exotic" },
  ];
}

const MAX_FILES = 4;
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

// Accepted image extensions
const IMAGE_EXTS = ['jpg','jpeg','png','gif','webp','heic','heif','avif','bmp','tiff','svg'];
// Accepted video extensions
const VIDEO_EXTS = ['mp4','mov','avi','mkv','webm','m4v','flv','wmv','3gp','ts','mts'];

function isMediaFile(file: File): 'image' | 'video' | null {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (IMAGE_EXTS.includes(ext)) return 'image';
  if (VIDEO_EXTS.includes(ext)) return 'video';
  return null;
}

function CreatePostForm({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuthStore();
  const { createPost } = usePostStore();
  const [caption, setCaption] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [edits, setEdits] = useState<MediaEdit[]>([]);
  const [previews, setPreviews] = useState<{ url: string; type: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    setError("");

    const valid = selected.filter((f) => {
      const kind = isMediaFile(f);
      if (!kind) { setError("Only images and videos are allowed."); return false; }
      if (f.size > MAX_FILE_SIZE) { setError("Files must be smaller than 200MB."); return false; }
      return true;
    });

    if (valid.length === 0) return;

    const newFiles = [...files, ...valid].slice(0, MAX_FILES);
    setFiles(newFiles);
    setEdits(newFiles.map((_, i) => edits[i] ?? defaultEdit()));

    const newPreviews: { url: string; type: string }[] = [];
    newFiles.forEach((f) => {
      const url = URL.createObjectURL(f);
      newPreviews.push({ url, type: isMediaFile(f) === 'video' ? 'video' : 'image' });
    });
    // revoke old blob URLs
    previews.forEach(p => URL.revokeObjectURL(p.url));
    setPreviews(newPreviews);

    if (fileInputRef.current) fileInputRef.current.value = "";

    // open editor immediately for new media
    setShowEditor(true);
  };

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previews[index].url);
    setFiles((f) => f.filter((_, i) => i !== index));
    setEdits((e) => e.filter((_, i) => i !== index));
    setPreviews((p) => p.filter((_, i) => i !== index));
  };

  const handleEditorDone = (newEdits: MediaEdit[]) => {
    setEdits(newEdits);
    setShowEditor(false);
  };

  const handleSubmit = async () => {
    if (!user?.id) return;
    if (files.length === 0 && !caption.trim()) {
      setError("Add a photo, video, or write something.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      // Apply image edits (bake into canvas blobs)
      const processedFiles: File[] = [];
      const mediaTypes: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const edit = edits[i] ?? defaultEdit();
        const kind = previews[i]?.type;
        if (kind === 'image') {
          const processed = await applyEditsToImage(f, edit);
          processedFiles.push(processed);
          mediaTypes.push('image');
        } else {
          processedFiles.push(f);
          mediaTypes.push(encodeVideoType(edit));
        }
      }
      await createPost(user.id, caption.trim(), processedFiles, mediaTypes);
      setCaption("");
      setFiles([]);
      setEdits([]);
      previews.forEach((p) => URL.revokeObjectURL(p.url));
      setPreviews([]);
      onCreated();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create post");
    }
    setSubmitting(false);
  };

  return (
    <>
      <AnimatePresence>
        {showEditor && (
          <MediaEditorModal
            files={files}
            previews={previews}
            onDone={handleEditorDone}
            onCancel={() => setShowEditor(false)}
          />
        )}
      </AnimatePresence>

      <motion.div className="px-4 py-4 border-b border-muted" {...fadeInUp}>
        <h2 className="text-sm font-bold mb-3">Create Post</h2>

        {/* Media previews */}
        {previews.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            {previews.map((preview, i) => (
              <div key={i} className="relative rounded-lg overflow-hidden bg-muted aspect-square">
                {preview.type === "video" ? (
                  <video src={preview.url} className="w-full h-full object-cover" muted />
                ) : (
                  <img src={preview.url} alt="" className="w-full h-full object-cover" />
                )}
                <button
                  onClick={() => removeFile(i)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                >
                  <IconX size={14} />
                </button>
                {preview.type === "video" && (
                  <div className="absolute bottom-1.5 left-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center">
                    <IconPlay size={10} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Caption */}
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Write a caption..."
          className="w-full resize-none rounded-2xl bg-muted/50 p-4 text-sm placeholder:text-muted-foreground focus:outline-none min-h-[80px] mb-3"
          maxLength={2000}
        />

        {error && <p className="text-sm text-destructive mb-3">{error}</p>}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,.heic,.heif,.avif,.mkv,.mov,.avi,.wmv,.flv,.m4v"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => fileInputRef.current?.click()}
              disabled={files.length >= MAX_FILES}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              <IconCamera size={16} />
              Add media
            </motion.button>
            {files.length > 0 && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowEditor(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <IconEdit size={16} />
                Edit
              </motion.button>
            )}
            <span className="text-xs text-muted-foreground">{files.length}/{MAX_FILES}</span>
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleSubmit}
            disabled={submitting || (files.length === 0 && !caption.trim())}
            className="px-5 py-2 text-sm font-medium rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {submitting ? (
              <motion.div
                className="w-4 h-4 border-2 border-background border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
              />
            ) : (
              "Post"
            )}
          </motion.button>
        </div>
      </motion.div>
    </>
  );
}

export default function PostsPage() {
  const { user } = useAuthStore();
  const { posts, isLoading, fetchPosts, checkLikes, subscribeRealtime, unsubscribe } = usePostStore();
  const { following, fetchFollowing } = useFollowStore();

  useEffect(() => {
    if (!user?.id) return;
    fetchFollowing(user.id).then(() => {
      const followedIds = Array.from(useFollowStore.getState().following);
      fetchPosts(followedIds.length > 0 ? [...followedIds, user.id] : undefined).then(() => {
        checkLikes(user.id);
      });
    });
    subscribeRealtime();
    return () => unsubscribe();
  }, [user?.id]);

  const handleRefresh = () => {
    if (!user?.id) return;
    const followedIds = Array.from(following);
    fetchPosts(followedIds.length > 0 ? [...followedIds, user.id] : undefined).then(() => {
      checkLikes(user.id);
    });
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        <div className="px-4 py-4">
          <h1 className="text-xl font-bold">Posts</h1>
        </div>

        <CreatePostForm onCreated={handleRefresh} />

        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-px"
            >
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4 animate-pulse">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-muted rounded-full" />
                    <div className="h-3 w-24 bg-muted rounded" />
                  </div>
                  <div className="aspect-square bg-muted rounded-lg mb-3" />
                  <div className="h-3 w-3/4 bg-muted rounded" />
                </div>
              ))}
            </motion.div>
          ) : posts.length === 0 ? (
            <EmptyState
              icon={IconImage}
              title="No posts yet"
              description="Create your first post by uploading a photo or video above."
            />
          ) : (
            <motion.div
              key="posts"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="divide-y divide-muted/50"
            >
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}
