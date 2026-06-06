import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sun, Moon, Sunset, Star } from "lucide-react";
import { useHourlyConversions } from "@/hooks/useHourlyConversions";
import { useHourlyCoverage } from "@/hooks/useHourlyCoverage";
import { HourlyDataEmptyState, HourlyCoverageBadge } from "./HourlyDataEmptyState";
import {
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceArea, CartesianGrid,
} from "recharts";

const COLOR_MORNING = "hsl(38, 92%, 55%)"; // amarelo
const COLOR_AFTERNOON = "hsl(217, 91%, 60%)"; // azul
const COLOR_NIGHT = "hsl(248, 53%, 35%)"; // lilás escuro

const fmt = (n: number) => Number(n || 0).toLocaleString("pt-BR");
const pct = (n: number) => `${Number(n || 0).toFixed(1).replace(".", ",")}%`;

export function BestPeriodOfDayWidget() {
  const { byPeriod, byHour, isLoading } = useHourlyConversions();
  const coverage = useHourlyCoverage();
  const { manha, tarde, noite, total } = byPeriod;

  const periods = [
    { key: "manha", label: "Manhã", range: "06h - 11h59", icon: Sun, color: COLOR_MORNING, leads: manha.leads, pct: manha.pct },
    { key: "tarde", label: "Tarde", range: "12h - 17h59", icon: Sunset, color: COLOR_AFTERNOON, leads: tarde.leads, pct: tarde.pct },
    { key: "noite", label: "Noite", range: "18h - 05h59", icon: Moon, color: COLOR_NIGHT, leads: noite.leads, pct: noite.pct },
  ] as const;

  const best = periods.reduce((a, b) => (b.leads > a.leads ? b : a), periods[0]);

  const pieData = periods.map((p) => ({ name: p.label, value: p.leads, color: p.color }));

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          Melhor período do dia de conversão (Manhã / Tarde / Noite)
          <HourlyCoverageBadge coverage={coverage} />
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Conversões do Meta Ads normalizadas pelo total diário — base segura para otimização por horário.
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
          <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(180px,1fr)_minmax(280px,2fr)] gap-4 h-full items-center">
            {/* Donut */}
            <div className="relative h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="none">
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: unknown) => fmt(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Total de Conversões</span>
                <span className="text-2xl font-bold">{fmt(total)}</span>
              </div>
            </div>

            {/* Cards laterais */}
            <div className="flex flex-col gap-3">
              {periods.map((p) => {
                const Icon = p.icon;
                const isBest = p.key === best.key;
                return (
                  <div key={p.key} className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: p.color, color: "white" }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 text-sm">
                        <span className="font-medium">{p.label}</span>
                        <span className="text-muted-foreground text-xs">({p.range})</span>
                        {isBest && <Star className="h-3 w-3 fill-current text-amber-500 ml-1" />}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-bold">{fmt(p.leads)}</span>
                        <span className="text-sm font-semibold" style={{ color: p.color }}>{pct(p.pct)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Linha por hora do dia */}
            <div className="h-[220px]">
              <p className="text-xs text-center text-muted-foreground mb-1 font-medium">Conversões por hora do dia</p>
              <ResponsiveContainer width="100%" height="90%">
                <LineChart data={byHour} margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={(h) => `${h}h`} interval={2} />
                  <YAxis tick={{ fontSize: 10 }} width={28} />
                  <ReferenceArea x1={0} x2={5} fill={COLOR_NIGHT} fillOpacity={0.08} />
                  <ReferenceArea x1={6} x2={11} fill={COLOR_MORNING} fillOpacity={0.12} />
                  <ReferenceArea x1={12} x2={17} fill={COLOR_AFTERNOON} fillOpacity={0.1} />
                  <ReferenceArea x1={18} x2={23} fill={COLOR_NIGHT} fillOpacity={0.08} />
                  <Tooltip formatter={(v: unknown) => [fmt(Number(v)), "Leads"]} labelFormatter={(h) => `${h}h`} />
                  <Line type="monotone" dataKey="leads" stroke={COLOR_AFTERNOON} strokeWidth={2.5} dot={false} animationDuration={600} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
