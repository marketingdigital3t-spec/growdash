# Auditoria enterprise de front-end — Growdash

**Data:** 21/10/2026  
**Escopo:** inventário, auditoria estática, acessibilidade, responsividade, execução pública disponível, correções e validação.

## 0. Contexto verificado

| Item | Evidência |
|---|---|
| Stack | React 18, Vite, TypeScript, Tailwind CSS, Radix/shadcn e React Router |
| Raiz do front-end | `/Users/thiegojesus/Documents/Codex/PROJETOS – APP/Growdash/src` |
| Tema | `next-themes`, classe `.dark`, tokens em `src/index.css` e `src/styles/tokens.css` |
| Breakpoints exigidos | 320, 375, 414, 768, 1024, 1440 e 1920 px |
| Breakpoints verificados nesta sessão | 375, 390, 414, 768, 820 e 1440 px na tela pública; rotas internas bloqueadas sem sessão |
| Navegador efetivamente usado | Chromium via Playwright; Safari, Firefox e Edge não foram simulados |
| Paleta | Tokens shadcn (`--background`, `--foreground`, `--card`, `--muted`, `--primary`, `--border`, `--ring`) e aliases `--gd-*` |
| Regra crítica | Qualquer quebra mobile é severidade alta; cores semânticas de UI devem usar tokens |

## Fase 1 — inventário e matriz

### Rotas encontradas

Rotas públicas: `/auth`, `/reset-password`, `/termos`, `/privacidade`, `/cookies`, `/dpa`, `/sla`, `/cancelamento`, `/relatorios/:shareToken`, `/nota-fiscal/:token`, `/diagnostico-marca/:token` e `/questionario-expert/:token`.

Rotas protegidas e módulos: `/`, `/painel-expert`, `/crm`, `/comercial`, `/campanhas`, `/inteligencia`, `/analise-de-funis`, `/business/*`, `/alertas`, `/agenda-turmas`, `/leads-incompletos`, `/automacoes`, `/growdash-flow`, `/estrategia`, `/saude-dos-dados`, `/produtos`, `/configuracoes`, `/usuarios`, `/financeiro`, `/armazenamento`, `/integracoes`, `/perfil`, `/midia-social`, `/kanban`, `/chamados`, `/anuncios`, `/marcas`, `/marcas/:brandId`, `/agentes`, `/gestor-trafego`, `/whatsapp`, `/quadro`, `/neural-core`, `/life-sim` e `/:module`, além de redirects legados.

Rotas de erro e redirecionamentos foram localizados em `src/App.tsx` e `src/growdash/navigation.ts`.

### Inventário técnico

- 564 arquivos em `src` na varredura;
- 4 contextos, 76 hooks e 4 módulos em `src/integrations`;
- componentes compartilhados em `src/components`, `src/growdash` e `src/components/ui`;
- assets em `src/assets` e `public` (aproximadamente 50 arquivos), com fontes e fallback definidos no CSS;
- serviços de dados e autenticação em `src/integrations` e hooks de domínio;
- tokens globais em `src/index.css` e `src/styles/tokens.css`.

### Matriz de auditoria

| Área | Claro | Escuro | 375/414 | 768 | 1440 | Resultado |
|---|---:|---:|---:|---:|---:|---|
| Auth e recuperação | verificado | verificado | verificado | verificado | verificado | aprovado na sessão pública |
| Termos/políticas públicas | inventariado | inventariado | não executado | não executado | não executado | não priorizado nesta rodada |
| Dashboard e módulos protegidos | bloqueado | bloqueado | bloqueado | bloqueado | bloqueado | sessão autenticada ausente |
| Modais, filtros, uploads e fluxos internos | bloqueado | bloqueado | bloqueado | bloqueado | bloqueado | sessão autenticada ausente |
| Estados reais de API (vazio/loading/erro/sucesso) | parcial | parcial | bloqueado | bloqueado | bloqueado | depende de dados e sessão |

Estados não aplicáveis foram marcados como bloqueados quando dependiam de autenticação; não foram declarados aprovados por inspeção de código.

### Dependência visual

`src/index.css` e `src/styles/tokens.css` → `tailwind.config.ts` → componentes UI compartilhados → páginas públicas e módulos Growdash. Alterações nesses tokens têm raio global; correções desta rodada foram limitadas a componentes e tokens semânticos já existentes.

## Fase 2 — achados estáticos e de acessibilidade

| ID | Severidade | Área | Evidência | Reprodução/impacto | Correção |
|---|---|---|---|---|---|
| FE-001 | Alto | Gestão/Marcas | `src/growdash/ManagementPage.tsx` | Abrir a tela e alternar tema: superfícies e status fixos perdem hierarquia | Tokens semânticos |
| FE-002 | Alto | Usuários | `src/growdash/ManagementPage.tsx` | Cabeçalho/avatar/divisórias não acompanham tema | Tokens semânticos |
| FE-003 | Alto | Agentes | `src/growdash/ManagementPage.tsx` | Card não reage a claro/escuro | Tokens semânticos |
| FE-004 | Alto | Anúncios | `src/growdash/ManagementPage.tsx` | Badges e métricas fixos divergem da paleta | Tokens semânticos |
| FE-005 | Alto | Ranking comercial | `src/growdash/CommercialPage.tsx`, `src/index.css` | Modo claro exibe composição quase preta e contraste inconsistente | Overrides semânticos no claro |
| FE-006 | Médio | Aplicação | busca estática em `src/growdash`, `src/pages`, `src/components` | 197 ocorrências de classes fixas; algumas são gráficos/editoriais e exigem revisão por tela | Revisão incremental, sem trocar cores editoriais sem evidência |
| FE-007 | Médio | Tabelas mobile | `ManagementPage.tsx`, `CommercialPage.tsx` | `min-width` pode exigir rolagem horizontal em telas estreitas | Validar autenticado e manter estratégia explícita |
| FE-008 | Alto | Filtros multi-seleção | `src/components/dashboard/OptionMultiSelect.tsx` | Popover e seleção fixos ficam ilegíveis no claro | Tokens de superfície/texto/borda |
| FE-009 | Alto | Alertas | `src/components/notifications/NotificationCenter.tsx` | Botão/subtítulo fixos ignoram tema | Tokens de card e texto |
| FE-010 | Alto | Dashboard legado | `src/growdash/DashboardPage.tsx` | Métricas sem fonte real induziam interpretação incorreta | Estado `—`/sem dados |
| FE-011 | Alto | Automação | `src/growdash/automations/WorkflowEditor.tsx` | Dois `any` e efeito instável falhavam lint | Tipagem local e `useCallback` |
| FE-012 | Alto | Auth | `src/pages/Auth.tsx`, `src/pages/ResetPassword.tsx` | Inputs sem nome acessível e recuperação sem label | `aria-label`/labels acessíveis |
| FE-013 | Alto | Auth | `src/pages/Auth.tsx`, `src/pages/ResetPassword.tsx` | Mostrar senha tinha alvo menor que 44×44 | Área de toque 44×44 e nome acessível |
| FE-014 | Alto | Auth | `src/pages/Auth.tsx` | Modo login não oferecia caminho visível para cadastro | Botão “Criar conta” |
| FE-015 | Médio | Banner offline | `src/growdash/GrowdashLayout.tsx` | Fundo/texto fixos ignoravam tema | `bg-card`, `text-card-foreground`, `border-warning` |
| FE-016 | Médio | Cards de métricas | `src/growdash/shared.tsx` | Cores fixas para sucesso/erro e barras | `text-success`, `text-destructive`, `bg-muted` |
| FE-017 | Médio | Conexão Meta manual | `src/components/settings/MetaManualConnectionCard.tsx` | Ícone usava cor fixa | `bg-primary/10` e `text-primary` |

## Fase 3 — varredura visual e funcional

### Cobertura executada

- Auth em 390 px, 820 px e 1440 px: campos, mostrar/ocultar senha, recuperação, cadastro e checkbox legal.
- Checagem adicional de overflow em 375, 414 e 768 px: `overflow=0`.
- Build/testes públicos executados com Playwright.

### Cobertura bloqueada

51 cenários de rotas autenticadas foram pulados porque `GROWDASH_AUTH_STATE` não está configurado. Portanto, não foram declarados como aprovados: Dashboard, CRM, Comercial, Campanhas, Automação, Integrações, WhatsApp, Configurações, modais, filtros, uploads, estados de dados e fluxos críticos permanecem **BLOQUEADOS — sessão autenticada ausente**.

Não foi possível validar nesta sessão Safari, Firefox, Edge, 320/1024/1920 px ou fluxos reais de negócio.

## Fase 4 — relatório executivo

### Totais

- Críticos: 0 identificados no escopo público executado; rotas internas não podem ser classificadas sem sessão.
- Altos: FE-001 a FE-005, FE-008 a FE-014 (12).
- Médios: FE-006, FE-007, FE-015 a FE-017 (5).
- Baixos: 0.
- Bloqueios: autenticação ausente para auditoria interna completa.

### Dez maiores riscos

1. Sessão ausente impede validar o produto real.
2. Tabelas com largura mínima podem degradar no mobile.
3. Cores fixas ainda existem em telas não revisadas.
4. Fluxos de automação não foram executados de ponta a ponta.
5. Estados de API reais não foram exercitados.
6. Permissões e sessão expirada não foram verificadas visualmente.
7. Integrações e uploads não foram testados.
8. Modais/drawers internos não foram testados com teclado.
9. Navegadores diferentes do Chromium não foram executados.
10. Métricas de telas protegidas continuam dependentes de fonte autenticada.

Abas públicas executadas sem problemas conhecidos: **Auth/recuperação**, nos breakpoints públicos citados. As demais abas estão inventariadas, mas não podem ser listadas como “sem problemas” enquanto o bloqueio de sessão existir.

## Fase 5 — prompt de correção executado

> Corrigir FE-001 a FE-017 de forma mínima e cirúrgica. Usar apenas tokens/variáveis do tema para semântica de UI; preservar cores de gráficos, ilustrações e cenas editoriais. Corrigir acessibilidade com labels, nomes de controles e alvos mínimos de 44×44 px. Remover métricas sem fonte e exibir estados explícitos de ausência de dados. Não alterar rotas, contratos, integrações ou lógica de negócio. Validar cada lote em claro, escuro, teclado e 375/768/1440 px; executar lint, build, testes e `git diff --check`.

## Fase 6 — execução, validação e regressão

### Changelog

- FE-001–FE-005: tokens e overrides de tema em Management/Commercial.
- FE-008–FE-009: tokens em filtros e alertas.
- FE-010: remoção de métricas fictícias e estados sem dados.
- FE-011: correção de lint e estabilidade do carregamento do histórico.
- FE-012–FE-014: labels, alvo de toque e caminho de cadastro na autenticação.
- FE-015–FE-017: tokens em banner offline, métricas e conexão Meta.
- Teste visual novo: `tests/visual/auth-interactions.spec.ts`.

### Painel final

**Corrigidos e verificados:** FE-001–FE-005, FE-008–FE-011 e FE-012–FE-017; lint, build, testes unitários, diff e tela pública visual aprovados.

**Pendentes:** FE-006 e FE-007 permanecem revisão incremental/autenticada; revisão de todas as cores fixas e tabelas não foi forçada sem evidência visual.

**Bloqueados:** auditoria clique por clique das rotas internas, estados reais de API, fluxos críticos, navegadores adicionais e breakpoints não executados — motivo único: sessão autenticada e dados de teste não disponíveis.

### Evidências de validação

```text
npm run lint                         aprovado
npm run build                        aprovado (aviso de chunks >500 kB)
npm test -- --run                    114 arquivos / 539 testes aprovados
npm run test:visual -- ...           6 aprovados / 3 pulados por autenticação
npm run test:visual -- route-health  51 pulados por GROWDASH_AUTH_STATE ausente
git diff --check                     aprovado
```

Deploy verificado: `https://6dfe3552.growdash.pages.dev`. Após a publicação, `https://growdash.com.br/auth` e `https://growdash.com.br/automacoes` responderam HTTP 200.

### Plano de prevenção

1. Adicionar regra de lint para cores semânticas fora de tokens.
2. Manter checklist de claro/escuro, foco, ESC, labels e 44×44 px em code review.
3. Adicionar Playwright autenticado com estado seguro e dados sintéticos por workspace.
4. Rodar snapshots em 375/768/1440 px nos principais módulos.
5. Monitorar bundle e dividir chunks grandes quando houver impacto real.
6. Exigir fonte de dados para qualquer métrica exibida na UI.

## Limitação e próximo passo

Esta auditoria não inventa aprovação para telas que não puderam ser abertas. Para concluir a fase visual enterprise, é necessário fornecer uma sessão autenticada de teste (ou `GROWDASH_AUTH_STATE`) e dados sintéticos; então os 51 cenários protegidos devem ser reexecutados nos temas e breakpoints exigidos.
