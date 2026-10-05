import { describe, expect, it } from "vitest";
import { canonicalMetaLeadValue, canonicalMetaLeads, CONVERSATION_ACTION_TYPES, FORM_ACTION_TYPES, SITE_ACTION_TYPES } from "../../supabase/functions/_shared/metaLeadMetrics";

describe("canonicalMetaLeads (AI/RAG evidence)", () => {
  it("keeps the RAG lead aggregate numeric when a scoped fact is absent or invalid", () => {
    expect(canonicalMetaLeadValue({ leads: 7 })).toBe(7);
    expect(canonicalMetaLeadValue({ leads: 0 })).toBe(0);
    expect(canonicalMetaLeadValue({ leads: null })).toBe(0);
    expect(canonicalMetaLeadValue(undefined)).toBe(0);
    expect(canonicalMetaLeadValue({ leads: Number.NaN })).toBe(0);
  });

  it("requires explicit site-event configuration and applies canonical priority to aliases", () => {
    const result = canonicalMetaLeads(
      [{ ad_id: "ad-1", ad_account_id: "account-1", date: "2026-10-02", leads: 999 }],
      [
        { ad_account_id: "account-1", ad_id: "ad-1", date: "2026-10-02", action_type: FORM_ACTION_TYPES[0], value: 5 },
        { ad_account_id: "account-1", ad_id: "ad-1", date: "2026-10-02", action_type: FORM_ACTION_TYPES[1], value: 4 },
        { ad_account_id: "account-1", ad_id: "ad-1", date: "2026-10-02", action_type: SITE_ACTION_TYPES[0], value: 3 },
        { ad_account_id: "account-1", ad_id: "ad-1", date: "2026-10-02", action_type: SITE_ACTION_TYPES[1], value: 2 },
        { ad_account_id: "account-1", ad_id: "ad-1", date: "2026-10-02", action_type: CONVERSATION_ACTION_TYPES[0], value: 2 },
        { ad_account_id: "account-1", ad_id: "ad-1", date: "2026-10-02", action_type: CONVERSATION_ACTION_TYPES[1], value: 4 },
        { ad_account_id: "account-1", ad_id: "ad-1", date: "2026-10-02", action_type: CONVERSATION_ACTION_TYPES[1], value: 4 },
      ],
      {},
    );
    expect(result[0].leads).toBe(7);
    expect(result[0]).toMatchObject({ form_leads: 5, site_leads: 0, conversations: 2 });
  });

  it("uses the configured site event per account and never falls back to insights.leads", () => {
    const result = canonicalMetaLeads(
      [
        { ad_id: "ad-1", ad_account_id: "account-1", date: "2026-10-02", leads: 700 },
        { ad_id: "ad-2", ad_account_id: "account-2", date: "2026-10-02", leads: 800 },
      ],
      [
        { ad_account_id: "account-1", ad_id: "ad-1", date: "2026-10-02", action_type: "custom_site_lead", value: 6 },
        { ad_account_id: "account-2", ad_id: "ad-2", date: "2026-10-02", action_type: SITE_ACTION_TYPES[0], value: 2 },
      ],
      { "account-1": "custom_site_lead" },
    );
    expect(result.map((row) => row.leads)).toEqual([6, 0]);
  });

  it("keeps action facts isolated by internal account UUID when Meta ad IDs are repeated", () => {
    const result = canonicalMetaLeads(
      [
        { ad_id: "ad-duplicate", ad_account_id: "account-1", date: "2026-10-02", leads: null },
        { ad_id: "ad-duplicate", ad_account_id: "account-2", date: "2026-10-02", leads: null },
      ],
      [
        { ad_account_id: "account-1", ad_id: "ad-duplicate", date: "2026-10-02", action_type: FORM_ACTION_TYPES[0], value: 3 },
        { ad_account_id: "account-2", ad_id: "ad-duplicate", date: "2026-10-02", action_type: FORM_ACTION_TYPES[0], value: 8 },
      ],
      {},
    );

    expect(result.map((row) => row.form_leads)).toEqual([3, 8]);
  });

  it("ignores legacy action rows without an internal account UUID", () => {
    const result = canonicalMetaLeads(
      [{ ad_id: "ad-1", ad_account_id: "account-1", date: "2026-10-02", leads: null }],
      [{ ad_id: "ad-1", date: "2026-10-02", action_type: FORM_ACTION_TYPES[0], value: 15 } as any],
      {},
    );
    expect(result[0]).toMatchObject({ form_leads: 0, site_leads: 0, conversations: 0, leads: 0 });
  });
});
