import type { Sale } from "@/hooks/useSales";
import type { InsightRow } from "@/hooks/useInsights";
import type { AccountUtmMapping, UtmField, MatchStrategy } from "@/hooks/useAccountUtmMapping";
import { DEFAULT_MAPPING } from "@/hooks/useAccountUtmMapping";
import { isRealizedSale, normalizeAttributionKey } from "@/lib/saleRevenue";

const norm = (s: string | null | undefined) => (s ?? "").toString().trim().toLowerCase();
// More aggressive: strip brackets, parens, punctuation, separators
const normStrip = (s: string | null | undefined) =>
  norm(s).replace(/[\s_\-.,:;|\/\\[\]()]+/g, "");

const tokenize = (s: string | null | undefined): string[] => {
  const n = norm(s);
  if (!n) return [];
  return n.split(/[^a-z0-9á-úãõâêîôûç]+/i).filter((t) => t.length >= 2);
};

const tokenOverlap = (a: string | null | undefined, b: string | null | undefined): number => {
  const ta = tokenize(a), tb = tokenize(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const setB = new Set(tb);
  let hits = 0;
  for (const t of ta) if (setB.has(t)) hits++;
  return hits / Math.min(ta.length, tb.length);
};

/**
 * Match com cascata de tolerância: exact → contains → tokenOverlap >= 0.7.
 * A estratégia configurada é o piso, sempre tentamos níveis mais permissivos.
 */
export const matches = (
  a: string | null | undefined,
  b: string | null | undefined,
  _strategy: MatchStrategy = "normalized",
): boolean => {
  if (!a || !b) return false;
  const na = normStrip(a), nb = normStrip(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  if (tokenOverlap(a, b) >= 0.7) return true;
  return false;
};

export type AttributionLevel = "ad" | "adset" | "campaign" | "manual" | "unmatched";
export type FailureReason =
  | "no_utm_campaign"
  | "campaign_not_found"
  | "account_no_insights"
  | "ok";

export interface SaleAttribution {
  sale: Sale;
  ad_id: string | null;
  adset_id: string | null;
  campaign_id: string | null;
  level: AttributionLevel;
  failure_reason?: FailureReason;
  failure_detail?: string;
}

export interface AttributionResult {
  matched: Map<string, Sale[]>;
  unmatched: Sale[];
  perSale: SaleAttribution[];
  byCampaign: Map<string, { sales: Sale[]; revenue: number }>;
  byAdset: Map<string, { sales: Sale[]; revenue: number }>;
  byAd: Map<string, { sales: Sale[]; revenue: number }>;
}

const readField = (sale: Sale, field: UtmField): string | null => {
  switch (field) {
    case "utm_source": return sale.utm_source;
    case "utm_medium": return sale.utm_medium;
    case "utm_campaign": return sale.utm_campaign;
    case "utm_term": return sale.utm_term;
    case "utm_content": return sale.utm_content;
    case "ad_id": return sale.ad_id;
  }
};

export function attributeSalesToAds(
  sales: Sale[],
  insights: InsightRow[],
  mappingByAccount?: Map<string, AccountUtmMapping>,
): AttributionResult {
  const matched = new Map<string, Sale[]>();
  const unmatched: Sale[] = [];
  const perSale: SaleAttribution[] = [];
  const byCampaign = new Map<string, { sales: Sale[]; revenue: number }>();
  const byAdset = new Map<string, { sales: Sale[]; revenue: number }>();
  const byAd = new Map<string, { sales: Sale[]; revenue: number }>();

  const adsByExactId = new Map<string, InsightRow>();
  for (const r of insights) if (!adsByExactId.has(r.ad_id)) adsByExactId.set(r.ad_id, r);

  const pushAd = (adId: string, sale: Sale) => {
    if (!matched.has(adId)) matched.set(adId, []);
    matched.get(adId)!.push(sale);
  };
  const bump = (m: Map<string, { sales: Sale[]; revenue: number }>, key: string, sale: Sale) => {
    if (!m.has(key)) m.set(key, { sales: [], revenue: 0 });
    const e = m.get(key)!;
    e.sales.push(sale);
    e.revenue += Number(sale.net_revenue) || 0;
  };

  const getMapping = (accountId: string | null | undefined): AccountUtmMapping => {
    if (accountId && mappingByAccount?.has(accountId)) return mappingByAccount.get(accountId)!;
    return { id: "", ad_account_id: accountId ?? "", ...DEFAULT_MAPPING };
  };

  for (const sale of sales) {
    if (!isRealizedSale(sale)) continue;

    // L0: manual override
    const manualOverride = (sale as any).manual_override;
    const manualAd = (sale as any).manual_ad_id as string | null;
    const manualAdset = (sale as any).manual_adset_id as string | null;
    const manualCampaign = (sale as any).manual_campaign_id as string | null;
    if (manualOverride && (manualAd || manualAdset || manualCampaign)) {
      const adRef = manualAd ? adsByExactId.get(manualAd) : null;
      const campaignId = manualCampaign ?? adRef?.campaign_id ?? null;
      if (manualAd) { pushAd(manualAd, sale); bump(byAd, manualAd, sale); }
      if (manualAdset) bump(byAdset, manualAdset, sale);
      if (campaignId) bump(byCampaign, campaignId, sale);
      perSale.push({ sale, ad_id: manualAd, adset_id: manualAdset, campaign_id: campaignId, level: "manual" });
      continue;
    }

    // A atribuição canônica calculada pelo backend é a fonte primária. Ela já
    // foi validada dentro da mesma conta de anúncio e não deve ser refeita por
    // aproximação no navegador.
    if (sale.matched_campaign_id) {
      const campaignRows = insights.filter((row) =>
        row.campaign_id === sale.matched_campaign_id
        && (!sale.ad_account_id || row.ad_account_id === sale.ad_account_id));
      if (campaignRows.length > 0) {
        // The canonical campaign match is authoritative, but enrich it with
        // the ad set/creative only when the sale carries a direct ad id or a
        // matching UTM content. Never guess a creative from the first row.
        const resolvedAd = (sale.ad_id && campaignRows.find((row) => row.ad_id === sale.ad_id))
          ?? (sale.utm_content && campaignRows.find((row) => matches(row.ad_name, sale.utm_content)));
        bump(byCampaign, sale.matched_campaign_id, sale);
        if (resolvedAd) {
          bump(byAd, resolvedAd.ad_id, sale);
          perSale.push({ sale, ad_id: resolvedAd.ad_id, adset_id: resolvedAd.adset_name, campaign_id: sale.matched_campaign_id, level: "ad" });
        } else {
          perSale.push({ sale, ad_id: sale.ad_id ?? null, adset_id: sale.adset_id ?? null, campaign_id: sale.matched_campaign_id, level: "campaign" });
        }
        continue;
      }
    }

    const mapping = getMapping(sale.ad_account_id);

    // L1: ad_id direto
    const adIdGuess = readField(sale, "ad_id") || sale.ad_id;
    if (adIdGuess && adsByExactId.has(adIdGuess)) {
      const ad = adsByExactId.get(adIdGuess)!;
      if (sale.ad_account_id && ad.ad_account_id !== sale.ad_account_id) {
        unmatched.push(sale);
        perSale.push({ sale, ad_id: null, adset_id: null, campaign_id: null, level: "unmatched", failure_reason: "campaign_not_found", failure_detail: "O anúncio informado pertence a outra conta." });
        continue;
      }
      pushAd(ad.ad_id, sale);
      bump(byAd, ad.ad_id, sale);
      if (ad.campaign_id) bump(byCampaign, ad.campaign_id, sale);
      perSale.push({ sale, ad_id: ad.ad_id, adset_id: null, campaign_id: ad.campaign_id ?? null, level: "ad" });
      continue;
    }

    const campVal = readField(sale, mapping.campaign_utm);
    const adsetVal = readField(sale, mapping.adset_utm);
    const creativeVal = readField(sale, mapping.creative_utm);

    // Uma venda vinculada a uma conta nunca pode usar campanhas de outra.
    const sameAccount = sale.ad_account_id
      ? insights.filter((r) => r.ad_account_id === sale.ad_account_id)
      : [];
    const universeAds = sale.ad_account_id ? sameAccount : insights;
    const exact = (left: string | null | undefined, right: string | null | undefined) => {
      const a = normalizeAttributionKey(left);
      const b = normalizeAttributionKey(right);
      return !!a && a === b;
    };

    // L2: trio
    if (campVal && adsetVal && creativeVal) {
      const hit = universeAds.find(
        (r) =>
          exact(r.campaign_name, campVal) &&
          exact(r.adset_name, adsetVal) &&
          exact(r.ad_name, creativeVal),
      );
      if (hit) {
        pushAd(hit.ad_id, sale);
        bump(byAd, hit.ad_id, sale);
        if (hit.campaign_id) bump(byCampaign, hit.campaign_id, sale);
        perSale.push({ sale, ad_id: hit.ad_id, adset_id: hit.adset_name, campaign_id: hit.campaign_id ?? null, level: "ad" });
        continue;
      }
    }

    // L3: par campanha+criativo
    if (campVal && creativeVal) {
      const hit = universeAds.find(
        (r) =>
          exact(r.campaign_name, campVal) &&
          exact(r.ad_name, creativeVal),
      );
      if (hit) {
        pushAd(hit.ad_id, sale);
        bump(byAd, hit.ad_id, sale);
        if (hit.campaign_id) bump(byCampaign, hit.campaign_id, sale);
        perSale.push({ sale, ad_id: hit.ad_id, adset_id: hit.adset_name, campaign_id: hit.campaign_id ?? null, level: "ad" });
        continue;
      }
    }

    // L4: só campanha
    if (campVal) {
      const hit = universeAds.find((r) => exact(r.campaign_name, campVal) || exact(r.campaign_id, campVal));
      if (hit?.campaign_id) {
        bump(byCampaign, hit.campaign_id, sale);
        perSale.push({ sale, ad_id: null, adset_id: null, campaign_id: hit.campaign_id, level: "campaign" });
        continue;
      }
    }

    // Diagnóstico
    let reason: FailureReason = "ok";
    let detail = "";
    if (!campVal) {
      reason = "no_utm_campaign";
      detail = `Venda sem ${mapping.campaign_utm}`;
    } else if (sameAccount.length === 0 && sale.ad_account_id) {
      reason = "account_no_insights";
      detail = `Conta da venda não tem insights no período`;
    } else {
      reason = "campaign_not_found";
      detail = `Campanha "${campVal}" não casou com nenhuma das ${universeAds.length} campanhas do período`;
    }

    unmatched.push(sale);
    perSale.push({ sale, ad_id: null, adset_id: null, campaign_id: null, level: "unmatched", failure_reason: reason, failure_detail: detail });
  }

  return { matched, unmatched, perSale, byCampaign, byAdset, byAd };
}
