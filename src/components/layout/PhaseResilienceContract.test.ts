import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Regressao do crash "Nao foi possivel abrir esta tela" (AppErrorBoundary).
 *
 * Causa raiz: `PHASES[phase]` era acessado diretamente por componentes do
 * shell (HeaderCosmicBrand, PhasePill, ShipLevelCard, GlobalFooter, FuelBar,
 * PhaseProvider, AchievementModal e MissionDashboard). Quando o estado
 * persistido em `localStorage["growdash:phase"]` nao correspondia ao enum
 * valido ("terra" | "orbita" | "galaxia"), a indexacao retornava undefined e
 * o acesso a `.label` / `.order` lancava TypeError durante o render do
 * shell. Como esses componentes vivem FORA da RouteErrorBoundary, a falha
 * escalava para a AppErrorBoundary e derrubava a plataforma inteira.
 *
 * A blindagem agora centraliza a sanitizacao em `sanitizePhase` e nos
 * acessores `getPhaseInfo` / `getPhaseSubtitle` / `getPhaseFuelCeiling`.
 */

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

const phaseEngine = read("../../lib/phase/phase.ts");
const phaseStore = read("../../lib/phase/phaseStore.ts");
const headerBrand = read("./HeaderCosmicBrand.tsx");
const phasePill = read("./PhasePill.tsx");
const shipLevelCard = read("./ShipLevelCard.tsx");
const globalFooter = read("./GlobalFooter.tsx");
const fuelBar = read("./FuelBar.tsx");
const phaseProvider = read("../phase/PhaseProvider.tsx");
const achievementModal = read("../phase/AchievementModal.tsx");
const missionDashboard = read("../dashboard/MissionDashboard.tsx");
const cosmicObject = read("../cosmic/CosmicObject.tsx");
const growdashLayout = read("../../growdash/GrowdashLayout.tsx");

const SHELL_COMPONENTS: Array<[string, string]> = [
  ["HeaderCosmicBrand", headerBrand],
  ["PhasePill", phasePill],
  ["ShipLevelCard", shipLevelCard],
  ["GlobalFooter", globalFooter],
  ["FuelBar", fuelBar],
  ["PhaseProvider", phaseProvider],
  ["AchievementModal", achievementModal],
  ["MissionDashboard", missionDashboard],
];

describe("Resiliencia do shell contra fase corrompida (AppErrorBoundary)", () => {
  it("o motor de fases expoe sanitizePhase e acessores publicos seguros", () => {
    expect(phaseEngine).toContain("export function sanitizePhase");
    expect(phaseEngine).toContain("export function getPhaseInfo");
    expect(phaseEngine).toContain("export function getPhaseSubtitle");
    expect(phaseEngine).toContain("export function getPhaseFuelCeiling");
  });

  it("useEffectivePhase sempre devolve uma Phase valida mesmo com storage corrompido", () => {
    expect(phaseStore).toContain("sanitizePhase(devOverride ?? currentPhase)");
  });

  it.each(SHELL_COMPONENTS)(
    "%s acessa a fase por acessor sanitizado em vez de indexacao direta",
    (_name, source) => {
      // Nenhum componente do shell pode indexar PHASES[phase] diretamente,
      // pois isso retorna undefined para um valor invalido persistido.
      expect(source).not.toMatch(/PHASES\[\s*phase\s*\]/);
    },
  );

  it("os componentes do shell importam a sanitizacao do motor de fases", () => {
    for (const [name, source] of SHELL_COMPONENTS) {
      expect(source, `${name} deve usar sanitizePhase ou getPhaseInfo`).toMatch(
        /sanitizePhase|getPhaseInfo/,
      );
    }
  });

  it("o CosmicObject decide a variante por comparacao, sem indexacao vulneravel", () => {
    expect(cosmicObject).toContain('phase === "terra"');
    expect(cosmicObject).not.toMatch(/PHASES\[\s*phase\s*\]/);
  });

  it("integra a FuelBar dentro da barra superior sem duplicar no cockpit nem criar faixa solta", () => {
    // A barra COMBUSTIVEL DA MISSAO fica integrada dentro do proprio header sticky
    // no topo, entre o titulo e a pill de fase, sem criar bloco solto embaixo.
    expect(growdashLayout).toContain('<FuelBar topbar');
    expect(growdashLayout).not.toContain(
      '{(pathname === "/" || pathname === "/painel-expert") && <FuelBar className="mb-4" />}',
    );
    expect(missionDashboard).not.toContain("<FuelBar />");
  });
});
