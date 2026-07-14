import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface MotionCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

/** Interactive card with subtle hover lift and tap feedback */
export function MotionCard({ children, className, onClick }: MotionCardProps) {
  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: "0 8px 24px -8px rgba(0,0,0,0.08)" }}
      whileTap={onClick ? { scale: 0.985 } : undefined}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}
