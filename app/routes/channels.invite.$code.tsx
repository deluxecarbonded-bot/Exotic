import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { motion } from 'framer-motion';
import { useAuthStore } from '~/stores/auth-store';
import { useChannelStore } from '~/stores/channel-store';
import { supabase } from '~/lib/supabase';
import { IconArrowLeft, IconUsers, IconLock, IconCheck } from '~/components/icons';
import { UserAvatar } from '~/components/user-avatar';
import type { Channel } from '~/types';

export default function ChannelInvitePage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { joinViaInvite } = useChannelStore();

  const [channel, setChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (!code) return;
    (async () => {
      setLoading(true);
      setError(null);
      // Look up invite
      const { data: invite, error: invErr } = await supabase
        .from('channel_invites')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .single();

      if (invErr || !invite) {
        setError('This invite link is invalid or has expired.');
        setLoading(false);
        return;
      }

      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        setError('This invite link has expired.');
        setLoading(false);
        return;
      }

      if (invite.max_uses && invite.uses_count >= invite.max_uses) {
        setError('This invite link has reached its maximum uses.');
        setLoading(false);
        return;
      }

      // Fetch channel info
      const { data: ch, error: chErr } = await supabase
        .from('channels')
        .select('*')
        .eq('id', invite.channel_id)
        .single();

      if (chErr || !ch) {
        setError('Channel not found.');
        setLoading(false);
        return;
      }

      setChannel(ch);
      setLoading(false);
    })();
  }, [code]);

  const handleJoin = async () => {
    if (!code || !user) return;
    setJoining(true);
    setError(null);
    const result = await joinViaInvite(code, user.id);
    if (result) {
      setJoined(true);
      setTimeout(() => {
        if (channel) navigate(`/channels/${channel.handle}`);
      }, 1000);
    } else {
      setError('Failed to join. You may already be a member.');
    }
    setJoining(false);
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <p className="text-muted-foreground mb-4">You need to be logged in to join a channel.</p>
        <Link to="/login" className="text-primary underline">Log in</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-card rounded-2xl border border-border p-6 text-center space-y-4"
      >
        <button onClick={() => navigate(-1)} className="absolute top-4 left-4 p-2 text-muted-foreground">
          <IconArrowLeft size={20} />
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error && !channel ? (
          <div className="space-y-4">
            <p className="text-destructive">{error}</p>
            <Link to="/channels" className="text-primary underline text-sm">Browse channels</Link>
          </div>
        ) : channel ? (
          <>
            {channel.avatar_url ? (
              <img src={channel.avatar_url} alt="" className="w-16 h-16 rounded-full mx-auto" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <IconUsers size={28} className="text-primary" />
              </div>
            )}

            <div>
              <h2 className="text-lg font-semibold flex items-center justify-center gap-1.5">
                {!channel.is_public && <IconLock size={14} className="text-muted-foreground" />}
                {channel.name}
              </h2>
              {channel.description && (
                <p className="text-sm text-muted-foreground mt-1">{channel.description}</p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                {channel.subscribers_count} subscriber{channel.subscribers_count !== 1 ? 's' : ''}
              </p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {joined ? (
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="flex items-center justify-center gap-2 text-green-500 font-medium"
              >
                <IconCheck size={20} />
                Joined!
              </motion.div>
            ) : (
              <button
                onClick={handleJoin}
                disabled={joining}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-full font-medium disabled:opacity-50"
              >
                {joining ? 'Joining...' : 'Join Channel'}
              </button>
            )}
          </>
        ) : null}
      </motion.div>
    </div>
  );
}
