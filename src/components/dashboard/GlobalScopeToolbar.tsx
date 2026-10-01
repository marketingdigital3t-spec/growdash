import { useMemo } from "react";
import { format } from "date-fns";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useRDFunnels } from "@/hooks/useRDFunnels";
import { AccountMultiSelect } from "@/components/dashboard/AccountMultiSelect";
import { CampaignMultiSelect } from "@/components/dashboard/CampaignMultiSelect";
import { MetaDateRangePicker } from "@/components/dashboard/MetaDateRangePicker";

/** Shared scope controls rendered by the authenticated shell on every module. */
export function GlobalScopeToolbar({ syncing = false }: { syncing?: boolean }) {
  const { adAccountIds, setAdAccountIds, funnelIds, setFunnelIds, preset, setPreset, customRange, setCustomRange, startDate, endDate } = useGlobalFilters();
  const { data: accounts = [] } = useAdAccounts();
  // Keep RD-only funnels visible in the selector. When an ad account is
  // selected, the data queries apply the account/funnel intersection and do
  // not silently attribute an unlinked funnel to that Meta account.
  const { data: funnels = [] } = useRDFunnels();
  const activeFunnels = useMemo(
    () => funnels.filter((funnel) => funnel.is_active && !!funnel.rd_funnel_id),
    [funnels],
  );
  const activeFunnelIds = useMemo(() => new Set(activeFunnels.map((funnel) => funnel.id)), [activeFunnels]);
  const safeFunnelIds = funnelIds.filter((id) => activeFunnelIds.has(id));

  return (
    <div className="gd-global-scope-toolbar mb-4 flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card/80 p-2 shadow-sm">
      <AccountMultiSelect
        accounts={accounts.map((account) => ({ id: account.id, name: account.name, connection_status: account.connection_status }))}
        selectedIds={adAccountIds}
        onChange={setAdAccountIds}
        className="min-h-9 sm:h-9"
        ariaLabel="Filtrar por contas Meta"
      />
      <CampaignMultiSelect
        campaigns={activeFunnels.map((funnel) => ({ id: funnel.id, name: funnel.name }))}
        selectedIds={safeFunnelIds}
        onChange={setFunnelIds}
        placeholder="Todos os funis RD"
        entityLabel="funil"
        className="min-h-9 sm:h-9"
      />
      <MetaDateRangePicker
        preset={preset}
        onPresetChange={setPreset}
        customRange={customRange}
        onCustomRangeChange={setCustomRange}
        startDate={startDate}
        endDate={endDate}
        className="min-h-9 sm:h-9"
      />
      {syncing && (
        <span role="status" aria-live="polite" className="order-last inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold text-amber-400 sm:order-none">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" aria-hidden="true" />
          Sincronizando
        </span>
      )}
      <span className="ml-auto hidden text-[11px] text-muted-foreground lg:inline">
        {format(startDate, "dd/MM/yyyy")} – {format(endDate, "dd/MM/yyyy")} · São Paulo
      </span>
    </div>
  );
}
