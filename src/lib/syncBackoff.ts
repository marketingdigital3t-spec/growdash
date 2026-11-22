type StorageLike = Pick<Storage, "getItem" | "setItem">;

const BACKOFF_PREFIX = "growdash:sync-backoff";
const BACKOFF_MAX_ATTEMPTS = 6;
// 1min, 2min, 4min, 8min, 16min, 32min — teto de 15min para não travar o usuário.
const BACKOFF_DELAYS_MS = [1 * 60_000, 2 * 60_000, 4 * 60_000, 8 * 60_000, 16 * 60_000, 32 * 60_000];
const DEFAULT_COOLDOWN_MS = 15 * 60_000;

function safeStorage(storage?: StorageLike | null) {
  try { return storage || null; } catch { return null; }
}

export function readSyncBackoff(storage: StorageLike | null | undefined, scope: string) {
  const fallback = 0;
  const target = safeStorage(storage);
  if (!target) return fallback;
  try {
    const value = Number(target.getItem(`${BACKOFF_PREFIX}:${scope}`) || 0);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  } catch {
    return fallback;
  }
}

export function recordSyncBackoff(storage: StorageLike | null | undefined, scope: string, failed: boolean, timestamp = Date.now()) {
  const target = safeStorage(storage);
  if (!target) return;
  try {
    const current = readSyncBackoff(storage, scope);
    const next = failed ? Math.min(current + 1, BACKOFF_MAX_ATTEMPTS) : 0;
    target.setItem(`${BACKOFF_PREFIX}:${scope}`, String(next));
  } catch {
    // quota/private mode cannot block synchronization
  }
}

export function syncBackoffDelayMs(storage: StorageLike | null | undefined, scope: string, now = Date.now()): number {
  const attempts = readSyncBackoff(storage, scope);
  if (attempts === 0) return 0;
  const index = Math.min(attempts - 1, BACKOFF_DELAYS_MS.length - 1);
  return BACKOFF_DELAYS_MS[index];
}

export function defaultSyncCooldownMs(): number {
  return DEFAULT_COOLDOWN_MS;
}
