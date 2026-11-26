# PROMPT MASTER — Rebranding Completo da Growdash

## Status atual (verificado)

**Workflow concluído:** `growdash-rebranding-pendencias` (Run ID `wf_f263ed6d-0bc`), 6 subagentes paralelos, 8 domínios cobertos.

| Domínio | Resultado |
|---|---|
| Login rebranding | ✅ Concluído — `src/pages/Auth.tsx` redesenhado como prévia da plataforma; fluxo de auth (Supabase) preservado integralmente |
| Temas terra/orbita/galaxia | ✅ Concluído — `src/styles/premium.css` é a autoridade real de cor |
| Sidebar seleção roxa em galaxia | ✅ Confirmado — `premium.css` já usa `var(--palette-accent-bright)` no item ativo; `AppSidebar.tsx` está morto (a sidebar real é `GrowdashLayout.tsx`) |
| Blocos de métrica cores por fase | ✅ Concluído — tons semânticos (success/expense/phase/neutral) em `KpiCard.tsx` e `MetricCard.tsx` |
| Funil RD — remoção do toggle | ✅ Concluído — `FunnelStageDistribution.tsx` renderiza apenas tabela; `visualMode`/`Switch` removidos |
| Kanban estilo Trello | ✅ Já estava correto — padrão `kanban` (colunas lado a lado) |
| Atribuição RD campanha/conjunto/anúncio | ✅ Concluído — `src/lib/leadAttributionResolver.ts` criado com resolvedor unificado (IDs Meta → UTM → nome → sem vínculo); 13 testes aprovados |
| Motion e efeitos | ✅ Concluído — `MotionContainer.tsx` com `useMotionPolicy`, entrada fade/slide/scale, stagger, `MotionPhase` (600ms), `MotionGlow` |
| Agentes/skills reinstalação | ⚠️ Diagnóstico feito — `npx skills experimental_sync` retornou "Nothing to sync"; plugins ausentes identificados; instalação manual pendente |

**Validação local:**
- `bunx tsc --noEmit`: passou
- `bun run lint`: 0 erros, 29 avisos
- `bun run test`: **1199 aprovados, 2 falhos** (ambos em `src/lib/dashboardCosmicContract.test.ts` — contrato obsoleto do antigo layout cósmico)

**Bloqueios:** repositório Git local vazio (sem commits, sem `origin`) → commit/push impossível sem remoto.

---

## Objetivo

Entregar uma plataforma com identidade visual profissional, neon por fase, motion por toda parte, login que gera vontade de entrar, e rastreamento de leads do RD por campanha/conjunto/anúncio.

---

## Regras invioláveis (cópia do AGENTS.md)

1. **Nunca inventar** número, prazo, preço, resultado ou claim clínico.
2. **Separar** observado, implementado, proposto, pendente e não verificado.
3. **Não afirmar** que algo aconteceu sem evidência verificável.
4. **Nenhuma ação externa** sem portão correspondente — nunca gastar verba, publicar ou enviar mensagem sem aprovação.
5. **Não falar pela expert.** Nenhuma promessa de resultado clínico, prazo de turma, desconto ou vaga sem autorização explícita dela.
6. **Nenhum token, senha ou `.env`** entra no repositório Git.

**Portões:** L0 observar · L1 preparar · L2 aplicar (reversível, com portão) · L3 irreversível (confirmação humana explícita e registrada).

**Fluxo obrigatório (AGENTS.md):** Código local → GitHub/remoto → Cloudflare Pages → Navegador. Nunca declarar produção validada sem verificar os quatro.

---

## Escopo obrigatório (8 domínios)

### 1. Login — rebranding "prévia da plataforma"
- Manter fluxo de auth (Supabase: `signInWithPassword`, `resetPasswordForEmail`, `signInWithOtp`, validação de e-mail, `setAuthPersistence(true)`, estados, toasts, `navigate("/", {replace:true})` após 2200ms).
- Trocar cena cósmica (foguete/fumaça) por prévia do interior da Growdash (dashboard abstrato ao fundo, cards de métrica sutis).
- Card de login centralizado, limpo, botão de acesso em destaque.
- Arquivo: `src/pages/Auth.tsx` + seção auth em `src/styles/premium.css`.

### 2. Design system por fase (terra / orbita / galaxia)
- Autoridade: `src/styles/premium.css` (importado por último em `main.tsx`, vence sobre `index.css`).
- Terra = azul cósmico (#00A8FF), Órbita = dourado solar (#FFC107), Galáxia = púrpura/violeta neon (#A855F7).
- Verde não é identidade de fase — é apenas semântica de métrica positiva.
- Blocos de métrica com tom por tipo (faturamento/receita/lucro → verde-esmeralda; gastos/investimento → vermelho/alaranjado; ROAS/conversão → roxo/índigo).
- Faturamento ≥ R$ 100k/mês → badge "Meta atingida" (somente se houver fonte de verdade para faturamento mensal; caso contrário, regra permanece inerte/documentada).

### 3. Sidebar — item selecionado roxo em galaxia
- Já resolvido em `premium.css` (item ativo usa `var(--palette-accent-bright)`).
- NÃO tocar em `AppSidebar.tsx` (morto). A sidebar real é `src/growdash/GrowdashLayout.tsx`.

### 4. Blocos de mérica e funil — cores por fase
- `src/components/ui/KpiCard.tsx` e `src/components/dashboard/MetricCard.tsx` já aplicam tons semânticos.
- Funil RD (`src/pages/FunnelAnalysis.tsx` / `src/components/funnel-analysis/FunnelStageDistribution.tsx`) deve respeitar a paleta da fase ativa (roxo em galaxia).

### 5. Kanban — estilo Trello (colunas lado a lado)
- Já correto: `src/growdash/KanbanPage.tsx` inicia com `useState<"kanban" | "list">("kanban")`.
- Botão renomeado: "Colunas" (lado a lado) e "Lista" (vertical).

### 6. Rastreamento de leads do RD
- Resolvedor unificado em `src/lib/leadAttributionResolver.ts`: precedência IDs Meta persistidos → UTMs → nome da campanha → sem vínculo.
- Blocs afetados: "Perfil do público e entrega", "10. Vendas e oportunidades por campanha", "11. Perfil de oportunidades e compradores no RD".
- Colunas reais confirmadas em `src/integrations/supabase/types.ts`: `rd_deals` (`meta_campaign_id`, `meta_adset_id`, `meta_ad_id`, `utm_*`, `rd_deal_id`, `raw_payload`) e `rd_deal_touches` (UTMs + `matched_campaign_id`).
- NÃO criar migration. Se faltar schema, entregar diagnóstico + SQL proposto como pendência.

### 7. Motion e efeitos
- `src/components/motion/MotionContainer.tsx` com `useMotionPolicy` (centraliza `prefers-reduced-motion`), entrada fade/slide/scale, stagger, `MotionPhase` (600ms), `MotionGlow`.
- Não animar width/height/top/left; evitar blur em áreas grandes; respeitar `prefers-reduced-motion`.

### 8. Agentes/skills
- Verificar instalação conforme `.claude/instalar-30-skills.md`.
- Plugins são globais (`~/.claude`), não versionados no repo.
- Instalação manual dos itens ausentes pelo Claude Opus 5 Code (`/plugin`) + comandos do Terminal conforme guia.
- Itens que exigem colar texto ou URL (Agent Reach, gstack, Archify, i-have-adhd) = ação manual do usuário.

---

## Metodologia: subagentes + verificação adversarial

Quebrar em etapas e aplicar vários subagentes para corrigir um ao outro. Alguns subagentes ficam apenas analisando para encontrar erros e falhas; se houver, já corrigem no meio do caminho.

### Etapa 0 — Baseline e segurança
- Ler AGENTS.md e regras do projeto.
- Verificar árvore Git, branch, diff, remotos, divergência.
- Capturar baseline visual/funcional antes de alterar.
- Não sobrescrever mudanças locais do usuário.

### Etapa 1 — Diagnóstico paralelo (/batch)
Agentes A–F em paralelo, escopos separados:
- A. Explorador de arquitetura
- B. Auditor visual e design system
- C. Especialista em motion e performance
- D. Especialista em frontend funcional (sidebar, funis, login)
- E. Especialista em dados e integração RD
- F. Especialista em agentes e configuração

Cada agente retorna: hipótese, evidência, arquivos afetados, reprodução, risco, correção proposta, testes necessários.

### Etapa 2 — Contratos e plano
- Plano executável em commits pequenos e reversíveis.
- Tokens por tema, contrato de atribuição, critérios de aceite.
- Confirmar nomes reais de tabelas/colunas antes de qualquer migration (usar `IF EXISTS`, schema qualificado).

### Etapa 3 — Implementação incremental
1. Contratos/tokens e primitives compartilhadas.
2. Sidebar, blocos de funil, motion.
3. Remoção do visual alternativo RD.
4. Captura, persistência, sincronização e relatórios de atribuição.
5. Após cada bloco: testes focados + revisão de outro subagente.

### Etapa 4 — Correção cruzada (verificação adversarial)
- Agente revisor executa sobre todo o diff.
- Para cada finding reproduzível: corrigir, adicionar teste, reexecutar revisor.
- Não ampliar escopo para refatorações sem relação direta.

### Etapa 5 — Validação local e CI
- Formatador, lint, typecheck, testes unitários/integração, acessibilidade, build.
- Testar temas Terra/Órbita/Galáxia, sidebar ativa, cards de funil, tabela RD, reduced motion, teclado, mobile, loading, erro, dados vazios.
- `/circleci-cli` para conferir pipeline (se houver configuração e autorização).

### Etapa 6 — Git, Cloudflare e navegador
- Somente após validação local: criar commit com coautoria exigida.
- Enviar ao GitHub apenas quando autorizado.
- Conferir deployment Cloudflare Pages, URL, commit/hash, assets/chunks.
- Abrir rota autenticada só após verificações de código, remoto e Cloudflare.

---

## Formato de cada subagente

Papel e escopo; arquivos absolutos analisados/alterados; evidências reproduzíveis; achados classificados; correção aplicada/recomendada; testes e resultados; riscos, pendências e estado não verificado.

---

## Formato final do líder

Resumo executivo; causa raiz; alterações por arquivo; testes e evidências; estado visual por modo; persistência dos agentes; atribuição RD; pendências e riscos; itens não publicados/não verificados; próximo portão necessário para ação externa.

---

## Critérios de aceite

- Item selecionado da sidebar roxo em Galáxia; Terra e Órbita mantêm identidade sem regressão.
- Terra, Órbita e Galáxia com linguagem visual distinta, consistente, neon controlada e acessível.
- Blocos da Análises de Funis respeitam tokens definidos (contexto roxo solicitado).
- Motion suave, reutilizável, sem regressão, desativável/reduzível.
- Agentes solicitados permanecem instalados após reload/deploy; itens sem evidência ficam explicitamente pendentes.
- Seção 3 apresenta somente tabela, sem botão de alternância residual.
- Lead de teste mantém campanha, conjunto e anúncio desde entrada até RD, oportunidade e venda (quando dados existirem).
- Falhas de atribuição observáveis e classificadas, nunca silenciosamente convertidas em dados corretos.
- Seções 10 e 11 usam dados consistentes, deduplicados e filtráveis.
- Nenhum segredo versionado ou exibido.
- Todos os testes e verificações com resultado registrado.

---

## Não implementar sem aprovação

- Deploy em produção
- Alterações de banco/migrations
- Gastos externos
- Commit/push (bloqueado atualmente: sem checkout Git com `origin` remoto)

---

## Pendências conhecidas (a resolver antes de considerar concluído)

1. **`src/lib/dashboardCosmicContract.test.ts`** — 2 asserções obsoletas (linhas 44 e 50) esperam seletores do antigo layout cósmico. Atualizar ou remover para a suíte ficar 100% verde.
2. **Checkout Git com remoto** — o `.git` local está vazio (sem commits, sem `origin`). Necessário: URL do repositório GitHub do Growdash para configurar `origin` e desbloquear commit/push.
3. **Plugins/skills ausentes** — instalar manualmente pelo Claude Opus 5 Code conforme `.claude/instalar-30-skills.md`.
4. **Colunas de atribuição na tabela** — campos método/granularidade/cobertura existem nas linhas, mas ainda não são renderizados nos componentes de tabela.

---

## Arquivos-chave (referência)

- `src/pages/Auth.tsx` — login redesenhado (fluxo de auth preservado)
- `src/styles/premium.css` — autoridade de cores por fase (Terra/Órbita/Galáxia)
- `src/growdash/GrowdashLayout.tsx` — sidebar real (`.gd-sidebar-nav-link`, `.gd-sidebar-nav-chip`)
- `src/components/funnel-analysis/FunnelStageDistribution.tsx` — funil RD, tabela apenas
- `src/lib/leadAttributionResolver.ts` — resolvedor unificado de atribuição RD
- `src/components/motion/MotionContainer.tsx` — motion e efeitos
- `src/lib/funnelStageDistribution.ts` — helpers do funil (visuais removidos)
- `.claude/instalar-30-skills.md` — guia de instalação de skills/agentes