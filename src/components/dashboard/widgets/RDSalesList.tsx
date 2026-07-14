import { useMemo, useState } from "react";
import { parseISO, format } from "date-fns";
import { ChevronRight, RefreshCw } from "lucide-react";
import { useDashboard } from "@/contexts/DashboardContext";
import { useUpdateSale, type Sale } from "@/hooks/useSales";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SaleDetailSheet } from "@/components/dashboard/SaleDetailSheet";
import { usePlatformRules } from "@/hooks/usePlatformRules";
import { inferPlatform, subOriginLabel } from "@/lib/platformInference";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const fmtMoney = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (s: string | null) => {
  if (!s) return "—";
  try {
    return format(parseISO(s), "dd/MM/yyyy");
  } catch {
    return "—";
  }
};

const PAYMENTS = [
  { value: "pix", label: "Pix" },
  { value: "cartao", label: "Cartão" },
  { value: "boleto", label: "Boleto" },
  { value: "outros", label: "Outros" },
];

const PLATFORMS = [
  { value: "__auto", label: "Automático" },
  { value: "meta", label: "Meta" },
  { value: "google", label: "Google" },
  { value: "organic:link_bio", label: "Orgânico · Link Bio" },
  { value: "organic:stories", label: "Orgânico · Stories" },
  { value: "organic:dm", label: "Orgânico · Direct/DM" },
  { value: "organic:comentario", label: "Orgânico · Comentário" },
  { value: "organic:outros", label: "Orgânico · Outros" },
];

export function RDSalesList() {
  const { sales } = useDashboard();
  const update = useUpdateSale();
  const { data: platformRules = [] } = usePlatformRules();
  const [openSale, setOpenSale] = useState<Sale | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const qc = useQueryClient();

  const rdSales = useMemo(
    () =>
      sales
        .filter((s) => !!s.rd_deal_id)
        .sort((a, b) => (a.sale_date < b.sale_date ? 1 : -1)),
    [sales]
  );

  async function resyncDeal(sale: Sale) {
    if (!sale.rd_deal_id) return;
    setSyncingId(sale.id);
    try {
      // Resolve funnel_id for this deal
      const { data: deal, error: dErr } = await supabase
        .from("rd_deals")
        .select("rd_funnel_id")
        .eq("rd_deal_id", sale.rd_deal_id)
        .maybeSingle();
      if (dErr || !deal?.rd_funnel_id) throw new Error("Funil não encontrado para este deal");

      const { error } = await supabase.functions.invoke("rd-sync-deals", {
        body: { funnel_id: deal.rd_funnel_id, deal_ids: [sale.rd_deal_id] },
      });
      if (error) throw error;
      toast.success("Deal ressincronizado do RD");
      await qc.invalidateQueries({ queryKey: ["sales"] });
    } catch (e: any) {
      toast.error(`Falha ao ressincronizar: ${e?.message || "erro"}`);
    } finally {
      setSyncingId(null);
    }
  }

  if (rdSales.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground p-6">
        Nenhuma venda do RD no período selecionado.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h3 className="text-sm font-semibold">Vendas RD</h3>
        <Badge variant="secondary">{rdSales.length}</Badge>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 sticky top-0">
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">Nome</th>
              <th className="px-3 py-2 font-medium text-right">Valor</th>
              <th className="px-3 py-2 font-medium">Entrada</th>
              <th className="px-3 py-2 font-medium">Fechamento</th>
              <th className="px-3 py-2 font-medium">Fonte / Campanha</th>
              <th className="px-3 py-2 font-medium">Pagamento</th>
              <th className="px-3 py-2 font-medium">Plataforma</th>
              <th className="px-2 py-2 w-16" />
            </tr>
          </thead>
          <tbody>
            {rdSales.map((s) => (
              <tr
                key={s.id}
                onClick={() => setOpenSale(s)}
                className="border-t hover:bg-muted/30 cursor-pointer transition-colors"
              >
                <td className="px-4 py-2.5 font-medium">{s.contact_name || "—"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  <span className={s.gross_revenue === 0 ? "text-amber-500" : ""}
                    title={s.gross_revenue === 0 ? "Valor zerado no RD — atualize o campo Valor do deal no CRM e ressincronize." : undefined}>
                    {fmtMoney(s.gross_revenue)}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {fmtDate(s.lead_entry_date)}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {fmtDate(s.sale_date)}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  <div className="truncate max-w-[280px]">
                    {[s.utm_source, s.rd_campaign_name].filter(Boolean).join(" / ") || "—"}
                  </div>
                </td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1.5">
                    <Select
                      value={s.payment_method}
                      onValueChange={(v) => update.mutate({ id: s.id, payment_method: v })}
                    >
                      <SelectTrigger className="h-7 w-[110px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENTS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {s.payment_method_source === "rd" && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">RD</Badge>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  {(() => {
                    const inferred = inferPlatform(s, platformRules);
                    const inferredKey =
                      inferred.platform === "organic"
                        ? `organic:${inferred.subOrigin ?? "outros"}`
                        : inferred.platform;
                    const currentValue = s.manual_platform ?? inferredKey;
                    const knownValues = new Set(PLATFORMS.map((p) => p.value));
                    const dynamicItem =
                      !knownValues.has(currentValue) && currentValue !== "unknown"
                        ? {
                            value: currentValue,
                            label: currentValue.startsWith("organic:")
                              ? `Orgânico · ${subOriginLabel(currentValue.split(":")[1] ?? "outros")}`
                              : currentValue,
                          }
                        : null;
                    return (
                      <Select
                        value={currentValue}
                        onValueChange={(v) =>
                          update.mutate({ id: s.id, manual_platform: v === "__auto" ? null : v })
                        }
                      >
                        <SelectTrigger className="h-7 w-[170px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PLATFORMS.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {p.label}
                            </SelectItem>
                          ))}
                          {dynamicItem && (
                            <SelectItem key={dynamicItem.value} value={dynamicItem.value}>
                              {dynamicItem.label}
                            </SelectItem>
                          )}
                          {currentValue === "unknown" && (
                            <SelectItem key="unknown" value="unknown" disabled>
                              Não encontrado
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    );
                  })()}
                </td>
                <td className="px-2 py-2.5 text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => resyncDeal(s)}
                      disabled={syncingId === s.id}
                      title="Ressincronizar do RD"
                      className="p-1 rounded hover:bg-muted disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${syncingId === s.id ? "animate-spin" : ""}`} />
                    </button>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SaleDetailSheet sale={openSale} onClose={() => setOpenSale(null)} />
    </div>
  );
}
