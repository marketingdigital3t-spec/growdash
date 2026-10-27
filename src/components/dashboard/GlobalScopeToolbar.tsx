import { format } from "date-fns";
import { businessCalendarDate } from "@/lib/businessDate";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { AccountMultiSelect } from "@/components/dashboard/AccountMultiSelect";
import { MetaDateRangePicker } from "@/components/dashboard/MetaDateRangePicker";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shared scope controls rendered by the authenticated shell on every module. */
export function GlobalScopeToolbar({ syncing = false, lastSyncAt = null, syncState = "idle", syncError = null, onSyncNow = null }: { syncing?: boolean; lastSyncAt?: Date | null; syncState?: string; syncError?: string | null; onSyncNow?: (() => void) | null }) {
  const { adAccountIds, setAdAccountIds, preset, setPreset, customRange, setCustomRange, startDate, endDate } = useGlobalFilters();
  const { data: accounts = [] } = useAdAccounts();

  return (
    <div className="gd-global-scope-toolbar gd-filter-strip mb-4 flex min-w-0 flex-wrap items-center gap-2">
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
          Atualizando conta/período · histórico em blocos mensais
        </span>
      )}
      {!syncing && syncState === "background" && (
        <span role="status" aria-live="polite" className="gd-scope-refresh-status order-last inline-flex max-w-full items-center rounded-md px-2 py-1 text-[10px] font-semibold text-amber-700 sm:order-none">
          Atualização em segundo plano · último snapshot preservado
        </span>
      )}
      {!syncing && syncState !== "background" && lastSyncAt && (
        <span role="status" className="gd-scope-refresh-status order-last inline-flex items-center rounded-md px-2 py-1 text-[10px] text-muted-foreground sm:order-none">
          Atualizado às {format(lastSyncAt, "HH:mm")} · {formatDistanceToNow(lastSyncAt, { addSuffix: true, locale: ptBR })}
        </span>
      )}
      {!syncing && syncState === "error" && (
        <span role="status" className="gd-scope-refresh-status order-last inline-flex items-center rounded-md px-2 py-1 text-[10px] text-amber-700 sm:order-none">
          {syncError || "Snapshot anterior preservado · nova tentativa automática"}
        </span>
      )}
      {!syncing && syncState === "partial" && syncError && (
        <span role="status" className="gd-scope-refresh-status order-last inline-flex max-w-full items-center truncate rounded-md px-2 py-1 text-[10px] text-amber-700 sm:order-none" title={syncError}>
          Sincronização parcial: {syncError}
        </span>
      )}
      {onSyncNow && (
        <Button type="button" variant="outline" size="sm" className="order-last h-8 shrink-0 text-[10px] sm:order-none" onClick={onSyncNow} disabled={syncing} aria-label="Sincronizar agora">
          <RefreshCw className={syncing ? "mr-1.5 h-3.5 w-3.5 animate-spin" : "mr-1.5 h-3.5 w-3.5"} />
          {syncing ? "Sincronizando…" : "Sincronizar agora"}
        </Button>
      )}
      <span className="ml-auto hidden text-[11px] text-muted-foreground lg:inline">
        {format(businessCalendarDate(startDate), "dd/MM/yyyy")} – {format(businessCalendarDate(endDate), "dd/MM/yyyy")} · São Paulo
      </span>
    </div>
  );
}
