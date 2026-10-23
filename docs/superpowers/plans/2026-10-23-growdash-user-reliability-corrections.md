# Growdash User Reliability Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Execute this plan inline in the current session with TDD and verification checkpoints. No subagents are allowed by the repository instructions.

**Goal:** Eliminate the confirmed user-facing metric inconsistency, RD timeout ambiguity, theme-induced data loss, and unscoped Data Health results while improving loading feedback and regression coverage.

**Architecture:** Introduce small, pure contracts for metric availability and scoped Data Health inputs. Keep provider reconciliation independent from visible snapshots: a timeout becomes a stale/partial state with a retry path, never a numeric zero. Reuse the existing React Query and global-filter boundaries instead of introducing a new backend contract.

**Tech Stack:** React 18, TypeScript, TanStack Query, Supabase client, Vitest, Playwright, Vite.

**Spec:** `docs/PROJECT_USER_AUDIT_2026-10-23.md`

## Global Constraints

- Preserve the independent scroll behavior of the left sidebar.
- Do not alter migrations, database schema, OAuth credentials, or external integrations.
- Never render unavailable/loading/stale data as zero.
- Use TDD: write a failing test, run it, implement the smallest fix, run the test again.
- Keep existing local changes and unrelated behavior intact.
- Report anything requiring external credentials or deployment access as unverified.

---

### Task 1: Add the metric availability contract

**Files:**
- Create: `src/lib/metricAvailability.ts`
- Test: `src/lib/metricAvailability.test.ts`
- Modify: `src/pages/Index.tsx`
- Modify: `src/components/dashboard/widgets/FinancialOverviewWidgets.tsx`

**Interfaces:**
- Produces `MetricAvailability`, `MetricAvailabilityState`, `displayMetricValue(value, availability, formatter)`.
- Consumed by Dashboard KPI and payment widgets.

- [ ] Step 1: Write failing tests for loading/unavailable/stale values not becoming zero.
- [ ] Step 2: Run `npm test -- src/lib/metricAvailability.test.ts` and confirm RED.
- [ ] Step 3: Implement the pure contract and apply it to dashboard KPI rendering.
- [ ] Step 4: Run the focused test and existing metric tests; confirm GREEN.
- [ ] Step 5: Add a regression test for Dashboard/PaymentChartWidget availability propagation if a pure seam exists; otherwise document the seam in the test.

### Task 2: Preserve snapshots and distinguish RD timeout state

**Files:**
- Test: `src/lib/syncStatus.test.ts`
- Modify: `src/hooks/useNearRealtimeSync.ts`
- Modify: `src/lib/resilience.ts`
- Modify: the existing component that renders the RD sync banner (locate before editing)
- Test: the corresponding component contract test.

**Interfaces:**
- Keep `syncError` for primary KPI failures.
- Add/retain a distinct `rdSyncError`/stale state for provider-specific reconciliation.
- The visible message must include the preserved snapshot state and a retry action.

- [ ] Step 1: Add failing tests for timeout classification and stale snapshot preservation.
- [ ] Step 2: Run the focused tests and confirm RED.
- [ ] Step 3: Implement provider-specific timeout classification without converting values to zero or clearing cached query data.
- [ ] Step 4: Add/adjust the banner copy and retry action.
- [ ] Step 5: Run focused sync tests and the CRM/Painel contracts.

### Task 3: Scope Data Health correctly and remove the 10k cap

**Files:**
- Test: `src/lib/queryScope.test.ts` or a new `src/lib/dataHealthScope.test.ts`
- Modify: `src/pages/DataHealth.tsx`
- Modify/create: a small pure pagination helper if needed.

**Interfaces:**
- `useHealth({ workspaceId, adAccountIds, startDate, endDate })`.
- Query keys must include the effective scope.
- Operational audit must paginate until a short page and preserve account/period filters.

- [ ] Step 1: Write failing tests for scope-key construction and pagination.
- [ ] Step 2: Run focused tests and confirm RED.
- [ ] Step 3: Implement scope-aware queries and pagination without changing the database.
- [ ] Step 4: Run focused tests and verify all user-facing labels match the actual scope.

### Task 4: Improve Campaigns loading semantics

**Files:**
- Test: `src/lib/campaignLoadingState.test.ts`
- Modify: `src/pages/Campaigns.tsx`

**Interfaces:**
- Loading state distinguishes `loading`, `empty`, `ready`, `error`.
- Existing snapshot remains visible while a refresh is pending.

- [ ] Step 1: Write failing tests for loading not being presented as zero/empty.
- [ ] Step 2: Run focused test and confirm RED.
- [ ] Step 3: Implement the smallest state/copy change using existing query state.
- [ ] Step 4: Run focused tests and the Campaigns contract tests.

### Task 5: Improve route-level performance without hiding warnings

**Files:**
- Inspect: Vite config and route imports before editing.
- Modify only route/import files where a measurable heavy dependency is eagerly loaded.
- Test: existing route/build checks.

- [ ] Step 1: Identify the >500 KB chunks and owning modules from the build manifest.
- [ ] Step 2: If an eager import is found, add a failing smoke/contract test for lazy loading.
- [ ] Step 3: Convert only that import to route-level dynamic import.
- [ ] Step 4: Rebuild and compare chunk sizes; do not raise the warning threshold to hide it.
- [ ] Step 5: If no safe isolated split is available, record the limitation instead of making speculative refactors.

### Task 6: Verification and handoff

- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run `npm run test:visual` and report authenticated skips/timeouts separately.
- [ ] Run `git diff --check`.
- [ ] Inspect the final diff for unrelated changes.
- [ ] Update the audit report with implemented versus pending items.
- [ ] Commit only the scoped corrections.

