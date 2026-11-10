import type { Page } from "@playwright/test";

/**
 * Aguarda o carregamento real das fontes web antes de capturar um snapshot.
 *
 * As fontes são empacotadas via @fontsource e não usam `font-display: block`.
 * Sem esta espera, o Playwright pode fotografar a página enquanto a fonte
 * ainda é a fallback do sistema — o resultado muda de altura entre macOS e
 * Linux e quebra o gate de release por um diff de poucos pixels que não é
 * uma regressão visual.
 */
export async function waitForFontsReady(page: Page) {
  await page.evaluate(async () => {
    if (!document.fonts) return;
    await document.fonts.ready;
    // `document.fonts.ready` resolve quando as fontes pendentes terminam.
    // Aguarda também as fontes já carregadas que ainda podem trocar o layout
    // no próximo frame.
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
  await page.waitForTimeout(250);
}
