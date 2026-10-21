-- The AI/RAG and MCP readers filter actions by account, ad, attribution
-- window, date and action type. The older account/date index still forced a
-- large post-filter for high-volume accounts, especially on the MCP endpoint.
CREATE INDEX IF NOT EXISTS idx_insight_actions_ai_scope
  ON public.insight_actions (ad_account_id, ad_id, attribution_window, date, action_type);

COMMENT ON INDEX public.idx_insight_actions_ai_scope IS
  'Supports scoped AI/RAG and MCP reads without scanning unrelated account action rows.';
