export type SyncContext = {
  scope: string;
  navigationKey: string;
};

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
