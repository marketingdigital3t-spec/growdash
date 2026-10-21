export type FastManualSyncRequest = {
  adAccountId?: string;
  adAccountIds?: string[];
  startDate: string;
  endDate: string;
  force: true;
  fast: true;
  syncMode: "selected_period";
};

export function buildFastManualSyncRequest(input: Omit<FastManualSyncRequest, "force" | "fast" | "syncMode">): FastManualSyncRequest {
  return {
    ...input,
    force: true,
    fast: true,
    syncMode: "selected_period",
  };
}
