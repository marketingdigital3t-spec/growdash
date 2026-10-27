export const MFA_CHECK_TIMEOUT_MS = 12_000;
export const MFA_VERIFY_TIMEOUT_MS = 15_000;

export type MfaErrorKind = "timeout" | "network" | "unauthorized" | "unknown";

function errorText(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const candidate = error as { message?: unknown; code?: unknown; status?: unknown };
    return [candidate.message, candidate.code, candidate.status].filter(Boolean).join(" ");
  }
  return String(error || "");
}

export function classifyMfaError(error: unknown): MfaErrorKind {
  const message = errorText(error);
  if (/timeout|timed out|tempo de resposta|tempo de carregamento|excedido/i.test(message)) return "timeout";
  if (/failed to fetch|network|fetch|upstream|temporar|5\d\d|502|503|504/i.test(message)) return "network";
  if (/401|403|jwt|token|session|sess[aã]o|unauthori[sz]ed|invalid.*(token|session)/i.test(message)) return "unauthorized";
  return "unknown";
}

export function mfaCheckErrorMessage(error: unknown) {
  switch (classifyMfaError(error)) {
    case "timeout":
    case "network":
      return "O serviço de autenticação está temporariamente indisponível. Sua sessão foi preservada; tente novamente em alguns instantes.";
    case "unauthorized":
      return "Sua sessão precisa ser renovada para verificar a segurança. Tente novamente ou saia da conta para entrar de novo.";
    default:
      return "Não foi possível verificar a segurança da sessão. Tente novamente.";
  }
}

export function mfaVerifyErrorMessage(error: unknown) {
  switch (classifyMfaError(error)) {
    case "timeout":
    case "network":
      return "A autenticação não respondeu a tempo. O código não foi descartado; tente novamente.";
    case "unauthorized":
      return "Sua sessão precisa ser renovada. Tente novamente ou saia da conta para entrar de novo.";
    default:
      return "Código inválido ou expirado. Gere um novo código e tente novamente.";
  }
}

