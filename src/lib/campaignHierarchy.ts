export type CampaignHierarchyTab = "campaigns" | "adsets" | "ads";
export type CampaignAnalysisPanel = "alerts" | "intelligence" | null;

/**
 * Intelligence renders campaign descendants even while the main hierarchy tab
 * remains on campaigns. Keep those relation queries enabled for that panel so
 * its ad-set and creative counts reflect the selected account and filters.
 */
export function shouldLoadCampaignHierarchy(tab: CampaignHierarchyTab, analysisPanel: CampaignAnalysisPanel) {
  return tab === "adsets" || tab === "ads" || analysisPanel === "intelligence";
}
