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
