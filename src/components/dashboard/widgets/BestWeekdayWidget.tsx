import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useHourlyConversions } from "@/hooks/useHourlyConversions";
import { useHourlyCoverage } from "@/hooks/useHourlyCoverage";
import { HourlyDataEmptyState, HourlyCoverageBadge } from "./HourlyDataEmptyState";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LabelList,
} from "recharts";

const fmt = (n: number) => Number(n || 0).toLocaleString("pt-BR");

export function BestWeekdayWidget() {
  const { byWeekday, isLoading } = useHourlyConversions();
  const coverage = useHourlyCoverage();
  const total = byWeekday.reduce((s, d) => s + d.leads, 0);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          Dias da semana que mais convertem
          <HourlyCoverageBadge coverage={coverage} />
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Conversões do Meta Ads normalizadas pelo total diário — base segura para otimização por dia.
        </p>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pb-4">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Carregando…</div>
        ) : total === 0 ? (
          <HourlyDataEmptyState
            coverage={
              coverage.missingAccounts.length
                ? coverage
                : { ...coverage, missingAccounts: [{ id: "_", name: "este período", reason: "no_delivery" }] }
            }
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byWeekday} margin={{ top: 24, right: 16, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: unknown) => [fmt(Number(v)), "Conversões"]} />
              <Bar dataKey="leads" fill="hsl(217, 91%, 60%)" radius={[6, 6, 0, 0]} animationDuration={600}>
                <LabelList dataKey="leads" position="top" style={{ fontSize: 12, fontWeight: 600, fill: "hsl(var(--foreground))" }} formatter={(v: unknown) => fmt(Number(v))} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
