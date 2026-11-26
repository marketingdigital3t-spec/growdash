import { describe, expect, it } from "vitest";
import { parseLocaleAmount } from "./financialAmount";

describe("parseLocaleAmount", () => {
  it("interpreta formatos brasileiro e americano", () => {
    expect(parseLocaleAmount("R$ 1.234,56")).toBe(1234.56);
    expect(parseLocaleAmount("1,234.56")).toBe(1234.56);
    expect(parseLocaleAmount("2400.00")).toBe(2400);
  });

  it("preserva ausência e entradas inválidas como indisponíveis", () => {
    expect(parseLocaleAmount(null)).toBeNull();
    expect(parseLocaleAmount("não informado")).toBeNull();
  });
});
