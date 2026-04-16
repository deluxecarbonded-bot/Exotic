import type { Route } from "./+types/inbox";
import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppShell } from "~/components/layout/app-shell";
import { QuestionCard, EmptyState } from "~/components/cards";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { Badge } from "~/components/ui/badge";
import { IconInbox, IconCheck, IconX } from "~/components/icons";
import { useQuestionStore } from "~/stores/question-store";
import { useAuthStore } from "~/stores/auth-store";
import type { Question } from "~/types";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Inbox - Exotic" },
    { name: "description", content: "Your received questions" },
  ];
}

function AnswerForm({
  question,
  onSubmit,
  onCancel,
}: {
  question: Question;
  onSubmit: (content: string) => void;
  onCancel: () => void;
}) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    await onSubmit(content.trim());
    setSubmitting(false);
  };

  return (
    <div className="bg-background p-4 sm:p-6">
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
            <span className="text-xs font-bold text-muted-foreground">?</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {question.is_anonymous ? "Anonymous" : question.sender?.display_name}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{question.content}</p>
      </div>

      <div className="space-y-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your answer..."
          className="w-full min-h-[100px] resize-none rounded-lg bg-muted/50 p-3 text-sm placeholder:text-muted-foreground focus:outline-none"
          autoFocus
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {content.length} characters
          </span>
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="px-5 py-2.5 text-sm font-medium rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors"
              onClick={onCancel}
            >
              Cancel
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="px-5 py-2.5 text-sm font-medium rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-40"
              onClick={handleSubmit}
              disabled={!content.trim() || submitting}
            >
              {submitting ? "Posting..." : "Post answer"}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InboxSkeleton() {
  return (
    <div className="space-y-px">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-background p-4 sm:p-6 animate-pulse">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-muted rounded-full" />
            <div className="h-3 w-20 bg-muted rounded" />
          </div>
          <div className="space-y-2 mb-4">
            <div className="h-3 w-full bg-muted rounded" />
            <div className="h-3 w-3/4 bg-muted rounded" />
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-20 bg-muted rounded" />
            <div className="h-8 w-20 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function InboxPage() {
  const { inbox, isLoading, answerQuestion, deleteQuestion, fetchInbox } =
    useQuestionStore();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState("pending");
  const [answeringId, setAnsweringId] = useState<string | null>(null);

  // Fetch inbox on mount
  useEffect(() => {
    if (user?.id) {
      fetchInbox(user.id);
    }
  }, [user?.id]);

  const pendingQuestions = useMemo(
    () => inbox.filter((q) => !q.is_answered),
    [inbox]
  );
  const answeredQuestions = useMemo(
    () => inbox.filter((q) => q.is_answered),
    [inbox]
  );

  const handleAnswer = (id: string) => {
    setAnsweringId(id);
  };

  const handleSubmitAnswer = async (questionId: string, content: string) => {
    if (!user?.id) return;
    await answerQuestion(questionId, content, user.id);
    setAnsweringId(null);
  };

  const handleDelete = async (id: string) => {
    await deleteQuestion(id);
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">Inbox</h1>
            {pendingQuestions.length > 0 && (
              <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-foreground text-background">
                {pendingQuestions.length}
              </span>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="px-4">
            <TabsList variant="line" className="w-full">
              <TabsTrigger value="pending" className="flex-1 gap-2">
                Pending
                {pendingQuestions.length > 0 && (
                  <Badge
                    variant="default"
                    className="ml-1 text-[10px] h-4 min-w-[16px] px-1"
                  >
                    {pendingQuestions.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="answered" className="flex-1">
                Answered
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="pending">
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="skeleton"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <InboxSkeleton />
                </motion.div>
              ) : pendingQuestions.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <EmptyState
                    icon={IconInbox}
                    title="No pending questions"
                    description="Share your profile link to start receiving anonymous questions from anyone."
                  />
                </motion.div>
              ) : (
                <div
                  key="list"
                  className="divide-y divide-muted/50"
                >
                  <AnimatePresence>
                    {pendingQuestions.map((question) =>
                      answeringId === question.id ? (
                        <AnswerForm
                          key={`answer-${question.id}`}
                          question={question}
                          onSubmit={(content) =>
                            handleSubmitAnswer(question.id, content)
                          }
                          onCancel={() => setAnsweringId(null)}
                        />
                      ) : (
                        <QuestionCard
                          key={question.id}
                          question={question}
                          onAnswer={handleAnswer}
                          onDelete={handleDelete}
                        />
                      )
                    )}
                  </AnimatePresence>
                </div>
              )}
            </AnimatePresence>
          </TabsContent>

          <TabsContent value="answered">
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="skeleton"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <InboxSkeleton />
                </motion.div>
              ) : answeredQuestions.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <EmptyState
                    icon={IconCheck}
                    title="No answered questions yet"
                    description="Questions you answer will appear here. Start by answering some pending questions."
                  />
                </motion.div>
              ) : (
                <div
                  key="list"
                  className="divide-y divide-muted/50"
                >
                  {answeredQuestions.map((question) => (
                    <QuestionCard key={question.id} question={question} />
                  ))}
                </div>
              )}
            </AnimatePresence>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
