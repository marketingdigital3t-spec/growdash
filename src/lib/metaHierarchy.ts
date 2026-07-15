export type MetaCampaignNode = {
  id: string;
  adsets?: Array<{ id: string; ads?: Array<{ id: string }> }>;
};

/**
 * Mirrors Ads Manager hierarchy navigation: no selected campaign means the
 * whole account is in scope; selected campaigns narrow only descendant tabs.
 */
export function scopeCampaignHierarchy<T extends MetaCampaignNode>(campaigns: T[], selectedIds: ReadonlySet<string>): T[] {
  if (selectedIds.size === 0) return campaigns;
  return campaigns.filter((campaign) => selectedIds.has(campaign.id));
}

export function pruneCampaignSelection(selectedIds: ReadonlySet<string>, campaigns: MetaCampaignNode[]): Set<string> {
  const available = new Set(campaigns.map((campaign) => campaign.id));
  return new Set(Array.from(selectedIds).filter((id) => available.has(id)));
}

export function hierarchyCounts(campaigns: MetaCampaignNode[]) {
  let adsets = 0;
  let ads = 0;
  for (const campaign of campaigns) {
    adsets += campaign.adsets?.length ?? 0;
    for (const adset of campaign.adsets ?? []) ads += adset.ads?.length ?? 0;
  }
  return { campaigns: campaigns.length, adsets, ads };
}
