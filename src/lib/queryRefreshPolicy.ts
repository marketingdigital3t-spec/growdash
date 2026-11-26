/**
 * A persisted snapshot is already a usable first paint. The realtime
 * coordinator invalidates active queries after it writes fresh Meta/RD facts,
 * so mounting another route must not start the same expensive read again.
 * Queries without a snapshot still need their initial request.
 */
export function shouldRefetchSnapshotOnMount(hasSnapshot: boolean) {
  return !hasSnapshot;
}
