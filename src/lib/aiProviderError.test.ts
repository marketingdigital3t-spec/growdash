import { describe, expect, it } from "vitest";
import { classifyAiProviderError } from "./aiProviderError";

describe("classifyAiProviderError", () => {
  it("classifica crédito esgotado mesmo quando a OpenAI responde 429", () => {
    expect(classifyAiProviderError(429, {
      error: { code: "credit_balance_exhausted", type: "insufficient_quota" },
    })).toEqual({
      code: "AI_PROVIDER_CREDITS_EXHAUSTED",
      status: 402,
      message: "Créditos da IA esgotados. Verifique a franquia do plano.",
      retryable: false,
    });
  });

  it("mantém rate limit verdadeiro como erro temporário", () => {
    expect(classifyAiProviderError(429, { error: { code: "rate_limit_exceeded" } })).toMatchObject({
      code: "AI_PROVIDER_RATE_LIMITED",
      status: 429,
      retryable: true,
    });
  });

  it("não expõe o payload quando a credencial do provedor é inválida", () => {
    expect(classifyAiProviderError(401, { error: { message: "secret token value" } })).toEqual({
      code: "AI_PROVIDER_AUTH_INVALID",
      status: 503,
      message: "AI_PROVIDER_AUTH_INVALID",
      retryable: false,
    });
  });
});
