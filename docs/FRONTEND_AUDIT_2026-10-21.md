# Auditoria de front-end — Growdash — 21/10/2026

## Contexto verificado

- Stack: React 18 + Vite + TypeScript + Tailwind CSS + Radix/shadcn + React Router.
- Front-end: `/Users/thiegojesus/Documents/Codex/PROJETOS – APP/Growdash/src`.
- Tema: tokens shadcn em `src/index.css` e aliases em `src/styles/tokens.css`; modo claro/escuro via classe `.dark`.
- Paleta efetiva: `--background`, `--foreground`, `--card`, `--muted`, `--primary`, `--border`, `--ring` e aliases `--gd-*`.

## Fase 1 — análise do código

| ID | Aba/tela | Modo | Severidade | Achado | Arquivo |
|---|---|---|---|---|---|
| FE-001 | Gestão / Marcas | Claro/escuro | Alto | Cards usavam fundos, textos e status em hex fixo claro; no escuro o texto perdia hierarquia e o tema não era respeitado. | `src/growdash/ManagementPage.tsx` |
| FE-002 | Administração / Usuários | Claro/escuro | Alto | Cabeçalho, divisórias, avatar e textos usavam a paleta antiga fixa, causando contraste divergente ao alternar o tema. | `src/growdash/ManagementPage.tsx` |
| FE-003 | Agentes | Claro/escuro | Alto | Descrição, status, borda e rodapé dependiam de hex fixo; o card não acompanhava os tokens da aplicação. | `src/growdash/ManagementPage.tsx` |
| FE-004 | Biblioteca / Anúncios | Claro/escuro | Alto | Miniaturas, badges e métricas usavam gradiente/dourado e cinzas fixos; estados não eram coerentes com o tema. | `src/growdash/ManagementPage.tsx` |
| FE-005 | Ranking Comercial | Claro | Alto | A composição inteira usava fundos quase pretos e texto branco fixos; no modo claro havia risco direto de painel escuro destoante e controles com contraste incorreto. | `src/growdash/CommercialPage.tsx`, `src/index.css` |
| FE-006 | Toda a aplicação | Ambos | Médio | Busca estática encontrou 197 ocorrências de classes com cor fixa em telas/páginas. Nem todas são bugs: algumas pertencem a visualizações editoriais, gráficos ou estados semânticos; precisam de revisão incremental por tela. | `src/growdash`, `src/pages`, `src/components` |
| FE-007 | Mobile | Ambos | Médio | Tabelas de Usuários e Vendas usam `min-w` e overflow horizontal intencional; o conteúdo não quebra, mas exige validação visual em 375/414/768px. | `src/growdash/ManagementPage.tsx`, `src/growdash/CommercialPage.tsx` |

## Fase 2 — varredura visual

### Resultado de acesso

A sessão Chrome disponível para a Growdash redirecionou para `https://growdash.com.br/auth`. Não havia sessão autenticada utilizável para abrir as telas internas. Por isso, não é seguro declarar que os cliques, modais e estados de cada aba foram visualmente aprovados.

### Abas mapeadas no código

Dashboard, Painel do Expert, CRM, Comercial, Análise de Funis, Tráfego Pago/Campanhas, Growdash Flow, Análise de Mídia Social, Alertas, Agenda & Turmas, Kanban, Chamados, WhatsApp, Leads incompletos, Automação, Financeiro, Armazenamento, Anúncios, Marcas, Produtos, Usuários, Configurações, Integrações, Perfil, Agentes e Gestor de Tráfego.

Resultado: **não auditadas visualmente nesta sessão** por bloqueio de autenticação. As rotas existem no código; isso não substitui screenshot e interação real.

## Prompt de correção aplicado

> Corrigir somente FE-001 a FE-005. Substituir cores fixas dos componentes por tokens semânticos (`bg-background`, `bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `text-primary`, `text-success`, `border-border` e suas opacidades). Preservar estrutura e lógica. O modo claro deve manter fundo claro e contraste AA; o modo escuro deve manter fundo escuro, texto legível e foco visível. No Ranking Comercial, manter o layout editorial, mas aplicar overrides claros somente sob `html:not(.dark)`; não alterar dados, consultas, navegação ou ações. Validar build, lint, testes e breakpoints 375, 414 e 768px antes de publicar.

## Correções executadas

- FE-001–FE-004: `ManagementPage.tsx` passou a usar tokens do tema.
- FE-005: `index.css` recebeu overrides de modo claro para o Ranking Comercial, preservando o modo escuro.
- Build e lint concluídos.
- Testes direcionados: 10/10 aprovados.

## Pendências honestas

- Repetir a Fase 2 com sessão autenticada e capturas em claro/escuro nos três breakpoints.
- Revisar progressivamente as 197 ocorrências de cores fixas, começando por telas realmente usadas pelo usuário; não substituir cores de gráficos/editoriais sem validar intenção visual.

## Segunda rodada — 21/10/2026

### Evidência visual capturada

- `tests/visual/__screenshots__/growdash.spec.ts/mobile/auth.png` — login em 390px.
- `tests/visual/__screenshots__/growdash.spec.ts/tablet/auth.png` — login em 820px.
- `tests/visual/__screenshots__/growdash.spec.ts/desktop/auth.png` — login em 1440px.
- As três capturas passaram no teste de ausência de overflow horizontal.
- Uma checagem adicional em 375px, 414px e 768px também retornou `overflow=0` na tela de autenticação.
- A sessão autenticada das telas internas continua indisponível; as rotas protegidas foram marcadas como não verificadas visualmente, não como aprovadas.

### Novos achados e correções

| ID | Aba/tela | Modo | Severidade | Achado | Correção | Arquivo |
|---|---|---|---|---|---|---|
| FE-008 | Filtros multi-seleção usados em Dashboard/Comercial | Claro | Alto | Popover, botão, seleção e estado vazio usavam fundo azul escuro e texto claro fixos, quebrando a leitura no modo claro. | Tokens semânticos de superfície, texto, borda e seleção. | `src/components/dashboard/OptionMultiSelect.tsx` |
| FE-009 | Alertas inteligentes | Claro | Alto | Botão flutuante e subtítulo eram sempre quase pretos/brancos, sem respeitar o tema. | `bg-card`, `text-card-foreground` e `text-muted-foreground`; sombra neutra. | `src/components/notifications/NotificationCenter.tsx` |
| FE-010 | Dashboard legado | Ambos | Alto | O comentário dizia que não havia métricas fictícias, mas a tela ainda apresentava `+24,8%`, `18,4%`, `214`, `1,56%` e `R$ 14,42` sem fonte de dados. | Remoção dos valores inventados; estados `—`, `sem dados` e placeholder de série oficial. | `src/growdash/DashboardPage.tsx` |
| FE-011 | Automação / histórico de execução | Ambos | Alto | O lint falhava com dois `any` explícitos em consultas de tabelas ainda não refletidas nos tipos gerados e efeito sem dependência estável. | Tipagem local documentada, `useCallback` para `loadRuns` e dependência estável no efeito. | `src/growdash/automations/WorkflowEditor.tsx` |

### Prompt de correção executado nesta rodada

> Corrigir somente FE-008 a FE-011. Substituir cores fixas de componentes de produto por tokens semânticos compatíveis com claro e escuro; não alterar cores de gráficos, cenas editoriais ou ilustrações sem evidência. Remover métricas sem fonte real e mostrar estado explícito de ausência de dados. Corrigir erros de lint sem alterar o contrato do executor. Preservar lógica de negócio, integrações e navegação. Validar lint, build, testes unitários, overflow visual em 390/820/1440px e `git diff --check`.

### Resultado da execução

- `npm run lint`: aprovado sem erros; permanecem 21 avisos pré-existentes de Fast Refresh/dependências.
- `npm run build`: aprovado.
- `npm test -- --run`: 114 arquivos e 539 testes aprovados.
- `npm run test:visual -- tests/visual/growdash.spec.ts`: 3 capturas públicas aprovadas; 3 testes internos pulados por ausência de credenciais.
- `git diff --check`: aprovado.

### Limites que permanecem

- A auditoria clique por clique de todas as abas internas, nos modos claro/escuro e nos breakpoints 375/414/768, ainda exige uma sessão autenticada. O teste visual disponível usa 390/820/1440px para a tela pública de autenticação.
- As telas com tabelas de largura mínima e composições editoriais continuam listadas para revisão visual autenticada; não foram alteradas automaticamente.
