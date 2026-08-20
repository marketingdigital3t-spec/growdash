-- Audit trail for operational PDF documents and public invoice-data forms.
-- A public bearer link is intentionally limited to one pending form and never
-- grants access to the workspace or to the document history itself.

CREATE TABLE IF NOT EXISTS public.financial_document_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  related_id uuid REFERENCES public.financial_document_history(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('generated', 'share_created', 'submitted')),
  document_type text NOT NULL,
  document_number text,
  amount numeric(14,2),
  document jsonb NOT NULL DEFAULT '{}'::jsonb,
  share_token uuid UNIQUE,
  share_expires_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS financial_document_history_workspace_created_idx
  ON public.financial_document_history(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS financial_document_history_share_token_idx
  ON public.financial_document_history(share_token)
  WHERE share_token IS NOT NULL;

ALTER TABLE public.financial_document_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read finance document history"
  ON public.financial_document_history FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Finance managers add document history"
  ON public.financial_document_history FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_finance(workspace_id) AND created_by = auth.uid());

CREATE POLICY "Finance managers update document history"
  ON public.financial_document_history FOR UPDATE TO authenticated
  USING (public.can_manage_finance(workspace_id))
  WITH CHECK (public.can_manage_finance(workspace_id));

GRANT SELECT, INSERT, UPDATE ON public.financial_document_history TO authenticated;

CREATE OR REPLACE FUNCTION public.get_public_finance_invoice_form(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link_row public.financial_document_history%ROWTYPE;
BEGIN
  SELECT * INTO link_row
  FROM public.financial_document_history
  WHERE share_token = p_token
    AND action = 'share_created'
    AND submitted_at IS NULL
    AND share_expires_at > now();

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Return only the fields useful to the person completing the form.
  RETURN jsonb_build_object(
    'document_type', link_row.document_type,
    'document_number', link_row.document_number,
    'issue_date', link_row.document->>'issueDate',
    'description', link_row.document->>'description',
    'amount', link_row.amount
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_public_finance_invoice_form(
  p_token uuid,
  p_customer_name text,
  p_customer_document text,
  p_customer_email text,
  p_customer_address text,
  p_description text,
  p_amount numeric,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link_row public.financial_document_history%ROWTYPE;
  submission_id uuid;
  submitted_document jsonb;
BEGIN
  SELECT * INTO link_row
  FROM public.financial_document_history
  WHERE share_token = p_token
    AND action = 'share_created'
    AND submitted_at IS NULL
    AND share_expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link indisponível ou expirado' USING ERRCODE = '42501';
  END IF;

  IF char_length(trim(coalesce(p_customer_name, ''))) < 2
    OR char_length(trim(coalesce(p_customer_document, ''))) < 5
    OR p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'Dados obrigatórios inválidos' USING ERRCODE = '22023';
  END IF;

  IF p_customer_email IS NOT NULL AND trim(p_customer_email) <> ''
    AND p_customer_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'E-mail inválido' USING ERRCODE = '22023';
  END IF;

  submitted_document := link_row.document || jsonb_build_object(
    'customerName', left(trim(p_customer_name), 180),
    'customerDocument', left(trim(p_customer_document), 32),
    'customerEmail', left(trim(coalesce(p_customer_email, '')), 254),
    'customerAddress', left(trim(coalesce(p_customer_address, '')), 500),
    'description', left(trim(coalesce(p_description, link_row.document->>'description', '')), 2000),
    'amount', p_amount::text,
    'notes', left(trim(coalesce(p_notes, '')), 2000)
  );

  INSERT INTO public.financial_document_history (
    workspace_id, related_id, action, document_type, document_number, amount, document
  ) VALUES (
    link_row.workspace_id, link_row.id, 'submitted', link_row.document_type,
    link_row.document_number, p_amount, submitted_document
  ) RETURNING id INTO submission_id;

  UPDATE public.financial_document_history
     SET submitted_at = now()
   WHERE id = link_row.id;

  RETURN submission_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_finance_invoice_form(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_finance_invoice_form(uuid, text, text, text, text, text, numeric, text) TO anon, authenticated;

COMMENT ON TABLE public.financial_document_history IS
  'Audit history for finance document PDFs and single-use public invoice-data forms.';
