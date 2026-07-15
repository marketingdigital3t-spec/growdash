import { describe, expect, it } from "vitest";
import { getMetaColumnPreset, metaBreakdownGroups, metaColumnPresets } from "./metaTableConfig";

describe("Meta table configuration", () => {
  it("mantém as dez predefinições de colunas", () => {
    expect(metaColumnPresets).toHaveLength(10);
    expect(getMetaColumnPreset("sales").columns).toContain("roas");
  });

  it("inclui os principais detalhamentos do Meta Ads", () => {
    const ids = metaBreakdownGroups.flatMap((group) => group.items.map((item) => item.id));
    expect(ids).toEqual(expect.arrayContaining(["age", "gender", "placement", "device", "hour_account", "conversion_device"]));
  });
});
