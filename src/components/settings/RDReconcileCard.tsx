import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GitMerge, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface OrphanCount {
  total: number;
}

async function fetchOrphanCount(userId: string): Promise<OrphanCount> {
  // Busca todas as vendas confirmadas do usuário e verifica quais não têm rd_deals.
  const { data: sales } = await (supabase as any)
    .from("sales")
    .select("rd_deal_id")
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .not("rd_deal_id", "is", null)
    .limit(2000);
  const ids = Array.from(new Set((sales || []).map((s) => s.rd_deal_id as string).filter(Boolean)));
  if (ids.length === 0) return { total: 0 };
  const present = new Set<string>();
  const chunk = 200;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const { data } = await (supabase as any).from("rd_deals").select("rd_deal_id").in("rd_deal_id", slice);
    for (const r of data || []) present.add(String(r.rd_deal_id));
  }
  const total = ids.filter((id) => !present.has(id)).length;
  return { total };
}

export function RDReconcileCard() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["rd_orphan_sales", user?.id],
    enabled: !!user,
    queryFn: () => fetchOrphanCount(user!.id),
    staleTime: 30_000,
  });

  const reconcile = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("reconcile-sales-rd", { body: { limit: 200 } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (res: any) => {
      toast.success(
        `Reconciliação concluída — ${res?.sales_updated ?? 0} vendas atualizadas, ${res?.deals_upserted ?? 0} deals adicionados.`,
      );
      qc.invalidateQueries({ queryKey: ["rd_orphan_sales"] });
      qc.invalidateQueries({ queryKey: ["rd_deals"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["leads_by_state"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao reconciliar"),
  });

  const total = data?.total ?? 0;
  const status = total === 0 ? "ok" : total < 20 ? "warning" : "critical";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            <GitMerge className="h-5 w-5" /> Reconciliação RD ↔ Vendas
          </span>
          {status === "ok" ? (
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Tudo sincronizado
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className={
                status === "warning"
                  ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                  : "bg-red-500/10 text-red-600 border-red-500/30"
              }
            >
              <AlertTriangle className="h-3 w-3 mr-1" /> {total} venda{total === 1 ? "" : "s"} órfã{total === 1 ? "" : "s"}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Vendas confirmadas que possuem <code>rd_deal_id</code> mas sem deal correspondente em <code>rd_deals</code>.
          A reconciliação busca cada deal no RD, popula a tabela <code>rd_deals</code> e completa os campos vazios
          (estado, cidade, contato, UTMs) na venda.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching || isLoading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar contagem
        </Button>
        <Button
          size="sm"
          onClick={() => reconcile.mutate()}
          disabled={reconcile.isPending || total === 0}
        >
          {reconcile.isPending ? "Reconciliando…" : `Reconciliar ${total > 0 ? `(${Math.min(total, 200)})` : "agora"}`}
        </Button>
        {total > 200 && (
          <p className="text-xs text-muted-foreground">
            Processa até 200 por execução — clique novamente para continuar.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
