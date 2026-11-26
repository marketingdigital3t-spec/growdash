-- Expand the visible Growdash operating model so each area in the map has
-- its own persisted agent. Existing technical roles remain available to the
-- governance office and are intentionally not removed.
ALTER TABLE public.agent_office_agents
  DROP CONSTRAINT IF EXISTS agent_office_agents_role_check;

ALTER TABLE public.agent_office_agents
  ADD CONSTRAINT agent_office_agents_role_check CHECK (role IN (
    'ceo', 'marketing', 'commercial', 'finance', 'legal',
    'growth', 'designer', 'strategist',
    'backend_security', 'backend_meta_rd', 'frontend'
  ));

INSERT INTO public.agent_office_agents
  (workspace_id, owner_id, role, name, department, is_visible, permissions, config)
SELECT w.id, w.owner_id, seed.role, seed.name, seed.department, true, seed.permissions, seed.config
FROM public.workspaces w
CROSS JOIN (VALUES
  ('growth', 'Helena · Chief of Staff', 'growth', '{"audit":true,"prepare":true,"publish":false,"cross_domain":true}'::jsonb, '{"scope":"growth,goals,forecast"}'::jsonb),
  ('designer', 'Milo · Diretor Criativo', 'designer', '{"audit":true,"prepare":true,"publish":false}'::jsonb, '{"scope":"brand,creative,content"}'::jsonb),
  ('strategist', 'Júlia · Estrategista', 'strategist', '{"audit":true,"prepare":true,"publish":false}'::jsonb, '{"scope":"playbooks,automation,operations"}'::jsonb)
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
  AND child.role IN ('growth', 'designer', 'strategist');
