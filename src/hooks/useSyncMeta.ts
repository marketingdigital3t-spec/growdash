import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { edgeFunctionErrorDetails, formatEdgeFunctionError } from "@/lib/edgeFunctionError";
import { isTerminalAuxiliarySyncFailure, summarizeMetaSyncBlocks } from "@/lib/syncStatus";
import { shouldRefreshStoredMetaToken } from "@/lib/syncRequestPlan";

interface SyncParams {
  adAccountId?: string;
  adAccountIds?: string[];
  startDate: string;
  endDate: string;
  includeBreakdowns?: boolean;
  breakdownStartDate?: string;
  breakdownEndDate?: string;
  force?: boolean;
  attributionWindow?: string;
  timezone?: string;
  syncMode?: "recent_window" | "selected_period";
  recentHours?: number;
  /** Atualiza somente o snapshot principal; leads e hourly seguem em segundo plano. */
  fast?: boolean;
}

type SyncResponse = {
  success?: boolean;
  status?: "success" | "partial" | "failed" | "blocked" | "stale_snapshot";
  synced?: number;
  accounts?: number;
  errors?: string[];
  needs_reauth?: boolean;
  error?: string;
  leads?: number;
  synced_at?: string;
  freshness_seconds?: number;
  scope?: { ad_account_ids?: string[]; campaign_ids?: string[]; start_date?: string | null; end_date?: string | null; attribution_window?: string; timezone?: string };
  warnings?: string[];
  block_status?: { insights?: string; leads?: string; hourly?: string };
  coverage?: Record<string, unknown>;
};

async function invokeSyncFunction(name: string, body: Record<string, unknown>, options: { allowPartial?: boolean } = {}): Promise<SyncResponse> {
  let result = await supabase.functions.invoke(name, { body });
  if (result.error) {
    const first = await edgeFunctionErrorDetails(result.error);
    if (first.status === 401) {
      const { data: sessionData, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && sessionData.session) result = await supabase.functions.invoke(name, { body });
      if (refreshError || !sessionData.session) {
        throw Object.assign(new Error("Sua sessão da Growdash expirou. Entre novamente para sincronizar a Meta."), {
          details: { needsReauth: false, sessionExpired: true },
        });
      }
    }
  }
  if (result.error) {
    const details = await edgeFunctionErrorDetails(result.error);
    if (details.status === 401) {
      throw Object.assign(new Error("Sua sessão da Growdash expirou. Entre novamente para sincronizar a Meta."), {
        details: { needsReauth: false, sessionExpired: true },
      });
    }
    throw Object.assign(new Error(formatEdgeFunctionError(details)), { details });
  }
  const data = (result.data ?? {}) as SyncResponse;
  const terminalFailure = isTerminalAuxiliarySyncFailure(data);
  if (data.error || terminalFailure || (!options.allowPartial && data.success === false)) {
    throw Object.assign(new Error(data.error || data.errors?.join(" · ") || "A Meta recusou a sincronização."), {
      details: { needsReauth: Boolean(data.needs_reauth) },
    });
  }
  return data;
}

async function invokeAuxiliaryWithRetry(name: string, body: Record<string, unknown>): Promise<SyncResponse> {
  try {
    return await invokeSyncFunction(name, body, { allowPartial: true });
  } catch (firstError) {
    // Auxiliary resources are frequently rate-limited independently from
    // Insights. One bounded retry avoids turning a transient warning into a
    // permanent partial state while keeping the manual action responsive.
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    try {
      return await invokeSyncFunction(name, body, { allowPartial: true });
    } catch {
      throw firstError;
    }
  }
}

export function useSyncMeta() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SyncParams) => {
      // Revalidate stored tokens before running the metrics sync. This clears
      // stale OAuth/connection flags after a successful Meta reconnect while
      // still allowing the sync endpoint to return the real Graph error when
      // a token is genuinely revoked.
      const accountIds = Array.from(new Set([
        ...(params.adAccountIds ?? []),
        ...(params.adAccountId ? [params.adAccountId] : []),
      ].filter(Boolean)));
      if (shouldRefreshStoredMetaToken(Boolean(params.fast))) {
        for (const accountId of accountIds) {
          try {
            await supabase.functions.invoke("meta-reconnect-stored-token", { body: { account_id: accountId } });
          } catch {
            // The main sync reports the authoritative Meta error below.
          }
        }
      }
      const body = {
        adAccountId: params.adAccountId,
        adAccountIds: params.adAccountIds,
        startDate: params.startDate,
        endDate: params.endDate,
        includeBreakdowns: params.includeBreakdowns === true,
        breakdownStartDate: params.breakdownStartDate,
        breakdownEndDate: params.breakdownEndDate,
        force: params.force === true,
        attributionWindow: params.attributionWindow,
        timezone: params.timezone,
        syncMode: params.syncMode,
        recentHours: params.recentHours,
        fast: params.fast === true,
      };
      // Hourly reconciliation reads the daily rows. Running both in parallel
      // caused races, inflated API usage and occasional non-2xx responses.
      // A manual fast refresh is stale-while-revalidate: launch the complete
      // sync, immediately release the toolbar, then invalidate the dependent
      // queries when the background request really finishes. Waiting for the
      // Edge Function here made the button stay blocked for minutes when Meta
      // paginated a busy account, even though the existing snapshot was still
      // valid and safe to display.
      const insightsPromise = invokeSyncFunction("sync-meta-insights", body);
      if (params.fast) {
        void insightsPromise.then(async (insights) => {
          try {
            await invokeAuxiliaryWithRetry("sync-meta-leads", {
              adAccountId: params.adAccountId,
              adAccountIds: params.adAccountIds,
              startDate: params.startDate,
              endDate: params.endDate,
              force: params.force === true,
              attributionWindow: params.attributionWindow,
              timezone: params.timezone,
            });
          } catch (error) {
            console.warn("[sync-meta] leads em segundo plano", error);
          }
          try {
            await invokeAuxiliaryWithRetry("sync-meta-hourly", body);
          } catch (error) {
            console.warn("[sync-meta] distribuição horária em segundo plano", error);
          }
          void queryClient.invalidateQueries({ queryKey: ["meta_leads"] });
          void queryClient.invalidateQueries({ queryKey: ["insights_hourly"] });
          void queryClient.invalidateQueries({ queryKey: ["action-totals-by-ads"] });
          void queryClient.invalidateQueries({ queryKey: ["insights"] });
          void queryClient.invalidateQueries({ queryKey: ["campaigns_full"] });
          void queryClient.invalidateQueries({ queryKey: ["campaigns"] });
        }).catch((error) => {
          console.warn("[sync-meta] sincronização principal em segundo plano", error);
          toast({
            title: "Sincronização em segundo plano falhou",
            description: error instanceof Error ? error.message : "Tente novamente em alguns instantes.",
            variant: "destructive",
          });
        });
        return {
          status: "stale_snapshot",
          success: true,
          synced: 0,
          accounts: accountIds.length,
          warnings: ["A sincronização continua em segundo plano."],
          block_status: { insights: "pending", leads: "pending", hourly: "pending" },
          synced_at: new Date().toISOString(),
        };
      }
      const insights = await insightsPromise;
      let leads: SyncResponse = {};
      let leadsWarning: string | undefined;
      try {
        // Leads are a separate Meta Graph resource from insights. Pull the
        // exact selected interval so form, message and native lead campaigns
        // are reconciled instead of leaving the audience profile partial.
        leads = await invokeAuxiliaryWithRetry("sync-meta-leads", {
          adAccountId: params.adAccountId,
          adAccountIds: params.adAccountIds,
          startDate: params.startDate,
          endDate: params.endDate,
          force: params.force === true,
          attributionWindow: params.attributionWindow,
          timezone: params.timezone,
        });
      } catch (error) {
        leadsWarning = error instanceof Error ? error.message : "Leads Meta pendentes.";
      }
      let hourly: SyncResponse = {};
      let hourlyWarning: string | undefined;
      try {
        hourly = await invokeAuxiliaryWithRetry("sync-meta-hourly", body);
      } catch (error) {
        hourlyWarning = error instanceof Error ? error.message : "Relatório horário pendente.";
      }
      const blockOutcome = summarizeMetaSyncBlocks({
        insights,
        leads: { ...leads, error: leadsWarning },
        hourly: { ...hourly, error: hourlyWarning },
      });
      const auxiliaryWarnings = blockOutcome.warnings;
      const primaryPartial = blockOutcome.status === "partial";
      const primaryErrors = [...(insights.errors ?? []), ...(insights.error ? [insights.error] : [])];
      return {
        ...insights,
        // Insights é a fonte dos KPIs principais. Falhas de enriquecimento de
        // leads ou hourly continuam observáveis, mas não invalidam investimento
        // e entrega que já foram persistidos com sucesso.
        status: blockOutcome.status,
        success: blockOutcome.success,
        synced: Number(insights.synced ?? 0),
        accounts: Number(insights.accounts ?? 0),
        hourly_synced: Number(hourly.synced ?? 0),
        leads_synced: Number(leads.synced ?? leads.leads ?? 0),
        errors: primaryErrors,
        warnings: auxiliaryWarnings,
        block_status: {
          insights: insights.status || (primaryPartial ? "partial" : "success"),
          leads: leads.status || (leadsWarning ? "error" : "success"),
          hourly: hourly.status || (hourlyWarning ? "error" : "success"),
        },
        synced_at: insights.synced_at || new Date().toISOString(),
        freshness_seconds: insights.freshness_seconds,
        scope: insights.scope,
      };
    },
    onSuccess: (data) => {
      // Refresh every view that reads the synchronized daily/hourly rows,
      // including the action totals used by Forms/site/conversation KPIs.
      void queryClient.invalidateQueries({ queryKey: ["insights"] });
      // Coverage is part of the metric contract. Refresh it with the facts so
      // cards do not stay "Aguardando sincronização" after confirmed writes.
      void queryClient.invalidateQueries({ queryKey: ["meta-action-sync-coverage"] });
      void queryClient.invalidateQueries({ queryKey: ["insights_hourly"] });
      void queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      void queryClient.invalidateQueries({ queryKey: ["campaigns_full"] });
      void queryClient.invalidateQueries({ queryKey: ["action-totals-by-ads"] });
      void queryClient.invalidateQueries({ queryKey: ["campaign-breakdown-workspace"] });
      void queryClient.invalidateQueries({ queryKey: ["campaign-breakdowns"] });
      void queryClient.invalidateQueries({ queryKey: ["meta_leads"] });
      void queryClient.invalidateQueries({ queryKey: ["ad_accounts"] });
      const warningText = data.warnings?.length ? ` Avisos: ${data.warnings.join(" · ")}` : "";
      toast({
        title: data.status === "stale_snapshot"
          ? "Sincronização iniciada em segundo plano"
          : data.status === "partial" ? "Sincronização parcial dos KPIs principais" : "Sincronização concluída",
        description: data.status === "stale_snapshot"
          ? "Os dados atuais continuam disponíveis e serão atualizados assim que a Meta concluir a consulta."
          : `${data.synced} registros diários e ${data.hourly_synced} horários em ${data.accounts} conta(s).${warningText}`,
        variant: data.status === "partial" ? "destructive" : undefined,
      });
    },
    onError: (e: Error & { details?: { needsReauth?: boolean } }) => {
      toast({
        title: e.details?.needsReauth ? "Reconecte a conta Meta Ads" : "Erro na sincronização",
        description: e.details?.needsReauth ? `${e.message} Abra Integrações → Tráfego pago e reconecte a conta.` : e.message,
        variant: "destructive",
      });
    },
  });
}
