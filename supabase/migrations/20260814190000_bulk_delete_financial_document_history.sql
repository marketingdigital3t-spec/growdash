-- Allow finance managers to remove selected history rows or every invoice
-- record in their own workspace, including stored image attachments.
CREATE OR REPLACE FUNCTION public.delete_financial_document_history(
  p_workspace_id uuid,
  p_ids uuid[] DEFAULT NULL,
  p_delete_all_invoices boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  removed_count integer := 0;
BEGIN
  IF NOT public.can_manage_finance(p_workspace_id) THEN
    RAISE EXCEPTION 'Sem permissão para remover documentos financeiros' USING ERRCODE = '42501';
  END IF;

  WITH targets AS (
    SELECT id, nullif(document->>'attachmentPath', '') AS attachment_path
    FROM public.financial_document_history
    WHERE workspace_id = p_workspace_id
      AND (
        (p_delete_all_invoices IS TRUE AND document_type = 'invoice')
        OR (p_delete_all_invoices IS FALSE AND id = ANY(coalesce(p_ids, ARRAY[]::uuid[])))
      )
  ), removed_files AS (
    DELETE FROM storage.objects
    WHERE bucket_id = 'invoice-attachments'
      AND name IN (SELECT attachment_path FROM targets WHERE attachment_path IS NOT NULL)
  ), deleted AS (
    DELETE FROM public.financial_document_history
    WHERE id IN (SELECT id FROM targets)
    RETURNING 1
  )
  SELECT count(*) INTO removed_count FROM deleted;

  RETURN removed_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_financial_document_history(uuid, uuid[], boolean) TO authenticated;
