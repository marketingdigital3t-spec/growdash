-- ============================================================================
-- Migration: 20261124140000_reactivate_inactive_cron_jobs.sql
--
-- PROBLEMA:
--   Seis dos sete jobs do pg_cron estavam com `active = false`:
--
--     growdash-fifteen-minute-sync                  (sync incremental Meta/RD)
--     growdash-agent-office-15m                     (orquestrador de agentes)
--     growdash-workflow-scheduler                   (agendador de workflows)
--     growdash-whatsapp-followup-sweep              (follow-up de WhatsApp)
--     growdash-meta-oauth-health                    (saude do OAuth da Meta)
--     growdash-expire-expert-questionnaire-links
--
--   O unico job ativo era `growdash-daily-reconciliation`. Como o sync
--   incremental nao rodava, `rd-sync-deals` nunca era chamado: o catalogo
--   de campos do RD nao era reconciliado, nenhum dado de funil/venda era
--   atualizado e a tela de Resumo de Performance exibia o aviso de que o
--   ultimo snapshot tinha sido preservado.
--
-- CAUSA:
--   A desativacao nao veio do historico de migrations — nenhuma delas
--   desativa jobs. O padrao e compativel com a desativacao automatica que
--   o Supabase aplica aos jobs durante uma indisponibilidade prolongada
--   do banco (o projeto ficou sem aceitar conexoes entre 22/11 e 24/11).
--
-- CORRECAO:
--   Reativar os jobs existentes com `cron.alter_job`, sem recria-los:
--   recriar apagaria o historico de execucoes e poderia duplicar
--   agendamento. A operacao e idempotente — rodar de novo nao muda nada.
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
