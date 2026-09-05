export const META_UTM_TEMPLATE = "utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}&utm_id={{ad.id}}";

const ATTRIBUTION_MARKER = [
  "gd_source=meta",
  "gd_campaign={{campaign.name}}",
  "gd_campaign_id={{campaign.id}}",
  "gd_adset={{adset.name}}",
  "gd_adset_id={{adset.id}}",
  "gd_ad={{ad.name}}",
  "gd_ad_id={{ad.id}}",
].join(" | ");

/**
 * Creates a WhatsApp click-to-chat URL whose prefilled message carries the
 * Meta dynamic macros. The CRM/automation can persist this marker alongside
 * the contact, while Meta remains the source of truth for initiated-chat
 * events. The phone is deliberately normalized to digits only.
 */
export function buildMetaConversationTrackingLink(phone: string, greeting: string) {
  const normalizedPhone = phone.replace(/\D/g, "");
  if (!normalizedPhone) return null;
  const message = [greeting.trim() || "Olá! Quero mais informações.", "", `[Growdash] ${ATTRIBUTION_MARKER}`].join("\n");
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

export function buildMetaConversationTrackingPreview(greeting: string) {
  return [greeting.trim() || "Olá! Quero mais informações.", "", `[Growdash] ${ATTRIBUTION_MARKER}`].join("\n");
}
