# Growdash — auditoria de problemas percebidos pelo usuário (rerun)

Data: 2026-10-23 (America/Sao_Paulo)
Escopo: experiência autenticada, métricas Meta/RD, carregamento, temas claro/escuro, Saúde dos Dados, segurança operacional, performance e cobertura de entrega.
Base verificada: `main` no commit `5b972a6`, alinhada com `origin/main`, árvore limpa.

## Veredito executivo

O front-end está publicável e os testes locais estão verdes, mas ainda há riscos de decisão incorreta para o usuário:

1. O `/crm` mostra vendas e faturamento RD enquanto o `/painel-expert` pode mostrar faturamento, ROAS, lucro e margem como indisponíveis no mesmo escopo.
2. A reconciliação RD possui caminho de até 50 s e o timeout aparece como erro, mesmo quando há snapshot anterior válido.
3. A paridade Meta/RD não está comprovada: a Saúde dos Dados mostrou 23 vendas RD, 12 vinculadas e 11 sem linha financeira.
4. O modo claro tem contraste insuficiente no wordmark e no badge “Somente leitura”.
5. Saúde dos Dados, Campanhas e algumas integrações ainda podem comunicar zero, global ou “saudável” quando a consulta está pendente, incompleta ou falhou.

Nenhum destes achados autoriza declarar paridade completa ou sincronização em tempo real. A próxima correção deve tratar disponibilidade, procedência e escopo como contrato único.

## Estado de validação

- `npm test -- --run`: 137 arquivos / 602 testes aprovados.
- `npx tsc --noEmit`: aprovado.
- `npm run lint`: 0 erros; 20 avisos preexistentes de Fast Refresh.
- `npm run build`: aprovado.
- `npm run test:visual -- --workers=1`: 60 testes; 6 passaram e 54 foram pulados por ausência de `GROWDASH_AUTH_STATE`.
- Produção `https://growdash.com.br`: HTTP 200 e headers CSP, HSTS, X-Frame-Options e nosniff presentes.
- Bundle local e produção: `assets/app-BZuXkHjw.js`, SHA-256 `096f9c75eabb2ed0c28a2eacfae42c2636aeda0c0b86354f5109cad95041655e`.
- O preview `f4e80bb6.growdash.pages.dev` ainda serve um bundle anterior; não tratar esse preview como evidência da versão canônica.
- Não foi obtido um SHA oficial do deployment Cloudflare; a correspondência foi validada pelo hash do asset.

## Achados por impacto

### P1 — KPIs financeiros não têm um snapshot comum

**Evidência:** na conta `CA02 - DRA RANNIELY SILVA [GRUPO ZNTT]`, período `16/10/2026–22/10/2026`, `/crm` carregou 50 negociações, 7 ganhos e `R$ 59.500,00` de faturamento líquido. No `/painel-expert`, o mesmo escopo carregou investimento `R$ 1.521,45`, 46 leads e CPL `R$ 33,07`, mas faturamento, ROAS, lucro e margem ficaram `Indisponível`.

**Impacto:** o usuário pode tomar decisão de mídia com tráfego disponível e retorno financeiro aparentemente ausente.

**Áreas:** `src/pages/Index.tsx`, `src/pages/ExpertDashboard.tsx`, `src/hooks/useNearRealtimeSync.ts`, `src/components/dashboard/widgets/FinancialOverviewWidgets.tsx`.

**Correção exigida:** um `AnalyticsSnapshot` único por workspace, conta, funil, período, timezone, janela de atribuição e definição de evento; todos os widgets devem consumir a mesma disponibilidade, procedência e timestamp.

### P1 — Timeout RD bloqueia a percepção de atualização

**Evidência:** `src/hooks/useNearRealtimeSync.ts` usa timeout de 50 s para chamadas Meta e RD. O erro é propagado como `rdSyncError`, embora o CRM mantenha dados anteriores válidos.

**Impacto:** espera longa, banner de erro contraditório e risco de o usuário repetir ações ou interpretar o snapshot como perdido.

**Correção exigida:** caminho crítico curto e não bloqueante; timeout visual separado do timeout de reconciliação; snapshot anterior rotulado como `stale`, com timestamp, duração e ação de tentar novamente.

### P1 — Paridade Meta/RD não comprovada

**Evidência:** `/saude-dos-dados` indicou reconciliação `partial`: 23 vendas RD, 12 vinculadas e 11 sem linha financeira. Também houve 2 negócios sem estado em 9 auditados.

**Impacto:** qualquer número de “paridade” pode misturar vendas orgânicas, registros sem atribuição e linhas financeiras ausentes.

**Correção exigida:** comparar somente o conjunto comparável, com a mesma conta, período, timezone, janela de atribuição e evento; exibir separadamente orgânico, parcial, sem linha e erro de fonte.

### P1 — Modo claro reduz legibilidade

**Evidência:** no modo claro, “GROWDASH” quase desaparece no cabeçalho do Painel Expert e o badge “Somente leitura” tem contraste muito baixo. No escuro, a leitura é adequada.

**Impacto:** perda de orientação e confiança, especialmente em monitores claros e brilho alto.

**Correção exigida:** tokens semânticos de tema e contraste WCAG AA para texto, badge, bordas, foco, estados desabilitados e gráficos; validar com screenshot e medição, não só com inspeção de classes.

### P2 — Saúde dos Dados pode parecer saudável quando uma consulta falha

**Evidência técnica:** `src/pages/DataHealth.tsx` possui consultas que extraem `data` sem tratar `error`. Falha de Supabase pode virar contagem vazia/zero. A query key e parte das consultas precisam manter escopo explícito.

**Impacto:** o usuário pode confiar em “sem evidência” ou contagens zeradas como se fossem dados reais.

**Correção exigida:** estado `error` distinto de `empty`, indicador por fonte e escopo na query key/filtro. Nunca transformar erro em zero.

### P2 — Auditoria RD ainda é cara em contas grandes

**Evidência técnica:** o fluxo de `rd_deals` já foi melhorado, mas qualquer agregação que carregue histórico antes de filtrar período permanece sensível a volume. O contrato deve exigir paginação server-side ou RPC auditável.

**Impacto:** Saúde dos Dados lenta e risco de truncamento/subcontagem.

**Correção exigida:** filtrar por período e conta no banco; paginar até página curta ou agregar em função auditável, com teste acima de 10.000 registros.

### P2 — Escopo de produtos/vendas depende demais de RLS implícita

**Evidência técnica:** `src/hooks/useProducts.ts` e `src/hooks/useSales.ts` fazem leituras/mutations com escopo explícito limitado. Migrations antigas usam políticas baseadas em `auth.uid() = user_id`.

**Impacto:** usuários do mesmo workspace podem ver dados incompletos, ou o contrato workspace/usuário pode divergir. Não é vazamento confirmado.

**Correção exigida:** teste com dois usuários e dois workspaces; documentar o modelo canônico e aplicar filtros/Policies coerentes, sem abrir acesso por `TO authenticated` isolado.

### P2 — Módulos anunciados ainda são placeholders

**Evidência:** `src/App.tsx` roteia Inbox, Planner, Conteúdo, Creator Marketing, Monetização, Eventos, Pesquisa, Configurações e Ajuda para `BusinessUnavailablePage`.

**Impacto:** expectativa de funcionalidade não entregue e tentativas sem resultado.

**Correção exigida:** ou implementar a jornada mínima, ou rotular explicitamente como beta/em breve com próximo passo real; não simular sucesso.

### P2 — Ações de Campanhas continuam indisponíveis

**Evidência:** `src/pages/Campaigns.tsx` mantém pausar/ativar, publicar, arquivar e excluir desabilitados com “Em breve”.

**Impacto:** o usuário pode confundir catálogo de leitura com gestão operacional.

**Correção exigida:** preservar modo somente leitura até haver API, permissões, confirmação e auditoria; tornar a limitação explícita na interface.

### P2 — Cobertura visual autenticada insuficiente

**Evidência:** os testes visuais pulam rotas protegidas sem `GROWDASH_AUTH_STATE`.

**Impacto:** regressões de tema, responsividade e estados de dados podem chegar à produção sem teste automático.

**Correção exigida:** sessão sintética e dados não produtivos no CI; rotas autenticadas em 390, 768 e desktop, claro/escuro, com screenshots comparáveis.

### P2 — Bundle/CSS grandes

**Evidência:** CSS principal ~824 KB bruto; maior chunk JS ~1,82 MB, com outros acima de 500 KB.

**Impacto:** parse/execução lentos e maior risco de tela presa em mobile.

**Correção exigida:** medir por rota antes/depois; lazy-load apenas onde a fronteira for segura (Quadro/3D/Excalidraw/Recharts), sem esconder o alerta aumentando limite.

### P2 — CI e observabilidade não estão comprovados

**Evidência:** não há `.circleci/config.yml`, pacote/configuração Sentry ou DSN detectável. Auditoria Sentry real exige `SENTRY_AUTH_TOKEN` local e não foi executada.

**Impacto:** falhas de produção podem não gerar alerta acionável; o pipeline de build/test/deploy não é verificável no repositório.

**Correção exigida:** decidir e documentar CircleCI ou alternativa; integrar Sentry somente com segredo local, release e source maps controlados.

### P2 — Advisors do Supabase exigem revisão

**Evidência:** `db push --linked --dry-run` está atualizado, mas advisors retornaram 104 avisos: funções `SECURITY DEFINER` executáveis por `anon`/`authenticated`, múltiplas Policies permissivas e proteção contra senhas vazadas desativada.

**Impacto:** superfície pública e autorização podem estar mais amplas do que o usuário espera.

**Correção exigida:** classificar cada função pública, restringir `EXECUTE`, fixar `search_path`, revisar RLS e decidir explicitamente a proteção de senha; não remover funções públicas sem contrato/migração.

### P2 — Dependências vulneráveis

**Evidência:** `npm audit --omit=dev` reportou 14 vulnerabilidades: 2 high, 9 moderate e 3 low, envolvendo `zod`, `lodash-es`, Excalidraw/Mermaid e Tailwind/PostCSS.

**Impacto:** risco de supply chain e necessidade de upgrades com possível regressão visual/funcional.

**Correção exigida:** atualizar em lotes pequenos, revisar lockfile, executar suíte, build e smoke tests do Quadro/Mermaid.

## Fluxos auditados

1. `/painel-expert` — tráfego carregado, KPIs financeiros indisponíveis no mesmo escopo e contraste ruim no claro.
2. `/crm` — dados RD visíveis, mas banner de timeout simultâneo.
3. `/campanhas` — catálogo disponível após espera; ações de escrita continuam “Em breve”.
4. `/saude-dos-dados` — diagnóstico parcial, jobs exibidos como “nunca” e histórico antigo ainda marcado como `running`.
5. Rotas Business — placeholders devem ser comunicados como limitação, não como fluxo quebrado.

## O que já está bom

- Testes, TypeScript, lint e build locais estão verdes.
- Produção responde com headers de segurança principais.
- A rolagem vertical da sidebar esquerda foi preservada e não deve ser alterada.
- O bundle atual foi conferido por hash no domínio canônico.
- A tentativa anterior de preservar snapshots durante refetch reduziu a conversão de estados válidos em zero; isso deve permanecer como contrato.

## Limites da auditoria

- Paridade completa Meta/RD não foi validada.
- Não foram executadas operações reais de escrita de campanhas.
- Não houve teste RLS com dois usuários/workspaces nesta rodada.
- Sentry não foi consultado sem token local; não pedir token colado no chat.
- A ausência de CircleCI/Sentry no repositório não prova ausência de configuração externa.
- A auditoria não autoriza alterar schema, Policies, OAuth ou integrações sem contrato e validação de produção.

## Critério de encerramento

Só considerar o problema resolvido quando houver snapshot único e escopado, estados de disponibilidade honestos, timeout RD não bloqueante, contraste claro validado, paridade comparável documentada, testes autenticados em três breakpoints/temas, verificação de dois usuários/workspaces, advisors tratados ou justificados, dependências avaliadas e produção conferida por asset manifest/hash.
