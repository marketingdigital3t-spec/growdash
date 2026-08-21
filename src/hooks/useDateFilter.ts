import { useState, useMemo, useEffect, useCallback } from "react";
import {
  startOfDay,
  endOfDay,
  subDays,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfWeek,
  endOfWeek,
  subWeeks,
} from "date-fns";

export type DatePreset =
  | "today_yesterday"
  | "today"
  | "yesterday"
  | "7days"
  | "last_14_days"
  | "last_28_days"
  | "30days"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "max"
  | "custom";

export const PRESET_LABELS: Record<DatePreset, string> = {
  today_yesterday: "Hoje e ontem",
  today: "Hoje",
  yesterday: "Ontem",
  "7days": "Últimos 7 dias",
  last_14_days: "Últimos 14 dias",
  last_28_days: "Últimos 28 dias",
  "30days": "Últimos 30 dias",
  this_week: "Esta semana",
  last_week: "Semana passada",
  this_month: "Este mês",
  last_month: "Mês passado",
  max: "Máximo",
  custom: "Personalizado",
};

export type CustomDateRange = { from: Date; to: Date };

const isValidDate = (value: unknown): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime());

/**
 * Browser storage is an optimization, never a source of truth. A malformed
 * value must not propagate to a query key (`toISOString`) and take down the
 * module before its own error boundary can be shown.
 */
export function normalizeCustomDateRange(value: Partial<CustomDateRange> | null | undefined): CustomDateRange {
  const now = new Date();
  const from = isValidDate(value?.from) ? value.from : subDays(now, 30);
  const to = isValidDate(value?.to) ? value.to : now;
  return from.getTime() <= to.getTime() ? { from, to } : { from: to, to: from };
}

export function resolvePreset(preset: DatePreset, customRange: { from: Date; to: Date }) {
  const today = startOfDay(new Date());
  const endToday = endOfDay(today);
  const safeRange = normalizeCustomDateRange(customRange);
  switch (preset) {
    case "today_yesterday":
      return { startDate: subDays(today, 1), endDate: endToday };
    case "today":
      return { startDate: today, endDate: endToday };
    case "yesterday":
      return { startDate: subDays(today, 1), endDate: subDays(today, 1) };
    case "7days":
      return { startDate: subDays(today, 6), endDate: endToday };
    case "last_14_days":
      return { startDate: subDays(today, 13), endDate: endToday };
    case "last_28_days":
      return { startDate: subDays(today, 27), endDate: endToday };
    case "30days":
      return { startDate: subDays(today, 29), endDate: endToday };
    case "this_week":
      return { startDate: startOfWeek(today, { weekStartsOn: 1 }), endDate: endToday };
    case "last_week": {
      const lw = subWeeks(today, 1);
      return {
        startDate: startOfWeek(lw, { weekStartsOn: 1 }),
        endDate: endOfWeek(lw, { weekStartsOn: 1 }),
      };
    }
    case "this_month":
      return { startDate: startOfMonth(today), endDate: endToday };
    case "last_month": {
      const lastMonth = subMonths(today, 1);
      return { startDate: startOfMonth(lastMonth), endDate: endOfMonth(lastMonth) };
    }
    case "max":
      // “Máximo” is the complete operational history, not a rolling year.
      // The actual lower bound is additionally constrained by the oldest
      // record available in each provider, but the UI must never discard
      // older RD/Meta data on its own.
      return { startDate: new Date(2000, 0, 1), endDate: endToday };
    case "custom":
      return { startDate: startOfDay(safeRange.from), endDate: endOfDay(safeRange.to) };
    default:
      return { startDate: subDays(today, 29), endDate: new Date() };
  }
}

const STORAGE_KEY = "dash:date";

function readStored(): { preset: DatePreset; from: string; to: string } | null {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function useDateFilter() {
  const stored = readStored();
  const [preset, setPreset] = useState<DatePreset>(stored?.preset ?? "today_yesterday");
  const [customRange, setStoredCustomRange] = useState<CustomDateRange>(() => normalizeCustomDateRange({
    from: stored?.from ? new Date(stored.from) : undefined,
    to: stored?.to ? new Date(stored.to) : undefined,
  }));
  const setCustomRange = useCallback((value: CustomDateRange) => {
    setStoredCustomRange(normalizeCustomDateRange(value));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        preset,
        from: customRange.from.toISOString(),
        to: customRange.to.toISOString(),
      }));
    } catch { /* ignore */ }
  }, [preset, customRange]);

  const { startDate, endDate } = useMemo(
    () => resolvePreset(preset, customRange),
    [preset, customRange],
  );

  return { preset, setPreset, customRange, setCustomRange, startDate, endDate };
}
