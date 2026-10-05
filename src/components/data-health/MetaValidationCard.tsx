import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck } from "lucide-react";
import { businessDateKey } from "@/lib/businessDate";

interface Row {
  accountId: string;
  name: string;
  timezone?: string;
  attributionWindow?: string;
  startDate?: string;
  endDate?: string;
  connectionStatus?: string;
  metaRows?: number;
  metaPages?: number;
  localRows?: number;
  localActionRows?: number;
  error?: string;
  meta?: { spend: number; impressions: number; clicks: number; leads: number; leadParts?: { forms: number; site: number; conversations: number } };
  db?: { spend: number; impressions: number; clicks: number; leads: number; leadParts?: { forms: number; site: number; conversations: number } };
  siteDestinationCoverage?: {
    actionConfigured: boolean;
    meta: { complete: boolean; error: string | null; websiteAds: number };
    db: { complete: boolean; error: string | null; websiteAds: number };
  };
  leadActionTypeTotals?: { meta: Record<string, number>; db: Record<string, number> };
  metaAccountId?: string;
  campaignBreakdown?: Array<{
    campaignId: string;
    campaignName: string;
    meta: { spend: number; impressions: number; clicks: number; forms: number; site: number; conversations: number };
    db: { spend: number; impressions: number; clicks: number; forms: number; site: number; conversations: number };
    actionTypes: Record<string, number>;
  }>;
  drift?: { spendPct: number; leadsPct: number; clicksPct: number; impressionsPct: number };
}

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const fmtMoney = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function DriftBadge({ pct }: { pct: number }) {
  const abs = Math.abs(pct);
  const variant = abs < 2 ? "default" : abs < 10 ? "secondary" : "destructive";
  const sign = pct >= 0 ? "+" : "";
  return <Badge variant={variant as any} className="text-[10px] tabular-nums">{sign}{pct.toFixed(1)}%</Badge>;
}

export function MetaValidationCard({ adAccountIds, startDate, endDate }: {
  adAccountIds: string[];
  startDate: Date;
  endDate: Date;
}) {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Row[] | null>(null);
  const startDateKey = businessDateKey(startDate);
  const endDateKey = businessDateKey(endDate);

  const run = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("validate-meta-totals", {
        body: {
          ...(adAccountIds.length ? { adAccountIds } : {}),
          startDate: startDateKey,
          endDate: endDateKey,
        },
      });
      if (error) throw error;
      setResults((data as any).results || []);
      toast({ title: "Validação concluída", description: `${(data as any).results?.length || 0} contas comparadas` });
    } catch (e) {
      const error = e as Error & { context?: Response };
      let detail = error.message;
      if (error.context) {
        try {
          const payload = await error.context.clone().json();
          if (typeof payload?.error === "string") detail = payload.error;
          else if (typeof payload?.message === "string") detail = payload.message;
        } catch {
          // Keep the SDK's message when the response does not contain JSON.
        }
      }
      toast({ title: "Erro na reconciliação Meta", description: detail, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <div>
            <CardTitle className="text-base">Reconciliação Meta</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">Compara os totais salvos com a API do Meta Ads</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{startDateKey} → {endDateKey}</span>
          <Button size="sm" onClick={run} disabled={running}>
            {running && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Validar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!results && (
          <p className="text-sm text-muted-foreground">Clique em “Validar” para comparar Growdash ↔ Graph API na conta selecionada e no mesmo período civil do calendário.</p>
        )}
        {results && (
          <div className="space-y-3">
            <div className="space-y-3">
              {results.map((r) => {
                const leadScopeComplete = !r.siteDestinationCoverage?.actionConfigured
                  || (r.siteDestinationCoverage.meta.complete && r.siteDestinationCoverage.db.complete);
                return <div key={r.accountId} className="rounded-md border border-border/60 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">{r.name}</span>
                    <div className="flex items-center gap-2">
                      {r.connectionStatus && r.connectionStatus !== "connected" && <Badge variant="destructive" className="text-[10px]">{r.connectionStatus}</Badge>}
                      {r.error && <Badge variant="destructive" className="text-[10px]">{r.error}</Badge>}
                    </div>
                  </div>
                  <p className="mb-2 text-[10px] text-muted-foreground">{r.metaAccountId ? `${r.metaAccountId} · ` : ""}Janela {r.startDate} → {r.endDate} · {r.timezone || "timezone da conta"} · atribuição {r.attributionWindow || "padrão da conta"}{typeof r.metaRows === "number" ? ` · ${r.metaPages ?? 0} páginas Meta / ${r.metaRows} linhas Meta / ${r.localRows ?? 0} locais / ${r.localActionRows ?? 0} ações` : ""}</p>
                  {r.siteDestinationCoverage && <p className="mb-2 text-[10px] text-muted-foreground">Destino Website confirmado: Meta {r.siteDestinationCoverage.meta.websiteAds} anúncios ({r.siteDestinationCoverage.meta.complete ? "completo" : `parcial${r.siteDestinationCoverage.meta.error ? ` · ${r.siteDestinationCoverage.meta.error}` : ""}`}) · banco {r.siteDestinationCoverage.db.websiteAds} anúncios ({r.siteDestinationCoverage.db.complete ? "completo" : `parcial${r.siteDestinationCoverage.db.error ? ` · ${r.siteDestinationCoverage.db.error}` : ""}`}).</p>}
                  {r.meta && r.db && r.drift && (
                    <>
                    <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 xl:grid-cols-7">
                      <Metric label="Spend" db={fmtMoney(r.db.spend)} meta={fmtMoney(r.meta.spend)} pct={r.drift.spendPct} />
                      <Metric label="Leads" db={leadScopeComplete ? fmt(r.db.leads) : "Indisponível"} meta={leadScopeComplete ? fmt(r.meta.leads) : "Indisponível"} pct={leadScopeComplete ? r.drift.leadsPct : undefined} />
                      <Metric label="Formulários" db={fmt(r.db.leadParts?.forms ?? 0)} meta={fmt(r.meta.leadParts?.forms ?? 0)} />
                      <Metric label="Site" db={leadScopeComplete ? fmt(r.db.leadParts?.site ?? 0) : "Indisponível"} meta={leadScopeComplete ? fmt(r.meta.leadParts?.site ?? 0) : "Indisponível"} />
                      <Metric label="Conversas" db={fmt(r.db.leadParts?.conversations ?? 0)} meta={fmt(r.meta.leadParts?.conversations ?? 0)} />
                      <Metric label="Clicks" db={fmt(r.db.clicks)} meta={fmt(r.meta.clicks)} pct={r.drift.clicksPct} />
                      <Metric label="Impressões" db={fmt(r.db.impressions)} meta={fmt(r.meta.impressions)} pct={r.drift.impressionsPct} />
                    </div>
                    {r.leadActionTypeTotals && <details className="mt-2 text-[10px] text-muted-foreground">
                      <summary className="cursor-pointer">Ver action types Meta × banco</summary>
                      <div className="mt-1 space-y-1">
                        {Array.from(new Set([...Object.keys(r.leadActionTypeTotals.meta), ...Object.keys(r.leadActionTypeTotals.db)])).sort().map((actionType) => (
                          <p key={actionType} className="break-all"><span className="font-mono">{actionType}</span> · Meta {fmt(r.leadActionTypeTotals!.meta[actionType] || 0)} / banco {fmt(r.leadActionTypeTotals!.db[actionType] || 0)}</p>
                        ))}
                      </div>
                    </details>}
                    {r.campaignBreakdown && r.campaignBreakdown.length > 0 && <details className="mt-2 text-[10px] text-muted-foreground">
                      <summary className="cursor-pointer">Ver comparação por campanha (Graph API × banco)</summary>
                      <div className="mt-2 space-y-2">
                        {r.campaignBreakdown.map((campaign) => (
                          <div key={campaign.campaignId} className="rounded border border-border/50 p-2">
                            <p className="font-medium text-foreground">{campaign.campaignName} <span className="font-mono text-muted-foreground">· {campaign.campaignId}</span></p>
                            <p>Investimento: Meta {fmtMoney(campaign.meta.spend)} / banco {fmtMoney(campaign.db.spend)} · leads: {leadScopeComplete ? `Meta ${fmt(campaign.meta.forms + campaign.meta.site + campaign.meta.conversations)} / banco ${fmt(campaign.db.forms + campaign.db.site + campaign.db.conversations)}` : "Indisponível até confirmar o destino dos anúncios"}</p>
                            <p>Forms: {fmt(campaign.meta.forms)} / {fmt(campaign.db.forms)} · site: {leadScopeComplete ? `${fmt(campaign.meta.site)} / ${fmt(campaign.db.site)}` : "Indisponível"} · conversas: {fmt(campaign.meta.conversations)} / {fmt(campaign.db.conversations)}</p>
                          </div>
                        ))}
                      </div>
                    </details>}
                    </>
                  )}
                </div>;
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, db, meta, pct }: { label: string; db: string; meta: string; pct?: number }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="tabular-nums"><span className="text-muted-foreground">DB:</span> {db}</div>
      <div className="tabular-nums"><span className="text-muted-foreground">Meta:</span> {meta}</div>
      {pct !== undefined && <DriftBadge pct={pct} />}
    </div>
  );
}
