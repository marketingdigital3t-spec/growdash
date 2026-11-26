import type { ReactNode } from "react";
import { CheckCircle2, CircleAlert, CircleDashed, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type StatusTone = "critical" | "attention" | "observation" | "initial" | "healthy" | "inactive";

const STATUS_STYLES: Record<StatusTone, string> = {
  critical: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300",
  attention: "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-300",
  observation: "border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-200",
  initial: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-300",
  healthy: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  inactive: "border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-300",
};

const STATUS_ICONS: Record<StatusTone, typeof CheckCircle2> = {
  critical: CircleAlert,
  attention: CircleAlert,
  observation: Info,
  initial: CircleDashed,
  healthy: CheckCircle2,
  inactive: CircleDashed,
};

export function StatusBadge({ tone, children, className }: { tone: StatusTone; children: ReactNode; className?: string }) {
  const Icon = STATUS_ICONS[tone];
  return <span className={cn("inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold", STATUS_STYLES[tone], className)}><Icon className="h-3.5 w-3.5" aria-hidden="true" />{children}</span>;
}

export function KpiCard({ label, value, icon, detail, tone = "neutral", className, loading = false }: { label: string; value: ReactNode; icon?: ReactNode; detail?: ReactNode; tone?: "neutral" | "positive" | "negative"; className?: string; loading?: boolean }) {
  return <article className={cn("gd-kpi-card min-w-0 rounded-[var(--gd-radius-card)] border border-border/70 bg-card/80 p-4 shadow-[var(--gd-elevation-0)]", tone === "positive" && "border-l-2 border-l-emerald-500", tone === "negative" && "border-l-2 border-l-red-500", className)} aria-busy={loading || undefined}>
    <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="gd-label truncate text-muted-foreground" title={label}>{label}</p><p className={cn("mt-2 truncate text-xl font-bold leading-tight gd-tabular", tone === "positive" && "text-emerald-600 dark:text-emerald-400", tone === "negative" && "text-red-600 dark:text-red-400")}>{loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Carregando" /> : value}</p></div>{icon && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--gd-radius-control)] bg-muted/70 text-muted-foreground">{icon}</span>}</div>
    {detail && <p className="mt-2 line-clamp-2 text-xs leading-[var(--gd-line-body)] text-muted-foreground">{detail}</p>}
  </article>;
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode; className?: string }) {
  return <div className={cn("grid min-h-40 place-items-center rounded-[var(--gd-radius-card)] border border-dashed border-border/80 bg-muted/20 p-6 text-center", className)} role="status"><div className="grid justify-items-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">{icon}</span><h3 className="mt-3 text-base font-semibold">{title}</h3>{description && <p className="mt-1 max-w-md text-sm leading-[var(--gd-line-body)] text-muted-foreground">{description}</p>}{action && <div className="mt-4">{action}</div>}</div></div>;
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-[var(--gd-radius-control)] bg-muted/70", className)} aria-hidden="true" />;
}

export function DataTableFrame({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("min-w-0 overflow-x-auto rounded-[var(--gd-radius-card)] border border-border/70 bg-card", className)}>{children}</div>;
}
