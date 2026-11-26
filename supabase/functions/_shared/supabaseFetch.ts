/** Keep internal Supabase requests bounded when PostgREST/Auth loses its DB connection. */
export const SUPABASE_INTERNAL_REQUEST_TIMEOUT_MS = 30_000;

export function fetchSupabaseWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const parentSignal = init.signal;
  const abortFromParent = () => controller.abort(parentSignal?.reason);
  if (parentSignal?.aborted) abortFromParent();
  else parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  const timer = setTimeout(() => {
    controller.abort(new DOMException("Supabase request timed out", "TimeoutError"));
  }, SUPABASE_INTERNAL_REQUEST_TIMEOUT_MS);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
    parentSignal?.removeEventListener("abort", abortFromParent);
  });
}

