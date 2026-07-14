import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  locale?: string;
  className?: string;
}

export function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  decimals = 2,
  duration = 600,
  locale = "pt-BR",
  className,
}: AnimatedNumberProps) {
  const animated = useAnimatedNumber(value, duration, decimals);

  const formatted =
    decimals === 0
      ? Math.round(animated).toLocaleString(locale)
      : animated.toLocaleString(locale, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        });

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
