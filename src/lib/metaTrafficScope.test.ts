import { describe, expect, it } from "vitest";
import { buildMetaTrafficScope } from "../../supabase/functions/_shared/metaTrafficScope";

describe("Meta traffic MCP scope", () => {
  it("builds scope metadata from authorized accounts without leaking query-loop state", () => {
    expect(buildMetaTrafficScope(
      [
        { id: "account-1", attribution_window: null, timezone_name: null },
        { id: "account-2", attribution_window: "7d_click", timezone_name: "America/Fortaleza" },
      ],
      ["account-1", "account-2"],
      ["campaign-1"],
      "2026-10-28",
      "2026-10-28",
    )).toEqual({
      account_ids: ["account-1", "account-2"],
      campaign_ids: ["campaign-1"],
      start_date: "2026-10-28",
      end_date: "2026-10-28",
      attribution_window_by_account: {
        "account-1": "account_default",
        "account-2": "7d_click",
      },
      timezone_by_account: {
        "account-1": "America/Sao_Paulo",
        "account-2": "America/Fortaleza",
      },
    });
  });
});
