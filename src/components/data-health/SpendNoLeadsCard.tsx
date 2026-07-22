import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Loader2 } from "lucide-react";

export function SpendNoLeadsCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["spend-no-leads-by-campaign"],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      // Fetch insights joined with campaign objective
      const { data: rows } = await (supabase as any)
        .from("insights")
        .select("spend, leads, ads!inner(adsets!inner(campaigns!inner(id, name, objective)))")
        .gte("date", since)
        .gt("spend", 0)
        .limit(10000);

      const byCampaign = new Map<string, { name: string; objective: string; spend: number; leads: number }>();
      for (const r of (rows || []) as any[]) {
        const c = r.ads?.adsets?.campaigns;
        if (!c) continue;
        const cur = byCampaign.get(c.id) || { name: c.name, objective: c.objective || "—", spend: 0, leads: 0 };
        cur.spend += Number(r.spend || 0);
        cur.leads += Number(r.leads || 0);
        byCampaign.set(c.id, cur);
      }

      const offenders = Array.from(byCampaign.values())
        .filter((c) => c.spend > 50 && c.leads === 0)
        .sort((a, b) => b.spend - a.spend);

      return offenders;
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertCircle className="h-4 w-4" /> Campanhas com spend sem leads
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Últimos 30 dias · spend &gt; R$50 sem nenhum lead — confira objetivo e action_type
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tudo certo — toda campanha com spend gerou ao menos 1 lead.</p>
        ) : (
          <div className="space-y-2">
            {data.slice(0, 10).map((c, i) => (
              <div key={i} className="flex items-center justify-between border-b border-border/40 py-2 text-sm last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.name}</p>
                  <Badge variant="outline" className="mt-1 text-[10px]">{c.objective}</Badge>
                </div>
                <span className="text-xs tabular-nums text-destructive">R$ {c.spend.toFixed(0)}</span>
              </div>
            ))}
            {data.length > 10 && <p className="text-xs text-muted-foreground pt-2">+ {data.length - 10} adicional(is)</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
