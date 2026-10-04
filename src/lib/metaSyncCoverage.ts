export type MetaSyncCoverageRow = {
  ad_account_id: string;
  campaign_scope: string;
  start_date: string;
  end_date: string;
  covered_start_date?: string | null;
  covered_end_date?: string | null;
  timezone: string;
  attribution_window: string;
  status: string;
  block_status?: Record<string, unknown> | null;
  updated_at?: string | null;
};

export type MetaAccountScope = {
  accountId: string;
  timezone: string;
  attributionWindow: string;
};

function blockStatus(row: MetaSyncCoverageRow, block: string) {
  const value = row.block_status?.[block];
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "status" in value) {
    return String((value as { status?: unknown }).status || "");
  }
  return "";
}

function hasPersistedBlockEvidence(row: MetaSyncCoverageRow, block: string) {
  const value = row.block_status?.[block];
  if (!value || typeof value !== "object") return false;
  const evidence = value as { rowsPersisted?: unknown; sourceInsightRows?: unknown };
  if (block === "insights") {
    return typeof evidence.rowsPersisted === "number" && evidence.rowsPersisted > 0;
  }
  if (block === "actions") {
    return typeof evidence.sourceInsightRows === "number"
      && evidence.sourceInsightRows > 0
      && typeof evidence.rowsPersisted === "number";
  }
  return true;
}

function campaignScopeCovers(scope: string, campaignIds: string[]) {
  if (scope === "all-campaigns") return true;
  if (!campaignIds.length) return false;
  const scopedIds = new Set(scope.split(",").filter(Boolean));
  return campaignIds.every((id) => scopedIds.has(id));
}

export function findMetaSyncCoverage(
  rows: MetaSyncCoverageRow[],
  account: MetaAccountScope,
  startDate: string,
  endDate: string,
  campaignIds: string[] = [],
  block = "actions",
) {
  return rows
    .filter((row) => {
      const coveredStart = row.covered_start_date || row.start_date;
      const coveredEnd = row.covered_end_date || row.end_date;
      return row.ad_account_id === account.accountId
        && row.timezone === account.timezone
        && (row.attribution_window || "account_default") === (account.attributionWindow || "account_default")
        && coveredStart <= startDate
        && coveredEnd >= endDate
        && ["fresh", "success", "partial"].includes(row.status)
        && ["fresh", "success"].includes(blockStatus(row, block))
        && hasPersistedBlockEvidence(row, block)
        && campaignScopeCovers(row.campaign_scope, campaignIds);
    })
    .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")))[0] || null;
}

export function getMetaCoverageGaps(
  rows: MetaSyncCoverageRow[],
  accounts: MetaAccountScope[],
  startDate: string,
  endDate: string,
  campaignIds: string[] = [],
  block = "actions",
) {
  return accounts.filter((account) => !findMetaSyncCoverage(rows, account, startDate, endDate, campaignIds, block));
}
