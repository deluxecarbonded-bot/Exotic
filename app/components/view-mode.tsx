import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router';
import { useAuthStore } from '~/stores/auth-store';
import { useState, createContext, useContext, useCallback } from 'react';
import { IconX } from '~/components/icons';

const ViewModeContext = createContext(false);

export function useIsViewMode() {
  return useContext(ViewModeContext);
}

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  const { isViewMode } = useAuthStore();
  return (
    <ViewModeContext.Provider value={isViewMode}>
      {children}
    </ViewModeContext.Provider>
  );
}

/** Wraps any interactive element — in view mode, intercepts the click and shows login prompt */
export function ViewModeGate({ children, className }: { children: React.ReactNode; className?: string }) {
  const isViewMode = useIsViewMode();
  const [showPrompt, setShowPrompt] = useState(false);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!isViewMode) return;
    e.preventDefault();
    e.stopPropagation();
    setShowPrompt(true);
  }, [isViewMode]);

  if (!isViewMode) return <>{children}</>;

  return (
    <>
      <div onClick={handleClick} className={className}>
        {children}
      </div>
      <AnimatePresence>
        {showPrompt && <LoginPromptModal onClose={() => setShowPrompt(false)} />}
      </AnimatePresence>
    </>
  );
}

/** A bottom-sheet login prompt */
export function LoginPromptModal({ onClose }: { onClose: () => void }) {
  return (
    <>
      <motion.div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl shadow-2xl overflow-hidden"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <div className="px-6 pt-2 pb-8 text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 ghost-btn w-8 h-8 flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <IconX size={16} />
          </button>
          <h2 className="text-lg font-bold mb-1">Join Exotic</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Sign in to like, comment, share, and interact with posts.
          </p>
          <div className="flex flex-col gap-3 max-w-xs mx-auto">
            <Link
              to="/login"
              className="w-full py-3 bg-foreground text-background rounded-xl font-semibold text-sm text-center transition-opacity hover:opacity-90"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="w-full py-3 bg-muted text-foreground rounded-xl font-semibold text-sm text-center transition-opacity hover:opacity-90"
            >
              Create Account
            </Link>
          </div>
        </div>
      </motion.div>
    </>
  );
}

/** Fixed bottom banner for view mode pages */
export function ViewModeBanner() {
  const isViewMode = useIsViewMode();
  if (!isViewMode) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-foreground text-background px-4 py-3 text-center safe-area-bottom">
      <div className="flex items-center justify-center gap-3 max-w-md mx-auto">
        <p className="text-xs font-medium">Sign in to interact</p>
        <Link
          to="/login"
          className="px-4 py-1.5 bg-background text-foreground rounded-full text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          Sign In
        </Link>
      </div>
    </div>
  );
}
