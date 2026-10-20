/**
 * Local cache used only as stale-while-revalidate display data.
 * Cache keys are scoped by the authenticated user (and workspace when needed).
 * It never grants access: Supabase and RLS remain the authority.
 */
export function readLocalCache<T>(key: string): T | undefined {
  if (!key || typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : undefined;
  } catch {
    return undefined;
  }
}

export function writeLocalCache<T>(key: string, value: T) {
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local persistence is an optimization; private mode and quota limits are valid.
  }
}
