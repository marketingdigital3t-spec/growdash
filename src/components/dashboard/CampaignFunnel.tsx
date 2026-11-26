import { Fragment, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

export interface FunnelStepDef {
  key: string;
  label: string;
  value: number;
  icon: ReactNode;
  /** tailwind gradient classes, e.g. "from-blue-500/20 to-blue-500/5" */
  color: string;
  /** tailwind text color, e.g. "text-blue-600" */
  text: string;
}

interface Props {
  steps: FunnelStepDef[];
  visibleKeys?: string[];
}

function fmt(n: number) {
  return n.toLocaleString("pt-BR");
}

function rate(a: number, b: number) {
  if (b === 0) return "—";
  return `${((a / b) * 100).toFixed(2)}%`;
}

export function CampaignFunnel({ steps, visibleKeys }: Props) {
  const ordered = visibleKeys
    ? steps.filter((s) => visibleKeys.includes(s.key))
    : steps;
  const conversions = ordered.slice(1).map((curr, i) => {
    const prev = ordered[i];
    return { label: `${prev.label} → ${curr.label}`, v: rate(curr.value, prev.value) };
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Funil de Conversão</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className="hidden md:grid gap-2 items-center"
          style={{ gridTemplateColumns: `repeat(${Math.max(ordered.length * 2 - 1, 1)}, minmax(0, 1fr))` }}
        >
          {ordered.map((s, i) => (
            <Fragment key={s.key}>
              <div className={`rounded-lg bg-gradient-to-b ${s.color} p-4 border`}>
                <div className={`flex items-center gap-2 ${s.text}`}>
                  {s.icon}
                  <span className="text-xs font-medium">{s.label}</span>
                </div>
                <p className="text-2xl font-bold mt-2 tabular-nums">{fmt(s.value)}</p>
              </div>
              {i < ordered.length - 1 && (
                <div className="hidden md:flex flex-col items-center text-muted-foreground">
                  <ArrowRight className="h-5 w-5" />
                  <span className="text-[10px] mt-1 font-medium">{conversions[i].v}</span>
                </div>
              )}
            </Fragment>
          ))}
        </div>
        <div className="md:hidden grid grid-cols-2 gap-2">
          {ordered.map((s) => (
            <div key={s.key} className={`rounded-lg bg-gradient-to-b ${s.color} p-3 border`}>
              <div className={`flex items-center gap-2 ${s.text}`}>
                {s.icon}
                <span className="text-xs font-medium">{s.label}</span>
              </div>
              <p className="text-xl font-bold mt-1 tabular-nums">{fmt(s.value)}</p>
            </div>
          ))}
        </div>
        <div
          className="md:hidden mt-3 grid gap-2 text-center"
          style={{ gridTemplateColumns: `repeat(${Math.max(conversions.length, 1)}, minmax(0, 1fr))` }}
        >
          {conversions.map((c) => (
            <div key={c.label} className="text-xs">
              <p className="text-muted-foreground truncate">{c.label}</p>
              <p className="font-semibold">{c.v}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
