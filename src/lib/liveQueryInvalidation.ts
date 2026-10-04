const LIVE_QUERY_PREFIXES = new Set([
  "ad_accounts", "campaigns", "campaigns_full", "meta-adsets-independent", "meta-ads-independent",
  "meta-action-sync-coverage",
  "insights", "insights_hourly", "daily_spend_by_account", "daily_budget_active_by_account",
  "rd_deals", "rd_crm_deals", "rd_deals_period", "rd_won_deals_period", "rd_funnel_stages",
  "sales", "alerts", "social_accounts", "social_media", "social_insights_daily",
  "financial-entries", "financial-history", "kanban_boards", "kanban_board_details", "workspace-files",
]);

export function shouldInvalidateLiveQuery(queryKey: readonly unknown[]) {
  return LIVE_QUERY_PREFIXES.has(String(queryKey[0]));
}
