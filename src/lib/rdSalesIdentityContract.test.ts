import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  fileURLToPath(new URL("../../supabase/migrations/20261114120000_sales_rd_connection_identity.sql", import.meta.url)),
  "utf8",
);
const syncFunction = readFileSync(
  fileURLToPath(new URL("../../supabase/functions/rd-sync-deals/index.ts", import.meta.url)),
  "utf8",
);

describe("Identidade de receita RD por conexão", () => {
  it("adiciona rd_connection_id em sales", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS rd_connection_id uuid");
  });

  it("remove a identidade única global de rd_deal_id", () => {
    expect(migration).toContain("DROP CONSTRAINT IF EXISTS sales_rd_deal_id_unique");
    expect(migration).toContain("DROP INDEX IF EXISTS public.sales_rd_deal_id_idx");
  });

  it("cria identidade única por (rd_connection_id, rd_deal_id)", () => {
    expect(migration).toContain("sales_rd_connection_deal_uidx");
    expect(migration).toContain("ON CONFLICT (rd_connection_id, rd_deal_id)");
  });

  it("preenche a conexão da receita a partir do negócio RD, sem inventar vínculo", () => {
    expect(migration).toContain("SET rd_connection_id = deal.rd_connection_id");
    expect(migration).toContain("NOT EXISTS (");
  });

  it("a edge function grava e consulta a receita pela conexão do negócio", () => {
    expect(syncFunction).toContain("rd_connection_id: salesConnectionId");
    expect(syncFunction).toContain("scopeSalesToDeal");
    expect(syncFunction).toContain('.eq("rd_connection_id", salesConnectionId)');
  });
});

describe("Cursor de sincronização por conexão", () => {
  it("inclui a conexão RD na chave do cursor", () => {
    expect(syncFunction).toContain('funnel.rd_connection_id || "no-connection"');
  });

  it("remove cursors de escopos antigos sem conexão", () => {
    expect(syncFunction).toContain('.not("scope_key", "like", `${cursorPrefix}|%`)');
  });
});

describe("Orçamento de runtime durante a hidratação", () => {
  it("propaga o deadline para as chamadas de detalhe e contatos", () => {
    expect(syncFunction).toMatch(/processDeal[\s\S]*RD_REQUEST_ATTEMPTS,\s*runtimeDeadline/);
  });

  it("interrompe a hidratação antes de estourar o orçamento do gateway", () => {
    expect(syncFunction).toContain("if (Date.now() >= runtimeDeadline - 5000)");
  });
});
