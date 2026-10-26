# Contrato de confiabilidade da sincronização Meta ↔ RD

Versão: `sync-v1`

Este contrato é a fonte operacional para o frontend, Edge Functions, jobs, replay harness e loop engineering. O estado exibido só pode ser considerado confirmado quando existe uma execução auditada por `sync_run_id`.

## Origem canônica

- Meta Graph é a fonte de campanhas, conjuntos, anúncios, entrega, plataforma e posicionamento.
- RD Station é a fonte de negócios, etapas e receita do CRM.
- O Growdash mantém snapshots e reconciliação; ele não inventa valores ausentes.
- Macros não resolvidas (`{{...}}`) e strings vazias são convertidas em `null`.

## Atribuição

Cada lead pode carregar `campaign_id/name`, `adset_id/name`, `ad_id/name`, `platform`, `placement`, `form_id/name`, origem (`form` ou `conversation`), horário, ID Meta, ID RD e `sync_run_id`.

Atribuição é `captured` somente quando a hierarquia Meta, a entrega e a origem estão completas. Caso contrário é `partial`; campos desconhecidos permanecem `null`. Uma atualização incompleta nunca substitui uma atribuição válida anterior.

## Estados

- `running`: execução ainda aberta;
- `success`: fonte consultada e snapshot confirmado;
- `partial`: execução terminou com cobertura incompleta;
- `stale`: a tentativa falhou, mas o último snapshot válido foi preservado;
- `failed`: nenhuma resposta utilizável foi confirmada;
- `blocked`: credencial, permissão, contrato ou dependência impede a execução.

`failed` e `blocked` compõem o erro budget. `partial` e `stale` têm métricas e alertas próprios.

## Idempotência e recuperação

A chave é composta por provedor, conta, objeto, evento e escopo. O mesmo evento deve ser reprocessado sem criar uma segunda linha. Paginação grava cursores; retries usam backoff e limite; dead-letter e mensagens de erro não contêm tokens ou payloads crus.

## Evidência mínima

Toda execução registra `sync_run_id`, provedor, trigger, escopo, versão do contrato, versão do código, tentativa, contagem lida/upsertada, estado final, código de erro, avisos e timestamps. HTTP 200 ou uma mensagem de “sincronização iniciada” não é prova de sucesso.

Eventos de erro e degradação no Sentry carregam os mesmos identificadores e métricas,
sem payload bruto, token ou dado pessoal. A release só é promovida após testes,
migrations, source maps, smoke autenticado e verificação HTTP; falha do canário pede
rollback do deployment anterior e mantém a decisão como bloqueada até nova evidência.

## Contrato do agente e do loop

O agente pode executar somente reparos determinísticos que estejam listados no plano
de remediação e tenham pré-condição, teste e rollback. Ele não altera segredo,
permissão, RLS, migration destrutiva ou integração externa sem uma mudança versionada
e uma verificação explícita. `HTTP 200`, build concluído e mensagem de “sincronização
iniciada” são sinais de transporte; não são evidência de snapshot confirmado.

| Código | Severidade | Proprietário | Ação automática | Bloqueia promoção |
|---|---|---|---|---|
| `AUTH_REQUIRED` / `TOKEN_EXPIRED` | alta | integração/provedor | bloquear até reautenticação | sim |
| `PERMISSION_DENIED` | alta | provedor | bloquear até corrigir escopo | sim |
| `RATE_LIMITED` | média | provedor | retry com backoff e jitter | não |
| `PROVIDER_TIMEOUT` / `PROVIDER_UNAVAILABLE` | média/alta | provedor | preservar snapshot e retomar por cursor | não |
| `CONTRACT_INVALID` | crítica | contrato | dead-letter e bloquear promoção | sim |
| `DUPLICATE_EVENT` | baixa | integração | registrar reprocessamento idempotente | não |
| `SNAPSHOT_PRESERVED` | média | banco | manter último snapshot válido | não |
| `UNKNOWN` | alta | plataforma | dead-letter e revisão | sim |

Dados de origem ausentes ficam `null`. O agente não pode completar conjunto,
anúncio, plataforma ou posicionamento por nome, objetivo, campanha, horário ou
qualquer outra aproximação. Uma atualização incompleta só pode preencher campos
que vieram da fonte e nunca pode substituir um campo válido do snapshot anterior.
