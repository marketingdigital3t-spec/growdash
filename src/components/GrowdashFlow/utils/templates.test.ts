import { describe, expect, it } from "vitest";
import { createSqlTrafficFunnelTemplate, normalizeSqlTrafficFunnelElements } from "./templates";

describe("Growdash Flow SQL template", () => {
  it("keeps a dedicated header band above the four stages", () => {
    const elements = createSqlTrafficFunnelTemplate();
    const title = elements.find((element) => element.text === "FUNIL DE TRÁFEGO PAGO");
    const subtitle = elements.find((element) => element.text?.startsWith("Advantage+"));
    const stageCards = elements.filter((element) => element.type === "rectangle" && element.width === 260);

    expect(title).toMatchObject({ x: 92, y: 55, width: 1140, height: 32, autoSize: false });
    expect(subtitle).toMatchObject({ x: 92, y: 92, width: 1140, height: 22, autoSize: false });
    expect(stageCards).toHaveLength(4);
    expect(Math.min(...stageCards.map((element) => element.y))).toBeGreaterThan(title!.y + title!.height);
  });

  it("normalizes the older saved SQL geometry without replacing element ids", () => {
    const original = createSqlTrafficFunnelTemplate().filter((element) => element.type !== "rectangle" || element.width !== 1220);
    const normalized = normalizeSqlTrafficFunnelElements(original);
    expect(normalized.some((element) => element.type === "rectangle" && element.width === 1220 && element.y === 20)).toBe(true);
    expect(normalized.find((element) => element.text === "FUNIL DE TRÁFEGO PAGO")?.autoSize).toBe(false);
    expect(normalized.find((element) => element.text === "FUNIL DE TRÁFEGO PAGO")?.id).toBe(original.find((element) => element.text === "FUNIL DE TRÁFEGO PAGO")?.id);
  });
});
