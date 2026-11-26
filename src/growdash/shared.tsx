import { ArrowDownRight, ArrowUpRight, CalendarRange, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { metricDescription } from "@/lib/metricPresentation";

export function PageHeading({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="gd-page-heading page-heading mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="gd-page-heading-copy">
        {eyebrow && <p className="gd-page-heading-eyebrow mb-1 text-[10px] font-extrabold uppercase tracking-[.2em] text-primary">{eyebrow}</p>}
        <h1 className="gd-page-heading-title text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>
        <p className="gd-page-heading-description mt-1 max-w-2xl text-sm">{description}</p>
      </div>
      {actions ? (
        <div className="page-heading-actions flex w-full min-w-0 [&>*]:w-full md:w-auto md:[&>*]:w-auto">{actions}</div>
      ) : (
        <div className="flex w-full flex-col gap-2 min-[420px]:flex-row md:w-auto">
          <button className="gd-button"><CalendarRange className="h-4 w-4" /> Últimos 30 dias</button>
          <button className="gd-button"><RefreshCw className="h-4 w-4" /> Atualizar</button>
        </div>
      )}
    </div>
  );
}

export function MetricCard({ label, value, change, emphasis }: { label: string; value: string; change: string; emphasis?: boolean }) {
  const negative = change.startsWith("-") || change === "revisar" || change === "agora";
  const tone = metricTone(label, value);
  return (
    <div className={cn("gd-panel gd-metric-card min-w-0 cursor-default overflow-hidden p-4", emphasis && "gd-metric-card-emphasis")} title={metricDescription(label)} aria-label={`${label}. ${metricDescription(label)}`}>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <span className="gd-metric-card-label min-w-0 break-words text-[11px] font-semibold leading-tight" title={label}>{label}</span>
        <span className={cn("inline-flex shrink-0 items-center gap-0.5 text-[10px] font-bold", negative ? "text-destructive" : "text-success")}>
          {negative ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
          {change}
        </span>
      </div>
      <div className={cn("gd-metric-card-value mt-3 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[clamp(1.05rem,2vw,1.375rem)] font-black tracking-tight", tone === "positive" ? "text-emerald-500" : tone === "negative" ? "text-rose-500" : "text-foreground")} title={value}>{value}</div>
    </div>
  );
}

function metricTone(label: string, value: string): "positive" | "negative" | "neutral" {
  const normalized = label.toLocaleLowerCase();
  const numeric = Number(value.replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(numeric)) return "neutral";
  if (numeric < 0) return "negative";
  if (/sa[ií]das?|despesas?|investimento|tr[aá]fego pago|a pagar/.test(normalized)) return "negative";
  if (/receita|entrada|fluxo l[ií]quido|saldo|lucro|margem|roas|a receber|resultado/.test(normalized)) return numeric > 0 ? "positive" : "neutral";
  return "neutral";
}

export function MiniBars({ values = [45, 68, 52, 86, 64, 92, 78, 100, 84, 96] }: { values?: number[] }) {
  return (
    <div className="flex h-32 items-end gap-2">
      {values.map((value, index) => (
        <div key={`${value}-${index}`} className="flex h-full flex-1 items-end rounded-md bg-muted">
          <div
            className="premium-meter w-full rounded-md"
            style={{ height: `${value}%` }}
          />
        </div>
      ))}
    </div>
  );
}
