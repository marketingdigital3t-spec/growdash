type SentryContext = {
  syncRunId?: string | null;
  provider: string;
  status: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  triggerSource?: string | null;
  scopeKey?: string | null;
  codeVersion?: string | null;
  durationMs?: number | null;
  retryCount?: number | null;
  recordsRead?: number | null;
  recordsUpserted?: number | null;
};

export function parseSentryDsn(value: string) {
  try {
    const url = new URL(value);
    const projectId = url.pathname.replace(/^\/+/, "").split("/")[0];
    if (url.protocol !== "https:" || !url.username || !projectId) return null;
    return {
      publicKey: decodeURIComponent(url.username),
      projectId,
      endpoint: `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
    };
  } catch {
    return null;
  }
}

function eventId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Sends only structured metadata; a Sentry outage never changes sync state. */
export async function captureSyncSentryEvent(context: SentryContext): Promise<void> {
  const dsn = parseSentryDsn(Deno.env.get("SENTRY_DSN") || "");
  if (!dsn) return;
  const event = {
    event_id: eventId(),
    timestamp: Date.now() / 1000,
    platform: "other",
    level: ["failed", "blocked"].includes(context.status) ? "error" : "warning",
    message: `Growdash sync ${context.status}`,
    release: context.codeVersion || Deno.env.get("SENTRY_RELEASE") || Deno.env.get("GIT_SHA") || undefined,
    environment: Deno.env.get("SENTRY_ENVIRONMENT") || "production",
    tags: {
      sync_run_id: context.syncRunId || "unknown",
      provider: context.provider,
      status: context.status,
      error_code: context.errorCode || "none",
      trigger_source: context.triggerSource || "unknown",
      scope_key: context.scopeKey || "unknown",
    },
    extra: {
      duration_ms: context.durationMs ?? null,
      retry_count: context.retryCount ?? 0,
      records_read: context.recordsRead ?? 0,
      records_upserted: context.recordsUpserted ?? 0,
      // Error text can contain provider PII. Keep only a boolean; the stable
      // error_code above is the searchable diagnostic contract.
      error_message_present: Boolean(context.errorMessage),
    },
  };
  const header = {
    event_id: event.event_id,
    sent_at: new Date().toISOString(),
    sdk: { name: "growdash-sync", version: "sync-v1" },
  };
  const body = `${JSON.stringify(header)}\n${JSON.stringify({ type: "event" })}\n${JSON.stringify(event)}\n`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_500);
  try {
    const response = await fetch(`${dsn.endpoint}?sentry_version=7&sentry_key=${encodeURIComponent(dsn.publicKey)}&sentry_client=growdash-sync`, {
      method: "POST",
      headers: { "content-type": "application/x-sentry-envelope" },
      body,
      signal: controller.signal,
    });
    if (!response.ok) return;
  } catch {
    // Observability is non-blocking by contract.
  } finally {
    clearTimeout(timeout);
  }
}
