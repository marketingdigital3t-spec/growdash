export interface MetaSnapshotRefreshOptions<T> {
  current: T;
  previous?: T;
  isRefreshing: boolean;
  sameScope: boolean;
  previousUsable?: boolean;
}

export interface PersistedSnapshot<T> {
  scopeKey: string;
  savedAt: string;
  value: T;
}

/**
 * A persisted snapshot is display-only data. It is safe to hydrate only when
 * the authenticated identity and the complete analytics scope match exactly;
 * malformed records must never become a fabricated zero-valued metric.
 */
export function resolvePersistedSnapshot<T>(
  snapshot: Partial<PersistedSnapshot<T>> | null | undefined,
  scopeKey: string,
): T | undefined {
  if (!snapshot || snapshot.scopeKey !== scopeKey || !snapshot.savedAt || snapshot.value == null) return undefined;
  return snapshot.value;
}

/**
 * Keeps a confirmed snapshot visible while the exact same scope is being
 * reloaded. A different scope or a first load must continue through the
 * normal loading/unavailable states.
 */
export function resolveMetaSnapshotDuringRefresh<T>({ current, previous, isRefreshing, sameScope, previousUsable = true }: MetaSnapshotRefreshOptions<T>) {
  const preserved = Boolean(isRefreshing && sameScope && previous && previousUsable);
  return { value: preserved ? previous : current, preserved };
}
