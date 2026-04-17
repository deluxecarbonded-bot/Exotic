import { motion } from 'framer-motion';

export function ExoticLogo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <motion.div
      className={`logo-bubble inline-flex items-center justify-center rounded-2xl flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{
        scale: 1,
        opacity: 1,
        y: [0, -4, 0],
      }}
      transition={{
        scale: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] },
        opacity: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] },
        y: {
          duration: 3.0,
          repeat: Infinity,
          ease: [0.45, 0, 0.55, 1],
          repeatType: 'loop',
          delay: 0.5,
        },
      }}
    >
      {/* Question mark only — container div provides the bubble shape */}
      <svg
        width={size * 0.52}
        height={size * 0.52}
        viewBox="0 0 24 24"
        fill="none"
        className="logo-bubble-icon"
      >
        <path
          d="M9.5 8.5C9.5 6.567 10.9 5 12.5 5C14.1 5 15.5 6.567 15.5 8C15.5 9.433 14.1 10.2 13 11C12.4 11.4 12 12 12 12.5V13.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx="12" cy="17" r="1.1" fill="currentColor" />
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
