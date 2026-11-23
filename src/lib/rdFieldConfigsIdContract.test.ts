import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rdSyncDealsSource = readFileSync(
  fileURLToPath(new URL("../../supabase/functions/rd-sync-deals/index.ts", import.meta.url)),
  "utf8",
);

describe("rd-sync-deals — contrato do catálogo de campos do RD", () => {
  it("seleciona a coluna id usada no update do catálogo", () => {
    // O update filtra por .eq("id", existing.id). Sem a coluna id no select,
    // existing.id chega undefined, o PostgREST monta "?id=eq.undefined" e
    // responde 400 em toda atualização do catálogo.
    expect(rdSyncDealsSource).toContain(
      '.select("id, key, rd_source, rd_field_label, rd_field_aliases, field_type, options")',
    );
  });

  it("não atualiza o catálogo por uma chave que não veio do select", () => {
    // O select do catálogo e o update precisam ler a mesma chave primaria.
    const selectMatch = rdSyncDealsSource.match(
      /\.from\("rd_field_configs"\)\s*\.select\("([^"]+)"\)/,
    );
    expect(selectMatch).not.toBeNull();
    const selectedColumns = (selectMatch?.[1] ?? "").split(",").map((column) => column.trim());
    expect(selectedColumns).toContain("id");
  });

  it("mantem o update do catálogo filtrando pela coluna id", () => {
    expect(rdSyncDealsSource).toContain('.eq("id", existing.id)');
  });
});
