import { describe, expect, it } from "vitest";
import { createAuthStorage, type AuthPersistenceMode } from "./authPersistence";

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
});
