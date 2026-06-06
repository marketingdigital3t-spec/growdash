import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FunnelAnalytics } from "@/hooks/useRDDeals";

export function FunnelLostReasons({ a }: { a: FunnelAnalytics }) {
  const data = a.lostReasons.slice(0, 8).map((r) => ({
    name: r.reason || "Não informado",
    count: r.count,
    pct: Number(r.pct.toFixed(1)),
  }));
  const max = Math.max(...data.map((item) => item.count), 1);
  return (
    <Card className="bg-card/60 border-border/40">
      <CardHeader>
        <CardTitle className="text-base">6. Motivos de perda</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Nenhuma perda registrada.</div>
        ) : (
          <div className="space-y-3">
            {data.map((item) => (
              <div key={item.name} className="space-y-1.5">
                <div className="flex items-start justify-between gap-3 text-xs">
                  <span className="min-w-0 flex-1 break-words font-medium leading-snug" title={item.name}>
                    {item.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {item.count} · {item.pct}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-rose-500 shadow-[0_0_16px_hsl(0_84%_60%/0.35)]"
                    style={{ width: `${Math.max(4, (item.count / max) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
