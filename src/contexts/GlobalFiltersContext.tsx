import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { subDays } from "date-fns";
import { resolvePreset, type DatePreset } from "@/hooks/useDateFilter";

export type BusinessSegment = "infoproduto" | "saas";

interface GlobalFiltersValue {
  adAccountId: string;
  setAdAccountId: (value: string) => void;
  preset: DatePreset;
  setPreset: (value: DatePreset) => void;
  customRange: { from: Date; to: Date };
  setCustomRange: (value: { from: Date; to: Date }) => void;
  startDate: Date;
  endDate: Date;
  segment: BusinessSegment;
  setSegment: (value: BusinessSegment) => void;
}

const STORAGE_KEY = "growdash:global-filters";
const GlobalFiltersContext = createContext<GlobalFiltersValue | null>(null);

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    return {
      adAccountId: typeof value.adAccountId === "string" ? value.adAccountId : "all",
      preset: (value.preset || "today_yesterday") as DatePreset,
      customRange: {
        from: value.customRange?.from ? new Date(value.customRange.from) : subDays(new Date(), 30),
        to: value.customRange?.to ? new Date(value.customRange.to) : new Date(),
      },
      segment: value.segment === "saas" ? "saas" as const : "infoproduto" as const,
    };
  } catch {
    return null;
  }
}

export function GlobalFiltersProvider({ children }: { children: ReactNode }) {
  const stored = typeof window === "undefined" ? null : readStored();
  const [adAccountId, setAdAccountId] = useState(stored?.adAccountId ?? "all");
  const [preset, setPreset] = useState<DatePreset>(stored?.preset ?? "today_yesterday");
  const [customRange, setCustomRange] = useState(stored?.customRange ?? {
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [segment, setSegment] = useState<BusinessSegment>(stored?.segment ?? "infoproduto");

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ adAccountId, preset, customRange, segment }));
      // Mantém compatibilidade com telas antigas durante a migração.
      localStorage.setItem("dash:account", adAccountId);
      localStorage.setItem("dash:date", JSON.stringify({
        preset,
        from: customRange.from.toISOString(),
        to: customRange.to.toISOString(),
      }));
    } catch {
      // A plataforma continua funcional quando o navegador bloqueia storage.
    }
  }, [adAccountId, preset, customRange, segment]);

  const dates = useMemo(() => resolvePreset(preset, customRange), [preset, customRange]);
  const value = useMemo<GlobalFiltersValue>(() => ({
    adAccountId,
    setAdAccountId,
    preset,
    setPreset,
    customRange,
    setCustomRange,
    startDate: dates.startDate,
    endDate: dates.endDate,
    segment,
    setSegment,
  }), [adAccountId, preset, customRange, dates.startDate, dates.endDate, segment]);

  return <GlobalFiltersContext.Provider value={value}>{children}</GlobalFiltersContext.Provider>;
}

export function useGlobalFilters() {
  const context = useContext(GlobalFiltersContext);
  if (!context) throw new Error("useGlobalFilters deve ser usado dentro de GlobalFiltersProvider");
  return context;
}
