import type { Route } from "./+types/search";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppShell } from "~/components/layout/app-shell";
import { UserCard, AnswerCard, EmptyState } from "~/components/cards";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { IconSearch, IconX, IconUser } from "~/components/icons";
import { staggerContainer, staggerItemVariants, fadeInUp } from "~/components/animations";
import { supabase } from "~/lib/supabase";
import type { User, Answer } from "~/types";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Search - Exotic" },
    { name: "description", content: "Search people and questions on Exotic" },
  ];
}

type SearchTab = "people" | "questions" | "answers";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function useRecentSearches() {
  const [recent, setRecent] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem("exotic-recent-searches") ?? "[]");
    } catch {
      return [];
    }
  });

  const add = useCallback((query: string) => {
    setRecent((prev) => {
      const next = [query, ...prev.filter((q) => q !== query)].slice(0, 8);
      try {
        localStorage.setItem("exotic-recent-searches", JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setRecent([]);
    try {
      localStorage.removeItem("exotic-recent-searches");
    } catch {}
  }, []);

  return { recent, add, clear };
}

export default function Search() {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SearchTab>("people");
  const [isSearching, setIsSearching] = useState(false);
  const [userResults, setUserResults] = useState<User[]>([]);
  const [answerResults, setAnswerResults] = useState<Answer[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query.trim(), 300);
  const { recent, add, clear } = useRecentSearches();

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Perform search when debounced query changes
  useEffect(() => {
    if (!debouncedQuery) {
      setUserResults([]);
      setAnswerResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    const searchAsync = async () => {
      const [usersRes, answersRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .or(`username.ilike.%${debouncedQuery}%,display_name.ilike.%${debouncedQuery}%`)
          .limit(20),
        supabase
          .from('answers')
          .select('*, user:profiles!answers_user_id_fkey(*), question:questions(*, sender:profiles!questions_sender_id_fkey(*))')
          .ilike('content', `%${debouncedQuery}%`)
          .limit(20),
      ]);

      setUserResults((usersRes.data ?? []) as User[]);
      setAnswerResults(
        (answersRes.data ?? []).map((a: any) => ({
          ...a,
          is_liked: false,
          shares_count: a.shares_count ?? 0,
        })) as Answer[]
      );
      setIsSearching(false);
    };

    searchAsync();
  }, [debouncedQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      add(query.trim());
    }
  };

  const handleRecentClick = (term: string) => {
    setQuery(term);
    add(term);
  };

  const hasQuery = debouncedQuery.length > 0;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as SearchTab)}
        >
          {/* Sticky header: search input + tabs when searching */}
          <div className="sticky top-14 lg:top-0 z-10">
            <div className="px-4 pt-4 pb-2">
              <form onSubmit={handleSearchSubmit} className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <IconSearch size={16} />
                </div>
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search people, questions, answers..."
                  className="pl-9 pr-9 h-9 bg-transparent"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="ghost-btn absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <IconX size={14} />
                  </button>
                )}
              </form>
            </div>

            {hasQuery && (
              <div className="px-4 pb-2">
                <TabsList className="w-full !h-11 bg-transparent">
                  <TabsTrigger value="people" className="flex-1 text-sm">
                    People {userResults.length > 0 && `(${userResults.length})`}
                  </TabsTrigger>
                  <TabsTrigger value="questions" className="flex-1 text-sm">
                    Questions
                  </TabsTrigger>
                  <TabsTrigger value="answers" className="flex-1 text-sm">
                    Answers {answerResults.length > 0 && `(${answerResults.length})`}
                  </TabsTrigger>
                </TabsList>
              </div>
            )}
          </div>

          <AnimatePresence mode="wait">
            {!hasQuery ? (
              /* Recent Searches */
              <motion.div
                key="recent"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="px-4 pt-4"
              >
                {recent.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-sm font-semibold">Recent searches</h2>
                      <Button
                        variant="ghost"
                        size="default"
                        onClick={clear}
                        className="text-xs text-muted-foreground"
                      >
                        Clear all
                      </Button>
                    </div>
                    <motion.div
                      variants={staggerContainer}
                      initial="initial"
                      animate="animate"
                      className="space-y-1"
                    >
                      {recent.map((term) => (
                        <motion.button
                          key={term}
                          variants={staggerItemVariants}
                          onClick={() => handleRecentClick(term)}
                          className="flex items-center gap-3 w-full px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors text-left"
                        >
                          <IconSearch size={14} className="text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{term}</span>
                        </motion.button>
                      ))}
                    </motion.div>
                  </div>
                )}

                {recent.length === 0 && (
                  <EmptyState
                    icon={IconSearch}
                    title="Search Exotic"
                    description="Find people, questions, and answers across the platform."
                  />
                )}
              </motion.div>
            ) : (
              /* Search Results */
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {isSearching ? (
                  <div className="flex items-center justify-center py-16">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                      className="w-5 h-5 border-2 border-foreground border-t-transparent rounded-full"
                    />
                  </div>
                ) : (
                  <>
                    <TabsContent value="people">
                      {userResults.length === 0 ? (
                        <EmptyState
                          icon={IconUser}
                          title="No people found"
                          description={`No results for "${debouncedQuery}". Try a different search term.`}
                        />
                      ) : (
                        <motion.div
                          variants={staggerContainer}
                          initial="initial"
                          animate="animate"
                        >
                          {userResults.map((user) => (
                            <UserCard key={user.id} user={user} />
                          ))}
                        </motion.div>
                      )}
                    </TabsContent>

                    <TabsContent value="questions">
                      <EmptyState
                        icon={IconSearch}
                        title="No questions found"
                        description={`No results for "${debouncedQuery}". Try a different search term.`}
                      />
                    </TabsContent>

                    <TabsContent value="answers">
                      {answerResults.length === 0 ? (
                        <EmptyState
                          icon={IconSearch}
                          title="No answers found"
                          description={`No results for "${debouncedQuery}". Try a different search term.`}
                        />
                      ) : (
                        <motion.div
                          variants={staggerContainer}
                          initial="initial"
                          animate="animate"
                          className="divide-y divide-muted/50"
                        >
                          {answerResults.map((answer) => (
                            <AnswerCard key={answer.id} answer={answer} />
                          ))}
                        </motion.div>
                      )}
                    </TabsContent>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </Tabs>
      </div>
    </AppShell>
  );
}
