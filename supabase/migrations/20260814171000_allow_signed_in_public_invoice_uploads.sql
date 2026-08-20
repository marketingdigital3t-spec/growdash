-- A recipient can open the public link in a browser that is already signed in
-- to Growdash. Keep the same token-scoped rule for both anon and authenticated
-- storage roles.

DROP POLICY IF EXISTS "Public form uploads invoice attachment" ON storage.objects;
CREATE POLICY "Public form uploads invoice attachment"
ON storage.objects FOR INSERT TO anon, authenticated
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
