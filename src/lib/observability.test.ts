import { describe, expect, it } from "vitest";
import * as mod from "./observability.ts";

describe("observability", () => {
  it("generateCorrelationId returns a valid UUID v4", () => {
    const id = mod.generateCorrelationId();
    expect(typeof id).toBe("string");
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("generateCorrelationId returns unique IDs", () => {
    const ids = new Set([mod.generateCorrelationId(), mod.generateCorrelationId()]);
    expect(ids.size).toBe(2);
  });

  it("extractCorrelationId returns existing x-correlation-id header", () => {
    const headers = new Headers({ "x-correlation-id": "abc-123" });
    expect(mod.extractCorrelationId(headers)).toBe("abc-123");
  });

  it("extractCorrelationId falls back to X-Correlation-Id", () => {
    const headers = { "X-Correlation-Id": "xyz-789" } as Record<string, string | null | undefined>;
    expect(mod.extractCorrelationId(headers)).toBe("xyz-789");
  });

  it("extractCorrelationId generates a new UUID when no header present", () => {
    const headers = new Headers({});
    const id = mod.extractCorrelationId(headers);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("withCorrelationHeaders adds x-correlation-id and x-request-id", () => {
    const base = { "content-type": "application/json" };
    const result = mod.withCorrelationHeaders(base, "corr-1");
    expect(result["x-correlation-id"]).toBe("corr-1");
    expect(result["x-request-id"]).toBe("corr-1");
    expect(result["content-type"]).toBe("application/json");
  });

  it("structuredLog includes correlation_id when provided", () => {
    const logged: string[] = [];
    const origLog = console.log;
    console.log = (msg: unknown) => logged.push(String(msg));
    try {
      mod.structuredLog({ level: "error", message: "falha na sincronização", correlationId: "corr-1", context: { retry: 3 } });
    } finally {
      console.log = origLog;
    }
    const parsed = JSON.parse(logged[0]);
    expect(parsed.level).toBe("error");
    expect(parsed.message).toBe("falha na sincronização");
    expect(parsed.correlation_id).toBe("corr-1");
    expect(parsed.context.retry).toBe(3);
    expect(parsed.ts).toBeDefined();
  });

  it("structuredLog works without correlationId", () => {
    const logged: string[] = [];
    const origLog = console.log;
    console.log = (msg: unknown) => logged.push(String(msg));
    try {
      mod.structuredLog({ level: "info", message: "iniciando job" });
    } finally {
      console.log = origLog;
    }
    const parsed = JSON.parse(logged[0]);
    expect(parsed.correlation_id).toBeUndefined();
    expect(parsed.level).toBe("info");
  });
});
