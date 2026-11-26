-- Keep auth lookups stable for the duration of a statement.
-- This preserves the policy predicates while avoiding one auth.uid() call per row.
DO $$
DECLARE
  policy_row record;
  using_expr text;
  check_expr text;
  statement text;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        coalesce(qual, '') LIKE '%auth.uid()%'
        OR coalesce(with_check, '') LIKE '%auth.uid()%'
      )
  LOOP
    using_expr := CASE
      WHEN policy_row.qual IS NULL THEN NULL
      ELSE replace(policy_row.qual, 'auth.uid()', '(select auth.uid())')
    END;
    check_expr := CASE
      WHEN policy_row.with_check IS NULL THEN NULL
      ELSE replace(policy_row.with_check, 'auth.uid()', '(select auth.uid())')
    END;

    statement := format(
      'ALTER POLICY %I ON %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );

    IF using_expr IS NOT NULL THEN
      statement := statement || format(' USING (%s)', using_expr);
    END IF;
    IF check_expr IS NOT NULL THEN
      statement := statement || format(' WITH CHECK (%s)', check_expr);
    END IF;

    EXECUTE statement;
  END LOOP;
END
$$;
