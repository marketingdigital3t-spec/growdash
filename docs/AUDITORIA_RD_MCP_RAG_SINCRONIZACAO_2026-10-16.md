# Auditoria RD Station, integrações, MCP/RAG e sincronização

## Escopo

Auditoria do caminho RD Station → Edge Functions/Supabase → `rd_deals`/`sales`
→ hooks e telas de CRM, integrações, saúde e observabilidade. MCP, RAG e IA
foram tratados como leitores analíticos, nunca como fonte de números do CRM.

## Achados comprovados

| Área | Problema | Correção |
| --- | --- | --- |
| Semântica de venda | Diagnóstico contava `win=true` mesmo quando a etapa atual havia reaberto o negócio | Reutilizada `isCanonicalWonDeal`; etapa atual prevalece e `win` fica como fallback legado |
| Identidade | Agregações podiam contar linhas repetidas do mesmo negócio | Diagnóstico deduplica por conexão + ID do RD |
| Datas | Vendas eram filtradas apenas por `closed_at` em um consumidor | Usa fechamento e fallback de transição (`stage_updated_at`) dentro da janela |
| “Webhook” | `rd_deals.updated_at` era apresentado como evento HTTP do RD | Interface agora chama de atividade/atualização do espelho e informa a limitação |
| Watermark | Integrações consultava o último negócio global, sem escopo de conexão | Usa `rd_account_connections.last_success_at` da conexão visível |
| Falha parcial | Webhook marcava `last_success_at` após HTTP 200 mesmo com snapshot parcial | `sync-rd-crm` mantém o watermark anterior e devolve erro parcial |
| Limite Data API | Qualidade/atribuição ficavam truncadas em 1.000 linhas | Leituras observacionais paginam até página curta |
| Mapeamento duplicado | Webhook já falhava fechado em vínculos ativos ambíguos; índice único existe no contrato | Mantido, sem escolha arbitrária ou exclusão automática |

## O que foi verificado

- Histórico autenticado do mesmo escopo: `1.179` negócios e `24` na etapa
  `Venda Realizada` em RD e Growdash.
- Observabilidade publicada depois da paginação: base de `5.604` negócios
  (antes aparecia artificialmente como `1.000`).
- Domínio principal e preview serviram o mesmo bundle final.
- Endpoint `sync-rd-crm` sem segredo respondeu `401 Unauthorized`.
- Função `sync-rd-crm` ativa no Supabase: versão `20`.
- `npm test`: 94 arquivos / 473 testes aprovados.
- TypeScript, ESLint (0 erros), build Vite e `git diff --check` aprovados.

## Limites que permanecem explícitos

1. O banco não possui `rd_webhook_events`; não é possível provar no painel que
   um evento HTTP específico chegou do RD. Para isso, criar posteriormente uma
   tabela de metadados de eventos (sem payload/token), com idempotência,
   status, erro e `received_at`, e cobrir com RLS/testes.
2. “Vendas em campanhas” e “match de UTM” são métricas de atribuição Meta; não
   devem ser usadas para declarar que o total do RD está errado. O diagnóstico
   deve comparar sempre o mesmo funil, conexão, período e regra de data.
3. A validação de logs remotos de uma entrega real do RD depende de um evento
   autorizado do cliente; o teste público sem segredo confirma somente o
   bloqueio de autenticação.
4. O lint mantém 21 avisos preexistentes (Fast Refresh e um `useEffect` do
   WhatsApp); nenhum erro novo foi introduzido por esta auditoria.

## Prompt executado

O prompt mestre versionado em
`docs/PROMPT_MASTER_ESPELHO_RD_TEMPO_REAL_2026-10-16.md` contém o contrato,
checklist de execução, estados, regras de identidade/paginação, tratamento de
MCP/RAG e critérios de aceite para futuras mudanças.
