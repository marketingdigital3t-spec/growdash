import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Loader2, RefreshCw } from "lucide-react";
import { useSales, useUpdateSale, type Sale } from "@/hooks/useSales";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { EditableIfEmpty } from "@/components/EditableIfEmpty";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type Pendency = "all" | "state" | "city" | "utms";

const fmtDate = (s: string | null) => {
  if (!s) return "—";
  try { return format(parseISO(s), "dd/MM/yyyy"); } catch { return "—"; }
};

const isEmpty = (v: string | null | undefined) => !v || v.trim() === "";

function missingUtms(s: Sale): string[] {
  const out: string[] = [];
  if (isEmpty(s.utm_source)) out.push("source");
  if (isEmpty(s.utm_medium)) out.push("medium");
  if (isEmpty(s.utm_campaign)) out.push("campaign");
  return out;
}

export default function LeadsIncompletos() {
  const { session } = useAuth();
  const { data: sales = [], isLoading, refetch } = useSales();
  const qc = useQueryClient();
  const update = useUpdateSale();
  const [funnelFilter, setFunnelFilter] = useState<string>("all");
  const [pendency, setPendency] = useState<Pendency>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reprocessing, setReprocessing] = useState(false);

  const { data: funnels = [] } = useQuery({
    queryKey: ["rd_funnels", session?.user.id],
    enabled: !!session?.user.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("rd_funnels").select("id, name").eq("user_id", session!.user.id);
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const incomplete = useMemo(() => {
    return sales.filter((s) => {
      if (!s.rd_deal_id) return false;
      const noState = isEmpty(s.lead_state);
      const noCity = isEmpty(s.lead_city);
      const noUtms = missingUtms(s).length > 0;
      const isIncomplete = noState || noCity || noUtms;
      if (!isIncomplete) return false;
      if (pendency === "state" && !noState) return false;
      if (pendency === "city" && !noCity) return false;
      if (pendency === "utms" && !noUtms) return false;
      if (funnelFilter !== "all" && (s as any).rd_funnel_id !== funnelFilter) return false;
      return true;
    }).sort((a, b) => (a.sale_date < b.sale_date ? 1 : -1));
  }, [sales, pendency, funnelFilter]);

  const allSelected = incomplete.length > 0 && incomplete.every((s) => selected.has(s.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(incomplete.map((s) => s.id)));
  };
  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const reprocess = async (deals: Sale[]) => {
    if (deals.length === 0) return;
    // agrupa por rd_funnel_id
    const groups = new Map<string, string[]>();
    for (const s of deals) {
      const fid = (s as any).rd_funnel_id;
      const did = s.rd_deal_id!;
      if (!fid || !did) continue;
      if (!groups.has(fid)) groups.set(fid, []);
      groups.get(fid)!.push(did);
    }
    if (groups.size === 0) { toast.error("Nenhum lead com funil válido."); return; }

    setReprocessing(true);
    try {
      let totalUpdated = 0, totalDetails = 0, totalErrors = 0, totalDeals = 0;
      for (const [funnel_id, deal_ids] of groups) {
        const { data, error } = await supabase.functions.invoke("rd-sync-deals", {
          body: { funnel_id, deal_ids },
        });
        if (error) throw error;
        totalUpdated += data?.updated || 0;
        totalDetails += data?.details_fetched || 0;
        totalErrors += data?.errors || 0;
        totalDeals += deal_ids.length;
      }
      const msg = `Atualizados: ${totalUpdated} • Detalhes RD: ${totalDetails}/${totalDeals}` + (totalErrors ? ` • Erros: ${totalErrors}` : "");
      if (totalErrors > 0 || totalDetails < totalDeals) {
        toast.warning(msg + " — RD limitou requisições (429). Tente novamente em alguns segundos.");
      } else {
        toast.success(msg);
      }
      await qc.invalidateQueries({ queryKey: ["sales"] });
      await refetch();
      setSelected(new Set());
    } catch (e: any) {
      toast.error(`Falha ao reprocessar: ${e.message}`);
    } finally {
      setReprocessing(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Leads incompletos</h1>
        <p className="text-sm text-muted-foreground">Leads do RD com Estado, Cidade ou UTMs faltando. Edite manualmente ou reprocesse a sincronização.</p>
      </div>

      <Card className="p-4 flex flex-wrap items-center gap-3">
        <Select value={funnelFilter} onValueChange={setFunnelFilter}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Funil" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os funis</SelectItem>
            {funnels.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={pendency} onValueChange={(v) => setPendency(v as Pendency)}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Qualquer pendência</SelectItem>
            <SelectItem value="state">Sem Estado</SelectItem>
            <SelectItem value="city">Sem Cidade</SelectItem>
            <SelectItem value="utms">Sem UTMs</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <Badge variant="secondary">{incomplete.length} pendentes</Badge>
          <Button
            size="sm"
            disabled={selected.size === 0 || reprocessing}
            onClick={() => reprocess(incomplete.filter((s) => selected.has(s.id)))}
          >
            {reprocessing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            Reprocessar selecionados ({selected.size})
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-10 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : incomplete.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Nenhum lead pendente. 🎉</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 w-8">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                  </th>
                  <th className="px-3 py-2 font-medium">Lead</th>
                  <th className="px-3 py-2 font-medium">Fechamento</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Cidade</th>
                  <th className="px-3 py-2 font-medium">utm_source</th>
                  <th className="px-3 py-2 font-medium">utm_medium</th>
                  <th className="px-3 py-2 font-medium">utm_campaign</th>
                  <th className="px-3 py-2 font-medium">UTMs faltando</th>
                  <th className="px-3 py-2 w-32" />
                </tr>
              </thead>
              <tbody>
                {incomplete.map((s) => {
                  const missing = missingUtms(s);
                  const save = (field: keyof Sale) => async (v: string) =>
                    update.mutateAsync({ id: s.id, [field]: v } as any);
                  return (
                    <tr key={s.id} className="border-t hover:bg-muted/20">
                      <td className="px-3 py-2"><Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggle(s.id)} /></td>
                      <td className="px-3 py-2 font-medium">{s.contact_name || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{fmtDate(s.sale_date)}</td>
                      <td className="px-3 py-2"><EditableIfEmpty value={s.lead_state} onSave={save("lead_state")} type="uf" placeholder="UF" /></td>
                      <td className="px-3 py-2"><EditableIfEmpty value={s.lead_city} onSave={save("lead_city")} placeholder="Cidade" /></td>
                      <td className="px-3 py-2"><EditableIfEmpty value={s.utm_source} onSave={save("utm_source")} placeholder="source" /></td>
                      <td className="px-3 py-2"><EditableIfEmpty value={s.utm_medium} onSave={save("utm_medium")} placeholder="medium" /></td>
                      <td className="px-3 py-2"><EditableIfEmpty value={s.utm_campaign} onSave={save("utm_campaign")} placeholder="campaign" /></td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {missing.length === 0
                            ? <span className="text-xs text-muted-foreground">—</span>
                            : missing.map((m) => <Badge key={m} variant="outline" className="text-[10px]">{m}</Badge>)}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="ghost" disabled={reprocessing} onClick={() => reprocess([s])}>
                          <RefreshCw className="h-3 w-3 mr-1" /> Reprocessar
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
