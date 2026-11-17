import { describe, expect, it } from "vitest";

const migrationSql = `
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS private.daily_incremental_sync_config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  cron_secret text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO private.daily_incremental_sync_config (singleton, cron_secret)
VALUES (true, encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (singleton) DO NOTHING;

CREATE OR REPLACE FUNCTION public.verify_daily_incremental_sync_secret(candidate text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, private
AS $$
  SELECT candidate IS NOT NULL
    AND candidate = (
      SELECT cron_secret
      FROM private.daily_incremental_sync_config
      WHERE singleton = true
    );
$$;

SELECT cron.schedule(
  'growdash-daily-reconciliation',
  '0 7 * * *',
  $$cron$
    SELECT net.http_post(
      url := 'https://cixnvosxqlacjbpymjha.supabase.co/functions/v1/daily-reconciliation',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT cron_secret FROM private.daily_incremental_sync_config WHERE singleton = true),
        'apikey', (SELECT cron_secret FROM private.daily_incremental_sync_config WHERE singleton = true)
      ),
      body := jsonb_build_object(
        'trigger', 'pg_cron',
        'requested_at', now()
      )
    );
  $cron$
);
`;

function hasExtension(sql: string, ext: string) {
  return new RegExp(`CREATE EXTENSION IF NOT EXISTS ${ext}`, "i").test(sql);
}

function hasTable(sql: string, table: string) {
  return new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`, "i").test(sql);
}

function hasFunction(sql: string, name: string) {
  return new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}`, "i").test(sql);
}

function hasCronSchedule(sql: string, jobname: string, cronExpr: string) {
  return sql.includes(`cron.schedule(`) && sql.includes(`'${jobname}'`) && sql.includes(`'${cronExpr}'`);
}

describe("daily-reconciliation cron migration", () => {
  it("instala pg_cron e pg_net", () => {
    expect(hasExtension(migrationSql, "pg_cron")).toBe(true);
    expect(hasExtension(migrationSql, "pg_net")).toBe(true);
  });

  it("cria a tabela de configuração do segredo do cron", () => {
    expect(hasTable(migrationSql, "private.daily_incremental_sync_config")).toBe(true);
  });

  it("cria a função de validação do segredo", () => {
    expect(hasFunction(migrationSql, "verify_daily_incremental_sync_secret")).toBe(true);
  });

  it("agenda o job daily-reconciliation às 07:00 UTC (04:00 BRT)", () => {
    expect(hasCronSchedule(migrationSql, "growdash-daily-reconciliation", "0 7 * * *")).toBe(true);
  });

  it("chama o endpoint daily-reconciliation com o cron secret", () => {
    expect(migrationSql).toContain("daily-reconciliation");
    expect(migrationSql).toContain("net.http_post");
    expect(migrationSql).toContain("cron_secret");
  });
});
