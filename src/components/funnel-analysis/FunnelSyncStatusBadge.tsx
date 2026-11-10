import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";

interface Props {
  /** Timestamp of the last confirmed provider snapshot. */
  lastUpdatedAt: Date | null;
  /** A provider reconciliation is running in the background. */
  syncing?: boolean;
}

/**
 * Communicates data freshness without blocking the screen. The confirmed
 * snapshot stays on screen while the badge explains that a background
 * reconciliation is running.
 */
export function FunnelSyncStatusBadge({ lastUpdatedAt, syncing = false }: Props) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!lastUpdatedAt) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 60_000);
    return () => window.clearInterval(timer);
  }, [lastUpdatedAt]);

  if (syncing) {
    return (
      <span role="status" aria-live="polite" className="gd-funnel-sync-badge inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        Sincronização em andamento
      </span>
    );
  }

  if (!lastUpdatedAt) return null;

  return (
    <span role="status" className="gd-funnel-sync-badge inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground">
      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
      <Clock className="h-3 w-3" aria-hidden="true" />
      Atualizado {formatDistanceToNow(lastUpdatedAt, { addSuffix: true, locale: ptBR })}
    </span>
  );
}
