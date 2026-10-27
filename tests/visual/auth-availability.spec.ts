import { expect, test } from "@playwright/test";

// Never inherit the authenticated CI state here. This is the release gate for
// a new browser session and must exercise the same bootstrap path as a user
// who has just opened the login page.
test.use({ storageState: undefined });

test("login público fica disponível sem mascarar falha do Auth gateway", async ({ page }) => {
  const response = await page.goto("/auth", { waitUntil: "domcontentloaded" });

  expect(response?.status()).toBeLessThan(400);
  await expect(page.getByRole("heading", { name: /seja bem-vindo/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("textbox", { name: "E-mail" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Senha" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/não foi possível validar seu acesso|serviço de autenticação está temporariamente indisponível/i);
});
