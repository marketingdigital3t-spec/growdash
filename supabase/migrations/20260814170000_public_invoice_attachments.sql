-- Private image attachments for one-time public invoice forms.
-- The bearer token only authorizes one upload while its matching form is active;
-- workspace members retrieve stored attachments through signed URLs.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoice-attachments',
  'invoice-attachments',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP FUNCTION IF EXISTS public.submit_public_finance_invoice_form(uuid, text, text, text, text, text, numeric, text);

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

  IF NOT FOUND THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'document_type', link_row.document_type,
    'document_number', link_row.document_number,
    'issue_date', link_row.document->>'issueDate',
    'issuer_name', link_row.document->>'issuerName',
    'issuer_document', link_row.document->>'issuerDocument',
    'description', link_row.document->>'description',
    'amount', link_row.amount
  );
END;
$$;

DROP POLICY IF EXISTS "Public form uploads invoice attachment" ON storage.objects;
CREATE POLICY "Public form uploads invoice attachment"
ON storage.objects FOR INSERT TO anon
WITH CHECK (
  bucket_id = 'invoice-attachments'
  AND split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND lower(coalesce(storage.extension(name), '')) IN ('jpg', 'jpeg', 'png', 'webp')
  AND EXISTS (
    SELECT 1
    FROM public.financial_document_history history
    WHERE history.share_token::text = split_part(name, '/', 1)
      AND history.action = 'share_created'
      AND history.submitted_at IS NULL
      AND history.share_expires_at > now()
  )
);

DROP POLICY IF EXISTS "Finance members read invoice attachments" ON storage.objects;
CREATE POLICY "Finance members read invoice attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'invoice-attachments'
  AND EXISTS (
    SELECT 1
    FROM public.financial_document_history history
    WHERE history.share_token::text = split_part(name, '/', 1)
      AND public.is_workspace_member(history.workspace_id)
  )
);

DROP POLICY IF EXISTS "Finance managers delete finance documents" ON public.financial_document_history;
CREATE POLICY "Finance managers delete finance documents"
ON public.financial_document_history FOR DELETE TO authenticated
USING (public.can_manage_finance(workspace_id));

DROP POLICY IF EXISTS "Finance managers delete invoice attachments" ON storage.objects;
CREATE POLICY "Finance managers delete invoice attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'invoice-attachments'
  AND EXISTS (
    SELECT 1 FROM public.financial_document_history history
    WHERE history.share_token::text = split_part(name, '/', 1)
      AND public.can_manage_finance(history.workspace_id)
  )
);

CREATE OR REPLACE FUNCTION public.submit_public_finance_invoice_form(
  p_token uuid,
  p_customer_name text,
  p_customer_document text,
  p_customer_email text,
  p_customer_address text,
  p_description text,
  p_amount numeric,
  p_notes text DEFAULT NULL,
  p_attachment_path text DEFAULT NULL,
  p_attachment_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  link_row public.financial_document_history%ROWTYPE;
  submission_id uuid;
  submitted_document jsonb;
  safe_attachment_path text := nullif(trim(coalesce(p_attachment_path, '')), '');
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

  IF safe_attachment_path IS NOT NULL AND (
    safe_attachment_path !~ ('^' || p_token::text || '/[^/]+$')
    OR NOT EXISTS (
      SELECT 1 FROM storage.objects
      WHERE bucket_id = 'invoice-attachments' AND name = safe_attachment_path
    )
  ) THEN
    RAISE EXCEPTION 'Anexo inválido' USING ERRCODE = '22023';
  END IF;

  submitted_document := link_row.document || jsonb_build_object(
    'customerName', left(trim(p_customer_name), 180),
    'customerDocument', left(trim(p_customer_document), 32),
    'customerEmail', left(trim(coalesce(p_customer_email, '')), 254),
    'customerAddress', left(trim(coalesce(p_customer_address, '')), 500),
    'description', left(trim(coalesce(p_description, link_row.document->>'description', '')), 2000),
    'amount', p_amount::text,
    'notes', left(trim(coalesce(p_notes, '')), 2000),
    'attachmentPath', safe_attachment_path,
    'attachmentName', left(trim(coalesce(p_attachment_name, '')), 180)
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

GRANT EXECUTE ON FUNCTION public.submit_public_finance_invoice_form(uuid, text, text, text, text, text, numeric, text, text, text) TO anon, authenticated;
