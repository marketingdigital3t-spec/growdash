import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST_ASSETS = join(process.cwd(), "dist", "assets");
const PLACEHOLDER_MARKERS = [
  "your-project-ref.supabase.co",
  "sb_publishable_placeholder",
  "your-supabase-anon-key",
  "your-supabase-service-role-key",
  "your-server-side-ai-key",
  "your-whatsapp-meta-app-secret",
];

function collectJsFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...collectJsFiles(full));
    else if (entry.endsWith(".js")) files.push(full);
  }
  return files;
}

describe("release bundle placeholder guard", () => {
  it("does not ship placeholder credentials as resolved values", () => {
    const files = collectJsFiles(DIST_ASSETS);
    if (files.length === 0) return;

    const offenders: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      for (const marker of PLACEHOLDER_MARKERS) {
        // Pré-filtro: só abre a varredura detalhada quando o marcador existe.
        if (!content.includes(marker)) continue;
        let index = content.indexOf(marker);
        while (index !== -1) {
          // O literal pode existir dentro da função que detecta placeholders.
          // Só é falha quando o placeholder é usado como valor resolvido.
          const context = content.slice(Math.max(0, index - 160), index + 80);
          const insideDetector = /includes\(|isPlaceholder|normalized|PLACEHOLDER|marker|replace\(|test\(/.test(context);
          if (!insideDetector) offenders.push(`${file}: ${marker}`);
          index = content.indexOf(marker, index + marker.length);
        }
      }
    }

    expect(offenders, `Bundle contém credenciais placeholder: ${offenders.join(", ")}`).toEqual([]);
  }, 60_000);
});
