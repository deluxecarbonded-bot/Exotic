import { motion } from 'framer-motion';

export function ExoticLogo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {/* Message bubble body - filled rounded rectangle */}
      <motion.path
        d="M6 8C6 5.79 7.79 4 10 4h28c2.21 0 4 1.79 4 4v24c0 2.21-1.79 4-4 4H16l-7 7V36h1c-2.21 0-4-1.79-4-4V8z"
        fill="currentColor"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
      />

      {/* Question mark - centered inside bubble */}
      <motion.path
        d="M20.5 14.5C20.5 11.5 22.5 9.5 25 9.5C27.5 9.5 29.5 11.5 29.5 14C29.5 16.5 27.5 17.5 26 18.5C25.2 19 24.5 19.8 24.5 21V22"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className="mix-blend-difference"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ delay: 0.35, duration: 0.6, ease: 'easeOut' }}
      />

      {/* Question mark dot */}
      <motion.circle
        cx="24.5"
        cy="26.5"
        r="2"
        fill="currentColor"
        className="mix-blend-difference"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
      />
    </motion.svg>
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
