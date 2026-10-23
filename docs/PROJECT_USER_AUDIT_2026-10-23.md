# Growdash — auditoria de problemas percebidos pelo usuário

Data: 2026-10-23 (America/Sao_Paulo). Escopo: front-end, fluxos autenticados, contratos de métricas, integrações visíveis e confiabilidade de carregamento.
Status: correções de carregamento/paridade aplicadas localmente; validação automatizada concluída; publicação desta rodada será feita após o commit isolado e a verificação autenticada.

## Resumo executivo

As correções locais agora propagam um contrato explícito de disponibilidade para os KPIs financeiros: carregando e indisponível não viram zero, enquanto snapshots antigos/parciais continuam visíveis. Saúde dos Dados passou a respeitar conta/workspace/período, a auditoria RD pagina até a última página e Campanhas diferencia carregamento de lista vazia. A validação autenticada em produção ainda é necessária.

Também foi reproduzido um timeout de reconciliação do RD Station que aparece para o usuário mesmo quando a tela mantém dados anteriores válidos. A troca de tema expôs outro estado problemático: os KPIs passaram de números para “Indisponível” e não se recuperaram durante a observação. O CSS não foi provado como causa; o que está provado é a perda aparente de disponibilidade durante a troca.

## Estado técnico verificado

- Branch `main` alinhada com `origin/main` (`0` à frente, `0` atrás).
- Commit local auditado antes da correção: `c90dd8f`.
- `npm test`: 124 arquivos / 572 testes aprovados após a correção.
- `npm run lint`: 0 erros / 20 avisos.
- `npm run build`: aprovado; Vite alerta para chunks acima de 500 KB.
- Produção `https://growdash.com.br/`: HTTP 200, CSP/HSTS/X-Frame-Options/nosniff presentes.
- Produção serve `/assets/app-DVVQvdVN.js` e `/assets/index-C_Pfr_mD.css`; o hash/commit Cloudflare não foi obtido.
- Não há configuração detectável de CircleCI ou Sentry no repositório.
- A CLI local do Supabase não está instalada; não houve consulta autenticada ao banco nem migration.

## Achados prioritários

### UX-001 — KPIs divergentes no mesmo escopo (P1, confirmado)

Rotas: `/`, `/crm`, `/painel-expert`. Na conta `CA02 - DRA RANNIELY SILVA`, período `01–23/10/2026`, o dashboard chegou a exibir faturamento `R$ 0`, vendas `0` e ROAS `0,00x`; o gráfico “Vendas por Pagamento” exibiu `R$ 76.500`; e o CRM exibiu 10 vendas, `R$ 76.500`, ROAS `18,98x` e lucro `R$ 72.469,03`.

Origem provável: `Index.tsx` agrega o snapshot canônico RD em um caminho, enquanto `PaymentChartWidget` agrega `sales` e `revenueDeals` em outro. O carregamento assíncrono permite que zero transitório seja mostrado junto de dados financeiros reais.

Risco: decisão financeira errada. Recomendação: contrato único de snapshot por workspace, conta, funil, período, timezone e atribuição; propagar o mesmo estado de loading/erro a todos os widgets; nunca renderizar zero quando a fonte está pendente.

### UX-002 — Timeout RD contradiz dados preservados (P1, confirmado)

Rotas: `/crm` e `/painel-expert`. Console: `[near-realtime-sync] RD reconciliation Error: Tempo de carregamento excedido.` No CRM, o banner dizia “Não foi possível consultar o RD Station para o período selecionado” enquanto a tela continuava exibindo 315 negociações, 10 ganhos, `R$ 76.500` e 3,17% de conversão.

Evidência de código: `src/hooks/useNearRealtimeSync.ts:117-120` e `:165-175` fazem duas chamadas com timeout de 50 s; `src/lib/resilience.ts:114-125` transforma a expiração em mensagem genérica. Recomendação: separar “dados atuais indisponíveis” de “último snapshot válido”, mostrar timestamp e duração, e investigar custo/duplicidade da reconciliação.

### UX-003 — Troca de tema muda disponibilidade aparente (P1, confirmado; causa do CSS não provada)

Em `/painel-expert`, o modo escuro inicialmente mostrou investimento de `R$ 4.030,97` e 346 leads. Após ativar o modo claro, várias métricas viraram “Indisponível”; após aguardar e voltar ao escuro, continuaram indisponíveis. O console registrou o timeout de reconciliação RD.

Recomendação: tema não deve invalidar ou substituir o snapshot; preservar dados durante rerender, instrumentar a mudança de tema e adicionar teste claro/escuro sem perda de KPIs.

### UX-004 — Saúde dos Dados mistura escopo filtrado e global (P1/P2, confirmado no código)

`src/pages/DataHealth.tsx` apresenta “diagnóstico por conta e período”, mas `useHealth()` usa query key fixa ["data-health"] e consulta `sales`, `rd_deals`, `insights`, `ad_accounts`, `integrations` e `account_lp_config` sem `workspaceId`, conta ou período. Só `useOperationalAudit()` aplica parte do filtro.

Risco: o usuário pode interpretar contagens globais como diagnóstico da conta/período selecionado. Recomendação: tornar workspace/conta/período parte da query key e dos filtros, ou rotular cada indicador como global; criar teste de contrato.

### UX-005 — Campanhas aparenta zero antes de carregar (P2, confirmado)

Em `/campanhas`, após cerca de 2,5 s havia 0 campanhas, `Atualizado —`, botão desabilitado e skeletons; após mais cerca de 5 s apareceram 49 campanhas e o botão foi habilitado.

Recomendação: mostrar etapa explícita (“consultando Meta…”), preservar último snapshot e não apresentar zero como estado final durante loading.

### PERF-001 — Bundle e CSS grandes (P2, confirmado)

Build: chunks aproximados de 1,82 MB, 1,06 MB e 685–662 KB; CSS principal ~824 KB bruto (~128 KB gzip). Isso aumenta parse/execução e risco de tela presa em mobile. Recomendação: code-splitting, lazy loading de Excalidraw/Three/Recharts e medição RUM por rota.

### DATA-001 — Auditoria RD corta acima de 10.000 registros (P2, confirmado no código)

`src/pages/DataHealth.tsx:125` usa `.limit(10000)` sem paginação. Acima desse volume, vendas e duplicidades podem ficar subcontadas. Paginar até o fim ou mover a agregação para função/consulta server-side auditável.

### DATA-002 — Escopo explícito ausente em leituras diretas (P2, suspeito; depende de RLS)

`src/hooks/useSales.ts` e partes de `useHealth()` consultam tabelas sem `workspace_id`/`user_id` explícito, confiando em RLS. Confirmar com dois workspaces e papéis distintos antes de classificar como vazamento ou mistura.

### QA-001 — Cobertura visual autenticada indisponível (P2, confirmado)

`npm run test:visual` executou 60 testes: 3 passaram, 54 foram pulados sem `GROWDASH_AUTH_STATE` e 3 tiveram timeout do runner em execução paralela. Os testes públicos reexecutados isoladamente com 1 worker passaram. Configurar sessão sintética e dados não produtivos em CI.

### OPS-001 — CI/observabilidade não detectados (P2, confirmado)

Não há `.circleci/config.yml`, pacotes/configuração `@sentry/*` ou DSN detectados. Decidir CircleCI/Sentry ou alternativa e documentar pipeline, smoke tests e alertas.

### OPS-002 — Commit servido em produção não verificável (P2, não verificável)

Produção responde HTTP 200 e tem headers de segurança, mas não foi possível obter o hash/commit Cloudflare. Supabase sem autenticação responde 401 e a CLI não está instalada. Não afirmar correspondência entre produção e `c90dd8f`.

### MAINT-001 — Avisos ESLint (P3, confirmado)

`npm run lint` termina com 0 erros e 20 avisos `react-refresh/only-export-components` (e uma diretiva sem efeito). Separar helpers/constantes de componentes em lote de manutenção.

## Correções executadas nesta rodada

- `src/lib/metricAvailability.ts` define `loading`, `fresh`, `stale`, `partial` e `unavailable`; Dashboard, cards financeiros e gráfico de pagamentos usam o mesmo estado.
- Falha/timeout do RD preserva o snapshot anterior, informa o horário disponível e mantém a ação de nova tentativa; troca de tema não limpa os dados em cache.
- Saúde dos Dados inclui workspace, conta e período na query key/filtros; vendas vinculadas por funil são consideradas e a auditoria operacional pagina em blocos de 1.000 sem teto de 10.000.
- Campanhas exibe skeleton enquanto a consulta ou o catálogo de contas ainda está pendente; “0 campanhas” só aparece após resposta concluída.
- Testes novos: `metricAvailability`, `pagination` e `campaignLoading`; a suíte completa passou com 124 arquivos e 572 testes.

### Continuação — 2026-10-23

- `src/lib/metaSnapshot.ts` centraliza a decisão de preservar um snapshot confirmado durante um refetch do mesmo escopo.
- `src/hooks/useMetaTrafficMetrics.ts` agora guarda o último snapshot confirmado por conta/campanha/período/janela/timezone; durante refetch ele expõe esse snapshot como `stale`, mantém `isLoading` falso para os consumidores e não converte Leads/CPL/conversão em “Aguardando sincronização”. Primeiro carregamento e escopo diferente continuam sem reutilização.
- Regressão adicionada em `src/lib/metaSnapshot.test.ts`: snapshot existente + refetch, ausência de snapshot e escopo diferente.
- Suíte atual: 125 arquivos / 576 testes aprovados; TypeScript e lint direcionado aprovados; lint completo terminou com 0 erros e 21 avisos preexistentes de Fast Refresh.
- Build atual aprovado; chunks maiores: 1,82 MB, 1,02 MB, 684 KB, 662 KB e 621 KB. O split existente mantém Charts/Layout/Supabase separados. Tentativa de separar Excalidraw/Three aumentou um chunk para 4,83 MB e foi revertida; não há fronteira segura adicional sem refatoração da rota Quadro/3D.
- Testes visuais públicos reexecutados com servidor aquecido: 6 passaram e 3 foram pulados por falta de credenciais autenticadas. A primeira execução fria teve 8 timeouts durante a compilação inicial do Vite; isso não foi classificado como regressão do front-end.

## Evidência por rota

1. `/` — carregou, mas apresentou a divergência de KPIs descrita em UX-001.
2. `/crm` — dados RD visíveis e banner de timeout simultâneo (UX-002).
3. `/painel-expert` — timeout no console e perda de disponibilidade ao alternar tema (UX-002/UX-003).
4. `/campanhas` — carregamento tardio de 49 campanhas (UX-005); tabela tem rolagem horizontal interna, sem overflow persistente do body observado.
5. `/saude-dos-dados` — contrato de filtro não acompanha todos os indicadores (UX-004/DATA-001).
6. `/financeiro` e `/integracoes` — estrutura de estados loading/erro existe no código, mas validação autenticada de dados reais ficou limitada pela ausência de sessão persistida no runner.

## Pontos positivos observados

- Build e suíte unitária estão verdes.
- Headers de segurança principais estão presentes em produção.
- Não foi reproduzido overflow horizontal persistente do body nos breakpoints públicos auditados; a sidebar esquerda permaneceu independente.
- Correções de acessibilidade anteriores (WhatsApp, automações, switches e Growdash Flow) estão cobertas por contrato.
- Não foram encontradas imagens visíveis sem alt na varredura anterior.

## Limitações

- Não foi validada paridade completa Meta/RD, OAuth, permissões, webhooks, WhatsApp, Google ou Supabase com operações reais.
- UX-003 não foi atribuído ao CSS; só a perda de disponibilidade durante o rerender foi reproduzida.
- Correções locais aplicadas: disponibilidade financeira, preservação/copy de snapshot RD, escopo e paginação da Saúde dos Dados, loading de Campanhas e testes puros de regressão.
- Performance: build continua alertando chunks acima de 500 KB; não foi feita refatoração especulativa sem uma fronteira de import segura.
- Ainda pendente: paridade real Meta/RD. A validação visual autenticada e a publicação do build desta rodada foram concluídas abaixo.

### Evidência final autenticada e publicação

- Sessão real em `https://growdash.com.br/`, conta `CA02 - DRA RANNIELY SILVA [GRUPO ZNTT]`, período `16/10/2026–22/10/2026`.
- Em claro e escuro, após alternar o tema e retornar, permaneceram numéricos: 46 Leads, `R$ 33,07` CPL, `R$ 59.500,00` faturamento, `R$ 1.521,45` investimento, `39,11x` ROAS, `R$ 255.000,00` previsão e 7 vendas. O banner RD continuou informando que o último snapshot foi preservado, sem converter valores em zero.
- Build validado publicado no Cloudflare Pages: `https://102bdcc0.growdash.pages.dev`.
- `growdash.com.br` e o preview responderam HTTP 200 em `/` e `/auth`; o SHA-256 do bundle `assets/app-qx_iN90H.js` foi idêntico localmente, no preview e no domínio canônico (`f71fa2457c20ed4f453bba826beed0be3c234c37f4b9e6813a7908c2943242e5`).

### Rodada de correção Meta/RD — 2026-10-23

- A largura fixa de `.growdash-safe-sidebar` foi removida para que os estados `w-16`/`w-[220px]` do menu não sejam sobrescritos por CSS global. A rolagem vertical da sidebar não foi alterada.
- Insights, contas e cobertura passaram a ser o núcleo do carregamento Meta. Ações e breakdowns continuam em segundo plano; com snapshot utilizável, os KPIs não ficam presos em loading.
- A chave de `useInsights` foi canonizada para compartilhar a mesma consulta entre escopo de conta única e lista equivalente. O segundo `useActionTotalsByAds` do Dashboard foi removido para evitar leitura duplicada.
- A reconciliação Meta × RD agora compara somente negócios RD com atribuição Meta confirmada e separa negócios orgânicos/parciais da diferença comparável.
- Foram adicionados testes de regressão para carregamento Meta, paridade e largura responsiva da sidebar.
- A checagem autenticada do primeiro deploy reproduziu o gargalo restante: a busca de `ads` para classificar ações Meta excedia 12 segundos. O caminho canônico agora reutiliza `adset_id` e `destination_type` já carregados em Insights, evitando duas consultas de catálogo redundantes; os consumidores do Dashboard e Painel Expert usam o mesmo atalho.
- Validação local desta rodada: `npx tsc --noEmit`, `npm run lint`, `npm run build` e `npm test -- --run` aprovados (136 arquivos / 596 testes). O checkout também contém arquivos locais não rastreados do trabalho de Loop Engineering; eles foram preservados e não fazem parte deste commit de front-end.
- Validação adicional do gargalo: 137 arquivos / 600 testes aprovados, TypeScript, lint e build aprovados. Pendente antes da entrega: commit/push desta segunda correção, publicação do `dist` atualizado no Cloudflare Pages e nova checagem autenticada do preview/domínio nos temas claro e escuro.

## Prompt de correção recomendado

Corrija os achados UX-001 a UX-005, DATA-001 e QA-001. Crie um contrato de snapshot por workspace/conta/funil/período/timezone/atribuição e faça Dashboard, CRM, Painel Expert, Financeiro e gráficos consumirem o mesmo estado. Diferencie carregando, indisponível, snapshot anterior e zero; timeout nunca pode virar zero. Preserve o snapshot durante troca de tema e escreva teste claro/escuro. Inclua escopo nas query keys e filtros de Saúde dos Dados, pagine RD além de 10.000, melhore o loading de Campanhas, reduza chunks >500 KB e configure Playwright autenticado em 390, 768 e desktop. Registre commit SHA/asset manifest no deploy e documente a decisão de CI/observabilidade. Preserve a rolagem da sidebar esquerda e não altere banco/migrations sem contrato explícito.

## Verificações executadas

- `git fetch origin --prune`: concluído; `main` alinhada com `origin/main`.
- `npm test`: 121/121 arquivos e 568/568 testes aprovados.
- `npm run lint`: 0 erros, 20 avisos.
- `npm run build`: aprovado com alertas de tamanho de chunks.
- `npm run test:visual`: 3 aprovados, 54 pulados e 3 timeouts sem sessão autenticada; testes públicos isolados com 1 worker aprovados.
- `git diff --check`: aprovado.
- Produção: HTTP 200 e headers de segurança conferidos; commit de origem ainda não verificável.
