# Growdash Panel Department Router Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o catálogo compartilhado e o roteamento do Escritório de Agentes da Growdash, permitindo selecionar um departamento, montar a equipe mínima e bloquear ações sensíveis até revisão.

**Architecture:** `src/lib/departmentCatalog.ts` será a fonte única de IDs, aliases, rótulos, diretores, especialistas e gatilhos. A Edge Function receberá `departmentId`, resolverá o plano e devolverá equipe/status; `AgentChatDock` consumirá o mesmo catálogo e exibirá a sequência operacional. O contrato atual de conversas e mensagens será preservado.

**Tech Stack:** TypeScript, React 18, Vite, Vitest, Supabase Edge Functions, Deno.

**Spec:** `docs/superpowers/specs/2026-11-21-arquitetura-grupo-agentes-growdash-design.md`

## Global Constraints

- Seguir `AGENTS.md`: código local → GitHub/remoto → Cloudflare Pages → navegador para mudanças de código/deploy.
- Não executar commit, push, deploy, migration, alteração remota, mensagem externa ou campanha sem aprovação explícita.
- Usar somente agentes, skills e conectores existentes; não inventar nomes de recursos.
- Não alterar o provedor de IA nesta entrega; a Edge Function atual usa o contrato existente de `AI_API_URL`/`AI_API_KEY`.
- Cada tarefa termina com teste local reproduzível; nenhuma etapa depende de rede ou autenticação real.
- Não modificar `.env`, credenciais ou dados de produção.

---

### Task 1: Catalogar departamentos e aliases

**Files:**
- Create: `src/lib/departmentCatalog.ts`
- Create: `src/lib/departmentCatalog.test.ts`

**Interfaces:**
- Produces `DepartmentId`, `Department`, `DEPARTMENT_CATALOG`, `listDepartments()`, `getDepartmentById(id)`, `getDepartmentByAlias(alias)`, `resolveSpecialistsForTask(departmentId, task)`.
- `Department` contém `id`, `label`, `director`, `specialists`, `aliases` e `triggers`.

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, expect, it } from "vitest";
import {
  getDepartmentByAlias,
  listDepartments,
  resolveSpecialistsForTask,
} from "./departmentCatalog";

describe("departmentCatalog", () => {
  it("lists the 19 stable departments", () => {
    expect(listDepartments()).toHaveLength(19);
    expect(listDepartments().map((item) => item.id)).toContain("integrations");
  });

  it("resolves Portuguese and stable aliases", () => {
    expect(getDepartmentByAlias("frontend")?.id).toBe("frontend");
    expect(getDepartmentByAlias("segurança")?.id).toBe("security");
    expect(getDepartmentByAlias("banco")?.id).toBe("supabase");
  });

  it("selects the minimum specialists for a task", () => {
    expect(resolveSpecialistsForTask("frontend", "corrigir componente React")).toEqual(
      expect.arrayContaining(["ecc:react-reviewer"]),
    );
    expect(resolveSpecialistsForTask("frontend", "ajustar texto")).not.toContain(
      "ecc:react-reviewer",
    );
  });
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npm test -- src/lib/departmentCatalog.test.ts`

Expected: FAIL because `src/lib/departmentCatalog.ts` does not exist.

- [ ] **Step 3: Implement the catalog**

Use the 19 IDs from the approved spec: `engineering`, `frontend`, `security`, `dataviz`, `motion`, `video`, `growth`, `integrations`, `creative`, `games3d`, `devops`, `apple`, `ai-integrations`, `memory`, `ponytail`, `wix`, `supabase`, `superpowers`, `ecc`.

The integrations label must be **“Meta, Claude Sonnet 5, Notion, Slack e Documentos”**. Normalize aliases with `toLocaleLowerCase("pt-BR")`, trim whitespace, and match stable IDs before aliases. `resolveSpecialistsForTask` returns only specialists whose trigger terms occur in the normalized task; if none match, return the department director plus the first general specialist.

- [ ] **Step 4: Run the focused test and confirm success**

Run: `npm test -- src/lib/departmentCatalog.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit only this task**

```bash
git add src/lib/departmentCatalog.ts src/lib/departmentCatalog.test.ts
git commit -m "feat(agents): add Growdash department catalog\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Add a pure routing-plan builder

**Files:**
- Create: `src/lib/agentRouting.ts`
- Create: `src/lib/agentRouting.test.ts`

**Interfaces:**
- Consumes `DepartmentId`, `Department`, and `resolveSpecialistsForTask`.
- Produces `TaskRisk`, `AgentTaskStatus`, `RoutingPlan`, and `buildRoutingPlan(input)`.
- `buildRoutingPlan` receives `{ departmentId, task, requestedDepartments? }` and returns `{ department, director, specialists, risk, needsApproval, steps, dependencies }`.

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, expect, it } from "vitest";
import { buildRoutingPlan } from "./agentRouting";

describe("buildRoutingPlan", () => {
  it("selects one director and minimum specialists for a read task", () => {
    const plan = buildRoutingPlan({
      departmentId: "frontend",
      task: "investigar o filtro do dashboard",
    });
    expect(plan.director).toBe("fullstack-engineer");
    expect(plan.needsApproval).toBe(false);
    expect(plan.risk).toBe("read");
  });

  it("requires approval for deployment and external actions", () => {
    const plan = buildRoutingPlan({
      departmentId: "devops",
      task: "publicar a nova versão no Cloudflare",
    });
    expect(plan.needsApproval).toBe(true);
    expect(plan.risk).toBe("external");
  });

  it("adds cross-department dependencies", () => {
    const plan = buildRoutingPlan({
      departmentId: "frontend",
      requestedDepartments: ["supabase"],
      task: "criar tela com dados do Supabase",
    });
    expect(plan.dependencies).toContain("supabase");
  });
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npm test -- src/lib/agentRouting.test.ts`

Expected: FAIL because the routing module does not exist.

- [ ] **Step 3: Implement the minimal plan builder**

Classify tasks using explicit boundary terms:

- `read`: investigar, analisar, listar, diagnosticar, revisar.
- `local`: criar, editar, corrigir, refatorar, testar.
- `external`: publicar, deploy, push, enviar, anunciar, alterar orçamento, migration.
- `destructive`: apagar, excluir, remover branch, resetar, destruir.

`needsApproval` is true for `external` and `destructive`; it is false for `read` and `local`. Do not execute actions in this module. Return deterministic steps: `validate`, `route`, `investigate`, `execute-or-prepare`, `review-or-complete`.

- [ ] **Step 4: Run the focused test and confirm success**

Run: `npm test -- src/lib/agentRouting.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit only this task**

```bash
git add src/lib/agentRouting.ts src/lib/agentRouting.test.ts
git commit -m "feat(agents): build review-aware routing plans\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Integrate the routing plan into the Edge Function

**Files:**
- Modify: `supabase/functions/agent-office-chat/index.ts` around request parsing and response creation.
- Create: `supabase/functions/agent-office-chat/routingContract.test.ts` if the Deno test harness is available; otherwise keep pure-contract coverage in `src/lib/agentRouting.test.ts`.

**Interfaces:**
- Consumes request fields `departmentId`, `question`, `scope`, and existing `agent_role` for backward compatibility.
- Produces response fields `department`, `routingPlan`, `status`, and `needsApproval` alongside the existing `conversationId`, `agent`, `message`, `configured`, and `facts`.

- [ ] **Step 1: Add contract assertions before implementation**

Extend the routing tests with the response shape:

```typescript
it("returns an approval gate without executing the sensitive action", () => {
  const plan = buildRoutingPlan({ departmentId: "devops", task: "fazer deploy" });
  expect(plan.needsApproval).toBe(true);
  expect(plan.steps.at(-1)).toBe("review-or-complete");
});
```

- [ ] **Step 2: Run the test and confirm the contract is represented**

Run: `npm test -- src/lib/agentRouting.test.ts`

Expected: PASS before the Edge Function integration.

- [ ] **Step 3: Parse and validate `departmentId` in the Edge Function**

Import the catalog/routing logic using a Deno-compatible shared module or a deliberately duplicated boundary adapter only if importing `src/lib` is rejected by the Edge runtime. Reject an unknown explicit department with `DEPARTMENT_NOT_FOUND` (HTTP 400). When omitted, preserve legacy `agent_role` behavior and use `ceo` as the department fallback.

Pass only validated workspace scope into the existing fact queries. Do not add action execution to this function.

- [ ] **Step 4: Return the plan and status**

Return:

```typescript
{
  department: { id, label, director },
  routingPlan: { specialists, risk, steps, dependencies },
  status: needsApproval ? "waiting_approval" : configured ? "answered" : "queued",
  needsApproval,
}
```

Persist the selected department and plan metadata only if the existing table schema already supports it; otherwise include it in the response and defer migration to a separately approved task.

- [ ] **Step 5: Run local tests and type checks**

Run: `npm test -- src/lib/departmentCatalog.test.ts src/lib/agentRouting.test.ts && npm run lint`

Expected: PASS with no unrelated file changes.

- [ ] **Step 6: Commit only this task**

```bash
git add supabase/functions/agent-office-chat/index.ts src/lib/agentRouting.test.ts
 git commit -m "feat(agents): expose routing plan from agent office function\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Add department selection and routing status to AgentChatDock

**Files:**
- Modify: `src/components/agents/AgentChatDock.tsx`
- Create: `src/components/agents/AgentChatDock.test.tsx`

**Interfaces:**
- Consumes `listDepartments()` and `AgentTaskStatus`.
- Sends `{ departmentId, question, scope, mode: "automatic_review" }` to `agent-office-chat`.
- Renders selected department, director/team, status and approval banner.

- [ ] **Step 1: Write the failing component tests**

```tsx
it("shows the department selector and selected department", async () => {
  render(<AgentChatDock />);
  expect(screen.getByRole("combobox", { name: /departamento/i })).toBeInTheDocument();
  await user.click(screen.getByRole("combobox", { name: /departamento/i }));
  expect(screen.getByText("Segurança")).toBeInTheDocument();
});

it("sends the selected department with the task", async () => {
  // Mock workspace, filters, agents query and supabase.functions.invoke.
  // Select `frontend`, type a task and press Enter.
  expect(invokeMock).toHaveBeenCalledWith("agent-office-chat", expect.objectContaining({
    body: expect.objectContaining({ departmentId: "frontend", mode: "automatic_review" }),
  }));
});
```

- [ ] **Step 2: Run the component test and confirm failure**

Run: `npm test -- src/components/agents/AgentChatDock.test.tsx`

Expected: FAIL because the department selector and `departmentId` payload do not exist.

- [ ] **Step 3: Implement the smallest UI change**

Keep the existing director tabs as a secondary compatibility control. Add a department combobox above them, defaulting to `engineering` or the current `ceo` context. Track `taskStatus` locally and map response status to `recebido`, `roteando`, `investigando`, `executando`, `revisao-necessaria`, or `concluido`.

Send:

```typescript
body: {
  departmentId: selectedDepartment.id,
  agent_role: role,
  conversation_id: conversationId,
  question,
  mode: "automatic_review",
  scope: { accountIds: adAccountIds, funnelIds, startDate, endDate },
}
```

Render the team and an approval banner when `response.data.needsApproval === true`. Do not add buttons that execute commit/deploy/migration; show the pending action only.

- [ ] **Step 4: Run component tests and lint**

Run: `npm test -- src/components/agents/AgentChatDock.test.tsx && npm run lint`

Expected: PASS.

- [ ] **Step 5: Commit only this task**

```bash
git add src/components/agents/AgentChatDock.tsx src/components/agents/AgentChatDock.test.tsx
 git commit -m "feat(ui): add department routing to agent chat dock\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Verify the panel flow in the browser

**Files:**
- Verify: `src/components/agents/AgentChatDock.tsx`, `src/lib/departmentCatalog.ts`, `supabase/functions/agent-office-chat/index.ts`
- No source changes unless a failing browser assertion identifies a concrete defect.

- [ ] **Step 1: Run local tests and production build**

Run: `npm test && npm run build`

Expected: PASS.

- [ ] **Step 2: Follow Growdash validation order**

Before opening the browser, inspect `git status`, run `git fetch`, compare with `origin/main`, and verify the active Cloudflare deployment/commit. Do not claim production validation if HTML/chunks are from an older version.

- [ ] **Step 3: Exercise the panel golden path**

Open the authenticated route only after the previous checks. Select `Frontend, React, Next.js e UI`, submit a read-only task, verify the status progression and response team. Submit a deploy-like task and verify `Revisão necessária` without any external action.

- [ ] **Step 4: Read console and network evidence**

Expected: no uncaught console errors, request includes `departmentId` and `mode`, response includes `routingPlan` and `needsApproval`.

- [ ] **Step 5: Record verification**

Report exact route, deployment commit/hash, request/response evidence, tests, and any unverified connector. Do not push or deploy as part of this plan.

## Execution Handoff

This plan is complete and saved at `docs/superpowers/plans/2026-11-21-growdash-panel-department-router.md`. Execute it only after choosing either subagent-driven or inline execution.
