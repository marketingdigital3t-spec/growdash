export function cleanDeliveryText(value: unknown): string | null {
  const text = value == null ? "" : String(value).trim();
  if (!text || /^\{\{[^{}]+\}\}$/.test(text) || /^\$\{[^{}]+\}$/.test(text)) return null;
  return text;
}

export function normalizeMetaPlatform(value: unknown): string | null {
  const cleaned = cleanDeliveryText(value);
  if (!cleaned) return null;
  const lower = cleaned.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (["fb", "facebook"].includes(lower)) return "Facebook";
  if (["ig", "instagram"].includes(lower)) return "Instagram";
  if (["an", "audiencenetwork"].includes(lower)) return "Audience Network";
  if (["msg", "messenger"].includes(lower)) return "Messenger";
  if (["threads"].includes(lower)) return "Threads";
  if (["whatsapp", "wa"].includes(lower)) return "WhatsApp";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function normalizeMetaPlacement(value: unknown): string | null {
  const cleaned = cleanDeliveryText(value);
  if (!cleaned) return null;
  const lower = cleaned.toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (lower.includes("reels")) return "Reels";
  if (lower.includes("story") || lower.includes("stories")) return "Stories";
  if (lower.includes("explore") || lower.includes("explorar")) return "Explorar";
  if (lower.includes("feed")) return "Feed";
  if (lower.includes("right_hand_column") || lower.includes("righthandcolumn")) return "Coluna da Direita";
  if (lower.includes("marketplace")) return "Marketplace";
  if (lower.includes("search")) return "Resultados de Pesquisa";
  if (lower.includes("inbox")) return "Caixa de Entrada";
  if (lower.includes("instant_article")) return "Artigos Instantâneos";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
