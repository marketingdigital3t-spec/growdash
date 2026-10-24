import { describe, expect, it } from "vitest";
import { extractMetaMessagingAttribution } from "../../supabase/functions/_shared/metaMessagingAttribution";

describe("extractMetaMessagingAttribution", () => {
  it("extracts click-to-message ad referral facts without inventing placement", () => {
    const result = extractMetaMessagingAttribution({
      sender: { id: "psid-1" },
      message: {
        mid: "mid-1",
        referral: {
          source: "ADS",
          type: "OPEN_THREAD",
          ad_id: "ad-1",
          ads_context_data: { ad_title: "Criativo 1", campaign_id: "camp-1", adset_id: "set-1" },
        },
      },
    }, "page");

    expect(result).toMatchObject({
      ad_id: "ad-1",
      campaign_id: "camp-1",
      adset_id: "set-1",
      ad_name: "Criativo 1",
      platform: "messenger",
      placement: null,
      is_organic: false,
    });
  });

  it("does not classify a message without referral as paid", () => {
    expect(extractMetaMessagingAttribution({ message: { text: "oi" } }, "whatsapp")).toMatchObject({
      ad_id: null,
      platform: "whatsapp",
      placement: null,
      is_organic: null,
      referral: null,
    });
  });
});
