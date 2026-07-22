import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Activity, AlertTriangle, CalendarRange, Database, KeyRound, Loader2, MapPin, RefreshCw } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DuplicatesCard } from "@/components/data-health/DuplicatesCard";
import { RevenueDriftCard } from "@/components/data-health/RevenueDriftCard";
import { SpendNoLeadsCard } from "@/components/data-health/SpendNoLeadsCard";
import { JobRunsCard } from "@/components/data-health/JobRunsCard";
import { MetaValidationCard } from "@/components/data-health/MetaValidationCard";
import { MetaLeadsReconciliationCard } from "@/components/data-health/MetaLeadsReconciliationCard";
import { Inbox } from "lucide-react";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";

interface HealthData {
  orphanSales: number;
  dealsMissingState: number;
  totalDeals: number;
  daysSpendNoLeads: number;
  accountsMissingLpConfig: { id: string; name: string }[];
  lastSyncs: { id: string; name: string; last_sync_success_at: string | null; connection_status: string }[];
  oauthIntegrations: { id: string; provider: string; is_active: boolean | null; token_expires_at: string | null; permission_health: string | null; last_permission_check_at: string | null; last_health_error: string | null }[];
}

function useHealth() {
  return useQuery({
    queryKey: ["data-health"],
    queryFn: async (): Promise<HealthData> => {
      // Orphan sales: sales with rd_deal_id but no matching rd_deals
      const { data: sales } = await supabase
        .from("sales")
        .select("rd_deal_id")
        .eq("status", "confirmed")
        .not("rd_deal_id", "is", null);
      const dealIds = (sales || []).map((s: any) => s.rd_deal_id).filter(Boolean);
      let orphanSales = 0;
      if (dealIds.length > 0) {
        const CHUNK = 200;
        const matched = new Set<string>();
        for (let i = 0; i < dealIds.length; i += CHUNK) {
          const slice = dealIds.slice(i, i + CHUNK);
          const { data: rd } = await (supabase as any).from("rd_deals").select("rd_deal_id").in("rd_deal_id", slice);
          for (const r of (rd || []) as any[]) matched.add(r.rd_deal_id);
        }
        orphanSales = dealIds.filter((id) => !matched.has(id)).length;
      }

      // Deals missing state
      const { count: missing } = await supabase
        .from("rd_deals").select("id", { count: "exact", head: true })
        .is("lead_state", null);
      const { count: total } = await supabase
        .from("rd_deals").select("id", { count: "exact", head: true });

      // Days with spend > 0 but no leads (last 30 days, rough)
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const { data: ins } = await supabase
        .from("insights")
        .select("date, spend, leads")
        .gte("date", since)
        .gt("spend", 0)
        .limit(5000);
      const byDate = new Map<string, { spend: number; leads: number }>();
      for (const r of (ins || []) as any[]) {
        const cur = byDate.get(r.date) || { spend: 0, leads: 0 };
        cur.spend += Number(r.spend || 0);
        cur.leads += Number(r.leads || 0);
        byDate.set(r.date, cur);
      }
      const daysSpendNoLeads = Array.from(byDate.values()).filter((v) => v.spend > 0 && v.leads === 0).length;

      // Accounts and LP config status
      const { data: accounts } = await supabase
        .from("ad_accounts")
        .select("id, name, last_sync_success_at, connection_status");
      const { data: oauthIntegrations } = await supabase
        .from("integrations")
        .select("id, provider, is_active, token_expires_at, permission_health, last_permission_check_at, last_health_error")
        .order("updated_at", { ascending: false });
      const { data: lpRows } = await (supabase as any).from("account_lp_config").select("ad_account_id, action_type");
      const lpMap = new Map((lpRows || []).map((r: any) => [r.ad_account_id, r.action_type]));
      const accountsMissingLpConfig = (accounts || [])
        .filter((a: any) => !lpMap.get(a.id))
        .map((a: any) => ({ id: a.id, name: a.name }));

      return {
        orphanSales,
        dealsMissingState: missing || 0,
        totalDeals: total || 0,
        daysSpendNoLeads,
        accountsMissingLpConfig,
        lastSyncs: (accounts || []) as any,
        oauthIntegrations: (oauthIntegrations || []) as any,
      };
    },
  });
}

export default function DataHealth() {
  const { adAccountId, startDate, endDate } = useGlobalFilters();
  const { data, isLoading, refetch } = useHealth();
  const [enriching, setEnriching] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [syncingLeads, setSyncingLeads] = useState(false);
  const [checkingOAuth, setCheckingOAuth] = useState(false);

  const runOAuthCheck = async () => {
    setCheckingOAuth(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("monitor-oauth-health", { body: {} });
      if (error) throw error;
      toast({ title: "Saúde OAuth verificada", description: `${(result as any)?.checked ?? 0} integração(ões) auditada(s), sem expor tokens no navegador.` });
      refetch();
    } catch (error) {
      toast({ title: "Falha na auditoria OAuth", description: (error as Error).message, variant: "destructive" });
    } finally {
      setCheckingOAuth(false);
    }
  };

  const runSyncMetaLeads = async () => {
    setSyncingLeads(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-meta-leads", { body: {} });
      if (error) throw error;
      toast({
        title: "Sync de Meta Leads concluído",
        description: `Processados: ${(data as any)?.processed ?? "-"} • Novos: ${(data as any)?.inserted ?? "-"}`,
      });
      refetch();
    } catch (e) {
      toast({ title: "Erro no sync", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSyncingLeads(false);
    }
  };

  const runEnrich = async () => {
    setEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke("rd-enrich-states", { body: {} });
      if (error) throw error;
      toast({ title: "Enriquecimento concluído", description: `Processados: ${data?.processed} • Enriquecidos: ${data?.enriched} • Pulados: ${data?.skipped}` });
      refetch();
    } catch (e) {
      toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
    } finally {
      setEnriching(false);
    }
  };

  const runReconcile = async () => {
    setReconciling(true);
    try {
      const { data, error } = await supabase.functions.invoke("reconcile-sales-rd", { body: {} });
      if (error) throw error;
      toast({ title: "Reconciliação concluída", description: `Resultado: ${JSON.stringify(data).slice(0, 160)}` });
      refetch();
    } catch (e) {
      toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
    } finally {
      setReconciling(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const missingPct = data.totalDeals > 0 ? Math.round((data.dealsMissingState / data.totalDeals) * 100) : 0;

  return (
    <div className="container mx-auto space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Saúde dos Dados</h1>
          <p className="text-sm text-muted-foreground">Diagnóstico e reparo das fontes Meta Ads + RD Station</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div><span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Diagnóstico por conta e período</span><p className="mt-1 text-sm font-bold">{adAccountId === "all" ? "Todas as contas" : data.lastSyncs.find((item) => item.id === adAccountId)?.name || "Conta selecionada"}</p></div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarRange className="h-4 w-4 text-primary" />{format(startDate, "dd/MM/yyyy")} — {format(endDate, "dd/MM/yyyy")}</div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vendas órfãs</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{data.orphanSales}</div>
            <p className="mt-1 text-xs text-muted-foreground">sem RD deal correspondente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Deals sem estado</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{data.dealsMissingState}</div>
            <p className="mt-1 text-xs text-muted-foreground">{missingPct}% de {data.totalDeals}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Dias com spend sem leads</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{data.daysSpendNoLeads}</div>
            <p className="mt-1 text-xs text-muted-foreground">últimos 30 dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Contas sem LP config</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{data.accountsMissingLpConfig.length}</div>
            <p className="mt-1 text-xs text-muted-foreground">action_type vazio</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ações de reparo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={runReconcile} disabled={reconciling || data.orphanSales === 0}>
            {reconciling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reconciliar vendas órfãs ({data.orphanSales})
          </Button>
          <Button onClick={runEnrich} disabled={enriching || data.dealsMissingState === 0} variant="secondary">
            {enriching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enriquecer estados via RD ({Math.min(data.dealsMissingState, 200)})
          </Button>
          <Button onClick={runSyncMetaLeads} disabled={syncingLeads} variant="secondary">
            {syncingLeads ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Inbox className="mr-2 h-4 w-4" />}
            Sincronizar Meta Leads agora
          </Button>
          <Button onClick={runOAuthCheck} disabled={checkingOAuth} variant="secondary">
            {checkingOAuth ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
            Verificar tokens e permissões
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Tokens, expiração e permissões OAuth</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.oauthIntegrations.length ? data.oauthIntegrations.map((integration) => {
            const status = integration.permission_health || "unchecked";
            const unhealthy = ["expired", "permission_removed", "error"].includes(status);
            return <div key={integration.id} className="flex flex-col gap-2 border-b border-border/40 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><Badge variant={unhealthy ? "destructive" : "outline"}>{status}</Badge><b className="text-sm capitalize">{integration.provider.replaceAll("_", " ")}</b></div><div className="text-xs text-muted-foreground">{integration.token_expires_at ? `Expira ${format(parseISO(integration.token_expires_at), "dd/MM/yyyy HH:mm")}` : "Expiração não informada"}{integration.last_health_error ? ` · ${integration.last_health_error}` : ""}</div></div>;
          }) : <p className="py-4 text-sm text-muted-foreground">Nenhuma integração OAuth cadastrada.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Último sync por conta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.lastSyncs.filter((account) => adAccountId === "all" || account.id === adAccountId).map((a) => {
              const stale = !a.last_sync_success_at || Date.now() - new Date(a.last_sync_success_at).getTime() > 24 * 3600 * 1000;
              return (
                <div key={a.id} className="flex items-center justify-between border-b border-border/40 py-2 text-sm last:border-0">
                  <div className="flex items-center gap-3">
                    <Badge variant={a.connection_status === "connected" ? "default" : "destructive"} className="text-[10px]">
                      {a.connection_status || "unknown"}
                    </Badge>
                    <span className="font-medium">{a.name}</span>
                    {stale && <Badge variant="destructive" className="text-[10px]">+24h sem sync</Badge>}
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {a.last_sync_success_at
                      ? format(parseISO(a.last_sync_success_at), "dd/MM HH:mm", { locale: ptBR })
                      : "nunca"}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {data.accountsMissingLpConfig.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contas pendentes de configuração LP</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.accountsMissingLpConfig.map((a) => (
                <Badge key={a.id} variant="outline">{a.name}</Badge>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Configure <code>action_type</code> em Configurações → Atribuição para essas contas captarem leads de LP off-site.
            </p>
          </CardContent>
        </Card>
      )}

      <MetaLeadsReconciliationCard />

      <JobRunsCard />

      <MetaValidationCard />



      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DuplicatesCard />
        <RevenueDriftCard />
      </div>

      <SpendNoLeadsCard />
    </div>
  );
}
