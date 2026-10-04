type MetaSyncResult = {
  error?: unknown;
  data?: { error?: unknown; status?: string | null } | null;
};

/** A partial Insights run may still have persisted useful daily facts. Always
 * attempt the independent action/leads block unless Insights itself failed. */
export function canRunSelectedMetaLeadSync(insights: MetaSyncResult) {
  return !insights.error
    && !insights.data?.error
    && !["failed", "blocked"].includes(String(insights.data?.status || ""));
}

export function selectedMetaSyncIsPartial(insights: MetaSyncResult, leads: MetaSyncResult) {
  const insightsPartial = String(insights.data?.status || "") === "partial";
  const leadsStatus = String(leads.data?.status || (leads.error || leads.data?.error ? "error" : "success"));
  const leadsPartial = ["partial", "failed", "error", "blocked"].includes(leadsStatus);
  return insightsPartial || leadsPartial;
}
