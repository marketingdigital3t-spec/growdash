import { describe, expect, it } from "vitest";
import { collectSyncWarnings, describeSyncFailure, isTerminalAuxiliarySyncFailure, summarizeMetaSyncBlocks } from "./syncStatus";

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
  it("não transforma um snapshot parcial auxiliar em falha terminal", () => {
    expect(isTerminalAuxiliarySyncFailure({ status: "partial", success: false, errors: ["leads_retrieval ausente"] })).toBe(false);
    expect(isTerminalAuxiliarySyncFailure({ status: "failed", success: false, error: "Meta indisponível" })).toBe(true);
  });

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

  it("preserves per-account errors from an auxiliary sync response", () => {
    expect(collectSyncWarnings({
      status: "failed",
      accounts: [{ account: "Conta teste", error: "Permissão leads_retrieval ausente" }],
    })).toEqual(["Conta teste: Permissão leads_retrieval ausente"]);
  });
});
