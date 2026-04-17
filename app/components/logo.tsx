import { motion } from 'framer-motion';
import { MessageSquareMore } from 'lucide-react';

export function ExoticLogo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <motion.div
      className={`logo-icon ${className}`}
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
      <MessageSquareMore
        size={size}
        strokeWidth={1.8}
        className="logo-icon-svg"
      />
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
