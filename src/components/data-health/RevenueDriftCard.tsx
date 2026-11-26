import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, TrendingUp } from "lucide-react";
import { parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function RevenueDriftCard() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ drift: any[]; total: number } | null>(null);

  const run = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("detect-revenue-drift", { body: {} });
      if (error) throw error;
      setData(data);
      toast({ title: "Análise concluída", description: `${data?.total ?? 0} venda(s) com divergência` });
    } catch (e) {
      toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Drift de receita
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Vendas cujo valor no RD mudou após o fechamento
          </p>
        </div>
        <Button size="sm" onClick={run} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Analisar
        </Button>
      </CardHeader>
      {data && (
        <CardContent>
          {data.total === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma divergência encontrada.</p>
          ) : (
            <div className="space-y-2">
              {data.drift.slice(0, 15).map((d) => (
                <div key={d.sale_id} className="flex items-center justify-between border-b border-border/40 py-2 text-sm last:border-0">
                  <div>
                    <span className="font-medium">{d.contact_name || "—"}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {d.sale_date ? format(parseISO(d.sale_date), "dd/MM/yy", { locale: ptBR }) : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs tabular-nums">
                    <span className="text-muted-foreground">R$ {d.sale_amount.toFixed(0)} → {d.rd_amount.toFixed(0)}</span>
                    <Badge variant="outline">Δ R$ {d.diff.toFixed(0)}</Badge>
                  </div>
                </div>
              ))}
              {data.total > 15 && <p className="text-xs text-muted-foreground pt-2">+ {data.total - 15} adicional(is)</p>}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
