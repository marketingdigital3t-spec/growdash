# Prompt master de auditoria e correção do backend Growdash

## Objetivo

Auditar e corrigir o backend da Growdash com evidência de código, teste local e publicação verificável. O resultado não pode depender de suposições sobre Meta, RD Station, WhatsApp, Google, Cloudflare ou Sentry.

## Contexto confirmado

- Backend: 81 Supabase Edge Functions, 284 migrations e integrações com Meta Graph, RD Station, WhatsApp/WAHA, Google Workspace, Instagram, HubSpot, OpenAI e workflows.
- O repositório usa `crm_leads`, `meta_leads`, `rd_deals`, `sales`, snapshots e eventos idempotentes como fontes de dados.
- Dados ausentes devem permanecer indisponíveis; nunca substituir erro, ausência ou timeout por zero, coleção vazia ou dado inventado.
- Funções com `verify_jwt = false` precisam validar assinatura, segredo rotativo, service role ou segredo de cron dentro da própria função.

## Achados iniciais

1. `agent-office-chat` monta o período CRM em UTC literal e ignora o fuso do workspace. Em `America/Sao_Paulo`, isso desloca registros nas bordas do dia.
2. `sync-meta-hourly` chama a Graph API sem timeout/deadline compartilhado; retries podem exceder o runtime e deixar a cobertura horária incompleta.
3. `meta-webhook` faz resolução e enriquecimento com várias chamadas Graph sem timeout antes de confirmar o webhook; isso permite atraso e redelivery.
4. `workflow-execute` executa `http.request` sem timeout; endpoint externo lento prende o worker.
5. `whatsapp-webhook` ignora erros dos upserts de conversa, mensagem e follow-up e pode responder 200 depois de perder a persistência.
6. `whatsapp-webhook` aguarda WAHA/Meta/OpenAI na mesma requisição, aumentando redelivery e duplicação de resposta.
7. `sync-rd-crm` e `rd-reconcile-metrics` chamam `rd-sync-deals` sem timeout.
8. Há candidatos adicionais para validação: `sync-meta-transactions`, `historical-backfill`, `workflow-scheduler` e payload JSON inválido no webhook WhatsApp.
9. Cloudflare e comportamento live não são considerados confirmados sem token/deployment hash, assets correspondentes e teste autenticado.
10. `workflow-execute` e `instagram-automation-run` precisam limitar `social_accounts` ao workspace do workflow; linhas legadas sem `workspace_id` só podem ser aceitas quando pertencem ao ator autenticado.
11. Aprovações manuais precisam ser consumidas com update atômico; duas confirmações concorrentes nunca podem retomar a mesma execução.
12. Follow-ups e webhooks precisam reivindicar a linha antes dos efeitos e tratar timeout como estado incerto. Reabrir automaticamente uma mensagem já aceita pelo provedor pode duplicar comunicação.
13. Webhooks devem aceitar retry de eventos `received`/`failed`, confirmar `processed` somente depois da persistência/efeitos previstos e marcar falhas recuperáveis.
14. URLs configuráveis devem rejeitar IPv4/IPv6 alternativos, hosts privados e downloads sem limite antes de alocar o buffer.
15. Valores monetários de Meta/RD/vendas usam parser locale-aware; valor ausente ou inválido permanece nulo/indisponível e nunca vira zero silenciosamente.
16. O pipeline deve publicar todas as Edge Functions versionadas, validar o catálogo contra o checkout e exercitar cada função alterada; uma allowlist manual não é fonte de verdade.
17. Jobs globais (`daily_incremental_sync_runs`, `job_runs` e `sync_backfill_runs`) precisam de índice parcial único e tratamento explícito de `23505`; SELECT seguido de INSERT não é lock.
18. O CRM é um espelho do pipeline atual do RD: a conta Meta selecionada resolve o vínculo `conta Meta → rd_account_connections → rd_funnels`, e o quadro deve consultar o pipeline completo. O período civil limita os indicadores, não pode esconder negociações abertas do quadro. A sincronização parcial deve preservar o último snapshot e continuar recuperável por cursor.

## Invariantes de correção

- Toda chamada externa tem timeout explícito, deadline da operação e classificação de erro retryable.
- O deadline é compartilhado entre retries; nenhum retry pode ultrapassar o orçamento da função.
- Persistência crítica verifica `{ data, error }`; erro de gravação impede ACK de sucesso ou registra estado pendente idempotente.
- Webhooks persistem identidade/idempotência antes de executar efeitos lentos.
- Datas civis usam o fuso do workspace e intervalo semiaberto `[início, fim_exclusivo)`.
- Erros de fornecedor nunca são convertidos silenciosamente em zero, lista vazia ou sucesso.
- Controles de aprovação e de fila usam compare-and-set (`status` esperado + retorno afetado); replays e corridas são respostas idempotentes.
- Um timeout depois de um efeito externo é tratado como resultado incerto e exige reconciliação/outbox antes de nova tentativa.
- Consultas com service role repetem o escopo de workspace/ator no próprio filtro; RLS não é uma barreira suficiente quando o cliente usa service role.
- A superfície de rede é deny-by-default para URLs informadas por usuários; limites de tamanho são verificados antes de decodificar ou armazenar conteúdo.
- Valores financeiros preservam `null` quando não há fonte confiável; parsing brasileiro e americano é coberto por regressão.
- Campos de atribuição Meta só são gravados quando vieram do payload, catálogo ou API autorizada; ausência permanece nula.
- A tela CRM nunca pode transformar “sem negócios criados no período” em “pipeline vazio”: quadro, indicadores e estado de sincronização são contratos separados e devem exibir a origem/recorte de cada número.
- Toda mudança tem teste de regressão e passa por testes, TypeScript, lint, build, diff check, GitHub, Supabase/Edge Functions, Cloudflare e navegador autenticado.

## Método de execução

1. Ler o código, contratos, migrations, testes e estado Git antes de editar.
2. Registrar cada achado com entrada, principal inferior, recurso, controle, efeito observado, arquivo e linhas.
3. Corrigir a causa no ponto de origem com a menor mudança coesa.
4. Adicionar teste que reproduza o erro e teste o limite relevante.
5. Rodar os gates locais completos e revisar o diff para excluir alterações não relacionadas.
6. Publicar somente a revisão testada; confirmar origem do deployment, assets e o catálogo completo de funções publicado.
7. Fazer teste autenticado ou de webhook com fixture controlada; conferir banco, resposta, logs e Sentry.
8. Repetir a auditoria até não haver candidatos confirmados sem tratamento ou registrar bloqueio externo específico. Para qualquer efeito externo, registrar também se o resultado foi confirmado, rejeitado ou ficou incerto após timeout.

## Prompt de trabalho

> Você é responsável pelo backend da Growdash. Audite somente fatos verificáveis. Trace cada entrada até o banco, fornecedor, automação ou resposta. Para cada erro, nomeie a fronteira, o recurso afetado, a condição de reprodução, o resultado observado e a menor correção. Preserve snapshots válidos, não masque falhas com defaults vazios, não invente métricas e não publique sem validar a revisão. Reexecute a auditoria depois de cada correção e reporte separadamente: confirmado localmente, publicado, verificado em produção e bloqueado por credencial/ambiente.

## Critério de encerramento

A tarefa só pode ser marcada como concluída quando os testes e gates passarem, os achados confirmados tiverem regressão, a publicação tiver hash verificável e cada fluxo crítico tiver prova de runtime. Se o fornecedor não enviar um campo ou se a credencial/produção não puder ser observada, registrar o bloqueio com o próximo teste exato em vez de afirmar que está corrigido.
