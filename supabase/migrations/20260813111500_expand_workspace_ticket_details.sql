-- Ticket requests need enough context to be actionable and the requester must
-- be able to correct or withdraw their own request.
ALTER TABLE public.workspace_tickets
  ADD COLUMN IF NOT EXISTS requester_name text,
  ADD COLUMN IF NOT EXISTS requested_at date NOT NULL DEFAULT CURRENT_DATE;

UPDATE public.workspace_tickets
SET requested_at = created_at::date
WHERE requested_at IS NULL;

DROP POLICY IF EXISTS "Managers update workspace tickets" ON public.workspace_tickets;
CREATE POLICY "Members edit own or managers update workspace tickets"
ON public.workspace_tickets FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.can_manage_workspace(workspace_id))
WITH CHECK (created_by = auth.uid() OR public.can_manage_workspace(workspace_id));

DROP POLICY IF EXISTS "Managers delete workspace tickets" ON public.workspace_tickets;
CREATE POLICY "Members delete own or managers delete workspace tickets"
ON public.workspace_tickets FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.can_manage_workspace(workspace_id));
