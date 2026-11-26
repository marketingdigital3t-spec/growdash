import { describe, expect, it } from "vitest";
import { matchingWorkflowAutomations } from "../../../supabase/functions/_shared/automationTrigger";

const event = { type: "whatsapp_message" as const, id: "wamid-1", text: "Quero saber o preço", whatsapp_number_id: "number-1" };

describe("workflow trigger matching", () => {
  it("selects only active workflows with a matching WhatsApp trigger", () => {
    const result = matchingWorkflowAutomations([
      { id: "new", status: "active", workflow_definition: { nodes: [{ type: "whatsapp.message.trigger", parameters: { event: "message", keyword: "preço", whatsapp_number_id: "number-1" } }] } },
      { id: "wrong-account", status: "active", workflow_definition: { nodes: [{ type: "whatsapp.message.trigger", parameters: { whatsapp_number_id: "number-2" } }] } },
      { id: "paused", status: "paused", workflow_definition: { nodes: [{ type: "whatsapp.message.trigger", parameters: {} }] } },
    ], event);
    expect(result.map((item) => item.id)).toEqual(["new"]);
  });

  it("keeps legacy trigger_type workflows working", () => {
    const result = matchingWorkflowAutomations([{ id: "legacy", status: "active", trigger_type: "whatsapp_message", trigger_config: { whatsapp_number_id: "number-1", keyword: "preço" } }], event);
    expect(result.map((item) => item.id)).toEqual(["legacy"]);
  });

  it("does not match a different event type", () => {
    expect(matchingWorkflowAutomations([{ id: "lead", status: "active", trigger_type: "new_lead" }], event)).toEqual([]);
  });

  it("matches a Google Drive file against the connected integration", () => {
    expect(matchingWorkflowAutomations([{ id: "drive", status: "active", workflow_definition: { nodes: [{ type: "google.drive.trigger", parameters: { event: "file", integration_id: "google-1" } }] } }], { type: "google_drive_file", integration_id: "google-1", id: "file-1", text: "contrato.pdf" })).toHaveLength(1);
  });
});
