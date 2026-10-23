export interface MetaSnapshotRefreshOptions<T> {
  current: T;
  previous?: T;
  isRefreshing: boolean;
  sameScope: boolean;
  previousUsable?: boolean;
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
