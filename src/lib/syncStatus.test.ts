import { describe, expect, it } from "vitest";
import { describeSyncFailure, summarizeMetaSyncBlocks } from "./syncStatus";

describe("Meta sync block status", () => {
  it("preserva sucesso dos KPIs quando hourly falha", () => {
    expect(summarizeMetaSyncBlocks({
      insights: { status: "success", success: true },
      hourly: { status: "partial", errors: ["rate limit"] },
    })).toEqual({
      status: "success",
      success: true,
      warnings: ["Distribuição horária Meta parcialmente atualizada; snapshot anterior preservado.", "rate limit"],
    });
  });

  it("mantém parcial quando Insights não completa", () => {
    const result = summarizeMetaSyncBlocks({ insights: { status: "partial", success: false }, leads: { status: "success" } });
    expect(result.status).toBe("partial");
    expect(result.success).toBe(false);
  });
});

describe("sync status", () => {
  it("classifies a provider timeout as partial when a snapshot exists", () => {
    expect(describeSyncFailure({ hasSnapshot: true, provider: "RD", message: "Tempo de carregamento excedido." })).toEqual({
      state: "partial",
      message: "RD não respondeu a tempo. Último snapshot válido preservado; tente novamente para atualizar.",
    });
  });

  it("keeps the first load unavailable when there is no snapshot", () => {
    expect(describeSyncFailure({ hasSnapshot: false, provider: "Meta", message: "Falha de rede." })).toEqual({
      state: "error",
      message: "Meta indisponível neste momento. Tente novamente para carregar os dados.",
    });
  });
});
