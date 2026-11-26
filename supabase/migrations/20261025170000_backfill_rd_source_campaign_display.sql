-- Preserve source/campaign metadata that RD already returned in the raw deal.
-- These fields are display metadata; Meta attribution remains canonical and is
-- only populated by a verified meta_leads match.
UPDATE public.rd_deals
SET
  source = COALESCE(
    NULLIF(source, ''),
    NULLIF(raw -> 'deal_source' ->> 'name', ''),
    NULLIF(raw ->> 'deal_source', ''),
    NULLIF(raw -> 'source' ->> 'name', ''),
    NULLIF(raw ->> 'source', '')
  ),
  campaign = COALESCE(
    NULLIF(campaign, ''),
    NULLIF(raw -> 'campaign' ->> 'name', ''),
    NULLIF(raw ->> 'campaign', '')
  )
WHERE raw IS NOT NULL
  AND (NULLIF(source, '') IS NULL OR NULLIF(campaign, '') IS NULL);
