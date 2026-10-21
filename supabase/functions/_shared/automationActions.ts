type ParametersMap = Record<string, unknown>;

const text = (value: unknown) => String(value ?? "").trim();
const nullableText = (value: unknown) => {
  const valueText = text(value);
  return valueText || null;
};
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function normalizeTask(parameters: ParametersMap) {
  const title = text(parameters.title || parameters.name);
  if (!title) throw new Error("Criar tarefa exige um título.");
  const priority = text(parameters.priority || "medium").toLowerCase();
  if (!["low", "medium", "high", "urgent"].includes(priority)) throw new Error("Prioridade da tarefa inválida.");
  const status = text(parameters.status || "open").toLowerCase();
  if (!["open", "in_progress", "done", "cancelled"].includes(status)) throw new Error("Status da tarefa inválido.");
  const dueAt = nullableText(parameters.due_at || parameters.dueAt);
  if (dueAt && Number.isNaN(Date.parse(dueAt))) throw new Error("Prazo da tarefa inválido.");
  return {
    title,
    description: nullableText(parameters.description),
    assignee_user_id: nullableText(parameters.assignee_user_id || parameters.assigneeUserId || parameters.seller_id || parameters.sellerId),
    priority,
    status,
    due_at: dueAt,
    entity_type: nullableText(parameters.entity_type || parameters.entityType),
    entity_id: nullableText(parameters.entity_id || parameters.entityId || parameters.rd_deal_id || parameters.rdDealId || parameters.lead_id || parameters.leadId),
    metadata: record(parameters.metadata),
  };
}

export function normalizeTagAssignment(parameters: ParametersMap) {
  const name = text(parameters.name || parameters.tag || parameters.tag_name || parameters.tagName);
  if (!name) throw new Error("Adicionar tag exige um nome.");
  const entityId = text(parameters.entity_id || parameters.entityId || parameters.rd_deal_id || parameters.rdDealId || parameters.deal_id || parameters.dealId || parameters.lead_id || parameters.leadId);
  if (!entityId) throw new Error("Adicionar tag exige uma entidade de destino.");
  return {
    name,
    entity_type: text(parameters.entity_type || parameters.entityType || "rd_deal"),
    entity_id: entityId,
    color: nullableText(parameters.color),
  };
}

export function normalizeSellerNotification(parameters: ParametersMap) {
  const recipient = text(parameters.recipient_user_id || parameters.recipientUserId || parameters.seller_id || parameters.sellerId || parameters.user_id || parameters.userId);
  if (!recipient) throw new Error("Notificar vendedor exige um destinatário.");
  const message = text(parameters.message || parameters.body);
  if (!message) throw new Error("Notificar vendedor exige uma mensagem.");
  return {
    recipient_user_id: recipient,
    title: text(parameters.title || "Notificação de automação"),
    message,
    link: nullableText(parameters.link || parameters.url),
    metadata: record(parameters.metadata),
  };
}
