export function buildCampaignActionCatalog(campaigns: any[]) {
  const adsetIdByAdId: Record<string, string | null> = {};
  const destinationTypeByAdset: Record<string, string | null> = {};
  for (const campaign of campaigns) {
    for (const adset of campaign?.adsets || []) {
      const adsetId = String(adset?.id || "");
      if (!adsetId) continue;
      destinationTypeByAdset[adsetId] = adset?.destination_type || null;
      for (const ad of adset?.ads || []) {
        const adId = String(ad?.id || "");
        if (adId) adsetIdByAdId[adId] = adsetId;
      }
    }
  }
  return { adsetIdByAdId, destinationTypeByAdset };
}
