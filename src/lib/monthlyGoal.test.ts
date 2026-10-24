import { describe, expect, it } from "vitest";
import { resolveEffectiveSalesGoals, shouldPersistSalesGoal } from "@/lib/monthlyGoal";

const goal = (account: string, month: string, target: number) => ({
  ad_account_id: account,
  goal_month: `${month}-01`,
  target_revenue: target,
});

describe("resolveEffectiveSalesGoals", () => {
  it("herda outubro para novembro sem alterar o registro original", () => {
    const october = goal("account-a", "2026-10", 10_000);
    const result = resolveEffectiveSalesGoals([october], "2026-11-01");
    expect(result).toEqual([{ ...october, source_goal_month: "2026-10-01", is_inherited: true }]);
    expect(october.goal_month).toBe("2026-10-01");
  });

  it("usa o override de novembro somente para novembro", () => {
    const records = [goal("account-a", "2026-10", 10_000), goal("account-a", "2026-11", 12_000)];
    expect(resolveEffectiveSalesGoals(records, "2026-11-01")[0]).toMatchObject({ target_revenue: 12_000, is_inherited: false });
    expect(resolveEffectiveSalesGoals(records, "2026-12-01")[0]).toMatchObject({ target_revenue: 12_000, source_goal_month: "2026-11-01", is_inherited: true });
  });

  it("mantém as contas isoladas, muda de ano corretamente e não inventa meta", () => {
    const records = [goal("account-a", "2025-12", 5_000), goal("account-b", "2026-02", 7_000), goal("account-a", "2027-01", 9_000)];
    expect(resolveEffectiveSalesGoals(records, "2026-01-01")).toEqual([{ ...records[0], source_goal_month: "2025-12-01", is_inherited: true }]);
    expect(resolveEffectiveSalesGoals([], "2026-11-01")).toEqual([]);
    expect(resolveEffectiveSalesGoals(records, "2027-02-01").map((item) => [item.ad_account_id, item.target_revenue])).toEqual([["account-a", 9_000], ["account-b", 7_000]]);
  });
});

describe("shouldPersistSalesGoal", () => {
  it("não cria override quando a meta herdada não mudou", () => {
    expect(shouldPersistSalesGoal({ draftTarget: 10_000, currentTarget: 10_000, isInherited: true })).toBe(false);
  });

  it("cria override quando a meta herdada foi alterada", () => {
    expect(shouldPersistSalesGoal({ draftTarget: 12_000, currentTarget: 10_000, isInherited: true })).toBe(true);
  });

  it("mantém uma meta explícita mesmo sem alteração", () => {
    expect(shouldPersistSalesGoal({ draftTarget: 10_000, currentTarget: 10_000, isInherited: false })).toBe(true);
  });
});
