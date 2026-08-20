import { lazy, type ComponentType, type LazyExoticComponent } from "react";

export type RuntimeDiagnostic = {
  at: string;
  scope: string;
  message: string;
  recoverable: boolean;
};

const DIAGNOSTICS_KEY = "growdash:runtime-diagnostics";
const RECOVERY_KEY = "growdash:runtime-recovery";
const CHUNK_ERROR =
  /dynamically imported module|loading chunk|importing a module script|failed to fetch|module script|\bload failed\b|unable to preload (?:css|module)|error loading dynamically imported/i;

/**
 * Gives the document request a new cache key after a deployment replaced a
 * hashed chunk. Keeping the current route, query parameters and fragment is
 * important: a recovery must never drop the user's current context.
 */
export function latestBuildRecoveryUrl(href: string, nonce = Date.now()) {
  const url = new URL(href);
  url.searchParams.set("__gd_build", String(nonce));
  return url.toString();
}

export function consumeRecoveryAttempt(scope: string, windowMs = 30_000, limit = 2) {
  try {
    const now = Date.now();
    const stored = JSON.parse(sessionStorage.getItem(RECOVERY_KEY) || "{}");
    const previous = stored?.[scope];
    const current =
      previous && now - Number(previous.startedAt) < windowMs
        ? { attempts: Number(previous.attempts) || 0, startedAt: Number(previous.startedAt) }
        : { attempts: 0, startedAt: now };
    current.attempts += 1;
    sessionStorage.setItem(RECOVERY_KEY, JSON.stringify({ ...stored, [scope]: current }));
    return { ...current, blocked: current.attempts > limit };
  } catch {
    // With blocked sessionStorage, keep a single safe attempt instead of
    // creating a reload loop that cannot be remembered.
    return { attempts: 1, startedAt: Date.now(), blocked: false };
  }
}

export function clearRecoveryAttempts(scope: string) {
  try {
    const stored = JSON.parse(sessionStorage.getItem(RECOVERY_KEY) || "{}");
    if (stored && typeof stored === "object") {
      delete stored[scope];
      sessionStorage.setItem(RECOVERY_KEY, JSON.stringify(stored));
    }
  } catch {
    /* recovery storage is optional */
  }
}

export function isRecoverableChunkError(error: unknown) {
  return CHUNK_ERROR.test(error instanceof Error ? error.message : String(error));
}

export function recordRuntimeDiagnostic(scope: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const entry: RuntimeDiagnostic = {
    at: new Date().toISOString(),
    scope,
    message: message.slice(0, 500),
    recoverable: isRecoverableChunkError(error),
  };
  try {
    const previous = JSON.parse(sessionStorage.getItem(DIAGNOSTICS_KEY) || "[]");
    const history = Array.isArray(previous) ? previous.slice(-19) : [];
    history.push(entry);
    sessionStorage.setItem(DIAGNOSTICS_KEY, JSON.stringify(history));
  } catch {
    // Diagnóstico nunca pode impedir a recuperação da interface.
  }
  return entry;
}

/**
 * A Pages deployment can replace hashed route chunks while an old tab is
 * open. When that happens, reload the document once for the affected route.
 * The session marker prevents a failed deployment from becoming a reload loop.
 */
export function recoverLatestBuildOnce(scope: string, error: unknown) {
  if (!isRecoverableChunkError(error)) return false;
  recordRuntimeDiagnostic(`chunk-reload:${scope}`, error);
  // A Pages deploy can remove the hash requested by an already-open tab.
  // Reload exactly once for this route so the browser receives the new HTML
  // and manifest. The marker deliberately survives the application boot: if
  // the new build is also broken, it must fail visibly rather than loop.
  try {
    const key = `growdash:chunk-reload:${scope}`;
    const previous = Number(sessionStorage.getItem(key) || 0);
    if (previous && Date.now() - previous < 60_000) return false;
    sessionStorage.setItem(key, String(Date.now()));
    // reload() can reuse a cached HTML document which still points to the
    // deleted chunk. A harmless cache-busting parameter forces Pages/CDN and
    // the browser to request the current application shell instead.
    window.location.replace(latestBuildRecoveryUrl(window.location.href));
    return true;
  } catch {
    // If session storage is unavailable, preserve the visible recovery UI
    // instead of risking a repeated reload.
    return false;
  }
}

export async function withRequestTimeout<T>(
  request: PromiseLike<T>,
  milliseconds = 8_000,
): Promise<T> {
  let timer: number | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<T>((_resolve, reject) => {
        timer = window.setTimeout(
          () => reject(new Error("Tempo de carregamento excedido.")),
          milliseconds,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
  }
}

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

/**
 * Atualizações do Pages substituem arquivos com hash. Se uma aba antiga pede
 * um chunk que acabou de ser trocado, tentamos o import novamente antes de
 * propagar o erro para a fronteira da rota. Isso evita uma falha transitória
 * transformar-se em indisponibilidade da plataforma inteira.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
  scope: string,
): LazyExoticComponent<T> {
  return lazy(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await loader();
      } catch (error) {
        lastError = error;
        if (!isRecoverableChunkError(error) || attempt === 2) break;
        await wait((attempt + 1) * 1_000);
      }
    }
    recordRuntimeDiagnostic(scope, lastError);
    throw lastError instanceof Error ? lastError : new Error(`Não foi possível carregar ${scope}.`);
  });
}
