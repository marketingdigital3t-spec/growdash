-- Keyset pagination for the MCP CRM lead contract.
-- The id tie-breaker makes equal timestamps deterministic and avoids offset
-- drift when new leads arrive between requests.
CREATE INDEX IF NOT EXISTS crm_leads_workspace_received_id_idx
  ON public.crm_leads (workspace_id, first_received_at DESC, id DESC);
