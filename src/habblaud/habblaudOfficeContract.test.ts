// Contrato do escritorio do Habblaud dentro da Growdash.
//
// O teste cobre o que a aba Agentes precisa garantias:
// - os dados reais do Supabase viram um snapshot que o mundo consome;
// - a hierarquia e a que o usuario pediu: CEO -> diretores -> orquestrador
//   por sala (conta de anuncio) -> 20 agentes de execucao;
// - ninguem aparece "trabalhando" sem execucao por tras;
// - a rota `/agentes` monta o escritorio (e nao o antigo escritorio 3D).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  AGENTS_PER_ROOM,
  buildOfficeSnapshot,
  directorRoleFor,
  type GrowdashOfficeData,
} from "./bridge/officeSnapshot";

const appSource = readFileSync(
  fileURLToPath(new URL("../App.tsx", import.meta.url)),
  "utf8",
);
const modulePageSource = readFileSync(
  fileURLToPath(new URL("../growdash/ModulePage.tsx", import.meta.url)),
  "utf8",
);
const panelSource = readFileSync(
  fileURLToPath(new URL("../growdash/HabblaudOfficePanel.tsx", import.meta.url)),
  "utf8",
);
const officeSource = readFileSync(
  fileURLToPath(new URL("./HabblaudOffice.tsx", import.meta.url)),
  "utf8",
);
const officeCss = readFileSync(
  fileURLToPath(new URL("./office.css", import.meta.url)),
  "utf8",
);

/** Um conjunto de dados minimo, com a forma que o Supabase devolve. */
function sampleData(): GrowdashOfficeData {
  return {
    agents: [
      {
        id: "ceo-1",
        role: "ceo",
        name: "CEO · Chief of Staff",
        parent_agent_id: null,
        runtime_status: "analyzing",
        status: "active",
        last_run_at: "2026-11-25T01:00:00.000Z",
        is_visible: true,
      },
      {
        id: "dir-1",
        role: "marketing",
        name: "Gestor de Marketing",
        parent_agent_id: "ceo-1",
        runtime_status: "analyzing",
        status: "active",
        last_run_at: "2026-11-25T01:00:00.000Z",
        is_visible: true,
      },
    ],
    accounts: [
      {
        id: "acc-1",
        name: "CA01 - DRA RANNIELY SILVA [GRUPO ZNTT]",
        connection_status: "connected",
        last_sync_success_at: "2026-11-25T00:45:00.000Z",
        last_sync_error: null,
      },
      {
        id: "acc-2",
        name: "CA - MÉTODO VAV",
        connection_status: "disconnected",
        last_sync_success_at: "2026-10-16T13:05:00.000Z",
        last_sync_error: null,
      },
    ],
    tasks: [
      {
        id: "task-1",
        agent_id: "dir-1",
        task_type: "investigate_meta",
        status: "detected",
        priority: "high",
        scope: { account_id: "acc-1" },
        payload: { description: "Conta Meta está unknown." },
        created_at: "2026-10-28T19:15:00.000Z",
        updated_at: "2026-10-28T19:15:10.000Z",
      },
    ],
    runs: [
      {
        id: "run-1",
        status: "success",
        summary: "Verificações determinísticas concluídas.",
        started_at: "2026-11-25T01:00:00.000Z",
        finished_at: "2026-11-25T01:00:01.000Z",
      },
    ],
    events: [
      {
        id: "evt-1",
        agent_id: "dir-1",
        event_type: "finding",
        severity: "warning",
        title: "Atenção: meta",
        body: "Conta Meta CA01 está unknown.",
        created_at: "2026-10-28T20:45:56.000Z",
      },
    ],
  };
}

describe("Escritório do Habblaud na aba Agentes", () => {
  it("cada conta de anuncio e uma sala do escritorio", () => {
    const snapshot = buildOfficeSnapshot(sampleData());
    const roomNames = snapshot.rooms.map((room) => room.name);
    expect(roomNames).toContain("CA01 - DRA RANNIELY SILVA [GRUPO ZNTT]");
    expect(roomNames).toContain("CA - MÉTODO VAV");
    // O nucleo (CEO e diretores) e a primeira sala.
    expect(snapshot.rooms[0].name).toBe("Núcleo");
  });

  it("cada sala tem um orquestrador e os agentes de execucao", () => {
    const snapshot = buildOfficeSnapshot(sampleData());
    const room = snapshot.rooms.find((item) => item.name.includes("RANNIELY"));
    expect(room).toBeDefined();

    const inRoom = snapshot.agents.filter((agent) => agent.roomId === room!.id);
    const orchestrator = inRoom.find((agent) => agent.role === "Orquestrador");
    expect(orchestrator).toBeDefined();

    const workers = inRoom.filter((agent) => agent.id !== orchestrator!.id);
    expect(workers.length).toBeGreaterThanOrEqual(AGENTS_PER_ROOM);
    // Todo agente de execucao e subordinado ao orquestrador.
    for (const worker of workers) {
      expect(worker.parentId).toBe(orchestrator!.id);
    }
  });

  it("o orquestrador responde ao diretor, e o diretor ao CEO", () => {
    const snapshot = buildOfficeSnapshot(sampleData());
    const ceo = snapshot.agents.find((agent) => agent.role === "ceo");
    const director = snapshot.agents.find((agent) => agent.role === "marketing");
    expect(ceo).toBeDefined();
    expect(director).toBeDefined();
    expect(director!.parentId).toBe(ceo!.id);

    const room = snapshot.rooms.find((item) => item.name.includes("RANNIELY"));
    const orchestrator = snapshot.agents.find((agent) => agent.roomId === room!.id && agent.role === "Orquestrador");
    expect(orchestrator!.parentId).toBe(director!.id);
  });

  it("o diretor de uma sala depende da especialidade do nome da conta", () => {
    expect(directorRoleFor("CA - MÉTODO VAV")).toBe("marketing");
    expect(directorRoleFor("Conta do juridico")).toBe("legal");
    expect(directorRoleFor("CA01 - DRA RANNIELY SILVA")).toBe("marketing");
  });

  it("ninguem aparece trabalhando sem execucao por tras", () => {
    const snapshot = buildOfficeSnapshot(sampleData());
    for (const agent of snapshot.agents) {
      if (agent.status !== "working") continue;
      // Quem trabalha tem atividade real (uma task ou um ciclo registrado).
      expect(agent.activity).toBeDefined();
      expect(agent.activity!.at).toBeGreaterThan(0);
    }
  });

  it("um achado pendente nao vira agente trabalhando", () => {
    // A task de exemplo esta com status `detected`: e uma pendencia (alguem
    // precisa olhar), nao uma execucao em andamento. Ninguem da sala pode
    // aparecer trabalhando por causa dela.
    const snapshot = buildOfficeSnapshot(sampleData());
    const room = snapshot.rooms.find((item) => item.name.includes("RANNIELY"));
    const inRoom = snapshot.agents.filter((agent) => agent.roomId === room!.id);
    expect(inRoom.some((agent) => agent.status === "working")).toBe(false);
    // Mas a pendencia fica visivel na fila do orquestrador.
    const orchestrator = inRoom.find((agent) => agent.role === "Orquestrador");
    expect(orchestrator!.tasks.length).toBeGreaterThan(0);
  });

  it("uma task em execucao vira agente trabalhando", () => {
    const data = sampleData();
    data.tasks[0] = { ...data.tasks[0], status: "in_progress" };
    const snapshot = buildOfficeSnapshot(data);
    const room = snapshot.rooms.find((item) => item.name.includes("RANNIELY"));
    const inRoom = snapshot.agents.filter((agent) => agent.roomId === room!.id);
    expect(inRoom.some((agent) => agent.status === "working")).toBe(true);

    // A outra conta, sem execucao, fica toda ociosa.
    const otherRoom = snapshot.rooms.find((item) => item.name.includes("MÉTODO VAV"));
    const otherAgents = snapshot.agents.filter((agent) => agent.roomId === otherRoom!.id);
    expect(otherAgents.every((agent) => agent.status !== "working")).toBe(true);
  });

  it("a rota /agentes monta o escritorio do Habblaud", () => {
    expect(appSource).toContain('import("@/growdash/HabblaudOfficePanel")');
    expect(modulePageSource).toContain("<HabblaudOfficePanel />");
    // O escritorio antigo (Three.js) nao e mais o visual da aba.
    expect(appSource).not.toContain('import("@/growdash/AgentsOfficePage"), "agents"');
  });

  it("o painel mantem o Mapa da Inteligencia como segunda vista", () => {
    expect(panelSource).toContain("KnowledgeMap");
    expect(panelSource).toContain('role="tablist"');
    expect(panelSource).toContain("Escritório");
    expect(panelSource).toContain("Mapa");
  });

  it("o painel tem o botao de tela cheia", () => {
    // Nao e a Fullscreen API (ela exige permissao no navegador e falha com
    // "Permissions check failed"): e um overlay em `position: fixed`.
    expect(panelSource).toContain("Tela cheia");
    expect(panelSource).toContain("is-fullscreen");
    expect(panelSource).not.toContain("requestFullscreen");
    // O `Esc` fecha a tela cheia.
    expect(panelSource).toContain('event.key === "Escape"');
    // O CSS cobre o quadro inteiro quando ele vai para a tela cheia.
    expect(officeCss).toContain(".habblaud-office-frame.is-fullscreen");
  });

  it("o escritorio e alimentado pelos dados reais, sem simulador", () => {
    // O store e o da Growdash (publica snapshots do Supabase), nao o mock.
    expect(officeSource).toContain("LiveOfficeStore");
    expect(officeSource).toContain("buildOfficeSnapshot");
    expect(officeSource).not.toContain("mock: true");
  });

  it("o CSS de integracao contem o escritorio no shell da plataforma", () => {
    // O `transform` no host e o que torna os paineis `fixed` do Habblaud
    // ficarem dentro do escritorio, e nao sobre a navegacao da plataforma.
    expect(officeCss).toContain("transform: translateZ(0)");
    expect(officeCss).toContain(".habblaud-office-host #world");
    expect(officeCss).toContain(".habblaud-office-host #ui");
    // As queries responsivas medem o escritorio, nao a janela.
    expect(officeCss).toContain("container: office");
  });
});
