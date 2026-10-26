export type CampaignHierarchyTab = "campaigns" | "adsets" | "ads";
export type CampaignAnalysisPanel = "alerts" | "intelligence" | null;

export type CampaignHierarchyRows = {
  campaigns: any[];
  adsets: any[];
  ads: any[];
};

/** Count the descendants already embedded in the campaign query. */
export function countCampaignHierarchy(campaigns: any[]) {
  const adsetIds = new Set<string>();
  const adIds = new Set<string>();
  for (const campaign of campaigns || []) {
    for (const adset of campaign?.adsets || []) {
      const adsetId = String(adset?.id || "");
      if (adsetId) adsetIds.add(adsetId);
      for (const ad of adset?.ads || []) {
        const adId = String(ad?.id || "");
        if (adId) adIds.add(adId);
      }
    }
  }
  return { adsets: adsetIds.size, ads: adIds.size };
}

/**
 * Intelligence renders campaign descendants even while the main hierarchy tab
 * remains on campaigns. Keep those relation queries enabled for that panel so
 * its ad-set and creative counts reflect the selected account and filters.
 */
export function shouldLoadCampaignHierarchy(tab: CampaignHierarchyTab, analysisPanel: CampaignAnalysisPanel) {
  return tab === "adsets" || tab === "ads" || analysisPanel === "intelligence";
}

/**
 * Rebuilds the PostgREST relations after the rows have been fetched through
 * scoped ID queries. Keeping this relation shape lets the existing tables use
 * the same data regardless of whether PostgREST returned nested relations.
 */
export function hydrateCampaignHierarchy({ campaigns, adsets, ads }: CampaignHierarchyRows) {
  const campaignById = new Map(campaigns.map((campaign) => [String(campaign.id), campaign]));

  const hydratedAdsets = adsets.map((adset) => ({
    ...adset,
    campaigns: campaignById.has(String(adset.campaign_id))
      ? [campaignById.get(String(adset.campaign_id))]
      : [],
  }));
  const hydratedAdsetById = new Map(hydratedAdsets.map((adset) => [String(adset.id), adset]));
  const hydratedAds = ads.map((ad) => {
    const adset = hydratedAdsetById.get(String(ad.adset_id));
    return {
      ...ad,
      adsets: adset ? [adset] : [],
    };
  });

  return { adsets: hydratedAdsets, ads: hydratedAds };
}

export function hierarchyCountLabel(
  label: string,
  count: number,
  state: { isLoading: boolean; isError: boolean; hasSnapshot: boolean },
) {
  if (state.isError && !state.hasSnapshot) return `${label} (indisponível)`;
  if (state.isLoading && !state.hasSnapshot) return `${label} (carregando…)`;
  return `${label} (${count})`;
}
