export type NoteFieldSource = Record<string, unknown> | null | undefined;

export interface RDNoteDeal {
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  lead_city?: string | null;
  lead_state?: string | null;
  lead_created_at?: string | null;
  custom_fields?: NoteFieldSource;
  raw?: Record<string, any> | null;
}

export interface RDNoteMetaLead {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  created_time?: string | null;
  platform?: string | null;
  is_organic?: boolean | string | null;
  ad_name?: string | null;
  adset_name?: string | null;
  campaign_name?: string | null;
  form_name?: string | null;
  [key: string]: unknown;
}

export interface RDDealNoteInput {
  deal: RDNoteDeal;
  meta?: RDNoteMetaLead | null;
  timezone?: string | null;
}

function clean(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function normalized(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function field(fields: NoteFieldSource, aliases: string[]): string | null {
  if (Array.isArray(fields)) {
    for (const entry of fields as any[]) {
      const key = entry?.name || entry?.label || entry?.key;
      const value = entry?.values?.[0] ?? entry?.value;
      if (key && aliases.some((alias) => normalized(key) === normalized(alias)) && clean(value)) return clean(value);
    }
    return null;
  }
  if (!fields || typeof fields !== "object") return null;
  const wanted = aliases.map(normalized);
  for (const [key, value] of Object.entries(fields)) {
    const candidate = normalized(key);
    const isSourcePrefixed = ["contact", "deal"].some((prefix) => candidate.startsWith(prefix) && wanted.includes(candidate.slice(prefix.length)));
    if ((wanted.includes(candidate) || isSourcePrefixed) && clean(value)) return clean(value);
  }
  return null;
}

function pick(rd: unknown, meta: unknown, aliases: string[], direct?: unknown): string {
  return clean(direct) || field(rd as NoteFieldSource, aliases) || field(meta as NoteFieldSource, aliases) || "Não informado";
}

function formatDateTime(value: unknown, timezone: string): string {
  const date = value ? new Date(String(value)) : null;
  if (!date || Number.isNaN(date.getTime())) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date).replace(", ", " às ");
}

function organicValue(value: unknown): string | null {
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  const text = clean(value);
  if (!text) return null;
  const n = normalized(text);
  if (["true", "sim", "yes", "organico"].includes(n)) return "Sim";
  if (["false", "nao", "no", "pago"].includes(n)) return "Não";
  return text;
}

export function buildRDDealNote({ deal, meta, timezone = "America/Sao_Paulo" }: RDDealNoteInput): string {
  const rd = deal.custom_fields;
  const raw = deal.raw || {};
  const rawContact = raw.contact || raw.deal_contact || {};
  const rawUtms = raw.utms || raw.utm || rawContact.utms || {};
  const metaFieldData = Array.isArray((meta as any)?.field_data)
    ? Object.fromEntries((meta as any).field_data.map((entry: any) => [entry?.name || entry?.label, entry?.values?.[0] ?? entry?.value]).filter(([key]: any[]) => key))
    : {};
  const rdData = { ...raw, ...rawContact, ...rawUtms, ...metaFieldData, ...(rd || {}) };
  const platform = pick(rdData, meta, ["plataforma", "platform", "origem plataforma"]);
  const organic = organicValue(pick(rdData, meta, ["organico", "orgânico", "is_organic", "organic"]));
  const lines = [
    `Nome: ${pick(rdData, meta, ["nome", "name"], deal.contact_name || meta?.name)}`,
    `E-mail: ${pick(rdData, meta, ["email", "e-mail"], deal.contact_email || meta?.email)}`,
    `Telefone: ${pick(rdData, meta, ["telefone", "phone"], deal.contact_phone || meta?.phone)}`,
    `WhatsApp: ${pick(rdData, meta, ["whatsapp", "whatsapp telefone", "whatsapp_phone"], rawContact.whatsapp || rawContact.whatsapp_phone || deal.contact_phone || meta?.phone)}`,
    `Cidade: ${pick(rdData, meta, ["cidade", "city"], deal.lead_city || meta?.city)}`,
    `Estado: ${pick(rdData, meta, ["estado", "state", "uf"], deal.lead_state || meta?.state)}`,
    `Área de atuação: ${pick(rdData, meta, ["area de atuacao", "área de atuação", "area_atuacao", "occupation"])}`,
    `Faturamento atual: ${pick(rdData, meta, ["faturamento atual", "faturamento", "revenue", "monthly revenue"])}`,
    `Data/hora do lead: ${formatDateTime(deal.lead_created_at || meta?.created_time || raw.created_at, timezone)}`,
    `Plataforma: ${platform}`,
    `Status: ${pick(rdData, meta, ["status", "lead status", "deal status"], raw.status || raw.deal_status)}`,
    `Orgânico: ${organic || "Não informado"}`,
    `Anúncio: ${pick(rdData, meta, ["anuncio", "ad", "ad_name", "nome anuncio"])}`,
    `Conjunto: ${pick(rdData, meta, ["conjunto", "adset", "adset_name", "nome conjunto"])}`,
    `Campanha: ${pick(rdData, meta, ["campanha", "campaign", "campaign_name", "utm_campaign"])}`,
    `Formulário: ${pick(rdData, meta, ["formulario", "form", "form_name", "nome formulario"])}`,
  ];
  return lines.join("\n");
}

export function isNoteAutomationFunnel(name: unknown): boolean {
  const value = normalized(name);
  return value === "drasteandradealuna";
}
