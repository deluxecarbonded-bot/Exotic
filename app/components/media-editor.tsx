import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconX, IconCheck, IconCrop, IconSliders, IconZoomIn, IconChevronLeft, IconChevronRight } from '~/components/icons';

// ─── Filter presets ────────────────────────────────────────────────────────────
export const FILTER_PRESETS = [
  { name: 'Normal',   value: 'none' },
  { name: 'Vivid',    value: 'contrast(1.2) saturate(1.6) brightness(1.05)' },
  { name: 'Warm',     value: 'sepia(0.25) saturate(1.4) brightness(1.05) hue-rotate(-5deg)' },
  { name: 'Cool',     value: 'saturate(0.85) brightness(1.05) hue-rotate(20deg)' },
  { name: 'Vintage',  value: 'sepia(0.45) contrast(0.9) brightness(1.1) saturate(1.2)' },
  { name: 'Fade',     value: 'brightness(1.15) contrast(0.8) saturate(0.75)' },
  { name: 'B&W',      value: 'grayscale(1)' },
  { name: 'Drama',    value: 'contrast(1.45) brightness(0.88) saturate(1.4)' },
];

export type MediaEdit = {
  filter: string;       // CSS filter string
  zoom: number;         // 1.0 – 3.0
  crop: { x: number; y: number; w: number; h: number } | null; // normalized 0–1
};

export function defaultEdit(): MediaEdit {
  return { filter: 'none', zoom: 1, crop: null };
}

// ─── Canvas apply ──────────────────────────────────────────────────────────────
export async function applyEditsToImage(file: File, edit: MediaEdit): Promise<File> {
  if (edit.filter === 'none' && edit.zoom === 1 && !edit.crop) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      const crop = edit.crop ?? { x: 0, y: 0, w: 1, h: 1 };
      // crop region in natural pixels
      const rx = crop.x * img.naturalWidth;
      const ry = crop.y * img.naturalHeight;
      const rw = crop.w * img.naturalWidth;
      const rh = crop.h * img.naturalHeight;
      // apply zoom (zoom in = show smaller region)
      const srcW = rw / edit.zoom;
      const srcH = rh / edit.zoom;
      const srcX = rx + (rw - srcW) / 2;
      const srcY = ry + (rh - srcH) / 2;

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(srcW);
      canvas.height = Math.round(srcH);
      const ctx = canvas.getContext('2d')!;
      if (edit.filter !== 'none') ctx.filter = edit.filter;
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(blobUrl);
      canvas.toBlob(
        (blob) => resolve(new File([blob!], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })),
        'image/jpeg', 0.93
      );
    };
    img.src = blobUrl;
  });
}

// ─── Encode video edit into media_type string ──────────────────────────────────
export function encodeVideoType(edit: MediaEdit): string {
  if (edit.filter === 'none' && edit.zoom === 1) return 'video';
  return `video|${edit.filter}|${edit.zoom}`;
}

export function parseMediaType(raw: string): { isVideo: boolean; filter: string; zoom: number } {
  const parts = raw.split('|');
  const isVideo = parts[0] === 'video';
  const filter = parts[1] ?? 'none';
  const zoom = parseFloat(parts[2] ?? '1') || 1;
  return { isVideo, filter, zoom };
}

// ─── Crop handle ───────────────────────────────────────────────────────────────
type Handle = 'tl' | 'tr' | 'bl' | 'br';

function CropOverlay({
  crop,
  onChange,
}: {
  crop: { x: number; y: number; w: number; h: number };
  onChange: (c: { x: number; y: number; w: number; h: number }) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ handle: Handle | 'move'; startX: number; startY: number; startCrop: typeof crop } | null>(null);

  const clamp = (v: number) => Math.max(0, Math.min(1, v));

  const onPointerDown = (handle: Handle | 'move', e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = { handle, startX: e.clientX, startY: e.clientY, startCrop: { ...crop } };
  };

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = (e.clientX - dragging.current.startX) / rect.width;
    const dy = (e.clientY - dragging.current.startY) / rect.height;
    const sc = dragging.current.startCrop;
    const MIN = 0.1;

    let next = { ...sc };
    switch (dragging.current.handle) {
      case 'tl':
        next.x = clamp(sc.x + dx); next.y = clamp(sc.y + dy);
        next.w = clamp(sc.w - dx); next.h = clamp(sc.h - dy);
        break;
      case 'tr':
        next.y = clamp(sc.y + dy); next.w = clamp(sc.w + dx); next.h = clamp(sc.h - dy);
        break;
      case 'bl':
        next.x = clamp(sc.x + dx); next.w = clamp(sc.w - dx); next.h = clamp(sc.h + dy);
        break;
      case 'br':
        next.w = clamp(sc.w + dx); next.h = clamp(sc.h + dy);
        break;
      case 'move':
        next.x = clamp(sc.x + dx); next.y = clamp(sc.y + dy);
        // keep within bounds
        if (next.x + next.w > 1) next.x = 1 - next.w;
        if (next.y + next.h > 1) next.y = 1 - next.h;
        break;
    }
    // enforce minimum size
    if (next.w < MIN) { next.w = MIN; if (dragging.current.handle === 'tl' || dragging.current.handle === 'bl') next.x = sc.x + sc.w - MIN; }
    if (next.h < MIN) { next.h = MIN; if (dragging.current.handle === 'tl' || dragging.current.handle === 'tr') next.y = sc.y + sc.h - MIN; }
    onChange(next);
  }, [onChange]);

  const onPointerUp = useCallback(() => { dragging.current = null; }, []);

  useEffect(() => {
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  const left = `${crop.x * 100}%`;
  const top = `${crop.y * 100}%`;
  const width = `${crop.w * 100}%`;
  const height = `${crop.h * 100}%`;

  return (
    <div ref={containerRef} className="absolute inset-0">
      {/* Dark overlay outside crop */}
      <div className="absolute inset-0 pointer-events-none">
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: `${crop.y * 100}%`, background: 'rgba(0,0,0,0.6)' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${(1 - crop.y - crop.h) * 100}%`, background: 'rgba(0,0,0,0.6)' }} />
        <div style={{ position: 'absolute', top: `${crop.y * 100}%`, left: 0, width: `${crop.x * 100}%`, height: `${crop.h * 100}%`, background: 'rgba(0,0,0,0.6)' }} />
        <div style={{ position: 'absolute', top: `${crop.y * 100}%`, right: 0, width: `${(1 - crop.x - crop.w) * 100}%`, height: `${crop.h * 100}%`, background: 'rgba(0,0,0,0.6)' }} />
      </div>
      {/* Crop box */}
      <div
        style={{ position: 'absolute', left, top, width, height, border: '1.5px solid rgba(255,255,255,0.9)', boxSizing: 'border-box', cursor: 'move' }}
        onPointerDown={(e) => onPointerDown('move', e)}
      >
        {/* Grid lines */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', left: '33.3%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.3)' }} />
          <div style={{ position: 'absolute', left: '66.6%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.3)' }} />
          <div style={{ position: 'absolute', top: '33.3%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.3)' }} />
          <div style={{ position: 'absolute', top: '66.6%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.3)' }} />
        </div>
        {/* Corner handles */}
        {(['tl', 'tr', 'bl', 'br'] as Handle[]).map((h) => (
          <div
            key={h}
            onPointerDown={(e) => onPointerDown(h, e)}
            style={{
              position: 'absolute',
              width: 22, height: 22,
              background: 'white',
              borderRadius: 3,
              cursor: 'nwse-resize',
              ...(h === 'tl' ? { top: -6, left: -6 } : {}),
              ...(h === 'tr' ? { top: -6, right: -6 } : {}),
              ...(h === 'bl' ? { bottom: -6, left: -6 } : {}),
              ...(h === 'br' ? { bottom: -6, right: -6 } : {}),
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Aspect ratio presets ──────────────────────────────────────────────────────
const ASPECT_PRESETS = [
  { label: 'Free', ratio: null },
  { label: '1:1', ratio: 1 },
  { label: '4:5', ratio: 4 / 5 },
  { label: '16:9', ratio: 16 / 9 },
  { label: '9:16', ratio: 9 / 16 },
];

// ─── Main editor modal ─────────────────────────────────────────────────────────
type Tab = 'crop' | 'zoom' | 'filter';

export function MediaEditorModal({
  files,
  previews,
  onDone,
  onCancel,
}: {
  files: File[];
  previews: { url: string; type: string }[];
  onDone: (edits: MediaEdit[]) => void;
  onCancel: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [edits, setEdits] = useState<MediaEdit[]>(() => files.map(() => defaultEdit()));
  const [tab, setTab] = useState<Tab>('filter');
  const [aspectPreset, setAspectPreset] = useState<number | null>(null);

  const current = previews[activeIndex];
  const isImage = current?.type === 'image';
  const edit = edits[activeIndex];

  const updateEdit = (patch: Partial<MediaEdit>) => {
    setEdits((prev) => prev.map((e, i) => (i === activeIndex ? { ...e, ...patch } : e)));
  };

  const handleAspect = (ratio: number | null) => {
    setAspectPreset(ratio);
    if (!ratio) return;
    const c = edit.crop ?? { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
    // enforce aspect ratio from center
    const cx = c.x + c.w / 2;
    const cy = c.y + c.h / 2;
    let w = c.w;
    let h = w / ratio;
    if (h > 1) { h = 1; w = h * ratio; }
    if (w > 1) { w = 1; h = w / ratio; }
    const x = Math.max(0, cx - w / 2);
    const y = Math.max(0, cy - h / 2);
    updateEdit({ crop: { x, y, w: Math.min(w, 1 - x), h: Math.min(h, 1 - y) } });
  };

  const ensureCrop = () => {
    if (!edit.crop) updateEdit({ crop: { x: 0.05, y: 0.05, w: 0.9, h: 0.9 } });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-black"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <button onClick={onCancel} className="p-1.5 text-white/70 hover:text-white">
          <IconX size={20} />
        </button>
        <span className="text-sm font-semibold text-white">Edit Media</span>
        <button
          onClick={() => onDone(edits)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black text-sm font-semibold rounded-full"
        >
          <IconCheck size={14} />
          Done
        </button>
      </div>

      {/* File picker dots */}
      {files.length > 1 && (
        <div className="flex items-center justify-center gap-2 pb-2">
          {files.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`w-2 h-2 rounded-full transition-colors ${i === activeIndex ? 'bg-white' : 'bg-white/35'}`}
            />
          ))}
        </div>
      )}

      {/* Media preview */}
      <div className="flex-1 relative flex items-center justify-center min-h-0 mx-4">
        <div className="relative w-full h-full flex items-center justify-center">
          {current?.type === 'video' ? (
            <video
              src={current.url}
              className="max-w-full max-h-full rounded-lg object-contain"
              style={{
                filter: edit.filter !== 'none' ? edit.filter : undefined,
                transform: edit.zoom !== 1 ? `scale(${edit.zoom})` : undefined,
              }}
              muted
              loop
              autoPlay
            />
          ) : (
            <div className="relative max-w-full max-h-full w-full h-full flex items-center justify-center">
              <img
                src={current?.url}
                alt=""
                className="max-w-full max-h-full rounded-lg object-contain select-none"
                style={{
                  filter: edit.filter !== 'none' ? edit.filter : undefined,
                  transform: edit.zoom !== 1 ? `scale(${edit.zoom})` : undefined,
                  transition: 'filter 0.2s, transform 0.2s',
                }}
                draggable={false}
              />
              {/* Crop overlay — only shown on crop tab */}
              {tab === 'crop' && isImage && edit.crop && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="relative"
                    style={{
                      width: '100%', height: '100%',
                      backgroundImage: `url(${current?.url})`,
                      backgroundSize: 'contain',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'center',
                    }}
                  >
                    <CropOverlay
                      crop={edit.crop}
                      onChange={(c) => updateEdit({ crop: c })}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Nav arrows for multiple files */}
      {files.length > 1 && (
        <>
          {activeIndex > 0 && (
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center"
              onClick={() => setActiveIndex(i => i - 1)}
            >
              <IconChevronLeft size={16} />
            </button>
          )}
          {activeIndex < files.length - 1 && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center"
              onClick={() => setActiveIndex(i => i + 1)}
            >
              <IconChevronRight size={16} />
            </button>
          )}
        </>
      )}

      {/* Tool panel */}
      <div className="flex-shrink-0 bg-black border-t border-white/10">
        {/* Tab bar */}
        <div className="flex items-center justify-center gap-6 pt-3 pb-2">
          {isImage && (
            <button
              className={`flex flex-col items-center gap-0.5 text-xs transition-colors ${tab === 'crop' ? 'text-white' : 'text-white/40'}`}
              onClick={() => { setTab('crop'); ensureCrop(); }}
            >
              <IconCrop size={18} />
              Crop
            </button>
          )}
          <button
            className={`flex flex-col items-center gap-0.5 text-xs transition-colors ${tab === 'zoom' ? 'text-white' : 'text-white/40'}`}
            onClick={() => setTab('zoom')}
          >
            <IconZoomIn size={18} />
            Zoom
          </button>
          <button
            className={`flex flex-col items-center gap-0.5 text-xs transition-colors ${tab === 'filter' ? 'text-white' : 'text-white/40'}`}
            onClick={() => setTab('filter')}
          >
            <IconSliders size={18} />
            Filter
          </button>
        </div>

        {/* Crop tab */}
        <AnimatePresence mode="wait">
          {tab === 'crop' && isImage && (
            <motion.div
              key="crop"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="pb-6 px-4"
            >
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {ASPECT_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => handleAspect(p.ratio)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${aspectPreset === p.ratio ? 'bg-white text-black' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                  >
                    {p.label}
                  </button>
                ))}
                {edit.crop && (
                  <button
                    onClick={() => { updateEdit({ crop: null }); setAspectPreset(null); }}
                    className="px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-white/50 hover:bg-white/20"
                  >
                    Reset
                  </button>
                )}
              </div>
              {!edit.crop && (
                <p className="text-center text-xs text-white/40 mt-2">Tap an aspect ratio to enable crop</p>
              )}
            </motion.div>
          )}

          {/* Zoom tab */}
          {tab === 'zoom' && (
            <motion.div
              key="zoom"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="pb-6 px-6"
            >
              <div className="flex items-center gap-3">
                <span className="text-white/50 text-xs w-6">1×</span>
                <input
                  type="range"
                  min={1} max={3} step={0.05}
                  value={edit.zoom}
                  onChange={(e) => updateEdit({ zoom: parseFloat(e.target.value) })}
                  className="flex-1 accent-white h-1"
                />
                <span className="text-white/50 text-xs w-6">3×</span>
                <span className="text-white text-xs font-medium w-10 text-right">{edit.zoom.toFixed(2)}×</span>
              </div>
              {edit.zoom !== 1 && (
                <button
                  onClick={() => updateEdit({ zoom: 1 })}
                  className="mt-2 mx-auto block text-xs text-white/40 hover:text-white/70"
                >
                  Reset
                </button>
              )}
            </motion.div>
          )}

          {/* Filter tab */}
          {tab === 'filter' && (
            <motion.div
              key="filter"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="pb-5"
            >
              <div className="overflow-x-auto">
                <div className="flex gap-3 px-4 py-1" style={{ width: 'max-content' }}>
                  {FILTER_PRESETS.map((f) => (
                    <button
                      key={f.name}
                      onClick={() => updateEdit({ filter: f.value })}
                      className="flex flex-col items-center gap-1.5"
                    >
                      <div
                        className={`rounded-xl overflow-hidden transition-all ${edit.filter === f.value ? 'ring-2 ring-white scale-105' : 'ring-1 ring-white/10'}`}
                        style={{ width: 64, height: 64 }}
                      >
                        {current?.type === 'video' ? (
                          <video
                            src={current.url}
                            className="w-full h-full object-cover"
                            style={{ filter: f.value !== 'none' ? f.value : undefined }}
                            muted
                          />
                        ) : (
                          <img
                            src={current?.url}
                            alt={f.name}
                            className="w-full h-full object-cover"
                            style={{ filter: f.value !== 'none' ? f.value : undefined }}
                            draggable={false}
                          />
                        )}
                      </div>
                      <span className={`text-[10px] ${edit.filter === f.value ? 'text-white font-semibold' : 'text-white/50'}`}>
                        {f.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
