import { describe, expect, it } from "vitest";
import { parseSentryDsn } from "../../supabase/functions/_shared/sentrySync";

describe("Sentry synchronization contract", () => {
  it("derives the envelope endpoint without exposing the secret", () => {
    expect(parseSentryDsn("https://public-key@example.ingest.sentry.io/12345")).toEqual({
      publicKey: "public-key",
      projectId: "12345",
      endpoint: "https://example.ingest.sentry.io/api/12345/envelope/",
    });
  });

  it("rejects malformed DSNs", () => {
    expect(parseSentryDsn("not-a-dsn")).toBeNull();
    expect(parseSentryDsn("https://example.ingest.sentry.io/12345")).toBeNull();
  });
});
