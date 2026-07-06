import { ReactNode } from "react";
import { Search } from "lucide-react";
import { Badge, Button, Input } from "@/components/page-primitives";

export function Toolbar({ children, searchPlaceholder = "Buscar..." }: { children?: ReactNode; searchPlaceholder?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
      <div className="relative flex-1 min-w-[220px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder={searchPlaceholder} className="w-full pl-9" />
      </div>
      {children}
    </div>
  );
}

export type Column<T> = {
  key: keyof T | string;
  label: string;
  render?: (row: T) => ReactNode;
  className?: string;
};

export function DataTable<T extends Record<string, any>>({ columns, rows, empty = "Sem registros" }: { columns: Column<T>[]; rows: T[]; empty?: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <tr>
              {columns.map((c) => (
                <th key={String(c.key)} className={`px-4 py-3 text-left ${c.className ?? ""}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-muted-foreground">{empty}</td></tr>
            ) : rows.map((r, i) => (
              <tr key={i} className="hover:bg-muted/40">
                {columns.map((c) => (
                  <td key={String(c.key)} className={`px-4 py-3 font-semibold text-foreground ${c.className ?? ""}`}>
                    {c.render ? c.render(r) : String(r[c.key as keyof T] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Card({ title, subtitle, actions, children }: { title?: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      {(title || actions) && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && <h3 className="text-base font-extrabold text-foreground">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-[30vh] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
      <p className="text-base font-bold text-foreground">{title}</p>
      {hint && <p className="mt-1 max-w-md text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export { Badge, Button, Input };
