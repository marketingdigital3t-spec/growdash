import { describe, expect, it } from "vitest";
import { rdField, resolveRDPeriodDeals } from "./FunnelAudienceProfile";

describe("RD audience fields", () => {
  it("reads source-prefixed custom fields preserved by the sync", () => {
    expect(rdField({ custom_fields: { contact_idade: "34", deal_sexo: "Feminino" } }, ["idade", "age"])).toBe("34");
    expect(rdField({ custom_fields: { deal_sexo: "Feminino" } }, ["sexo", "genero", "gender"])).toBe("Feminino");
  });

  it("does not treat a similarly named field as the requested attribute", () => {
    expect(rdField({ custom_fields: { contato_idade_do_filho: "8" } }, ["idade"])).toBeNull();
  });
});

describe("RD period scope", () => {
  it("keeps an explicitly empty selected period empty instead of showing all history", () => {
    const historicalDeals = [{ lead_created_at: "2026-10-03T12:00:00Z" }];
    expect(resolveRDPeriodDeals([], historicalDeals)).toEqual([]);
  });

  it("uses all supplied deals only when no period scope was provided", () => {
    const historicalDeals = [{ lead_created_at: "2026-10-03T12:00:00Z" }];
    expect(resolveRDPeriodDeals(undefined, historicalDeals)).toBe(historicalDeals);
  });
});
