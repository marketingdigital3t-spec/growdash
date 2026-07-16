import { normalizeStatus } from "@/components/dashboard/ResizableTableHelpers";

export type CampaignHealth = "critical" | "warning" | "observation" | "initial" | "healthy" | "inactive";

export function getCampaignActiveDays(createdAt?: string | null) {
  if (!createdAt) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 86_400_000);
}

export function getCampaignHealth(campaign: any, averageCpl: number, targetCpl?: number | null): CampaignHealth {
  if (normalizeStatus(campaign.status) !== "ACTIVE") return "inactive";
  const activeDays = getCampaignActiveDays(campaign.created_at);
  if (activeDays < 3) return "initial";
  if (campaign.spend <= 0 || campaign.impressions <= 0) return "inactive";

  const referenceCpl = Number(targetCpl || 0) > 0 ? Number(targetCpl) : averageCpl;
  const ratio = referenceCpl > 0 && campaign.leads > 0 ? campaign.cpl / referenceCpl : 0;
  const hasRevenueSignal = campaign.salesCount > 0 || campaign.revenue > 0;

  if ((campaign.leads <= 0 && activeDays >= 3) || ratio > 2 || (hasRevenueSignal && campaign.roas < 0.5)) return "critical";
  if (ratio >= 1.5 || (hasRevenueSignal && campaign.roas < 1)) return "warning";
  if (ratio >= 1 || campaign.frequency >= 3 || campaign.conversionRate < 3) return "observation";
  return "healthy";
}
