import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const overlaySource = readFileSync(
  fileURLToPath(new URL("./PhaseTransitionOverlay.tsx", import.meta.url)),
  "utf8",
);
const modalSource = readFileSync(
  fileURLToPath(new URL("./AchievementModal.tsx", import.meta.url)),
  "utf8",
);
const providerSource = readFileSync(
  fileURLToPath(new URL("./PhaseProvider.tsx", import.meta.url)),
  "utf8",
);

describe("ETAPA 4 — Evolução de Fase e Conquista Hexagonal", () => {
  it("implementa a animação cinematográfica de evolução pulável e acessível", () => {
    expect(overlaySource).toContain("PhaseTransitionOverlay");
    expect(overlaySource).toContain("SpaceRocket");
    expect(overlaySource).toContain("Nova Fase Desbloqueada");
    expect(overlaySource).toContain("Pular animação");
    expect(overlaySource).toContain("prefers-reduced-motion");
  });

  it("constrói o modal de conquista com insígnia hexagonal e compartilhamento", () => {
    expect(modalSource).toContain("AchievementModal");
    expect(modalSource).toContain("polygon");
    expect(modalSource).toContain("Insígnia de Conquista");
    expect(modalSource).toContain("Compartilhar");
    expect(modalSource).toContain("clipboard");
    expect(modalSource).toContain("Continuar missão");
  });

  it("orquestra a subida de fase dentro do PhaseProvider", () => {
    expect(providerSource).toContain("PhaseTransitionOverlay");
    expect(providerSource).toContain("AchievementModal");
    expect(providerSource).toContain("nextOrder > prevOrder");
  });
});
