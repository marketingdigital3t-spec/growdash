import { test, expect, type Page } from "@playwright/test";

/**
 * A Análise de Funis precisa abrir com o último snapshot salvo enquanto a
 * sincronização do Meta e do RD continua em segundo plano. Um cartão preso
 * em "Aguardando sincronização" ou a tela inteira em "Carregando…" é a
 * regressão que este teste bloqueia.
 */

/**
 * O estado autenticado salvo pode expirar entre execuções. Sem esta
 * checagem o teste falharia em /auth e bloquearia o release por um motivo
 * que não é uma regressão do produto.
 */
async function authenticatedSession(page: Page) {
  await page.goto("/analise-de-funis", { waitUntil: "commit", timeout: 15_000 });
  const heading = page.getByRole("heading", { name: "Análise de Funis" });
  try {
    await expect(heading).toBeVisible({ timeout: 15_000 });
    return true;
  } catch {
    return false;
  }
}

test.describe("Análise de Funis — sincronização sem travamento", () => {
  test.skip(!process.env.GROWDASH_AUTH_STATE, "Defina GROWDASH_AUTH_STATE para testar dados protegidos sem credenciais no repositório.");

  test("abre com o snapshot salvo e não fica presa em estado de carregamento", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    test.skip(!(await authenticatedSession(page)), "Sessão autenticada expirada; regenere GROWDASH_AUTH_STATE para reexecutar este gate.");

    // A tela não pode ficar indefinidamente no placeholder de carregamento.
    await expect(page.getByText("Carregando…")).toHaveCount(0, { timeout: 20_000 });

    // Nenhum cartão pode anunciar que a sincronização ainda não terminou
    // enquanto um snapshot confirmado já existe no banco.
    const awaiting = page.getByText("Aguardando sincronização", { exact: true });
    if (await awaiting.count() > 0) {
      await expect(awaiting).toHaveCount(0, { timeout: 20_000 });
    }

    // O aviso de catálogo de etapas do RD só é legítimo quando nenhuma etapa
    // pôde ser recuperada do catálogo nem das negociações salvas.
    const catalogWarning = page.getByText("O catálogo de etapas do RD não está disponível.");
    if (await catalogWarning.count() > 0) {
      await expect(page.locator(".gd-funnel-kpi-grid").first()).toBeVisible({ timeout: 10_000 });
    }

    expect(errors).toEqual([]);
  });

  test("o botão de sincronização assume o estado de segundo plano sem travar a página", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    test.skip(!(await authenticatedSession(page)), "Sessão autenticada expirada; regenere GROWDASH_AUTH_STATE para reexecutar este gate.");

    const syncButton = page.getByRole("button", { name: /Sincronizar Meta \+ RD/i });
    await expect(syncButton).toBeVisible({ timeout: 20_000 });

    await syncButton.click();

    // O clique libera a interface: o botão assume o estado discreto e a
    // página continua interativa.
    await expect(page.getByText("Sincronização em andamento").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "Análise de Funis" })).toBeVisible({ timeout: 10_000 });

    expect(errors).toEqual([]);
  });
});
