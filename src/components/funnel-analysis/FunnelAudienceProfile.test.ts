import { describe, expect, it } from "vitest";
import { rdField } from "./FunnelAudienceProfile";

describe("RD audience fields", () => {
  it("reads source-prefixed custom fields preserved by the sync", () => {
    expect(rdField({ custom_fields: { contact_idade: "34", deal_sexo: "Feminino" } }, ["idade", "age"])).toBe("34");
    expect(rdField({ custom_fields: { deal_sexo: "Feminino" } }, ["sexo", "genero", "gender"])).toBe("Feminino");
  });

  it("does not treat a similarly named field as the requested attribute", () => {
    expect(rdField({ custom_fields: { contato_idade_do_filho: "8" } }, ["idade"])).toBeNull();
  });
});
