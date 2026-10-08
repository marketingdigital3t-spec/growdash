import { describe, expect, it } from "vitest";
import { buildExpertAccountScope, filterEventClassesByInventory, filterEventClassesByScope, normalizeEventClassDate } from "@/lib/eventClassFilters";

const scope = { startDate: "2026-10-01", endDate: "2026-10-31" };
const row = (date_start: string, ad_account_id: string | null, expert_name = "Ranniely", expert_id?: string) => ({ id: `${date_start}-${ad_account_id}-${expert_name}`, date_start, ad_account_id, expert_name, expert_id });
const accountScope = buildExpertAccountScope(
  [
    { expert_id: "expert-ranniely", ad_account_id: "ca01" },
    { expert_id: "expert-ranniely", ad_account_id: "ca02" },
    { expert_id: "expert-ste", ad_account_id: "ste01" },
  ],
  [{ id: "expert-ranniely", nome: "Ranníely Silva" }, { id: "expert-ste", nome: "Sté Andrade" }],
);

describe("event class global date and account filters", () => {
  it("normalizes a date column or ISO timestamp to its São Paulo calendar day", () => {
    expect(normalizeEventClassDate("2026-11-15")).toBe("2026-11-15");
    expect(normalizeEventClassDate("2026-11-15T00:00:00Z")).toBe("2026-11-15");
    expect(normalizeEventClassDate("2026-02-30")).toBeNull();
  });

  it("keeps the selected year when filtering November 2026", () => {
    const november = { startDate: "2026-11-01", endDate: "2026-11-30" };
    const result = filterEventClassesByScope([
      row("2023-11-15", "ca01"),
      row("2026-10-31", "ca01"),
      row("2026-11-01T00:00:00Z", "ca01"),
      row("2026-11-30", "ca01"),
      row("2026-12-01", "ca01"),
    ], november, []);
    expect(result.map((item) => item.date_start)).toEqual(["2026-11-01T00:00:00Z", "2026-11-30"]);
  });

  it("uses date_start within the global interval", () => {
    const result = filterEventClassesByScope([row("2026-09-30", "ca01"), row("2026-10-01", "ca01"), row("2026-10-31", "ca01"), row("2026-11-01", "ca01")], scope, []);
    expect(result.map((item) => item.date_start)).toEqual(["2026-10-01", "2026-10-31"]);
  });

  it("includes a future class when the maximum inventory scope is used", () => {
    const maximumScope = { startDate: "2026-10-01", endDate: "9999-12-31" };
    expect(filterEventClassesByScope([row("2026-11-15", "ca02")], maximumScope, ["ca02"])).toHaveLength(1);
  });

  it("shows every account when the account selection is empty", () => {
    expect(filterEventClassesByScope([row("2026-10-02", "ca01"), row("2026-10-03", "ste01"), row("2026-10-04", null)], scope, [])).toHaveLength(3);
  });

  it("shows a legacy Ranniely class when both of her accounts are selected", () => {
    const result = filterEventClassesByScope([row("2026-10-04", null, "Dra. RANNÍELY Silva")], scope, ["ca01", "ca02"], undefined, undefined, accountScope);
    expect(result).toHaveLength(1);
  });

  it("shows a legacy Ranniely class when either of her accounts is selected", () => {
    expect(filterEventClassesByScope([row("2026-10-04", null, "Ranniely Silva")], scope, ["ca01"], undefined, undefined, accountScope)).toHaveLength(1);
    expect(filterEventClassesByScope([row("2026-10-04", null, "Ranniely Silva")], scope, ["ca02"], undefined, undefined, accountScope)).toHaveLength(1);
  });

  it("does not show another expert in the Ranniely account filter", () => {
    expect(filterEventClassesByScope([row("2026-10-04", null, "Sté Andrade")], scope, ["ca01", "ca02"], undefined, undefined, accountScope)).toHaveLength(0);
  });

  it("respects a direct account link", () => {
    expect(filterEventClassesByScope([row("2026-10-04", "ste01", "Sté Andrade")], scope, ["ca01", "ca02"], undefined, undefined, accountScope)).toHaveLength(0);
  });

  it("shows a class linked to multiple accounts when any linked account is selected", () => {
    const multi = { ...row("2026-10-04", "ca01", "Ranniely"), ad_account_ids: ["ca01", "ca02"] };
    expect(filterEventClassesByScope([multi], scope, ["ca02"], undefined, undefined, accountScope)).toHaveLength(1);
  });

  it("does not assign an orphan legacy class without a reliable expert", () => {
    expect(filterEventClassesByScope([row("2026-10-02", null, "Outra pessoa")], scope, ["ca01"], undefined, undefined, accountScope)).toHaveLength(0);
  });
});

describe("complete event class inventory", () => {
  it("does not change when the calendar month changes", () => {
    const classes = [row("2023-11-15", "ca01"), row("2026-11-15", "ca01"), row("2027-05-01", "ca01")];
    expect(filterEventClassesByInventory(classes, ["ca01"]).map((item) => item.date_start)).toEqual(classes.map((item) => item.date_start));
  });

  it("keeps past, future and archived classes in the complete inventory", () => {
    const classes = [
      { ...row("2023-11-15", "ca01"), archived_at: "2026-01-01T00:00:00Z" },
      row("2026-11-15", "ca01"),
      row("2027-05-01", "ca01"),
    ];
    expect(filterEventClassesByInventory(classes, ["ca01"])).toHaveLength(3);
  });

  it("consolidates multiple selected accounts and keeps legacy expert fallback", () => {
    const classes = [
      row("2026-11-15", "ca01"),
      row("2026-12-15", "ca02"),
      row("2027-01-15", null, "Dra. RANNÍELY Silva"),
      row("2027-02-15", null, "Sté Andrade"),
    ];
    expect(filterEventClassesByInventory(classes, ["ca01", "ca02"], undefined, undefined, accountScope)).toHaveLength(3);
    expect(filterEventClassesByInventory(classes, ["ste01"], undefined, undefined, accountScope)).toHaveLength(1);
  });
});
