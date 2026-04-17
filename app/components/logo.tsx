import { motion } from 'framer-motion';

export function ExoticLogo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={`logo-svg ${className}`}
      style={{ overflow: 'visible' }}
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
          delay: 0.6,
        },
      }}
    >
      {/* Bubble body — rounded rect + tail */}
      <path
        className="logo-bubble-body"
        d="M6 2H34C36.209 2 38 3.791 38 6V27C38 29.209 36.209 31 34 31H16L8 38V31H6C3.791 31 2 29.209 2 27V6C2 3.791 3.791 2 6 2Z"
      />

      {/* Top-edge glass highlight (only rendered in glass mode) */}
      <path
        className="logo-bubble-highlight"
        d="M7.5 3.5H32.5C34.709 3.5 36 4.5 36.5 6V9C33 7 20 6.5 7 7V6C7 4.619 7.5 3.5 7.5 3.5Z"
      />

      {/* Question mark */}
      <path
        className="logo-bubble-icon"
        d="M15.5 16C15.5 12.5 17.8 10 20.5 10C23.2 10 25.5 12.5 25.5 15.2C25.5 17.8 23 19 21.5 20.2C20.7 20.8 20.5 21.6 20.5 22.5V23.5"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <circle className="logo-bubble-icon-dot" cx="20.5" cy="27.5" r="1.6" />
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
