import { businessDateKey } from "@/lib/businessDate";

export type SyncContext = {
  scope: string;
};

/**
 * Maximum time the shell may present a provider refresh as blocking.
 *
 * Keep a small rendering/network scheduling margin below the five-second
 * product budget so the user-visible state changes before the hard limit even
 * when the browser event loop is busy. This is only the visual deadline; the
 * provider request remains alive and can still persist its snapshot.
 */
export const SYNC_UI_DEADLINE_MS = 4_500;

export function backgroundSyncStatus() {
  return {
    state: "background" as const,
    message: "Meta ainda está atualizando em segundo plano. O último snapshot válido permanece visível.",
  };
}

/**
 * A changed account/date scope must reconcile the selected period before the
 * view reads the cached snapshot. Navigating between app routes only changes
 * presentation; it must not start another Meta/RD request.
 */
export function shouldForceSyncForContextChange(previous: SyncContext | null, next: SyncContext): boolean {
  if (!previous) return false;
  return previous.scope !== next.scope;
}

/** A recent provider window cannot confirm a selected historical interval. */
export function shouldUseSelectedPeriodSync(
  startDate: string | undefined,
  endDate: string | undefined,
  timezone?: string,
  now = new Date(),
) {
  if (!startDate || !endDate || startDate === "today" || endDate === "today") return false;
  const today = businessDateKey(now, timezone);
  return startDate !== today || endDate !== today;
}
