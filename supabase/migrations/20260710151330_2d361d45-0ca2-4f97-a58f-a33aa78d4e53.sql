DROP POLICY IF EXISTS "owner deletes own private key" ON public.user_private_keys;
CREATE POLICY "owner deletes own private key"
  ON public.user_private_keys
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user deletes own key" ON public.user_keys;
CREATE POLICY "user deletes own key"
  ON public.user_keys
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);