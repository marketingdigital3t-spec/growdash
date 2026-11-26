import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Copy } from "lucide-react";
import { parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DupGroup { records: any[]; }

export function DuplicatesCard() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ emailDuplicates: DupGroup[]; dealDuplicates: DupGroup[]; total: number } | null>(null);

  const run = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("detect-duplicates", { body: {} });
      if (error) throw error;
      setData(data);
      toast({ title: "Análise concluída", description: `${data?.total ?? 0} grupo(s) de duplicatas` });
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
            <Copy className="h-4 w-4" /> Vendas duplicadas
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Detecta vendas com mesmo e-mail/data/valor ou mesmo rd_deal_id
          </p>
        </div>
        <Button size="sm" onClick={run} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Analisar
        </Button>
      </CardHeader>
      {data && (
        <CardContent className="space-y-4">
          {data.total === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma duplicata encontrada nos últimos 365 dias.</p>
          ) : (
            <>
              {data.dealDuplicates.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2">Por rd_deal_id ({data.dealDuplicates.length})</p>
                  {data.dealDuplicates.slice(0, 5).map((g, i) => (
                    <DupRow key={i} group={g} />
                  ))}
                </div>
              )}
              {data.emailDuplicates.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2">Por e-mail + data + valor ({data.emailDuplicates.length})</p>
                  {data.emailDuplicates.slice(0, 10).map((g, i) => (
                    <DupRow key={i} group={g} />
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function DupRow({ group }: { group: DupGroup }) {
  const r = group.records[0];
  return (
    <div className="flex items-center justify-between border-b border-border/40 py-2 text-sm last:border-0">
      <div>
        <span className="font-medium">{r.contact_name || r.contact_email || "—"}</span>
        <span className="ml-2 text-xs text-muted-foreground">
          {r.sale_date ? format(parseISO(r.sale_date), "dd/MM/yy", { locale: ptBR }) : "—"} · R$ {Number(r.gross_revenue || 0).toFixed(2)}
        </span>
      </div>
      <Badge variant="destructive" className="text-[10px]">{group.records.length}x</Badge>
    </div>
  );
}
