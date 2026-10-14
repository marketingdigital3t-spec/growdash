-- Registro mínimo de aceite dos documentos públicos.
CREATE TABLE IF NOT EXISTS public.legal_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  terms_version text NOT NULL,
  privacy_version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, terms_version, privacy_version)
);

CREATE INDEX IF NOT EXISTS idx_legal_consents_user_date
  ON public.legal_consents (user_id, accepted_at DESC);

ALTER TABLE public.legal_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own legal consents" ON public.legal_consents
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.record_legal_consent(
  _terms_version text,
  _privacy_version text
)
RETURNS public.legal_consents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.legal_consents;
  _workspace_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF _terms_version IS NULL OR _privacy_version IS NULL THEN RAISE EXCEPTION 'legal versions required'; END IF;
  SELECT public.ensure_current_workspace() INTO _workspace_id;
  INSERT INTO public.legal_consents (user_id, workspace_id, terms_version, privacy_version)
  VALUES (auth.uid(), _workspace_id, _terms_version, _privacy_version)
  ON CONFLICT (user_id, terms_version, privacy_version)
  DO NOTHING;
  SELECT * INTO _row
  FROM public.legal_consents
  WHERE user_id = auth.uid()
    AND terms_version = _terms_version
    AND privacy_version = _privacy_version;
  RETURN _row;
END;
$$;

GRANT SELECT ON public.legal_consents TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_legal_consent(text, text) TO authenticated;
