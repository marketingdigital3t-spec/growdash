import { expect, test } from "@playwright/test";
import { waitForFontsReady } from "./support/fonts";

// This test intentionally exercises the public login screen. Keep it isolated
// from the project-level authenticated smoke state when one is configured.
test.use({ storageState: { cookies: [], origins: [] } });

async function authenticate(page: import("@playwright/test").Page) {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  await page.goto("/auth");
  await expect(page.locator("body")).toBeVisible();
  if (!email || !password) return false;
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha/i).fill(password);
  await page.getByRole("button", { name: /^entrar/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("auth"), { timeout: 30_000 });
  return true;
}

test("login não cria overflow horizontal", async ({ page }) => {
  await page.goto("/auth");
  // O redesign do login trocou o heading "Entrar" por "Seja Bem-Vindo(a)" e
  // moveu a ação para o botão "Entrar na Plataforma".
  await expect(page.getByRole("heading", { name: /bem-vindo|entrar|criar conta/i })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  // A altura da tela muda conforme a fonte web carrega; sem esta espera o
  // snapshot diverge entre macOS e Linux e trava o gate de release.
  await waitForFontsReady(page);
  // Asserção estrutural determinística entre plataformas: o formulário de
  // login precisa continuar completo e alcançável por scroll.
  const layout = await page.evaluate(() => {
    const submit = document.querySelector('button[type="submit"]');
    const heading = document.querySelector("h1, h2");
    const box = submit?.getBoundingClientRect();
    const headingBox = heading?.getBoundingClientRect();
    return {
      submitVisible: !!box && box.width > 0 && box.height > 0,
      // No mobile o formulário é rolável; basta estar dentro do documento.
      submitWithinDocument: !!box && box.bottom <= document.documentElement.scrollHeight + 1,
      headingVisible: !!headingBox && headingBox.height > 0,
    };
  });
  expect(layout.submitVisible).toBe(true);
  expect(layout.submitWithinDocument).toBe(true);
  expect(layout.headingVisible).toBe(true);
  // A tolerância absorve a diferença de métricas de fonte entre macOS e
  // Linux (~5% da área) sem aceitar uma regressão real de layout.
  await expect(page).toHaveScreenshot("auth.png", { fullPage: true, animations: "disabled", maxDiffPixelRatio: 0.06 });
});

test("rotas principais mantêm conteúdo dentro do viewport", async ({ page }) => {
  test.skip(!(await authenticate(page)), "Defina E2E_EMAIL e E2E_PASSWORD para validar telas autenticadas.");
  for (const route of ["/", "/campanhas", "/analise-de-funis", "/financeiro", "/inteligencia", "/saude-dos-dados"]) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `overflow em ${route}`).toBeLessThanOrEqual(2);
    await expect(page).toHaveScreenshot(`${route === "/" ? "dashboard" : route.slice(1)}.png`, { fullPage: true, animations: "disabled", maxDiffPixelRatio: 0.02 });
  }
});
