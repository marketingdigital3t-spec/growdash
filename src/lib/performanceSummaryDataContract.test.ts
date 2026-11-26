import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  closeLiveInvalidationWindow,
  createLiveInvalidationGate,
  deferLiveInvalidation,
  shouldApplyLiveInvalidationNow,
} from "./nearRealtimeSyncPolicy";

const pageSource = readFileSync(
  fileURLToPath(new URL("../pages/PerformanceSummaryPage.tsx", import.meta.url)),
  "utf8",
);

describe("Resumo de Performance — integridade dos dados do RD", () => {
  it("resolve o nome da etapa pela chave composta do funil", () => {
    expect(pageSource).toContain("stageNameByFunnelAndId");
    expect(pageSource).toContain("`${stage.rd_funnel_id}:${stage.rd_stage_id}`");
    expect(pageSource).toContain("stageNameByFunnelAndId.get(`${deal.rd_funnel_id}:${deal.rd_stage_id}`)");
  });

  it("não reexibe o snapshot anterior enquanto o escopo é recarregado", () => {
    expect(pageSource).toContain("scopeRefreshing");
    expect(pageSource).toContain("scopeRefreshing ? []");
  });
});

describe("Gate de invalidação por Realtime", () => {
  it("aplica a invalidação imediatamente quando nenhum sync está em andamento", () => {
    const gate = createLiveInvalidationGate();
    expect(shouldApplyLiveInvalidationNow(gate)).toBe(true);
  });

  it("adia a invalidação enquanto o sync está em andamento", () => {
    const gate = createLiveInvalidationGate();
    gate.syncInFlight = true;
    expect(shouldApplyLiveInvalidationNow(gate)).toBe(false);
    deferLiveInvalidation(gate);
    expect(gate.pending).toBe(true);
  });

  it("aplica a invalidação pendente uma única vez ao fechar a janela do sync", () => {
    const gate = createLiveInvalidationGate();
    gate.syncInFlight = true;
    deferLiveInvalidation(gate);
    expect(closeLiveInvalidationWindow(gate)).toBe(true);
    expect(gate.pending).toBe(false);
    expect(closeLiveInvalidationWindow(gate)).toBe(false);
    expect(shouldApplyLiveInvalidationNow(gate)).toBe(true);
  });
});
