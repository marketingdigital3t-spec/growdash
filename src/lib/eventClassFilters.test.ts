import { describe, expect, it } from "vitest";
import { filterEventClassesByScope } from "@/lib/eventClassFilters";

const scope = { startDate: "2026-10-01", endDate: "2026-10-31" };
const row = (date_start: string, ad_account_id: string | null, expert_name = "Ranniely") => ({ id: `${date_start}-${ad_account_id}`, date_start, ad_account_id, expert_name });

describe("event class global date and account filters", () => {
  it("uses date_start within the global interval", () => {
    const result = filterEventClassesByScope([
      row("2026-09-30", "ranniely"),
      row("2026-10-01", "ranniely"),
      row("2026-10-31", "ranniely"),
      row("2026-11-01", "ranniely"),
    ], scope, []);
    expect(result.map((item) => item.date_start)).toEqual(["2026-10-01", "2026-10-31"]);
  });

  it("shows every account when the account selection is empty", () => {
    const result = filterEventClassesByScope([row("2026-10-02", "ranniely"), row("2026-10-03", "sté"), row("2026-10-04", null)], scope, []);
    expect(result).toHaveLength(3);
  });

  it("limits a selected account and keeps a matching legacy class", () => {
    const result = filterEventClassesByScope([
      row("2026-10-02", "ranniely"),
      row("2026-10-03", "sté"),
      row("2026-10-04", null, "Ranniely"),
      row("2026-10-05", null, "Sté"),
    ], scope, ["ranniely"], "expert-ranniely", "Ranniely");
    expect(result.map((item) => item.ad_account_id)).toEqual(["ranniely", null]);
  });

  it("supports multiple selected accounts", () => {
    const result = filterEventClassesByScope([row("2026-10-02", "ranniely"), row("2026-10-03", "sté"), row("2026-10-04", "jose")], scope, ["ranniely", "sté"]);
    expect(result.map((item) => item.ad_account_id)).toEqual(["ranniely", "sté"]);
  });

  it("does not assign an orphan legacy class when the selected account has no reliable expert", () => {
    const result = filterEventClassesByScope([row("2026-10-02", null, "Outra pessoa")], scope, ["ranniely"]);
    expect(result).toHaveLength(0);
  });
});
