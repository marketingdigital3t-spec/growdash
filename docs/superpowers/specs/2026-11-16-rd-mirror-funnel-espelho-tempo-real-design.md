# Espelho do RD Station em Tempo Real — Design

## Intenção

A tela **Resumo de Performance** deve ser um espelho fiel do RD Station CRM: os mesmos
negócios, na mesma etapa, na mesma contagem, dentro do escopo selecionado. Hoje ela
diverge porque quatro defeitos independentes se somam, e a operação perde confiança nos
números.

A fonte oficial é o **RD Station**. O banco local é apenas o espelho persistido, sempre
rotulado com a data/hora da última confirmação.

## Decisões do usuário

1. **Fonte de verdade:** RD Station ao vivo. Divergência entre Growdash e RD precisa
   ser detectada e resolvida, nunca exibida como número final.
2. **Estado durante sync:** manter o último snapshot confirmado, exibir data/hora e um
   selo claro de sincronização pendente ou com erro. Nunca trocar números parcialmente.
3. **Etapas fora do desenho fixo:** manter etapa própria (ex.: `Stand By`, `Proposta`,
   etapa personalizada) em vez de forçar para `Novo Lead` ou `Conversa`.
4. **Frequência:** sincronização automática a cada 5 minutos, com ação manual
   `Atualizar RD` disponível.

## Causas raiz confirmadas

### 1. Escopo de funis por titularidade incorreto

`src/lib/rdAccountScope.ts` comparava palavras soltas do nome da conta. A conta
`CA02 - DRA RANNIELY SILVA [GRUPO ZNTT]` produzia os tokens `ranniely` e `silva`, que
casavam com funis de outra titular (`Dra. Ranniely Souza`). O pipeline da conta
selecionada recebia negociações estrangeiras.

Correção já aplicada: `expertSignature()` extrai a titularidade completa e o fallback
exige a correspondência integral.

### 2. Etapa resolvida pela chave incompleta

A tabela oficial `public.rd_funnel_stages` tem chave `(rd_funnel_id, rd_stage_id)`. O
frontend indexava o mapa de nomes apenas por `rd_stage_id`, então `Lead Novo` de um
funil sobrescrevia `Lead Novo` de outro e o negócio era classificado pela etapa do
funil errado.

Correção já aplicada: chave composta em `PerformanceSummaryPage`.

### 3. Oscilação por invalidação do Realtime

`useNearRealtimeSync` invalidava as queries a cada evento `postgres_changes`. O sync
do RD persiste centenas de linhas em micro-lotes, então cada lote disparava um refetch
completo e a tela repintava os números várias vezes por segundo.

Correção já aplicada: gate de invalidação em `nearRealtimeSyncPolicy.ts` que adia as
invalidações enquanto o sync corre e aplica uma única vez ao final.

### 4. Sincronização manual incompleta e silenciosa

`PerformanceSummaryPage.syncRD` filtrava funis por `scopedRDfunnelIds.includes(f.id)`,
ignorava o corpo de resposta da Edge Function e não cobria funis vinculados apenas por
`rd_connection_id`. Um botão que aparenta sincronizar e não sincroniza é pior do que
não existir.

## Objetivos

- O funil exibido tem os mesmos grupos e as mesmas contagens do RD Station para o
  funil, status e período selecionados.
- Etapas não mapeadas aparecem com o nome original do RD.
- O snapshot em tela nunca é um estado parcial de uma sincronização.
- A sincronização automática roda a cada 5 minutos por conexão RD com funil ativo.
- Falhas de sync são visíveis, com causa, última tentativa e ação de recuperação.

## Não objetivos

- Não reescrever o motor de atribuição Meta lead para RD.
- Não alterar a precificação, impostos ou regras de cancelamento de vendas.
- Não introduzir Redis, fila ou worker novo.
- Não migrar a página de login, autenticação ou o shell do dashboard principal.

## Regras de escopo do funil

A resolução de funis segue a precedência:

1. `ad_account_id` direto da conta selecionada.
2. Funis da conexão RD cujo `external_account_id` corresponde ao `act_` da conta.
3. Fallback por titularidade completa (`expertSignature`), apenas quando 1 e 2 não
   retornam nada e apenas com a assinatura integral.
4. Sem correspondência: escopo vazio explícito, nunca "todos os funis".

## Mapeamento de etapas

Cada etapa do RD mantém seu nome original. As colunas do funil são agrupadas por
`rd_stage_id` do funil selecionado:

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

Enquanto `state` for `syncing` ou `error`, o número exibido é o último confirmado, com
selo visível de pendência. Um estado de falha nunca produz `0`.

## Sincronização

- Intervalo automático: 5 minutos por conexão RD, alinhado ao ciclo do job existente.
- `Atualizar RD` força uma reconciliação histórica do funil selecionado, com loop
  resumível já existente na Edge Function.
- A resposta da Edge Function é lida: `partial`, `error` e `success` alteram o selo
  exibido.
- Funis vinculados por conexão (`rd_connection_id`) entram na fila mesmo sem
  `ad_account_id`.
- Em caso de `partial`, o cursor preserva o progresso e a próxima rodada continua de
  onde parou.

## Interface

Faixa superior com seis KPIs em uma linha no desktop, duas colunas no mobile:
Investimento total, Leads, CPL, Vendas, CAC e Taxa de conversão.

Bloco de funil abaixo com as etapas do RD agrupadas, cada linha exibindo nome original,
ícone e contagem. Etapas extras aparecem como linhas próprias, nunca somidas.

Cabeçalho do painel exibe:

- nome da conta e do funil selecionados;
- `Última confirmação: HH:MM` com origem `RD Station`;
- selo de estado: `sincronizando`, `snapshot de HH:MM` ou `falha ao sincronizar`;
- ação `Atualizar RD` e `Ver detalhes` para o diagnóstico.

## Arquivos previstos

- `src/lib/rdAccountScope.ts` — escopo por titularidade completa.
- `src/lib/rdStageBuckets.ts` — mapeamento puro de etapa para grupo, testável.
- `src/components/dashboard/PerformanceSummaryDashboard.tsx` — renderização por grupo.
- `src/pages/PerformanceSummaryPage.tsx` — contrato de leitura, selo de estado e sync.
- `src/hooks/useNearRealtimeSync.ts` — gate de invalidação.
- `src/lib/nearRealtimeSyncPolicy.ts` — política de coalescência.
- `supabase/functions/rd-sync-deals/index.ts` — fila por conexão e resposta observável.

## Critérios de aceite

Para o funil `Dra. Ranniely Silva – Aluna`, com `Data de criação: 01/11/2026 – 16/11/2026`:

- `Lead Novo` reflete a contagem do RD.
- `Sem contato` reflete a contagem do RD.
- `Em conversa` reflete a contagem do RD.
- `Oportunidade` reflete a contagem do RD.
- `Stand By` aparece como etapa própria quando o RD tiver essa etapa.
- Nenhum negócio de outra titular aparece.
- Trocar de conta, funil ou período não exibe o snapshot anterior.
- Um sync em andamento ou com falha mostra o último snapshot confirmado e um selo
  explicando o estado.
- Um erro de sync nunca aparece como zero.
- Os números não mudam sozinhos entre sincronizações confirmadas.

## Validação

1. Testes unitários para escopo, mapeamento de etapa, gate de invalidação e contrato de
   leitura.
2. Comparação manual com o RD Station para o mesmo funil, status e período.
3. Playwright em 375, 768 e 1440 px.
4. Dry-run da migration, aplicação pelo CI e verificação do bundle em produção.
