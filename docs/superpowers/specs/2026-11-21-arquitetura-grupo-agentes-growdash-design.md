# Arquitetura do Grupo de Agentes Growdash

**Data:** 2026-11-21
**Status:** Design aprovado em conversa; implementação pendente do plano de execução
**Decisão:** Claude Sonnet 5 atua como CEO; o `agency-orchestrator` atua como Chief of Staff/COO; departamentos encaminham tarefas para agentes e skills especialistas.

## 1. Objetivo

Criar uma arquitetura única de orquestração para que o operador selecione uma área e descreva uma tarefa. O CEO deverá identificar o trabalho necessário, montar a equipe adequada, executar etapas seguras e apresentar evidências para revisão antes de ações sensíveis.

A arquitetura terá duas superfícies com o mesmo contrato:

- **Claude Sonnet 5 Code:** comando `/growdash <departamento> <tarefa>`.
- **Growdash:** painel do Escritório de Agentes com seletor de departamento e campo de tarefa.

O sistema deve reutilizar o núcleo existente `AgentChatDock` e a Edge Function `agent-office-chat`, evitando um segundo escritório de agentes.

## 2. Hierarquia operacional

```text
Claude Sonnet 5 — CEO
└── Chief of Staff / COO — agency-orchestrator
    ├── Desenvolvimento, Agentes e Engenharia
    ├── Frontend, React, Next.js e UI
    ├── Segurança
    ├── Visualização e Dashboards
    ├── Animação e Motion Design
    ├── Vídeo e Remotion
    ├── Marketing, Vendas e Crescimento
    ├── Meta, Claude Sonnet 5, Notion, Slack e Documentos
    ├── Adobe, Imagem e Design
    ├── Games e 3D
    ├── GitHub, CI/CD e Infraestrutura
    ├── Apple, Swift e macOS
    ├── OpenAI e Integrações de IA
    ├── Screenpipe e Memória Operacional
    ├── Ponytail
    ├── Wix
    ├── Skills Supabase
    ├── Skills Superpowers
    └── Skills ECC
```

O CEO é o roteador e consolidador. Um departamento não executa ações fora do seu escopo sem registrar a dependência e solicitar a participação do departamento responsável.

## 3. Catálogo de departamentos

Cada departamento terá um identificador estável, um diretor, especialistas e gatilhos semânticos. O catálogo será a fonte única usada pelo comando e pelo painel.

| ID | Departamento | Diretor principal | Especialistas principais |
|---|---|---|---|
| `engineering` | Desenvolvimento, Agentes e Engenharia | `fullstack-engineer` | `agency-orchestrator`, `ecc:code-architect`, `ecc:planner`, `ecc:feature-dev`, `ecc:typescript-reviewer`, `ecc:refactor-cleaner` |
| `frontend` | Frontend, React, Next.js e UI | `fullstack-engineer` | frontend developer, `ecc:react-reviewer`, `ecc:react-build-resolver`, `ecc:nextjs-turbopack`, `frontend-design`, `ecc:frontend-a11y` |
| `security` | Segurança | `qa-security` | `claude-security`, `ecc:security-reviewer`, `security-audit`, `security-diff-scan`, `deep-security-scan` |
| `dataviz` | Visualização e Dashboards | `data-analyst` | `dataviz`, `ecc:react-and-nextjs-data-visualization`, dashboard e acessibilidade |
| `motion` | Animação e Motion Design | `creative-director` | GSAP, 60fps, animação acessível, SVG, motion graphics |
| `video` | Vídeo e Remotion | `video-editor` | Remotion, captions, render, multimídia, short-form video |
| `growth` | Marketing, Vendas e Crescimento | `marketing-strategist` | `meta-traffic`, `crm-sdr`, `website-conversion`, marketing e sales skills |
| `integrations` | Meta, Claude Sonnet 5, Notion, Slack e Documentos | `meta-traffic` | Google Workspace, Notion, Slack, documentos, PDF e planilhas |
| `creative` | Adobe, Imagem e Design | `creative-director` | Adobe, Canva, Figma, imagegen e revisão de marca |
| `games3d` | Games e 3D | `fullstack-engineer` | Three.js, React Three Fiber, Phaser, WebGL e pipeline 3D |
| `devops` | GitHub, CI/CD e Infraestrutura | `devops-cloudflare` | GitHub, CircleCI, Cloudflare, deployment patterns e PR review |
| `apple` | Apple, Swift e macOS | `fullstack-engineer` | Swift, SwiftUI, SwiftPM, AppKit e build resolver |
| `ai-integrations` | OpenAI e Integrações de IA | `fullstack-engineer` | APIs de IA, Agent SDK, MCP server e integrações externas |
| `memory` | Screenpipe e Memória Operacional | `project-researcher` | Screenpipe, recall, handoff, decisões, contexto e telemetry |
| `ponytail` | Ponytail | `project-researcher` | Ponytail, audit, debt, gain, help e review |
| `wix` | Wix | `website-conversion` | Wix app, design system, docs, headless, templates e manage |
| `supabase` | Skills Supabase | `supabase-engineer` | Supabase, Postgres, migrations, RLS, database reviewer |
| `superpowers` | Skills Superpowers | `agency-orchestrator` | brainstorming, debugging, TDD, planos, execução e verificação |
| `ecc` | Skills ECC | `agency-orchestrator` | arquitetura, build, revisão, segurança, testes, performance e DevOps |

O catálogo deve apontar apenas para recursos realmente instalados ou disponíveis. O roteador não deve inventar o nome de uma skill, agente ou conector.

## 4. Contrato de entrada

### Claude Sonnet 5 Code

```text
/growdash <departamento> <tarefa>
```

Exemplos:

```text
/growdash frontend Criar um filtro responsivo no dashboard de conversão
/growdash security Auditar a função de sincronização RD Station
/growdash devops Verificar a divergência local, GitHub e Cloudflare
/growdash ceo Planejar uma mudança que cruza frontend, Supabase e deploy
/growdash listar
```

O departamento pode ser o ID estável ou um alias legível. Se o usuário não informar departamento, o CEO classifica a tarefa e propõe um departamento antes de executar.

### Growdash

O painel deverá enviar um payload equivalente:

```ts
type AgentOfficeTaskRequest = {
  departmentId: DepartmentId | "ceo";
  task: string;
  workspaceId: string;
  scope?: {
    accountIds?: string[];
    funnelIds?: string[];
    startDate?: string;
    endDate?: string;
  };
  mode: "automatic_review";
};
```

A tarefa deve preservar o contexto existente do workspace, período, contas e funis. Dados de escopo não devem ser inseridos no prompt como autoridade sem validação no backend.

## 5. Roteamento

O CEO executará as seguintes etapas:

1. Validar departamento e escopo da tarefa.
2. Identificar intenção, artefato esperado, risco e dependências.
3. Selecionar o diretor do departamento.
4. Selecionar somente os especialistas relevantes por gatilhos da tarefa.
5. Classificar etapas como leitura, alteração local, ação externa ou ação destrutiva/sensível.
6. Executar leituras e análises independentes em paralelo quando não houver dependência.
7. Consolidar a recomendação e evidências.
8. Solicitar revisão antes de commit, push, deploy, migration, publicação, envio de mensagens, alteração de orçamento ou qualquer ação externa.
9. Após autorização explícita, encaminhar a ação ao agente responsável e registrar o resultado.

O CEO não deve acionar todos os agentes de um departamento por padrão. O objetivo é selecionar a equipe mínima suficiente, reduzindo custo, latência e conflito de instruções.

## 6. Regras de autonomia e autorização

O modo padrão é `automatic_review`.

### Pode executar sem aprovação adicional

- Leitura de arquivos, status, diff e histórico.
- Busca e análise de código.
- Testes locais não destrutivos.
- Lint, typecheck e build local.
- Leitura de logs e páginas de documentação.
- Preparação de plano, diff e relatório.

### Deve parar para revisão

- `git commit`, `git push` e criação de PR.
- Deploy no Cloudflare, GitHub Actions ou outro ambiente.
- Migrations, alterações de schema, RLS ou dados remotos.
- Alterações de DNS, secrets, permissões ou credenciais.
- Publicação de anúncio, alteração de orçamento ou duplicação de campanha.
- Envio de e-mail, Slack, WhatsApp ou mensagem externa.
- Exclusão de arquivos, branches, dados ou recursos.

O CEO deve apresentar, antes da aprovação:

- Equipe acionada.
- Arquivos e recursos afetados.
- Evidências coletadas.
- Riscos e dependências.
- Testes executados.
- Ação aguardando autorização.

## 7. Integração com a Growdash

A implementação deverá evoluir os pontos existentes:

- `src/components/agents/AgentChatDock.tsx`: trocar ou complementar a seleção de diretor por seleção de departamento, mantendo compatibilidade com os diretores já visíveis.
- `supabase/functions/agent-office-chat/index.ts`: receber `departmentId`, resolver o catálogo e criar o plano de execução antes da resposta.
- Catálogo de departamentos: novo módulo compartilhado entre UI e backend, com IDs, aliases, diretor e especialistas.
- Persistência: reutilizar as conversas e mensagens existentes; registrar departamento, equipe escolhida, status e necessidade de aprovação em campos ou entidade própria conforme o schema atual.

A UI deverá mostrar o estado do trabalho:

```text
Recebido → Roteando → Investigando → Executando → Revisão necessária → Concluído
```

Erros devem aparecer como estado explícito, nunca como sucesso vazio ou resposta genérica sem evidência.

## 8. Integração com o fluxo obrigatório da Growdash

Para tarefas de código, o roteador deve respeitar `AGENTS.md`:

1. Código local: status, diff, arquivos e testes.
2. GitHub/remoto: branch, fetch e divergência com `origin/main`.
3. Cloudflare Pages: deployment, URL, commit/hash e assets.
4. Navegador: somente depois dos passos anteriores, com console e interface após reload/navegação.

A seleção de departamento não pode pular esses gates. Um departamento pode indicar que uma etapa não é aplicável, mas deve registrar o motivo.

## 9. Revisão cruzada

Tarefas com mais de um domínio terão um diretor coordenador e revisores específicos. Exemplos:

- UI com gráfico: `frontend` coordena; `dataviz`, TypeScript e acessibilidade revisam.
- Migration Supabase com tela: `supabase` coordena; `engineering`, `security` e `frontend` participam conforme o impacto.
- Deploy Cloudflare: `devops` coordena; `engineering`, segurança e navegador verificam.
- Criativo de Meta Ads: `growth` coordena; `creative`, `video` e `legal-compliance` revisam.

Nenhum agente deve duplicar o trabalho de outro agente. O resultado de cada especialista deve ter formato estruturado: achados, evidências, bloqueios e recomendação.

## 10. Critérios de aceite

A arquitetura será considerada implementada quando:

- O comando `/growdash` aceitar departamento por ID ou alias.
- `/growdash listar` mostrar todos os 19 departamentos e seus diretores.
- Uma tarefa simples acionar somente a equipe mínima necessária.
- Uma tarefa cruzada montar um plano com mais de um departamento e respeitar dependências.
- O painel Growdash e o comando usarem o mesmo catálogo.
- O sistema exibir equipe, plano, evidências e status de revisão.
- Ações sensíveis ficarem bloqueadas até aprovação explícita.
- O contexto de workspace, contas, funis e período continuar sendo aplicado.
- Falhas de agente/conector aparecerem como falha identificável, sem mascaramento.
- Houver testes para roteamento, aliases, equipe mínima, tarefa cruzada, bloqueio de ações sensíveis e erro de especialista.
- A validação seguir o fluxo local → GitHub → Cloudflare → navegador quando o trabalho for código/deploy.

## 11. Fora de escopo desta etapa

- Implementar todos os 19 departamentos em uma única mudança.
- Criar um novo modelo de IA ou substituir a infraestrutura de autenticação.
- Executar deploy, migration, push ou publicação.
- Inventar conectores para serviços que estejam sem autenticação.
- Acionar automaticamente agentes externos sem registrar autorização e evidências.

## 12. Decisão técnica

A primeira implementação deve começar pelo catálogo e pelo roteamento no `agent-office-chat`, depois adaptar o painel e por último criar o comando `/growdash` no ambiente do Claude Sonnet 5 Code. Essa ordem mantém uma fonte de verdade única e permite testar o roteador antes de expô-lo a ações de produção.
