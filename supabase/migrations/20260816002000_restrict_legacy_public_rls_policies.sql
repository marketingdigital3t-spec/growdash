-- Legacy policies were created with TO public and usually also check auth.uid().
-- The check avoids disclosure today, but it still exposes every user-data
-- endpoint to the anonymous database role. No table is intentionally queried
-- by an anonymous client: public links use dedicated token-gated RPCs.
DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND 'public' = ANY(roles)
  LOOP
    EXECUTE format(
      'ALTER POLICY %I ON public.%I TO authenticated',
      policy_record.policyname,
      policy_record.tablename
    );
  END LOOP;
END;
$$;
