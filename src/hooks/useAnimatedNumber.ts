import { useEffect, useRef, useState } from "react";

/**
 * Smoothly animates a number from its previous value to the target value.
 * Uses requestAnimationFrame for 60fps fluid animation.
 */
export function useAnimatedNumber(
  target: number,
  duration: number = 600,
  decimals: number = 2
): number {
  const [current, setCurrent] = useState(target);
  const animationRef = useRef<number | null>(null);
  const startRef = useRef(current);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = current;
    startTimeRef.current = null;

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3);

      const value = startRef.current + (target - startRef.current) * eased;
      setCurrent(value);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setCurrent(target);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return Number(current.toFixed(decimals));
}
