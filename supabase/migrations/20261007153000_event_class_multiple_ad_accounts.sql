-- A turma pode ser alimentada por mais de uma conta de anúncio.
CREATE TABLE IF NOT EXISTS public.event_class_accounts (
  event_class_id uuid NOT NULL REFERENCES public.event_classes(id) ON DELETE CASCADE,
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_class_id, ad_account_id)
);

CREATE INDEX IF NOT EXISTS event_class_accounts_account_idx
  ON public.event_class_accounts (ad_account_id, event_class_id);

ALTER TABLE public.event_class_accounts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.event_class_accounts TO authenticated;
GRANT ALL ON public.event_class_accounts TO service_role;

DROP POLICY IF EXISTS "View event_class_accounts" ON public.event_class_accounts;
CREATE POLICY "View event_class_accounts" ON public.event_class_accounts FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.event_classes ec WHERE ec.id = event_class_id AND (ec.user_id = auth.uid() OR public.user_owns_ad_account(auth.uid(), ad_account_id)))
  );

DROP POLICY IF EXISTS "Insert event_class_accounts" ON public.event_class_accounts;
CREATE POLICY "Insert event_class_accounts" ON public.event_class_accounts FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.event_classes ec WHERE ec.id = event_class_id AND ec.user_id = auth.uid())
      AND public.user_owns_ad_account(auth.uid(), ad_account_id)
  );

DROP POLICY IF EXISTS "Delete event_class_accounts" ON public.event_class_accounts;
CREATE POLICY "Delete event_class_accounts" ON public.event_class_accounts FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.event_classes ec WHERE ec.id = event_class_id AND ec.user_id = auth.uid())
  );

-- Preserve the existing single-account relationship as the first relationship.
INSERT INTO public.event_class_accounts (event_class_id, ad_account_id)
SELECT id, ad_account_id
FROM public.event_classes
WHERE ad_account_id IS NOT NULL
ON CONFLICT DO NOTHING;
