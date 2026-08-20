import { useState, useMemo, useEffect } from "react";
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

export function resolvePreset(preset: DatePreset, customRange: { from: Date; to: Date }) {
  const today = startOfDay(new Date());
  const endToday = endOfDay(today);
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
      return { startDate: startOfDay(customRange.from), endDate: endOfDay(customRange.to) };
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
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date }>({
    from: stored?.from ? new Date(stored.from) : subDays(new Date(), 30),
    to: stored?.to ? new Date(stored.to) : new Date(),
  });

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
