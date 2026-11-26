import type { WorkflowConnection, WorkflowDefinition, WorkflowNode } from "./workflowTypes";

export const WORKFLOW_NODE_WIDTH = 208;
export const WORKFLOW_NODE_HEIGHT = 104;
export const WORKFLOW_HANDLE_OFFSET = 8;

export function moveWorkflowNode(workflow: WorkflowDefinition, nodeId: string, position: { x: number; y: number }): WorkflowDefinition {
  return {
    ...workflow,
    nodes: workflow.nodes.map((node) => node.id === nodeId ? { ...node, position: { x: Math.max(0, position.x), y: Math.max(0, position.y) } } : node),
  };
}

export function connectionFromHandles(source: string, target: string, sourcePort = ""): WorkflowConnection | null {
  if (!source || !target || source === target) return null;
  return sourcePort ? { source, target, sourcePort } : { source, target };
}

export function edgePath(source: { x: number; y: number }, target: { x: number; y: number }): string {
  const startX = source.x + WORKFLOW_NODE_WIDTH;
  const startY = source.y + WORKFLOW_NODE_HEIGHT / 2;
  const endX = target.x;
  const endY = target.y + WORKFLOW_NODE_HEIGHT / 2;
  const controlX = startX + Math.max(36, (endX - startX) / 2);
  return `M ${startX} ${startY} C ${controlX} ${startY}, ${controlX} ${endY}, ${endX} ${endY}`;
}

export function nodeById(nodes: WorkflowNode[], id: string) {
  return nodes.find((node) => node.id === id) ?? null;
}
