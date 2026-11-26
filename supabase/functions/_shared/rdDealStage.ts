/**
 * RD Station has returned the current deal stage in more than one shape over
 * the lifetime of the CRM API. Keep the extraction in one place so every
 * status segment and persistence path uses the same provider contract.
 */
export function rdDealStageId(deal: any): string | null {
  const value =
    deal?.deal_stage?.id ??
    deal?.deal_stage_id ??
    deal?.stage_id ??
    deal?.stage?.id;

  return value == null || String(value).trim() === "" ? null : String(value);
}

export function rdDealStageName(deal: any): string | null {
  const values = [
    deal?.deal_stage?.name,
    deal?.deal_stage_name,
    deal?.stage_name,
    deal?.stage?.name,
  ];
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}
