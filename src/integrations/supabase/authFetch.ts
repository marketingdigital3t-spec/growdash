const RETRYABLE_AUTH_STATUS = new Set([500, 501, 502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 528, 529, 530]);

// GoTrue password verification in this project can take ~12s under load.
// Eight seconds aborted valid logins and converted a normal 400 into a fake
// outage, so allow one complete verification window and one bounded retry.
export const AUTH_PASSWORD_ATTEMPTS = 2;
export const AUTH_PASSWORD_ATTEMPT_TIMEOUT_MS = 20_000;
export const SUPABASE_FUNCTION_TIMEOUT_MS = 120_000;
export const SUPABASE_DATA_TIMEOUT_MS = 30_000;

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) return input.method.toUpperCase();
  return "GET";
}

export function isPasswordGrantRequest(input: RequestInfo | URL, init?: RequestInit) {
  if (requestMethod(input, init) !== "POST") return false;
  try {
    const url = new URL(requestUrl(input), typeof window === "undefined" ? "http://localhost" : window.location.origin);
    return url.pathname.endsWith("/auth/v1/token") && url.searchParams.get("grant_type") === "password";
  } catch {
    return false;
  }
}

function retryableResponse(response: Response) {
  return RETRYABLE_AUTH_STATUS.has(response.status);
}

const wait = (milliseconds: number) => new Promise<void>((resolve) => globalThis.setTimeout(resolve, milliseconds));

function requestInputForAttempt(input: RequestInfo | URL) {
  // A Request body can be consumed by fetch. Clone it before each retry while
  // leaving string and URL inputs untouched.
  return typeof Request !== "undefined" && input instanceof Request ? input.clone() : input;
}

function requestTimeoutMs(input: RequestInfo | URL) {
  try {
    const url = new URL(requestUrl(input), typeof window === "undefined" ? "http://localhost" : window.location.origin);
    return url.pathname.includes("/functions/v1/") ? SUPABASE_FUNCTION_TIMEOUT_MS : SUPABASE_DATA_TIMEOUT_MS;
  } catch {
    return SUPABASE_DATA_TIMEOUT_MS;
  }
}

async function fetchWithDeadline(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  fetcher: Fetcher,
  timeoutMs: number,
) {
  const externalSignal = init?.signal;
  const controller = new AbortController();
  const abortFromExternal = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) abortFromExternal();
  else externalSignal?.addEventListener("abort", abortFromExternal, { once: true });
  const timer = globalThis.setTimeout(() => controller.abort(new DOMException("Tempo de resposta do Supabase excedido.", "TimeoutError")), timeoutMs);
  try {
    return await fetcher(input, { ...init, signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timer);
    externalSignal?.removeEventListener("abort", abortFromExternal);
  }
}

/**
 * Serializes password-login retries at the network boundary. Supabase Auth
 * returns 5xx/Cloudflare gateway responses as retryable errors, but a caller
 * timeout alone leaves the original fetch alive and can create overlapping
 * login requests. Only the password grant is retried here. Other Auth, Data
 * API and Edge Function requests use a bounded deadline without retries.
 */
export async function fetchAuthWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: {
    fetcher?: Fetcher;
    attempts?: number;
    attemptTimeoutMs?: number;
    wait?: (milliseconds: number) => Promise<void>;
  } = {},
): Promise<Response> {
  const fetcher = options.fetcher ?? ((request, requestInit) => globalThis.fetch(request, requestInit));
  if (!isPasswordGrantRequest(input, init)) return fetchWithDeadline(input, init, fetcher, requestTimeoutMs(input));

  const attempts = Math.max(1, options.attempts ?? AUTH_PASSWORD_ATTEMPTS);
  const attemptTimeoutMs = Math.max(1, options.attemptTimeoutMs ?? AUTH_PASSWORD_ATTEMPT_TIMEOUT_MS);
  const pause = options.wait ?? wait;
  const externalSignal = init?.signal;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (externalSignal?.aborted) throw externalSignal.reason ?? new DOMException("A requisição foi cancelada.", "AbortError");

    const controller = new AbortController();
    const onExternalAbort = () => controller.abort(externalSignal.reason);
    externalSignal?.addEventListener("abort", onExternalAbort, { once: true });
    const timer = globalThis.setTimeout(() => controller.abort(new DOMException("Tempo de autenticação excedido.", "TimeoutError")), attemptTimeoutMs);

    try {
      const response = await fetcher(requestInputForAttempt(input), { ...init, signal: controller.signal });
      if (!retryableResponse(response) || attempt === attempts - 1) return response;
    } catch (error) {
      if (externalSignal?.aborted) throw error;
      lastError = error;
      if (attempt === attempts - 1) throw error;
    } finally {
      globalThis.clearTimeout(timer);
      externalSignal?.removeEventListener("abort", onExternalAbort);
    }

    await pause(700 * (attempt + 1));
  }

  throw lastError instanceof Error ? lastError : new Error("Falha temporária no serviço de autenticação.");
}
