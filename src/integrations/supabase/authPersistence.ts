import type { Session } from "@supabase/supabase-js";

export type AuthPersistenceMode = "auto" | "local" | "session";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * Reads the last Supabase session without making a network request. This is
 * only a recovery hint while Auth is unavailable; protected operations still
 * require the server to validate the access token.
 */
export function readPersistedSession(storage: StorageLike, storageKey: string): Session | null {
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const candidate = parsed as Partial<Session>;
    if (typeof candidate.access_token !== "string" || !candidate.access_token) return null;
    if (typeof candidate.refresh_token !== "string" || !candidate.refresh_token) return null;
    if (!candidate.user || typeof candidate.user !== "object") return null;
    if (typeof candidate.expires_at !== "number" || !Number.isFinite(candidate.expires_at)) return null;
    if (candidate.expires_at <= Math.floor(Date.now() / 1000) + 15) return null;
    return candidate as Session;
  } catch {
    return null;
  }
}

export function createMemoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

/**
 * Supabase normally receives one storage implementation for the lifetime of
 * the client. This adapter keeps that invariant while allowing the login form
 * to choose between a persistent browser session and a tab-only session.
 */
export function createAuthStorage(
  local: StorageLike,
  session: StorageLike,
  getMode: () => AuthPersistenceMode,
  storageKey: string,
): StorageLike {
  const selected = () => {
    const mode = getMode();
    if (mode === "session") return session;
    if (mode === "local") return local;
    return local.getItem(storageKey) !== null ? local : session;
  };

  return {
    getItem: (key) => selected().getItem(key),
    setItem: (key, value) => {
      const target = selected();
      target.setItem(key, value);
      // Never leave two refresh-token copies behind. That would make an
      // unchecked "remember me" selection persist after a later reload.
      (target === local ? session : local).removeItem(key);
    },
    removeItem: (key) => {
      local.removeItem(key);
      session.removeItem(key);
    },
  };
}

