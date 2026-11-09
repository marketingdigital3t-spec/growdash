import { describe, expect, it } from "vitest";
import { buildCrmMetricAvailability } from "./crmAvailability";

describe("buildCrmMetricAvailability", () => {
  it("usa noSnapshotReason quando nao ha snapshot confirmado", () => {
    const availability = buildCrmMetricAvailability({
      loading: false,
      failed: false,
      hasSnapshot: false,
      hasRows: false,
      reason: "Falha ao consultar o webhook.",
      noSnapshotReason: "Aguardando a primeira leitura confirmada dos leads recebidos pelo webhook.",
    });

    expect(availability).toEqual({
      state: "unavailable",
      reason: "Aguardando a primeira leitura confirmada dos leads recebidos pelo webhook.",
    });
  });

  it("usa o fallback padrao quando nao ha snapshot e nenhuma razao especifica", () => {
    const availability = buildCrmMetricAvailability({
      loading: false,
      failed: false,
      hasSnapshot: false,
      hasRows: false,
    });

    expect(availability.state).toBe("unavailable");
    expect(availability.reason).toBe("Aguardando a primeira sincronização confirmada do RD Station.");
  });
});
