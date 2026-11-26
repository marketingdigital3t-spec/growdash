
-- RLS policies for dashboard_views (none existed, so SELECT returned nothing for everyone)
CREATE POLICY "Anyone authenticated can read global views"
  ON public.dashboard_views FOR SELECT
  TO authenticated
  USING (scope = 'global' OR user_id = auth.uid());

CREATE POLICY "Masters manage global views"
  ON public.dashboard_views FOR ALL
  TO authenticated
  USING (public.is_master(auth.uid()) OR user_id = auth.uid())
  WITH CHECK (public.is_master(auth.uid()) OR user_id = auth.uid());

-- Seed default global "Padrão" dashboard view if missing
INSERT INTO public.dashboard_views (user_id, name, is_default, is_system, scope, layout, widgets)
SELECT
  COALESCE(
    (SELECT id FROM auth.users WHERE lower(email) = 'marketingdigital3t@gmail.com' LIMIT 1),
    (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
  ),
  'Padrão', true, true, 'global',
  '[{"i":"default","x":0,"y":0,"w":12,"h":30,"minW":12,"minH":10}]'::jsonb,
  '[{"id":"default","type":"default_block","title":"Padrão","config":{}}]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.dashboard_views WHERE scope = 'global');
