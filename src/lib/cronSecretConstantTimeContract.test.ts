import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const edgeFunctionPaths = [
  "../../supabase/functions/reconcile-sales-rd/index.ts",
  "../../supabase/functions/rd-enrich-states/index.ts",
  "../../supabase/functions/rd-resync-cron/index.ts",
  "../../supabase/functions/send-whatsapp-intelligence-report/index.ts",
  "../../supabase/functions/instagram-automation-run/index.ts",
  "../../supabase/functions/rd-backfill-touches/index.ts",
  "../../supabase/functions/monitor-oauth-health/index.ts",
];

const sources = edgeFunctionPaths.map((path) => ({
  path,
  source: readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8"),
}));

describe("Edge Functions — comparação de segredo em tempo constante", () => {
  it.each(sources)("$path não compara o cron secret com ===", ({ source }) => {
    // Comparar segredo com === vaza informação pelo tempo de resposta.
    // O repositório já tem o padrão correto em _shared/secretsMatch.ts,
    // usado por sales-webhook, daily-reconciliation e workflow-execute.
    expect(source).not.toMatch(/x-cron-secret"\)\s*===\s*/);
    expect(source).not.toMatch(/x-growdash-automation-secret"\)\s*===\s*/);
    // O service role key também é segredo: `bearer && bearer === serviceKey`
    // tem a mesma falha de timing.
    expect(source).not.toMatch(/bearer\s*&&\s*bearer\s*===\s*(SERVICE_ROLE_KEY|serviceKey|service)\b/);
    expect(source).not.toMatch(/bearer\s*===\s*(SERVICE_ROLE_KEY|serviceKey)\b/);
  });

  it.each(sources)("$path importa secretsMatch quando valida credencial", ({ source }) => {
    const validatesSecret = /x-cron-secret|SERVICE_ROLE_KEY|serviceKey/.test(source);
    if (!validatesSecret) return;
    expect(source).toContain("secretsMatch");
  });
});
