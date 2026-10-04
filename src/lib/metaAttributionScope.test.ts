import { describe, expect, it } from "vitest";
import { buildAttributionWindowsByAccount } from "./metaAttributionScope";

describe("buildAttributionWindowsByAccount", () => {
  it("preserves each selected account's configured window without leaking unselected accounts", () => {
    const accounts = [
      { id: "uuid-ranniely", attribution_window: "7d_click,1d_view" },
      { id: "uuid-jose", attribution_window: "1d_click" },
      { id: "uuid-stale", attribution_window: "7d_click" },
    ];

    expect(buildAttributionWindowsByAccount(accounts, ["uuid-ranniely", "uuid-jose"])).toEqual({
      "uuid-ranniely": "7d_click,1d_view",
      "uuid-jose": "1d_click",
    });
  });

  it("uses account_default when an account has no explicit attribution window", () => {
    expect(buildAttributionWindowsByAccount([{ id: "uuid-meta", attribution_window: null }], ["uuid-meta"])).toEqual({
      "uuid-meta": "account_default",
    });
  });
});
