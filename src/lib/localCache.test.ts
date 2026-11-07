import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { purgeDiscardableLocalStorage, safeSetLocalStorage, writeLocalCache } from "./localCache";

/**
 * Regressao do crash "Nao foi possivel abrir esta tela" causado por
 * `QuotaExceededError` no localStorage do navegador.
 *
 * Quando o storage local estoura a cota, `localStorage.setItem` lanca
 * `QuotaExceededError`. Se a excecao escapar durante um `useEffect` ou um
 * render, o React inteiro colapsa na AppErrorBoundary e o usuario fica
 * preso numa tela preta sem poder recuperar.
 */

class FakeStorage {
  private data = new Map<string, string>();
  public full = false;

  get length() {
    return this.data.size;
  }

  key(index: number) {
    return Array.from(this.data.keys())[index] ?? null;
  }

  getItem(key: string) {
    return this.data.has(key) ? this.data.get(key)! : null;
  }

  setItem(key: string, value: string) {
    if (this.full) {
      const error = new Error("Failed to execute 'setItem' on 'Storage': Setting the value exceeded the quota.");
      error.name = "QuotaExceededError";
      throw error;
    }
    this.data.set(key, value);
  }

  removeItem(key: string) {
    this.data.delete(key);
  }

  clear() {
    this.data.clear();
  }
}

describe("armazenamento local resiliente a cota", () => {
  let storage: FakeStorage;

  beforeEach(() => {
    storage = new FakeStorage();
    (globalThis as any).window = globalThis;
    Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true, writable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as any).window;
  });

  it("safeSetLocalStorage nunca lanca QuotaExceededError", () => {
    storage.full = true;
    expect(() => safeSetLocalStorage("growdash:phase", '{"currentPhase":"terra"}')).not.toThrow();
    expect(safeSetLocalStorage("growdash:phase", "valor")).toBe(false);
  });

  it("safeSetLocalStorage remove caches descartaveis e tenta gravar de novo", () => {
    storage.setItem("growdash:rd-deals", "snapshot antigo");
    storage.setItem("growdash:last-sync", "timestamp");
    storage.setItem("growdash:global-filters", "filtros importantes");
    storage.full = true;

    // A primeira escrita falha, a purga libera espaco e a segunda tem sucesso.
    safeSetLocalStorage("growdash:phase", '{"currentPhase":"terra"}');
    storage.full = false;
    const written = safeSetLocalStorage("growdash:phase", '{"currentPhase":"terra"}');

    expect(written).toBe(true);
    expect(storage.getItem("growdash:phase")).toBe('{"currentPhase":"terra"}');
    expect(storage.getItem("growdash:global-filters")).toBe("filtros importantes");
  });

  it("purgeDiscardableLocalStorage remove caches quando o storage cresce demais", () => {
    storage.setItem("growdash:rd-deals", "x".repeat(1024));
    storage.setItem("growdash:last-sync", "y".repeat(1024));
    storage.setItem("growdash:workspace:user-1", "z".repeat(16));

    const purged = purgeDiscardableLocalStorage(100);

    expect(purged).toBeGreaterThan(0);
    expect(storage.getItem("growdash:rd-deals")).toBeNull();
    expect(storage.getItem("growdash:last-sync")).toBeNull();
    expect(storage.getItem("growdash:workspace:user-1")).toBeTruthy();
  });

  it("writeLocalCache continua seguro quando a cota estoura", () => {
    storage.full = true;
    expect(() => writeLocalCache("growdash:workspace:user-1", { id: "1" })).not.toThrow();
  });
});
