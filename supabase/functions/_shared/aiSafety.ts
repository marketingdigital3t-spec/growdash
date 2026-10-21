export type SafeConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

function cleanText(value: unknown, maxLength: number) {
  return Array.from(String(value ?? ""))
    .filter((character) => {
      const code = character.charCodeAt(0);
      return !(code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127);
    })
    .join("")
    .replace(/\uFEFF/g, "")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeQuestion(value: unknown, maxLength = 4000) {
  return cleanText(value, maxLength);
}

export function sanitizeConversationHistory(value: unknown, maxMessages = 6, maxMessageLength = 1200): SafeConversationMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(-maxMessages)
    .map((message) => {
      const messageRole = message && typeof message === "object" ? (message as { role?: unknown }).role : undefined;
      const role = messageRole === "assistant" || messageRole === "agent"
        ? "assistant"
        : "user";
      const content = cleanText(message && typeof message === "object" ? (message as { content?: unknown }).content : "", maxMessageLength);
      return { role, content } as SafeConversationMessage;
    })
    .filter((message) => message.content.length > 0);
}

export function dateKeyInTimezone(value: unknown, timezone = "America/Sao_Paulo") {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    return year && month && day ? `${year}-${month}-${day}` : null;
  } catch {
    return null;
  }
}

export function inCivilPeriod(value: unknown, startDate: string | null, endDate: string | null, timezone = "America/Sao_Paulo") {
  if (!startDate || !endDate) return true;
  const key = dateKeyInTimezone(value, timezone);
  return Boolean(key && key >= startDate && key <= endDate);
}

export type RetryFetchOptions = {
  timeoutMs?: number;
  maxAttempts?: number;
  baseDelayMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

function retryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export async function fetchWithRetry(input: RequestInfo | URL, init: RequestInit = {}, options: RetryFetchOptions = {}) {
  const timeoutMs = options.timeoutMs ?? 20_000;
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 250);
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const externalSignal = init.signal;
    const onAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener("abort", onAbort, { once: true });
    }
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(input, { ...init, signal: controller.signal });
      if (!retryableStatus(response.status) || attempt === maxAttempts - 1) return response;
      lastError = new Error(`AI_PROVIDER_${response.status}`);
    } catch (error) {
      lastError = error;
      if (externalSignal?.aborted || attempt === maxAttempts - 1) throw error;
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener("abort", onAbort);
    }
    await sleep(baseDelayMs * 2 ** attempt);
  }
  throw lastError instanceof Error ? lastError : new Error("AI_PROVIDER_UNAVAILABLE");
}
