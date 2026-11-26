-- Google Workspace OAuth: tokens remain server-only in integrations. Browser
-- tables contain metadata only, scoped to the owner that authorized Google.
CREATE TABLE IF NOT EXISTS public.google_oauth_states (
  state_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.google_drive_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  provider_file_id text NOT NULL,
  name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  web_view_link text,
  modified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (integration_id, provider_file_id)
);

CREATE INDEX IF NOT EXISTS google_drive_files_owner_modified_idx
  ON public.google_drive_files(user_id, modified_at DESC NULLS LAST);

ALTER TABLE public.google_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_drive_files ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.google_oauth_states TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_drive_files TO authenticated;
GRANT ALL ON public.google_drive_files TO service_role;

DROP POLICY IF EXISTS "Users manage own Google Drive file metadata" ON public.google_drive_files;
CREATE POLICY "Users manage own Google Drive file metadata"
  ON public.google_drive_files FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_master(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_master(auth.uid()));

DROP TRIGGER IF EXISTS google_drive_files_updated_at ON public.google_drive_files;
CREATE TRIGGER google_drive_files_updated_at BEFORE UPDATE ON public.google_drive_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.google_drive_files IS
  'Google Drive metadata only. OAuth access and refresh tokens stay in integrations and are never readable by the browser.';
