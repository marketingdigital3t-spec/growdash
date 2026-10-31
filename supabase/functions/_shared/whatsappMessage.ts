function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function normalizeChatId(value: unknown): string {
  return typeof value === "string" ? value.replace(/@c\.us$/, "").trim() : "";
}

export function isWahaSelfMessage(message: Record<string, unknown>, sessionMeId: unknown): boolean {
  const nested = asRecord(message._data);
  const nestedId = asRecord(nested.id);
  if (message.fromMe === true || nested.fromMe === true || nestedId.fromMe === true) return true;

  const ownId = normalizeChatId(sessionMeId);
  if (!ownId) return false;
  return [message.from, message.author, nested.from, nested.author]
    .map(normalizeChatId)
    .some((candidate) => candidate === ownId);
}
