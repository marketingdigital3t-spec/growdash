-- Recompute stored Meta lead columns from raw action facts using the same
-- canonical alias precedence as _shared/metaLeadMetrics.ts. Raw actions and
-- all delivery metrics remain untouched. Rows without action snapshots are
-- deliberately preserved rather than rewritten as zero.
WITH action_maps AS (
  SELECT
    ad_id,
    date,
    COALESCE(attribution_window, 'account_default') AS attribution_window,
    jsonb_object_agg(action_type, max_value) AS actions
  FROM (
    SELECT ad_id, date, attribution_window, action_type, MAX(value) AS max_value
    FROM public.insight_actions
    GROUP BY ad_id, date, attribution_window, action_type
  ) grouped
  GROUP BY ad_id, date, COALESCE(attribution_window, 'account_default')
), resolved AS (
  SELECT
    i.ad_id,
    i.date,
    i.attribution_window,
    i.ad_account_id,
    i.spend,
    i.clicks,
    i.impressions,
    action_maps.actions,
    config.action_type AS configured_site_action,
    GREATEST(0, COALESCE(
      CASE
        WHEN action_maps.actions ? 'onsite_conversion.lead_grouped' THEN (action_maps.actions->>'onsite_conversion.lead_grouped')::numeric
        WHEN action_maps.actions ? 'leadgen_grouped' THEN (action_maps.actions->>'leadgen_grouped')::numeric
        WHEN action_maps.actions ? 'onsite_conversion.lead' THEN (action_maps.actions->>'onsite_conversion.lead')::numeric
        WHEN action_maps.actions ? 'leadgen.other' THEN (action_maps.actions->>'leadgen.other')::numeric
        WHEN action_maps.actions ? 'omni_lead' THEN (action_maps.actions->>'omni_lead')::numeric
        WHEN action_maps.actions ? 'lead'
          AND NOT (
            config.action_type IS NOT NULL
            AND config.action_type NOT IN (
              'onsite_conversion.lead_grouped','leadgen_grouped','onsite_conversion.lead',
              'leadgen.other','omni_lead','lead'
            )
            AND action_maps.actions ? config.action_type
          )
          AND NOT (action_maps.actions ?| ARRAY[
            'offsite_conversion.fb_pixel_lead', 'offsite_conversion.lead',
            'onsite_conversion.messaging_conversation_started_7d',
            'onsite_conversion.messaging_conversation_started_28d',
            'onsite_conversion.messaging_conversation_started_7d_click',
            'onsite_conversion.messaging_conversation_started_1d_view',
            'onsite_conversion.messaging_conversation_started',
            'messaging_conversation_started_7d', 'messaging_conversation_started',
            'onsite_conversion.total_messaging_connection', 'total_messaging_connection'
          ]) THEN (action_maps.actions->>'lead')::numeric
        ELSE 0
      END,
      0
    )) AS forms,
    GREATEST(0, COALESCE(
      CASE
        WHEN config.action_type IS NOT NULL
          AND config.action_type NOT IN (
            'onsite_conversion.lead_grouped','leadgen_grouped','onsite_conversion.lead',
            'leadgen.other','omni_lead','lead'
          ) THEN (action_maps.actions->>config.action_type)::numeric
        WHEN action_maps.actions ? 'offsite_conversion.fb_pixel_lead' THEN (action_maps.actions->>'offsite_conversion.fb_pixel_lead')::numeric
        WHEN action_maps.actions ? 'offsite_conversion.lead' THEN (action_maps.actions->>'offsite_conversion.lead')::numeric
        ELSE 0
      END,
      0
    )) AS site,
    GREATEST(0, COALESCE((
      SELECT (action_maps.actions->>alias)::numeric
      FROM unnest(ARRAY[
        'onsite_conversion.messaging_conversation_started_7d',
        'onsite_conversion.messaging_conversation_started_28d',
        'onsite_conversion.messaging_conversation_started_7d_click',
        'onsite_conversion.messaging_conversation_started_1d_view',
        'onsite_conversion.messaging_conversation_started',
        'messaging_conversation_started_7d', 'messaging_conversation_started',
        'onsite_conversion.total_messaging_connection', 'total_messaging_connection'
      ]) WITH ORDINALITY AS aliases(alias, priority)
      WHERE action_maps.actions ? alias
      ORDER BY priority
      LIMIT 1
    ), 0)) AS conversations
  FROM public.insights i
  JOIN action_maps
    ON action_maps.ad_id = i.ad_id
    AND action_maps.date = i.date
    AND action_maps.attribution_window = COALESCE(i.attribution_window, 'account_default')
  LEFT JOIN public.account_lp_config config ON config.ad_account_id = i.ad_account_id
)
UPDATE public.insights i
SET
  form_leads = resolved.forms,
  site_leads = resolved.site,
  conversations = resolved.conversations,
  leads = resolved.forms + resolved.site + resolved.conversations,
  cpl = CASE WHEN resolved.forms + resolved.site + resolved.conversations > 0
    THEN resolved.spend / (resolved.forms + resolved.site + resolved.conversations) ELSE 0 END,
  conversion_rate = CASE WHEN COALESCE(resolved.clicks, 0) > 0
    THEN ((resolved.forms + resolved.site + resolved.conversations) / resolved.clicks) * 100 ELSE 0 END,
  efficiency_rate = CASE WHEN COALESCE(resolved.impressions, 0) > 0
    THEN ((resolved.forms + resolved.site + resolved.conversations) / resolved.impressions) * 100 ELSE 0 END
FROM resolved
WHERE i.ad_id = resolved.ad_id
  AND i.date = resolved.date
  AND COALESCE(i.attribution_window, 'account_default') = resolved.attribution_window;

COMMENT ON COLUMN public.insights.form_leads IS
  'Canonical Meta form results: first available action by priority, preferring onsite_conversion.lead_grouped over broader aliases.';
