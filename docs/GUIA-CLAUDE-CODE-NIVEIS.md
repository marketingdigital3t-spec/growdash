# Guia Prático: Claude Sonnet 5 Code nos Níveis 6, 7 e 8

> Guia escrito para o **seu** ambiente real (verificado em 21/11/2026).
> Cada nível mostra: o que é, o comando exato, o que esperar, e o que pode dar errado.

---

## Resumo: o que você já tem instalado

| Recurso | Estado | Onde |
|---|---|---|
| **Superpowers** (14 skills + hook de sessão) | ✅ ativo | `superpowers@claude-plugins-official` |
| **Ralph Loop** (`/loop`, `/ralph-loop`) | ✅ instalado | `ralph-loop@claude-plugins-official` |
| **Workflows** | ✅ habilitado | `~/.claude/settings.json` → `"enableWorkflows": true` |
| **Claude Sonnet 5 Security** (scan com subagentes) | ✅ ativo | `claude-security@claude-plugins-official` |
| **Agent Teams / batches** | ✅ disponível | tool `Agent` + tool `Workflow` |
| **Scheduled Tasks** | ✅ disponível (vazio) | `.claude/scheduled_tasks.json` |
| **ECC** (~250 skills de engenharia) | ✅ ativo | `ecc@ecc` |
| **Hookify** | ✅ instalado | `hookify@claude-plugins-official` |

**O que NÃO existe na sua máquina:** o MCP `computer` (controla mouse/teclado) e a conta macOS separada "agent". Isso é do roteiro do post — **você não precisa** para o que vou ensinar.

---

## NÍVEL 6 — As 5 técnicas (já estão na sua máquina)

### 1. Hooks — ações automáticas a cada passo

**O que é:** um script roda automaticamente quando um evento acontece (início de sessão, antes de editar arquivo, depois de um comando).

**O que você já tem funcionando:**
- **Superpowers** injeta um hook `SessionStart` que roda em `startup|clear|compact`. É por isso que, ao iniciar uma sessão nova, você recebe o fluxo de brainstorming → plano → execução → revisão.
- **Claude Sonnet 5 Security** e **Hookify** também instalam hooks.

**Como ver os hooks ativos:**
```
/hooks
```

**Como declarar permissões de operação (o que te travou hoje):**

Edite `.claude/settings.json` na raiz do projeto:

```json
{
  "permissions": {
    "allow": [
      "Bash(git status*)", "Bash(git diff*)", "Bash(git log*)",
      "Bash(git add*)", "Bash(git commit*)", "Bash(git checkout -b audit/*)",
      "Bash(npm *)", "Bash(npx *)", "Bash(node *)", "Bash(vitest *)",
      "Bash(tsc *)", "Bash(eslint *)", "Bash(grep *)", "Bash(rg *)", "Bash(find *)",
      "Bash(ls*)", "Bash(cat*)", "Bash(mkdir*)", "Bash(cp *)", "Bash(mv *)",
      "Bash(npx wrangler *)", "Bash(npm audit*)", "Bash(gitleaks*)",
      "Read(**)", "Edit(**)", "Write(**)"
    ],
    "deny": [
      "Bash(sudo *)",
      "Bash(rm -rf /*)",
      "Bash(git push --force*)",
      "Bash(git push origin main*)",
      "Bash(git push origin master*)",
      "Bash(terraform apply*)",
      "Read(~/.ssh/**)", "Read(~/.aws/**)", "Read(**/*.pem)", "Read(**/*.key)"
    ]
  }
}
```

**Por que isso importa no seu caso:** hoje, todo `Edit`/`Write` num arquivo novo dispara o hook GateGuard, que exige um bloco de "facts" (busca prévia + quem importa + citação da instrução). Isso é seguro, mas **lento** quando a tarefa toca 50 arquivos.

> ⚠️ O GateGuard é um hook de plugin (`ecc`), controlado pelas variáveis `GATEGUARD_EXEMPT_GLOBS` e `GATEGUARD_FACT_FORCE_MAX_DENIALS`. O `settings.json` é o lugar certo para permissões de operação; o GateGuard é um plugin separado.

---

### 2. Skills — receitas que o Claude Sonnet 5 Code segue sozinho

**O que é:** um `SKILL.md` numa pasta. Quando a descrição bate com o pedido, o Claude Sonnet 5 Code carrega a skill inteira e segue aquele procedimento.

**Listar as suas:**
```
/skills
```

**Usar uma:**
```
/dev-master
```

**As mais úteis para você na Growdash:**

| Skill | Para quê |
|---|---|
| `/dev-master` | fluxo completo de dev da Growdash (4 fases) — **sua** |
| `superpowers:systematic-debugging` | método científico para achar bug |
| `superpowers:brainstorming` | antes de codar, se conecta ao prompt master |
| `superpowers:test-driven-development` | escreve o teste **antes** |
| `superpowers:verification-before-completion` | te impede de declarar pronto sem evidência |
| `superpowers:requesting-code-review` | revisão por subagente independente |
| `superpowers:dispatching-parallel-agents` | paraleliza trabalho |
| `claude-security:scan` | scan de segurança completo com subagentes |
| `ecc:code-review` / `code-review` | revisão do diff |

**Criar a sua:** `/skill-creator` — gera a estrutura e valida o frontmatter.

---

### 3. Agentes em paralelo — várias tarefas de uma vez

**O que é:** o Claude Sonnet 5 Code dispara N subagentes, cada um num contexto próprio, e junta os resultados.

**Como pedir (no chat):**
> "Analise em paralelo: (1) segurança das Edge Functions, (2) cobertura de testes, (3) performance do bundle."

**Subagentes que você tem:**

| Subagente | Especialidade |
|---|---|
| `supabase-engineer` | schema, migrations, RLS, Edge Functions |
| `devops-cloudflare` | deploy, DNS, CI, rollback |
| `qa-security` | fluxos, permissões, regressões |
| `fullstack-engineer` | mudanças com menor diff + testes |
| `data-analyst` | métricas, atribuição, receita |
| `project-researcher` | investigar antes de mudar |
| `ecc:code-reviewer`, `ecc:security-reviewer`, `ecc:database-reviewer` | revisões específicas |

**Dica:** no modo "fork" o subagente herda todo o histórico da conversa (barato) e roda em background.

---

### 4. Memória automática — o Claude Sonnet 5 Code anota o que aprendeu

**O que é:** arquivos em `~/.claude/projects/<projeto>/memory/` que eu leio no início de cada sessão.

**Seus arquivos agora:**
```
MEMORY.md                                    ← índice (sempre carregado)
feedback_placeholder_env_breaks_build.md     ← lição do bug do login
feedback_questions_as_selection.md
feedback_visual_identity.md
project_goat_audit_2026_11.md
```

**Como eu escrevo:** crio `<tipo>_<assunto>.md` com frontmatter `name`/`description`/`metadata.type`, e adiciono uma linha no `MEMORY.md`.

**Como você usa:** basta dizer "guarda isso na memória".

**O que é boa memória:** uma **lição com causa-raiz e método de verificação**, não um status. Exemplo do que salvei hoje:

> Nunca sanitizar `.env` com placeholder e buildar. O Vite injeta `import.meta.env.VITE_*` no bundle com precedência sobre o fallback do código → login quebra por DNS. **Como verificar:** `grep` no bundle publicado + `curl` na API do Supabase (chave real = HTTP 400; placeholder = HTTP 000 "Could not resolve host").

---

### 5. `/loop` — repete a tarefa sozinho

**O que é:** o Ralph Loop. Você dá um prompt; quando eu tento terminar, o loop me devolve o **mesmo prompt** e eu continuo iterando.

**Comando:**
```
/loop <prompt> --max-iterations 10
```

**Exemplo real na Growdash:**
```
/loop Audite as Edge Functions em supabase/functions/ procurando fetch sem timeout e corrija com fetchWithTimeout. A cada iteração rode npm test. --max-iterations 5
```

**Como funciona por baixo:** um hook `Stop` (em `ralph-loop/1.0.1/hooks/stop-hook.sh`) intercepta minha tentativa de encerrar e me injeta o prompt de novo.

**Cuidado (importante):**
- O loop **reaproveita o mesmo contexto**. Em tarefa longa, o contexto estoura.
- Use `--completion-promise "..."` para definir a condição de saída verdadeira.
- Combine com `git commit` por iteração: cada iteração vira um commit, então o histórico mostra o progresso mesmo se o loop morrer.

**Variante mais leve:** o skill `loop` (`/loop 5m /faz-a-coisa`) agenda reexecuções **dentro da mesma sessão**, com intervalo.

---

## NÍVEL 7 — Rodar sem você (o mais útil pra você)

### A. `claude -p` — modo headless

**O que é:** roda o Claude Sonnet 5 Code como um comando de terminal. Sem interface, sem você.

```bash
# Uma tarefa
Claude Sonnet 5 -p "Corrija os testes que estão falhando em src/lib/ e faça commit"

# Com permissão total (cuidado!)
Claude Sonnet 5 -p "$(cat .audit/FIX_PROMPT.md)" --dangerously-skip-permissions --output-format json

# Múltiplas linhas de prompt
Claude Sonnet 5 -p "faça X" "faça Y" "faça Z"
```

**Opções úteis:**
| Flag | O que faz |
|---|---|
| `-p` | modo print (headless) |
| `--output-format json` | resultado em JSON (parseável) |
| `--dangerously-skip-permissions` | **sem prompts** — só em ambiente isolado |
| `--allowedTools "Bash(npm test:*)"` | restringe o que ele pode fazer |

---

### B. Scheduled Tasks — PC desligado, roda sozinho

**O que é:** tasks que rodam em horários definidos, independente de sessão aberta.

**Sua config atual:**
```
.claude/scheduled_tasks.json  →  { "tasks": [] }   (vazio)
```

**Ferramentas:**
```
mcp__scheduled-tasks__create_scheduled_task
mcp__scheduled-tasks__list_scheduled_tasks
mcp__scheduled-tasks__run_scheduled_task
mcp__scheduled-tasks__delete_scheduled_task
mcp__scheduled-tasks__list_task_runs
```

**Exemplo — reconciliação diária do RD às 4h:**
```
Cria uma task agendada para todo dia às 04:00 que rode:
"Execute a reconciliação de vendas RD no Supabase, verifique o estado em
rd_sync_scope_state e, se houver erro, registre em .audit/STATE.md.
Não faça deploy."
```

**Quando o PC está desligado:** o agendador roda no **servidor do Claude Sonnet 5 Code** (cloud), não na sua máquina. Para tarefas que dependem do seu filesystem local, o PC precisa estar ligado.

---

### C. Agent Teams — um time com um líder

**O que é:** N agentes com papéis definidos (backend, frontend, QA, segurança) rodando em paralelo, com um líder que coordena e revisa.

**Como pedir:**
> "Crie um agent team com 4 agentes: um para segurança (Edge Functions), um para o bundle/performance, um para RLS e um para testes. Cada um audita sua área e reporta achados com arquivo:linha."

**Comando do Workflow tool:** o `Workflow` (habilitado no seu `settings.json` via `enableWorkflows: true`) executa um roteiro determinístico com N agentes, cada um validando o achado do anterior.

**Agent Team vs. subagentes soltos:**
- Subagentes soltos = tarefas independentes, resultado lido por você.
- Agent Team = quando um agente depende do resultado do outro (ex.: auditor → corretor → revisor).

---

### D. Ultrathink — pensar mais fundo

**O que é:** aumenta o orçamento de raciocínio do modelo para a resposta.

```
/ultrathink
```
Ou prefixe o pedido: `/ultrathink redesenhe a camada de sincronização do RD`

**Use quando:** a resposta exige raciocínio longo (auditoria, arquitetura, bug elusive). Não use para tarefas mecânicas.

**Economia de tokens:** com `/model` você pode usar um modelo mais barato (ex.: Haiku) para tarefas mecânicas e guardar o Sonnet/Opus para raciocínio.

---

## NÍVEL 8 — Nível máximo

### A. Workflows dinâmicos

**O que é:** um script JavaScript que orquestra dezenas de agentes com fases, validação cruzada e retry.

**Como ativar:** já está no seu `settings.json` (`enableWorkflows: true`).

**Exemplo — auditoria completa da Growdash:**
```javascript
export const meta = {
  name: "auditoria-growdash",
  description: "Audita segurança, performance e testes em paralelo",
  phases: [
    { title: "Auditoria", detail: "security + performance + tests" },
    { title: "Verificação", detail: "confirma cada achado" },
  ],
};

const DIMENSOES = [
  { key: "seguranca", prompt: "Audite auth/RLS/secrets em supabase/functions. Reporte com arquivo:linha." },
  { key: "performance", prompt: "Audite timeouts, queries sem índice e bundle size." },
  { key: "testes", prompt: "Audite cobertura: o que não tem teste?" },
];

const achados = await pipeline(
  DIMENSOES,
  d => agent(d.prompt, { label: `auditar:${d.key}`, phase: "Auditoria", schema: ACHADOS_SCHEMA }),
  (achados) => parallel(achados.map(a =>
    agent(`Verifique adversarialmente: ${a.titulo}. Confirme em arquivo:linha.`, {
      label: `verificar:${a.id}`, phase: "Verificação", schema: VERDICT_SCHEMA,
    }).then(v => ({ ...a, verdict: v }))
  ))
);
```

**Só rode quando o usuário pedir explicitamente** (o `Workflow` tool exige consentimento).

---

### B. Claude Sonnet 5 Code no GitHub

**O que é:** um bot que atende Issues e PRs com `@claude`.

**Instalação:** plugin `github` já está ativo. Precisa do app instalado no repositório:
```
/github
```
→ install the GitHub app

**O que ele faz:**
- Comenta em Issue/PR com Explain/Review
- Cria branches e PRs a partir de um comentário
- Roda comandos do CI e interpreta o resultado

**Cuidado:** ele tem acesso ao repositório. Conceda apenas nos repositórios certos.

---

### C. Projetos que rodam por semanas

**O que é:** um repositório com um `CLAUDE.md` que define papel, contexto e regras; tasks persistentes; e o Claude Sonnet 5 working em background.

**Para a Growdash, o equivalente já existe:**
- `.claude/skills/dev-master/skill.md` ← o "CLAUDE.md" specialized
- `.claude/settings.json` ← permissões e hooks
- `.claude/scheduled_tasks.json` ← tasks agendadas
- `AGENTS.md` na raiz ← as 4 fases obrigatórias de validação
- `docs/PROMPT_MASTER_*.md` ← o mapa de cada trabalho

**Para ir além:**
1. `.claude/agents/*.md` — seus agentes customizados (você já tem 16 em `~/.claude/agents/`)
2. `.claude/skills/` — suas skills (você tem `dev-master`)
3. `.claude/workflows/` — roteiros de workflow versionados no repo
4. `docs/PROMPT_MASTER_*.md` — o mapa de cada tarefa grande

---

## O que eu recomendo para VOCÊ, agora

### 1. Crie o `.claude/settings.json` do projeto (5 min)
Resolve o atrito do GateGuard em tarefas de auditoria.

### 2. Use `/loop` com commit por iteração (o padrão mais seguro)
```
/loop Audite as Edge Functions em supabase/functions/ buscando fetch sem timeout, corrija com fetchWithTimeout e rode npm test ao fim de cada bloco. Faça um commit por bloco corrigido. --max-iterations 8 --completion-promise "Todas as chamadas a provedores externos têm timeout e npm test passa"
```

### 3. Use `claude -p` no terminal para o ciclo noturno
```bash
cd "/Users/thiegojesus/Documents/Codex/PROJETOS – APP/Growdash"
nohup Claude Sonnet 5 -p "$(cat .audit/FIX_PROMPT.md)" --dangerously-skip-permissions --output-format json \
  >> .audit/logs/cycle-1.json 2>&1 &
```
Roda no teu Mac, sobrevive ao fechamento do app, e você lê o log de manhã.

> **Regra de ouro do `--dangerously-skip-permissions`:** só em repositório onde você aceita perder. O `deny` do `settings.json` é cinto de segurança, não airbag — a proteção real é o ambiente não ter nada que valha a pena perder.

### 4. Combine com `/ultrathink` só quando for raciocínio denso
Auditoria de segurança, arquitetura de sync, incidente elusive.

---

## Comandos de referência rápida

| Quero... | Comando |
|---|---|
| Ver skills | `/skills` |
| Ver hooks | `/hooks` |
| Ver plugins | `/plugin` |
| Criar skill | `/skill-creator` |
| Loop de tarefa | `/loop <prompt>` |
| Loop do Ralph | `/ralph-loop <prompt> --max-iterations N` |
| Raciocínio máximo | `/ultrathink <pedido>` |
| Modo headless | `claude -p "<prompt>"` |
| Task agendada | `mcp__scheduled-tasks__create_scheduled_task` |
| Agente em paralelo | peça "em paralelo" |
| Time de agentes | peça "crie um agent team" |
| Workflow determinístico | tool `Workflow` (com consentimento) |
| Bot no GitHub | `/github` → install app |
| Review do diff | `/code-review` |

---

## Conceitos que confundem

| Termo | Significado real |
|---|---|
| **Hook** | script automático ligado a um evento (não é o mesmo que "hook" de API) |
| **Skill** | receita em pasta que o Claude Sonnet 5 Code segue (não é prompt colado) |
| **Subagent** | Claude Sonnet 5 Code separado com contexto próprio (não vê a conversa) |
| **Fork** | subagent que herda a conversa inteira (barato) |
| **Agent Team** | vários subagentes com papéis + líder |
| **Workflow** | script JS que orchestra agentes com fases |
| **MCP** | servidor de ferramentas externas (Supabase, Cloudflare, GitHub) |
| **Scheduled task** | task que roda em horário, sem sessão aberta |
| **`claude -p`** | headless, scriptável, ideal para CI/noturno |
| **`/loop`** | reexecuta o prompt na mesma sessão |
