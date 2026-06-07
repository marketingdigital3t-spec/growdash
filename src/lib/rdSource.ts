import type { RDDealLite } from "@/hooks/useRDDealsForPeriod";

export type RDSourceKey = "meta" | "google" | "link_bio" | "organic" | "direct" | "unknown";

export const RD_SOURCE_LABELS: Record<RDSourceKey, string> = {
  meta: "Meta Ads",
  google: "Google Ads",
  link_bio: "Link da bio",
  organic: "Orgânico",
  direct: "Direct",
  unknown: "Não informado",
};

export const RD_SOURCE_COLORS: Record<RDSourceKey, string> = {
  meta: "hsl(221, 83%, 56%)",
  google: "hsl(38, 92%, 52%)",
  link_bio: "hsl(265, 89%, 68%)",
  organic: "hsl(142, 71%, 45%)",
  direct: "hsl(190, 90%, 55%)",
  unknown: "hsl(var(--muted-foreground))",
};

export interface RDSourceInput {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  rd_campaign_name?: string | null;
  first_touch_utm_campaign?: string | null;
  last_touch_utm_campaign?: string | null;
}

export function normalizeSourceText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function classifyRDSourceKey(input: RDSourceInput | RDDealLite): RDSourceKey {
  const raw = [
    input.utm_source,
    input.utm_medium,
    input.utm_campaign,
    input.utm_content,
    input.utm_term,
    input.rd_campaign_name,
    input.first_touch_utm_campaign,
    input.last_touch_utm_campaign,
  ]
    .map(normalizeSourceText)
    .filter(Boolean)
    .join(" ");

  if (!raw) return "unknown";
  if (/\b(meta|facebook|fb|instagram|ig|forms meta|lead ads|trafego pago|cpc|paid|ads)\b/.test(raw)) return "meta";
  if (/\b(google|gads|adwords|youtube|performance max|pmax|search)\b/.test(raw)) return "google";
  // Link da bio e Direct/DM são agrupados como Orgânico
  if (/\b(link da bio|linkbio|bio|perfil|instituto)\b/.test(raw)) return "organic";
  if (/\b(direct|direto|dm|whatsapp|wpp|mensagem|stories|storys)\b/.test(raw)) return "organic";
  if (/\b(organico|organic|indicacao|indicacao|referral|site)\b/.test(raw)) return "organic";
  return "unknown";
}

export function classifyRDSourceLabel(input: RDSourceInput | RDDealLite) {
  return RD_SOURCE_LABELS[classifyRDSourceKey(input)];
}
