import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FunnelAnalytics } from "@/hooks/useRDDeals";

export function FunnelLostReasons({ a }: { a: FunnelAnalytics }) {
  const data = a.lostReasons.slice(0, 8).map((r) => ({
    name: r.reason,
    count: r.count,
    pct: Number(r.pct.toFixed(1)),
  }));
  const maxLossCount = Math.max(...data.map((row) => row.count), 1);
  const standby = a.standbyReasons.slice(0, 5);
  const reasonList = (rows: typeof a.lostReasons, empty: string, tone: "loss" | "standby") => rows.length === 0 ? (
    <p className="py-4 text-center text-xs text-muted-foreground">{empty}</p>
  ) : (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.reason} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border/50 bg-background/35 px-3 py-2 text-xs">
          <span className="truncate" title={row.reason}>{row.reason}</span>
          <span className={tone === "loss" ? "font-semibold tabular-nums text-red-400" : "font-semibold tabular-nums text-amber-400"}>{row.count} · {row.pct.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
  return (
    <Card className="gd-analysis-card bg-card/60 border-border/40">
      <CardHeader>
        <CardTitle className="text-base">6. Motivos de perda</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <section>
          <h3 className="mb-2 text-xs font-semibold text-foreground">Perdas registradas</h3>
          {data.length === 0 ? reasonList([], "Nenhuma perda registrada.", "loss") : (
          <ol className="space-y-2.5" aria-label="Ranking de motivos de perda">
            {data.map((row, index) => (
              <li key={row.name} className="rounded-lg border border-border/50 bg-background/35 px-3 py-2.5">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-xs">
                  <span className="min-w-0 truncate font-medium" title={row.name}>{index + 1}. {row.name}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-red-400">{row.count} · {row.pct.toFixed(1)}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-red-500/10" aria-hidden>
                  <div className="h-full min-w-1 rounded-full bg-red-500/85 transition-[width] duration-300" style={{ width: `${Math.max((row.count / maxLossCount) * 100, 4)}%` }} />
                </div>
              </li>
            ))}
          </ol>) }
        </section>
        <section className="border-t border-border/50 pt-4">
          <h3 className="mb-2 text-xs font-semibold text-foreground">Motivos em espera / Stand By</h3>
          {reasonList(standby, "Nenhuma negociação está em espera.", "standby")}
        </section>
      </CardContent>
    </Card>
  );
}
