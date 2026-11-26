import { describe, expect, it } from "vitest";
import { normalizeSellerNotification, normalizeTagAssignment, normalizeTask } from "../../../supabase/functions/_shared/automationActions";

describe("automation internal action contracts", () => {
  it("normalizes a task without losing dynamic CRM context", () => {
    expect(normalizeTask({
      title: "Ligar para {{lead.name}}",
      description: "Retornar até amanhã",
      priority: "high",
      entity_type: "rd_deal",
      entity_id: "deal-7",
    })).toMatchObject({
      title: "Ligar para {{lead.name}}",
      priority: "high",
      status: "open",
      entity_type: "rd_deal",
      entity_id: "deal-7",
    });
  });

  it("rejects a task without a title", () => {
    expect(() => normalizeTask({ description: "sem título" })).toThrow("título");
  });

  it("normalizes a tag assignment and requires its target", () => {
    expect(normalizeTagAssignment({ name: "Quente", rd_deal_id: "deal-9" })).toEqual({
      name: "Quente",
      entity_type: "rd_deal",
      entity_id: "deal-9",
      color: null,
    });
    expect(() => normalizeTagAssignment({ name: "Quente" })).toThrow("entidade");
  });

  it("requires a concrete seller recipient for notifications", () => {
    expect(normalizeSellerNotification({ recipient_user_id: "user-2", message: "Novo lead" })).toMatchObject({
      recipient_user_id: "user-2",
      title: "Notificação de automação",
      message: "Novo lead",
    });
    expect(() => normalizeSellerNotification({ message: "Novo lead" })).toThrow("destinatário");
  });
});
