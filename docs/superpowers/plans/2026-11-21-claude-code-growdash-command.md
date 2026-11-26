# Claude Sonnet 5 Code `/growdash` Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Claude Sonnet 5 Code slash command `/growdash` that selects one of the 19 departments, resolves the smallest relevant agent/skill team, and routes work through explicit review gates.

**Architecture:** Implement a project-local command in `.claude/commands/growdash.md`. The command consumes department and task arguments, loads the approved architecture spec as its source of truth, verifies that referenced agents/skills are actually available, and asks for a user choice when the department is ambiguous or a sensitive action is requested. It does not invoke all agents or plugins indiscriminately.

**Tech Stack:** Claude Sonnet 5 Code project command Markdown, shell-free frontmatter argument contract, local validation script using Node.js.

**Spec:** `docs/superpowers/specs/2026-11-21-arquitetura-grupo-agentes-growdash-design.md`

## Global Constraints

- The command only instructs Claude Sonnet 5 Code; it does not implement API-based agent orchestration.
- Never execute commit, push, PR creation, deployment, migration, external message, campaign change, DNS or secret operation without explicit user approval.
- Do not claim that a plugin is authenticated merely because it is installed.
- If a named department, agent, skill or connector is unavailable in the current session, report that and route only with verified resources.
- Do not install dependencies or modify global `~/.claude` configuration.
- Keep the project-specific command as one focused Markdown file and a small test for its static contract.

---

### Task 1: Define and test command metadata and argument parsing contract

**Files:**
- Create: `.claude/commands/growdash.md`
- Create: `scripts/growdash-command.test.mjs`
- Modify: `package.json` to add `test:growdash-command`

**Interfaces:**
- Command syntax: `/growdash <department-or-alias> <task>`; `/growdash listar`; `/growdash ceo <task>`.
- Command frontmatter: `description`, `argument-hint`, `allowed-tools` restricted to read/search tools; no write/deploy permissions are granted by command metadata.
- The static Vitest contract directly checks required sections, 19 IDs, approval gates, and safe command examples.

- [ ] **Step 1: Write failing static contract tests**

```javascript
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

const command = await readFile(new URL("../.claude/commands/growdash.md", import.meta.url), "utf8");

describe("/growdash command contract", () => {
  it("declares the command and three supported forms", () => {
    expect(command).toContain("/growdash <departamento> <tarefa>");
    expect(command).toContain("/growdash listar");
    expect(command).toContain("/growdash ceo <tarefa>");
  });

  it("lists all 19 stable department ids", () => {
    const ids = ["engineering", "frontend", "security", "dataviz", "motion", "video", "growth", "integrations", "creative", "games3d", "devops", "apple", "ai-integrations", "memory", "ponytail", "wix", "supabase", "superpowers", "ecc"];
    for (const id of ids) expect(command).toContain(`\`${id}\``);
  });

  it("states the approval gate for external and destructive actions", () => {
    expect(command).toMatch(/commit.*push.*deploy.*migration/s);
    expect(command).toMatch(/aprova[cç][aã]o expl[ií]cita/i);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npm test -- scripts/growdash-command.test.mjs`

Expected: FAIL because command and test files do not yet exist.

- [ ] **Step 3: Add minimal test script wiring**

Add to `package.json`:

```json
"test:growdash-command": "vitest run scripts/growdash-command.test.mjs"
```

- [ ] **Step 4: Run the focused test and confirm it fails for the expected reason**

Run: `npm run test:growdash-command`

Expected: FAIL because `.claude/commands/growdash.md` does not exist.

---

### Task 2: Write the `/growdash` command instructions

**Files:**
- Create: `.claude/commands/growdash.md`
- Modify: `scripts/growdash-command.test.mjs` only if the test needs a stable section assertion.

**Interfaces:**
- Consumes user arguments from Claude Code command context.
- Produces a team-routing proposal and then executes permitted work following session permissions and `AGENTS.md`.

- [ ] **Step 1: Implement command frontmatter and source of truth**

Use this frontmatter:

```yaml
---
description: Route a Growdash task to the selected department and relevant specialists
argument-hint: "<department-or-alias> <task> | listar | ceo <task>"
allowed-tools:
  - Read
  - Glob
  - Grep
---
```

Start the command body by reading `AGENTS.md` and `docs/superpowers/specs/2026-11-21-arquitetura-grupo-agentes-growdash-design.md`. State that the spec is authoritative for the 19 departments and that current runtime/tool availability must be checked before naming specialists.

- [ ] **Step 2: Specify command argument behavior**

Document these cases explicitly:

- `/growdash listar`: display all departments in spec order, with ID and director.
- `/growdash ceo <task>`: CEO/`agency-orchestrator` classifies the task, selects primary department(s), and presents the team before executing if classification is ambiguous.
- `/growdash <id-or-alias> <task>`: use that department as the primary route and add only cross-functional experts required by task dependencies.
- Missing task: ask for it; do not execute a blank task.
- Unknown department: show close matching IDs and ask the user to choose; do not guess.
- Empty department: classify and propose the department/team before executing.

- [ ] **Step 3: Specify specialist selection and execution protocol**

For each task, determine expected deliverable, affected files/resources, risk category (`read`, `local`, `external`, `destructive`), dependencies, and validation needs. Select the minimum relevant agent(s)/skill(s), not every listed member. Run independent read-only investigations in parallel only when tools are available and do not conflict on files. For code tasks, follow `AGENTS.md` local → GitHub/remoto → Cloudflare → browser sequence and state why any gate does not apply.

- [ ] **Step 4: Specify mandatory approval gates**

Before commit, push, PR, deploy, migration, database/RLS writes, external messages, campaign publication/budget changes, DNS/secret/permission changes or destructive operations:

1. Show team, planned action, impacted files/resources, evidence, risks, and tests.
2. Stop and ask the user for explicit approval.
3. Continue only after approval for that exact action.

Never use installed plugins/connectors without verifying MCP availability/authentication first. Never report a result from an unavailable connector as verified.

- [ ] **Step 5: Run command contract tests**

Run: `npm run test:growdash-command`

Expected: PASS all tests, with all 19 IDs and approval wording found.

- [ ] **Step 6: Commit only the command and its test wiring**

```bash
git add .claude/commands/growdash.md scripts/growdash-command.test.mjs package.json
git commit -m "feat(Claude Sonnet 5): add Growdash department routing command\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Verify slash-command discovery and usage

**Files:**
- Verify: `.claude/commands/growdash.md`
- Verify: `package.json` script `test:growdash-command`
- No source changes unless Claude Sonnet 5 Code does not discover the command.

- [ ] **Step 1: Run the static contract test**

Run: `npm run test:growdash-command`

Expected: PASS.

- [ ] **Step 2: Validate command discovery in Claude Sonnet 5 Code**

Reload/reopen Claude Sonnet 5 Code for this project if required by command discovery. Invoke `/growdash listar` and confirm it shows 19 departments without starting work. Then invoke `/growdash frontend teste somente de roteamento` and confirm it identifies a primary director and only relevant specialists before doing anything.

- [ ] **Step 3: Verify the approval boundary**

Invoke `/growdash devops fazer deploy` as a dry-run prompt and confirm the command presents an approval gate and does not deploy, push, commit, or mutate infrastructure before approval.

- [ ] **Step 4: Report exact verification**

Report command discovery, output for `listar`, team selection for a sample task, approval gate behavior, and any tool/auth limitations. Do not claim that external connectors were exercised if not authenticated.

## Execution Handoff

This plan is complete and saved at `docs/superpowers/plans/2026-11-21-claude-code-growdash-command.md`. Execute it only after the user chooses subagent-driven or inline execution.
