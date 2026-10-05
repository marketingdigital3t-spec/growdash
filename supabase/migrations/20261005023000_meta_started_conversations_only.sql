-- Rebuild canonical lead columns only where a complete action snapshot is
-- explicitly confirmed in meta_sync_scope_state. This keeps the last valid
-- snapshot when actions are absent, partial, or still processing. Generic
-- `lead`/`omni_lead` aggregates are never classified as form or site events.
-- Account-level site-event configuration is counted only for an ad set whose
-- persisted Meta destination is explicitly WEBSITE. Unknown/ON_AD destinations
-- fail closed to avoid counting residual pixel events as website leads.
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
    'onsite_conversion.lead', 'leadgen.other', 'omni_lead', 'lead',
    'offsite_conversion.fb_pixel_lead', 'offsite_conversion.lead',
    'onsite_conversion.messaging_conversation_started_7d',
    'onsite_conversion.messaging_conversation_started_28d',
    'onsite_conversion.messaging_conversation_started_7d_click',
    'onsite_conversion.messaging_conversation_started_1d_view',
    'onsite_conversion.messaging_conversation_started',
    'messaging_conversation_started_7d', 'messaging_conversation_started',
    'onsite_conversion.total_messaging_connection', 'total_messaging_connection',
    'onsite_conversion.messaging_conversation_replied_7d'
  )
), action_maps AS (
  SELECT
    ad_account_id, ad_id, date, attribution_window,
    jsonb_object_agg(action_type, value) AS actions
  FROM ranked_actions
  WHERE row_number = 1
  GROUP BY ad_account_id, ad_id, date, attribution_window
), resolved AS (
  SELECT
    i.ad_account_id,
    i.ad_id,
    i.campaign_id,
    i.date,
    COALESCE(i.attribution_window, 'account_default') AS attribution_window,
    COALESCE(action_maps.actions, '{}'::jsonb) AS actions,
    config.action_type AS account_site_action,
    CASE WHEN UPPER(COALESCE(adset.destination_type, '')) = 'WEBSITE'
      THEN config.action_type ELSE NULL END AS configured_site_action,
    adset.destination_type AS destination_type,
    (
      adset.destination_type IS NOT NULL
      OR (
        (config.action_type IS NULL OR NOT (COALESCE(action_maps.actions, '{}'::jsonb) ? config.action_type))
        AND NOT (COALESCE(action_maps.actions, '{}'::jsonb) ?| ARRAY[
          'onsite_conversion.messaging_conversation_started_7d',
          'onsite_conversion.messaging_conversation_started_28d',
          'onsite_conversion.messaging_conversation_started_7d_click',
          'onsite_conversion.messaging_conversation_started_1d_view',
          'onsite_conversion.messaging_conversation_started',
          'messaging_conversation_started_7d', 'messaging_conversation_started'
        ])
      )
    ) AS destination_classification_complete,
    COALESCE(i.spend, 0) AS spend,
    COALESCE(i.clicks, 0) AS clicks,
    COALESCE(i.impressions, 0) AS impressions,
    CASE WHEN UPPER(COALESCE(adset.destination_type, '')) IN (
      'MESSENGER', 'WHATSAPP', 'INSTAGRAM_DIRECT',
      'MESSAGING_INSTAGRAM_DIRECT', 'MESSAGING_MESSENGER', 'MESSAGING_WHATSAPP'
    ) THEN GREATEST(0, COALESCE((
      SELECT (COALESCE(action_maps.actions, '{}'::jsonb)->>alias)::numeric
      FROM unnest(ARRAY[
        'onsite_conversion.messaging_conversation_started_7d',
        'onsite_conversion.messaging_conversation_started_28d',
        'onsite_conversion.messaging_conversation_started_7d_click',
        'onsite_conversion.messaging_conversation_started_1d_view',
        'onsite_conversion.messaging_conversation_started',
        'messaging_conversation_started_7d', 'messaging_conversation_started'
      ]) WITH ORDINALITY AS aliases(alias, priority)
      WHERE COALESCE(action_maps.actions, '{}'::jsonb) ? alias
      ORDER BY priority
      LIMIT 1
    ), 0)) ELSE 0 END AS conversations,
    GREATEST(0, COALESCE((
      SELECT (COALESCE(action_maps.actions, '{}'::jsonb)->>alias)::numeric
      FROM unnest(ARRAY[
        'onsite_conversion.lead_grouped', 'leadgen_grouped',
        'onsite_conversion.lead', 'leadgen.other'
      ]) WITH ORDINALITY AS aliases(alias, priority)
      WHERE COALESCE(action_maps.actions, '{}'::jsonb) ? alias
      ORDER BY priority
      LIMIT 1
    ), 0)) AS forms,
    CASE
      WHEN UPPER(COALESCE(adset.destination_type, '')) = 'WEBSITE'
        AND config.action_type IS NOT NULL
        AND config.action_type NOT IN (
          'onsite_conversion.lead_grouped', 'leadgen_grouped',
          'onsite_conversion.lead', 'leadgen.other', 'omni_lead', 'lead'
        )
        AND COALESCE(action_maps.actions, '{}'::jsonb) ? config.action_type
      THEN GREATEST(0, COALESCE((action_maps.actions->>config.action_type)::numeric, 0))
      ELSE 0
    END AS site
  FROM public.insights i
  LEFT JOIN action_maps
    ON action_maps.ad_account_id = i.ad_account_id
    AND action_maps.ad_id = i.ad_id
    AND action_maps.date = i.date
    AND action_maps.attribution_window = COALESCE(i.attribution_window, 'account_default')
  LEFT JOIN public.account_lp_config config ON config.ad_account_id = i.ad_account_id
  LEFT JOIN public.ads ad ON ad.id = i.ad_id
  LEFT JOIN public.adsets adset ON adset.id = ad.adset_id
)
UPDATE public.insights i
SET
  form_leads = resolved.forms,
  site_leads = resolved.site,
  conversations = resolved.conversations,
  leads = resolved.forms + resolved.site + resolved.conversations,
  cpl = CASE WHEN resolved.forms + resolved.site + resolved.conversations > 0
    THEN resolved.spend / (resolved.forms + resolved.site + resolved.conversations) ELSE 0 END,
  conversion_rate = CASE WHEN resolved.clicks > 0
    THEN ((resolved.forms + resolved.site + resolved.conversations) / resolved.clicks) * 100 ELSE 0 END,
  efficiency_rate = CASE WHEN resolved.impressions > 0
    THEN ((resolved.forms + resolved.site + resolved.conversations) / resolved.impressions) * 100 ELSE 0 END
FROM resolved
WHERE i.ad_account_id = resolved.ad_account_id
  AND i.ad_id = resolved.ad_id
  AND i.date = resolved.date
  AND COALESCE(i.attribution_window, 'account_default') = resolved.attribution_window
  AND resolved.destination_classification_complete
  AND EXISTS (
    SELECT 1
    FROM public.meta_sync_scope_state coverage
    JOIN public.ad_accounts account ON account.id = coverage.ad_account_id
    WHERE coverage.ad_account_id = resolved.ad_account_id
      AND coverage.start_date <= resolved.date
      AND coverage.end_date >= resolved.date
      AND coverage.timezone = COALESCE(account.timezone_name, 'America/Sao_Paulo')
      AND COALESCE(coverage.attribution_window, 'account_default') = resolved.attribution_window
      AND COALESCE(coverage.block_status->'actions'->>'status', '') = 'fresh'
      AND coverage.block_status->'actions'->>'evidenceVersion' = '2'
      AND coverage.block_status->'actions'->>'persistenceVerified' = 'true'
      AND coverage.block_status->'actions'->>'responseComplete' = 'true'
      AND (
        COALESCE((coverage.block_status->'actions'->>'sourceInsightRows')::integer, 0) > 0
        OR coverage.block_status->'actions'->>'zeroResultConfirmed' = 'true'
      )
      AND coverage.block_status->'actions'->>'allActionRowsPersisted'
        = coverage.block_status->'actions'->>'allActionRowsExpected'
      AND (
        coverage.campaign_scope = 'all-campaigns'
        OR (',' || coverage.campaign_scope || ',') LIKE '%,' || resolved.campaign_id || ',%'
      )
  )
  -- Do not overwrite a valid prior site-lead snapshot when the configured
  -- account has a site event but catalog destination data is missing.
  AND (
    resolved.account_site_action IS NULL
    OR resolved.account_site_action IN (
      'onsite_conversion.lead_grouped', 'leadgen_grouped',
      'onsite_conversion.lead', 'leadgen.other', 'omni_lead', 'lead'
    )
    OR resolved.destination_type IS NOT NULL
  );

COMMENT ON COLUMN public.insights.conversations IS
  'Canonical Meta conversations started; total messaging connections and replies are diagnostic-only actions.';
