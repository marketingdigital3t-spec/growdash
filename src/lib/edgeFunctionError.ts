export type EdgeFunctionErrorDetails = {
  message: string;
  status?: number;
  code?: number | string;
  subcode?: number | string;
  needsReauth: boolean;
  retryable: boolean;
};

type FunctionErrorLike = Error & { context?: Response };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

export async function edgeFunctionErrorDetails(error: unknown): Promise<EdgeFunctionErrorDetails> {
  const fallback = error instanceof Error ? error.message : "Não foi possível executar a função.";
  const context = (error as FunctionErrorLike | null)?.context;
  let status = context instanceof Response ? context.status : undefined;
  let payload: Record<string, unknown> | null = null;
  let rawBody = "";

  if (context instanceof Response) {
    // The gateway can answer with plain text (HTML error pages, empty bodies).
    // Reading text first keeps the real reason visible instead of degrading
    // every failure into an opaque "non-2xx" message.
    const body = await context.clone().text();
    rawBody = body.trim();
    if (rawBody) {
      try { payload = asRecord(JSON.parse(rawBody)); } catch { payload = null; }
    }
  }

  const nested = asRecord(payload?.details) ?? asRecord(payload?.meta_error);
  const payloadMessage = payload?.error_description ?? payload?.error ?? payload?.message ?? nested?.message;
  const bodyMessage = !payloadMessage && rawBody && rawBody.length <= 400 ? rawBody : "";
  const message = String(payloadMessage ?? bodyMessage ?? "") || fallback;
  const code = payload?.code ?? payload?.error_code ?? nested?.code;
  const subcode = payload?.subcode ?? payload?.error_subcode ?? nested?.error_subcode;
  if (!status && typeof payload?.http_status === "number") status = payload.http_status;
  const normalizedCode = Number(code);
  const needsReauth = status === 401 || normalizedCode === 190 || Boolean(payload?.needs_reauth);
  const retryableCodes = new Set([1, 2, 4, 17, 32, 613, 80004]);
  const retryable = status === 429 || Number(status) >= 500 || retryableCodes.has(normalizedCode) || Boolean(payload?.retryable);
  return { message, status, code: code as number | string | undefined, subcode: subcode as number | string | undefined, needsReauth, retryable };
}

export function formatEdgeFunctionError(details: EdgeFunctionErrorDetails) {
  const identifiers = [details.status ? `HTTP ${details.status}` : null, details.code != null ? `Meta ${details.code}` : null, details.subcode != null ? `subcódigo ${details.subcode}` : null].filter(Boolean).join(" · ");
  return identifiers ? `${details.message} (${identifiers})` : details.message;
}

export async function getEdgeFunctionErrorMessage(error: unknown, fallback: string) {
  const details = await edgeFunctionErrorDetails(error);
  const context = (error as FunctionErrorLike | null)?.context;
  let action = "";
  if (context instanceof Response) {
    const raw = await context.clone().text();
    try {
      const payload = asRecord(JSON.parse(raw));
      if (typeof payload?.action === "string") action = ` ${payload.action}`;
    } catch { /* gateway may answer with plain text */ }
  }
  // Only fall back when the gateway gave us nothing usable. A "non-2xx"
  // message combined with a real body must keep the real reason visible.
  const unusable = !details.message || details.message === "Não foi possível executar a função." || /^\s*non-2xx\s*$/i.test(details.message);
  const message = unusable ? fallback : details.message;
  return `${message}${action}`;
}
