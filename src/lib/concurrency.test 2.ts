import { describe, expect, it } from "vitest";
import {
  isProviderRateLimited,
  isTransientProviderOverload,
  mapWithConcurrency,
  syncQueueDelayMs,
} from "./concurrency";

describe("mapWithConcurrency", () => {
  it("nunca executa mais que o limite de chamadas simultaneas", async () => {
    let active = 0;
    let peak = 0;
    const items = Array.from({ length: 10 }, (_, index) => index);

    const results = await mapWithConcurrency(items, 2, async (item) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return item * 2;
    });

    expect(peak).toBeLessThanOrEqual(2);
    expect(results).toEqual(items.map((item) => item * 2));
  });

  it("preserva a ordem dos resultados", async () => {
    const results = await mapWithConcurrency([30, 10, 20], 3, async (delay) => {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return delay;
    });

    expect(results).toEqual([30, 10, 20]);
  });
});

describe("syncQueueDelayMs", () => {
  it("nao atrasa o primeiro item e aplica a pausa nos seguintes", () => {
    expect(syncQueueDelayMs(0)).toBe(0);
    expect(syncQueueDelayMs(1)).toBe(250);
    expect(syncQueueDelayMs(4, 500)).toBe(500);
  });
});

describe("isProviderRateLimited", () => {
  it("reconhece o erro #4 da Meta", () => {
    expect(isProviderRateLimited("(#4) Application request limit reached")).toBe(true);
    expect(isProviderRateLimited("Meta OAuth error (#4)")).toBe(true);
  });

  it("nao confunde outros erros com rate limit", () => {
    expect(isProviderRateLimited("Unsupported get request")).toBe(false);
    expect(isProviderRateLimited("Invalid OAuth code")).toBe(false);
  });
});

describe("isTransientProviderOverload", () => {
  it("reconhece sobrecarga de infraestrutura do provedor", () => {
    expect(
      isTransientProviderOverload("canceling statement due to statement timeout"),
    ).toBe(true);
    expect(
      isTransientProviderOverload(
        "Function failed due to not having enough compute resources (please check logs)",
      ),
    ).toBe(true);
    expect(isTransientProviderOverload("Failed to send a request to the Edge Function")).toBe(true);
  });

  it("nao trata erro de negocio como sobrecarga", () => {
    expect(isTransientProviderOverload("Nenhuma conta de anúncio acessível")).toBe(false);
  });
});
