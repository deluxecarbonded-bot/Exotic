import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '~/stores/auth-store';
import { useChannelStore } from '~/stores/channel-store';
import { IconMegaphone, IconSearch, IconX, IconGlobe, IconLock, IconPlus, IconArrowLeft } from '~/components/icons';
import type { Channel } from '~/types';

// ─── Shared helpers ────────────────────────────────────────────────────────────
export function ChannelAvatar({ channel, size = 48 }: { channel: Channel; size?: number }) {
  if (channel.avatar_url) {
    return (
      <img
        src={channel.avatar_url}
        alt={channel.name}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500', 'bg-indigo-500'];
  const color = colors[channel.name.charCodeAt(0) % colors.length];
  return (
    <div
      className={`${color} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {channel.name.slice(0, 2).toUpperCase()}
    </div>
  );
}

export function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── Create Channel Modal ──────────────────────────────────────────────────────
function CreateChannelModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Channel) => void }) {
  const { user } = useAuthStore();
  const { createChannel } = useChannelStore();
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setHandle(name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 32));
  }, [name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !name.trim() || !handle.trim()) return;
    setLoading(true);
    setError('');
    const channel = await createChannel({ name: name.trim(), handle, description: description.trim(), is_public: isPublic }, user.id);
    if (!channel) {
      setError('Handle already taken. Try a different one.');
      setLoading(false);
      return;
    }
    onCreated(channel);
  };

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div className="relative w-full max-w-md bg-background rounded-2xl overflow-hidden shadow-2xl"
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-bold text-base">New Channel</h2>
          <button onClick={onClose} className="ghost-btn text-muted-foreground hover:text-foreground"><IconX size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Channel Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Exotic Updates" maxLength={64} required
              className="w-full bg-muted rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Handle</label>
            <div className="flex items-center bg-muted rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-foreground/20">
              <span className="pl-4 text-sm text-muted-foreground select-none">@</span>
              <input value={handle} onChange={e => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 32))}
                placeholder="channel_handle" maxLength={32} required
                className="flex-1 bg-transparent px-2 py-3 text-sm focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Description <span className="normal-case font-normal">(optional)</span></label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What's this channel about?" maxLength={256} rows={2}
              className="w-full bg-muted rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-none" />
          </div>
          <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
            <div className="flex items-center gap-3">
              {isPublic ? <IconGlobe size={18} className="text-muted-foreground" /> : <IconLock size={18} className="text-muted-foreground" />}
              <div>
                <p className="text-sm font-medium">{isPublic ? 'Public' : 'Private'}</p>
                <p className="text-xs text-muted-foreground">{isPublic ? 'Anyone can find and join' : 'Invite only'}</p>
              </div>
            </div>
            <button type="button" onClick={() => setIsPublic(!isPublic)}
              className={`relative w-11 h-6 rounded-full transition-colors ${isPublic ? 'bg-foreground' : 'bg-muted-foreground/30'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-background rounded-full shadow transition-transform ${isPublic ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={loading || !name.trim() || !handle.trim()}
            className="w-full py-3 bg-foreground text-background rounded-xl font-semibold text-sm disabled:opacity-50 transition-opacity">
            {loading ? 'Creating…' : 'Create Channel'}
          </motion.button>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─── Sidebar Channel Row ────────────────────────────────────────────────────────
function SidebarChannelRow({ channel, isActive }: { channel: Channel; isActive: boolean }) {
  return (
    <Link
      to={`/channels/${channel.handle}`}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl mx-2 transition-colors group ${isActive ? 'bg-foreground/10' : 'hover:bg-muted/60'}`}
    >
      <ChannelAvatar channel={channel} size={46} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <div className="flex items-center gap-1 min-w-0">
            <span className={`text-sm font-semibold truncate ${isActive ? 'text-foreground' : ''}`}>{channel.name}</span>
            {!channel.is_public && <IconLock size={10} className="text-muted-foreground flex-shrink-0" />}
          </div>
          {(channel.member_role === 'owner' || channel.member_role === 'admin') && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-foreground/10 text-muted-foreground font-medium flex-shrink-0">
              {channel.member_role === 'owner' ? 'Owner' : 'Admin'}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {formatCount(channel.subscribers_count)} subscribers
          {channel.description ? ` · ${channel.description}` : ''}
        </p>
      </div>
    </Link>
  );
}

// ─── Telegram Left Sidebar ─────────────────────────────────────────────────────
function ChannelsSidebar({ onCreateChannel }: { onCreateChannel: () => void }) {
  const { user } = useAuthStore();
  const { channels, subscribedChannels, fetchChannels, fetchSubscribed, searchChannels } = useChannelStore();
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Channel[]>([]);
  const [searching, setSearching] = useState(false);
  const [tab, setTab] = useState<'joined' | 'explore'>('joined');
  const params = useParams<{ handle?: string }>();
  const activeHandle = params.handle;

  useEffect(() => {
    if (user?.id) {
      fetchSubscribed(user.id);
      fetchChannels(user.id);
    } else {
      fetchChannels();
    }
  }, [user?.id]);

  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      const results = await searchChannels(search.trim());
      setSearchResults(results);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const displayList = search.trim()
    ? searchResults
    : tab === 'joined'
    ? subscribedChannels
    : channels;

  return (
    <div className="flex flex-col h-full border-r border-border bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-4 pb-2 flex-shrink-0">
        <Link to="/" className="ghost-btn w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground flex-shrink-0">
          <IconArrowLeft size={18} />
        </Link>
        <h1 className="font-bold text-lg flex-1">Channels</h1>
        <motion.button whileTap={{ scale: 0.9 }} onClick={onCreateChannel}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground text-background hover:opacity-90 transition-opacity flex-shrink-0">
          <IconPlus size={16} />
        </motion.button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2 bg-muted rounded-xl px-3 h-9">
          <IconSearch size={14} className="text-muted-foreground flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search channels…"
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/60"
          />
          {search && (
            <button onClick={() => setSearch('')} className="ghost-btn text-muted-foreground hover:text-foreground">
              <IconX size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Tabs — only shown when not searching */}
      {!search.trim() && (
        <div className="flex px-3 gap-1 pb-1 flex-shrink-0">
          {(['joined', 'explore'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${tab === t ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}>
              {t === 'joined' ? 'Joined' : 'Explore'}
            </button>
          ))}
        </div>
      )}

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto py-1">
        {searching ? (
          <div className="flex items-center justify-center py-8">
            <motion.div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-foreground rounded-full"
              animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} />
          </div>
        ) : displayList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <IconMegaphone size={28} className="text-muted-foreground/30 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">
              {search.trim() ? 'No results' : tab === 'joined' ? 'No channels yet' : 'No public channels'}
            </p>
            {!search.trim() && tab === 'joined' && (
              <p className="text-xs text-muted-foreground/60 mt-1">Explore channels to join some</p>
            )}
          </div>
        ) : (
          <div className="space-y-0.5">
            {displayList.map(channel => (
              <SidebarChannelRow key={channel.id} channel={channel} isActive={channel.handle === activeHandle} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Layout ─────────────────────────────────────────────────────────────────────
export default function ChannelsLayout() {
  const [showCreate, setShowCreate] = useState(false);
  const { fetchSubscribed, subscribedChannels } = useChannelStore();
  const { user } = useAuthStore();
  const params = useParams<{ handle?: string }>();

  const handleChannelCreated = (c: Channel) => {
    setShowCreate(false);
    if (user?.id) fetchSubscribed(user.id);
  };

  return (
    /*
     * Use fixed positioning to escape app-shell's unconstrained <main>.
     * Offsets match app-shell exactly:
     *   mobile  → top:56px (h-14 header), bottom:64px (h-16 bottom nav)
     *   desktop → top:0, bottom:32px (pb-8), left:256px (pl-64 sidebar)
     */
    <div className="fixed top-14 bottom-16 left-0 right-0 lg:top-0 lg:bottom-8 lg:left-64 flex overflow-hidden bg-background">
      {/* Left sidebar — visible on md+ always; on mobile only when no channel selected */}
      <div className={`${params.handle ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-72 lg:w-80 flex-shrink-0 overflow-hidden`}>
        <ChannelsSidebar onCreateChannel={() => setShowCreate(true)} />
      </div>

      {/* Main content */}
      <div className={`${params.handle ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0 overflow-hidden`}>
        <Outlet />
      </div>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateChannelModal
            onClose={() => setShowCreate(false)}
            onCreated={handleChannelCreated}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
