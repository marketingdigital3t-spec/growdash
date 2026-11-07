import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({
  storageState: '/Users/thiegojesus/Documents/Codex/PROJETOS – APP/Growdash/.auth/growdash.json',
  viewport: { width: 1440, height: 900 }, colorScheme: 'dark', locale: 'pt-BR',
});
const page = await ctx.newPage();
page.on('console', m => {
  if (m.type() === 'error' || m.text().includes('Error') || m.text().includes('fail')) {
    console.log(`[CONSOLE ${m.type().toUpperCase()}]`, m.text());
  }
});
page.on('pageerror', e => {
  console.log('[PAGE ERROR MESSAGE]', e.message);
  console.log('[PAGE ERROR STACK]', e.stack);
});

await page.goto('https://growdash.com.br/', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(6000);

const hasBoundary = await page.getByText('Não foi possível abrir esta tela').count();
console.log('Boundary visível:', hasBoundary > 0);

if (hasBoundary > 0) {
  // Inspeciona detalhes guardados no localStorage ou window
  const diag = await page.evaluate(() => {
    return {
      diagnostics: window.__growdash_diagnostics || null,
      lastError: window.__last_error || null,
      url: location.href,
      storage: Object.keys(localStorage),
    };
  });
  console.log('Diag:', JSON.stringify(diag));
}

await browser.close();
