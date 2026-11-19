---
name: dev-master
description: Skill mestre de desenvolvimento — consolida TODAS as skills, conectores MCP e plugins de dev em um único fluxo para uso em qualquer tarefa de código
---

# Dev Master — Fluxo Único de Desenvolvimento

## Qual harness carrega este arquivo

O **Claude Opus 5 Code (desktop app / Code tab)** carrega este arquivo quando a Skill tool é invocada com `skill: "dev-master"` (ou o usuário digita `/dev-master`). Ele não é um agente autônomo nem um plugin de IDE: é um conjunto de instruções de comportamento que o agente segue para cada tarefa de código na Growdash.

## Comportamento do agente que este arquivo muda

Sem este arquivo, o agente tende a escolher skills avulsas, pular fases de validação ou declarar produção sem verificar o domínio principal. Com este arquivo:

- **Sempre** passa pelas 4 fases obrigatórias (investigação → implementação → revisão → deploy), em ordem, sem pular.
- Considera **todas** as skills, conectores MCP e plugins de dev disponíveis, aplicando os relevantes para cada etapa em vez de escolher apenas um.
- Nunca declara produção válida enquanto `growdash.com.br` estiver servindo HTML/chunks de uma versão anterior (regra do AGENTS.md).
- Nunca usa o runner do GitHub Actions como interpretador de erros SQL e nunca expande escopo unilateralmente.

## Que nenhum arquivo de instrução existente cobre isto

Não existe nenhuma skill ou CLAUDE.md/AGENTS.md no repositório que consolide em um único fluxo todas as skills, conectores MCP e plugins de dev. O AGENTS.md cobre o fluxo de alteração e validação, mas não orquestra as skills. Esta skill preenche essa lacuna.

## Instrução verbatim do usuário

"Agora eu preciso que você cria um fluxo parecido com esse e torne em uma skill, para sempre que eu usar essa skill ele use todos os conectores, plugins... quero que use tudo isso abaixo e torne apenas 1 para dev:"

O usuário então listou todas as skills, conectores e plugins, pedindo que tudo isso seja unificado em apenas 1 skill para dev.

---

# Dev Master — Fluxo Único de Desenvolvimento

## Quando usar

Use esta skill **sempre** que for escrever, alterar, revisar, testar ou deployar código na Growdash (ou em qualquer projeto do usuário). Ela é o ponto único de entrada: ao invocar `dev-master`, o fluxo abaixo considera automaticamente todas as skills, conectores e plugins disponíveis, aplicando os relevantes para cada etapa.

Não escolha skills avulsa antes de passar por este fluxo. A `dev-master` decide quais aplicar em cada fase.

---

## Contexto do projeto (Growdash)

- **Projeto:** Growdash — dashboard de performance Meta Ads + RD Station CRM
- **Stack:** Next.js / React, TypeScript, Vite, Supabase, Cloudflare Pages
- **Caminho:** `/Users/thiegojesus/Documents/Codex/PROJETOS – APP/Growdash`
- **Branch atual:** `fix/growdash-integracao-rd-crm-sincronizacao`
- **Domínio de produção:** `https://growdash.com.br`
- **Preview Cloudflare:** `fix-growdash-integracao-rd-c.growdash.pages.dev`

---

## Fluxo obrigatório (4 fases)

Todas as fases devem ser executadas em ordem. Não pule nenhuma.

### Fase 1 — Investigação e planejamento (antes de qualquer alteração)

**Objetivo:** entender o problema, o estado do código e o escopo antes de tocar qualquer arquivo.

| Ferramenta | Para quê |
|------------|----------|
| `git status`, `git log`, `git diff` | Estado local da árvore, branch atual, histórico recente |
| `git fetch origin` + `git log origin/main..HEAD` | Divergência com o remoto (não assumir que o checkout local é o publicado) |
| `ecc:codebase-onboarding` / `ecc:spec-miner` | Mapear arquivos relacionados e extrair comportamentos existentes |
| `ecc:architecture-decision-records` | Registrar decisões arquiteturais se houver mudança de escopo |
| `ecc:planner` / `ecc:plan` | Definir etapas do trabalho antes de implementar |
| `ecc:docs-lookup` | Consultar documentação atual de bibliotecas/frameworks usados |
| `mcp__terminal__*` (desktop-commander) | Listar diretórios, buscar arquivos, executar comandos de inspeção |
| `mcp__ccd_session__list_sessions` | Ver se há sessões paralelas relacionadas |

**Critério de saída da Fase 1:** você sabe exatamente quais arquivos tocam, qual é a causa raiz, e tem um plano escrito com no máximo 7 etapas.

### Fase 2 — Implementação (codificação com todas as skills relevantes)

**Objetivo:** escrever o código aplicando as melhores práticas de cada domínio.

| Domínio | Skills a aplicar (se relevante para a tarefa) |
|---------|-----------------------------------------------|
| Análise/planejamento | `planner`, `ecc:plan`, `ecc:architecture-decision-records`, `ecc:blueprint`, `ecc:codebase-onboarding`, `ecc:spec-miner` |
| Desenvolvimento | `ecc:feature-dev`, `ecc:react-build`, `ecc:react-test`, `ecc:vue-build`, `ecc:nextjs-turbopack`, `ecc:vite-patterns`, `ecc:typescript-patterns`, `ecc:refactor-clean`, `ecc:code-simplifier` |
| Banco de dados | `ecc:database-reviewer`, `ecc:postgres-patterns`, `ecc:database-migrations`, `supabase:supabase`, `supabase:supabase-postgres-best-practices` |
| Frontend/UI | `frontend-design:frontend-design`, `ecc:frontend-design-direction`, `ecc:frontend-a11y`, `ecc:accessibility`, `dataviz` (qualquer gráfico/visualização) |
| Segurança | `claude-security:scan`, `security-audit`, `security-diff-scan`, `propose-security-hardening`, `deep-security-scan` |
| Git/Deploy | `github`, `circleci-builds`, `circleci-config`, `cloudflare:wrangler`, `cloudflare:cloudflare`, `ecc:deployment-patterns` |
| Agentes/Orquestração | `dispatching-parallel-agents`, `subagent-driven-development`, `ecc:agentic-engineering`, `ecc:continuous-agent-loop`, `ecc:multi-execute` |
| Outros | `ecc:docs-lookup`, `ecc:update-docs`, `ecc:update-codemaps`, `fewer-permission-prompts`, `loop`, `verification-before-completion` |
| Provedores específicos | `adobe`, `canva`, `figma`, `shopify`, `slack`, `notion`, `sales`, `auth0`, `sentry` (se a tarefa tocar esses serviços) |

**Regras de implementação:**
- Menor diff possível que resolva o problema (AGENTS.md: escopo estrito)
- Nunca use o runner do GitHub Actions como interpretador de erros SQL
- Migrations antes do commit: verificar schemas existentes, nomes reais de colunas, blocos condicionais `IF EXISTS`, qualificar extensões com schema de instalação
- Se o CI/banco/infra estiver travado, avise o usuário com diagnóstico e custo estimado — nunca expanda unilateralmente

### Fase 3 — Revisão e qualidade (não pular)

**Objetivo:** verificar que o código está correto, seguro, performático e testado antes de commitar.

| Skill | Para quê |
|-------|----------|
| `ecc:code-review` | Revisar o diff para bugs, reutilização, simplificação, eficiência |
| `ecc:react-review` / `ecc:typescript-review` | Revisar específicos de React/TypeScript |
| `ecc:security-review` | Detectar vulnerabilidades (injeção, secrets, SSRF, OWASP Top 10) |
| `ecc:performance-optimizer` | Identificar gargalos, reduzir bundle, melhorar runtime |
| `ecc:test-coverage` | Verificar cobertura de testes (≥80%) |
| `ecc:quality-gate` | Gate de qualidade antes de promover |
| `ecc:database-reviewer` | Se houver SQL/migrations: otimização, segurança, performance |
| `ecc:frontend-a11y` / `ecc:accessibility` | WCAG 2.2 se houver alteração de UI |
| `mcp__Claude_Browser__*` | Abrir a rota autenticada e testar o fluxo afetado no navegador; ler console e interface após cada reload |

**Critério de saída da Fase 3:** review aprovado, testes passando, sem alertas de segurança, acessibilidade verificada se aplicável.

### Fase 4 — Validação e deploy

**Objetivo:** validar localmente, commitar, enviar ao GitHub, publicar no Cloudflare e confirmar produção.

| Etapa | Ferramenta |
|-------|----------|
| Testes locais | `npm test` (vitest) — todos devem passar |
| Build de produção | `npm run build` (Vite) — sem erros de TypeScript/build |
| Commit | Mensagem no formato Conventional Commits, terminar com `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` |
| Push | `git push origin <branch>` |
| PR no GitHub | `github` / `gh` — abrir PR, bindar com `mcp__ccd_pr__bind_pr` |
| Monitorar CI | `mcp__ccd_pr__get_status`, `mcp__ccd_pr__set_monitor` |
| Deploy Cloudflare | `wrangler pages deploy dist --project-name growdash` |
| Verificar produção | Confirmar que `growdash.com.br` está servindo a versão correta (hash/commit) |
| Navegador | Abrir rota autenticada, testar fluxo afetado, ler console |

**Regra do AGENTS.md:** nunca declare produção validada enquanto o domínio principal estiver servindo HTML ou chunks de uma versão anterior.

---

## Conectores MCP (usar quando a tarefa tocar esses serviços)

| Conector | Status | Quando usar |
|----------|--------|-------------|
| `plugin:browser-use:browser-use` | Conectado | Automação de navegador, scraping, E2E com CDP |
| `plugin:desktop-commander:desktop-commander` | Conectado | Sistema de arquivos, terminal, busca local |
| `plugin:small-business:gmail` | Precisa OAuth (/mcp) | Envio/leitura de e-mail |
| `plugin:small-business:google-calendar` | Precisa OAuth (/mcp) | Eventos de calendário |
| `plugin:small-business:google-drive` | Precisa OAuth (/mcp) | Arquivos no Drive |
| `plugin:github:github` | Erro de conexão (400 token) | GitHub API (PRs, issues) — tentar após corrigir token |
| `plugin:supabase:supabase` | Precisa OAuth (/mcp) | Banco, Edge Functions, auth, RLS |
| `plugin:cloudflare:cloudflare` | Precisa OAuth (/mcp) | Deploy, DNS, Workers, Pages |
| `plugin:adobe-for-creativity:adobe` | Precisa OAuth (/mcp) | Ativos criativos |
| `plugin:design:figma` | Precisa OAuth (/mcp) | Design, specs do Figma |
| `biorxiv` | Disponível | Preprints biológicos |
| `c-trials` | Disponível | Ensaios clínicos |
| `chembl` | Disponível | Fármacos/bioatividade |
| `shopify` | Disponível | E-commerce |
| `pubmed` | Disponível | Artigos médicos |

**Se um conector precisar de autorização:** informe o usuário para autorizar via `/mcp` antes de usá-lo. Não tente forçar uso sem autorização.

---

## Plugins de dev integrados (sempre disponíveis)

| Grupo | Ferramentas | Para quê |
|-------|-------------|----------|
| Terminal | `mcp__terminal__*` | Abrir tabs, executar comandos, ler output |
| Browser pane | `mcp__Claude_Browser__*` | Navegação, screenshots, console, network, devtools |
| Sessões | `mcp__ccd_session__*` | Criar, listar, enviar mensagens entre sessões |
| Worktree/Host | `mcp__ccd_host__*` | Sync com branch base, storage, keep-awake |
| PR | `mcp__ccd_pr__*` | Status, bind, auto-merge, monitor |
| Settings/Sidebar/Window | `mcp__ccd_settings__*`, `mcp__ccd_sidebar__*`, `mcp__ccd_window__*`, `mcp__ccd_view__*` | Configurações, layout, janelas |
| Scheduled tasks | `mcp__scheduled-tasks__*` | Criar, listar, executar tarefas agendadas |

---

## Red flags — não pule estas regras

- ❌ "Vou fazer um quick fix agora e investigo depois"
- ❌ "Pulo os testes, verifico manualmente"
- ❌ "Faz várias mudanças de uma vez para economizar tempo"
- ❌ "Declaro produção válida só porque o build passou"
- ❌ "Não preciso de review, o código é simples"
- ❌ "Não verifico o Cloudflare/navegador antes de dizer que está em produção"

Se qualquer uma dessas pensamentos aparecer, pare e volte à Fase 1.

---

## Como invocar

No chat, digite: `/dev-master` ou use a Skill tool com `skill: "dev-master"`.

A skill então o guiará pelas 4 fases acima, aplicando automaticamente as skills, conectores e plugins relevantes para cada etapa da sua tarefa específica.
