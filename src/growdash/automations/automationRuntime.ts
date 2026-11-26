export function errorDetails(error: unknown): { code?: string; message: string } {
  if (error && typeof error === "object") {
    const value = error as { code?: unknown; message?: unknown };
    return {
      code: typeof value.code === "string" ? value.code : undefined,
      message: typeof value.message === "string" ? value.message : String(error),
    };
  }
  return { message: String(error ?? "") };
}

/**
 * Schema errors are deliberately narrow. A timeout, RLS denial or a transient
 * PostgREST failure must never be presented as an unapplied migration.
 */
export function isAutomationSchemaError(error: unknown) {
  const { code, message } = errorDetails(error);
  if (["42P01", "PGRST202", "PGRST205"].includes(code ?? "") && /growdash_automations/i.test(message)) return true;
  return /(?:relation|table|schema cache).*growdash_automations.*(?:does not exist|not found|could not find)/i.test(message)
    || /could not find the table ['"]?growdash_automations/i.test(message);
}

export function isTransientAutomationError(error: unknown) {
  const { code, message } = errorDetails(error);
  return ["PGRST002", "PGRST003", "408", "429", "500", "502", "503", "504"].includes(code ?? "")
    || /timeout|timed out|tempo de carregamento|network|fetch failed|temporar|indispon[ií]vel|gateway/i.test(message);
}

export function automationTriggerType(type: string | undefined) {
  switch (type) {
    case "lead.trigger": return "new_lead";
    case "instagram.message.trigger": return "instagram_message";
    case "instagram.trigger": return "instagram_comment";
    case "whatsapp.message.trigger": return "whatsapp_message";
    case "google.drive.trigger": return "google_drive_file";
    case "google.sheets.trigger": return "google_sheets_row";
    default: return "manual";
  }
}
