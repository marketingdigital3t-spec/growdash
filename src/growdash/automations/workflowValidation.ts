import { WORKFLOW_NODE_TYPES, type WorkflowDefinition, type WorkflowNode } from "./workflowTypes";

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

export type WorkflowValidationOptions = {
  /** Drafts may be created before a trigger is configured. */
  requireTrigger?: boolean;
  /** Runnable workflows must have every node connected to a trigger. */
  requireReachability?: boolean;
  /** Drafts can keep incomplete node forms until activation or test. */
  validateParameters?: boolean;
};

const isTrigger = (node: WorkflowNode) => node.type.endsWith(".trigger");

function validateNodeParameters(node: WorkflowNode, errors: string[]) {
  const parameters = node.parameters;
  if (node.type === "http.request") {
    const url = typeof parameters.url === "string" ? parameters.url.trim() : "";
    if (!url) errors.push(`O nó ${node.id} precisa de uma URL.`);
    else {
      try {
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) errors.push(`A URL do nó ${node.id} precisa usar HTTP ou HTTPS.`);
      } catch {
        errors.push(`A URL do nó ${node.id} é inválida.`);
      }
    }
  }
  if (["condition.if", "logic.filter", "logic.switch"].includes(node.type)) {
    if (typeof parameters.field !== "string" || !parameters.field.trim()) errors.push(`O nó ${node.id} precisa de um campo para avaliar.`);
  }
  if (node.type === "delay.wait" && (!Number.isFinite(Number(parameters.seconds)) || Number(parameters.seconds) < 0)) {
    errors.push(`O nó ${node.id} precisa de um tempo de espera válido.`);
  }
}

export function validateWorkflowDefinition(value: unknown, options: WorkflowValidationOptions = {}): { ok: true; value: WorkflowDefinition } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(value)) return { ok: false, errors: ["Workflow inválido."] };
  const nodes = Array.isArray(value.nodes) ? value.nodes : [];
  const connections = Array.isArray(value.connections) ? value.connections : [];
  const ids = new Set<string>();
  for (const node of nodes) {
    if (!isRecord(node) || typeof node.id !== "string" || !node.id.trim()) {
      errors.push("Cada nó precisa de um id.");
      continue;
    }
    if (ids.has(node.id)) errors.push(`Nó duplicado: ${node.id}`);
    ids.add(node.id);
    if (!WORKFLOW_NODE_TYPES.includes(node.type as never)) errors.push(`Tipo de nó não suportado: ${String(node.type)}`);
    if (!isRecord(node.parameters)) errors.push(`Parâmetros inválidos no nó ${node.id}.`);
    else if (options.validateParameters) validateNodeParameters(node as unknown as WorkflowNode, errors);
  }
  const typedNodes = nodes.filter((node): node is WorkflowNode => isRecord(node) && typeof node.id === "string" && typeof node.type === "string" && isRecord(node.parameters)) as WorkflowNode[];
  const triggers = typedNodes.filter(isTrigger);
  if (options.requireTrigger && triggers.length === 0) errors.push("O workflow precisa de pelo menos um gatilho para executar.");
  const adjacency = new Map<string, string[]>();
  const edgeKeys = new Set<string>();
  for (const connection of connections) {
    if (!isRecord(connection) || typeof connection.source !== "string" || typeof connection.target !== "string") {
      errors.push("Conexão inválida.");
      continue;
    }
    if (!ids.has(connection.source) || !ids.has(connection.target)) errors.push(`Conexão aponta para nó inexistente: ${connection.source} → ${connection.target}`);
    const edgeKey = `${connection.source}|${connection.target}|${String(connection.sourcePort || "")}|${String(connection.targetPort || "")}`;
    if (edgeKeys.has(edgeKey)) errors.push(`Conexão duplicada: ${connection.source} → ${connection.target}`);
    edgeKeys.add(edgeKey);
    adjacency.set(connection.source, [...(adjacency.get(connection.source) ?? []), connection.target]);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) { errors.push("O workflow não pode conter ciclos."); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const target of adjacency.get(id) ?? []) visit(target);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of ids) visit(id);
  if (options.requireReachability && triggers.length > 0) {
    const reachable = new Set<string>();
    const queue = triggers.map((node) => node.id);
    while (queue.length) {
      const id = queue.shift()!;
      if (reachable.has(id)) continue;
      reachable.add(id);
      queue.push(...(adjacency.get(id) ?? []));
    }
    for (const node of typedNodes) if (!reachable.has(node.id)) errors.push(`O nó ${node.id} não está conectado a um gatilho.`);
  }
  if (typeof value.name !== "string" || !value.name.trim()) errors.push("O workflow precisa de um nome.");
  if (typeof value.version !== "number") errors.push("A versão do workflow é obrigatória.");
  return errors.length ? { ok: false, errors: [...new Set(errors)] } : { ok: true, value: value as unknown as WorkflowDefinition };
}
