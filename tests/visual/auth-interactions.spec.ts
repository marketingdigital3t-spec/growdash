import { expect, test } from "@playwright/test";

// This suite is deliberately unauthenticated. A stored session can make
// getSession() look healthy while the Auth gateway is unavailable, which was
// the exact production failure that the authenticated route smoke missed.
test.use({ storageState: undefined });

test.describe("autenticação pública — interação e acessibilidade básica", () => {
  test("campos têm nome acessível e os fluxos de senha/cadastro são alcançáveis", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByRole("heading", { name: /seja bem-vindo/i })).toBeVisible();

    const email = page.getByRole("textbox", { name: "E-mail" });
    const password = page.getByRole("textbox", { name: "Senha" });
    await expect(email).toBeVisible();
    await expect(password).toBeVisible();

    await password.fill("segredo");
    await page.getByRole("button", { name: "Mostrar senha" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Ocultar senha" }).click();
    await expect(password).toHaveAttribute("type", "password");

    await page.getByRole("button", { name: "Esqueceu a senha?" }).click();
    await expect(page.getByLabel("E-mail para recuperação")).toBeVisible();

    await page.getByRole("button", { name: "Criar uma conta" }).click();
    await expect(page.getByRole("heading", { name: "Criar conta" })).toBeVisible();
    await expect(page.getByLabel("Nome completo")).toBeVisible();
    await expect(page.getByRole("checkbox")).toBeVisible();
  });
});
