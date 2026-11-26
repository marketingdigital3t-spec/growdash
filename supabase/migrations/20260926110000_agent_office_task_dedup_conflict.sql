-- PostgREST cannot target a partial unique index in ON CONFLICT.
-- finding_id is nullable, and PostgreSQL still permits multiple NULL values
-- in a regular unique index, so keep the same deduplication semantics while
-- exposing a conflict target usable by the Edge Function.
drop index if exists public.agent_office_tasks_run_finding_uidx;

create unique index if not exists agent_office_tasks_run_finding_uidx
  on public.agent_office_tasks (workspace_id, run_id, finding_id);
