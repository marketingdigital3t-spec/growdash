import { format } from "date-fns";
import { businessCalendarDate } from "@/lib/businessDate";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { AccountMultiSelect } from "@/components/dashboard/AccountMultiSelect";
import { MetaDateRangePicker } from "@/components/dashboard/MetaDateRangePicker";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

/** Shared scope controls rendered by the authenticated shell on every module. */
export function GlobalScopeToolbar({ syncing = false, lastSyncAt = null, syncState = "idle" }: { syncing?: boolean; lastSyncAt?: Date | null; syncState?: string }) {
  const { adAccountIds, setAdAccountIds, preset, setPreset, customRange, setCustomRange, startDate, endDate } = useGlobalFilters();
  const { data: accounts = [] } = useAdAccounts();

  return (
    <div className="gd-global-scope-toolbar gd-filter-strip mb-4 flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card/80 p-2 shadow-sm">
      <AccountMultiSelect
        accounts={accounts.map((account) => ({ id: account.id, name: account.name, connection_status: account.connection_status }))}
        selectedIds={adAccountIds}
        onChange={setAdAccountIds}
        className="min-h-9 sm:h-9"
        ariaLabel="Filtrar por contas Meta"
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
        <span role="status" aria-live="polite" className="gd-scope-refresh-status order-last inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold sm:order-none">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" aria-hidden="true" />
          Atualizando conta/período
        </span>
      )}
      {!syncing && lastSyncAt && (
        <span role="status" className="gd-scope-refresh-status order-last inline-flex items-center rounded-md px-2 py-1 text-[10px] text-muted-foreground sm:order-none">
          Último snapshot: {formatDistanceToNow(lastSyncAt, { addSuffix: true, locale: ptBR })} · últimas 5h atualizadas
        </span>
      )}
      {!syncing && syncState === "error" && (
        <span role="status" className="gd-scope-refresh-status order-last inline-flex items-center rounded-md px-2 py-1 text-[10px] text-amber-700 sm:order-none">
          Snapshot anterior preservado · nova tentativa automática
        </span>
      )}
      <span className="ml-auto hidden text-[11px] text-muted-foreground lg:inline">
        {format(businessCalendarDate(startDate), "dd/MM/yyyy")} – {format(businessCalendarDate(endDate), "dd/MM/yyyy")} · São Paulo
      </span>
    </div>
  );
}
