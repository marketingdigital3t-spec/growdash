export const WORKFLOW_NODE_TYPES = ["webhook.trigger", "http.request", "google.sheets.append"] as const;

export type WorkflowNodeType = (typeof WORKFLOW_NODE_TYPES)[number];

export type WorkflowNode = {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  parameters: Record<string, unknown>;
};

export type WorkflowConnection = {
  source: string;
  target: string;
  sourcePort?: string;
  targetPort?: string;
};

export type WorkflowDefinition = {
  id: string;
  name: string;
  version: number;
  active: boolean;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
};

export const emptyWorkflow = (name = "Nova automação"): WorkflowDefinition => ({
  id: crypto.randomUUID(),
  name,
  version: 1,
  active: false,
  nodes: [],
  connections: [],
});
