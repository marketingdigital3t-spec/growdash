import { ArrowDownRight, ArrowUpRight, CalendarRange, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeading({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[.2em] text-[#9a741a]">{eyebrow}</p>}
        <h1 className="text-2xl font-black tracking-tight text-[#171512] dark:text-[#f4f1e9] sm:text-3xl">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-[#77716a] dark:text-[#aaa398]">{description}</p>
      </div>
      {actions ? (
        <div className="flex w-full min-w-0 [&>*]:w-full md:w-auto md:[&>*]:w-auto">{actions}</div>
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
  return (
    <div className={cn("gd-panel min-w-0 overflow-hidden p-4", emphasis && "border-[#e4bc4b]/60 bg-gradient-to-br from-[#fffdf7] to-[#faf3dd] dark:from-[#211c10] dark:to-[#15140f]")}>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <span className="min-w-0 break-words text-[11px] font-semibold leading-tight text-[#77716a] dark:text-[#aaa398]" title={label}>{label}</span>
        <span className={cn("inline-flex shrink-0 items-center gap-0.5 text-[10px] font-bold", negative ? "text-[#b95b51]" : "text-[#43845c]")}>
          {negative ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
          {change}
        </span>
      </div>
      <div className="mt-3 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[clamp(1.05rem,2vw,1.375rem)] font-black tracking-tight text-[#211e1a] dark:text-[#f4f1e9]" title={value}>{value}</div>
    </div>
  );
}

export function MiniBars({ values = [45, 68, 52, 86, 64, 92, 78, 100, 84, 96] }: { values?: number[] }) {
  return (
    <div className="flex h-32 items-end gap-2">
      {values.map((value, index) => (
        <div key={`${value}-${index}`} className="flex h-full flex-1 items-end rounded-md bg-[#f0ede7]">
          <div
            className="w-full rounded-md bg-gradient-to-t from-[#9f7415] to-[#f5cf5a] transition-all hover:brightness-110"
            style={{ height: `${value}%` }}
          />
        </div>
      ))}
    </div>
  );
}
