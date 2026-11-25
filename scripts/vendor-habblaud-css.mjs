/**
 * Adapta o CSS vendorizado do Habblaud para a Growdash.
 *
 * O Habblaud original ocupa a janela inteira: as regras responsivas usam
 * `@media (max-width: Npx)`, que medem a janela. Na Growdash o escritorio
 * vive dentro da aba Agentes, num host mais estreito que a janela (a barra
 * lateral e a navegacao da plataforma ocupam espaco).
 *
 * Se as media queries continuarem medindo a janela, o escritorio recebera o
 * layout de celular numa janela larga, ou o layout de desktop numa janela
 * estreita. Este script troca as queries de LARGURA por queries de contêiner,
 * que medem o host do escritorio (`.habblaud-office-host`, declarado como
 * `container: office / inline-size` em `src/habblaud/office.css`).
 *
 * As queries que nao dependem de largura (`prefers-reduced-motion`,
 * `pointer`, `hover`) continuam como `@media`: elas falam do aparelho, nao do
 * tamanho do escritorio.
 *
 * O script e idempotente: rodar de novo nao muda nada.
 *
 * Uso (apos atualizar o upstream):
 *   node scripts/vendor-habblaud-css.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const cssPath = join(projectRoot, "src/habblaud/client/src/ui/styles.css");

/** Query que so fala de largura (e nao de aparelho). */
const WIDTH_ONLY = /^\(\s*(?:min-width|max-width)\s*:/i;

const HEADER = `/* ------------------------------------------------------------------
 * Arquivo adaptado (ver scripts/vendor-habblaud-css.mjs).
 *
 * As regras responsivas de largura foram trocadas de \`@media\` para
 * \`@container office\`: o escritorio na Growdash ocupa um host dentro da
 * aba Agentes, e a media query mediria a janela, nao o escritorio.
 * ------------------------------------------------------------------ */

`;

/** Uma media query vira container query quando so fala de largura. */
function isWidthOnly(query) {
  const parts = query.split(/\s+and\s+/i);
  return parts.length > 0 && parts.every((part) => WIDTH_ONLY.test(part.trim()));
}

const source = readFileSync(cssPath, "utf8");
// Ja adaptado: nao ha nada a fazer.
if (source.includes("@container office")) {
  console.log("CSS ja adaptedo (usa @container office). Nada a fazer.");
  process.exit(0);
}

let converted = 0;
let kept = 0;

const output = source.replace(/@media\s*([^{]+)\{/g, (match, rawQuery) => {
  const query = rawQuery.trim();
  if (!isWidthOnly(query)) {
    kept += 1;
    return match;
  }
  converted += 1;
  return `@container office ${query} {`;
});

writeFileSync(cssPath, HEADER + output, "utf8");
console.log(`queries convertidas para contêiner: ${converted}`);
console.log(`queries mantidas como @media (aparelho): ${kept}`);
