import { describe, expect, it } from "vitest";
import {
  RD_REQUEST_ATTEMPTS,
  RD_REQUEST_BACKOFFS_MS,
  RD_SYNC_RUNTIME_BUDGET_MS,
  safeRDRequestTimeoutMs,
  worstCaseRDRequestMs,
} from "./rdSyncRuntimeBudget";

/**
 * The RD sync edge function runs under a gateway runtime budget. A single
 * provider request can retry with exponential backoff, and every attempt can
 * burn the per-request timeout. When the total time of one logical request
 * exceeds the remaining runtime budget, the gateway kills the invocation and
 * the client sees a non-2xx status instead of the resumable partial payload.
 *
 * These tests pin the budget arithmetic that keeps one provider request
 * inside the invocation budget, so a slow RD page can never outlive it.
 */
describe("RD sync runtime budget", () => {
  it("expõe o budget e o número de tentativas usados pela edge function", () => {
    expect(RD_SYNC_RUNTIME_BUDGET_MS).toBe(90_000);
    expect(RD_REQUEST_ATTEMPTS).toBe(3);
    expect(RD_REQUEST_BACKOFFS_MS.length).toBeGreaterThanOrEqual(RD_REQUEST_ATTEMPTS - 1);
  });

  it("mantém uma requisição lógica dentro do budget mesmo com o timeout antigo de 30s", () => {
    const worstCase = worstCaseRDRequestMs(30_000);

    expect(worstCase).toBe(110_000);
    expect(worstCase).toBeGreaterThan(RD_SYNC_RUNTIME_BUDGET_MS);
  });

  it("deriva um timeout por tentativa que nunca ultrapassa o budget do runtime", () => {
    const safeTimeoutMs = safeRDRequestTimeoutMs();
    const worstCase = worstCaseRDRequestMs(safeTimeoutMs);

    expect(worstCase).toBeLessThanOrEqual(RD_SYNC_RUNTIME_BUDGET_MS);
  });

  it("mantém o timeout por tentativa acima de 1 segundo mesmo com budget apertado", () => {
    expect(safeRDRequestTimeoutMs(1_000)).toBeGreaterThanOrEqual(1_000);
  });
});
