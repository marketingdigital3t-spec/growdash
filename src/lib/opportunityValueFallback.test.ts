import { describe, expect, it } from "vitest";
import { accountOpportunityFallback } from "./opportunityValueFallback";

describe("accountOpportunityFallback", () => {
  it("applies the agreed estimate for each Ranniely account", () => {
    expect(accountOpportunityFallback("Conta CA - Dra. Ranniely Silva")).toBe(5_000);
    expect(accountOpportunityFallback("CA02 - Dra Ranniey Silva")).toBe(7_500);
  });

  it("does not estimate unrelated accounts", () => {
    expect(accountOpportunityFallback("Conta principal")).toBeUndefined();
  });
});
