import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, Inbox, RefreshCw } from "lucide-react";
import { businessDateKey } from "@/lib/businessDate";
import { resolveAccountMetaLeadReconciliation } from "@/lib/metaLeadReconciliation";
import { normalizeMetaAttributionWindow } from "@/lib/metaInsightFacts";
import { CONVERSATION_ACTION_TYPES, FORM_ACTION_TYPES, SITE_ACTION_TYPES } from "../../../supabase/functions/_shared/metaLeadMetrics";
import { findMetaLeadSnapshotCoverage, findMetaSyncIssue, type MetaSyncCoverageRow } from "@/lib/metaSyncCoverage";

interface AccountRow {
  id: string;
  name: string;
  connectionStatus: string;
  timezone_name: string | null;
  startDate: string;
  endDate: string;
  forms: number;
  site: number;
  conversations: number;
  total: number;
  hasValues: boolean;
  available: boolean;
  reason?: string;
  status: string;
}

const PAGE_SIZE = 1000;
const ID_CHUNK_SIZE = 200;

function subtractCalendarDays(dateKey: string, amount: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day - amount, 12));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function useReconciliation(days: number) {
  return useQuery({
    queryKey: ["canonical-meta-leads-reconciliation", days],
    queryFn: async (): Promise<AccountRow[]> => {
      const { data: accounts, error: accountError } = await supabase
        .from("ad_accounts")
        .select("id, name, timezone_name, attribution_window, connection_status")
        // Keep accounts with temporary API/token errors visible for diagnosis.
        // Only an explicit user disconnect removes the account from this global view.
        .neq("connection_status", "disconnected");
      if (accountError) throw accountError;
      if (!accounts?.length) return [];

      const now = new Date();
      const accountScopes = accounts.map((account) => {
        const timezone = account.timezone_name || "America/Sao_Paulo";
        const endDate = businessDateKey(now, timezone);
        return { ...account, startDate: subtractCalendarDays(endDate, days - 1), endDate };
      });
      const accountIds = accountScopes.map((account) => account.id);
      const minStart = accountScopes.map((account) => account.startDate).sort()[0];
      const maxEnd = accountScopes.map((account) => account.endDate).sort().at(-1)!;

      const { data: coverageRows, error: coverageError } = await (supabase as any)
        .from("meta_sync_scope_state")
        .select("ad_account_id,campaign_scope,start_date,end_date,covered_start_date,covered_end_date,timezone,attribution_window,status,block_status,last_error,error_code,last_finished_at,updated_at")
        .in("ad_account_id", accountIds)
        .lte("start_date", maxEnd)
        .gte("end_date", minStart);
      if (coverageError) throw coverageError;
      const syncCoverageRows = (coverageRows || []) as MetaSyncCoverageRow[];

      const { data: lpConfigs, error: configError } = await supabase
        .from("account_lp_config")
        .select("ad_account_id, action_type")
        .in("ad_account_id", accountIds);
      if (configError) throw configError;
      const siteActionByAccount = Object.fromEntries((lpConfigs || []).map((config) => [config.ad_account_id, config.action_type]));
      const leadActionTypes = Array.from(new Set([
        ...FORM_ACTION_TYPES,
        ...SITE_ACTION_TYPES,
        ...CONVERSATION_ACTION_TYPES,
        "lead",
        ...Object.values(siteActionByAccount).filter((value): value is string => Boolean(value)),
      ]));

      const insightRows: any[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await supabase.from("insights")
          .select("ad_id, ad_account_id, date, attribution_window")
          .in("ad_account_id", accountIds)
          .gte("date", minStart)
          .lte("date", maxEnd)
          .range(offset, offset + PAGE_SIZE - 1);
        if (error) throw error;
        insightRows.push(...(data || []));
        if (!data || data.length < PAGE_SIZE) break;
      }

      const adIds = Array.from(new Set(insightRows.map((row) => String(row.ad_id)).filter(Boolean)));
      const actionRows: any[] = [];
      for (let index = 0; index < adIds.length; index += ID_CHUNK_SIZE) {
        const chunk = adIds.slice(index, index + ID_CHUNK_SIZE);
        for (let offset = 0; ; offset += PAGE_SIZE) {
          const { data, error } = await supabase.from("insight_actions" as any)
          .select("ad_account_id, ad_id, date, action_type, value, attribution_window")
          .in("ad_account_id", accountIds)
          .in("ad_id", chunk)
            .in("action_type", leadActionTypes)
            .gte("date", minStart)
            .lte("date", maxEnd)
            .range(offset, offset + PAGE_SIZE - 1);
          if (error) throw error;
          actionRows.push(...(data || []));
          if (!data || data.length < PAGE_SIZE) break;
        }
      }

      return accountScopes.map((account) => {
        const expectedAttribution = normalizeMetaAttributionWindow(account.attribution_window);
        const scopedInsights = insightRows.filter((row) => row.ad_account_id === account.id
          && row.date >= account.startDate
          && row.date <= account.endDate
          && normalizeMetaAttributionWindow(row.attribution_window) === expectedAttribution);
        const scopedAdIds = new Set(scopedInsights.map((row) => row.ad_id));
        const scopedInsightDates = new Set(scopedInsights.map((row) => `${row.ad_account_id}|${row.ad_id}|${row.date}`));
        const scopedActions = actionRows.filter((row) => scopedAdIds.has(row.ad_id)
          && row.ad_account_id === account.id
          && scopedInsightDates.has(`${row.ad_account_id}|${row.ad_id}|${row.date}`)
          && row.date >= account.startDate
          && row.date <= account.endDate);
        const result = resolveAccountMetaLeadReconciliation(account.id, scopedInsights, scopedActions, siteActionByAccount[account.id]);
        const accountScope = {
          accountId: account.id,
          timezone: account.timezone_name || "America/Sao_Paulo",
          attributionWindow: account.attribution_window || "account_default",
        };
        const confirmedSnapshot = findMetaLeadSnapshotCoverage(syncCoverageRows, accountScope, account.startDate, account.endDate);
        const syncIssue = findMetaSyncIssue(syncCoverageRows, accountScope, account.startDate, account.endDate, [], "actions");
        const isConfirmed = Boolean(confirmedSnapshot);
        const isConnectionError = account.connection_status !== "connected";
        return {
          id: account.id,
          name: account.name,
          connectionStatus: account.connection_status,
          timezone_name: account.timezone_name,
          startDate: account.startDate,
          endDate: account.endDate,
          forms: result.forms,
          site: result.site,
          conversations: result.conversations,
          total: result.total,
          hasValues: result.available || isConfirmed,
          available: isConfirmed,
          reason: syncIssue?.last_error || (isConnectionError ? `Estado da conexão Meta: ${account.connection_status}` : result.reason),
          status: isConnectionError
            ? isConfirmed ? "Erro · último snapshot" : "Erro de sincronização"
            : isConfirmed
              ? result.leadActionFactCount > 0 ? "Disponível" : "Zero confirmado"
              : result.available ? "Snapshot não confirmado"
                : result.reason?.startsWith("Nenhum snapshot") ? "Sem snapshot" : "Aguardando ações",
        };
      }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    },
  });
}

function formatCount(value: number, available: boolean) {
  return available ? value.toLocaleString("pt-BR") : "—";
}

export function MetaLeadsReconciliationCard() {
  const [days, setDays] = useState("7");
  const daysNumber = Number(days);
  const { data: rows, isLoading, refetch } = useReconciliation(daysNumber);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<{ completed: number; total: number; accountName: string } | null>(null);

  const sync = async (account?: AccountRow) => {
    if (account) setSyncingId(account.id);
    else setSyncingAll(true);
    try {
      const targets = account ? [account] : (rows || []);
      if (!targets.length) return;
      setSyncProgress({ completed: 0, total: targets.length, accountName: targets[0].name });
      const failures: string[] = [];
      let completed = 0;
      for (const target of targets) {
        setSyncProgress({ completed, total: targets.length, accountName: target.name });
        try {
          const { data, error } = await supabase.functions.invoke("sync-meta-insights", {
            body: { adAccountIds: [target.id], startDate: target.startDate, endDate: target.endDate, force: true, includeBreakdowns: false },
          });
          const accountResult = data?.accountResults?.[0];
          if (error || data?.error || data?.success === false || ["error", "failed", "blocked", "partial"].includes(String(accountResult?.status || data?.status))) {
            const detail = error?.message || accountResult?.error || data?.error || data?.message || "A Meta não confirmou o snapshot desta conta.";
            failures.push(`${target.name}: ${detail}`);
          }
        } catch (error) {
          failures.push(`${target.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
        completed += 1;
      }
      setSyncProgress({ completed, total: targets.length, accountName: "Concluído" });
      await refetch();
      toast({
        title: failures.length ? "Sincronização Meta parcial" : "Ações Meta atualizadas",
        description: failures.length
          ? `${targets.length - failures.length}/${targets.length} contas concluídas. Falhas: ${failures.slice(0, 3).join(" · ")}`
          : `${targets.length} conta(s) concluídas individualmente; atualização baseada em Insights e ações.`,
        ...(failures.length ? { variant: "destructive" as const } : {}),
      });
    } catch (error) {
      toast({ title: "Erro ao atualizar métricas Meta", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setSyncingId(null);
      setSyncingAll(false);
      setSyncProgress(null);
    }
  };

  const connectionCounts = useMemo(() => {
    const connected = (rows || []).filter((row) => row.connectionStatus === "connected");
    return {
      connected: connected.length,
      confirmed: connected.filter((row) => row.available).length,
      withConnectionIssue: (rows || []).filter((row) => row.connectionStatus !== "connected").length,
    };
  }, [rows]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-muted-foreground" />
          <div>
            <CardTitle className="text-base">Leads Meta · todas as contas conectadas</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Fórmula única: formulários + lead de site configurado + conversas iniciadas. RD e Central de Leads são fontes separadas.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Hoje</SelectItem>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="14">14 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />Atualizar
          </Button>
          <Button size="sm" onClick={() => void sync()} disabled={syncingAll || isLoading}>
            {syncingAll && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Sincronizar todas
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading || !rows ? (
          <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma conta Meta conectada.</p>
        ) : (
          <>
            <p className="mb-3 text-xs text-muted-foreground">Ações confirmadas em {connectionCounts.confirmed} de {connectionCounts.connected} contas conectadas{connectionCounts.withConnectionIssue ? ` · ${connectionCounts.withConnectionIssue} contas ativas com erro/status diferente de conectado` : ""} · datas civis no timezone de cada conta.</p>
            {syncProgress && <p className="mb-3 text-xs text-amber-600" role="status">Sincronizando conta {syncProgress.completed + (syncProgress.completed < syncProgress.total ? 1 : 0)} de {syncProgress.total}: {syncProgress.accountName}</p>}
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 border-b border-border/40 px-2 pb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                <div className="col-span-4">Conta · período local</div>
                <div className="col-span-1 text-right">Formulários</div>
                <div className="col-span-1 text-right">Site</div>
                <div className="col-span-1 text-right">Conversas</div>
                <div className="col-span-2 text-right">Leads Meta</div>
                <div className="col-span-2 text-right">Status</div>
                <div className="col-span-1 text-right">Ação</div>
              </div>
              {rows.map((row) => (
                <div key={row.id} className="grid grid-cols-12 items-center gap-2 rounded-md border border-border/40 px-2 py-2 text-xs">
                  <div className="col-span-4 min-w-0">
                    <div className="truncate font-medium">{row.name}</div>
                    <div className="text-[10px] text-muted-foreground">{row.startDate} → {row.endDate} · {row.timezone_name || "America/Sao_Paulo"}</div>
                  </div>
                  <div className="col-span-1 text-right tabular-nums">{formatCount(row.forms, row.hasValues)}</div>
                  <div className="col-span-1 text-right tabular-nums">{formatCount(row.site, row.hasValues)}</div>
                  <div className="col-span-1 text-right tabular-nums">{formatCount(row.conversations, row.hasValues)}</div>
                  <div className="col-span-2 text-right font-semibold tabular-nums">{formatCount(row.total, row.hasValues)}</div>
                  <div className="col-span-2 flex justify-end" title={row.reason}>
                    <Badge variant={row.connectionStatus === "connected" && row.available ? "default" : row.connectionStatus === "connected" ? "secondary" : "destructive"} className="max-w-full truncate text-[10px]">
                      {row.status}
                    </Badge>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button size="sm" variant="ghost" className="h-7 text-[11px]" title={row.reason || "Atualizar ações Meta"} onClick={() => void sync(row)} disabled={syncingId === row.id || syncingAll}>
                      {syncingId === row.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      <span className="sr-only">Sincronizar {row.name}</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
