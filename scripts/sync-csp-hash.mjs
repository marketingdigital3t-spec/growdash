/**
 * Keeps the Content-Security-Policy hash of the inline theme bootstrap in
 * sync with `index.html`.
 *
 * Cloudflare Pages serves `public/_headers` verbatim, and the strict CSP
 * blocks every inline script that is not explicitly allowed. The theme
 * bootstrap must run before the first paint to avoid a theme flash, so its
 * SHA-256 hash is allow-listed there.
 *
 * Run: `node scripts/sync-csp-hash.mjs`
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const htmlPath = join(projectRoot, "index.html");
const headersPath = join(projectRoot, "public", "_headers");

const html = readFileSync(htmlPath, "utf8");
const match = html.match(/<script>\s*\(function\(\)\s*\{[\s\S]*?<\/script>/);

if (!match) {
  console.error("Bootstrap script not found in index.html.");
  process.exit(1);
}

const script = match[0].replace(/^<script>/, "").replace(/<\/script>$/, "");
const hash = `sha256-${createHash("sha256").update(script, "utf8").digest("base64")}`;

const headers = readFileSync(headersPath, "utf8");
const existing = headers.match(/'sha256-[A-Za-z0-9+/=]+'/g) ?? [];

if (existing.includes(`'${hash}'`)) {
  console.log(`CSP already allows ${hash}.`);
  process.exit(0);
}

const updated = existing.length
  ? headers.replace(existing[0], `'${hash}'`)
  : headers.replace(/script-src ([^;]+);/, `script-src $1 '${hash}';`);

writeFileSync(headersPath, updated, "utf8");
console.log(`Updated public/_headers with ${hash}.`);
