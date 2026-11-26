import { describe, expect, it } from "vitest";
import { createAuthStorage, readPersistedSession, type AuthPersistenceMode } from "./authPersistence";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

describe("auth persistence storage", () => {
  it("keeps an unchecked login in session storage", () => {
    const local = memoryStorage();
    const session = memoryStorage();
    let mode: AuthPersistenceMode = "session";
    const storage = createAuthStorage(local, session, () => mode, "auth-token");

    storage.setItem("auth-token", "temporary");

    expect(session.getItem("auth-token")).toBe("temporary");
    expect(local.getItem("auth-token")).toBeNull();
  });

  it("keeps a remembered login in local storage and removes the tab copy", () => {
    const local = memoryStorage();
    const session = memoryStorage();
    let mode: AuthPersistenceMode = "local";
    const storage = createAuthStorage(local, session, () => mode, "auth-token");
    session.setItem("auth-token", "old");

    storage.setItem("auth-token", "persistent");

    expect(local.getItem("auth-token")).toBe("persistent");
    expect(session.getItem("auth-token")).toBeNull();
  });

  it("auto-detects a session-only token after a reload", () => {
    const local = memoryStorage();
    const session = memoryStorage();
    session.setItem("auth-token", "temporary");
    const storage = createAuthStorage(local, session, () => "auto", "auth-token");

    expect(storage.getItem("auth-token")).toBe("temporary");
  });

  it("recovers a persisted session without trusting malformed data", () => {
    const storage = memoryStorage();
    storage.setItem("auth-token", JSON.stringify({
      access_token: "access",
      refresh_token: "refresh",
      expires_at: Math.floor(Date.now() / 1000) + 300,
      user: { id: "user-1" },
    }));

    expect(readPersistedSession(storage, "auth-token")?.access_token).toBe("access");

    storage.setItem("auth-token", JSON.stringify({ access_token: "expired-access", refresh_token: "refresh", expires_at: 1, user: { id: "user-1" } }));
    expect(readPersistedSession(storage, "auth-token")?.access_token).toBe("expired-access");
    storage.setItem("auth-token", "not-json");
    expect(readPersistedSession(storage, "auth-token")).toBeNull();
    storage.setItem("auth-token", JSON.stringify({ access_token: "access", refresh_token: "refresh", user: {} }));
    expect(readPersistedSession(storage, "auth-token")).toBeNull();
  });
});
