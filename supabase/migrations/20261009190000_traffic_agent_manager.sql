-- Authorized traffic manager: analysis, proposals and owner approvals.
-- Browser execution remains local and is never triggered by analysis alone.

create table if not exists public.traffic_agent_runtime (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  status text not null default 'offline' check (status in ('offline','online','analyzing','waiting_approval','executing','error')),
  browser_status text not null default 'disconnected' check (browser_status in ('disconnected','connected','login_required','blocked','error')),
  computer_name text,
  last_heartbeat_at timestamptz,
  last_analysis_at timestamptz,
  next_analysis_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.traffic_agent_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  enabled boolean not null default true,
  analysis_timezone text not null default 'America/Sao_Paulo',
  morning_time time not null default '08:00',
  afternoon_time time not null default '14:00',
  allow_manual_analysis boolean not null default true,
  max_budget_change_percent numeric not null default 20 check (max_budget_change_percent between 0 and 100),
  max_daily_budget_change numeric not null default 500 check (max_daily_budget_change >= 0),
  min_evidence_days integer not null default 3 check (min_evidence_days between 1 and 30),
  updated_at timestamptz not null default now()
);

alter table public.traffic_agent_settings
  add column if not exists strategy_niche text not null default 'estetica',
  add column if not exists execution_mode text not null default 'approval_required',
  add column if not exists auto_pause_enabled boolean not null default true,
  add column if not exists auto_budget_enabled boolean not null default true,
  add column if not exists min_spend_for_pause numeric not null default 150 check (min_spend_for_pause >= 0),
  add column if not exists min_sales_for_scale integer not null default 1 check (min_sales_for_scale >= 1),
  add column if not exists target_roas numeric not null default 2 check (target_roas >= 0);

alter table public.traffic_agent_settings
  drop constraint if exists traffic_agent_settings_execution_mode_check;
alter table public.traffic_agent_settings
  add constraint traffic_agent_settings_execution_mode_check check (execution_mode in ('approval_required','autonomous_guarded','paused'));
alter table public.traffic_agent_settings alter column execution_mode set default 'approval_required';
update public.traffic_agent_settings set execution_mode = 'approval_required' where execution_mode = 'autonomous_guarded';

create table if not exists public.traffic_action_proposals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  run_id uuid references public.agent_office_runs(id) on delete set null,
  fingerprint text not null,
  ad_account_id uuid references public.ad_accounts(id) on delete set null,
  entity_type text not null check (entity_type in ('account','campaign','adset','ad','creative','audience')),
  entity_id text,
  entity_name text,
  status text not null default 'draft' check (status in ('draft','awaiting_approval','approved','executing','executed','rejected','failed')),
  diagnosis text not null,
  evidence jsonb not null default '{}'::jsonb,
  proposed_action text not null,
  current_value jsonb not null default '{}'::jsonb,
  proposed_value jsonb not null default '{}'::jsonb,
  expected_impact text,
  risk text not null default 'medium' check (risk in ('low','medium','high','critical')),
  valid_until timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, fingerprint)
);

create table if not exists public.traffic_action_audit (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  proposal_id uuid not null references public.traffic_action_proposals(id) on delete cascade,
  event_type text not null check (event_type in ('created','approved','rejected','revision_requested','executing','executed','failed','rollback_requested','rolled_back')),
  actor_id uuid references auth.users(id) on delete set null,
  old_value jsonb not null default '{}'::jsonb,
  new_value jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists traffic_proposals_workspace_status_idx on public.traffic_action_proposals(workspace_id, status, created_at desc);
create index if not exists traffic_proposals_account_idx on public.traffic_action_proposals(ad_account_id, created_at desc);
create index if not exists traffic_audit_proposal_idx on public.traffic_action_audit(proposal_id, created_at desc);

alter table public.traffic_agent_runtime enable row level security;
alter table public.traffic_agent_settings enable row level security;
alter table public.traffic_action_proposals enable row level security;
alter table public.traffic_action_audit enable row level security;

create policy "Traffic agent owner runtime" on public.traffic_agent_runtime for select to authenticated using (public.agent_office_owner(workspace_id));
create policy "Traffic agent owner settings" on public.traffic_agent_settings for select to authenticated using (public.agent_office_owner(workspace_id));
create policy "Traffic agent owner proposals" on public.traffic_action_proposals for select to authenticated using (public.agent_office_owner(workspace_id));
create policy "Traffic agent owner audit" on public.traffic_action_audit for select to authenticated using (public.agent_office_owner(workspace_id));

revoke all on public.traffic_agent_runtime, public.traffic_agent_settings, public.traffic_action_proposals, public.traffic_action_audit from anon, authenticated;
grant select on public.traffic_agent_runtime, public.traffic_agent_settings, public.traffic_action_proposals, public.traffic_action_audit to authenticated;
grant all on public.traffic_agent_runtime, public.traffic_agent_settings, public.traffic_action_proposals, public.traffic_action_audit to service_role;

create or replace function public.traffic_proposal_requires_approval()
returns trigger language plpgsql security definer set search_path = public, pg_catalog
as $$
begin
  if new.status in ('executing','executed') and new.approved_by is null then
    raise exception 'TRAFFIC_PROPOSAL_APPROVAL_REQUIRED';
  end if;
  return new;
end;
$$;
drop trigger if exists traffic_proposal_requires_approval on public.traffic_action_proposals;
create trigger traffic_proposal_requires_approval
before insert or update of status, approved_by on public.traffic_action_proposals
for each row execute function public.traffic_proposal_requires_approval();

create or replace function public.decide_traffic_action_proposal(
  p_proposal_id uuid,
  p_decision text,
  p_comment text default null
) returns public.traffic_action_proposals
language plpgsql security definer set search_path = public, pg_catalog
as $$
declare v_proposal public.traffic_action_proposals;
begin
  if p_decision not in ('approved','rejected','revision_requested') then raise exception 'INVALID_DECISION'; end if;
  select * into v_proposal from public.traffic_action_proposals where id = p_proposal_id for update;
  if v_proposal.id is null or not public.agent_office_owner(v_proposal.workspace_id) then raise exception 'OWNER_APPROVAL_REQUIRED'; end if;
  if v_proposal.status <> 'awaiting_approval' then raise exception 'PROPOSAL_NOT_AWAITING_APPROVAL'; end if;
  insert into public.traffic_action_audit(workspace_id, proposal_id, event_type, actor_id, evidence)
  values (v_proposal.workspace_id, p_proposal_id,
    case p_decision when 'approved' then 'approved' when 'rejected' then 'rejected' else 'revision_requested' end,
    auth.uid(), jsonb_build_object('comment', nullif(left(p_comment, 2000), '')));
  update public.traffic_action_proposals
    set status = case p_decision when 'approved' then 'approved' when 'rejected' then 'rejected' else 'draft' end,
        approved_by = case when p_decision = 'approved' then auth.uid() else null end,
        approved_at = case when p_decision = 'approved' then now() else null end,
        updated_at = now()
    where id = p_proposal_id
    returning * into v_proposal;
  return v_proposal;
end;
$$;

revoke all on function public.decide_traffic_action_proposal(uuid, text, text) from public, anon;
grant execute on function public.decide_traffic_action_proposal(uuid, text, text) to authenticated;
