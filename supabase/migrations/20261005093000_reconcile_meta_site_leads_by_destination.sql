-- Reconcile persisted Meta lead components using the same contract as the
-- frontend and Edge Functions. In particular, a pixel/site action is not a
-- site lead unless the account has an explicit site-event configuration and
-- the ad set destination is WEBSITE. Native-form and started-conversation
-- facts remain independent and are never read from insights.leads.
WITH ranked_actions AS (
  SELECT
    ad_account_id,
    ad_id,
    date,
    COALESCE(attribution_window, 'account_default') AS attribution_window,
    action_type,
    GREATEST(0, COALESCE(value, 0)) AS value,
    ROW_NUMBER() OVER (
      PARTITION BY ad_account_id, ad_id, date,
        COALESCE(attribution_window, 'account_default'), action_type
      ORDER BY (attribution_window IS NOT NULL) DESC, COALESCE(value, 0) DESC
    ) AS row_number
  FROM public.insight_actions
  WHERE action_type IN (
    'onsite_conversion.lead_grouped', 'leadgen_grouped',
    'onsite_conversion.lead', 'leadgen.other',
    'offsite_conversion.fb_pixel_lead', 'offsite_conversion.lead',
    'onsite_conversion.messaging_conversation_started_7d',
    'onsite_conversion.messaging_conversation_started_28d',
    'onsite_conversion.messaging_conversation_started_7d_click',
    'onsite_conversion.messaging_conversation_started_1d_view',
    'onsite_conversion.messaging_conversation_started',
    'messaging_conversation_started_7d', 'messaging_conversation_started'
  )
), action_maps AS (
  SELECT ad_account_id, ad_id, date, attribution_window,
    jsonb_object_agg(action_type, value) AS actions
  FROM ranked_actions
  WHERE row_number = 1
  GROUP BY ad_account_id, ad_id, date, attribution_window
), resolved AS (
  SELECT
    i.ad_account_id,
    i.ad_id,
    i.date,
    COALESCE(i.attribution_window, 'account_default') AS attribution_window,
    COALESCE(i.spend, 0) AS spend,
    COALESCE(i.clicks, 0) AS clicks,
    COALESCE(i.impressions, 0) AS impressions,
    COALESCE(i.site_leads, 0) AS persisted_site_leads,
    COALESCE(am.actions, '{}'::jsonb) AS actions,
    cfg.action_type AS configured_site_action,
    UPPER(COALESCE(adset.destination_type, '')) AS destination_type,
    GREATEST(0, COALESCE((
      SELECT (am.actions->>alias)::numeric
      FROM unnest(ARRAY[
        'onsite_conversion.lead_grouped', 'leadgen_grouped',
        'onsite_conversion.lead', 'leadgen.other'
      ]) WITH ORDINALITY AS aliases(alias, priority)
      WHERE am.actions ? alias
      ORDER BY priority
      LIMIT 1
    ), 0)) AS forms,
    GREATEST(0, COALESCE((
      SELECT (am.actions->>cfg.action_type)::numeric
      WHERE cfg.action_type IS NOT NULL
        AND cfg.action_type NOT IN (
          'onsite_conversion.lead_grouped', 'leadgen_grouped',
          'onsite_conversion.lead', 'leadgen.other', 'omni_lead', 'lead'
        )
        AND UPPER(COALESCE(adset.destination_type, '')) = 'WEBSITE'
        AND am.actions ? cfg.action_type
    ), 0)) AS site,
    CASE WHEN UPPER(COALESCE(adset.destination_type, '')) IN (
      'MESSENGER', 'WHATSAPP', 'INSTAGRAM_DIRECT',
      'MESSAGING_INSTAGRAM_DIRECT', 'MESSAGING_MESSENGER', 'MESSAGING_WHATSAPP'
    ) THEN GREATEST(0, COALESCE((
      SELECT (am.actions->>alias)::numeric
      FROM unnest(ARRAY[
        'onsite_conversion.messaging_conversation_started_7d',
        'onsite_conversion.messaging_conversation_started_28d',
        'onsite_conversion.messaging_conversation_started_7d_click',
        'onsite_conversion.messaging_conversation_started_1d_view',
        'onsite_conversion.messaging_conversation_started',
        'messaging_conversation_started_7d', 'messaging_conversation_started'
      ]) WITH ORDINALITY AS aliases(alias, priority)
      WHERE am.actions ? alias
      ORDER BY priority
      LIMIT 1
    ), 0)) ELSE 0 END AS conversations
  FROM public.insights i
  LEFT JOIN action_maps am
    ON am.ad_account_id = i.ad_account_id
    AND am.ad_id = i.ad_id
    AND am.date = i.date
    AND am.attribution_window = COALESCE(i.attribution_window, 'account_default')
  LEFT JOIN public.account_lp_config cfg ON cfg.ad_account_id = i.ad_account_id
  LEFT JOIN public.ads ad ON ad.id = i.ad_id
  LEFT JOIN public.adsets adset ON adset.id = ad.adset_id
), eligible AS (
  SELECT *
  FROM resolved
  WHERE actions <> '{}'::jsonb
    OR (
      persisted_site_leads <> 0
      AND NOT (
        configured_site_action IS NOT NULL
        AND configured_site_action NOT IN (
          'onsite_conversion.lead_grouped', 'leadgen_grouped',
          'onsite_conversion.lead', 'leadgen.other', 'omni_lead', 'lead'
        )
        AND destination_type = 'WEBSITE'
      )
    )
)
UPDATE public.insights i
SET
  form_leads = eligible.forms,
  site_leads = eligible.site,
  conversations = eligible.conversations,
  leads = eligible.forms + eligible.site + eligible.conversations,
  cpl = CASE WHEN eligible.forms + eligible.site + eligible.conversations > 0
    THEN eligible.spend / (eligible.forms + eligible.site + eligible.conversations) ELSE 0 END,
  conversion_rate = CASE WHEN eligible.clicks > 0
    THEN ((eligible.forms + eligible.site + eligible.conversations) / eligible.clicks) * 100 ELSE 0 END,
  efficiency_rate = CASE WHEN eligible.impressions > 0
    THEN ((eligible.forms + eligible.site + eligible.conversations) / eligible.impressions) * 100 ELSE 0 END
FROM eligible
WHERE i.ad_account_id = eligible.ad_account_id
  AND i.ad_id = eligible.ad_id
  AND i.date = eligible.date
  AND COALESCE(i.attribution_window, 'account_default') = eligible.attribution_window;

COMMENT ON COLUMN public.insights.site_leads IS
  'Canonical Meta website leads: configured account event on an ad set with destination WEBSITE; never inferred from raw pixel aliases.';
