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

/**
 * Realtime fires once per written row. A full RD reconciliation persists
 * hundreds of rows in micro-batches, so invalidating on every event makes the
 * UI refetch and repaint the numbers several times per second. While a sync
 * is running, the invalidation is only recorded and applied once it settles.
 */
export type LiveInvalidationGate = {
  syncInFlight: boolean;
  pending: boolean;
};

export function createLiveInvalidationGate(): LiveInvalidationGate {
  return { syncInFlight: false, pending: false };
}

/** Returns true when the invalidation must be applied immediately. */
export function shouldApplyLiveInvalidationNow(gate: LiveInvalidationGate): boolean {
  return !gate.syncInFlight;
}

/** Records an invalidation while a sync is running. */
export function deferLiveInvalidation(gate: LiveInvalidationGate): boolean {
  gate.pending = true;
  return false;
}

/**
 * Ends the sync window. Returns true when a pending invalidation must be
 * applied now, so the caller can refresh the affected queries exactly once.
 */
export function closeLiveInvalidationWindow(gate: LiveInvalidationGate): boolean {
  gate.syncInFlight = false;
  if (!gate.pending) return false;
  gate.pending = false;
  return true;
}
