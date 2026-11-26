import { motion, useReducedMotion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

/** Shared motion policy: Framer Motion also honors the OS preference globally per primitive. */
export function useMotionPolicy() {
  return useReducedMotion() ?? false;
}

const pageVariants = {
  hidden: { opacity: 0, y: 8, scale: 0.995 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.32, ease: [0.25, 0.1, 0.25, 1] as const, staggerChildren: 0.06, delayChildren: 0.02 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.99 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.32, ease: [0.25, 0.1, 0.25, 1] as const } },
};

interface MotionContainerProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  /** Disable the entrance animation while retaining layout and styling. */
  animateOnMount?: boolean;
  /** Opt a metric or surface into accent glow on hover. */
  glowOnHover?: boolean;
  /** Opt an interactive item into a subtle pressed state. */
  pressable?: boolean;
}

function reducedVariants(reduced: boolean, variants: typeof pageVariants | typeof itemVariants) {
  return reduced
    ? { hidden: { opacity: 1, y: 0, scale: 1 }, visible: { opacity: 1, y: 0, scale: 1 } }
    : variants;
}

/** Wraps a page with a restrained entrance and staggered direct children. */
export function MotionPage({ children, className, animateOnMount = true, ...props }: MotionContainerProps) {
  const reduced = useMotionPolicy();
  return (
    <motion.div
      variants={reducedVariants(reduced, pageVariants)}
      initial={animateOnMount && !reduced ? "hidden" : false}
      animate="visible"
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Each direct child item that should animate in sequence. */
export function MotionItem({ children, className, glowOnHover = false, pressable = false, ...props }: MotionContainerProps) {
  const reduced = useMotionPolicy();
  return (
    <motion.div
      variants={reducedVariants(reduced, itemVariants)}
      className={className}
      whileHover={!reduced && glowOnHover ? { y: -2, boxShadow: "0 0 24px -8px var(--palette-accent-bright)" } : undefined}
      whileTap={!reduced && pressable ? { scale: 0.985 } : undefined}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Grid/list container with staggered children. */
export function MotionGrid({ children, className, animateOnMount = true, ...props }: MotionContainerProps) {
  const reduced = useMotionPolicy();
  const variants = reduced
    ? { hidden: { opacity: 1 }, visible: { opacity: 1 } }
    : { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.01 } } };
  return (
    <motion.div variants={variants} initial={animateOnMount && !reduced ? "hidden" : false} animate="visible" className={className} {...props}>
      {children}
    </motion.div>
  );
}

/** Grid child item with optional hover glow and press feedback. */
export function MotionGridItem({ children, className, glowOnHover = false, pressable = false, ...props }: MotionContainerProps) {
  const reduced = useMotionPolicy();
  const variants = reduced
    ? { hidden: { opacity: 1, scale: 1 }, visible: { opacity: 1, scale: 1 } }
    : { hidden: { opacity: 0, scale: 0.985 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as const } } };
  return (
    <motion.div
      variants={variants}
      className={className}
      whileHover={!reduced && glowOnHover ? { y: -2, boxShadow: "0 0 24px -8px var(--palette-accent-bright)" } : undefined}
      whileTap={!reduced && pressable ? { scale: 0.985 } : undefined}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Phase marker with a short accent transition; useful on compact phase accents only. */
export function MotionPhase({ children, className, ...props }: MotionContainerProps) {
  const reduced = useMotionPolicy();
  return (
    <motion.div
      className={className}
      initial={false}
      animate={reduced ? { opacity: 1 } : { opacity: [0.82, 1] }}
      transition={reduced ? { duration: 0 } : { duration: 0.6, ease: "easeOut" }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Lightweight class/variant hook for controlled, non-continuous accent emphasis. */
export function MotionGlow({ children, className, ...props }: MotionContainerProps) {
  const reduced = useMotionPolicy();
  return (
    <motion.div
      className={className}
      animate={reduced ? { opacity: 1 } : { opacity: [0.88, 1, 0.88] }}
      transition={reduced ? { duration: 0 } : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
