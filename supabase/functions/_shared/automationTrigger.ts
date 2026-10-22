export type WorkflowTriggerEvent = {
  type: "whatsapp_message" | "instagram_message" | "instagram_comment" | "lead" | "google_drive_file" | "google_sheets_row";
  id?: string;
  text?: string;
  whatsapp_number_id?: string;
  phone_number_id?: string;
  integration_id?: string;
  spreadsheet_id?: string;
  social_account_id?: string;
  provider_account_id?: string;
};

type WorkflowAutomation = {
  id: string;
  status?: string | null;
  trigger_type?: string | null;
  trigger_config?: Record<string, unknown> | null;
  workflow_definition?: { nodes?: Array<{ type?: string; parameters?: Record<string, unknown> }> } | null;
};

const eventTriggerType: Record<WorkflowTriggerEvent["type"], string> = {
  whatsapp_message: "whatsapp.message.trigger",
  instagram_message: "instagram.message.trigger",
  instagram_comment: "instagram.trigger",
  lead: "lead.trigger",
  google_drive_file: "google.drive.trigger",
  google_sheets_row: "google.sheets.trigger",
};

const includesKeyword = (text: unknown, keyword: unknown) => {
  const expected = String(keyword ?? "").trim().toLocaleLowerCase("pt-BR");
  return !expected || String(text ?? "").toLocaleLowerCase("pt-BR").includes(expected);
};

const accountMatches = (config: Record<string, unknown>, event: WorkflowTriggerEvent) => {
  const expected = String(config.whatsapp_number_id || config.whatsappNumberId || config.social_account_id || config.socialAccountId || config.provider_account_id || config.integration_id || config.integrationId || config.spreadsheet_id || config.spreadsheetId || "").trim();
  if (!expected) return true;
  return [event.whatsapp_number_id, event.phone_number_id, event.social_account_id, event.provider_account_id, event.integration_id, event.spreadsheet_id].some((value) => value && String(value) === expected);
};

export function matchingWorkflowAutomations(automations: WorkflowAutomation[], event: WorkflowTriggerEvent): WorkflowAutomation[] {
  const expectedNodeType = eventTriggerType[event.type];
  return automations.filter((automation) => {
    if (automation.status !== "active") return false;
    const definitionTrigger = automation.workflow_definition?.nodes?.find((node) => node.type === expectedNodeType);
    if (automation.workflow_definition) {
      if (!definitionTrigger) return false;
      const parameters = definitionTrigger.parameters || {};
      const configuredEvent = String(parameters.event || "").trim();
      if (configuredEvent && configuredEvent !== (event.type === "instagram_comment" ? "comment" : event.type === "instagram_message" || event.type === "whatsapp_message" ? "message" : event.type === "google_drive_file" ? "file" : event.type === "google_sheets_row" ? "row" : "lead")) return false;
      return accountMatches(parameters, event) && includesKeyword(event.text, parameters.keyword);
    }
    const legacyType = event.type === "whatsapp_message" ? "whatsapp_message" : event.type === "instagram_message" ? "instagram_message" : event.type === "instagram_comment" ? "instagram_comment" : event.type === "google_drive_file" ? "google_drive_file" : event.type === "google_sheets_row" ? "google_sheets_row" : "new_lead";
    if (automation.trigger_type !== legacyType) return false;
    const config = automation.trigger_config || {};
    return accountMatches(config, event) && includesKeyword(event.text, config.keyword);
  });
}
