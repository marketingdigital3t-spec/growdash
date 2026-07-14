import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import type { FunnelAnalytics } from "@/hooks/useRDDeals";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtHour = (h: number) => `${String(h).padStart(2, "0")}:00`;

export function FunnelHourChart({ a }: { a: FunnelAnalytics }) {
  const [selected, setSelected] = useState<string | null>(null);

  const data = a.hourBreakdown.map((h) => ({
    label: h.period,
    Leads: h.leads,
    Conversões: h.conversions,
    Taxa: Number(h.conversionRate.toFixed(1)),
  }));

  const selectedPeriod = selected ? a.hourBreakdown.find((h) => h.period === selected) : null;
  const detailData = selectedPeriod
    ? selectedPeriod.hours.map((h) => ({
        label: fmtHour(h.hour),
        Vendas: h.conversions,
        Receita: h.revenue,
      }))
    : [];

  return (
    <Card className="bg-card/60 border-border/40">
      <CardHeader>
        <CardTitle className="text-base">10. Melhor período do dia para conversão</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart
              data={data}
              onClick={(e: any) => {
                const label = e?.activeLabel as string | undefined;
                if (label) setSelected((cur) => (cur === label ? null : label));
              }}
            >
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                itemStyle={{ color: "hsl(var(--foreground))" }}
                cursor={{ fill: "hsl(var(--muted) / 0.25)", stroke: "hsl(var(--border))" }}
              />
              <Bar dataKey="Leads" radius={[4, 4, 0, 0]} cursor="pointer">
                {data.map((d, i) => (
                  <Cell key={`l-${i}`} fill="hsl(217 91% 60%)" opacity={selected && selected !== d.label ? 0.35 : 1} />
                ))}
              </Bar>
              <Bar dataKey="Conversões" radius={[4, 4, 0, 0]} cursor="pointer">
                {data.map((d, i) => (
                  <Cell key={`c-${i}`} fill="hsl(142 71% 45%)" opacity={selected && selected !== d.label ? 0.35 : 1} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-4 gap-1 mt-3 text-[10px] text-center text-muted-foreground">
          {a.hourBreakdown.map((h) => (
            <button
              key={h.period}
              onClick={() => setSelected((cur) => (cur === h.period ? null : h.period))}
              className={`rounded p-1 transition-colors ${selected === h.period ? "bg-muted/40 text-foreground" : "hover:bg-muted/20"}`}
            >
              <div>{h.period}</div>
              <div className="text-foreground">{h.conversionRate.toFixed(0)}% conv.</div>
            </button>
          ))}
        </div>

        <AnimatePresence initial={false}>
          {selectedPeriod && (
            <motion.div
              key={selectedPeriod.period}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-border/40">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">
                    Vendas por hora — {selectedPeriod.period}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selectedPeriod.conversions} venda{selectedPeriod.conversions === 1 ? "" : "s"} ·{" "}
                    {fmtBRL(selectedPeriod.hours.reduce((s, h) => s + h.revenue, 0))}
                  </div>
                </div>
                {selectedPeriod.conversions === 0 ? (
                  <div className="text-xs text-muted-foreground py-6 text-center">
                    Nenhuma venda registrada neste período.
                  </div>
                ) : (
                  <div className="h-44">
                    <ResponsiveContainer>
                      <BarChart data={detailData}>
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }}
                          labelStyle={{ color: "hsl(var(--foreground))" }}
                          itemStyle={{ color: "hsl(var(--foreground))" }}
                          cursor={{ fill: "hsl(var(--muted) / 0.25)" }}
                          formatter={(v: number, name) => (name === "Receita" ? [fmtBRL(v), name] : [v, name])}
                        />
                        <Bar dataKey="Vendas" radius={[4, 4, 0, 0]} fill="hsl(142 71% 45%)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
