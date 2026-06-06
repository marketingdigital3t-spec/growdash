import type { Sale } from "@/hooks/useSales";
import type { PlatformRule } from "@/hooks/usePlatformRules";

export type TopPlatform = "meta" | "google" | "organic" | "unknown";

export interface PlatformResult {
  platform: TopPlatform;
  subOrigin?: string; // for organic
}

export interface PlatformInferenceInput {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  rd_campaign_name?: string | null;
  manual_platform?: string | null;
}

function toInput(sale: Sale | PlatformInferenceInput): PlatformInferenceInput {
  const s = sale as any;
  return {
    utm_source: s.utm_source ?? null,
    utm_medium: s.utm_medium ?? null,
    utm_campaign: s.utm_campaign ?? null,
    utm_content: s.utm_content ?? null,
    utm_term: s.utm_term ?? null,
    rd_campaign_name: s.rd_campaign_name ?? null,
    manual_platform: s.manual_platform ?? null,
  };
}

function getField(input: PlatformInferenceInput, field: string): string {
  switch (field) {
    case "utm_source": return (input.utm_source ?? "").toString();
    case "utm_medium": return (input.utm_medium ?? "").toString();
    case "utm_campaign": return (input.utm_campaign ?? "").toString();
    case "utm_content": return (input.utm_content ?? "").toString();
    case "utm_term": return (input.utm_term ?? "").toString();
    case "rd_source": return (input.rd_campaign_name ?? "").toString();
    case "rd_campaign": return (input.rd_campaign_name ?? "").toString();
    default: return "";
  }
}

function ruleMatches(input: PlatformInferenceInput, rule: PlatformRule): boolean {
  if (!rule.is_active) return false;
  const value = getField(input, rule.match_field).toLowerCase().trim();
  const pat = rule.pattern.toLowerCase().trim();
  if (!value || !pat) return false;
  switch (rule.match_mode) {
    case "equals": return value === pat;
    case "contains": return value.includes(pat);
    case "regex":
      try { return new RegExp(rule.pattern, "i").test(value); }
      catch { return false; }
  }
}

export function inferPlatform(sale: Sale | PlatformInferenceInput, rules: PlatformRule[]): PlatformResult {
  const input = toInput(sale);

  const manual = input.manual_platform;
  if (manual) {
    if (manual === "meta" || manual === "google") return { platform: manual };
    if (manual.startsWith("organic")) {
      const sub = manual.includes(":") ? manual.split(":")[1] : "outros";
      return { platform: "organic", subOrigin: sub || "outros" };
    }
  }

  const mainRules = rules.filter((r) => r.is_fallback !== true);
  const fallbackRules = rules.filter((r) => r.is_fallback === true);

  const top = mainRules
    .filter((r) => !r.parent_platform && (r.platform === "meta" || r.platform === "google"))
    .sort((a, b) => a.priority - b.priority);

  for (const r of top) {
    if (ruleMatches(input, r)) {
      return { platform: r.platform as TopPlatform };
    }
  }

  const subRules = mainRules
    .filter((r) => r.parent_platform === "organic")
    .sort((a, b) => a.priority - b.priority);

  for (const r of subRules) {
    if (ruleMatches(input, r)) {
      return { platform: "organic", subOrigin: r.platform };
    }
  }

  const fallbackTop = fallbackRules
    .filter((r) => !r.parent_platform && (r.platform === "meta" || r.platform === "google" || r.platform === "organic"))
    .sort((a, b) => a.priority - b.priority);
  for (const r of fallbackTop) {
    if (ruleMatches(input, r)) {
      if (r.platform === "organic") return { platform: "organic", subOrigin: "outros" };
      return { platform: r.platform as TopPlatform };
    }
  }

  return { platform: "unknown" };
}

export const PLATFORM_LABELS: Record<TopPlatform, string> = {
  meta: "Meta",
  google: "Google",
  organic: "Orgânico",
  unknown: "Não encontrado",
};

export const SUB_ORIGIN_LABELS: Record<string, string> = {
  link_bio: "Link da Bio",
  stories: "Stories",
  dm: "Direct / DM",
  comentario: "Comentário",
  outros: "Outros",
};

export function subOriginLabel(key: string): string {
  return SUB_ORIGIN_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
