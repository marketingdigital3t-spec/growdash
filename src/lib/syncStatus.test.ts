import { describe, expect, it } from "vitest";
import { summarizeMetaSyncBlocks } from "./syncStatus";

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
