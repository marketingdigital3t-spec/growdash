export const META_CAMPAIGN_OPTION_PREFIX = "meta:";
export const RD_CAMPAIGN_OPTION_PREFIX = "rd:";

export type FunnelCampaignSource = "meta" | "rd";

export type FunnelCampaignOption = {
  id: string;
  name: string;
  source: FunnelCampaignSource;
  sourceLabel: string;
  sourceId: string;
};

type MetaCampaignInput = {
  id: string;
  name?: string | null;
};

function normalizedName(name: string | null | undefined, fallback: string) {
  const value = String(name || "").trim();
  return value || fallback;
}

/**
 * Builds the single campaign selector used by Funnel Analysis without
 * conflating a Meta campaign id with an RD UTM value. Both sources can have
 * the same display name, so the encoded option id is intentionally namespaced.
 */
export function buildFunnelCampaignOptions(
  metaCampaigns: MetaCampaignInput[],
  rdCampaignNames: string[],
): FunnelCampaignOption[] {
  const meta = metaCampaigns
    .map((campaign) => {
      const sourceId = String(campaign.id || "").trim();
      if (!sourceId) return null;
      return {
        id: `${META_CAMPAIGN_OPTION_PREFIX}${sourceId}`,
        name: `Meta · ${normalizedName(campaign.name, sourceId)}`,
        source: "meta" as const,
        sourceLabel: "Meta",
        sourceId,
      };
    })
    .filter((option): option is FunnelCampaignOption => Boolean(option));

  const rd = Array.from(new Set(rdCampaignNames.map((name) => String(name || "").trim()).filter(Boolean)))
    .map((sourceId) => ({
      id: `${RD_CAMPAIGN_OPTION_PREFIX}${sourceId}`,
      name: `UTM RD · ${sourceId}`,
      source: "rd" as const,
      sourceLabel: "UTM RD",
      sourceId,
    }));

  return [...meta, ...rd].sort((a, b) => {
    const aName = a.name.replace(/^(Meta|UTM RD) · /, "");
    const bName = b.name.replace(/^(Meta|UTM RD) · /, "");
    return aName.localeCompare(bName, "pt-BR") || a.sourceLabel.localeCompare(b.sourceLabel, "pt-BR");
  });
}

export function splitFunnelCampaignSelection(selectedIds: string[]) {
  const selectedMetaCampaignIds: string[] = [];
  const selectedUtmCampaigns: string[] = [];

  for (const id of selectedIds) {
    if (id.startsWith(META_CAMPAIGN_OPTION_PREFIX)) {
      const campaignId = id.slice(META_CAMPAIGN_OPTION_PREFIX.length).trim();
      if (campaignId) selectedMetaCampaignIds.push(campaignId);
    } else if (id.startsWith(RD_CAMPAIGN_OPTION_PREFIX)) {
      const campaignName = id.slice(RD_CAMPAIGN_OPTION_PREFIX.length).trim();
      if (campaignName) selectedUtmCampaigns.push(campaignName);
    }
  }

  return {
    selectedMetaCampaignIds: Array.from(new Set(selectedMetaCampaignIds)),
    selectedUtmCampaigns: Array.from(new Set(selectedUtmCampaigns)),
  };
}
