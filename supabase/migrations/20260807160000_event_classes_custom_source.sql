-- Turmas personalizadas não dependem de mídia paga ou de um funil do RD.
-- As colunas continuam aceitando os vínculos existentes para turmas integradas.
alter table public.event_classes
  alter column ad_account_id drop not null,
  alter column rd_funnel_id drop not null;
