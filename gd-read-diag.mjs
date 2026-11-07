import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({
  storageState: '/Users/thiegojesus/Documents/Codex/PROJETOS – APP/Growdash/.auth/growdash.json',
  viewport: { width: 1440, height: 900 }, colorScheme: 'dark', locale: 'pt-BR',
});
const page = await ctx.newPage();
const errors = [];
page.on('console', m => {
  const t = m.text();
  if (m.type() === 'error' || t.includes('render error') || t.includes('Error')) {
    console.log(`[CONSOLE ${m.type().toUpperCase()}]`, t.slice(0, 300));
  }
});
page.on('pageerror', e => {
  console.log('[PAGE ERROR MESSAGE]', e.message);
  console.log('[PAGE ERROR STACK]', e.stack?.slice(0, 500));
});

await page.goto('https://growdash.com.br/', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(6000);

const storage = await page.evaluate(() => {
  return {
    sessionDiag: sessionStorage.getItem('growdash:runtime-diagnostics'),
    sessionRecovery: sessionStorage.getItem('growdash:runtime-recovery'),
    localKeys: Object.keys(localStorage),
    url: location.href,
    bodyText: document.body.innerText.slice(0, 300),
  };
});
console.log('STORAGE:', JSON.stringify(storage, null, 2));
await browser.close();
