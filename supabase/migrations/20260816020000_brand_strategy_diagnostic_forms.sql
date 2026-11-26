-- Strategic brand diagnosis and single-use client questionnaire links.
-- Public users never receive direct access to companies or workspace data: the
-- two RPCs below expose only the brand name, questionnaire and completion state.

CREATE TABLE IF NOT EXISTS public.brand_diagnostic_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'revoked')),
  expires_at timestamptz,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brand_diagnostic_forms_workspace_company_idx
  ON public.brand_diagnostic_forms(workspace_id, company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS brand_diagnostic_forms_share_token_idx
  ON public.brand_diagnostic_forms(share_token) WHERE status = 'pending';

ALTER TABLE public.brand_diagnostic_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read brand diagnostic forms"
  ON public.brand_diagnostic_forms FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Workspace managers create brand diagnostic forms"
  ON public.brand_diagnostic_forms FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_workspace(workspace_id) AND created_by = auth.uid());

CREATE POLICY "Workspace managers update brand diagnostic forms"
  ON public.brand_diagnostic_forms FOR UPDATE TO authenticated
  USING (public.can_manage_workspace(workspace_id))
  WITH CHECK (public.can_manage_workspace(workspace_id));

CREATE POLICY "Workspace managers delete brand diagnostic forms"
  ON public.brand_diagnostic_forms FOR DELETE TO authenticated
  USING (public.can_manage_workspace(workspace_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_diagnostic_forms TO authenticated;

CREATE OR REPLACE FUNCTION public.get_public_brand_diagnostic_form(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link_row public.brand_diagnostic_forms%ROWTYPE;
  company_name text;
BEGIN
  SELECT * INTO link_row
  FROM public.brand_diagnostic_forms
  WHERE share_token = p_token
    AND status = 'pending'
    AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT name INTO company_name FROM public.companies WHERE id = link_row.company_id;

  RETURN jsonb_build_object(
    'brand_name', coalesce(company_name, 'Sua marca'),
    'status', link_row.status,
    'expires_at', link_row.expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_public_brand_diagnostic_form(
  p_token uuid,
  p_answers jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link_row public.brand_diagnostic_forms%ROWTYPE;
  clean_answers jsonb;
BEGIN
  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'object' THEN
    RAISE EXCEPTION 'Respostas inválidas' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO link_row
  FROM public.brand_diagnostic_forms
  WHERE share_token = p_token
    AND status = 'pending'
    AND (expires_at IS NULL OR expires_at > now())
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link indisponível, expirado ou já utilizado' USING ERRCODE = '42501';
  END IF;

  -- Keep a bounded payload. This is a client questionnaire, not a file store.
  clean_answers := jsonb_strip_nulls(jsonb_build_object(
    'vision', left(trim(coalesce(p_answers->>'vision', '')), 3000),
    'mission', left(trim(coalesce(p_answers->>'mission', '')), 3000),
    'idealCustomer', left(trim(coalesce(p_answers->>'idealCustomer', '')), 3000),
    'positioning', left(trim(coalesce(p_answers->>'positioning', '')), 3000),
    'differentiators', left(trim(coalesce(p_answers->>'differentiators', '')), 3000),
    'offer', left(trim(coalesce(p_answers->>'offer', '')), 3000),
    'products', left(trim(coalesce(p_answers->>'products', '')), 5000),
    'salesFunnel', left(trim(coalesce(p_answers->>'salesFunnel', '')), 5000),
    'objectives', left(trim(coalesce(p_answers->>'objectives', '')), 3000),
    'contentPillars', left(trim(coalesce(p_answers->>'contentPillars', '')), 5000),
    'objections', left(trim(coalesce(p_answers->>'objections', '')), 3000),
    'competitors', left(trim(coalesce(p_answers->>'competitors', '')), 3000),
    'notes', left(trim(coalesce(p_answers->>'notes', '')), 5000)
  ));

  UPDATE public.brand_diagnostic_forms
     SET status = 'submitted', answers = clean_answers, submitted_at = now(), updated_at = now()
   WHERE id = link_row.id;

  RETURN link_row.id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_brand_diagnostic_form(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_public_brand_diagnostic_form(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_brand_diagnostic_form(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_brand_diagnostic_form(uuid, jsonb) TO anon, authenticated;

COMMENT ON TABLE public.brand_diagnostic_forms IS
  'Single-use, token-gated strategic brand diagnosis questionnaires completed by clients.';
