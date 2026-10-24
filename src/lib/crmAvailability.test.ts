import { describe, expect, it } from "vitest";
import { crmBoardSummaryLabel } from "./crmAvailability";

describe("crmBoardSummaryLabel", () => {
  it("does not expose a zero count while the first CRM snapshot is loading", () => {
    expect(crmBoardSummaryLabel("loading", 0)).toBe("Carregando negociações…");
  });

  it("keeps a real count available for a fresh snapshot", () => {
    expect(crmBoardSummaryLabel("fresh", 3)).toBe("3 negociação(ões) no quadro");
  });

  it("does not turn an unavailable query into a zero count", () => {
    expect(crmBoardSummaryLabel("unavailable", 0)).toBe("Negociações indisponíveis");
  });
});
