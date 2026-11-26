INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brand-banners',
  'brand-banners',
  true,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public brand banner access" ON storage.objects;
DROP POLICY IF EXISTS "Workspace members upload brand banners" ON storage.objects;
DROP POLICY IF EXISTS "Workspace members update brand banners" ON storage.objects;
DROP POLICY IF EXISTS "Workspace members delete brand banners" ON storage.objects;

CREATE POLICY "Public brand banner access" ON storage.objects
FOR SELECT USING (bucket_id = 'brand-banners');

CREATE POLICY "Workspace members upload brand banners" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'brand-banners' AND public.can_access_workspace_object(name));

CREATE POLICY "Workspace members update brand banners" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'brand-banners' AND public.can_access_workspace_object(name))
WITH CHECK (bucket_id = 'brand-banners' AND public.can_access_workspace_object(name));

CREATE POLICY "Workspace members delete brand banners" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'brand-banners' AND public.can_access_workspace_object(name));
