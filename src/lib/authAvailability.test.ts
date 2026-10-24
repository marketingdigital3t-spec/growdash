import { describe, expect, it } from "vitest";
import { AUTH_SESSION_TIMEOUT_MS, authSessionErrorMessage } from "./authAvailability";

describe("auth availability", () => {
  it("bounds the initial session check so the shell cannot load forever", () => {
    expect(AUTH_SESSION_TIMEOUT_MS).toBe(12_000);
  });

  it("turns a transient auth transport error into an actionable message", () => {
    expect(authSessionErrorMessage(new Error("Failed to fetch"))).toContain("autenticação");
  });

  it("does not hide a non-transient auth error behind an outage message", () => {
    expect(authSessionErrorMessage(new Error("JWT inválido"))).toContain("validar sua sessão");
  });
});
