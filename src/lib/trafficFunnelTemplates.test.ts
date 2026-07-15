import { describe, expect, it } from "vitest";
import { getTrafficFunnelTemplates, trafficObjectives } from "./trafficFunnelTemplates";

describe("traffic funnel templates", () => {
  it("gera dez funis para cada um dos seis objetivos", () => {
    expect(trafficObjectives).toHaveLength(6);
    const all = trafficObjectives.flatMap((objective) => getTrafficFunnelTemplates(objective.id));
    expect(all).toHaveLength(60);
    for (const objective of trafficObjectives) expect(getTrafficFunnelTemplates(objective.id)).toHaveLength(10);
  });

  it("gera estágios sem placeholders pendentes", () => {
    for (const objective of trafficObjectives) {
      for (const template of getTrafficFunnelTemplates(objective.id)) {
        expect(template.stages.join(" ")).not.toMatch(/\{.+\}/);
      }
    }
  });
});
