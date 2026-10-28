export type AiProviderErrorCode =
  | "AI_PROVIDER_CREDITS_EXHAUSTED"
  | "AI_PROVIDER_RATE_LIMITED"
  | "AI_PROVIDER_AUTH_INVALID"
  | "AI_PROVIDER_UNAVAILABLE";

export type AiProviderErrorClassification = {
  code: AiProviderErrorCode;
  status: 402 | 429 | 503;
  message: string;
  retryable: boolean;
};

function normalizedProviderText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const root = payload as Record<string, unknown>;
  const nested = root.error && typeof root.error === "object" ? root.error as Record<string, unknown> : null;
  return [root.code, root.type, root.error_code, root.message, nested?.code, nested?.type, nested?.message]
    .filter((value): value is string | number => typeof value === "string" || typeof value === "number")
    .join(" ")
    .toLowerCase();
}

export function classifyAiProviderError(status: number, payload?: unknown): AiProviderErrorClassification {
  const providerText = normalizedProviderText(payload);
  const creditsExhausted = status === 402
    || /credit_balance_exhausted|insufficient_quota|billing_hard_limit|billing_not_active|quota_exceeded|credit balance|quota.*exhausted/.test(providerText);

  if (creditsExhausted) {
    return {
      code: "AI_PROVIDER_CREDITS_EXHAUSTED",
      status: 402,
      message: "Créditos da IA esgotados. Verifique a franquia do plano.",
      retryable: false,
    };
  }

  if (status === 429) {
    return {
      code: "AI_PROVIDER_RATE_LIMITED",
      status: 429,
      message: "Limite de requisições atingido. Tente novamente em instantes.",
      retryable: true,
    };
  }

  if (status === 401 || status === 403) {
    return {
      code: "AI_PROVIDER_AUTH_INVALID",
      status: 503,
      message: "AI_PROVIDER_AUTH_INVALID",
      retryable: false,
    };
  }

  return {
    code: "AI_PROVIDER_UNAVAILABLE",
    status: 503,
    message: "Falha ao consultar IA",
    retryable: true,
  };
}
