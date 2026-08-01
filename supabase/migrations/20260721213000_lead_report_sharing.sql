create table if not exists public.lead_report_pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  share_token uuid not null default gen_random_uuid() unique,
  title text not null,
  account_id text,
  account_name text,
  date_from date not null,
  date_to date not null,
  metrics text[] not null default '{}',
  banner_data text,
  payload jsonb not null default '{}'::jsonb,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lead_report_pages_workspace_created_idx on public.lead_report_pages(workspace_id, created_at desc);
create index if not exists lead_report_pages_account_idx on public.lead_report_pages(workspace_id, account_id, created_at desc);
alter table public.lead_report_pages enable row level security;

drop policy if exists "Members can read lead reports" on public.lead_report_pages;
create policy "Members can read lead reports" on public.lead_report_pages for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists "Members can create lead reports" on public.lead_report_pages;
create policy "Members can create lead reports" on public.lead_report_pages for insert to authenticated with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));
drop policy if exists "Owners can update own lead reports" on public.lead_report_pages;
create policy "Owners can update own lead reports" on public.lead_report_pages for update to authenticated using (auth.uid() = user_id and public.is_workspace_member(workspace_id)) with check (auth.uid() = user_id and public.is_workspace_member(workspace_id));
drop policy if exists "Owners can delete own lead reports" on public.lead_report_pages;
create policy "Owners can delete own lead reports" on public.lead_report_pages for delete to authenticated using (auth.uid() = user_id and public.is_workspace_member(workspace_id));

create or replace function public.get_shared_lead_report(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(report) - 'user_id' - 'workspace_id' - 'banner_data'
  from public.lead_report_pages report
  where report.share_token = p_token and report.is_public = true
  limit 1;
$$;

revoke all on function public.get_shared_lead_report(uuid) from public;
grant execute on function public.get_shared_lead_report(uuid) to anon, authenticated;
grant select, insert, update, delete on public.lead_report_pages to authenticated;
