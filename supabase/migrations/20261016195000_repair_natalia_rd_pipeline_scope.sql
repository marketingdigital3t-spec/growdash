-- Repair the duplicated RD mapping for Natália's CA01.
--
-- The provider pipeline is the same in both local rows and both RD
-- connections use the same token.  The active row was attached to the
-- deactivated Meta account (act_1003446834892051), while the correct CA01
-- (act_2836556270048145) was left inactive with only a 41-row duplicate
-- snapshot.  Keep the larger, stage-complete snapshot as the canonical local
-- row, remove only provider IDs proven to be duplicated, and move the
-- canonical row to the correct connection/account.

DO $$
DECLARE
  v_user_id uuid := '18dd6ba7-0acd-421e-881d-7d14fc654dc9';
  v_workspace_id uuid := '2857f2d3-6d27-4f3b-b317-7e9eb856eb6d';
  v_account_id uuid := '1908662f-dd94-46dd-bb13-bdc03d2c5a94';
  v_pipeline_id text := '6a99c43d8dc539002e2bf284';
  v_active_funnel uuid := 'b0fef243-2166-4569-a8eb-d455a0c970d4';
  v_duplicate_funnel uuid := '752149cf-796e-4a65-ac84-4964fb98c175';
  v_correct_connection uuid := '09df4480-dcef-49b1-9c52-a6031f143f5e';
  v_old_connection uuid := '88478d5f-dae3-40c2-9ece-838337042691';
  v_duplicate_count bigint;
  v_old_only_count bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM public.ad_accounts
     WHERE id = v_account_id
       AND user_id = v_user_id
       AND workspace_id = v_workspace_id
       AND account_id = 'act_2836556270048145'
  ) THEN
    RAISE EXCEPTION 'CA01 Natália Meta account is not the expected workspace account';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.rd_account_connections
     WHERE id = v_correct_connection
       AND user_id = v_user_id
       AND workspace_id = v_workspace_id
       AND external_account_id = 'act_2836556270048145'
  ) THEN
    RAISE EXCEPTION 'Correct CA01 RD connection is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.rd_account_connections
     WHERE id = v_old_connection
       AND user_id = v_user_id
       AND workspace_id = v_workspace_id
       AND external_account_id = 'act_1003446834892051'
  ) THEN
    RAISE EXCEPTION 'Legacy Natália RD connection is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.rd_funnels
     WHERE id = v_active_funnel
       AND user_id = v_user_id
       AND rd_funnel_id = v_pipeline_id
  ) OR NOT EXISTS (
    SELECT 1
      FROM public.rd_funnels
     WHERE id = v_duplicate_funnel
       AND user_id = v_user_id
       AND rd_funnel_id = v_pipeline_id
  ) THEN
    RAISE EXCEPTION 'Expected duplicated Natália RD funnel mappings are missing';
  END IF;

  -- Do not silently discard a unique deal from the inactive mapping.  The
  -- audit showed this is zero; failing closed protects future re-runs if the
  -- source state changes before deployment.
  SELECT count(*)
    INTO v_old_only_count
    FROM public.rd_deals duplicate
   WHERE duplicate.rd_funnel_id = v_duplicate_funnel
     AND NOT EXISTS (
       SELECT 1
         FROM public.rd_deals canonical
        WHERE canonical.rd_funnel_id = v_active_funnel
          AND canonical.rd_deal_id = duplicate.rd_deal_id
     );
  IF v_old_only_count <> 0 THEN
    RAISE EXCEPTION 'Inactive mapping contains % provider deals without canonical copies', v_old_only_count;
  END IF;

  SELECT count(*)
    INTO v_duplicate_count
    FROM public.rd_deals duplicate
   WHERE duplicate.rd_funnel_id = v_duplicate_funnel
     AND EXISTS (
       SELECT 1
         FROM public.rd_deals canonical
        WHERE canonical.rd_funnel_id = v_active_funnel
          AND canonical.rd_deal_id = duplicate.rd_deal_id
     );

  -- The duplicate rows are provider-identical copies.  Delete them before
  -- changing the canonical connection so the regular unique identity
  -- constraint (rd_connection_id, rd_deal_id) cannot be violated.
  DELETE FROM public.rd_deals duplicate
   USING public.rd_deals canonical
   WHERE duplicate.rd_funnel_id = v_duplicate_funnel
     AND canonical.rd_funnel_id = v_active_funnel
     AND canonical.rd_deal_id = duplicate.rd_deal_id
     AND duplicate.id <> canonical.id;

  -- Keep any sale metadata attached to the canonical funnel.  The duplicate
  -- snapshot has no sales rows today, but this makes the repair safe if a
  -- prior reconciliation attached one there.
  UPDATE public.sales
     SET rd_funnel_id = v_active_funnel,
         ad_account_id = v_account_id,
         workspace_id = coalesce(workspace_id, v_workspace_id),
         updated_at = now()
   WHERE user_id = v_user_id
     AND rd_funnel_id = v_duplicate_funnel;

  -- Only one active local row may represent this provider pipeline.  Keep
  -- the stage-complete row and retain the old association as inactive audit
  -- history rather than exposing a second CRM board.
  UPDATE public.rd_funnels
     SET is_active = false,
         updated_at = now()
   WHERE user_id = v_user_id
     AND rd_funnel_id = v_pipeline_id
     AND id <> v_active_funnel
     AND is_active;

  UPDATE public.rd_funnels
     SET rd_connection_id = v_correct_connection,
         ad_account_id = v_account_id,
         is_active = true,
         updated_at = now()
   WHERE id = v_active_funnel
     AND user_id = v_user_id
     AND rd_funnel_id = v_pipeline_id;

  -- Re-home the preserved canonical deals to the correct connection and
  -- account.  Their provider IDs and local row IDs remain unchanged.
  UPDATE public.rd_deals
     SET rd_connection_id = v_correct_connection,
         ad_account_id = v_account_id,
         updated_at = now()
   WHERE user_id = v_user_id
     AND rd_funnel_id = v_active_funnel
     AND (rd_connection_id = v_old_connection OR rd_connection_id IS NULL);

  UPDATE public.sales
     SET ad_account_id = v_account_id,
         workspace_id = coalesce(workspace_id, v_workspace_id),
         updated_at = now()
   WHERE user_id = v_user_id
     AND rd_funnel_id = v_active_funnel
     AND (ad_account_id IS NULL OR ad_account_id = 'ee3c1763-af5a-4bf7-a35b-785edf20bcf5'::uuid);

  RAISE NOTICE 'Repaired Natália RD pipeline: removed % duplicate provider rows', v_duplicate_count;
END
$$;

COMMENT ON TABLE public.rd_funnels IS
  'One active local mapping per provider pipeline; inactive rows are retained as audit history.';
