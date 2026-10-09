-- Canonical Meta sync runs and metric facts. This migration is additive: the
-- legacy Meta tables remain the source for existing screens during rollout.
create table if not exists public.meta_sync_runs (
  id uuid primary key default gen_random_uuid(),
  ad_account_id text not null,
  status text not null default 'running'
    check (status in ('running','completed','partial','failed')),
  triggered_by text default 'manual',
  period_start date,
  period_end date,
  pages_processed int not null default 0,
  insights_written int not null default 0,
  actions_written int not null default 0,
  breakdowns_written int not null default 0,
  errors_total int not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists idx_meta_sync_runs_account_finish
  on public.meta_sync_runs (ad_account_id, finished_at desc);
create index if not exists idx_meta_sync_runs_coverage
  on public.meta_sync_runs (ad_account_id, status, period_start, period_end);

create table if not exists public.meta_insights_contract (
  run_id uuid not null references public.meta_sync_runs(id) on delete cascade,
  ad_account_id text not null,
  date_start date not null,
  date_end date not null,
  level text not null check (level in ('campaign','adset','ad')),
  item_id text not null,
  campaign_id text,
  campaign_name text,
  objective text,
  optimization_event text,
  spend numeric,
  impressions bigint,
  reach bigint,
  clicks bigint,
  ctr numeric,
  cpc numeric,
  cpm numeric,
  results numeric,
  result_type text,
  cpa numeric,
  roas numeric,
  synced_at timestamptz not null default now(),
  primary key (ad_account_id, date_start, level, item_id)
);

create index if not exists idx_meta_contract_run
  on public.meta_insights_contract (run_id);
create index if not exists idx_meta_contract_campaign
  on public.meta_insights_contract (campaign_id);

alter table public.meta_sync_runs enable row level security;
alter table public.meta_insights_contract enable row level security;

-- Only backend workers write these tables. Reads are exposed through the
-- scoped function below, not direct table access.
revoke all on table public.meta_sync_runs from anon, authenticated;
revoke all on table public.meta_insights_contract from anon, authenticated;
grant all on table public.meta_sync_runs to service_role;
grant all on table public.meta_insights_contract to service_role;

create or replace function public.fn_dashboard_metricas(
  p_start date,
  p_end date,
  p_timezone text default 'America/Sao_Paulo'
)
returns table (
  ad_account_id text,
  investimento numeric,
  impressoes bigint,
  cliques bigint,
  ctr numeric,
  cpc numeric,
  cpm numeric,
  resultados numeric,
  cpl numeric,
  qtd_vendas bigint,
  receita numeric,
  roas numeric
)
language sql
stable
security definer
set search_path = public
as $$
with contas_visiveis as (
  select a.id::text as internal_id, a.account_id
  from public.ad_accounts a
  where a.user_id = auth.uid()
     or public.has_role(auth.uid(), 'admin'::app_role)
), ultima_sync as (
  select distinct on (c.ad_account_id)
    c.ad_account_id, r.id as run_id
  from public.meta_sync_runs r
  join public.meta_insights_contract c on c.run_id = r.id
  join contas_visiveis cv on cv.internal_id = c.ad_account_id
  where r.status in ('completed','partial')
    and r.period_start <= p_end
    and r.period_end >= p_start
  order by c.ad_account_id, r.finished_at desc nulls last, r.started_at desc
), niveis as (
  select u.ad_account_id,
    case when exists (
      select 1 from public.meta_insights_contract cx
      where cx.run_id = u.run_id and cx.level = 'campaign'
    ) then 'campaign' else 'ad' end as level
  from ultima_sync u
), meta as (
  select
    c.ad_account_id,
    coalesce(sum(c.spend), 0)::numeric as investimento,
    coalesce(sum(c.impressions), 0)::bigint as impressoes,
    coalesce(sum(c.clicks), 0)::bigint as cliques,
    case when sum(c.impressions) > 0
      then round((sum(c.clicks)::numeric / nullif(sum(c.impressions), 0)) * 100, 2)
      else 0 end as ctr,
    case when sum(c.clicks) > 0
      then round(sum(c.spend)::numeric / nullif(sum(c.clicks), 0), 2)
      else 0 end as cpc,
    case when sum(c.impressions) > 0
      then round(sum(c.spend)::numeric / nullif(sum(c.impressions)::numeric / 1000, 0), 2)
      else 0 end as cpm,
    coalesce(sum(c.results), 0)::numeric as resultados,
    case when sum(c.results) > 0
      then round(sum(c.spend)::numeric / nullif(sum(c.results), 0), 2)
      else 0 end as cpl
  from public.meta_insights_contract c
  join ultima_sync u on u.run_id = c.run_id
  join niveis n on n.ad_account_id = c.ad_account_id and n.level = c.level
  where c.date_start >= p_start and c.date_end <= p_end
  group by c.ad_account_id
), vendas_dedup as (
  select distinct on (d.rd_connection_id, d.rd_deal_id)
    d.*
  from public.rd_deals d
  where d.win = true
    and d.closed_at is not null
    and (d.closed_at at time zone p_timezone)::date between p_start and p_end
  order by d.rd_connection_id, d.rd_deal_id, d.updated_at desc nulls last, d.id desc
), vendas as (
  select
    coalesce(d.ad_account_id::text, a.id::text) as ad_account_id,
    count(*)::bigint as qtd_vendas,
    coalesce(sum(coalesce(d.amount_total_effective, d.amount_total)), 0)::numeric as receita
  from vendas_dedup d
  left join public.rd_account_connections rc on rc.id = d.rd_connection_id
  left join public.ad_accounts a
    on a.account_id = rc.external_account_id
    or regexp_replace(lower(a.account_id), '^act_', '') = regexp_replace(lower(rc.external_account_id), '^act_', '')
  group by 1
)
select
  m.ad_account_id,
  m.investimento,
  m.impressoes,
  m.cliques,
  m.ctr,
  m.cpc,
  m.cpm,
  m.resultados,
  m.cpl,
  v.qtd_vendas,
  v.receita,
  case when m.investimento > 0 then round(v.receita / m.investimento, 2) else 0 end as roas
from meta m
left join vendas v on v.ad_account_id = m.ad_account_id;
$$;

revoke all on function public.fn_dashboard_metricas(date, date, text) from public, anon;
grant execute on function public.fn_dashboard_metricas(date, date, text) to authenticated, service_role;
