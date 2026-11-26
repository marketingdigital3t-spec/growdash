# Growdash Automações MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the existing `/automacoes` module into a workspace-scoped visual workflow editor and execution history for Webhook, HTTP Request, and Google Sheets, without breaking current Instagram automation behavior.

**Architecture:** Keep the existing `growdash_automations` and `growdash_automation_runs` tables as the persistence boundary, adding a versioned `workflow_definition` JSON contract. Keep the editor UI independent from execution; the Supabase Edge Function validates and executes declarative nodes with sanitized run records. Route `/automacoes` remains protected by `can_automations` and uses the existing Growdash shell.

**Tech Stack:** React, TypeScript, React Router, TanStack Query, Supabase/Postgres, Supabase Edge Functions, existing Growdash UI primitives, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-20-automacoes-mvp-design.md`

## Global Constraints

- Preserve all existing uncommitted user changes; edit only files listed in each task.
- Do not remove or change existing Instagram trigger/action semantics.
- Keep workflows workspace-scoped through existing RLS and `workspace_id` filters.
- Never persist or log credential secrets in workflow JSON or execution history.
- Do not claim production validation until local tests, build, deployment and authenticated UI verification are complete.

### Task 1: Add the versioned workflow contract and database fields

**Files:**
- Create: `src/growdash/automations/workflowTypes.ts`
- Create: `src/growdash/automations/workflowValidation.ts`
- Create: `src/growdash/automations/workflowValidation.test.ts`
- Create: `supabase/migrations/20261020120000_growdash_workflow_definition.sql`

**Interfaces:**
- `WorkflowNodeType = "webhook.trigger" | "http.request" | "google.sheets.append"`.
- `WorkflowDefinition` contains `id`, `name`, `version`, `active`, `nodes`, and `connections`.
- `validateWorkflowDefinition(value: unknown): { ok: true; value: WorkflowDefinition } | { ok: false; errors: string[] }`.

- [ ] **Step 1: Write failing validation tests** for a valid linear workflow, missing node references, duplicate node IDs, unsupported node types, and cycles.
- [ ] **Step 2: Run** `npm test -- --run src/growdash/automations/workflowValidation.test.ts`; expect failures because the contract module does not exist.
- [ ] **Step 3: Implement** strict TypeScript types and validation with no secret fields.
- [ ] **Step 4: Run** the focused test and confirm all cases pass.
- [ ] **Step 5: Add migration** with nullable `workflow_definition jsonb`, `workflow_version integer not null default 1`, and an index by `(workspace_id, updated_at desc)`; leave existing rows valid.
- [ ] **Step 6: Commit** `feat: add automation workflow contract`.

### Task 2: Build the visual editor UI

**Files:**
- Create: `src/growdash/AutomationsPage.tsx`
- Create: `src/growdash/automations/WorkflowCanvas.tsx`
- Create: `src/growdash/automations/NodePalette.tsx`
- Create: `src/growdash/automations/NodeInspector.tsx`
- Create: `src/growdash/automations/WorkflowEditor.test.tsx`
- Modify: `src/App.tsx: lazy route imports and /automacoes route`
- Modify: `src/growdash/GrowdashLayout.tsx: route preloader`

**Interfaces:**
- `WorkflowCanvas` consumes `WorkflowDefinition` and emits `onChange(nextDefinition)`.
- `NodePalette` emits `onAdd(type)`.
- `NodeInspector` consumes a selected node and emits `onUpdate(parameters)`.

- [ ] **Step 1: Write component tests** for adding a Webhook node, editing an HTTP URL, connecting nodes, and rejecting a cycle.
- [ ] **Step 2: Run** the focused test and confirm it fails before implementation.
- [ ] **Step 3: Implement** a keyboard-accessible canvas using existing UI primitives and SVG/CSS connections; do not add a new graph dependency unless the current dependency audit proves it necessary.
- [ ] **Step 4: Implement** inspectors for method, URL, headers/body, credential reference, sheet ID/tab/range, and webhook path/method.
- [ ] **Step 5: Add tabs for `Editor`, `Execuções`, and existing Instagram automations; preserve the existing list/create controls in a compatibility panel.
- [ ] **Step 6: Run** focused UI tests and `npm run lint`.
- [ ] **Step 7: Commit** `feat: add Growdash automation workflow editor`.

### Task 3: Persist and load workflows securely

**Files:**
- Create: `src/growdash/automations/useAutomationWorkflows.ts`
- Modify: `src/growdash/AutomationsPage.tsx`
- Modify: `src/growdash/automations/workflowTypes.ts`

**Interfaces:**
- `useAutomationWorkflows(workspaceId)` exposes `list`, `save`, `activate`, `pause`, and `remove` mutations.
- Save writes `workflow_definition`, `workflow_version`, `status`, `name`, and `description` to the existing table.

- [ ] **Step 1: Write tests** for workspace filtering, draft save, activation after validation, and secret redaction from serialized workflow JSON.
- [ ] **Step 2: Run focused tests and confirm failure.**
- [ ] **Step 3: Implement Supabase queries** using the existing `useWorkspace`, `useAuth`, `useToast`, and React Query patterns.
- [ ] **Step 4: Prevent activation** when `validateWorkflowDefinition` returns errors; display errors next to the affected node.
- [ ] **Step 5: Run focused tests, `npm run lint`, and `npm run build`.
- [ ] **Step 6: Commit** `feat: persist automation workflows`.

### Task 4: Implement the declarative execution engine

**Files:**
- Create: `supabase/functions/automation-workflow-run/index.ts`
- Create: `supabase/functions/automation-workflow-run/validation.ts`
- Create: `supabase/functions/automation-workflow-run/validation.test.ts`
- Modify: `supabase/migrations/20261020120000_growdash_workflow_definition.sql`

**Interfaces:**
- POST body: `{ workflow_id: string; dry_run?: boolean; trigger_event?: Record<string, unknown> }`.
- Response: `{ ok: boolean; status: "success" | "error"; execution_id: string; node_runs: NodeRun[]; error?: string }`.
- Node adapters receive `{ node, input, credentials, triggerEvent }` and return `{ output }` or a sanitized error.

- [ ] **Step 1: Write tests** for topological order, HTTP timeout/error handling, dry-run validation, and secret redaction.
- [ ] **Step 2: Run tests and confirm failure.**
- [ ] **Step 3: Implement** workspace authorization, active/dry-run checks, cycle-safe traversal, and execution record insertion.
- [ ] **Step 4: Implement `webhook.trigger` pass-through and `http.request` with HTTPS/HTTP validation, timeout, method, headers, query, JSON body, and sanitized response metadata.
- [ ] **Step 5: Implement `google.sheets.append` by reusing the existing Google token helper; if the integration is unavailable, return a typed node error rather than silently succeeding.
- [ ] **Step 6: Update `growdash_automations` run counters and `growdash_automation_runs` with per-node status while never storing authorization headers or token values.
- [ ] **Step 7: Run edge-function tests and `npm run build`.
- [ ] **Step 8: Commit** `feat: execute automation workflows`.

### Task 5: Add execution history to the page

**Files:**
- Create: `src/growdash/automations/ExecutionHistory.tsx`
- Modify: `src/growdash/AutomationsPage.tsx`
- Create: `src/growdash/automations/ExecutionHistory.test.tsx`

**Interfaces:**
- `ExecutionHistory` consumes `automationId` and returns a list of sanitized `ExecutionRecord` rows.

- [ ] **Step 1: Write tests** for success, partial/error status, duration, node error display, empty state, and workspace scoping.
- [ ] **Step 2: Implement query and detail drawer** using existing cards, badges, dialog and table components.
- [ ] **Step 3: Add `Executar teste` calling the Edge Function with `dry_run: true`, then refresh history only after a real execution.
- [ ] **Step 4: Run focused UI tests and `npm run lint`.
- [ ] **Step 5: Commit** `feat: show automation execution history`.

### Task 6: Verify the integrated Growdash flow

**Files:**
- Modify only if necessary: files from Tasks 1–5.
- Test: existing `tests/visual/growdash.spec.ts` or the applicable visual suite.

- [ ] **Step 1: Run** `npm test` and record any pre-existing failures separately from new failures.
- [ ] **Step 2: Run** `npm run lint` and `npm run build`.
- [ ] **Step 3: Run** the local Supabase migration/checks for the new schema.
- [ ] **Step 4: Start the app and verify the authenticated `/automacoes` route: create, connect, save, dry-run, execute controlled HTTP, and inspect history.
- [ ] **Step 5: Confirm existing Instagram automation create/activate/list behavior still works.
- [ ] **Step 6: Review `git diff` and `git status`; do not stage or discard the user’s unrelated existing changes.
- [ ] **Step 7: Commit only the automation implementation files with** `feat: add Growdash visual automations MVP`.
