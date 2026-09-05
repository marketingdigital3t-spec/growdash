import { describe, expect, it } from "vitest";
import { buildMetaConversationTrackingLink } from "./metaConversationTrackingLink";

describe("buildMetaConversationTrackingLink", () => {
  it("normaliza o telefone e preserva os macros de atribuição na mensagem", () => {
    const link = buildMetaConversationTrackingLink("+55 (61) 99999-0000", "Olá");
    expect(link).toContain("https://wa.me/5561999990000?text=");
    expect(decodeURIComponent(link!.split("text=")[1])).toContain("gd_campaign={{campaign.name}}");
    expect(decodeURIComponent(link!.split("text=")[1])).toContain("gd_ad_id={{ad.id}}");
  });

  it("não cria link sem telefone", () => {
    expect(buildMetaConversationTrackingLink("", "Olá")).toBeNull();
  });
});
