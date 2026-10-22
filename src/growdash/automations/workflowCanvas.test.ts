import { describe, expect, it } from "vitest";
import { connectionFromHandles, edgePath, moveWorkflowNode } from "./workflowCanvas";
import type { WorkflowDefinition } from "./workflowTypes";

const workflow: WorkflowDefinition = {
  id: "wf",
  name: "Teste",
  version: 1,
  active: false,
  nodes: [
    { id: "a", type: "manual.trigger", position: { x: 40, y: 60 }, parameters: {} },
    { id: "b", type: "task.create", position: { x: 320, y: 180 }, parameters: {} },
  ],
  connections: [],
};

describe("workflow canvas model", () => {
  it("moves only the requested node and preserves the rest of the definition", () => {
    const moved = moveWorkflowNode(workflow, "b", { x: 480, y: 240 });
    expect(moved.nodes.find((node) => node.id === "b")?.position).toEqual({ x: 480, y: 240 });
    expect(moved.nodes.find((node) => node.id === "a")?.position).toEqual({ x: 40, y: 60 });
    expect(moved.connections).toEqual([]);
  });

  it("creates a cubic path between node handles", () => {
    expect(edgePath({ x: 40, y: 60 }, { x: 320, y: 180 })).toBe("M 248 112 C 284 112, 284 232, 320 232");
  });

  it("creates a connection only after both handles are selected", () => {
    expect(connectionFromHandles("a", "", "true")).toBeNull();
    expect(connectionFromHandles("a", "b", "true")).toEqual({ source: "a", target: "b", sourcePort: "true" });
    expect(connectionFromHandles("a", "a", "")).toBeNull();
  });
});
