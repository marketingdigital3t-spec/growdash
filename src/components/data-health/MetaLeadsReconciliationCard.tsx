import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, Inbox, RefreshCw } from "lucide-react";
import { toLocalDateString } from "@/lib/dateRange";

interface AccountRow {
  id: string;
  name: string;
  metaLeads: number;
  insightsLeads: number;
  hourlyLeads: number;
  rdLeads: number;
  coveragePct: number;
}

function useReconciliation(days: number) {
  return useQuery({
    queryKey: ["meta-leads-reconciliation", days],
    queryFn: async (): Promise<AccountRow[]> => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - days + 1);
      const startStr = toLocalDateString(start);
      const endStr = toLocalDateString(end);
      const startISO = new Date(`${startStr}T00:00:00`).toISOString();
      const endISO = new Date(`${endStr}T23:59:59.999`).toISOString();

      const { data: accounts } = await (supabase as any)
        .from("ad_accounts")
        .select("id, name");

      const rows: AccountRow[] = [];
      for (const acc of (accounts || []) as any[]) {
        // meta_leads count + coverage
        const { data: mlRows } = await (supabase as any)
          .from("meta_leads" as any)
          .select("lead_state")
          .eq("ad_account_id", acc.id)
          .gte("created_time", startISO)
          .lte("created_time", endISO)
          .limit(10000);
        const metaLeads = (mlRows || []).length;
        const withState = (mlRows || []).filter((r: any) => r.lead_state).length;
        const coveragePct = metaLeads > 0 ? (withState / metaLeads) * 100 : 0;

        // insights leads (sum) via campaigns join
        const { data: camps } = await (supabase as any)
          .from("campaigns")
          .select("id")
          .eq("ad_account_id", acc.id);
        const campIds = (camps || []).map((c: any) => c.id);

        let insightsLeads = 0;
        if (campIds.length > 0) {
          const CHUNK = 200;
          const adsetIds: string[] = [];
          for (let i = 0; i < campIds.length; i += CHUNK) {
            const chunk = campIds.slice(i, i + CHUNK);
            const { data: asRows } = await (supabase as any)
              .from("adsets")
              .select("id")
              .in("campaign_id", chunk);
            for (const a of (asRows || []) as any[]) adsetIds.push(a.id);
          }
          const adIds: string[] = [];
          for (let i = 0; i < adsetIds.length; i += CHUNK) {
            const chunk = adsetIds.slice(i, i + CHUNK);
            const { data: adRows } = await (supabase as any)
              .from("ads")
              .select("id")
              .in("adset_id", chunk);
            for (const a of (adRows || []) as any[]) adIds.push(a.id);
          }
          for (let j = 0; j < adIds.length; j += CHUNK) {
            const slice = adIds.slice(j, j + CHUNK);
            const { data: ins } = await (supabase as any)
              .from("insights")
              .select("leads")
              .in("ad_id", slice)
              .gte("date", startStr)
              .lte("date", endStr);
            for (const r of (ins || []) as any[]) insightsLeads += Number(r.leads || 0);
          }
        }

        // hourly leads
        const { data: hourly } = await (supabase as any)
          .from("insights_hourly" as any)
          .select("leads")
          .eq("ad_account_id", acc.id)
          .gte("date", startStr)
          .lte("date", endStr)
          .limit(10000);
        const hourlyLeads = (hourly || []).reduce((s: number, r: any) => s + Number(r.leads || 0), 0);

        // rd_deals count
        const { count: rdCount } = await (supabase as any)
          .from("rd_deals")
          .select("id", { count: "exact", head: true })
          .eq("ad_account_id", acc.id)
          .gte("lead_created_at", startISO)
          .lte("lead_created_at", endISO);

        rows.push({
          id: acc.id,
          name: acc.name,
          metaLeads,
          insightsLeads,
          hourlyLeads,
          rdLeads: rdCount || 0,
          coveragePct,
        });
      }
      return rows.sort((a, b) => b.metaLeads - a.metaLeads);
    },
  });
}

export function MetaLeadsReconciliationCard() {
  const [days, setDays] = useState("7");
  const { data: rows, isLoading, refetch } = useReconciliation(Number(days));
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const sync = async (adAccountId?: string) => {
    if (adAccountId) setSyncingId(adAccountId);
    else setSyncingAll(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-meta-leads", {
        body: adAccountId ? { ad_account_id: adAccountId } : {},
      });
      if (error) throw error;
      toast({
        title: "Sync de leads concluído",
        description: `Processados: ${(data as any)?.processed ?? "-"} • Novos: ${(data as any)?.inserted ?? "-"}`,
      });
      refetch();
    } catch (e) {
      toast({ title: "Erro no sync", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSyncingId(null);
      setSyncingAll(false);
    }
  };

  const verdict = (r: AccountRow) => {
    if (r.metaLeads === 0 && r.insightsLeads > 0) return { label: "sem Form Ads", variant: "secondary" as const };
    const diff = r.metaLeads > 0 ? Math.abs(r.insightsLeads - r.metaLeads) / r.metaLeads : 0;
    if (r.metaLeads === 0) return { label: "sem dados", variant: "outline" as const };
    if (diff < 0.05) return { label: "OK", variant: "default" as const };
    if (r.insightsLeads > r.metaLeads * 1.5) return { label: "insights inflado", variant: "destructive" as const };
    return { label: "atenção", variant: "secondary" as const };
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-muted-foreground" />
          <div>
            <CardTitle className="text-base">Reconciliação Meta Leads</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Compara leads reais (Central de Leads) vs insights vs hourly vs RD
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="h-8 w-[110px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Hoje</SelectItem>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="14">14 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => sync()} disabled={syncingAll}>
            {syncingAll && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sincronizar todas
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading || !rows ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma conta encontrada.</p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 border-b border-border/40 px-2 pb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
              <div className="col-span-3">Conta</div>
              <div className="col-span-1 text-right">Meta</div>
              <div className="col-span-1 text-right">Insights</div>
              <div className="col-span-1 text-right">Hourly</div>
              <div className="col-span-1 text-right">RD</div>
              <div className="col-span-2 text-right">UF cov.</div>
              <div className="col-span-1 text-right">Status</div>
              <div className="col-span-2 text-right">Ação</div>
            </div>
            {rows.map((r) => {
              const v = verdict(r);
              return (
                <div
                  key={r.id}
                  className="grid grid-cols-12 items-center gap-2 rounded-md border border-border/40 px-2 py-2 text-xs"
                >
                  <div className="col-span-3 truncate font-medium">{r.name}</div>
                  <div className="col-span-1 text-right tabular-nums">{r.metaLeads}</div>
                  <div className="col-span-1 text-right tabular-nums">{r.insightsLeads}</div>
                  <div className="col-span-1 text-right tabular-nums">{r.hourlyLeads}</div>
                  <div className="col-span-1 text-right tabular-nums">{r.rdLeads}</div>
                  <div className="col-span-2 text-right tabular-nums text-muted-foreground">
                    {r.metaLeads > 0 ? `${r.coveragePct.toFixed(0)}%` : "—"}
                  </div>
                  <div className="col-span-1 text-right">
                    <Badge variant={v.variant} className="text-[10px]">{v.label}</Badge>
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[11px]"
                      onClick={() => sync(r.id)}
                      disabled={syncingId === r.id}
                    >
                      {syncingId === r.id ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-1 h-3 w-3" />
                      )}
                      Sync
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
