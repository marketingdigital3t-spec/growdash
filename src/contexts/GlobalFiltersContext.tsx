import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from "react";
import { normalizeCustomDateRange, resolvePreset, type DatePreset } from "@/hooks/useDateFilter";
import { businessDateKey } from "@/lib/businessDate";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useRDFunnels } from "@/hooks/useRDFunnels";
import { useRDAccountConnections } from "@/hooks/useRDAccountConnections";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { NO_LINKED_RD_FUNNEL_SCOPE_ID, resolveLinkedRDFunnelIds } from "@/lib/rdAccountScope";

export type BusinessSegment = "infoproduto" | "saas";

interface GlobalFiltersValue {
  adAccountId: string;
  setAdAccountId: (value: string) => void;
  adAccountIds: string[];
  setAdAccountIds: (values: string[]) => void;
  funnelIds: string[];
  setFunnelIds: (values: string[]) => void;
  preset: DatePreset;
  setPreset: (value: DatePreset) => void;
  customRange: { from: Date; to: Date };
  setCustomRange: (value: { from: Date; to: Date }) => void;
  startDate: Date;
  endDate: Date;
  segment: BusinessSegment;
  setSegment: (value: BusinessSegment) => void;
  workspaceId?: string;
  businessUnitId?: string;
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
      adAccountIds: Array.isArray(value.adAccountIds) ? value.adAccountIds.filter((id: unknown): id is string => typeof id === "string") : [],
      funnelIds: Array.isArray(value.funnelIds) ? value.funnelIds.filter((id: unknown): id is string => typeof id === "string") : [],
      preset: (value.preset || "today_yesterday") as DatePreset,
      customRange: normalizeCustomDateRange({
        from: value.customRange?.from ? new Date(value.customRange.from) : undefined,
        to: value.customRange?.to ? new Date(value.customRange.to) : undefined,
      }),
      segment: value.segment === "saas" ? "saas" as const : "infoproduto" as const,
    };
  } catch {
    return null;
  }
}

export function GlobalFiltersProvider({ children }: { children: ReactNode }) {
  const { data: workspace, isLoading: loadingWorkspace } = useWorkspace();
  const { data: rdFunnels = [], isLoading: loadingRDFunnels } = useRDFunnels(undefined, true);
  const { data: rdConnections = [], isLoading: loadingRDConnections } = useRDAccountConnections(workspace?.id);
  const { data: adAccounts = [], isLoading: loadingAdAccounts } = useAdAccounts();
  const accountScopeReady = !loadingWorkspace && !!workspace?.id && !loadingRDFunnels && !loadingRDConnections && !loadingAdAccounts;
  const stored = typeof window === "undefined" ? null : readStored();
  const [adAccountIds, setAdAccountIds] = useState<string[]>(() => stored?.adAccountIds?.length ? stored.adAccountIds : stored?.adAccountId && stored.adAccountId !== "all" ? [stored.adAccountId] : []);
  const [storedFunnelIds, setStoredFunnelIds] = useState<string[]>(() => stored?.funnelIds ?? []);
  const resolvedFunnelIds = useMemo(
    () => accountScopeReady
      ? resolveLinkedRDFunnelIds(adAccountIds, adAccounts, rdConnections, rdFunnels)
      : adAccountIds.length ? [NO_LINKED_RD_FUNNEL_SCOPE_ID] : storedFunnelIds,
    [accountScopeReady, adAccountIds, adAccounts, rdConnections, rdFunnels, storedFunnelIds],
  );
  const setFunnelIds = useCallback((value: string[] | ((current: string[]) => string[])) => {
    setStoredFunnelIds((current) => typeof value === "function" ? value(current) : value);
  }, []);
  const funnelIds = resolvedFunnelIds;
  const adAccountId = adAccountIds.length === 1 ? adAccountIds[0] : "all";
  const setAdAccountId = useCallback((value: string) => setAdAccountIds(value === "all" ? [] : [value]), []);
  const [preset, setPreset] = useState<DatePreset>(stored?.preset ?? "today_yesterday");
  const [customRange, setStoredCustomRange] = useState(() => normalizeCustomDateRange(stored?.customRange));
  const [clockNow, setClockNow] = useState(() => new Date());
  const setCustomRange = useCallback((value: { from: Date; to: Date }) => {
    setStoredCustomRange(normalizeCustomDateRange(value));
  }, []);
  const [segment, setSegment] = useState<BusinessSegment>(stored?.segment ?? "infoproduto");

  // A conta Meta is the only visible global scope control. Once its RD link
  // is loaded, keep the CRM scope in lockstep so every module shows the Meta
  // and RD data belonging to that account without a second funnel selector.
  useEffect(() => {
    if (!accountScopeReady) return;
    setStoredFunnelIds((current) => current.length === resolvedFunnelIds.length && current.every((id, index) => id === resolvedFunnelIds[index]) ? current : resolvedFunnelIds);
  }, [accountScopeReady, resolvedFunnelIds]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ adAccountId, adAccountIds, funnelIds, preset, customRange, segment }));
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
  }, [adAccountId, adAccountIds, funnelIds, preset, customRange, segment]);

  useEffect(() => {
    const refreshBusinessDay = () => {
      const now = new Date();
      setClockNow((current) => businessDateKey(current) === businessDateKey(now) ? current : now);
    };
    const interval = window.setInterval(refreshBusinessDay, 60_000);
    window.addEventListener("focus", refreshBusinessDay);
    document.addEventListener("visibilitychange", refreshBusinessDay);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshBusinessDay);
      document.removeEventListener("visibilitychange", refreshBusinessDay);
    };
  }, []);

  const dates = useMemo(() => resolvePreset(preset, customRange, clockNow), [preset, customRange, clockNow]);
  const businessUnitId = workspace?.units.find((unit) => unit.kind === segment)?.id;
  const value = useMemo<GlobalFiltersValue>(() => ({
    adAccountId,
    setAdAccountId,
    adAccountIds,
    setAdAccountIds,
    funnelIds,
    setFunnelIds,
    preset,
    setPreset,
    customRange,
    setCustomRange,
    startDate: dates.startDate,
    endDate: dates.endDate,
    segment,
    setSegment,
    workspaceId: workspace?.id,
    businessUnitId,
  }), [adAccountId, setAdAccountId, adAccountIds, funnelIds, setFunnelIds, preset, setCustomRange, customRange, dates.startDate, dates.endDate, segment, workspace?.id, businessUnitId]);

  return <GlobalFiltersContext.Provider value={value}>{children}</GlobalFiltersContext.Provider>;
}

export function useGlobalFilters() {
  const context = useContext(GlobalFiltersContext);
  if (!context) throw new Error("useGlobalFilters deve ser usado dentro de GlobalFiltersProvider");
  return context;
}
