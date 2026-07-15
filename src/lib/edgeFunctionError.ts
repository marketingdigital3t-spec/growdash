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

  if (context instanceof Response) {
    try {
      payload = asRecord(await context.clone().json());
    } catch {
      // Some gateways return HTML/plain text. Keep the safe fallback instead.
    }
  }

  const nested = asRecord(payload?.details) ?? asRecord(payload?.meta_error);
  const message = String(payload?.error_description ?? payload?.error ?? nested?.message ?? fallback);
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
  const identifiers = [
    details.status ? `HTTP ${details.status}` : null,
    details.code != null ? `Meta ${details.code}` : null,
    details.subcode != null ? `subcódigo ${details.subcode}` : null,
  ].filter(Boolean).join(" · ");
  return identifiers ? `${details.message} (${identifiers})` : details.message;
}
