import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const starfield = readFileSync(
  fileURLToPath(new URL("../cosmic/Starfield.tsx", import.meta.url)),
  "utf8",
);
const cosmicObject = readFileSync(
  fileURLToPath(new URL("../cosmic/CosmicObject.tsx", import.meta.url)),
  "utf8",
);
const fuelBar = readFileSync(
  fileURLToPath(new URL("./FuelBar.tsx", import.meta.url)),
  "utf8",
);
const phasePill = readFileSync(
  fileURLToPath(new URL("./PhasePill.tsx", import.meta.url)),
  "utf8",
);
const shipLevelCard = readFileSync(
  fileURLToPath(new URL("./ShipLevelCard.tsx", import.meta.url)),
  "utf8",
);
const headerBrand = readFileSync(
  fileURLToPath(new URL("./HeaderCosmicBrand.tsx", import.meta.url)),
  "utf8",
);
const globalFooter = readFileSync(
  fileURLToPath(new URL("./GlobalFooter.tsx", import.meta.url)),
  "utf8",
);
const layout = readFileSync(
  fileURLToPath(new URL("../../growdash/GrowdashLayout.tsx", import.meta.url)),
  "utf8",
);
const jornadaPage = readFileSync(
  fileURLToPath(new URL("../../pages/Jornada.tsx", import.meta.url)),
  "utf8",
);
const appSource = readFileSync(
  fileURLToPath(new URL("../../App.tsx", import.meta.url)),
  "utf8",
);

describe("ETAPA 2 — Contrato do Layout Global e Componentes Cósmicos", () => {
  it("renderiza o Starfield em Canvas 2D nativo sem dependência de three.js", () => {
    expect(starfield).toContain("<canvas");
    expect(starfield).toContain("getContext(\"2d\")");
    expect(starfield).toContain("requestAnimationFrame");
    expect(starfield).toContain("prefers-reduced-motion");
    expect(starfield).not.toContain("from \"three\"");
  });

  it("cria o elemento cósmico exclusivo para as três fases", () => {
    expect(cosmicObject).toContain("EarthCosmicObject");
    expect(cosmicObject).toContain("RingedPlanetCosmicObject");
    expect(cosmicObject).toContain("SpiralGalaxyCosmicObject");
    expect(cosmicObject).toContain("useEffectivePhase");
  });

  it("implementa a barra Combustível da Missão com gradiente de combustível e alerta 90%", () => {
    expect(fuelBar).toContain("Combustível da Missão");
    expect(fuelBar).toContain("gd-fuel-fill");
    expect(fuelBar).toContain("Próxima fase à vista");
    expect(fuelBar).toContain("formatCurrency");
  });

  it("renderiza a PhasePill com ponto pulsante neon", () => {
    expect(phasePill).toContain("animate-ping");
    expect(phasePill).toContain("FASE:");
    expect(phasePill).toContain("shadow-glow-sm");
  });

  it("exibe o ShipLevelCard com acesso à rota /jornada", () => {
    expect(shipLevelCard).toContain("NÍVEL DA NAVE");
    expect(shipLevelCard).toContain('to="/jornada"');
    expect(shipLevelCard).toContain("getPhaseProgress");
  });

  it("mantém o HeaderCosmicBrand sem travessão longo (em-dash)", () => {
    expect(headerBrand).toContain("|");
    expect(headerBrand).not.toContain("—");
    expect(headerBrand).not.toContain("–");
  });

  it("integra o Starfield, CosmicObject, FuelBar e Footer no layout da aplicação", () => {
    expect(layout).toContain("<Starfield />");
    expect(layout).toContain("<CosmicObject />");
    expect(layout).toContain("<HeaderCosmicBrand");
    expect(layout).toContain("<PhasePill />");
    expect(layout).toContain("<ShipLevelCard");
    expect(layout).toContain("<FuelBar");
    expect(layout).toContain("<GlobalFooter");
  });

  it("registra a rota /jornada no roteador principal", () => {
    expect(appSource).toContain('path="jornada"');
    expect(appSource).toContain("JornadaPage");
    expect(jornadaPage).toContain("Jornada da Nave");
    expect(jornadaPage).toContain("Rota Orbital das Fases");
  });
});
