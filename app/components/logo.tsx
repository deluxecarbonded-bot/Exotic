import { motion } from 'framer-motion';

const floatAnimation = {
  animate: {
    y: [0, -5, 0],
    transition: {
      duration: 3.2,
      repeat: Infinity,
      ease: [0.45, 0, 0.55, 1],
      repeatType: 'loop' as const,
    },
  },
};

export function ExoticLogo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <motion.div
      className={`logo-bubble inline-flex items-center justify-center rounded-2xl ${className}`}
      style={{ width: size, height: size }}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1, y: [0, -5, 0] }}
      transition={{
        scale: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
        opacity: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
        y: {
          duration: 3.2,
          repeat: Infinity,
          ease: [0.45, 0, 0.55, 1],
          repeatType: 'loop',
          delay: 0.5,
        },
      }}
    >
      <svg
        width={size * 0.7}
        height={size * 0.7}
        viewBox="0 0 48 48"
        fill="none"
      >
        {/* Message bubble body */}
        <path
          d="M6 8C6 5.79 7.79 4 10 4h28c2.21 0 4 1.79 4 4v24c0 2.21-1.79 4-4 4H16l-7 7V36h1c-2.21 0-4-1.79-4-4V8z"
          fill="currentColor"
        />
        {/* Question mark curve */}
        <path
          d="M20.5 14.5C20.5 11.5 22.5 9.5 25 9.5C27.5 9.5 29.5 11.5 29.5 14C29.5 16.5 27.5 17.5 26 18.5C25.2 19 24.5 19.8 24.5 21V22"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        {/* Question mark dot */}
        <circle cx="24.5" cy="26.5" r="2" fill="white" />
      </svg>
    </motion.div>
  );
}

export function ExoticWordmark({ className = '' }: { className?: string }) {
  return (
    <motion.span
      className={`text-xl font-black tracking-tight ${className}`}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      Exotic
    </motion.span>
  );
}
