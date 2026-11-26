import { aggregateMetaLeadTargets } from "@/lib/metaActionMetrics";
import { CONVERSATION_ACTION_TYPES, FORM_ACTION_TYPES, MESSAGING_AUXILIARY_ACTION_TYPES, SITE_ACTION_TYPES } from "../../supabase/functions/_shared/metaLeadMetrics";
import { matchesMetaAttributionWindow, normalizeMetaAttributionWindow } from "@/lib/metaInsightFacts";

export interface ReconciliationInsight {
  ad_id: string;
  ad_account_id: string;
  date: string;
  attribution_window?: string | null;
}

export interface ReconciliationAction {
  ad_account_id: string;
  ad_id: string;
  date: string;
  action_type: string;
  value: number | null;
  attribution_window?: string | null;
}

export function resolveAccountMetaLeadReconciliation(
  accountId: string,
  insights: ReconciliationInsight[],
  actions: ReconciliationAction[],
  configuredSiteAction?: string | null,
  siteEligibleAdScopes?: ReadonlySet<string>,
  siteClassificationComplete = true,
  conversationEligibleAdScopes?: ReadonlySet<string>,
) {
  const accountInsights = insights.filter((row) => row.ad_account_id === accountId);
  const accountAdIds = new Set(accountInsights.map((row) => row.ad_id));
  // Action IDs must always be scoped to the internal account UUID. Meta ad IDs
  // are expected to be globally unique, but imported/migrated facts can contain
  // duplicates; falling back to ad_id alone can leak another account's leads.
  const accountActions = actions.filter((row) => row.ad_account_id === accountId && accountAdIds.has(row.ad_id));
  const result = aggregateMetaLeadTargets(
    accountInsights,
    accountActions,
    { [accountId]: configuredSiteAction || undefined },
    siteEligibleAdScopes,
    conversationEligibleAdScopes,
  );

  const attributionByAdDate = new Map(accountInsights.map((row) => [
    `${row.ad_account_id}|${row.ad_id}|${row.date}`,
    normalizeMetaAttributionWindow(row.attribution_window),
  ]));
  const validActions = accountActions.filter((row) => {
    const attribution = attributionByAdDate.get(`${row.ad_account_id}|${row.ad_id}|${row.date}`);
    if (!attribution || !matchesMetaAttributionWindow(row.attribution_window, attribution)) return false;
    return (FORM_ACTION_TYPES as readonly string[]).includes(row.action_type)
      || (SITE_ACTION_TYPES as readonly string[]).includes(row.action_type)
      || row.action_type === configuredSiteAction
      || (CONVERSATION_ACTION_TYPES as readonly string[]).includes(row.action_type)
      || (MESSAGING_AUXILIARY_ACTION_TYPES as readonly string[]).includes(row.action_type);
  });
  const typesByAdDate = new Map<string, Set<string>>();
  for (const action of validActions) {
    const key = `${action.ad_account_id}|${action.ad_id}|${action.date}`;
    const actionTypes = typesByAdDate.get(key) || new Set<string>();
    actionTypes.add(action.action_type);
    typesByAdDate.set(key, actionTypes);
  }
  const configuredSiteIsCanonical = Boolean(configuredSiteAction)
    && !(FORM_ACTION_TYPES as readonly string[]).includes(configuredSiteAction || "")
    && configuredSiteAction !== "lead";
  const siteTypes = configuredSiteIsCanonical ? [configuredSiteAction!] : [];
  const leadActionFactCount = Array.from(typesByAdDate.entries()).filter(([key, actionTypes]) => {
    const hasForm = FORM_ACTION_TYPES.some((type) => actionTypes.has(type));
    const [scopeAccountId, scopeAdId] = key.split("|");
    const siteIsEligible = !siteEligibleAdScopes || siteEligibleAdScopes.has(`${scopeAccountId}|${scopeAdId}`);
    const hasSite = siteIsEligible && siteTypes.some((type) => actionTypes.has(type));
    const hasUnconfiguredSiteSignal = SITE_ACTION_TYPES.some((type) => actionTypes.has(type));
    const hasConversation = Boolean(conversationEligibleAdScopes?.has(`${scopeAccountId}|${scopeAdId}`))
      && CONVERSATION_ACTION_TYPES.some((type) => actionTypes.has(type));
    return hasForm || hasSite || hasConversation;
  }).length;
  const hasConversationFacts = validActions.some((row) => (CONVERSATION_ACTION_TYPES as readonly string[]).includes(row.action_type));
  const needsSiteClassification = configuredSiteIsCanonical && accountInsights.length > 0;
  const needsConversationClassification = hasConversationFacts && accountInsights.length > 0;

  return {
    ...result.totals,
    insightRows: accountInsights.length,
    leadActionFactCount,
    available: accountInsights.length > 0 && leadActionFactCount > 0 && (!needsSiteClassification || siteClassificationComplete) && (!needsConversationClassification || siteClassificationComplete),
    reason: accountInsights.length === 0
      ? "Nenhum snapshot de Insights neste período."
      : (needsSiteClassification || needsConversationClassification) && !siteClassificationComplete
        ? "Destino do anúncio sem confirmação; Leads Meta indisponíveis neste recorte."
        : leadActionFactCount === 0
        ? "Insights carregados; ações de leads ainda não confirmadas."
        : undefined,
  };
}
