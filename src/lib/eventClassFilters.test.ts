import { describe, expect, it } from "vitest";
import { buildExpertAccountScope, filterEventClassesByScope } from "@/lib/eventClassFilters";

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
  it("uses date_start within the global interval", () => {
    const result = filterEventClassesByScope([row("2026-09-30", "ca01"), row("2026-10-01", "ca01"), row("2026-10-31", "ca01"), row("2026-11-01", "ca01")], scope, []);
    expect(result.map((item) => item.date_start)).toEqual(["2026-10-01", "2026-10-31"]);
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

  it("does not assign an orphan legacy class without a reliable expert", () => {
    expect(filterEventClassesByScope([row("2026-10-02", null, "Outra pessoa")], scope, ["ca01"], undefined, undefined, accountScope)).toHaveLength(0);
  });
});
