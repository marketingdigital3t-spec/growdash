import { useEffect, useRef, useState } from "react";
import { TableHead } from "@/components/ui/table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStatusBadge } from "@/lib/status";

export function useColWidths<T extends string>(
  defaults: Record<T, number>,
  storageKey: string
) {
  const [colWidths, setColWidths] = useState<Record<T, number>>(() => {
    if (typeof window === "undefined") return defaults;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return { ...defaults, ...JSON.parse(raw) };
    } catch {}
    return defaults;
  });

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(colWidths)); } catch {}
  }, [colWidths, storageKey]);

  const resizingRef = useRef<{ key: T; startX: number; startW: number } | null>(null);

  const startResize = (key: T) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = { key, startX: e.clientX, startW: colWidths[key] };
    const onMove = (ev: MouseEvent) => {
      const r = resizingRef.current;
      if (!r) return;
      const next = Math.max(70, r.startW + (ev.clientX - r.startX));
      setColWidths((w) => ({ ...w, [r.key]: next }));
    };
    const onUp = () => {
      resizingRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
    };
    document.body.style.cursor = "col-resize";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const reset = () => setColWidths(defaults);

  return { colWidths, startResize, reset };
}

interface ResizableHeadProps<T extends string, S extends string> {
  colKey: T;
  width: number;
  onResize: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  sortable?: boolean;
  sortableKey?: S;
  sortKey?: S;
  sortAsc?: boolean;
  onSort?: (key: S) => void;
  align?: "left" | "right";
  className?: string;
}

export function ResizableHead<T extends string, S extends string>({
  colKey, width, onResize, children, sortable, sortableKey,
  sortKey, sortAsc, onSort, align = "left", className,
}: ResizableHeadProps<T, S>) {
  const isActive = sortable && sortableKey && sortableKey === sortKey;
  return (
    <TableHead
      style={{ width, minWidth: width, maxWidth: width }}
      className={cn(
        "relative select-none",
        align === "right" && "text-right",
        isActive && "bg-primary/5 text-foreground",
        sortable && "cursor-pointer",
        className,
      )}
      onClick={sortable && sortableKey && onSort ? () => onSort(sortableKey) : undefined}
    >
      <div className={cn("flex items-center gap-1 pr-2 truncate", align === "right" && "justify-end")}>
        <span className={cn("truncate", isActive && "font-semibold")}>{children}</span>
        {sortable && (
          isActive ? (
            sortAsc
              ? <ArrowUp className="h-3.5 w-3.5 text-primary shrink-0" />
              : <ArrowDown className="h-3.5 w-3.5 text-primary shrink-0" />
          ) : (
            <ArrowUpDown className="h-3 w-3 text-muted-foreground/40 shrink-0" />
          )
        )}
      </div>
      <span
        onMouseDown={onResize}
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors"
        title="Arrastar para redimensionar"
      />
    </TableHead>
  );
}

export function StatusDot({ status }: { status?: string | null }) {
  const b = getStatusBadge(status);
  return (
    <span
      className={cn("h-2 w-2 rounded-full shrink-0", b.dotColor)}
      title={b.label}
    />
  );
}

export function normalizeStatus(s?: string | null): string {
  const u = (s || "").toUpperCase();
  if (u === "CAMPAIGN_PAUSED" || u === "ADSET_PAUSED") return "PAUSED";
  if (u === "PENDING_REVIEW") return "IN_PROCESS";
  return u;
}
