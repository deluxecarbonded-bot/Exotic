import type { Route } from "./+types/ask.$username";
import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { AppShell } from "~/components/layout/app-shell";
import { IconArrowLeft, IconSend, IconCheck, IconUser, IconSearch, IconMask } from "~/components/icons";
import { fadeInUp, scaleIn, popIn } from "~/components/animations";
import { UserAvatar } from "~/components/user-avatar";
import { useQuestionStore } from "~/stores/question-store";
import { useAuthStore } from "~/stores/auth-store";
import { supabase } from "~/lib/supabase";
import type { User } from "~/types";

const MAX_CHARS = 500;

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `Ask @${params.username} - Exotic` },
    {
      name: "description",
      content: `Send an anonymous question to @${params.username}`,
    },
  ];
}

function SuccessView({ username }: { username: string }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center py-20 px-4 text-center"
      {...fadeInUp}
    >
      <motion.div
        className="w-16 h-16 rounded-full bg-foreground text-background flex items-center justify-center mb-6"
        {...popIn}
      >
        <IconCheck size={32} />
      </motion.div>
      <h2 className="text-xl font-bold mb-2">Question sent</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs">
        Your question has been delivered to @{username}. They will see it in
        their inbox.
      </p>
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="px-4 py-2 text-sm font-medium rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          Go home
        </Link>
        <motion.button
          whileTap={{ scale: 0.95 }}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity"
          onClick={() => window.location.reload()}
        >
          Ask another
        </motion.button>
      </div>
    </motion.div>
  );
}

function UserSearchBar({
  onSelect,
  currentUsername,
}: {
  onSelect: (user: User) => void;
  currentUsername?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const { user: authUser } = useAuthStore();

  const search = useCallback(async (q: string) => {
    if (q.trim().length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const searchTerm = q.trim().toLowerCase();

    // Search by username and display_name using ilike for fuzzy matching
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${searchTerm}%,display_name.ilike.%${searchTerm}%`)
      .neq('id', authUser?.id ?? '')
      .limit(8);

    setResults((data ?? []) as User[]);
    setSelectedIndex(0);
    setLoading(false);
  }, [authUser?.id]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length === 0) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => search(query), 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = results[selectedIndex];
      if (selected) {
        onSelect(selected);
        setQuery("");
        setIsOpen(false);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/50 rounded-lg border border-transparent focus-within:border-muted-foreground/20 transition-colors">
        <IconSearch size={16} className="text-muted-foreground flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => { if (query.trim()) setIsOpen(true); }}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder="Search for a user to ask..."
          className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none min-w-0"
        />
        {loading && (
          <motion.div
            className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full flex-shrink-0"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
          />
        )}
      </div>

      {/* Results dropdown */}
      <AnimatePresence>
        {isOpen && (query.trim().length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full mt-1 bg-background border border-muted rounded-lg shadow-lg overflow-hidden z-50 max-h-[320px] overflow-y-auto custom-scrollbar"
          >
            {results.length === 0 && !loading ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No users found for "{query}"
                </p>
              </div>
            ) : (
              results.map((user, i) => (
                <motion.button
                  key={user.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    i === selectedIndex ? "bg-muted" : "hover:bg-muted/50"
                  }`}
                  onMouseEnter={() => setSelectedIndex(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(user);
                    setQuery("");
                    setIsOpen(false);
                  }}
                >
                  <UserAvatar user={user} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{user.display_name}</p>
                    <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                  </div>
                  {i === selectedIndex && (
                    <span className="text-[10px] text-muted-foreground bg-muted-foreground/10 px-1.5 py-0.5 rounded font-mono">
                      Enter
                    </span>
                  )}
                </motion.button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AskUserPage() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { askQuestion } = useQuestionStore();
  const { user: authUser } = useAuthStore();
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const isSelf = authUser?.username === username;

  // Fetch target user by username
  useEffect(() => {
    async function loadUser() {
      if (!username) return;
      // If asking self, don't load — show search instead
      if (authUser && username === authUser.username) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single();
      if (data) {
        setTargetUser(data as User);
        if (!(data as User).allow_anonymous) {
          setIsAnonymous(false);
        }
      }
      setLoading(false);
    }
    loadUser();
  }, [username, authUser?.username]);

  const charCount = content.length;
  const isOverLimit = charCount > MAX_CHARS;
  const canSubmit = content.trim().length > 0 && !isOverLimit && !submitting && targetUser;

  const handleSubmit = async () => {
    if (!canSubmit || !targetUser) return;
    setSubmitting(true);
    setError("");
    try {
      await askQuestion(
        targetUser.id,
        content.trim(),
        isAnonymous,
        isAnonymous ? null : authUser?.id ?? null
      );
      setSubmitting(false);
      setSent(true);
    } catch (e: any) {
      setError(e?.message ?? "Failed to send question");
      setSubmitting(false);
    }
  };

  const handleSelectUser = (user: User) => {
    setTargetUser(user);
    setIsAnonymous(user.allow_anonymous !== false);
    navigate(`/ask/${user.username}`, { replace: true });
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          className="flex items-center gap-3 px-4 py-3"
          {...fadeInUp}
        >
          <Link
            to={targetUser ? `/profile/${targetUser.username}` : "/"}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <IconArrowLeft size={20} />
          </Link>
          <h1 className="text-sm font-semibold">Ask a question</h1>
        </motion.div>

        <AnimatePresence mode="wait">
          {sent ? (
            <SuccessView key="success" username={targetUser?.username ?? username ?? ""} />
          ) : loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center py-20"
            >
              <div className="w-12 h-12 rounded-full bg-muted animate-pulse mb-4" />
              <div className="h-3 w-24 bg-muted rounded animate-pulse" />
            </motion.div>
          ) : isSelf && !targetUser ? (
            /* Self-ask route — show search */
            <motion.div
              key="search"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="px-4 space-y-5">
                <div className="text-center py-6">
                  <h2 className="text-lg font-bold mb-1">Who do you want to ask?</h2>
                  <p className="text-sm text-muted-foreground">
                    Search for a user to send them a question.
                  </p>
                </div>
                <UserSearchBar
                  onSelect={handleSelectUser}
                  currentUsername={username}
                />
              </div>
            </motion.div>
          ) : !targetUser ? (
            <motion.div
              key="not-found"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center py-20 px-4 text-center"
            >
              <IconUser size={48} className="text-muted-foreground/50 mb-4" />
              <h2 className="text-lg font-semibold mb-1">User not found</h2>
              <p className="text-sm text-muted-foreground">
                @{username} doesn't exist on Exotic.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Search bar to switch user */}
              <div className="px-4 mb-2">
                <UserSearchBar
                  onSelect={handleSelectUser}
                  currentUsername={username}
                />
              </div>

              {/* Target user */}
              <motion.div
                className="flex items-center gap-3 px-4 py-4"
                {...fadeInUp}
              >
                <UserAvatar user={targetUser} size="md" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {targetUser.display_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    @{targetUser.username}
                  </p>
                </div>
              </motion.div>

              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mx-4 mb-3 p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center"
                >
                  {error}
                </motion.div>
              )}

              {/* Question form */}
              <motion.div
                className="px-4 space-y-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div className="relative">
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Type your question..."
                    className="w-full min-h-[160px] resize-none rounded-lg bg-muted/50 p-4 text-sm placeholder:text-muted-foreground focus:outline-none"
                    autoFocus
                  />
                  <div className="absolute bottom-3 right-3">
                    <span
                      className={`text-xs font-medium ${
                        isOverLimit
                          ? "text-destructive"
                          : charCount > MAX_CHARS * 0.9
                          ? "text-muted-foreground"
                          : "text-muted-foreground/50"
                      }`}
                    >
                      {charCount}/{MAX_CHARS}
                    </span>
                  </div>
                </div>

                {/* Anonymous toggle */}
                {targetUser.allow_anonymous !== false ? (
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <IconMask size={18} className="text-muted-foreground" />
                      <span className="text-sm font-medium">
                        Ask anonymously
                      </span>
                    </div>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setIsAnonymous(!isAnonymous)}
                      className={`relative inline-flex items-center h-[30px] w-[54px] rounded-full transition-colors ${
                        isAnonymous
                          ? "bg-foreground"
                          : "bg-input dark:bg-input/80"
                      }`}
                    >
                      <motion.div
                        className={`flex items-center justify-center w-[24px] h-[24px] rounded-full transition-colors ${
                          isAnonymous ? "bg-background" : "bg-background dark:bg-foreground"
                        }`}
                        animate={{ x: isAnonymous ? 26 : 3 }}
                        transition={{ type: "spring", stiffness: 500, damping: 35 }}
                      >
                        <IconMask size={14} className={isAnonymous ? "text-foreground" : "text-muted-foreground dark:text-background"} />
                      </motion.div>
                    </motion.button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-2">
                    This user has disabled anonymous questions. Your name will be visible.
                  </p>
                )}

                {!isAnonymous && targetUser.allow_anonymous !== false && (
                  <motion.p
                    className="text-xs text-muted-foreground"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    Your name and profile will be visible to the recipient.
                  </motion.p>
                )}

                {/* Submit */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                >
                  {submitting ? (
                    <motion.div
                      className="w-4 h-4 border-2 border-background border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{
                        repeat: Infinity,
                        duration: 0.8,
                        ease: "linear",
                      }}
                    />
                  ) : (
                    <>
                      <IconSend size={16} />
                      Send question
                    </>
                  )}
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}
