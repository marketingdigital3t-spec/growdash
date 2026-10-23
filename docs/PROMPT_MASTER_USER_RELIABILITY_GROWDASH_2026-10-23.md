# Prompt mestre — engenharia de confiabilidade do usuário no Growdash

Use este texto como prompt de execução para um agente de código com acesso ao repositório do Growdash.

## Papel

Você é um engenheiro sênior de produto, front-end, dados, Supabase, QA visual e operações. Trabalhe no repositório existente, respeite `AGENTS.md` e trate o código versionado como fonte de verdade. O objetivo é remover riscos de uso percebidos pelo usuário sem mascarar falta de dados, escopo incorreto ou integração não verificada.

## Objetivo

Corrigir os problemas UX-001 a UX-005, DATA-001, DATA-002, QA-001, OPS-001, OPS-002 e os achados de segurança/dependências descritos em `docs/PROJECT_USER_AUDIT_2026-10-23-RERUN.md`.

Não declare “paridade Meta/RD”, “tempo real”, “seguro”, “publicado” ou “corrigido” sem a evidência correspondente.

## Regras não negociáveis

1. Preserve a rolagem independente da sidebar esquerda. Não altere seu overflow, altura ou comportamento para corrigir conteúdo à direita.
2. Não renderize `0`, `R$ 0,00`, `0,00x` ou `0%` enquanto a fonte estiver carregando, falhar, estiver parcial ou não tiver confirmação.
3. Todo número deve carregar `source`, `scope`, `status`, `fetchedAt`, `staleAt` e, quando aplicável, `errorCode`.
4. RD é a fonte canônica de pessoa/negócio/venda; Meta é fonte de entrega/atribuição e fallback explicitamente rotulado. Não fundir fontes sem regra de precedência.
5. Não usar `user_metadata` para autorização Supabase. Não abrir uma tabela apenas com `TO authenticated`; a Policy precisa restringir workspace/ownership.
6. Não colocar secrets, tokens, cookies ou dumps de PII no repositório ou na saída do agente.
7. Não fazer migração, mudança de Policy, OAuth ou Edge Function sem contrato versionado, teste e validação remota.
8. Não habilitar ações Meta fictícias. Se ainda não houver API, permissão, confirmação e auditoria, mantenha somente leitura e explique o motivo.
9. Não aumentar limites de warning para esconder bundle, lint ou vulnerabilidades.
10. Antes de qualquer alteração, siga a ordem do `AGENTS.md`: código local, GitHub, Cloudflare, navegador autenticado.

## Contrato obrigatório de snapshot

Crie ou consolide um contrato tipado compartilhado por Dashboard, CRM, Painel Expert, Financeiro, Campanhas e gráficos:

```ts
type AnalyticsScope = {
  workspaceId: string;
  adAccountIds: string[];
  funnelIds: string[];
  startDate: string;
  endDate: string;
  timezone: string;
  attributionWindow: string;
  eventDefinition: string;
};

type MetricAvailability =
  | "loading"
  | "fresh"
  | "stale"
  | "partial"
  | "unavailable"
  | "empty"
  | "error";

type MetricSnapshot<T> = {
  value: T | null;
  availability: MetricAvailability;
  source: "rd" | "meta" | "derived" | "mixed";
  scope: AnalyticsScope;
  fetchedAt: string | null;
  staleAt: string | null;
  errorCode?: string;
};
```

Use o mesmo objeto de escopo na query key e no filtro de banco. Um snapshot antigo pode continuar visível durante refetch, mas precisa estar marcado como `stale` e mostrar timestamp. Escopo diferente nunca reutiliza snapshot anterior.

## Plano de execução

### Fase 1 — Reconhecimento e baseline

- Confirmar branch, `git fetch`, divergência com `origin/main`, deployment ativo e hash dos assets.
- Reproduzir `/painel-expert`, `/crm`, `/campanhas` e `/saude-dos-dados` em conta, período e timezone fixos.
- Capturar console, rede, duração das queries e screenshots em claro/escuro.
- Registrar baseline de testes, bundle, P95 de API/render e volume de registros.
- Se a sessão, segredo ou deployment não estiver disponível, registrar o bloqueio e continuar apenas com verificações locais seguras.

### Fase 2 — Snapshot e disponibilidade

- Remover caminhos duplicados que calculam receita, vendas, ROAS e CPL com contratos diferentes.
- Propagar `MetricSnapshot` para cards e gráficos.
- Diferenciar `loading`, `empty`, `error`, `partial`, `stale` e `unavailable`.
- Preservar último snapshot confirmado durante refetch, troca de tema e erro transitório.
- Adicionar timestamp, origem e ação “Tentar novamente”.
- Cobrir regressões com testes puros e de componente.

### Fase 3 — Sincronização RD/Meta

- Separar o caminho crítico de renderização do job de reconciliação.
- Definir timeout visual curto e timeout de background independente; um timeout nunca deve limpar dados válidos.
- Evitar consultas duplicadas de contas, insights, actions e breakdowns.
- Medir P50/P95 e expor no Data Health quando o atraso for de sincronização, não de ausência de vendas.
- Comparar somente registros com a mesma conta, período, timezone, janela de atribuição e definição de evento.
- Exibir quatro grupos de reconciliação: comparável, orgânico, parcial/sem atribuição e erro de fonte.
- Não declarar paridade se houver negócios sem linha financeira ou escopo divergente.

### Fase 4 — Saúde dos Dados e Supabase

- Tratar todo `error` do Supabase explicitamente; erro não pode virar lista vazia.
- Aplicar workspace, conta, funil e período em filtros e query keys.
- Filtrar e agregar no banco; paginar até página curta ou criar RPC auditável para volumes acima de 10.000.
- Testar dois usuários em dois workspaces e papéis diferentes.
- Rodar advisors e classificar cada aviso `SECURITY DEFINER`, `EXECUTE`, `search_path`, Policy permissiva e proteção de senha.
- Corrigir somente com migration versionada, testes de autorização e verificação remota.

### Fase 5 — Temas e UX de estados

- Substituir cores hardcoded por tokens semânticos claro/escuro.
- Garantir WCAG AA para texto normal, texto grande, badges, bordas, foco, disabled, skeleton e gráficos.
- Validar visualmente wordmark, “Somente leitura”, banners, tabelas, tooltips e cards nos dois temas.
- Campanhas deve mostrar “consultando Meta”, snapshot anterior ou erro; zero só após resposta concluída.
- Placeholders devem dizer claramente “Em breve”/“Somente leitura” e não sugerir que a ação foi executada.

### Fase 6 — Performance, observabilidade e dependências

- Medir chunks e CSS por rota antes/depois.
- Aplicar lazy loading apenas a fronteiras seguras de Quadro/3D/Excalidraw/Recharts; reverter se piorar o caminho crítico.
- Executar `npm audit --omit=dev`, atualizar em lotes pequenos e testar Quadro/Mermaid, lockfile, build e smoke tests.
- Decidir CircleCI ou alternativa; se CircleCI for adotado, incluir build, TypeScript, lint, unitários, visual autenticado e artefatos JUnit/screenshots.
- Se Sentry for adotado, exigir token local, release/commit, source maps controlados, PII redaction e alertas de erro/latência. Nunca solicitar token no chat.

### Fase 7 — QA e entrega

- Playwright autenticado em 390 px, 768 px e desktop, claro e escuro.
- Cobrir Dashboard, CRM, Painel Expert, Campanhas, Financeiro, Integrações e Saúde dos Dados.
- Validar reload, troca de tema durante refetch, timeout RD, ausência de dados, erro Supabase e escopo alterado.
- Repetir teste com dois usuários/workspaces para RLS.
- Rodar `npm test -- --run`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run test:visual -- --workers=1` e `git diff --check`.
- Criar commit isolado, enviar para GitHub, publicar no Cloudflare e validar domínio canônico por HTTP, manifest e hash de asset.
- Se houver migrations/Edge Functions, validar Supabase remoto e registrar versões.

## Critérios de aceite

- `/crm` e `/painel-expert` mostram o mesmo faturamento/vendas para o mesmo escopo, ou explicam claramente a diferença de fonte.
- Nenhuma métrica vira zero durante loading, timeout, erro, refetch ou troca de tema.
- RD não bloqueia a primeira pintura de métricas Meta; timeout de reconciliação aparece como estado stale/partial.
- Saúde dos Dados distingue `error`, `empty`, `partial` e `fresh`, com escopo visível.
- Reconciliação mostra comparável, orgânico, parcial e erro; paridade só é declarada quando o conjunto comparável fecha.
- Contraste claro/escuro passa WCAG AA e screenshots não apresentam wordmark/badge ilegíveis.
- Campanhas não promete ações não implementadas.
- Testes autenticados passam nos três breakpoints e dois temas; não há skips silenciosos para rotas críticas.
- Queries de RD não têm teto arbitrário de 10.000 sem justificativa e teste.
- Advisors Supabase, dependências e observabilidade têm decisão documentada, com riscos residuais explícitos.
- Produção serve exatamente o build validado e o commit/asset manifest é rastreável.

## Condições para parar e reportar

Pare sem inventar resultado se faltar sessão autenticada, token Sentry, permissão Meta/RD, acesso Cloudflare/Supabase ou dados suficientes para comparar. Informe: o que foi testado, o que ficou bloqueado, o erro observado, o próximo passo necessário e se o bloqueio afeta usuário final. Não marque a tarefa como concluída por passar apenas em TypeScript, lint, HTTP 200 ou build.

## Formato obrigatório do relatório final

1. Resumo executivo em português.
2. Tabela de achados: ID, severidade, rota, evidência, impacto, correção, status.
3. Arquivos alterados e contratos adicionados.
4. Testes executados com saída resumida.
5. Evidência de GitHub, Cloudflare e Supabase separada.
6. Riscos residuais e itens não verificados.
7. Hash/manifest do build publicado.
