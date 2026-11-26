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
  decimals,
  duration = 600,
  locale = "pt-BR",
  className,
}: AnimatedNumberProps) {
  // Counts (leads, sales, clicks, people) must never inherit a monetary
  // presentation such as `45,00`. Decimal values keep two places unless the
  // caller explicitly defines another precision.
  const resolvedDecimals = decimals ?? (Number.isInteger(value) ? 0 : 2);
  const animated = useAnimatedNumber(value, duration, resolvedDecimals);

  const formatted =
    resolvedDecimals === 0
      ? Math.round(animated).toLocaleString(locale)
      : animated.toLocaleString(locale, {
          minimumFractionDigits: resolvedDecimals,
          maximumFractionDigits: resolvedDecimals,
        });

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
