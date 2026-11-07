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

/**
 * Prefixos de chaves de cache que podem ser descartadas sem perda de dados.
 * São snapshots de tela, diagnósticos e histórico de sincronização.
 */
const DISCARDABLE_CACHE_PREFIXES = [
  "growdash:rd-",
  "growdash:last-",
  "growdash:runtime-diagnostics",
  "growdash:runtime-recovery",
];

/**
 * Escreve no localStorage sem nunca deixar uma `QuotaExceededError` escapar.
 *
 * Quando a cota do navegador estoura (localStorage cheio), a escrita falha com
 * `QuotaExceededError`. Se essa exceção escapar durante um render ou um
 * `useEffect`, ela derruba a aplicacao inteira para a fronteira de erro.
 * Aqui a falha e contida: primeiro tentamos liberar espaco removendo caches
 * descartaveis e, se ainda assim nao couber, mantemos o estado apenas em
 * memoria sem interromper a interface.
 */
export function safeSetLocalStorage(key: string, value: string): boolean {
  if (!key || typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    try {
      for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
        const candidate = window.localStorage.key(index);
        if (!candidate) continue;
        if (DISCARDABLE_CACHE_PREFIXES.some((prefix) => candidate.startsWith(prefix)) || candidate.includes("cache")) {
          window.localStorage.removeItem(candidate);
        }
      }
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      // A cota continua cheia: a preferencia permanece apenas em memoria.
      return false;
    }
  }
}

/**
 * Remove chaves de cache descartaveis quando o storage local cresce demais.
 * Executar no boot evita o `QuotaExceededError` antes mesmo do React iniciar.
 */
export function purgeDiscardableLocalStorage(thresholdBytes = 3 * 1024 * 1024): number {
  if (typeof window === "undefined") return 0;
  let purged = 0;
  try {
    let total = 0;
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key) continue;
      total += (window.localStorage.getItem(key) || "").length * 2;
    }
    if (total <= thresholdBytes) return 0;
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (!key) continue;
      if (DISCARDABLE_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)) || key.includes("cache")) {
        window.localStorage.removeItem(key);
        purged += 1;
      }
    }
  } catch {
    // Storage indisponivel: nada a purgar.
  }
  return purged;
}
