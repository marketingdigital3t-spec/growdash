type Rgb = { r: number; g: number; b: number };

export interface MonthlySalesGoalRecord {
  ad_account_id: string;
  goal_month: string;
  target_revenue: number;
  [key: string]: unknown;
}

/**
 * Resolve the effective goal for each account without mutating history.
 * A month inherits the closest previous record until it receives its own
 * explicit record. Calendar keys are compared as civil dates so the result is
 * stable regardless of the browser timezone.
 */
export function resolveEffectiveSalesGoals<T extends MonthlySalesGoalRecord>(records: T[], selectedMonth: string) {
  const selectedKey = selectedMonth.slice(0, 7);
  const latestByAccount = new Map<string, T>();
  for (const record of records) {
    const recordKey = String(record.goal_month).slice(0, 7);
    if (!record.ad_account_id || recordKey > selectedKey) continue;
    const current = latestByAccount.get(record.ad_account_id);
    if (!current || String(current.goal_month).slice(0, 7) < recordKey) latestByAccount.set(record.ad_account_id, record);
  }
  return Array.from(latestByAccount.values()).map((record) => ({
    ...record,
    target_revenue: Number(record.target_revenue),
    source_goal_month: record.goal_month,
    is_inherited: String(record.goal_month).slice(0, 7) < selectedKey,
  }));
}

/**
 * An inherited value is already effective for the selected month. Persist a
 * row only when the person actually changes that value; this keeps the
 * previous month's history authoritative until an explicit override exists.
 */
export function shouldPersistSalesGoal({ draftTarget, currentTarget, isInherited }: { draftTarget: number; currentTarget?: number; isInherited: boolean }) {
  if (!Number.isFinite(draftTarget) || draftTarget <= 0) return false;
  return !(isInherited && Number.isFinite(currentTarget) && draftTarget === currentTarget);
}

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

export type GoalRevenueDisplayState = "pending" | "unavailable" | "stale" | "ready";

export function goalRevenueDisplayState({ loading, error, snapshot }: { loading: boolean; error: boolean; snapshot: boolean }): GoalRevenueDisplayState {
  if (error) return snapshot ? "stale" : "unavailable";
  if (loading && !snapshot) return "pending";
  return "ready";
}
