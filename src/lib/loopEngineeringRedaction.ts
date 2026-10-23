const SENSITIVE_KEY = /authorization|cookie|token|secret|password|passwd|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|session/i;
const SENSITIVE_QUERY = /^(access_token|refresh_token|token|code|secret|api_key|apikey|signature)$/i;

function redactString(value: string) {
  let output = value
    .replace(/Bearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
    .replace(/(password|passwd|secret|token|api[_-]?key)\s*[=:]\s*[^\s,;&]+/gi, "$1=[REDACTED]");
  try {
    const url = new URL(output);
    for (const key of Array.from(url.searchParams.keys())) {
      if (SENSITIVE_QUERY.test(key)) url.searchParams.set(key, "[REDACTED]");
    }
    output = url.toString();
  } catch {
    // Plain log lines are handled by the replacements above.
  }
  return output;
}

export function sanitizeOutput<T>(value: T): T {
  if (typeof value === "string") return redactString(value) as T;
  if (Array.isArray(value)) return value.map((item) => sanitizeOutput(item)) as T;
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(key)) continue;
      result[key] = sanitizeOutput(item);
    }
    return result as T;
  }
  return value;
}
