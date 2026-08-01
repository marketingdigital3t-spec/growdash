do $$
declare
  required_columns constant text[] := array[
    'user_id',
    'username',
    'can_dashboard',
    'can_campaigns',
    'can_funnels',
    'can_classes',
    'can_crm',
    'can_commercial',
    'can_leads',
    'can_alerts',
    'can_users',
    'can_integrations',
    'can_announcements',
    'can_automations'
  ];
  missing_columns text[];
begin
  select array_agg(column_name order by column_name)
    into missing_columns
  from unnest(required_columns) as expected(column_name)
  where not exists (
    select 1
    from information_schema.columns actual
    where actual.table_schema = 'public'
      and actual.table_name = 'user_permissions'
      and actual.column_name = expected.column_name
  );

  if coalesce(array_length(missing_columns, 1), 0) > 0 then
    raise exception
      'user_permissions is missing required columns: %',
      array_to_string(missing_columns, ', ');
  end if;

  if to_regprocedure(
    'public.admin_save_workspace_user_access(uuid,uuid,text,text,jsonb,uuid[],uuid[])'
  ) is null then
    raise exception 'admin_save_workspace_user_access RPC is missing';
  end if;

  if to_regprocedure(
    'public.admin_remove_workspace_user_access(uuid,uuid)'
  ) is null then
    raise exception 'admin_remove_workspace_user_access RPC is missing';
  end if;
end
$$;
