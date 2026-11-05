export function cleanText(value: unknown): string | null {
  const text = value == null ? "" : String(value).trim();
  if (!text || /^\{\{[^{}]+\}\}$/.test(text) || /^\$\{[^{}]+\}$/.test(text)) return null;
  return text;
}

export function normalizeMetaPlatform(value: unknown): string | null {
  const cleaned = cleanText(value);
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
  const cleaned = cleanText(value);
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

export function extractPhoneVariants(rawPhone: unknown): string[] {
  const digits = String(rawPhone || "").replace(/\D/g, "");
  if (!digits || digits.length < 8) return [];
  const set = new Set<string>();
  set.add(digits);
  // Se começa com 55 e tem 12 ou 13 dígitos, remove o DDI (55)
  if (digits.startsWith("55") && digits.length >= 12) {
    const national = digits.slice(2);
    set.add(national);
    // Últimos 8 e 9 dígitos
    if (national.length >= 8) set.add(national.slice(-8));
    if (national.length >= 9) set.add(national.slice(-9));
  } else {
    // Se não tem 55, adiciona variante com 55
    set.add(`55${digits}`);
    if (digits.length >= 8) set.add(digits.slice(-8));
    if (digits.length >= 9) set.add(digits.slice(-9));
  }
  return Array.from(set);
}

export function phonesMatch(phoneA: unknown, phoneB: unknown): boolean {
  const pA = String(phoneA || "").replace(/\D/g, "");
  const pB = String(phoneB || "").replace(/\D/g, "");
  if (!pA || !pB || pA.length < 8 || pB.length < 8) return false;
  if (pA === pB) return true;
  const normA = pA.startsWith("55") && pA.length >= 12 ? pA.slice(2) : pA;
  const normB = pB.startsWith("55") && pB.length >= 12 ? pB.slice(2) : pB;
  if (normA === normB) return true;
  // Se ambos têm DDD (10 ou 11 dígitos), confere se o DDD é idêntico e os últimos 8 dígitos batem
  if (normA.length >= 10 && normB.length >= 10) {
    const dddA = normA.slice(0, 2);
    const dddB = normB.slice(0, 2);
    const last8A = normA.slice(-8);
    const last8B = normB.slice(-8);
    if (dddA === dddB && last8A === last8B) return true;
  }
  return false;
}
