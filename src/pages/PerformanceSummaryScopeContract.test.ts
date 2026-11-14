import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  fileURLToPath(new URL("./PerformanceSummaryPage.tsx", import.meta.url)),
  "utf8",
);

describe("PerformanceSummaryPage — Contrato de escopo e isolamento por conta", () => {
  it("utiliza useResolvedRDAccountFunnelScope para isolar os funis da conta selecionada", () => {
    expect(pageSource).toContain("useResolvedRDAccountFunnelScope");
    expect(pageSource).not.toContain(": active.map((f) => f.id)");
  });

  it("oferece ação explícita de sincronização do RD Station", () => {
    expect(pageSource).toContain('rd-sync-deals');
    expect(pageSource).toContain("onSyncRD={syncRD}");
  });
});
