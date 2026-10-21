export type AuthPersistenceMode = "auto" | "local" | "session";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

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

