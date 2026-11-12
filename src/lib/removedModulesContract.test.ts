import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(
  fileURLToPath(new URL("../App.tsx", import.meta.url)),
  "utf8",
);
const layoutSource = readFileSync(
  fileURLToPath(new URL("../growdash/GrowdashLayout.tsx", import.meta.url)),
  "utf8",
);
const permissionsSource = readFileSync(
  fileURLToPath(new URL("../hooks/usePermissions.ts", import.meta.url)),
  "utf8",
);

const REMOVED_PATHS = [
  "/comandos",
  "/growdash-flow",
  "/midia-social",
  "/agenda-turmas",
  "/chamados",
  "/whatsapp",
  "/treinamento-agentes",
  "/leads-incompletos",
  "/automacoes",
  "/armazenamento",
  "/anuncios",
  "/marcas",
  "/produtos",
];

const REMOVED_PAGE_FILES = [
  "../pages/Comandos.tsx",
  "../pages/Funnelytics.tsx",
  "../growdash/SocialMediaPage.tsx",
  "../pages/AgendaTurmas.tsx",
  "../pages/WhatsApp.tsx",
  "../growdash/AgentTrainingPage.tsx",
  "../pages/LeadsIncompletos.tsx",
  "../growdash/StoragePage.tsx",
  "../growdash/AnnouncementsPage.tsx",
  "../pages/Products.tsx",
];

describe("Contrato das abas removidas da plataforma", () => {
  it("não registra nenhuma das rotas removidas no roteador", () => {
    for (const path of REMOVED_PATHS) {
      expect(appSource).not.toContain(`path="${path.slice(1)}"`);
    }
  });

  it("não mantém preloaders nem guards para as rotas removidas", () => {
    for (const path of REMOVED_PATHS) {
      expect(layoutSource).not.toContain(`"${path}"`);
    }
  });

  it("não redireciona permissões para as rotas removidas", () => {
    for (const path of REMOVED_PATHS) {
      expect(permissionsSource).not.toContain(`return "${path}"`);
    }
  });

  it("remove do projeto os arquivos exclusivos das abas desativadas", () => {
    for (const relativePath of REMOVED_PAGE_FILES) {
      const absolutePath = fileURLToPath(new URL(relativePath, import.meta.url));
      expect(existsSync(absolutePath)).toBe(false);
    }
  });
});
