export const WORKFLOW_NODE_TYPES = [
  "webhook.trigger",
  "manual.trigger",
  "schedule.trigger",
  "lead.trigger",
  "instagram.message.trigger",
  "whatsapp.message.trigger",
  "google.drive.trigger",
  "google.sheets.trigger",
  "http.request",
  "google.sheets.append",
  "google.sheets.lookup",
  "instagram.trigger",
  "instagram.reply",
  "instagram.send",
  "whatsapp.send",
  "google.drive.upload",
  "google.drive.lookup",
  "gmail.send",
  "agent.run",
  "crm.contact.upsert",
  "crm.deal.create",
  "crm.note.create",
  "task.create",
  "tag.add",
  "crm.stage.change",
  "seller.notify",
  "condition.if",
  "logic.filter",
  "logic.switch",
  "delay.wait",
  "logic.loop",
  "logic.merge",
  "logic.stop",
  "error.retry",
  "error.fallback",
  "approval.manual",
] as const;

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
