import { describe, expect, it } from "vitest";
import { filterRDFunnelsBySearch, normalizeFunnelSearch } from "./rdFunnelSearch";

const funnels = [
  { name: "Bem - Plano Comercial Franqueados" },
  { name: "Instituto Carla Rezende - Antigo" },
  { name: "Instituto Palazzo" },
  { name: "Dra. Natália Barragão - Paciente Modelo" },
];

describe("busca de funis RD", () => {
  it("devolve todos os funis quando a busca está vazia", () => {
    expect(filterRDFunnelsBySearch(funnels, "")).toHaveLength(4);
    expect(filterRDFunnelsBySearch(funnels, "   ")).toHaveLength(4);
  });

  it("encontra um funil pelo nome", () => {
    expect(filterRDFunnelsBySearch(funnels, "palazzo")).toEqual([{ name: "Instituto Palazzo" }]);
  });

  it("ignora acentos e caixa na consulta", () => {
    expect(filterRDFunnelsBySearch(funnels, "NATÁLIA")).toHaveLength(1);
    expect(filterRDFunnelsBySearch(funnels, "natalia")).toHaveLength(1);
  });

  it("encontra por fragmento no meio do nome", () => {
    expect(filterRDFunnelsBySearch(funnels, "comercial")).toHaveLength(1);
    expect(filterRDFunnelsBySearch(funnels, "instituto")).toHaveLength(2);
  });

  it("devolve lista vazia quando nada corresponde", () => {
    expect(filterRDFunnelsBySearch(funnels, "nao-existe")).toEqual([]);
  });

  it("normaliza espaços nas pontas", () => {
    expect(normalizeFunnelSearch("  Kelly  ")).toBe("kelly");
  });
});
