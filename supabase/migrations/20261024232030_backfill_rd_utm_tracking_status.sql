-- Complete the status for rows backfilled from provider UTM fields. Keep
-- native and manually attributed rows untouched.
UPDATE public.rd_deals
SET meta_attribution_status = 'partial'
WHERE meta_attribution_method = 'rd_utm_fields'
  AND coalesce(NULLIF(btrim(meta_attribution_status), ''), '') = '';
