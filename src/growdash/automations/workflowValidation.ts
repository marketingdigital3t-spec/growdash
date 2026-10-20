import { WORKFLOW_NODE_TYPES, type WorkflowDefinition } from "./workflowTypes";

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

export function validateWorkflowDefinition(value: unknown): { ok: true; value: WorkflowDefinition } | { ok: false; errors: string[] } {
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
  }
  const adjacency = new Map<string, string[]>();
  for (const connection of connections) {
    if (!isRecord(connection) || typeof connection.source !== "string" || typeof connection.target !== "string") {
      errors.push("Conexão inválida.");
      continue;
    }
    if (!ids.has(connection.source) || !ids.has(connection.target)) errors.push(`Conexão aponta para nó inexistente: ${connection.source} → ${connection.target}`);
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
  if (typeof value.name !== "string" || !value.name.trim()) errors.push("O workflow precisa de um nome.");
  if (typeof value.version !== "number") errors.push("A versão do workflow é obrigatória.");
  return errors.length ? { ok: false, errors: [...new Set(errors)] } : { ok: true, value: value as unknown as WorkflowDefinition };
}
