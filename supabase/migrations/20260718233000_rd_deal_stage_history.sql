-- Preserva cada mudança de etapa recebida do RD Station. A tabela é somente
-- leitura para usuários da aplicação; sincronizadores usam service_role.
create table if not exists public.rd_deal_stage_history (
  id uuid primary key default gen_random_uuid(),
  rd_deal_id uuid not null references public.rd_deals(id) on delete cascade,
  user_id uuid not null,
  ad_account_id uuid not null,
  rd_funnel_id uuid not null,
  from_stage_id text,
  from_stage_name text,
  from_stage_bucket text,
  to_stage_id text,
  to_stage_name text,
  to_stage_bucket text,
  source text not null default 'rd_sync' check (source in ('rd_sync', 'webhook', 'manual_approved', 'import')),
  changed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_rd_deal_stage_history_deal_changed
  on public.rd_deal_stage_history(rd_deal_id, changed_at desc);
create index if not exists idx_rd_deal_stage_history_account_changed
  on public.rd_deal_stage_history(ad_account_id, changed_at desc);

alter table public.rd_deal_stage_history enable row level security;
grant select on public.rd_deal_stage_history to authenticated;
grant all on public.rd_deal_stage_history to service_role;

drop policy if exists "View rd deal stage history" on public.rd_deal_stage_history;
create policy "View rd deal stage history"
  on public.rd_deal_stage_history for select
  using (
    public.has_role(auth.uid(), 'admin')
    or public.user_owns_ad_account(auth.uid(), ad_account_id)
  );

create or replace function public.capture_rd_deal_stage_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.rd_stage_id is distinct from new.rd_stage_id
     or old.stage_bucket is distinct from new.stage_bucket then
    insert into public.rd_deal_stage_history (
      rd_deal_id, user_id, ad_account_id, rd_funnel_id,
      from_stage_id, from_stage_name, from_stage_bucket,
      to_stage_id, to_stage_name, to_stage_bucket,
      source, changed_at, metadata
    ) values (
      new.id, new.user_id, new.ad_account_id, new.rd_funnel_id,
      old.rd_stage_id, old.rd_stage_name, old.stage_bucket,
      new.rd_stage_id, new.rd_stage_name, new.stage_bucket,
      'rd_sync', coalesce(new.stage_updated_at, now()),
      jsonb_build_object('rd_deal_id', new.rd_deal_id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists capture_rd_deal_stage_history on public.rd_deals;
create trigger capture_rd_deal_stage_history
after update of rd_stage_id, rd_stage_name, stage_bucket on public.rd_deals
for each row execute function public.capture_rd_deal_stage_history();
