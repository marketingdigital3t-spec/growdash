import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { CampaignDetailSheet } from "@/components/campaigns/CampaignDetailSheet";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useInsights } from "@/hooks/useInsights";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { getCampaignActiveDays, getCampaignHealth, type CampaignHealth } from "@/lib/campaignHealth";

interface AccountOption {
  id: string;
  name: string;
}

interface CampaignAttentionPanelProps {
  accountId: string;
  accounts: AccountOption[];
  startDate: Date;
  endDate: Date;
}

export function CampaignAttentionPanel({ accountId, accounts, startDate, endDate }: CampaignAttentionPanelProps) {
  const [detailCampaignId, setDetailCampaignId] = useState<string | null>(null);
  const singleAccountId = accountId !== "all" ? accountId : undefined;
  const visibleAccountIds = useMemo(() => new Set(accounts.map((account) => account.id)), [accounts]);
  const { data: campaignRows = [], isLoading: loadingCampaigns } = useCampaigns(singleAccountId);
  const { data: insights = [], isLoading: loadingInsights } = useInsights({
    adAccountId: singleAccountId,
    startDate,
    endDate,
    enabled: accounts.length > 0,
  });

  const visibleCampaigns = useMemo(() => campaignRows.filter((campaign) => visibleAccountIds.has(campaign.ad_account_id)), [campaignRows, visibleAccountIds]);
  const campaignIds = useMemo(() => visibleCampaigns.map((campaign) => campaign.id), [visibleCampaigns]);
  const { data: campaignTargets = [] } = useQuery({
    queryKey: ["campaign-targets-budget-attention", campaignIds.join(",")],
    enabled: campaignIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("campaign_targets")
        .select("campaign_id,target_cpl")
        .in("campaign_id", campaignIds);
      if (error) throw error;
      return data || [];
    },
  });

  const targetByCampaign = useMemo(
    () => new Map(campaignTargets.map((target) => [target.campaign_id, Number(target.target_cpl || 0)])),
    [campaignTargets],
  );

  const campaigns = useMemo(() => {
    const totals = new Map<string, { spend: number; leads: number; clicks: number; impressions: number; reach: number }>();
    for (const insight of insights) {
      if (!insight.campaign_id || !insight.ad_account_id || !visibleAccountIds.has(insight.ad_account_id)) continue;
      const current = totals.get(insight.campaign_id) || { spend: 0, leads: 0, clicks: 0, impressions: 0, reach: 0 };
      current.spend += Number(insight.spend || 0);
      current.leads += Number(insight.leads || 0);
      current.clicks += Number(insight.clicks || 0);
      current.impressions += Number(insight.impressions || 0);
      current.reach += Number(insight.reach || 0);
      totals.set(insight.campaign_id, current);
    }

    return visibleCampaigns.map((campaign) => {
      const metrics = totals.get(campaign.id) || { spend: 0, leads: 0, clicks: 0, impressions: 0, reach: 0 };
      const cpl = metrics.leads > 0 ? metrics.spend / metrics.leads : 0;
      const ctr = metrics.impressions > 0 ? metrics.clicks / metrics.impressions * 100 : 0;
      const frequency = metrics.reach > 0 ? metrics.impressions / metrics.reach : 0;
      const conversionRate = metrics.clicks > 0 ? metrics.leads / metrics.clicks * 100 : 0;
      return {
        ...campaign,
        status: campaign.status || insights.find((insight) => insight.campaign_id === campaign.id)?.campaign_status || "PAUSED",
        ...metrics,
        cpl,
        ctr,
        frequency,
        conversionRate,
        salesCount: 0,
        revenue: 0,
        roas: 0,
        profit: -metrics.spend,
        roi: 0,
        cpa: 0,
        adsets: [],
      };
    });
  }, [insights, visibleAccountIds, visibleCampaigns]);

  const averageCpl = useMemo(() => {
    const withLeads = campaigns.filter((campaign) => campaign.leads > 0 && campaign.spend > 0);
    const spend = withLeads.reduce((sum, campaign) => sum + campaign.spend, 0);
    const leads = withLeads.reduce((sum, campaign) => sum + campaign.leads, 0);
    return leads > 0 ? spend / leads : 0;
  }, [campaigns]);

  const problemCampaigns = useMemo(() => campaigns
    .map((campaign) => ({ campaign, health: getCampaignHealth(campaign, averageCpl, targetByCampaign.get(campaign.id)) }))
    .filter(({ health }) => health === "critical" || health === "observation")
    .sort((a, b) => (a.health === "critical" ? -1 : 1) - (b.health === "critical" ? -1 : 1))
    .slice(0, 6), [averageCpl, campaigns, targetByCampaign]);

  const selectedCampaign = detailCampaignId ? campaigns.find((campaign) => campaign.id === detailCampaignId) || null : null;
  const isLoading = loadingCampaigns || loadingInsights;

  if (isLoading) {
    return <section className="rounded-xl border border-border bg-card p-4"><div className="h-5 w-64 animate-pulse rounded bg-muted" /><div className="mt-3 grid gap-2 lg:grid-cols-2"><div className="h-40 animate-pulse rounded-xl bg-muted/60" /><div className="h-40 animate-pulse rounded-xl bg-muted/60" /></div></section>;
  }
  if (problemCampaigns.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black">Campanhas que exigem atenção</h2>
          <p className="text-[10px] text-muted-foreground">Detalhes automáticos calculados com meta de CPL, período, veiculação e resultados reais.</p>
        </div>
        <Badge variant="outline">{problemCampaigns.length} exibida(s)</Badge>
      </div>
      <div className="grid gap-2 lg:grid-cols-2">
        {problemCampaigns.map(({ campaign, health }) => (
          <AttentionCard
            key={campaign.id}
            campaign={campaign}
            health={health}
            targetCpl={targetByCampaign.get(campaign.id) || averageCpl}
            accountName={accounts.find((account) => account.id === campaign.ad_account_id)?.name || "Conta Meta"}
            onOpen={() => setDetailCampaignId(campaign.id)}
          />
        ))}
      </div>
      <CampaignDetailSheet
        open={!!detailCampaignId}
        onOpenChange={(open) => !open && setDetailCampaignId(null)}
        campaign={selectedCampaign}
      />
    </section>
  );
}

function AttentionCard({ campaign, health, targetCpl, accountName, onOpen }: { campaign: any; health: CampaignHealth; targetCpl: number; accountName: string; onOpen: () => void }) {
  const critical = health === "critical";
  const days = getCampaignActiveDays(campaign.created_at);
  return (
    <button type="button" onClick={onOpen} className={cn("rounded-xl border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg", critical ? "border-red-500/35" : "border-orange-500/35")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2"><span className={cn("h-2.5 w-2.5 rounded-full", critical ? "bg-red-500" : "bg-orange-500")} /><span className={cn("text-[9px] font-black uppercase tracking-wider", critical ? "text-red-500" : "text-orange-500")}>{critical ? "Crítico" : "Observação"}</span></div>
          <h3 className="mt-2 truncate text-sm font-black">{campaign.name}</h3>
          <p className="mt-1 truncate text-[10px] text-muted-foreground">BM: {accountName} · Alvo CPL: {targetCpl > 0 ? targetCpl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "não definido"}</p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[9px] text-muted-foreground">{Number.isFinite(days) ? `${days.toFixed(1)}d ativa` : "idade indisponível"}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <Metric label="Investido" value={campaign.spend.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
        <Metric label="Resultados" value={campaign.leads.toLocaleString("pt-BR")} />
        <Metric label="Custo/resultado" value={campaign.cpl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
        <Metric label="CTR" value={`${campaign.ctr.toFixed(2).replace(".", ",")}%`} />
      </div>
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><span className="block text-[8px] font-black uppercase tracking-wide text-muted-foreground">{label}</span><strong className="mt-1 block tabular-nums">{value}</strong></div>;
}
