import { describe, expect, it } from "vitest";
import { buildConversationEligibleMetaAdScopes, buildSiteEligibleMetaAdScopes } from "./metaLeadScope";

describe("buildSiteEligibleMetaAdScopes", () => {
  it("permits configured site-event resolution only for WEBSITE destinations", () => {
    const result = buildSiteEligibleMetaAdScopes([
      { ad_account_id: "account-1", ad_id: "website-ad", adset_id: "website-set" },
      { ad_account_id: "account-1", ad_id: "form-ad", adset_id: "form-set" },
      { ad_account_id: "account-1", ad_id: "unknown-ad", adset_id: "missing-set" },
    ], { "website-set": "WEBSITE", "form-set": "ON_AD" });

    expect(result).toEqual(new Set(["account-1|website-ad"]));
  });
});

describe("buildConversationEligibleMetaAdScopes", () => {
  it("conta conversas somente em destinos de mensagem confirmados", () => {
    const result = buildConversationEligibleMetaAdScopes([
      { ad_account_id: "account-1", ad_id: "whatsapp-ad", adset_id: "whatsapp-set" },
      { ad_account_id: "account-1", ad_id: "form-ad", adset_id: "form-set" },
      { ad_account_id: "account-1", ad_id: "unknown-ad", adset_id: "missing-set" },
    ], {
      "whatsapp-set": "WHATSAPP",
      "form-set": "ON_AD",
    });

    expect(result).toEqual(new Set(["account-1|whatsapp-ad"]));
  });
});
