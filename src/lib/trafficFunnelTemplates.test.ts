import { describe, expect, it } from "vitest";
import { getTrafficFunnelTemplates, trafficObjectives } from "./trafficFunnelTemplates";

describe("traffic funnel templates", () => {
  it("gera os quatro playbooks aprovados do Grupo ZNTT", () => {
    expect(trafficObjectives).toHaveLength(6);
    const all = trafficObjectives.flatMap((objective) => getTrafficFunnelTemplates(objective.id));
    expect(all).toHaveLength(24);
    for (const objective of trafficObjectives) expect(getTrafficFunnelTemplates(objective.id)).toHaveLength(4);
  });

  it("gera estágios sem placeholders pendentes", () => {
    for (const objective of trafficObjectives) {
      for (const template of getTrafficFunnelTemplates(objective.id)) {
        expect(template.stages.join(" ")).not.toMatch(/\{.+\}/);
      }
    }
  });
});
