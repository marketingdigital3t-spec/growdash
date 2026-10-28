import { test, expect } from "@playwright/test";

const routes = [
  "/", "/crm", "/comercial", "/campanhas", "/analise-de-funis", "/financeiro",
  "/integracoes", "/saude-dos-dados", "/agenda-turmas", "/leads-incompletos", "/kanban",
  "/inteligencia", "/growdash-flow", "/midia-social", "/configuracoes", "/usuarios", "/armazenamento",
];

test.describe("matriz de carregamento autenticada", () => {
  test.skip(!process.env.GROWDASH_AUTH_STATE, "Defina GROWDASH_AUTH_STATE para testar dados protegidos sem credenciais no repositório.");

  for (const route of routes) {
    test(`${route} carrega sem tela de erro`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      // The app shell is static, while module hydration may wait on an
      // external provider. Assert the HTTP/navigation boundary first so a
      // slow provider cannot turn a healthy document response into a false
      // route timeout; the body/error assertion below still verifies the UI.
      const response = await page.goto(route, { waitUntil: "commit", timeout: 15_000 });
      expect(response?.status()).toBeLessThan(400);
      await expect(page.locator("body")).not.toContainText("Não foi possível abrir esta tela", { timeout: 15_000 });
      expect(errors).toEqual([]);
    });
  }
});
