import { describe, expect, it } from "vitest";
import { canonicalMetaLeads, CONVERSATION_ACTION_TYPES, FORM_ACTION_TYPES, SITE_ACTION_TYPES } from "../../supabase/functions/_shared/metaLeadMetrics";

describe("canonicalMetaLeads (AI/RAG evidence)", () => {
  it("sums the three lead groups and applies canonical priority to aliases", () => {
    const result = canonicalMetaLeads(
      [{ ad_id: "ad-1", ad_account_id: "account-1", date: "2026-10-02", leads: 999 }],
      [
        { ad_id: "ad-1", date: "2026-10-02", action_type: FORM_ACTION_TYPES[0], value: 5 },
        { ad_id: "ad-1", date: "2026-10-02", action_type: FORM_ACTION_TYPES[1], value: 4 },
        { ad_id: "ad-1", date: "2026-10-02", action_type: SITE_ACTION_TYPES[0], value: 3 },
        { ad_id: "ad-1", date: "2026-10-02", action_type: SITE_ACTION_TYPES[1], value: 2 },
        { ad_id: "ad-1", date: "2026-10-02", action_type: CONVERSATION_ACTION_TYPES[0], value: 2 },
        { ad_id: "ad-1", date: "2026-10-02", action_type: CONVERSATION_ACTION_TYPES[1], value: 4 },
        { ad_id: "ad-1", date: "2026-10-02", action_type: CONVERSATION_ACTION_TYPES[1], value: 4 },
      ],
      {},
    );
    expect(result[0].leads).toBe(10);
    expect(result[0]).toMatchObject({ form_leads: 5, site_leads: 3, conversations: 2 });
  });

  it("uses the configured site event per account and never falls back to insights.leads", () => {
    const result = canonicalMetaLeads(
      [
        { ad_id: "ad-1", ad_account_id: "account-1", date: "2026-10-02", leads: 700 },
        { ad_id: "ad-2", ad_account_id: "account-2", date: "2026-10-02", leads: 800 },
      ],
      [
        { ad_id: "ad-1", date: "2026-10-02", action_type: "custom_site_lead", value: 6 },
        { ad_id: "ad-2", date: "2026-10-02", action_type: SITE_ACTION_TYPES[0], value: 2 },
      ],
      { "account-1": "custom_site_lead" },
    );
    expect(result.map((row) => row.leads)).toEqual([6, 2]);
  });
});
