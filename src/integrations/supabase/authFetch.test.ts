import { describe, expect, it } from "vitest";
import { fetchAuthWithRetry, isPasswordGrantRequest } from "./authFetch";

const response = (status: number) => new Response(null, { status });

describe("Supabase password authentication transport", () => {
  it("allows the project password verification window to complete", async () => {
    let completed = false;
    const result = await fetchAuthWithRetry(
      "https://example.supabase.co/auth/v1/token?grant_type=password",
      { method: "POST", body: "{}" },
      {
        wait: async () => {},
        attemptTimeoutMs: 20,
        fetcher: async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          completed = true;
          return response(400);
        },
      },
    );

    expect(result.status).toBe(400);
    expect(completed).toBe(true);
  });

  it("only identifies the password grant", () => {
    expect(isPasswordGrantRequest("https://example.supabase.co/auth/v1/token?grant_type=password", { method: "POST" })).toBe(true);
    expect(isPasswordGrantRequest("https://example.supabase.co/auth/v1/token?grant_type=refresh_token", { method: "POST" })).toBe(false);
    expect(isPasswordGrantRequest("https://example.supabase.co/auth/v1/token?grant_type=password", { method: "GET" })).toBe(false);
  });

  it("retries gateway failures sequentially and returns the successful response", async () => {
    const statuses = [504, 200];
    let calls = 0;
    const result = await fetchAuthWithRetry(
      "https://example.supabase.co/auth/v1/token?grant_type=password",
      { method: "POST", body: "{}" },
      {
        wait: async () => {},
        attemptTimeoutMs: 1_000,
        fetcher: async (_input, init) => {
          expect(init?.signal).toBeInstanceOf(AbortSignal);
          return response(statuses[calls++]);
        },
      },
    );

    expect(result.status).toBe(200);
    expect(calls).toBe(2);
  });

  it("does not retry invalid credentials", async () => {
    let calls = 0;
    const result = await fetchAuthWithRetry(
      "https://example.supabase.co/auth/v1/token?grant_type=password",
      { method: "POST", body: "{}" },
      { wait: async () => {}, fetcher: async () => { calls += 1; return response(400); } },
    );

    expect(result.status).toBe(400);
    expect(calls).toBe(1);
  });
});
