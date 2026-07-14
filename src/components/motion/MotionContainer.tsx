import { motion } from "framer-motion";
import type { ReactNode } from "react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.02,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1] as const,
    },
  },
};

interface MotionContainerProps {
  children: ReactNode;
  className?: string;
}

/** Wraps a page — animates the whole section with staggered children */
export function MotionPage({ children, className }: MotionContainerProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Each direct child item that should animate in sequence */
export function MotionItem({ children, className }: MotionContainerProps) {
  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  );
}

/** Grid/list container with staggered children */
export function MotionGrid({ children, className }: MotionContainerProps) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: 0.04, delayChildren: 0.01 },
        },
      }}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Grid child item */
export function MotionGridItem({ children, className }: MotionContainerProps) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, scale: 0.96 },
        visible: {
          opacity: 1,
          scale: 1,
          transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
