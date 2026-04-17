import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { AppShell } from "~/components/layout/app-shell";
import { useAuthStore } from "~/stores/auth-store";
import { supabase } from "~/lib/supabase";
import {
  IconUsers, IconMessageCircle, IconHeart, IconRadio, IconImage,
  IconTrendingUp, IconShield, IconTrash, IconGlobe, IconSmartphone,
  IconMonitor, IconChevronRight,
} from "~/components/icons";
import { VerifiedBadge, OwnerBadge } from "~/components/badges";
import { UserAvatar } from "~/components/user-avatar";
import type { User } from "~/types";

interface PlatformStats {
  totalUsers: number;
  totalQuestions: number;
  totalAnswers: number;
  totalPosts: number;
  totalLiveStreams: number;
}

interface UserRow extends User {
  email?: string;
}

interface SessionRow {
  id: string;
  user_id: string;
  ip_address: string | null;
  ip_alt: string | null;
  user_agent: string | null;
  browser: string | null;
  browser_version: string | null;
  os: string | null;
  os_version: string | null;
  device_type: string | null;
  country: string | null;
  country_code: string | null;
  region: string | null;
  city: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  isp: string | null;
  created_at: string;
  profile?: UserRow;
}

const StatCard = ({ icon: Icon, label, value, color }: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-muted/30 rounded-xl p-5 flex items-center gap-4"
  >
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
      <Icon size={20} />
    </div>
    <div>
      <p className="text-2xl font-bold">{value.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  </motion.div>
);

function DeviceIcon({ type }: { type: string | null }) {
  if (type === "Mobile" || type === "Tablet") return <IconSmartphone size={13} className="text-muted-foreground" />;
  return <IconMonitor size={13} className="text-muted-foreground" />;
}

function countryFlag(code: string | null) {
  if (!code || code.length !== 2) return "🌐";
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0)));
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function OwnerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<PlatformStats>({ totalUsers: 0, totalQuestions: 0, totalAnswers: 0, totalPosts: 0, totalLiveStreams: 0 });
  const [users, setUsers] = useState<UserRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"users" | "intel">("users");

  useEffect(() => {
    if (user && !user.is_owner) navigate("/", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (!user?.is_owner) return;

    async function loadData() {
      const [
        { count: totalUsers },
        { count: totalQuestions },
        { count: totalAnswers },
        { count: totalPosts },
        { count: totalLiveStreams },
        { data: allUsers },
        { data: allSessions },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("questions").select("*", { count: "exact", head: true }),
        supabase.from("answers").select("*", { count: "exact", head: true }),
        supabase.from("posts").select("*", { count: "exact", head: true }),
        supabase.from("live_streams").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_sessions").select("*, profile:profiles(*)").order("created_at", { ascending: false }).limit(200),
      ]);

      setStats({
        totalUsers: totalUsers ?? 0,
        totalQuestions: totalQuestions ?? 0,
        totalAnswers: totalAnswers ?? 0,
        totalPosts: totalPosts ?? 0,
        totalLiveStreams: totalLiveStreams ?? 0,
      });
      setUsers((allUsers ?? []) as UserRow[]);
      setSessions((allSessions ?? []) as SessionRow[]);
      setLoading(false);
    }

    loadData();
  }, [user?.is_owner]);

  const handleDeleteUser = async (targetId: string) => {
    if (!confirm("Delete this user permanently? This cannot be undone.")) return;
    setDeletingId(targetId);
    await supabase.from("profiles").delete().eq("id", targetId);
    setUsers((prev) => prev.filter((u) => u.id !== targetId));
    setDeletingId(null);
  };

  const handleToggleVerified = async (target: UserRow) => {
    const updated = !target.is_verified;
    await supabase.from("profiles").update({ is_verified: updated }).eq("id", target.id);
    setUsers((prev) => prev.map((u) => u.id === target.id ? { ...u, is_verified: updated } : u));
  };

  if (!user?.is_owner) return null;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-2xl font-bold">Owner Dashboard</h1>
            <OwnerBadge />
          </div>
          <p className="text-sm text-muted-foreground">Full platform control — visible only to you</p>
        </div>

        {/* Stats Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-muted/30 rounded-xl h-20 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
            <StatCard icon={IconUsers} label="Total Users" value={stats.totalUsers} color="bg-blue-500/10 text-blue-500" />
            <StatCard icon={IconMessageCircle} label="Questions" value={stats.totalQuestions} color="bg-purple-500/10 text-purple-500" />
            <StatCard icon={IconHeart} label="Answers" value={stats.totalAnswers} color="bg-rose-500/10 text-rose-500" />
            <StatCard icon={IconImage} label="Posts" value={stats.totalPosts} color="bg-emerald-500/10 text-emerald-500" />
            <StatCard icon={IconRadio} label="Live Streams" value={stats.totalLiveStreams} color="bg-red-500/10 text-red-500" />
            <StatCard icon={IconTrendingUp} label="Sessions Logged" value={sessions.length} color="bg-amber-500/10 text-amber-500" />
          </div>
        )}

        {/* Tab Toggle */}
        <div className="flex gap-1 p-1 bg-muted/40 rounded-xl mb-6 w-fit">
          {(["users", "intel"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "users" ? "Users" : "User Intelligence"}
            </button>
          ))}
        </div>

        {/* ── Tab: User Management ── */}
        {activeTab === "users" && (
          <div>
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <IconUsers size={16} />
              User Management
            </h2>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-muted/30 rounded-xl h-16 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {users.map((u, i) => (
                  <motion.div
                    key={u.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-3 bg-muted/20 hover:bg-muted/40 rounded-xl px-4 py-3 transition-colors"
                  >
                    <UserAvatar
                      name={u.display_name ?? "?"}
                      avatarUrl={u.avatar_url}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm truncate">{u.display_name}</span>
                        {u.is_owner && <OwnerBadge />}
                        {u.is_verified && <VerifiedBadge />}
                      </div>
                      <p className="text-xs text-muted-foreground">@{u.username} · {u.email ?? "no email"}</p>
                    </div>
                    {u.id !== user.id && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleToggleVerified(u)}
                          title={u.is_verified ? "Remove verification" : "Verify user"}
                          className={`p-1.5 rounded-lg transition-colors ${u.is_verified ? "text-blue-500 hover:bg-blue-500/10" : "text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10"}`}
                        >
                          <IconShield size={15} />
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleDeleteUser(u.id)}
                          disabled={deletingId === u.id}
                          title="Delete user"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                        >
                          <IconTrash size={15} />
                        </motion.button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: User Intelligence ── */}
        {activeTab === "intel" && (
          <div>
            <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
              <IconGlobe size={16} />
              User Intelligence
            </h2>
            <p className="text-xs text-muted-foreground mb-5">IP address, device info, and real-time location captured on every login</p>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-muted/30 rounded-xl h-20 animate-pulse" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <IconGlobe size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No sessions recorded yet.</p>
                <p className="text-xs mt-1">Sessions are captured on every login.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map((s, i) => {
                  const expanded = expandedSession === s.id;
                  const profile = s.profile as UserRow | undefined;
                  return (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.3) }}
                      className="bg-muted/20 rounded-xl overflow-hidden border border-border/40"
                    >
                      {/* Row summary */}
                      <button
                        onClick={() => setExpandedSession(expanded ? null : s.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                      >
                        {/* Avatar */}
                        <UserAvatar
                          name={profile?.display_name ?? "?"}
                          avatarUrl={profile?.avatar_url}
                          size="xs"
                        />

                        {/* User + IP */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold truncate">{profile?.display_name ?? "Unknown"}</span>
                            <span className="text-xs text-muted-foreground truncate">@{profile?.username ?? "?"}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs font-mono text-amber-500">{s.ip_address ?? "unknown IP"}</span>
                            {s.ip_alt && <span className="text-xs font-mono text-amber-400/70">{s.ip_alt}</span>}
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">{countryFlag(s.country_code)} {s.city ?? ""}{s.city && s.country ? ", " : ""}{s.country ?? "Unknown location"}</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <DeviceIcon type={s.device_type} />
                            <span className="text-xs text-muted-foreground">{s.browser ?? "?"} on {s.os ?? "?"}</span>
                          </div>
                        </div>

                        {/* Date + chevron */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[11px] text-muted-foreground hidden sm:block">{formatDate(s.created_at)}</span>
                          <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.15 }}>
                            <IconChevronRight size={14} className="text-muted-foreground" />
                          </motion.div>
                        </div>
                      </button>

                      {/* Expanded detail */}
                      <AnimatePresence initial={false}>
                        {expanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 border-t border-border/40 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                              <InfoRow label="User ID" value={s.user_id} mono />
                              <InfoRow label="Email" value={profile?.email ?? "—"} />
                              <InfoRow label="Username" value={`@${profile?.username ?? "?"}`} />
                              <InfoRow label="Display Name" value={profile?.display_name ?? "—"} />
                              <InfoRow label="IP Address (IPv6)" value={s.ip_address ?? "—"} mono highlight />
                              {s.ip_alt && <InfoRow label="IP Address (IPv4)" value={s.ip_alt} mono highlight />}
                              <InfoRow label="ISP / Organization" value={s.isp ?? "—"} />
                              <InfoRow label="Country" value={s.country ? `${countryFlag(s.country_code)} ${s.country}` : "—"} />
                              <InfoRow label="Region / State" value={s.region ?? "—"} />
                              <InfoRow label="City" value={s.city ?? "—"} />
                              <InfoRow label="Postal Code" value={s.postal_code ?? "—"} />
                              <InfoRow
                                label="Coordinates"
                                value={s.latitude && s.longitude ? `${s.latitude.toFixed(4)}, ${s.longitude.toFixed(4)}` : "—"}
                                mono
                              />
                              <InfoRow label="Timezone" value={s.timezone ?? "—"} />
                              <InfoRow label="Device Type" value={s.device_type ?? "—"} />
                              <InfoRow label="Browser" value={s.browser ? `${s.browser} ${s.browser_version ?? ""}`.trim() : "—"} />
                              <InfoRow label="OS" value={s.os ? `${s.os} ${s.os_version ?? ""}`.trim() : "—"} />
                              <InfoRow label="Login Time" value={formatDate(s.created_at)} />
                              <div className="col-span-full mt-1">
                                <p className="text-[10px] text-muted-foreground/60 font-mono break-all">{s.user_agent ?? "—"}</p>
                              </div>
                              {s.latitude && s.longitude && (
                                <div className="col-span-full mt-1">
                                  <a
                                    href={`https://www.google.com/maps?q=${s.latitude},${s.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline"
                                  >
                                    <IconGlobe size={11} />
                                    View on Google Maps
                                  </a>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function InfoRow({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60 font-medium">{label}</span>
      <span className={`text-xs break-all ${mono ? "font-mono" : ""} ${highlight ? "text-amber-500 font-semibold" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}
