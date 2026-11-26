-- Turmas personalizadas não possuem conta Meta nem funil RD.
-- O vínculo de segurança delas é o usuário que as criou.

DROP POLICY IF EXISTS "View event_classes" ON public.event_classes;
DROP POLICY IF EXISTS "Insert event_classes" ON public.event_classes;
DROP POLICY IF EXISTS "Update event_classes" ON public.event_classes;
DROP POLICY IF EXISTS "Delete event_classes" ON public.event_classes;

CREATE POLICY "View event_classes" ON public.event_classes FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (auth.uid() = user_id AND ad_account_id IS NULL)
    OR (ad_account_id IS NOT NULL AND public.user_owns_ad_account(auth.uid(), ad_account_id))
  );

CREATE POLICY "Insert event_classes" ON public.event_classes FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (
      auth.uid() = user_id
      AND (ad_account_id IS NULL OR public.user_owns_ad_account(auth.uid(), ad_account_id))
    )
  );

CREATE POLICY "Update event_classes" ON public.event_classes FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (auth.uid() = user_id AND ad_account_id IS NULL)
    OR (ad_account_id IS NOT NULL AND public.user_owns_ad_account(auth.uid(), ad_account_id))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (
      auth.uid() = user_id
      AND (ad_account_id IS NULL OR public.user_owns_ad_account(auth.uid(), ad_account_id))
    )
  );

CREATE POLICY "Delete event_classes" ON public.event_classes FOR DELETE
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (auth.uid() = user_id AND ad_account_id IS NULL)
    OR (ad_account_id IS NOT NULL AND public.user_owns_ad_account(auth.uid(), ad_account_id))
  );

DROP POLICY IF EXISTS "View event_class_members" ON public.event_class_members;
DROP POLICY IF EXISTS "Insert event_class_members" ON public.event_class_members;
DROP POLICY IF EXISTS "Update event_class_members" ON public.event_class_members;
DROP POLICY IF EXISTS "Delete event_class_members" ON public.event_class_members;

CREATE POLICY "View event_class_members" ON public.event_class_members FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.event_classes ec
    WHERE ec.id = event_class_id
      AND (
        public.has_role(auth.uid(), 'admin')
        OR (ec.user_id = auth.uid() AND ec.ad_account_id IS NULL)
        OR (ec.ad_account_id IS NOT NULL AND public.user_owns_ad_account(auth.uid(), ec.ad_account_id))
      )
  ));

CREATE POLICY "Insert event_class_members" ON public.event_class_members FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.event_classes ec
    WHERE ec.id = event_class_id
      AND (
        public.has_role(auth.uid(), 'admin')
        OR (ec.user_id = auth.uid() AND ec.ad_account_id IS NULL)
        OR (ec.ad_account_id IS NOT NULL AND public.user_owns_ad_account(auth.uid(), ec.ad_account_id))
      )
  ));

CREATE POLICY "Update event_class_members" ON public.event_class_members FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.event_classes ec
    WHERE ec.id = event_class_id
      AND (
        public.has_role(auth.uid(), 'admin')
        OR (ec.user_id = auth.uid() AND ec.ad_account_id IS NULL)
        OR (ec.ad_account_id IS NOT NULL AND public.user_owns_ad_account(auth.uid(), ec.ad_account_id))
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.event_classes ec
    WHERE ec.id = event_class_id
      AND (
        public.has_role(auth.uid(), 'admin')
        OR (ec.user_id = auth.uid() AND ec.ad_account_id IS NULL)
        OR (ec.ad_account_id IS NOT NULL AND public.user_owns_ad_account(auth.uid(), ec.ad_account_id))
      )
  ));

CREATE POLICY "Delete event_class_members" ON public.event_class_members FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.event_classes ec
    WHERE ec.id = event_class_id
      AND (
        public.has_role(auth.uid(), 'admin')
        OR (ec.user_id = auth.uid() AND ec.ad_account_id IS NULL)
        OR (ec.ad_account_id IS NOT NULL AND public.user_owns_ad_account(auth.uid(), ec.ad_account_id))
      )
  ));

DROP POLICY IF EXISTS "View event_class_history" ON public.event_class_history;
DROP POLICY IF EXISTS "Insert event_class_history" ON public.event_class_history;

CREATE POLICY "View event_class_history" ON public.event_class_history FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.event_classes ec
    WHERE ec.id = event_class_id
      AND (
        public.has_role(auth.uid(), 'admin')
        OR (ec.user_id = auth.uid() AND ec.ad_account_id IS NULL)
        OR (ec.ad_account_id IS NOT NULL AND public.user_owns_ad_account(auth.uid(), ec.ad_account_id))
      )
  ));

CREATE POLICY "Insert event_class_history" ON public.event_class_history FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.event_classes ec
    WHERE ec.id = event_class_id
      AND (
        public.has_role(auth.uid(), 'admin')
        OR (ec.user_id = auth.uid() AND ec.ad_account_id IS NULL)
        OR (ec.ad_account_id IS NOT NULL AND public.user_owns_ad_account(auth.uid(), ec.ad_account_id))
      )
  ));
