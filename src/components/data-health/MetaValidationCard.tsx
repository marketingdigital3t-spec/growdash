import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck } from "lucide-react";

interface Row {
  accountId: string;
  name: string;
  error?: string;
  meta?: { spend: number; impressions: number; clicks: number; leads: number };
  db?: { spend: number; impressions: number; clicks: number; leads: number };
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

export function MetaValidationCard() {
  const [running, setRunning] = useState(false);
  const [days, setDays] = useState("7");
  const [results, setResults] = useState<Row[] | null>(null);
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);

  const run = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("validate-meta-totals", { body: { days: Number(days) } });
      if (error) throw error;
      setResults((data as any).results || []);
      setRange({ start: (data as any).startDate, end: (data as any).endDate });
      toast({ title: "Validação concluída", description: `${(data as any).results?.length || 0} contas comparadas` });
    } catch (e) {
      toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
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
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="h-8 w-[110px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="14">14 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={run} disabled={running}>
            {running && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Validar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!results && (
          <p className="text-sm text-muted-foreground">Clique em "Validar" para comparar dashboard ↔ Meta na janela escolhida.</p>
        )}
        {results && range && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Janela: {range.start} → {range.end}</p>
            <div className="space-y-3">
              {results.map((r) => (
                <div key={r.accountId} className="rounded-md border border-border/60 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">{r.name}</span>
                    {r.error && <Badge variant="destructive" className="text-[10px]">{r.error}</Badge>}
                  </div>
                  {r.meta && r.db && r.drift && (
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <Metric label="Spend" db={fmtMoney(r.db.spend)} meta={fmtMoney(r.meta.spend)} pct={r.drift.spendPct} />
                      <Metric label="Leads" db={fmt(r.db.leads)} meta={fmt(r.meta.leads)} pct={r.drift.leadsPct} />
                      <Metric label="Clicks" db={fmt(r.db.clicks)} meta={fmt(r.meta.clicks)} pct={r.drift.clicksPct} />
                      <Metric label="Impressões" db={fmt(r.db.impressions)} meta={fmt(r.meta.impressions)} pct={r.drift.impressionsPct} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, db, meta, pct }: { label: string; db: string; meta: string; pct: number }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="tabular-nums"><span className="text-muted-foreground">DB:</span> {db}</div>
      <div className="tabular-nums"><span className="text-muted-foreground">Meta:</span> {meta}</div>
      <DriftBadge pct={pct} />
    </div>
  );
}
