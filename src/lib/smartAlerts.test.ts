import { describe, expect, it } from "vitest";
import { DEFAULT_SMART_ALERT_PREFERENCES, isSmartAlertEnabled, normalizeSmartAlertPreferences } from "./smartAlerts";

describe("smart alert preferences", () => {
  it("aplica defaults seguros sem apagar preferências desconhecidas", () => {
    expect(normalizeSmartAlertPreferences({ browserEnabled: true, lowBudget: false })).toEqual({
      ...DEFAULT_SMART_ALERT_PREFERENCES,
      browserEnabled: true,
      lowBudget: false,
    });
  });

  it("desativa somente o tipo de alerta escolhido", () => {
    const preferences = normalizeSmartAlertPreferences({ cplRise: false });
    expect(isSmartAlertEnabled("cpl_rise", preferences)).toBe(false);
    expect(isSmartAlertEnabled("low_budget", preferences)).toBe(true);
    expect(isSmartAlertEnabled(undefined, preferences)).toBe(true);
  });

  it("desliga todos os alertas quando a chave global está desligada", () => {
    expect(isSmartAlertEnabled("no_conversion", { ...DEFAULT_SMART_ALERT_PREFERENCES, enabled: false })).toBe(false);
  });
});

