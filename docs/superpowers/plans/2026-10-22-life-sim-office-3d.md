# Growdash Life Sim Escritório 3D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evoluir o escritório 3D existente para uma visualização low-poly, somente leitura, baseada nos agentes e eventos reais do workspace.

**Architecture:** `AgentsOfficePage` continuará controlando a entrada e retorno ao hub. `LifeSimPage` será um canvas Three.js orientado por props de dados reais, enquanto React Query buscará `agent_office_agents` e `agent_office_events` com isolamento por workspace. O estado visual será derivado de `runtime_status`; nenhum controle local executará ou alterará agentes.

**Tech Stack:** React 18, TypeScript, Three.js, React Query, Supabase, Vitest, Playwright, CSS existente da Growdash.

**Spec:** `docs/superpowers/specs/2026-10-21-life-sim-office-3d-design.md`

## Global Constraints

- Usar somente dados reais de `agent_office_agents` e `agent_office_events` filtrados pelo workspace ativo.
- Não alterar métricas, integrações, rotas ou dados de negócio existentes.
- Não adicionar React Three Fiber/drei; reaproveitar Three.js já instalado.
- Remover comandos locais fictícios de status, construção e mobília da experiência pública.
- Não criar NPC quando não houver agente persistido visível.
- Pausar a animação quando a aba estiver em background e respeitar `prefers-reduced-motion`.
- Validar build, typecheck, testes e comportamento em desktop/mobile antes de declarar concluído.

## Mapa de arquivos

- Modificar `src/growdash/AgentsOfficePage.tsx`: carregar os agentes/eventos do workspace e passar os dados para o escritório; preservar o botão e o retorno ao cérebro.
- Modificar `src/growdash/LifeSimPage.tsx`: receber props reais, renderizar salas/NPCs determinísticos e remover estados/controles locais fictícios.
- Modificar `src/index.css`: layout do canvas, HUD, estados e bottom sheet mobile sem overflow.
- Criar `src/lib/lifeSim.ts`: tipos, mapeamento de status, layout determinístico de salas e helpers testáveis.
- Criar `src/lib/lifeSim.test.ts`: cobertura dos contratos de status, layout e eventos.
- Modificar `tests/visual/growdash.spec.ts` ou criar teste visual específico da rota somente se o fixture autenticado existente permitir acessar `/agentes`.

### Task 1: Criar contrato determinístico do escritório

**Files:**
- Create: `src/lib/lifeSim.ts`
- Test: `src/lib/lifeSim.test.ts`

**Interfaces:**
- `type LifeSimRuntimeStatus = "working" | "analyzing" | "waiting_approval" | "paused" | "blocked" | "error" | "idle"`
- `type LifeSimAgent = { id: string; role: string; name: string; department: string | null; runtime_status: string | null; status: string | null; last_run_at: string | null; next_run_at: string | null }`
- `type LifeSimEvent = { id: string; agent_id: string | null; event_type: string; severity: "info" | "warning" | "critical"; title: string; body: string; created_at: string }`
- `normalizeRuntimeStatus(status: string | null | undefined): LifeSimRuntimeStatus`
- `buildRoomLayout(agents: LifeSimAgent[]): Array<{ role: string; label: string; color: string; agents: LifeSimAgent[]; x: number; y: number }>`
- `statusPresentation(status: LifeSimRuntimeStatus): { label: string; tone: "success" | "warning" | "danger" | "muted"; moving: boolean }`
- `eventsForAgent(events: LifeSimEvent[], agentId: string, limit?: number): LifeSimEvent[]`

- [ ] Escrever testes para todos os status permitidos e fallback `idle`.
- [ ] Escrever testes garantindo que layouts sejam estáveis para a mesma lista e que agentes desconhecidos não criem sala nova.
- [ ] Escrever teste de limite e ordenação dos eventos.
- [ ] Rodar `npx vitest run src/lib/lifeSim.test.ts` e confirmar falhas antes da implementação.
- [ ] Implementar helpers sem acesso a DOM, Supabase ou localStorage.
- [ ] Rodar o teste novamente e confirmar aprovação.
- [ ] Commitar com `git add src/lib/lifeSim.ts src/lib/lifeSim.test.ts && git commit -m "feat: define contrato do escritorio life sim"`.

### Task 2: Conectar agentes e eventos reais ao hub

**Files:**
- Modify: `src/growdash/AgentsOfficePage.tsx` na área do componente `AgentsOfficePage` e da abertura do `LifeSimPage`.

**Interfaces:**
- A query de agentes produzirá `LifeSimAgent[]` a partir de `agent_office_agents`.
- A query de eventos produzirá `LifeSimEvent[]` a partir de `agent_office_events`.
- `LifeSimPage` receberá `{ agents, events, loading, error, onBackToBrain }`.

- [ ] Adicionar queries React Query com `queryKey` incluindo `workspace?.id` e `enabled: view === "office" && !!workspace?.id`.
- [ ] Selecionar somente os campos definidos no contrato e filtrar `.eq("workspace_id", workspace.id).eq("is_visible", true)`.
- [ ] Consultar eventos pelo workspace, ordenar por `created_at` descendente e limitar a 50; não fazer uma query por sala.
- [ ] Mapear erro para estado de interface sem lançar exceção nem inventar agentes.
- [ ] Remover a dependência de `INITIAL_LIFE_STATES` e não passar `statuses`/`assignments` para o escritório 3D.
- [ ] Manter a abertura pelo botão “Entrar no escritório 3D” e adicionar callback de retorno à visão do cérebro.
- [ ] Rodar `npx tsc --noEmit`.
- [ ] Commitar com `git add src/growdash/AgentsOfficePage.tsx && git commit -m "feat: conecta life sim ao estado real dos agentes"`.

### Task 3: Reestruturar a cena Three.js para salas e NPCs reais

**Files:**
- Modify: `src/growdash/LifeSimPage.tsx`

**Interfaces:**
- Props: `agents: LifeSimAgent[]`, `events: LifeSimEvent[]`, `loading: boolean`, `error: string | null`, `onBackToBrain: () => void`.
- O renderizador Three.js receberá somente uma lista normalizada de agentes e nunca escreverá em Supabase/localStorage.

- [ ] Remover `LifeMode`, `WallBlueprint`, `FurnitureBlueprint`, `npcStatuses`, `history`, `localStorage`, ferramentas de construção e catálogo.
- [ ] Criar dez salas a partir do layout canônico de `lifeSim.ts`, com paredes, portas e mobiliário visual estático.
- [ ] Criar NPCs somente para `agents` reais; posicionar múltiplos agentes da mesma sala com offsets derivados do id.
- [ ] Atualizar anel, label, posição e animação exclusivamente a partir de `normalizeRuntimeStatus` e `statusPresentation`.
- [ ] Implementar seleção de sala/NPC via raycast e estado React; atualizar o HUD HTML com dados reais.
- [ ] Adicionar botão “Vista geral”, botão “Visão do cérebro” e lista de salas acessível por teclado.
- [ ] Pausar o loop de render quando `document.hidden` ou `prefers-reduced-motion` estiver ativo, retomando apenas quando necessário.
- [ ] Exibir skeleton/loading, erro recuperável, estado vazio e fallback WebGL.
- [ ] Rodar `npm run build` e `npx tsc --noEmit`.
- [ ] Commitar com `git add src/growdash/LifeSimPage.tsx && git commit -m "feat: renderiza salas e npcs do life sim"`.

### Task 4: Ajustar HUD, estados e responsividade

**Files:**
- Modify: `src/index.css`
- Modify: `src/growdash/LifeSimPage.tsx` se necessário para classes/atributos acessíveis.

- [ ] Criar estilos para canvas e HUD desktop sem alterar a sidebar.
- [ ] Criar bottom sheet em `<768px`, com altura limitada, rolagem interna e sem `overflow-x` no body.
- [ ] Garantir foco visível, `aria-label`, contraste textual e indicador textual além das cores.
- [ ] Ajustar estados `loading`, `empty`, `error`, `no-agent` e `webgl-unavailable`.
- [ ] Remover regras CSS órfãs relacionadas apenas a construção/mobília do Life Sim.
- [ ] Validar manualmente 375px, 768px e 1440px no modo claro e escuro.
- [ ] Rodar `npm run lint`.
- [ ] Commitar com `git add src/index.css src/growdash/LifeSimPage.tsx && git commit -m "style: ajusta hud responsivo do life sim"`.

### Task 5: Testes e regressão

**Files:**
- Modify/Create: `tests/visual/growdash.spec.ts` conforme o fixture disponível.

- [ ] Adicionar teste unitário para query key/normalização se houver regra reutilizável fora do componente.
- [ ] Adicionar teste visual autenticado da entrada `/agentes`, abertura do escritório e seleção de sala, se o setup de autenticação já suportar essa rota.
- [ ] Rodar `npm run test`.
- [ ] Rodar `npm run lint`.
- [ ] Rodar `npm run build`.
- [ ] Rodar `npx tsc --noEmit`.
- [ ] Registrar como pendente qualquer teste bloqueado por ausência de sessão/credencial, sem simular aprovação.
- [ ] Fazer `git diff --check` e `git status --short` para garantir que apenas arquivos do escopo foram alterados além das mudanças pré-existentes.

### Task 6: Verificação de produção e entrega

- [ ] Consultar `origin/main` e confirmar o commit local de implementação.
- [ ] Publicar somente após build/testes verdes e respeitando o fluxo de deploy existente.
- [ ] Conferir deployment ativo, hash/commit e assets servidos.
- [ ] Abrir `/agentes` autenticado e verificar botão, cena, HUD e retorno ao cérebro.
- [ ] Entregar changelog, commits, arquivos alterados, testes executados e limitações verificadas.
