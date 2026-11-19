---
name: master-prompt-integracao-rd-crm
description: Prompt mestre para correção completa das integrações Meta Ads e RD Station CRM na Growdash
metadata:
  type: project
---

# Prompt Master — Correção completa das integrações Meta Ads e RD Station CRM (Growdash)

## Motivo (substitui / amplia)

Não há prompt mestre anterior neste repositório. Este arquivo consolida as quatro causas raiz confirmadas na integração RD Station CRM e o plano de correção. Foi criado a pedido do usuário, que solicitou ("resolva toda essa bossa de problema que eu estou tendo na minha plataforma, ou dados da integração do meta ads e do rd station crm esta tudo errado e bugando, corriga para mim urgente, use esse fluxo para fazer isso, mas primeiro cria um prompt master para executar o melhor e corrigir e depois aplique corrigindo tudo") a criação de um prompt master seguido da aplicação das correções.

## Contexto

A plataforma Growdash (`https://growdash.com.br`) exibe a tela **Resumo de Performance** que deve ser um espelho fiel do RD Station CRM: mesmos negócios, mesma etapa, mesma contagem, dentro do escopo selecionado. Hoje ela diverge porque quatro defeitos independentes se somam, e a operação perde confiança nos números. Além disso, a sincronização entre Meta Ads (investimento/leads) e RD Station CRM (negócios/vendas) está com dados divergentes: funis de contas erradas aparecem no escopo, etapas são classificadas pelo funil errado, a tela repinta durante o sync, e o botão "Atualizar RD" não cobre todos os funis.

## Causas raiz confirmadas (4)

1. **Escopo de funis por titularidade incorreto** — `src/lib/rdAccountScope.ts` comparava palavras soltas do nome da conta. A conta `CA02 - DRA RANNIELY SILVA [GRUPO ZNTT]` produzia tokens `ranniely` e `silva`, que casavam com funis de outra titular (`Dra. Ranniely Souza`). O pipeline da conta selecionada recebia negociações estrangeiras. Correção aplicada: `expertSignature()` extrai a titularidade completa e o fallback exige correspondência integral. Ainda falta: garantir que o escopo nunca seja "todos os funis" quando não houver correspondência.

2. **Etapa resolvida pela chave incompleta** — `public.rd_funnel_stages` tem chave `(rd_funnel_id, rd_stage_id)`. O frontend indexava o mapa de nomes apenas por `rd_stage_id`, então `Lead Novo` de um funil sobrescrevia `Lead Novo` de outro e o negócio era classificado pela etapa do funil errado. Correção aplicada: chave composta em `PerformanceSummaryPage`. Falta: garantir consistência em todos os consumidores (hooks, analytics).

3. **Oscilação por invalidação do Realtime** — `useNearRealtimeSync` invalidava as queries a cada evento `postgres_changes`. O sync do RD persiste centenas de linhas em micro-lotes, então cada lote disparava um refetch completo e a tela repintava os números várias vezes por segundo. Correção aplicada: gate de invalidação em `nearRealtimeSyncPolicy.ts` que adia as invalidações enquanto o sync corre e aplica uma única vez ao final.

4. **Sincronização manual incompleta e silenciosa** — `PerformanceSummaryPage.syncRD` filtrava funis por `scopedRDfunnelIds.includes(f.id)`, ignorava o corpo de resposta da Edge Function e não cobria funis vinculados apenas por `rd_connection_id`. Um botão que aparenta sincronizar e não sincroniza é pior do que não existir. Falha: a resposta da Edge Function (`partial`, `error`, `success`) não altera o selo exibido; funis vinculados por conexão entram na fila mesmo sem `ad_account_id`.

## Objetivos

- O funil exibido tem os mesmos grupos e as mesmas contagens do RD Station para o funil, status e período selecionados.
- Etapas não mapeadas aparecem com o nome original do RD.
- O snapshot em tela nunca é um estado parcial de uma sincronização.
- A sincronização automática roda a cada 5 minutos por conexão RD com funil ativo.
- Falhas de sync são visíveis, com causa, última tentativa e ação de recuperação.

## Não objetivos

- Não reescrever o motor de atribuição Meta lead para RD.
- Não alterar a precificação, impostos ou regras de cancelamento de vendas.
- Não introduzir Redis, fila ou worker novo.
- Não migrar a página de login, autenticação ou o shell do dashboard principal.

## Regras de escopo do funil (precedência)

1. `ad_account_id` direto da conta selecionada.
2. Funis da conexão RD cujo `external_account_id` corresponde ao `act_` da conta.
3. Fallback por titularidade completa (`expertSignature`), apenas quando 1 e 2 não retornam nada e apenas com a assinatura integral.
4. Sem correspondência: escopo vazio explícito, nunca "todos os funis".

## Mapeamento de etapas

Cada etapa do RD mantém seu nome original. As colunas do funil são agrupadas por `rd_stage_id` do funil selecionado:

| Grupo exibido | Critério |
|---|---|
| Novo Lead | etapa cujo nome normalizado contém `lead novo`, `novo lead` ou `novo` |
| Sem Conversa | `sem contato`, `sem conversa`, `nao atendeu`, `no show`, `sem resposta`, `tentativa`, `stand by`, `espera` |
| Conversa | `em conversa`, `conversa`, `atendimento`, `em contato`, `whatsapp` |
| Oportunidade | `oportunidade`, `proposta`, `negociacao` |
| Vendas | negócio ganho (`win`) ou etapa de venda |
| Perdidas | `perdido`, `perda`, `lost`, `desqualificado` |
| Etapa própria | qualquer outra etapa do RD, exibida com o nome original |

Uma etapa nunca é atribuída a dois grupos. A ordem de avaliação é fixa e testada.

## Contrato de leitura

Cada KPI do Resumo de Performance carrega:
- `value`: número observado;
- `observedAt`: instante da última sincronização confirmada;
- `source`: `rd_station` para funil e vendas, `meta` para investimento;
- `coverage`: presença de snapshot, escopo confirmado e data do snapshot;
- `state`: `fresh`, `stale`, `syncing`, `error`, `empty`.

Enquanto `state` for `syncing` ou `error`, o número exibido é o último confirmado, com selo visível de pendência. Um estado de falha nunca produz `0`.

## Sincronização

- Intervalo automático: 5 minutos por conexão RD, alinhado ao ciclo do job existente.
- `Atualizar RD` força uma reconciliação histórica do funil selecionado, com loop resumível já existente na Edge Function.
- A resposta da Edge Function é lida: `partial`, `error` e `success` alteram o selo exibido.
- Funis vinculados por conexão (`rd_connection_id`) entram na fila mesmo sem `ad_account_id`.
- Em caso de `partial`, o cursor preserva o progresso e a próxima rodada continua de onde parou.

## Interface

Faixa superior com seis KPIs em uma linha no desktop, duas colunas no mobile: Investimento total, Leads, CPL, Vendas, CAC e Taxa de conversão.

Bloco de funil abaixo com as etapas do RD agrupadas, cada linha exibindo nome original, ícone e contagem. Etapas extras aparecem como linhas próprias, nunca somidas.

Cabeçalho do painel exibe:
- nome da conta e do funil selecionados;
- `Última confirmação: HH:MM` com origem `RD Station`;
- selo de estado: `sincronizando`, `snapshot de HH:MM` ou `falha ao sincronizar`;
- ação `Atualizar RD` e `Ver detalhes` para o diagnóstico.

## Arquivos previstos / a tocar

- `src/lib/rdAccountScope.ts` — escopo por titularidade completa (já corrigido, verificar).
- `src/hooks/useResolvedRDAccountFunnelScope.ts` — cópia duplicada de rdAccountScope; manter sincronizada.
- `src/lib/rdStageBuckets.ts` — mapeamento puro de etapa para grupo, testável (criar se não existir).
- `src/components/dashboard/PerformanceSummaryDashboard.tsx` — renderização por grupo.
- `src/pages/PerformanceSummaryPage.tsx` — contrato de leitura, selo de estado e sync (já corrigido em parte; verificar leitura da resposta da Edge Function).
- `src/hooks/useNearRealtimeSync.ts` — gate de invalidação (já corrigido, verificar).
- `src/lib/nearRealtimeSyncPolicy.ts` — política de coalescência (já corrigido, verificar).
- `supabase/functions/rd-sync-deals/index.ts` — fila por conexão e resposta observável (já robusto; verificar leitura da resposta no frontend).
- Testes unitários para escopo, mapeamento de etapa, gate de invalidação e contrato de leitura.

## Critérios de aceite

Para o funil `Dra. Ranniely Silva – Aluna`, com `Data de criação: 01/11/2026 – 16/11/2026`:

- `Lead Novo` reflete a contagem do RD.
- `Sem contato` reflete a contagem do RD.
- `Em conversa` reflete a contagem do RD.
- `Oportunidade` reflete a contagem do RD.
- `Stand By` aparece como etapa própria quando o RD tiver essa etapa.
- Nenhum negócio de outra titular aparece.
- Trocar de conta, funil ou período não exibe o snapshot anterior.
- Um sync em andamento ou com falha mostra o último snapshot confirmado e um selo explicando o estado.
- Um erro de sync nunca aparece como zero.
- Os números não mudam sozinhos entre sincronizações confirmadas.

## Validação

1. Testes unitários para escopo, mapeamento de etapa, gate de invalidação e contrato de leitura.
2. Comparação manual com o RD Station para o mesmo funil, status e período.
3. Playwright em 375, 768 e 1440 px.
4. Dry-run da migration, aplicação pelo CI e verificação do bundle em produção.

## Fluxo obrigatório (AGENTS.md)

1. Código local: verificar árvore Git, diff, arquivos relacionados e testes locais aplicáveis.
2. GitHub/remoto: consultar branch atual, `git fetch` e divergência com `origin/main`.
3. Cloudflare Pages: conferir o deployment de produção ativo, URL e hash/commit de origem.
4. Navegador: somente depois das três verificações anteriores, abrir a rota autenticada e testar o fluxo afetado.

Após uma correção: validar localmente, criar commit, enviar ao GitHub, publicar no Cloudflare e então repetir as verificações de Cloudflare e navegador.
