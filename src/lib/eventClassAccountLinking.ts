export interface EventClassAccountLinkRow {
  id: string;
  expert_id?: string | null;
  expert_name?: string | null;
  ad_account_id?: string | null;
}

export interface ExpertAccountLinkRow {
  expert_id?: string | null;
  ad_account_id?: string | null;
}

export interface ExpertNameRow {
  id: string;
  nome?: string | null;
}

const normalize = (value: unknown) => String(value ?? "").trim().toLocaleLowerCase("pt-BR");

/** Returns an account only when the expert has exactly one distinct linked account. */
export function resolveUniqueEventClassAccount(
  eventClass: EventClassAccountLinkRow,
  links: ExpertAccountLinkRow[],
  experts: ExpertNameRow[] = [],
): string | null {
  if (eventClass.ad_account_id) return null;
  const matchingExpertIds = new Set<string>();
  if (eventClass.expert_id) matchingExpertIds.add(eventClass.expert_id);
  const className = normalize(eventClass.expert_name);
  if (className) {
    experts.filter((expert) => normalize(expert.nome) === className).forEach((expert) => matchingExpertIds.add(expert.id));
  }
  const accountIds = new Set(
    links
      .filter((link) => link.ad_account_id && link.expert_id && matchingExpertIds.has(link.expert_id))
      .map((link) => link.ad_account_id as string),
  );
  return accountIds.size === 1 ? Array.from(accountIds)[0] : null;
}
