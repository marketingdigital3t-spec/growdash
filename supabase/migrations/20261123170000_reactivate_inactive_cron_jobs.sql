-- ============================================================================
-- Migration: 20261123170000_reactivate_inactive_cron_jobs.sql
--
-- PROBLEMA:
--   Seis dos sete jobs do pg_cron estavam com `active = false`, então nada
--   executava periodicamente:
--
--     growdash-fifteen-minute-sync          (sync incremental Meta/RD)
--     growdash-agent-office-15m             (orquestrador de agentes)
--     growdash-workflow-scheduler           (agendador de workflows)
--     growdash-whatsapp-followup-sweep      (follow-up de WhatsApp)
--     growdash-meta-oauth-health            (saude do OAuth da Meta)
--     growdash-expire-expert-questionnaire-links
--
--   O unico job ativo era `growdash-daily-reconciliation`, e ele falhava
--   desde 18/11/2026 — a partir do momento em que o Postgres passou a recusar
--   conexoes.
--
--   Sem o sync incremental, `rd-sync-deals` nunca era chamado: o catalogo de
--   campos do RD nao era reconciliado e nenhum dado de funil/venda era
--   atualizado no backend.
--
-- CAUSA:
--   A desativacao veio de fora do historico de migrations — nenhuma migration
--   do repositorio desativa jobs. O padrao e compativel com a desativacao
--   automatica que o Supabase aplica a jobs durante uma indisponibilidade
--   prolongada do banco.
--
-- CORRECAO:
--   Reativar os jobs existentes com `cron.alter_job`, sem recria-los: recriar
--   apagaria o historico de execucoes e poderia duplicar agendamento. A
--   operacao e idempotente — rodar de novo nao muda nada.
--
--   So jobs existentes e inativos sao tocados. A cadencia de cada um e
--   preservada; esta migration nao altera nenhum `schedule`.
--
-- Schemas lidos/escritos:
--   - cron.job (catalogo de jobs do pg_cron)
-- ============================================================================

DO $$
DECLARE
  job_row record;
BEGIN
  FOR job_row IN
    SELECT jobid, jobname
    FROM cron.job
    WHERE NOT active
  LOOP
    PERFORM cron.alter_job(job_row.jobid, active := true);
    RAISE NOTICE 'Job reativado: % (jobid %)', job_row.jobname, job_row.jobid;
  END LOOP;
END
$$;
