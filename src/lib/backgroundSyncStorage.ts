type StorageLike = Pick<Storage, "getItem" | "setItem">;

// A full/blocked browser storage must not prevent the provider request. The
// in-memory map keeps the same-tab deduplication guarantee while localStorage
// remains the cross-tab optimization whenever the browser accepts it.
const memoryAttempts = new Map<string, number>();

function safeStorage(storage?: StorageLike | null) {
  try { return storage || null; } catch { return null; }
}

export function readBackgroundSyncAttempt(storage: StorageLike | null | undefined, key: string) {
  const fallback = memoryAttempts.get(key) || 0;
  const target = safeStorage(storage);
  if (!target) return fallback;
  try {
    const value = Number(target.getItem(key) || 0);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  } catch {
    return fallback;
  }
}

export function recordBackgroundSyncAttempt(storage: StorageLike | null | undefined, key: string, timestamp = Date.now()) {
  memoryAttempts.set(key, timestamp);
  const target = safeStorage(storage);
  if (!target) return;
  try { target.setItem(key, String(timestamp)); } catch { /* quota/private mode cannot block synchronization */ }
}
