import { describe, expect, it } from "vitest";
import { connectedRDFunnelIds } from "./crmFunnelScope";

describe("connected RD funnel scope", () => {
  it("keeps only active rows that are actually linked to an RD funnel", () => {
    expect(Array.from(connectedRDFunnelIds([
      { id: "connected", rd_funnel_id: "rd-1", is_active: true },
      { id: "inactive", rd_funnel_id: "rd-2", is_active: false },
      { id: "draft", rd_funnel_id: null, is_active: true },
    ]))).toEqual(["connected"]);
  });
});
