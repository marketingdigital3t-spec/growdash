import { useEffect, useMemo, useState } from "react";
import { CircleDollarSign, RefreshCw, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useRDFunnels } from "@/hooks/useRDFunnels";
import { useRDDealsForPeriod } from "@/hooks/useRDDealsForPeriod";
import { MetricCard, PageHeading } from "./shared";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function CrmPage() {
  const queryClient = useQueryClient();
  const { adAccountId, startDate, endDate } = useGlobalFilters();
  const accountFilter = adAccountId === "all" ? undefined : adAccountId;
  const { data: funnels = [], isLoading: loadingFunnels } = useRDFunnels(accountFilter);
  const { data: allDeals = [], isLoading: loadingDeals } = useRDDealsForPeriod({
    startDate,
    endDate,
    adAccountId: accountFilter,
  });
  const [funnelId, setFunnelId] = useState("all");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (funnelId !== "all" && !funnels.some((funnel) => funnel.id === funnelId)) setFunnelId("all");
  }, [funnels, funnelId]);

  const deals = useMemo(
    () => funnelId === "all" ? allDeals : allDeals.filter((deal) => deal.rd_funnel_id === funnelId),
    [allDeals, funnelId],
  );
  const stats = useMemo(() => {
    const won = deals.filter((deal) => deal.win);
    const active = deals.filter((deal) => !deal.win && deal.stage_bucket !== "lost");
    const openRevenue = active.reduce((sum, deal) => sum + Number(deal.amount_total || 0), 0);
    const wonRevenue = won.reduce((sum, deal) => sum + Number(deal.amount_total || 0), 0);
    return {
      active: active.length,
      openRevenue,
      won: won.length,
      wonRevenue,
      conversion: deals.length ? (won.length / deals.length) * 100 : 0,
    };
  }, [deals]);
  const stages = useMemo(() => {
    const map = new Map<string, { name: string; deals: number; revenue: number }>();
    for (const deal of deals) {
      const name = deal.rd_stage_name || "Sem etapa";
      const current = map.get(name) || { name, deals: 0, revenue: 0 };
      current.deals += 1;
      current.revenue += Number(deal.amount_total || 0);
      map.set(name, current);
    }
    return Array.from(map.values()).sort((a, b) => b.deals - a.deals);
  }, [deals]);

  async function syncRD() {
    const selected = funnelId === "all" ? funnels.filter((funnel) => funnel.is_active) : funnels.filter((funnel) => funnel.id === funnelId);
    if (!selected.length) {
      toast.error("Nenhum funil RD ativo para sincronizar.");
      return;
    }
    setSyncing(true);
    try {
      for (const funnel of selected) {
        const { error } = await supabase.functions.invoke("rd-sync-deals", { body: { funnel_id: funnel.id } });
        if (error) throw error;
      }
      await queryClient.invalidateQueries({ queryKey: ["rd_deals_period"] });
      toast.success("Dados do RD Station sincronizados.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Não foi possível sincronizar o RD Station.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeading
        eyebrow="RD Station CRM"
        title="CRM"
        description="Funis, negociações e receita recebidos da integração real com o RD Station."
        actions={(
          <div className="flex flex-wrap gap-2">
            <select value={funnelId} onChange={(event) => setFunnelId(event.target.value)} className="gd-button min-w-48">
              <option value="all">Todos os funis conectados</option>
              {funnels.map((funnel) => <option key={funnel.id} value={funnel.id}>{funnel.name}</option>)}
            </select>
            <button className="gd-button" onClick={() => void syncRD()} disabled={syncing || loadingFunnels}>
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} /> {syncing ? "Sincronizando" : "Sincronizar RD"}
            </button>
          </div>
        )}
      />
      <div className="gd-auto-grid gap-3">
        <MetricCard label="Negociações ativas" value={String(stats.active)} change="período" emphasis />
        <MetricCard label="Receita em aberto" value={brl.format(stats.openRevenue)} change="período" />
        <MetricCard label="Vendas no período" value={String(stats.won)} change={brl.format(stats.wonRevenue)} />
        <MetricCard label="Conversão do funil" value={`${stats.conversion.toFixed(2)}%`} change="período" />
      </div>

      <section className="gd-panel mt-4 p-5">
        <div className="flex items-center gap-3">
          <UsersRound className="h-5 w-5 text-[#a17817]" />
          <div><h2 className="font-black">Pipeline sincronizado</h2><p className="text-xs text-muted-foreground">Etapas encontradas nos negócios do período selecionado</p></div>
        </div>
        {loadingDeals ? (
          <div className="mt-5 h-28 animate-pulse rounded-xl bg-muted" />
        ) : stages.length ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {stages.map((stage, index) => (
              <article key={stage.name} className="rounded-xl border border-border p-4">
                <div className="mb-3 h-1 rounded-full bg-gradient-to-r from-[#8c6410] to-[#f4cb53]" style={{ opacity: Math.max(.45, 1 - index * .07) }} />
                <p className="truncate text-[10px] font-bold text-muted-foreground" title={stage.name}>{stage.name}</p>
                <p className="mt-2 text-2xl font-black">{stage.deals}</p>
                <p className="mt-1 text-[9px] text-muted-foreground">{brl.format(stage.revenue)}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nenhuma negociação encontrada no período e filtros selecionados.</p>
        )}
      </section>

      <section className="gd-panel mt-4 overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border p-5">
          <CircleDollarSign className="h-5 w-5 text-[#a17817]" />
          <div><h2 className="font-black">Negociações recentes</h2><p className="text-xs text-muted-foreground">Origem, responsável e valor informados pelo RD Station</p></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-muted/60 text-[10px] text-muted-foreground"><tr>{["Negociação", "Origem de mídia", "Etapa", "Responsável", "Valor"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">
              {deals.slice(0, 30).map((deal) => (
                <tr key={deal.id}>
                  <td className="px-4 py-4 font-black">{deal.contact_name || deal.contact_email || "Negociação sem contato"}</td>
                  <td className="px-4 py-4">{deal.rd_campaign_name || deal.utm_campaign || deal.utm_source || "Não atribuída"}</td>
                  <td className="px-4 py-4"><span className="rounded-full bg-[#fff1ca] px-2 py-1 text-[9px] font-bold text-[#8c6814] dark:bg-[#392d13] dark:text-[#f0c950]">{deal.rd_stage_name || "Sem etapa"}</span></td>
                  <td className="px-4 py-4">{deal.deal_owner_name || "Não informado"}</td>
                  <td className="px-4 py-4 font-black">{brl.format(Number(deal.amount_total || 0))}</td>
                </tr>
              ))}
              {!loadingDeals && !deals.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Sem negociações para exibir.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
