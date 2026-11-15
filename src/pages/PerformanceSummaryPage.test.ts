import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  fileURLToPath(new URL("./PerformanceSummaryPage.tsx", import.meta.url)),
  "utf8",
);

describe("PerformanceSummaryPage — confiabilidade de escopo", () => {
  it("bloqueia snapshots anteriores durante a troca de conta, funil ou período", () => {
    expect(pageSource).toContain("scopeRefreshing");
    expect(pageSource).toContain("salesQuery.isPlaceholderData");
    expect(pageSource).toContain("rdDealsQuery.isPlaceholderData");
    expect(pageSource).toContain("scopeRefreshing ? []");
  });
});
