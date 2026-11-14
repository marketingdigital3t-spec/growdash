import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../supabase/migrations/20261113190000_optimize_rd_attribution_and_link_sister_accounts.sql", import.meta.url),
  "utf8",
);

describe("20261113190000_optimize_rd_attribution_and_link_sister_accounts", () => {
  it("separa a busca de atribuição em dois passos (email e telefone) para evitar statement_timeout", () => {
    expect(migration).toContain("PASSO 1: Busca ultra-rápida por E-MAIL");
    expect(migration).toContain("PASSO 2: Se não encontrou por e-mail, busca por TELEFONE");
    expect(migration).not.toContain("(email_key IS NOT NULL AND lower(nullif(btrim(m.email), '')) = email_key) OR (phone_key IS NOT NULL AND public.growdash_normalize_phone(m.phone) = phone_key)");
  });

  it("estabelece vínculo e conexão para a CA02 da Natália", () => {
    expect(migration).toContain("act_975324268974435");
    expect(migration).toContain("CA02 - DRA NATÁLIA BARRAGÃO [GRUPO ZNTT]");
    expect(migration).toContain("ON CONFLICT (user_id, external_account_id) DO UPDATE");
  });

  it("vincula funis da Natália que estejam sem ad_account_id", () => {
    expect(migration).toContain("name ILIKE '%Natália Barragão%'");
    expect(migration).toContain("UPDATE public.rd_deals d");
  });

  it("reativa conexões e funis do RD Station para corrigir o status desconectado", () => {
    expect(migration).toContain("UPDATE public.rd_account_connections");
    expect(migration).toContain("SET status = 'connected'");
    expect(migration).toContain("UPDATE public.rd_funnels");
    expect(migration).toContain("SET is_active = true");
  });

  it("recupera o histórico completo de etapas em rd_deals a partir de rd_funnel_stages", () => {
    expect(migration).toContain("RECUPERAR O HISTÓRICO DE ETAPAS DO RD STATION EM TODAS AS CONTAS");
    expect(migration).toContain("FROM public.rd_funnel_stages s");
    expect(migration).toContain("WHERE d.rd_stage_id = s.rd_stage_id");
    expect(migration).toContain("rd_stage_name = s.name");
  });
});
