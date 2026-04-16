import { useRef, useState, useEffect, useCallback } from 'react';

function formatTime(s: number) {
  if (isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ── Icons ───────────────────────────────────────────────────
const IPlay = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
    <polygon points="5,3 19,12 5,21" />
  </svg>
);
const IPause = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
    <rect x="5" y="3" width="4" height="18" rx="1" />
    <rect x="15" y="3" width="4" height="18" rx="1" />
  </svg>
);
const IVolume = ({ muted, level }: { muted: boolean; level: number }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" />
    {muted || level === 0 ? (
      <>
        <line x1="23" y1="9" x2="17" y2="15" />
        <line x1="17" y1="9" x2="23" y2="15" />
      </>
    ) : level < 0.5 ? (
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    ) : (
      <>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      </>
    )}
  </svg>
);
const IFullscreen = ({ active }: { active: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    {active ? (
      <>
        <path d="M8 3v3a2 2 0 0 1-2 2H3" />
        <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
        <path d="M3 16h3a2 2 0 0 1 2 2v3" />
        <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
      </>
    ) : (
      <>
        <path d="M8 3H5a2 2 0 0 0-2 2v3" />
        <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
        <path d="M3 16v3a2 2 0 0 0 2 2h3" />
        <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
      </>
    )}
  </svg>
);
const IDownload = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);
const IReplay10 = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
    <text x="8.5" y="16.5" fontSize="5.5" fill="currentColor" fontFamily="sans-serif" fontWeight="bold">10</text>
  </svg>
);
const IForward10 = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M18.92 13c0 3.31-2.69 6-6 6-3.32 0-6-2.69-6-6s2.68-6 6-6v4l5-5-5-5v4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8h-2z"/>
    <text x="7.5" y="16.5" fontSize="5.5" fill="currentColor" fontFamily="sans-serif" fontWeight="bold">10</text>
  </svg>
);

// ── Player ──────────────────────────────────────────────────
function VideoPlayer({ src }: { src: string }) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const wrapRef    = useRef<HTMLDivElement>(null);
  const seekRef    = useRef<HTMLDivElement>(null);
  const volRef     = useRef<HTMLDivElement>(null);
  const hideTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [playing,    setPlaying]    = useState(false);
  const [muted,      setMuted]      = useState(false);
  const [volume,     setVolume]     = useState(1);
  const [current,    setCurrent]    = useState(0);
  const [duration,   setDuration]   = useState(0);
  const [buffered,   setBuffered]   = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [showCtrl,   setShowCtrl]   = useState(true);
  const [dragging,   setDragging]   = useState<'seek'|'vol'|null>(null);
  const [waiting,    setWaiting]    = useState(false);
  const [ended,      setEnded]      = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const res  = await fetch(src);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'exotic_showcase.mp4';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }, [src, downloading]);

  // Auto-hide controls
  const resetHide = useCallback(() => {
    setShowCtrl(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (playing) setShowCtrl(false);
    }, 2800);
  }, [playing]);

  useEffect(() => { resetHide(); }, [playing]);

  // Sync video events
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime   = () => { setCurrent(v.currentTime); updateBuffered(); };
    const onMeta   = () => setDuration(v.duration);
    const onPlay   = () => { setPlaying(true);  setEnded(false); };
    const onPause  = () => setPlaying(false);
    const onEnd    = () => { setPlaying(false); setEnded(true); setShowCtrl(true); };
    const onWait   = () => setWaiting(true);
    const onCanPlay= () => setWaiting(false);
    const onFS     = () => setFullscreen(!!document.fullscreenElement);
    v.addEventListener('timeupdate',     onTime);
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('play',           onPlay);
    v.addEventListener('pause',          onPause);
    v.addEventListener('ended',          onEnd);
    v.addEventListener('waiting',        onWait);
    v.addEventListener('canplay',        onCanPlay);
    document.addEventListener('fullscreenchange', onFS);
    return () => {
      v.removeEventListener('timeupdate',     onTime);
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('play',           onPlay);
      v.removeEventListener('pause',          onPause);
      v.removeEventListener('ended',          onEnd);
      v.removeEventListener('waiting',        onWait);
      v.removeEventListener('canplay',        onCanPlay);
      document.removeEventListener('fullscreenchange', onFS);
    };
  }, []);

  function updateBuffered() {
    const v = videoRef.current;
    if (!v || !v.buffered.length) return;
    setBuffered(v.buffered.end(v.buffered.length - 1));
  }

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const v = videoRef.current;
      if (!v) return;
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); togglePlay(); }
      if (e.key === 'ArrowRight') { v.currentTime = Math.min(v.currentTime+10, v.duration); }
      if (e.key === 'ArrowLeft')  { v.currentTime = Math.max(v.currentTime-10, 0); }
      if (e.key === 'm') toggleMute();
      if (e.key === 'f') toggleFullscreen();
      resetHide();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing, muted]);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (ended) { v.currentTime = 0; v.play(); return; }
    v.paused ? v.play() : v.pause();
    resetHide();
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  function toggleFullscreen() {
    const el = wrapRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.() ||
      (el as any).webkitRequestFullscreen?.() ||
      (el as any).mozRequestFullScreen?.();
    } else {
      document.exitFullscreen?.() ||
      (document as any).webkitExitFullscreen?.() ||
      (document as any).mozCancelFullScreen?.();
    }
  }

  // Seek bar interaction
  function seekFromEvent(e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) {
    const bar = seekRef.current;
    const v   = videoRef.current;
    if (!bar || !v || !duration) return;
    const rect = bar.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    v.currentTime = frac * duration;
    setCurrent(frac * duration);
  }

  function volFromEvent(e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) {
    const bar = volRef.current;
    const v   = videoRef.current;
    if (!bar || !v) return;
    const rect = bar.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    v.volume = frac;
    setVolume(frac);
    if (frac === 0) { v.muted = true; setMuted(true); }
    else { v.muted = false; setMuted(false); }
  }

  // Global mouse/touch drag
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (dragging === 'seek') seekFromEvent(e);
      if (dragging === 'vol')  volFromEvent(e);
    };
    const onUp = () => setDragging(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove',  onMove, { passive: true });
    window.addEventListener('mouseup',   onUp);
    window.addEventListener('touchend',  onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove',  onMove);
      window.removeEventListener('mouseup',   onUp);
      window.removeEventListener('touchend',  onUp);
    };
  }, [dragging, duration]);

  const seekPct    = duration ? (current  / duration) * 100 : 0;
  const bufferPct  = duration ? (buffered / duration) * 100 : 0;
  const volPct     = muted ? 0 : volume * 100;

  return (
    <div
      ref={wrapRef}
      onMouseMove={resetHide}
      onTouchStart={resetHide}
      style={{ position: 'relative', background: '#000', borderRadius: fullscreen ? 0 : 16,
               overflow: 'hidden', width: '100%', aspectRatio: '16/9',
               cursor: showCtrl ? 'default' : 'none' }}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        src={src}
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        playsInline
        preload="metadata"
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }}
      />

      {/* Spinner */}
      {waiting && (
        <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none' }}>
          <div style={{ width:48,height:48,border:'3px solid rgba(255,255,255,0.15)',borderTop:'3px solid #ef4444',borderRadius:'50%',animation:'spin 0.8s linear infinite' }} />
        </div>
      )}

      {/* Big play/replay overlay */}
      {!playing && !waiting && (
        <div
          onClick={togglePlay}
          style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',
                   background:'rgba(0,0,0,0.28)',cursor:'pointer' }}
        >
          <div style={{ width:72,height:72,borderRadius:'50%',background:'rgba(239,68,68,0.92)',
                        display:'flex',alignItems:'center',justifyContent:'center',
                        boxShadow:'0 0 0 12px rgba(239,68,68,0.18)',
                        transform:'scale(1)',transition:'transform 0.15s' }}>
            {ended
              ? <svg viewBox="0 0 24 24" fill="white" width="28" height="28"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H5c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
              : <svg viewBox="0 0 24 24" fill="white" width="28" height="28"><polygon points="6,3 20,12 6,21"/></svg>
            }
          </div>
        </div>
      )}

      {/* Controls overlay */}
      <div style={{
        position:'absolute',bottom:0,left:0,right:0,
        background:'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
        padding:'32px 16px 14px',
        transition:'opacity 0.3s',
        opacity: showCtrl ? 1 : 0,
        pointerEvents: showCtrl ? 'auto' : 'none',
      }}>
        {/* Seek bar */}
        <div
          ref={seekRef}
          onMouseDown={(e) => { seekFromEvent(e); setDragging('seek'); }}
          onTouchStart={(e) => { seekFromEvent(e); setDragging('seek'); }}
          style={{ position:'relative',height:16,cursor:'pointer',marginBottom:10,display:'flex',alignItems:'center' }}
        >
          {/* Track */}
          <div style={{ position:'absolute',left:0,right:0,height:4,borderRadius:2,background:'rgba(255,255,255,0.18)' }} />
          {/* Buffered */}
          <div style={{ position:'absolute',left:0,width:`${bufferPct}%`,height:4,borderRadius:2,background:'rgba(255,255,255,0.28)' }} />
          {/* Progress */}
          <div style={{ position:'absolute',left:0,width:`${seekPct}%`,height:4,borderRadius:2,background:'#ef4444' }} />
          {/* Thumb */}
          <div style={{
            position:'absolute',left:`calc(${seekPct}% - 7px)`,
            width:14,height:14,borderRadius:'50%',background:'#ef4444',
            boxShadow:'0 0 0 3px rgba(239,68,68,0.3)',
            transition: dragging==='seek' ? 'none':'transform 0.1s',
            transform: dragging==='seek' ? 'scale(1.3)':'scale(1)',
          }} />
        </div>

        {/* Bottom row */}
        <div style={{ display:'flex',alignItems:'center',gap:6 }}>
          {/* Skip back */}
          <button onClick={() => { const v=videoRef.current; if(v) v.currentTime=Math.max(0,v.currentTime-10); }}
            style={btnStyle}>
            <IReplay10 />
          </button>

          {/* Play/Pause */}
          <button onClick={togglePlay} style={{ ...btnStyle, width:44,height:44,
            background:'rgba(239,68,68,0.85)',borderRadius:'50%',
            boxShadow:'0 2px 12px rgba(239,68,68,0.4)' }}>
            {playing ? <IPause /> : <IPlay />}
          </button>

          {/* Skip forward */}
          <button onClick={() => { const v=videoRef.current; if(v) v.currentTime=Math.min(v.duration,v.currentTime+10); }}
            style={btnStyle}>
            <IForward10 />
          </button>

          {/* Time */}
          <span style={{ color:'#fff',fontSize:13,fontFamily:'monospace',letterSpacing:'0.03em',
                         marginLeft:2,whiteSpace:'nowrap',opacity:0.9 }}>
            {formatTime(current)} / {formatTime(duration)}
          </span>

          <div style={{ flex:1 }} />

          {/* Volume */}
          <button onClick={toggleMute} style={btnStyle}>
            <IVolume muted={muted} level={volume} />
          </button>
          <div
            ref={volRef}
            onMouseDown={(e) => { volFromEvent(e); setDragging('vol'); }}
            onTouchStart={(e) => { volFromEvent(e); setDragging('vol'); }}
            style={{ position:'relative',width:72,height:16,cursor:'pointer',display:'flex',
                     alignItems:'center', flexShrink:0 }}
          >
            <div style={{ position:'absolute',left:0,right:0,height:3,borderRadius:2,background:'rgba(255,255,255,0.18)' }} />
            <div style={{ position:'absolute',left:0,width:`${volPct}%`,height:3,borderRadius:2,background:'#ef4444' }} />
            <div style={{ position:'absolute',left:`calc(${volPct}% - 6px)`,width:12,height:12,
                          borderRadius:'50%',background:'#ef4444' }} />
          </div>

          {/* Download */}
          <button onClick={(e) => { e.stopPropagation(); handleDownload(); }}
            style={{ ...btnStyle, opacity: downloading ? 0.5 : 0.88 }}
            title="Download video">
            {downloading
              ? <div style={{ width:16,height:16,border:'2px solid rgba(255,255,255,0.3)',borderTop:'2px solid #fff',borderRadius:'50%',animation:'spin 0.8s linear infinite' }} />
              : <IDownload />
            }
          </button>

          {/* Fullscreen */}
          <button onClick={toggleFullscreen} style={btnStyle}>
            <IFullscreen active={fullscreen} />
          </button>
        </div>
      </div>

      {/* CSS animation */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#fff',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 36,
  height: 36,
  borderRadius: 8,
  opacity: 0.88,
  flexShrink: 0,
  padding: 0,
};

// ── Route ────────────────────────────────────────────────────
export default function Showcase() {
  return (
    <div style={{ minHeight:'100vh', background:'#050507',
                  display:'flex', flexDirection:'column',
                  alignItems:'center', justifyContent:'center',
                  padding:'24px 16px' }}>
      <div style={{ width:'100%', maxWidth:960 }}>
        <div style={{ textAlign:'center', marginBottom:20 }}>
          <h1 style={{ color:'#fff', fontSize:22, fontWeight:700, letterSpacing:'-0.02em', margin:0 }}>
            Exotic
          </h1>
          <p style={{ color:'rgba(255,255,255,0.35)', fontSize:13, margin:'4px 0 0' }}>
            App Showcase
          </p>
        </div>

        <VideoPlayer src="/exotic_showcase.mp4" />

        <p style={{ textAlign:'center', color:'rgba(255,255,255,0.18)', fontSize:11,
                    marginTop:16, fontFamily:'monospace' }}>
          Space / K — play · ← → — seek 10s · M — mute · F — fullscreen
        </p>
      </div>
    </div>
  );
}
