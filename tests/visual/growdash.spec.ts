import { expect, test } from "@playwright/test";

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
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page).toHaveScreenshot("auth.png", { fullPage: true, animations: "disabled" });
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
