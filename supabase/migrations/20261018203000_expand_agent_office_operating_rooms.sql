-- Growdash OS: persist the ten business rooms shown in the central map.
-- The UI can render safely before this migration runs, but once applied each
-- room resolves to a real visible gestor instead of a fabricated status.
ALTER TABLE public.agent_office_agents
  DROP CONSTRAINT IF EXISTS agent_office_agents_role_check;

ALTER TABLE public.agent_office_agents
  ADD CONSTRAINT agent_office_agents_role_check CHECK (role IN (
    'ceo', 'marketing', 'commercial', 'finance', 'legal',
    'growth', 'designer', 'strategist', 'research', 'social', 'analytics', 'inbox',
    'backend_security', 'backend_meta_rd', 'frontend'
  ));

INSERT INTO public.agent_office_agents
  (workspace_id, owner_id, role, name, department, is_visible, permissions, config)
SELECT w.id, w.owner_id, seed.role, seed.name, seed.department, true, seed.permissions, seed.config
FROM public.workspaces w
CROSS JOIN (VALUES
  ('research', 'Rafael · Gestor de Pesquisa', 'research', '{"audit":true,"prepare":true,"publish":false}'::jsonb, '{"scope":"market,competition,trends"}'::jsonb),
  ('social', 'Sofia · Gestora de Conteúdo', 'social', '{"audit":true,"prepare":true,"publish":false}'::jsonb, '{"scope":"social,calendar,content"}'::jsonb),
  ('analytics', 'Theo · Gestor de Dados', 'analytics', '{"audit":true,"prepare":true,"publish":false}'::jsonb, '{"scope":"metrics,diagnostics,reports"}'::jsonb),
  ('inbox', 'Nina · Gestora de Triagem', 'inbox', '{"audit":true,"prepare":true,"send_messages":false}'::jsonb, '{"scope":"inbox,triage,routing"}'::jsonb)
) AS seed(role, name, department, permissions, config)
ON CONFLICT (workspace_id, role) DO UPDATE SET
  owner_id = EXCLUDED.owner_id,
  name = EXCLUDED.name,
  department = EXCLUDED.department,
  is_visible = true,
  permissions = EXCLUDED.permissions,
  config = EXCLUDED.config,
  updated_at = now();

UPDATE public.agent_office_agents AS child
SET parent_agent_id = parent.id
FROM public.agent_office_agents AS parent
WHERE child.workspace_id = parent.workspace_id
  AND parent.role = 'ceo'
  AND child.role IN ('research', 'social', 'analytics', 'inbox');
