-- Anotações comerciais da Growdash ficam separadas da carga sincronizada do
-- RD Station. Assim, uma nova sincronização nunca sobrescreve o histórico do
-- time, mas o acesso continua limitado à mesma conta de anúncio do negócio.
create table if not exists public.rd_deal_notes (
  id uuid primary key default gen_random_uuid(),
  rd_deal_id uuid not null references public.rd_deals(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete restrict,
  author_name text not null,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists idx_rd_deal_notes_deal_created
  on public.rd_deal_notes (rd_deal_id, created_at desc);

alter table public.rd_deal_notes enable row level security;

grant select, insert on public.rd_deal_notes to authenticated;
grant all on public.rd_deal_notes to service_role;

drop policy if exists "View RD deal notes" on public.rd_deal_notes;
create policy "View RD deal notes"
  on public.rd_deal_notes for select to authenticated
  using (
    exists (
      select 1
      from public.rd_deals deal
      where deal.id = rd_deal_notes.rd_deal_id
        and (
          public.has_role(auth.uid(), 'admin')
          or public.user_owns_ad_account(auth.uid(), deal.ad_account_id)
        )
    )
  );

drop policy if exists "Create own RD deal notes" on public.rd_deal_notes;
create policy "Create own RD deal notes"
  on public.rd_deal_notes for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1
      from public.rd_deals deal
      where deal.id = rd_deal_notes.rd_deal_id
        and (
          public.has_role(auth.uid(), 'admin')
          or public.user_owns_ad_account(auth.uid(), deal.ad_account_id)
        )
    )
  );
