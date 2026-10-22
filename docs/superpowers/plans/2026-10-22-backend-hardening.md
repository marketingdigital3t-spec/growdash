# Plano de ação — hardening do backend

1. **Autenticação de webhooks**
   - Exigir segredo no editor antes de ativar.
   - Rejeitar linhas ativas sem hash.
   - Limitar corpo e validar JSON.
   - Pausar legados sem segredo via migration.

2. **Credenciais**
   - Revogar `SELECT` de `authenticated` em `growdash_workflow_credentials`.
   - Manter uso de credenciais somente em Edge Functions com `service_role`.
   - Criar posteriormente uma view de metadados se a UI precisar listar status/expiração.

3. **Scheduler**
   - Fazer claim condicional por vencimento.
   - Executar somente quando a linha for reivindicada pela instância atual.
   - Preservar idempotência de runs como segunda barreira.

4. **Validação**
   - Rodar testes, typecheck, build, ESLint direcionado e `git diff --check`.
   - Fazer deploy da migration/funções apenas após revisão e acesso aos segredos.
   - Revalidar produção com conta Meta e funil RD autenticados; sem isso, reportar bloqueio.
