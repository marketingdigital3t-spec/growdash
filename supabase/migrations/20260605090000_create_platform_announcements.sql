CREATE TABLE IF NOT EXISTS public.platform_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_data_url text NOT NULL,
  alt text NOT NULL DEFAULT 'Anúncio Trackvio',
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_announcements_single_active_idx
  ON public.platform_announcements (active)
  WHERE active = true;

ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read active announcements" ON public.platform_announcements;
CREATE POLICY "Authenticated users can read active announcements"
ON public.platform_announcements
FOR SELECT
TO authenticated
USING (active = true OR public.is_master(auth.uid()));

DROP POLICY IF EXISTS "Only masters can create announcements" ON public.platform_announcements;
CREATE POLICY "Only masters can create announcements"
ON public.platform_announcements
FOR INSERT
TO authenticated
WITH CHECK (public.is_master(auth.uid()));

DROP POLICY IF EXISTS "Only masters can update announcements" ON public.platform_announcements;
CREATE POLICY "Only masters can update announcements"
ON public.platform_announcements
FOR UPDATE
TO authenticated
USING (public.is_master(auth.uid()))
WITH CHECK (public.is_master(auth.uid()));

DROP POLICY IF EXISTS "Only masters can delete announcements" ON public.platform_announcements;
CREATE POLICY "Only masters can delete announcements"
ON public.platform_announcements
FOR DELETE
TO authenticated
USING (public.is_master(auth.uid()));
