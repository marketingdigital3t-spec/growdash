import { describe, expect, it } from "vitest";
import { resolveCampaignPrimaryResult, resolveCampaignResults } from "./campaignResultEvents";

describe("resolveCampaignResults", () => {
  it("mantém leads Meta e conversas iniciadas separados", () => {
    expect(resolveCampaignResults(12, {
      link_click: 900,
      "onsite_conversion.messaging_conversation_started_7d": 4,
    })).toEqual({
      total: 12,
      leadCount: 12,
      conversations: 4,
      breakdown: [
        { label: "Leads Meta", value: 12 },
        { label: "Conversas iniciadas", value: 4 },
      ],
    });
  });

  it("usa o evento de lead quando o insight ainda não trouxe o total", () => {
    expect(resolveCampaignResults(0, { lead: 3, landing_page_view: 100 })).toMatchObject({
      total: 3,
      leadCount: 3,
      conversations: 0,
    });
  });

  it("não duplica aliases da mesma conversa iniciada", () => {
    expect(resolveCampaignResults(0, {
      "onsite_conversion.messaging_conversation_started_7d": 8,
      "onsite_conversion.messaging_conversation_started_28d": 8,
      "onsite_conversion.messaging_first_reply": 8,
    })).toMatchObject({ total: 0, leadCount: 0, conversations: 8 });
  });

  it("mostra apenas leads para campanha de geração de leads", () => {
    const results = resolveCampaignResults(12, { "onsite_conversion.messaging_conversation_started_7d": 4 });
    expect(resolveCampaignPrimaryResult("OUTCOME_LEADS", results)).toEqual({ label: "Leads", value: 12 });
  });

  it("mostra apenas conversas iniciadas para campanha que não é de leads", () => {
    const results = resolveCampaignResults(12, { "onsite_conversion.messaging_conversation_started_7d": 4 });
    expect(resolveCampaignPrimaryResult("OUTCOME_ENGAGEMENT", results)).toEqual({ label: "Conversas iniciadas", value: 4 });
  });
});
