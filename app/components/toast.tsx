import { AnimatePresence, motion } from 'framer-motion';
import { useToastStore } from '~/stores/toast-store';

function SuccessIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="10" cy="10" r="10" fill="#22c55e" />
      <path
        d="M6 10.5l2.5 2.5L14 7.5"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="10" cy="10" r="10" fill="#ef4444" />
      <path
        d="M7 7l6 6M13 7l-6 6"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="10" cy="10" r="10" fill="#3b82f6" />
      <path
        d="M10 9v4"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="10" cy="6.5" r="1.2" fill="#fff" />
    </svg>
  );
}

const iconMap = {
  success: SuccessIcon,
  error: ErrorIcon,
  info: InfoIcon,
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-60 flex flex-col items-center gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const Icon = iconMap[toast.type];
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.95 }}
              transition={{
                type: 'spring',
                stiffness: 380,
                damping: 28,
                mass: 0.8,
              }}
              onClick={() => removeToast(toast.id)}
              className="glass-toast pointer-events-auto cursor-pointer flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-sm font-medium shadow-lg max-w-sm bg-white text-black dark:bg-black dark:text-white"
              style={{ willChange: 'transform, opacity' }}
            >
              <span className="shrink-0">
                <Icon />
              </span>
              <span className="truncate">{toast.message}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
