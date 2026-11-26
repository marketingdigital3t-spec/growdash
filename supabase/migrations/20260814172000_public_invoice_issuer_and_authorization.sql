-- The public form mirrors the editable internal invoice form. The recipient
-- may fill issuer details and the authorization responsible; the resulting
-- values are retained only in the submitted history record.

DROP FUNCTION IF EXISTS public.submit_public_finance_invoice_form(
  uuid, text, text, text, text, text, numeric, text, text, text
);
DROP FUNCTION IF EXISTS public.submit_public_finance_invoice_form(
  uuid, text, text, text, text, text, text, text, numeric, text, text, text, text
);

CREATE OR REPLACE FUNCTION public.submit_public_finance_invoice_form(
  p_token uuid,
  p_issuer_name text,
  p_issuer_document text,
  p_customer_name text,
  p_customer_document text,
  p_customer_email text,
  p_customer_address text,
  p_description text,
  p_amount numeric,
  p_notes text DEFAULT NULL,
  p_authorization text DEFAULT NULL,
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
    'issuerName', left(trim(coalesce(p_issuer_name, link_row.document->>'issuerName', '')), 180),
    'issuerDocument', left(trim(coalesce(p_issuer_document, link_row.document->>'issuerDocument', '')), 32),
    'customerName', left(trim(p_customer_name), 180),
    'customerDocument', left(trim(p_customer_document), 32),
    'customerEmail', '',
    'customerAddress', left(trim(coalesce(p_customer_address, '')), 500),
    'description', left(trim(coalesce(p_description, link_row.document->>'description', '')), 2000),
    'amount', p_amount::text,
    'notes', left(trim(coalesce(p_notes, '')), 2000),
    'authorization', left(trim(coalesce(p_authorization, link_row.document->>'authorization', '')), 180),
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

GRANT EXECUTE ON FUNCTION public.submit_public_finance_invoice_form(
  uuid, text, text, text, text, text, text, text, numeric, text, text, text, text
) TO anon, authenticated;
