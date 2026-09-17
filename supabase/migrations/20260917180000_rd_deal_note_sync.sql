create table if not exists public.rd_deal_note_sync (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.integrations(id) on delete cascade,
  rd_deal_id text not null,
  rd_funnel_id uuid references public.rd_funnels(id) on delete set null,
  note_body text not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  provider_note_id text,
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (integration_id, rd_deal_id)
);

create index if not exists idx_rd_deal_note_sync_pending
  on public.rd_deal_note_sync (status, updated_at);

alter table public.rd_deal_note_sync enable row level security;
revoke all on public.rd_deal_note_sync from anon, authenticated;
grant all on public.rd_deal_note_sync to service_role;

comment on table public.rd_deal_note_sync is
  'Idempotency and delivery audit for automatic notes published to RD Station negotiations.';
