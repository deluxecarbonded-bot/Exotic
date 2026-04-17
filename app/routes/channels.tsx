import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '~/stores/auth-store';
import { useChannelStore } from '~/stores/channel-store';
import { UserAvatar } from '~/components/user-avatar';
import { IconMegaphone, IconPlus, IconSearch, IconX, IconGlobe, IconLock, IconUsers, IconCheck, IconChevronRight } from '~/components/icons';
import type { Channel } from '~/types';

function ChannelAvatar({ channel, size = 48 }: { channel: Channel; size?: number }) {
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
  const initials = channel.name.slice(0, 2).toUpperCase();
  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500', 'bg-indigo-500'];
  const color = colors[channel.name.charCodeAt(0) % colors.length];
  return (
    <div
      className={`${color} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}

function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function ChannelRow({ channel, onToggle }: { channel: Channel; onToggle: () => void }) {
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user?.id || loading) return;
    setLoading(true);
    await onToggle();
    setLoading(false);
  };

  const isOwnerOrAdmin = channel.member_role === 'owner' || channel.member_role === 'admin';

  return (
    <Link to={`/channels/${channel.handle}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors group">
      <ChannelAvatar channel={channel} size={52} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-sm truncate">{channel.name}</span>
          {!channel.is_public && <IconLock size={11} className="text-muted-foreground flex-shrink-0" />}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">
            {formatCount(channel.subscribers_count)} subscribers
          </span>
          {channel.posts_count > 0 && (
            <>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <span className="text-xs text-muted-foreground">{channel.posts_count} posts</span>
            </>
          )}
        </div>
        {channel.description && (
          <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{channel.description}</p>
        )}
      </div>
      {user && !isOwnerOrAdmin && (
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={handleToggle}
          disabled={loading}
          className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            channel.is_subscribed
              ? 'bg-muted text-muted-foreground hover:bg-muted/80'
              : 'bg-foreground text-background hover:opacity-90'
          }`}
        >
          {loading ? '…' : channel.is_subscribed ? 'Joined' : 'Join'}
        </motion.button>
      )}
      {isOwnerOrAdmin && (
        <span className="text-[10px] text-muted-foreground px-2 py-0.5 rounded-full bg-muted flex-shrink-0">
          {channel.member_role === 'owner' ? 'Owner' : 'Admin'}
        </span>
      )}
    </Link>
  );
}

function CreateChannelModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Channel) => void }) {
  const { user } = useAuthStore();
  const { createChannel } = useChannelStore();
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handleInputRef = useRef<HTMLInputElement>(null);

  // Auto-generate handle from name
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
      setError('Handle already taken or an error occurred. Try a different handle.');
      setLoading(false);
      return;
    }
    onCreated(channel);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-md bg-background rounded-2xl overflow-hidden shadow-2xl"
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-bold text-base">New Channel</h2>
          <button onClick={onClose} className="ghost-btn text-muted-foreground hover:text-foreground">
            <IconX size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Channel name */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Channel Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Exotic Updates"
              maxLength={64}
              required
              className="w-full bg-muted rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>

          {/* Handle */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Handle</label>
            <div className="flex items-center bg-muted rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-foreground/20">
              <span className="pl-4 text-sm text-muted-foreground select-none">@</span>
              <input
                ref={handleInputRef}
                value={handle}
                onChange={e => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 32))}
                placeholder="channel_handle"
                maxLength={32}
                required
                className="flex-1 bg-transparent px-2 py-3 text-sm focus:outline-none"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Description <span className="normal-case font-normal">(optional)</span></label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What's this channel about?"
              maxLength={256}
              rows={3}
              className="w-full bg-muted rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-none"
            />
          </div>

          {/* Visibility */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
            <div className="flex items-center gap-3">
              {isPublic ? <IconGlobe size={18} className="text-muted-foreground" /> : <IconLock size={18} className="text-muted-foreground" />}
              <div>
                <p className="text-sm font-medium">{isPublic ? 'Public' : 'Private'}</p>
                <p className="text-xs text-muted-foreground">{isPublic ? 'Anyone can find and join' : 'Invite only'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsPublic(!isPublic)}
              className={`relative w-11 h-6 rounded-full transition-colors ${isPublic ? 'bg-foreground' : 'bg-muted-foreground/30'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-background rounded-full shadow transition-transform ${isPublic ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <motion.button
            whileTap={{ scale: 0.97 }}
            type="submit"
            disabled={loading || !name.trim() || !handle.trim()}
            className="w-full py-3 bg-foreground text-background rounded-xl font-semibold text-sm disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Creating…' : 'Create Channel'}
          </motion.button>
        </form>
      </motion.div>
    </motion.div>
  );
}

export default function ChannelsPage() {
  const { user } = useAuthStore();
  const { channels, subscribedChannels, isLoading, fetchChannels, fetchSubscribed, subscribe, unsubscribe } = useChannelStore();
  const [tab, setTab] = useState<'subscribed' | 'explore'>('subscribed');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Channel[]>([]);
  const [searching, setSearching] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();
  const { searchChannels } = useChannelStore();

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

  const handleToggle = async (channel: Channel) => {
    if (!user?.id) return;
    if (channel.is_subscribed) await unsubscribe(channel.id, user.id);
    else await subscribe(channel.id, user.id);
  };

  const displayList = search.trim()
    ? searchResults
    : tab === 'subscribed'
    ? subscribedChannels
    : channels;

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-xl border-b border-border px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold">Channels</h1>
            {user && (
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => setShowCreate(true)}
                className="ghost-btn flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <IconPlus size={18} />
                <span className="hidden sm:inline">New</span>
              </motion.button>
            )}
          </div>

          {/* Search bar */}
          <div className="relative mb-3">
            <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search channels…"
              className="w-full bg-muted rounded-xl pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
            {search && (
              <button onClick={() => setSearch('')} className="ghost-btn absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <IconX size={14} />
              </button>
            )}
          </div>

          {/* Tabs */}
          {!search && (
            <div className="flex gap-1 bg-muted p-1 rounded-xl">
              {(['subscribed', 'explore'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors capitalize ${
                    tab === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                  }`}
                >
                  {t === 'subscribed' ? 'Joined' : 'Explore'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Channel list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && !displayList.length ? (
            <div className="space-y-0 divide-y divide-border">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                  <div className="w-[52px] h-[52px] rounded-full bg-muted flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-32 bg-muted rounded" />
                    <div className="h-3 w-20 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : displayList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <IconMegaphone size={40} className="text-muted-foreground/30 mb-3" />
              <p className="font-semibold text-sm">
                {search ? 'No channels found' : tab === 'subscribed' ? 'No joined channels' : 'No channels yet'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {tab === 'subscribed' && !search ? 'Explore and join channels to see them here' : 'Try a different search'}
              </p>
              {tab === 'subscribed' && !search && (
                <button onClick={() => setTab('explore')} className="mt-3 text-xs font-semibold hover:underline">
                  Browse channels →
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              <AnimatePresence initial={false}>
                {displayList.map(channel => (
                  <motion.div
                    key={channel.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <ChannelRow
                      channel={channel}
                      onToggle={() => handleToggle(channel)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showCreate && (
          <CreateChannelModal
            onClose={() => setShowCreate(false)}
            onCreated={(c) => { setShowCreate(false); navigate(`/channels/${c.handle}`); }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
