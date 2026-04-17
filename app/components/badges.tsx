import { motion } from 'framer-motion';

export function VerifiedBadge() {
  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold tracking-wide bg-blue-500/15 text-blue-500 border border-blue-500/30 select-none"
      title="Verified"
    >
      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.293 7.293l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L10.586 12.586l4.293-4.293a1 1 0 011.414 1.414z" />
      </svg>
      VERIFIED
    </motion.span>
  );
}

export function OwnerBadge() {
  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold tracking-wide bg-amber-500/15 text-amber-500 border border-amber-500/30 select-none"
      title="Owner"
    >
      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
        <path d="M2 19h20M4 19l2-9 5 5 3-8 3 8 5-5 2 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx="12" cy="5" r="1.8" />
        <circle cx="4.5" cy="10.5" r="1.8" />
        <circle cx="19.5" cy="10.5" r="1.8" />
      </svg>
      OWNER
    </motion.span>
  );
}
