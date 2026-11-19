/**
 * Observabilidade para Edge Functions críticas: correlation ID propagável,
 * logs estruturados e registro de alertas na tabela `alerts` do Supabase.
 */

/**
 * Gera um correlation ID para rastrear uma requisição através de múltiplas
 * Edge Functions e camadas do sistema. Formato: UUID v4.
 */
export function generateCorrelationId(): string {
  return crypto.randomUUID();
}

/**
 * Extrai o correlation ID dos headers da requisição, ou gera um novo se
 * ausente. Usado no ponto de entrada de cada Edge Function.
 */
export function extractCorrelationId(
  headers: Headers | Record<string, string | null | undefined>,
): string {
  let incoming: string | null | undefined;
  if (typeof (headers as Headers).get === "function") {
    incoming =
      (headers as Headers).get("x-correlation-id") ??
      (headers as Headers).get("X-Correlation-Id") ??
      (headers as Headers).get("x-request-id") ??
      (headers as Headers).get("X-Request-Id");
  } else {
    incoming =
      (headers as Record<string, string | null | undefined>)["x-correlation-id"] ??
      (headers as Record<string, string | null | undefined>)["X-Correlation-Id"] ??
      (headers as Record<string, string | null | undefined>)["x-request-id"] ??
      (headers as Record<string, string | null | undefined>)["X-Request-Id"];
  }
  if (typeof incoming === "string" && incoming.trim()) return incoming.trim();
  return generateCorrelationId();
}

/**
 * Adiciona headers de rastreamento a um fetch para propagar o correlation ID
 * entre Edge Functions.
 */
export function withCorrelationHeaders(
  headers: Record<string, string>,
  correlationId: string,
): Record<string, string> {
  return {
    ...headers,
    "x-correlation-id": correlationId,
    "x-request-id": correlationId,
  };
}

/**
 * Monta uma mensagem de log estruturada (JSON) para console das Edge Functions,
 * incluindo correlation ID para correlação entre logs.
 */
export function structuredLog({
  level,
  message,
  correlationId,
  context,
}: {
  level: "info" | "warn" | "error";
  message: string;
  correlationId?: string | null;
  context?: Record<string, unknown>;
}) {
  const entry: Record<string, unknown> = {
    level,
    message,
    ts: new Date().toISOString(),
  };
  if (correlationId) entry.correlation_id = correlationId;
  if (context) entry.context = context;
  console.log(JSON.stringify(entry));
}
