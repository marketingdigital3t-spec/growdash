-- Growth Engine contract: immutable evidence, bounded experiments and auditable
-- Meta mutations. Existing Meta/RD tables remain canonical sources.

alter table public.traffic_agent_settings
  add column if not exists autonomy_mode text not null default 'dry_run',
  add column if not exists max_concurrent_tests integer not null default 2,
  add column if not exists test_budget_fraction numeric not null default 0.10,
  add column if not exists test_window_hours integer not null default 72,
  add column if not exists hard_test_cap numeric not null default 500,
  add column if not exists auto_publish_enabled boolean not null default true;

alter table public.traffic_agent_settings drop constraint if exists traffic_agent_settings_autonomy_mode_check;
alter table public.traffic_agent_settings add constraint traffic_agent_settings_autonomy_mode_check check (autonomy_mode in ('dry_run','autonomous_guarded','autonomous_full'));
alter table public.traffic_agent_settings drop constraint if exists traffic_agent_settings_test_fraction_check;
alter table public.traffic_agent_settings add constraint traffic_agent_settings_test_fraction_check check (test_budget_fraction > 0 and test_budget_fraction <= 0.5);

update public.traffic_agent_settings
   set auto_publish_enabled = enabled and autonomy_mode <> 'dry_run'
 where auto_publish_enabled = false;

create table if not exists public.growth_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ad_account_id uuid not null references public.ad_accounts(id) on delete cascade,
  source text not null default 'meta_rd',
  start_date date not null,
  end_date date not null,
  timezone text not null default 'America/Sao_Paulo',
  attribution_window text not null default 'account_default',
  freshness_minutes integer not null default 0,
  quality text not null default 'confirmed' check (quality in ('confirmed','partial','stale','error')),
  attribution_coverage numeric not null default 0 check (attribution_coverage >= 0 and attribution_coverage <= 1),
  metrics jsonb not null default '{}'::jsonb,
  graph jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists growth_snapshots_scope_idx on public.growth_snapshots(ad_account_id, end_date desc, created_at desc);

create table if not exists public.growth_experiments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ad_account_id uuid not null references public.ad_accounts(id) on delete cascade,
  source_campaign_id text,
  source_adset_id text,
  source_ad_id text,
  hypothesis text not null,
  idempotency_key text not null,
  status text not null default 'planned' check (status in ('planned','generating','rendering','policy_review','ready','published','measuring','promoted','stopped','blocked','rolled_back')),
  reference_cpl numeric not null default 0,
  test_budget numeric not null default 0,
  account_budget_cap numeric not null default 0,
  window_hours integer not null default 72,
  started_at timestamptz,
  ends_at timestamptz,
  source_snapshot_id uuid references public.growth_snapshots(id) on delete set null,
  current_snapshot_id uuid references public.growth_snapshots(id) on delete set null,
  block_reason text,
  provider_state jsonb not null default '{}'::jsonb,
  rollback_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, idempotency_key)
);

create index if not exists growth_experiments_scope_status_idx on public.growth_experiments(ad_account_id, status, created_at desc);

create table if not exists public.growth_experiment_variants (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.growth_experiments(id) on delete cascade,
  creative_asset_id uuid,
  source_ad_id text,
  new_adset_id text,
  new_ad_id text,
  provider_creative_id text,
  variant_index integer not null default 0,
  hypothesis text not null,
  status text not null default 'planned' check (status in ('planned','generating','rendering','policy_review','ready','published','measuring','promoted','stopped','blocked','rolled_back')),
  metrics jsonb not null default '{}'::jsonb,
  tracking_payload jsonb not null default '{}'::jsonb,
  provider_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.growth_creative_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ad_account_id uuid references public.ad_accounts(id) on delete set null,
  source_asset_id uuid references public.growth_creative_assets(id) on delete set null,
  asset_kind text not null check (asset_kind in ('image','video','copy','template')),
  storage_path text,
  mime_type text,
  width integer,
  height integer,
  sha256 text,
  brand_id uuid,
  offer_key text,
  prompt_version text,
  prompt_input jsonb not null default '{}'::jsonb,
  claims jsonb not null default '{}'::jsonb,
  status text not null default 'generated' check (status in ('generated','rendered','policy_review','approved','rejected','archived')),
  policy_flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'growth_variant_asset_fk') then
    alter table public.growth_experiment_variants
      add constraint growth_variant_asset_fk foreign key (creative_asset_id) references public.growth_creative_assets(id) on delete set null;
  end if;
end $$;

create table if not exists public.growth_decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  experiment_id uuid references public.growth_experiments(id) on delete cascade,
  variant_id uuid references public.growth_experiment_variants(id) on delete cascade,
  decision text not null check (decision in ('continue','promote','stop','block','rollback')),
  reason text not null,
  evidence jsonb not null default '{}'::jsonb,
  score numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.growth_learning_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ad_account_id uuid references public.ad_accounts(id) on delete set null,
  hypothesis text not null,
  pattern text not null,
  outcome text not null,
  evidence jsonb not null default '{}'::jsonb,
  prompt_version text,
  created_at timestamptz not null default now()
);

create table if not exists public.growth_budget_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ad_account_id uuid not null references public.ad_accounts(id) on delete cascade,
  experiment_id uuid references public.growth_experiments(id) on delete set null,
  entry_type text not null check (entry_type in ('reserve','spend','release','rollback','adjustment')),
  amount numeric not null check (amount >= 0),
  idempotency_key text not null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(workspace_id, idempotency_key)
);

create table if not exists public.growth_prompt_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  prompt_key text not null,
  prompt_version text not null,
  model text,
  input_snapshot_id uuid references public.growth_snapshots(id) on delete set null,
  structured_output jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  confidence numeric,
  policy_flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.growth_policy_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  creative_asset_id uuid references public.growth_creative_assets(id) on delete cascade,
  status text not null check (status in ('pending','approved','rejected','blocked')),
  provider text not null default 'internal',
  findings jsonb not null default '[]'::jsonb,
  checked_at timestamptz not null default now()
);

create index if not exists growth_ledger_account_time_idx on public.growth_budget_ledger(ad_account_id, created_at desc);
create index if not exists growth_prompt_scope_idx on public.growth_prompt_runs(workspace_id, created_at desc);

alter table public.growth_snapshots enable row level security;
alter table public.growth_experiments enable row level security;
alter table public.growth_experiment_variants enable row level security;
alter table public.growth_creative_assets enable row level security;
alter table public.growth_decisions enable row level security;
alter table public.growth_learning_records enable row level security;
alter table public.growth_budget_ledger enable row level security;
alter table public.growth_prompt_runs enable row level security;
alter table public.growth_policy_reviews enable row level security;

create policy "Growth snapshots owner read" on public.growth_snapshots for select to authenticated using (public.agent_office_owner(workspace_id));
create policy "Growth experiments owner read" on public.growth_experiments for select to authenticated using (public.agent_office_owner(workspace_id));
create policy "Growth variants owner read" on public.growth_experiment_variants for select to authenticated using (exists (select 1 from public.growth_experiments e where e.id = experiment_id and public.agent_office_owner(e.workspace_id)));
create policy "Growth assets owner read" on public.growth_creative_assets for select to authenticated using (public.agent_office_owner(workspace_id));
create policy "Growth decisions owner read" on public.growth_decisions for select to authenticated using (public.agent_office_owner(workspace_id));
create policy "Growth learning owner read" on public.growth_learning_records for select to authenticated using (public.agent_office_owner(workspace_id));
create policy "Growth ledger owner read" on public.growth_budget_ledger for select to authenticated using (public.agent_office_owner(workspace_id));
create policy "Growth prompts owner read" on public.growth_prompt_runs for select to authenticated using (public.agent_office_owner(workspace_id));
create policy "Growth policy owner read" on public.growth_policy_reviews for select to authenticated using (public.agent_office_owner(workspace_id));

revoke all on public.growth_snapshots, public.growth_experiments, public.growth_experiment_variants, public.growth_creative_assets, public.growth_decisions, public.growth_learning_records, public.growth_budget_ledger, public.growth_prompt_runs, public.growth_policy_reviews from anon, authenticated;
grant select on public.growth_snapshots, public.growth_experiments, public.growth_experiment_variants, public.growth_creative_assets, public.growth_decisions, public.growth_learning_records, public.growth_budget_ledger, public.growth_prompt_runs, public.growth_policy_reviews to authenticated;
grant all on public.growth_snapshots, public.growth_experiments, public.growth_experiment_variants, public.growth_creative_assets, public.growth_decisions, public.growth_learning_records, public.growth_budget_ledger, public.growth_prompt_runs, public.growth_policy_reviews to service_role;

create or replace function public.set_growth_engine_mode(p_workspace_id uuid, p_mode text, p_enabled boolean default true)
returns public.traffic_agent_settings
language plpgsql security definer set search_path = public, pg_catalog
as $$
declare result public.traffic_agent_settings;
begin
  if not public.agent_office_owner(p_workspace_id) then raise exception 'GROWTH_ENGINE_OWNER_REQUIRED'; end if;
  if p_mode not in ('dry_run','autonomous_guarded','autonomous_full') then raise exception 'INVALID_GROWTH_ENGINE_MODE'; end if;
  update public.traffic_agent_settings
     set autonomy_mode = p_mode,
         enabled = p_enabled,
         auto_publish_enabled = p_enabled and p_mode <> 'dry_run',
         execution_mode = case when not p_enabled then 'paused' else 'autonomous_guarded' end,
         updated_at = now()
   where workspace_id = p_workspace_id
   returning * into result;
  if result.workspace_id is null then
    insert into public.traffic_agent_settings(workspace_id, autonomy_mode, enabled, auto_publish_enabled, execution_mode)
    values (p_workspace_id, p_mode, p_enabled, p_enabled and p_mode <> 'dry_run', case when not p_enabled then 'paused' else 'autonomous_guarded' end)
    returning * into result;
  end if;
  return result;
end;
$$;

revoke all on function public.set_growth_engine_mode(uuid, text, boolean) from public, anon;
grant execute on function public.set_growth_engine_mode(uuid, text, boolean) to authenticated;

insert into storage.buckets (id, name, public)
values ('growth-creatives', 'growth-creatives', false)
on conflict (id) do nothing;
