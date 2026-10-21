import { describe, expect, it } from "vitest";
import { validateWorkflowDefinition } from "./workflowValidation";

const base = { id: "wf", name: "Teste", version: 1, active: false, nodes: [{ id: "a", type: "webhook.trigger", position: { x: 0, y: 0 }, parameters: {} }, { id: "b", type: "http.request", position: { x: 240, y: 0 }, parameters: { url: "https://example.com" } }], connections: [{ source: "a", target: "b" }] };

describe("validateWorkflowDefinition", () => {
  it("accepts a valid linear workflow", () => expect(validateWorkflowDefinition(base).ok).toBe(true));
  it("rejects duplicate nodes", () => expect(validateWorkflowDefinition({ ...base, nodes: [base.nodes[0], base.nodes[0]] }).ok).toBe(false));
  it("rejects missing connection targets", () => expect(validateWorkflowDefinition({ ...base, connections: [{ source: "a", target: "missing" }] }).ok).toBe(false));
  it("rejects unsupported types", () => expect(validateWorkflowDefinition({ ...base, nodes: [{ ...base.nodes[0], type: "code" }] }).ok).toBe(false));
  it("accepts branch ports for IF connections", () => expect(validateWorkflowDefinition({ ...base, nodes: [{ ...base.nodes[0], type: "condition.if" }, base.nodes[1], { id: "c", type: "http.request", position: { x: 480, y: 0 }, parameters: { url: "https://example.com" } }], connections: [{ source: "a", target: "b", sourcePort: "true" }, { source: "a", target: "c", sourcePort: "false" }] }).ok).toBe(true));
  it("rejects cycles", () => expect(validateWorkflowDefinition({ ...base, connections: [{ source: "a", target: "b" }, { source: "b", target: "a" }] }).ok).toBe(false));
});
