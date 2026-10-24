-- The requested monitoring window is 08:00 and 15:00 America/Sao_Paulo.
alter table public.traffic_agent_settings
  alter column afternoon_time set default '15:00';

update public.traffic_agent_settings
   set afternoon_time = '15:00', updated_at = now()
 where afternoon_time = '14:00';
