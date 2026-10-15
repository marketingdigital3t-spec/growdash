type Rgb = { r: number; g: number; b: number };

const GOAL_RED: Rgb = { r: 239, g: 68, b: 68 };
const GOAL_YELLOW: Rgb = { r: 245, g: 158, b: 11 };
const GOAL_GREEN: Rgb = { r: 34, g: 197, b: 94 };

export function goalPercentage(value: number, target: number) {
  if (!Number.isFinite(value) || !Number.isFinite(target) || target <= 0) return 0;
  return Math.max(value / target * 100, 0);
}

/** Width is capped at the track boundary; the displayed percentage is not. */
export function goalProgress(value: number, target: number) {
  return Math.min(goalPercentage(value, target), 100);
}

function interpolateColor(from: Rgb, to: Rgb, progress: number): Rgb {
  const clamped = Math.min(Math.max(progress, 0), 1);
  return {
    r: Math.round(from.r + (to.r - from.r) * clamped),
    g: Math.round(from.g + (to.g - from.g) * clamped),
    b: Math.round(from.b + (to.b - from.b) * clamped),
  };
}

/** Red at zero, yellow at the midpoint and green as the target is reached. */
export function goalColorForPercentage(percentage: number) {
  const safePercentage = Number.isFinite(percentage) ? Math.max(0, percentage) : 0;
  const color = safePercentage <= 50
    ? interpolateColor(GOAL_RED, GOAL_YELLOW, safePercentage / 50)
    : interpolateColor(GOAL_YELLOW, GOAL_GREEN, Math.min((safePercentage - 50) / 30, 1));
  return `rgb(${color.r} ${color.g} ${color.b})`;
}
