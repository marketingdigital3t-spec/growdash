import { describe, expect, it } from "vitest";
import { getMetaSyncRange } from "./metaSyncRange";
import { businessDateKey } from "./businessDate";

describe("getMetaSyncRange", () => {
  it("limita a reconciliação manual aos últimos 36 meses", () => {
    expect(getMetaSyncRange(new Date("2026-08-20T12:00:00-03:00"))).toEqual({
      startDate: "2023-08-20",
      endDate: "2026-08-20",
    });
  });

  it("preserva o dia civil de São Paulo para hoje, mesmo em um host UTC", () => {
    const selected = new Date("2026-10-01T23:59:59.999-03:00");
    expect(businessDateKey(selected)).toBe("2026-10-01");
    expect(getMetaSyncRange(new Date("2026-10-01T23:30:00-03:00"), selected, selected)).toEqual({
      startDate: "2026-10-01",
      endDate: "2026-10-01",
    });
  });

  it("mantém o intervalo inclusivo e não desloca fim de mês", () => {
    expect(getMetaSyncRange(
      new Date("2026-11-01T01:00:00-03:00"),
      new Date("2026-10-31T00:00:00-03:00"),
      new Date("2026-10-31T23:59:59.999-03:00"),
    )).toEqual({ startDate: "2026-10-31", endDate: "2026-10-31" });
  });
});
