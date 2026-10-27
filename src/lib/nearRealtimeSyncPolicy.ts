export type SyncContext = {
  scope: string;
  navigationKey: string;
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
 * A changed account/date scope or app tab must reconcile the selected period
 * before the view reads the cached snapshot. The initial mount keeps the
 * cheaper recent-window refresh because there is no previous context to
 * invalidate.
 */
export function shouldForceSyncForContextChange(previous: SyncContext | null, next: SyncContext): boolean {
  if (!previous) return false;
  return previous.scope !== next.scope || previous.navigationKey !== next.navigationKey;
}
