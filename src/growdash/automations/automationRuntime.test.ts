import { describe, expect, it } from "vitest";
import { automationTriggerType, isAutomationSchemaError, isTransientAutomationError } from "./automationRuntime";

describe("automation runtime diagnostics", () => {
  it("only classifies a real missing table as a schema problem", () => {
    expect(isAutomationSchemaError({ code: "PGRST205", message: "Could not find the table 'public.growdash_automations' in the schema cache" })).toBe(true);
    expect(isAutomationSchemaError(new Error("Tempo de carregamento excedido."))).toBe(false);
    expect(isAutomationSchemaError({ code: "42501", message: "permission denied for table growdash_automations" })).toBe(false);
  });

  it("recognizes transient backend failures for controlled retry", () => {
    expect(isTransientAutomationError(new Error("Tempo de carregamento excedido."))).toBe(true);
    expect(isTransientAutomationError({ code: "PGRST002", message: "upstream unavailable" })).toBe(true);
    expect(isTransientAutomationError(new Error("invalid workflow"))).toBe(false);
  });

  it("keeps trigger types descriptive without breaking the legacy check constraint", () => {
    expect(automationTriggerType("whatsapp.message.trigger")).toBe("whatsapp_message");
    expect(automationTriggerType("google.drive.trigger")).toBe("google_drive_file");
    expect(automationTriggerType("schedule.trigger")).toBe("manual");
  });
});
