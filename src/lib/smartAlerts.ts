export type SmartAlertKind = "low_budget" | "cpl_rise" | "no_conversion" | "sync_error" | "oauth" | "campaign";

export type SmartAlertPreferences = {
  enabled: boolean;
  browserEnabled: boolean;
  lowBudget: boolean;
  cplRise: boolean;
  noConversion: boolean;
  syncError: boolean;
  oauth: boolean;
};

export const DEFAULT_SMART_ALERT_PREFERENCES: SmartAlertPreferences = {
  enabled: true,
  browserEnabled: false,
  lowBudget: true,
  cplRise: true,
  noConversion: true,
  syncError: true,
  oauth: true,
};

export function normalizeSmartAlertPreferences(value: unknown): SmartAlertPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) return DEFAULT_SMART_ALERT_PREFERENCES;
  const input = value as Record<string, unknown>;
  return {
    enabled: input.enabled !== false,
    browserEnabled: input.browserEnabled === true,
    lowBudget: input.lowBudget !== false,
    cplRise: input.cplRise !== false,
    noConversion: input.noConversion !== false,
    syncError: input.syncError !== false,
    oauth: input.oauth !== false,
  };
}

export function isSmartAlertEnabled(kind: SmartAlertKind | undefined, preferences: SmartAlertPreferences) {
  if (!preferences.enabled) return false;
  if (!kind) return true;
  if (kind === "low_budget") return preferences.lowBudget;
  if (kind === "cpl_rise") return preferences.cplRise;
  if (kind === "no_conversion") return preferences.noConversion;
  if (kind === "sync_error") return preferences.syncError;
  if (kind === "oauth") return preferences.oauth;
  return true;
}

