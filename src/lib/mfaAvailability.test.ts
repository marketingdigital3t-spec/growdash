import { describe, expect, it } from "vitest";
import { MFA_CHECK_TIMEOUT_MS, MFA_VERIFY_TIMEOUT_MS, classifyMfaError, mfaCheckErrorMessage, mfaVerifyErrorMessage } from "./mfaAvailability";

describe("MFA availability", () => {
  it("uses finite, independent deadlines for checking and verifying", () => {
    expect(MFA_CHECK_TIMEOUT_MS).toBe(12_000);
    expect(MFA_VERIFY_TIMEOUT_MS).toBe(15_000);
    expect(MFA_VERIFY_TIMEOUT_MS).toBeGreaterThan(MFA_CHECK_TIMEOUT_MS);
  });

  it("keeps a transient Auth failure recoverable without calling it an invalid session", () => {
    expect(classifyMfaError(new Error("Tempo de resposta do Supabase excedido."))).toBe("timeout");
    expect(mfaCheckErrorMessage(new Error("Failed to fetch"))).toContain("sessão foi preservada");
  });

  it("reports an Auth rejection separately from transport failure", () => {
    expect(classifyMfaError({ status: 401, message: "JWT inválido" })).toBe("unauthorized");
    expect(mfaCheckErrorMessage({ status: 401, message: "JWT inválido" })).toContain("renovada");
  });

  it("does not present a slow verification as an invalid code", () => {
    expect(mfaVerifyErrorMessage(new Error("timeout"))).toContain("não respondeu a tempo");
    expect(mfaVerifyErrorMessage(new Error("invalid code"))).toContain("Código inválido");
  });
});
