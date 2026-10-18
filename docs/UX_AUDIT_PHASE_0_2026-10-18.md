# Growdash — Fase 0: auditoria visual completa

Data da auditoria: 18/10/2026  
Escopo: front-end/UX, sem alterar dados, métricas, lógica, APIs, rotas, autenticação, permissões ou sidebar.  
Base de código: `main` sincronizada com `origin/main` antes da auditoria.

## Limites de evidência

- O código local foi inspecionado com referências de arquivo e linha.
- As capturas anexadas pelo usuário nesta solicitação foram consideradas evidência visual de baseline. Os arquivos temporários não estavam disponíveis no filesystem no momento da auditoria, portanto não foram incorporados ao repositório.
- A sessão autenticada do Chrome existente não pôde ser reivindicada pelo navegador de auditoria; não foi feita uma alegação de screenshot autenticado novo.
- A produção respondeu `HTTP 200` em `https://growdash.com.br/`, mas headers HTTP não substituem inspeção visual autenticada.
- Esta fase é inventário: nenhum pixel ou comportamento de produto foi alterado.

## Inventário de rotas reais

As rotas abaixo foram confirmadas em `src/App.tsx:251-333`. Rotas de redirecionamento são marcadas para não serem auditadas duas vezes.

| Grupo | Rota | Implementação | Prioridade inicial |
|---|---|---|---|
| Público | `/auth` | `src/pages/Auth.tsx` | A |
| Público | `/termos`, `/privacidade`, `/cookies`, `/dpa`, `/sla`, `/cancelamento` | `src/pages/LegalPage.tsx` | C |
| Principal | `/` (Dashboard) | `src/pages/Index.tsx`, `src/pages/ExpertDashboard.tsx` | A |
| Principal | `/painel-expert` | `src/pages/ExpertDashboard.tsx` | B |
| Aquisição | `/campanhas` | `src/growdash/TrafficPage.tsx`, `src/pages/Campaigns.tsx` | A |
| Aquisição | `/inteligencia` | `src/growdash/IntelligenceCenterPage.tsx` | B |
| Aquisição | `/analise-de-funis` | `src/pages/FunnelAnalysis.tsx` | A |
| Aquisição | `/business/*` | `src/growdash/BusinessWorkspacePage.tsx` e páginas filhas | B |
| Relacionamento | `/crm` | `src/growdash/CrmPage.tsx` | A |
| Relacionamento | `/leads-incompletos` | `src/pages/LeadsIncompletos.tsx` | B |
| Relacionamento | `/kanban` | `src/growdash/KanbanPage.tsx` | B |
| Comercial | `/comercial` | `src/growdash/CommercialPage.tsx` | A |
| Financeiro | `/financeiro` | `src/growdash/FinancePage.tsx` | A |
| Operação | `/agenda-turmas` | `src/pages/EventClasses.tsx` | B |
| Operação | `/alertas` | `src/pages/Alerts.tsx` | B |
| Operação | `/automacoes`, `/chamados` | `src/growdash/ModulePage.tsx` | B |
| Operação | `/growdash-flow` | `src/pages/Funnelytics.tsx` | B |
| Operação | `/midia-social` | `src/growdash/SocialMediaPage.tsx` | B |
| Administração | `/configuracoes` | `src/pages/Settings.tsx` | B |
| Administração | `/integracoes` | `src/growdash/IntegrationsPage.tsx` | A |
| Administração | `/usuarios`, `/perfil` | `src/pages/Users.tsx`, `src/pages/Profile.tsx` | C |
| Administração | `/armazenamento` | `src/growdash/StoragePage.tsx` | B |
| Administração | `/marcas`, `/marcas/:brandId` | `src/growdash/ModulePage.tsx`, `src/growdash/BrandDiagnosticPage.tsx` | B |
| Administração | `/produtos` | `src/pages/Products.tsx` | C |
| Especializado | `/agentes`, `/gestor-trafego`, `/quadro`, `/whatsapp`, `/anuncios` | componentes `src/growdash/*` | C |

Aliases confirmados e não duplicados no inventário: `/dashboard` e `/dashboard/completo` → `/`; `/trafego-pago` e `/trafego-pago/gerenciador` → `/campanhas`; `/campaigns` → `/campanhas`; `/funnels` e `/analise-funis` → `/analise-de-funis`; `/classes` → `/agenda-turmas`; `/settings` → `/configuracoes`; `/users` → `/usuarios`; `/data-health` → `/saude-dos-dados`.

## Auditoria por tela e componente

Legenda: ✅ encontrado/sem bloqueio evidente no código; ⚠️ risco ou inconsistência a confirmar visualmente; ❌ problema confirmado no código. A coluna “linha” aponta o ponto de origem para a próxima fase.

| Tela / superfície | Espaçamento e grid | Tipografia / cor | Estados | Mobile / corte | Prioridade |
|---|---|---|---|---|---|
| Dashboard `/` | ❌ grid e cards usam várias classes utilitárias e gaps; `src/pages/Index.tsx:377-425`; `src/index.css:908-912` | ⚠️ tokens coexistem com valores literais; `src/index.css:32-95` | ✅ editor/loading e métricas existem | ⚠️ shell usa `min-h-screen` e canvas RGL precisa teste nas cinco larguras; `src/growdash/GrowdashLayout.tsx:553-577` | A |
| Dashboard KPI strip | ❌ label em `6.5px` e valor fluido fora da escala; `src/components/dashboard/DashboardGlassStrip.tsx:47-54` | ⚠️ cores semânticas estão aplicadas, mas tamanho é ilegível em telas estreitas | ✅ positivo/negativo/neutro | ⚠️ quebra de label pode alterar altura dos cards | A |
| Análise de funis | ❌ muitos cards usam `text-[10px]`, `text-[11px]`, `text-[13px]` e gaps variados; `src/pages/FunnelAnalysis.tsx:1-925` | ✅ cores de KPI negativas/positivas preservadas; ⚠️ escala não centralizada | ✅ empty/loading em componentes de funil | ⚠️ grids e tabelas requerem teste em 390px | A |
| Campanhas / Tráfego Pago | ❌ superfície extensa: 1.996 linhas e regras específicas em `src/pages/Campaigns.tsx`; tabela e toolbars têm vários modos de overflow | ⚠️ valores visuais e estados ad-hoc; `src/growdash/TrafficPage.tsx:1-471` | ✅ Intelligence e seleção existem; ⚠️ empty/error/loading precisam matriz única | ❌ risco confirmado de densidade, scroll contextual e corte por `GrowdashLayout.tsx:553-577` | A |
| CRM | ⚠️ componente monolítico de 1.290 linhas; grids/cards e controles precisam tokens | ⚠️ várias classes de fonte pequenas e cores literais | ✅ estados de carregamento e vazio parciais | ⚠️ kanban/tabelas exigem sticky/scroll em 390px | A |
| Comercial | ❌ cores e raios hardcoded em múltiplos blocos; `src/growdash/CommercialPage.tsx:361-387`, `394-395` | ❌ valores e labels usam `text-[9px]`, `text-[10px]`, `text-xs` sem escala única | ✅ focus mode e ranking vazio existem | ⚠️ ranking usa overflow/focus modal; validar mobile | A |
| Financeiro | ❌ tabelas usam `min-w-[620px]`, `min-w-[800px]`, gaps/paddings distintos; `src/growdash/FinancePage.tsx:344-370` | ❌ cores hex literais e tipografia compacta espalhadas | ✅ vazio de lançamentos/contas existe; ⚠️ loading varia | ⚠️ scroll interno correto em alguns pontos, mas precisa padrão | A |
| Integrações | ⚠️ cards e tabs precisam normalização de estados e espaçamento; `src/growdash/IntegrationsPage.tsx:1-512` | ⚠️ paleta semântica mistura tokens e hex | ✅ health/empty/error presentes em partes | ⚠️ tabs e tabelas precisam teste 390px | B |
| Alertas | ⚠️ lista e estados de alerta precisam padronizar densidade | ✅ semântica de severidade é requisito de preservação | ✅ estados principais existem | ⚠️ verificar notificações e toolbar em mobile | B |
| Agenda/Turmas | ⚠️ implementação de rota é wrapper curto (`src/pages/EventClasses.tsx:1-6`); tela real é carregada por módulo | AUSENTE: auditoria detalhada do módulo não pode ser atribuída sem confirmar import em runtime | ⚠️ precisa captura autenticada | ⚠️ não inferir corte sem tela | B |
| Leads incompletos | ⚠️ 222 linhas com tabela/filtros próprios; `src/pages/LeadsIncompletos.tsx` | ⚠️ escala pequena recorrente | ✅ empty/error aparentes | ⚠️ validar tabela e filtros em 390px | B |
| Kanban | ❌ componente monolítico de 2.249 linhas; várias superfícies e densidades | ❌ cores/radii literais e tamanhos específicos | ✅ drag feedback existe; matriz de erro/empty precisa revisão | ❌ risco alto de overflow horizontal intencional não delimitado | B |
| Configurações | ⚠️ rota curta/wrapper para `FullSettings`; `src/pages/Settings.tsx:1-75` | AUSENTE: tela efetiva precisa inspeção do módulo carregado | ⚠️ captura necessária | ⚠️ sem inferência de layout | B |
| Login | ❌ inputs de `h-16`, raio 2xl e tipografia `text-lg`, fora do sistema proposto; `src/pages/Auth.tsx:118-154` | ⚠️ precisa alinhar com tokens sem perder marca | ✅ erro e social login presentes | ⚠️ verificar 390px e teclado | A |
| Componentes globais | ❌ `src/index.css` tem 11.094 linhas, regras duplicadas e valores fora de escala; `src/index.css:513-1010` | ❌ não existe `src/styles/tokens.css`; cores literais aparecem em TSX | ✅ Button/Dialog/Toast/Skeleton existem em `src/components/ui` | ⚠️ regras globais `overflow-x: clip`; `src/index.css:327-337` precisam revisão cuidadosa | A |
| Shell global (sidebar/header) | ⚠️ shell é compartilhado por todas as rotas; `src/growdash/GrowdashLayout.tsx:368-577` | ✅ sidebar/header escuros devem ser preservados | ✅ menu mobile e transições existem | ⚠️ não alterar sidebar; somente contratos de conteúdo podem evoluir | A |

## Achados priorizados

### A — crítico para apresentação comercial

1. **Sistema de tokens ausente e CSS monolítico** — criar uma camada de tokens compatível em Fase 1 sem apagar tokens atuais. Fonte: `src/index.css:32-95`, `513-1010`; arquivo esperado `src/styles/tokens.css` está **AUSENTE**.
2. **Dashboard KPI strip ilegível/densa** — `6.5px` no label e valor fluido em `DashboardGlassStrip`. Fonte: `src/components/dashboard/DashboardGlassStrip.tsx:47-54`.
3. **Campanhas com superfície e overflow complexos** — `Campaigns.tsx` tem 1.996 linhas e o shell alterna `overflow-hidden`/altura de viewport. Fontes: `src/pages/Campaigns.tsx`, `src/growdash/GrowdashLayout.tsx:553-577`.
4. **Tabelas financeiras não compartilham densidade** — larguras mínimas e paddings diferentes. Fonte: `src/growdash/FinancePage.tsx:344-370`.
5. **Login fora da escala** — input de 64px e raio 16px, divergente do sistema futuro. Fonte: `src/pages/Auth.tsx:153`.
6. **Cores e raios hardcoded em telas comerciais** — especialmente Comercial e apresentações. Fontes: `src/growdash/CommercialPage.tsx:361-395`, `src/growdash/PaidTrafficPresentation.tsx:122-144`.

### B — importante

1. CRM e Kanban são monólitos grandes, dificultando consistência de estados e responsividade.
2. Integrações, Alertas, Leads e Configurações precisam matriz explícita de loading, erro e vazio.
3. Agenda/Turmas e Configurações usam wrappers de rota curtos; a auditoria visual efetiva exige capturar a tela carregada antes de alterar.
4. `overflow-x: clip` global em `html/body/#root` deve ser substituído apenas onde houver prova de overflow acidental; não mascarar conteúdo.

### C — polish

1. Normalizar microinterações, focus ring e hierarquia de ícones depois que tokens e primitivas estiverem prontos.
2. Remover valores de fonte menores que 11px nas superfícies prioritárias.
3. Consolidar raios e sombras em níveis documentados.

## Portões e próximo passo

- Fase 0 não alterou código de produto; portanto não há screenshot “depois”.
- Screenshot baseline: capturas anexadas nesta solicitação; não disponíveis para cópia local durante esta execução.
- Próxima fase autorizada: criar `src/styles/tokens.css`, documentar a extensão e aplicar somente tokens não destrutivos. A sidebar/header permanecem fora do redesign.
- Validação obrigatória da Fase 0: `npm run build`, `npx tsc --noEmit` e `git diff --check`.
