// O escritorio da Growdash: os dados reais do Supabase na lingua do Habblaud.
//
// O Habblaud original le os transcripts do Claude Opus 5 Code na maquina local
// (o servidor Node) e manda snapshots por SSE. Na Growdash nao ha esse
// servidor: os dados vem do Supabase, que e onde a plataforma ja registra o
// que os agentes fazem de verdade.
//
// Este modulo traduz o modelo da Growdash para o `OfficeSnapshot` do
// Habblaud:
//
//   CEO (agent_office_agents, role = 'ceo')
//    └── diretores (parent_agent_id = CEO)
//         └── salas (uma por conta de anuncio)
//              └── orquestrador + 20 agentes de execucao
//
// Nada aqui e inventado: cada agente refletido existe no banco ou e a
// projecao de uma execucao real (task, run ou finding). O que o banco nao
// registra (os 20 agentes de uma conta que ainda nao rodaram) aparece como
// "aguardando" — nunca como "trabalhando".
import type {
  Activity,
  AgentInfo,
  FeedItem,
  OfficeSnapshot,
  RoomInfo,
  TaskItem,
} from "../shared/types";

/** Quantos agentes de execucao cada sala (conta de anuncio) tem. */
export const AGENTS_PER_ROOM = 20;

/**
 * Janela em que um ciclo ainda conta como "agora" (o cron roda a cada 15 min;
 * a janela e o dobro, para cobrir o intervalo entre dois ciclos).
 */
export const RUN_FRESH_MS = 30 * 60 * 1000;

/** Os dados do Supabase que o escritorio precisa. */
export interface GrowdashOfficeData {
  /** Agentes do workspace (CEO, diretores e especialistas). */
  agents: Array<{
    id: string;
    role: string;
    name: string;
    parent_agent_id: string | null;
    runtime_status: string | null;
    status: string | null;
    last_run_at: string | null;
    is_visible: boolean;
  }>;
  /** Contas de anuncio: cada uma e uma sala. */
  accounts: Array<{
    id: string;
    name: string;
    connection_status: string | null;
    last_sync_success_at: string | null;
    last_sync_error: string | null;
  }>;
  /** Tarefas detectadas (o trabalho real em aberto). */
  tasks: Array<{
    id: string;
    agent_id: string | null;
    task_type: string;
    status: string;
    priority: string | null;
    scope: { account_id?: string | null } | null;
    payload: { description?: string } | null;
    created_at: string;
    updated_at: string;
  }>;
  /** Execucoes (cada uma e um ciclo do orquestrador). */
  runs: Array<{
    id: string;
    status: string;
    summary: string | null;
    started_at: string;
    finished_at: string | null;
  }>;
  /** Eventos (o que o escritorio anuncia). */
  events: Array<{
    id: string;
    agent_id: string | null;
    event_type: string;
    severity: string;
    title: string;
    body: string | null;
    created_at: string;
  }>;
}

/** O diretor que supervisiona cada sala, pela especialidade do nome da conta. */
const DIRECTOR_BY_SPECIALTY: Array<{ match: RegExp; role: string }> = [
  { match: /jur[ií]d|legal|advog/i, role: "legal" },
  { match: /finance|cfo|caixa|financeiro/i, role: "finance" },
  { match: /comercial|vendas|crm|commercial/i, role: "commercial" },
  { match: /pesquis|research/i, role: "research" },
  { match: /conte[uú]do|social|instagram/i, role: "social" },
  { match: /dado|anal|metric|bi/i, role: "analytics" },
];

/** O diretor de uma conta: o primeiro que casa com o nome, ou o de marketing. */
export function directorRoleFor(accountName: string): string {
  for (const entry of DIRECTOR_BY_SPECIALTY) {
    if (entry.match.test(accountName)) return entry.role;
  }
  return "marketing";
}

/** Semente estavel a partir de um texto: mesma conta, mesma decoração. */
function seedOf(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** A atividade de uma tarefa real do Growdash. */
function activityFor(task: GrowdashOfficeData["tasks"][number]): Activity {
  const description = task.payload?.description?.trim() || task.task_type.replace(/^investigate_/, "");
  return {
    id: task.id,
    kind: "plan",
    icon: task.status === "detected" ? "🔎" : "🛠️",
    text: description.slice(0, 46),
    detail: `${task.task_type} · ${task.priority ?? "medium"}`,
    at: new Date(task.updated_at).getTime(),
  };
}

/**
 * O snapshot do escritorio.
 *
 * As salas sao as contas de anuncio; cada uma tem um orquestrador e os
 * agentes de execucao que as tarefas reais justificam. Agentes sem trabalho em
 * aberto ficam ociosos — o escritorio nunca mostra alguem "trabalhando" sem
 * execucao por tras.
 */
export function buildOfficeSnapshot(data: GrowdashOfficeData, now = Date.now()): OfficeSnapshot {
  const visibleAgents = data.agents.filter((agent) => agent.is_visible);
  const ceo = visibleAgents.find((agent) => agent.role === "ceo") ?? visibleAgents[0] ?? null;
  const directors = visibleAgents.filter((agent) => agent.parent_agent_id && agent.id !== ceo?.id);
  const byId = new Map(data.agents.map((agent) => [agent.id, agent]));

  // As tarefas por conta (o `scope.account_id` e o vinculo com a sala).
  const tasksByAccount = new Map<string, GrowdashOfficeData["tasks"]>();
  for (const task of data.tasks) {
    const accountId = task.scope?.account_id;
    if (!accountId) continue;
    const list = tasksByAccount.get(accountId) ?? [];
    list.push(task);
    tasksByAccount.set(accountId, list);
  }

  const rooms: RoomInfo[] = [];
  const agents: AgentInfo[] = [];

  data.accounts.forEach((account, index) => {
    const roomId = `conta:${account.id}`;
    const directorRole = directorRoleFor(account.name);
    const director = directors.find((agent) => agent.role === directorRole) ?? ceo;

    rooms.push({
      id: roomId,
      name: account.name,
      path: `Contas de anúncio · ${account.name}`,
      slot: index + 1,
      seed: seedOf(account.id),
      createdAt: new Date(account.last_sync_success_at ?? now).getTime(),
    });

    const roomTasks = tasksByAccount.get(account.id) ?? [];
    const openTasks = roomTasks.filter((task) => task.status !== "done" && task.status !== "resolved");
    // Um achado `detected` e uma pendencia (alguem precisa olhar), nao uma
    // execucao em andamento. So conta como "trabalhando" o que esta de fato
    // rodando: uma tarefa em execucao ou um ciclo do orquestrador recente.
    const runningTasks = openTasks.filter((task) => task.status === "in_progress" || task.status === "running");

    // O orquestrador da sala: o agente principal, ligado ao diretor.
    const orchestratorId = `${roomId}:orquestrador`;
    const orchestratorTasks: TaskItem[] = openTasks.slice(0, 12).map((task) => ({
      id: task.id,
      title: task.payload?.description?.trim() || task.task_type,
      status: task.status === "in_progress" ? "in_progress" : task.status === "completed" ? "completed" : "pending",
    }));
    const orchestratorActivity: Activity | undefined = runningTasks[0] ? activityFor(runningTasks[0]) : undefined;
    agents.push({
      id: orchestratorId,
      kind: "main",
      parentId: director?.id ? `nucleo:${director.id}` : undefined,
      roomId,
      name: `Orquestrador · ${shortName(account.name)}`,
      look: "m",
      role: "Orquestrador",
      title: `Conta ${account.name}`,
      sessionId: orchestratorId,
      account: roomId,
      status: orchestratorActivity ? "working" : "idle",
      activity: orchestratorActivity,
      recent: orchestratorActivity ? [orchestratorActivity] : [],
      tasks: orchestratorTasks,
      startedAt: new Date(account.last_sync_success_at ?? now).getTime(),
      lastEventAt: orchestratorActivity?.at ?? now,
      statusSince: orchestratorActivity?.at ?? now,
      stats: { toolCalls: 0, tokensIn: 0, tokensOut: 0, subagents: AGENTS_PER_ROOM },
      seed: seedOf(`${account.id}:orquestrador`),
    });

    // Os agentes de execucao da sala: um por tarefa real em aberto. O que
    // sobra fica reservado (a fila do orquestrador), nunca "trabalhando".
    const workers = Math.max(AGENTS_PER_ROOM, runningTasks.length);
    for (let i = 0; i < workers; i += 1) {
      const task = runningTasks[i];
      const workerId = `${roomId}:agente:${i + 1}`;
      const activity = task ? activityFor(task) : undefined;
      agents.push({
        id: workerId,
        kind: "sub",
        parentId: orchestratorId,
        roomId,
        name: workerName(account.name, i + 1),
        look: i % 2 === 0 ? "f" : "m",
        role: task ? task.task_type.replace(/^investigate_/, "") : "Em espera",
        title: task ? task.payload?.description?.trim() : undefined,
        sessionId: workerId,
        account: roomId,
        status: activity ? "working" : "idle",
        activity,
        recent: activity ? [activity] : [],
        tasks: task ? [{ id: task.id, title: task.task_type, status: "in_progress" }] : [],
        startedAt: activity?.at ?? now,
        lastEventAt: activity?.at ?? now,
        statusSince: activity?.at ?? now,
        stats: { toolCalls: 0, tokensIn: 0, tokensOut: 0, subagents: 0 },
        seed: seedOf(`${account.id}:agente:${i}`),
      });
    }
  });

  // O CEO e os diretores: eles ficam no nucleo (a recepcao), acima das salas.
  const coreRoomId = "nucleo";
  rooms.unshift({
    id: coreRoomId,
    name: "Núcleo",
    path: "Núcleo da operação",
    slot: 0,
    seed: seedOf("nucleo"),
    createdAt: now,
  });
  for (const agent of [ceo, ...directors]) {
    if (!agent) continue;
    const agentId = `nucleo:${agent.id}`;
    const lastRun = data.runs.find((run) => run.status === "success" || run.status === "partial") ?? null;
    const ranAt = lastRun ? new Date(lastRun.finished_at ?? lastRun.started_at).getTime() : 0;
    // Um agente so esta "trabalhando" se o estado registrado no banco diz que
    // esta analisando e o ultimo ciclo foi recente (a janela do cron). Fora
    // dela, ele esta em espera — o `runtime_status` sozinho ficaria sempre
    // em "analyzing", porque o orchestrator o grava a cada ciclo.
    const recentlyRan = ranAt > 0 && now - ranAt < RUN_FRESH_MS;
    const isAnalyzing = agent.runtime_status === "analyzing" || agent.runtime_status === "working";
    const activity: Activity | undefined = lastRun
      ? {
          id: lastRun.id,
          kind: lastRun.status === "success" ? "done" : "other",
          icon: lastRun.status === "success" ? "✅" : "⚠️",
          text: (lastRun.summary ?? "Ciclo concluído").slice(0, 46),
          detail: `Ciclo de ${new Date(lastRun.started_at).toLocaleString("pt-BR")}`,
          at: ranAt,
        }
      : undefined;
    agents.push({
      id: agentId,
      kind: "main",
      parentId: agent.parent_agent_id ? `nucleo:${agent.parent_agent_id}` : undefined,
      roomId: coreRoomId,
      name: agent.name.split(" · ")[0] || agent.role,
      look: "m",
      role: agent.role,
      title: agent.name,
      sessionId: agentId,
      account: coreRoomId,
      status: isAnalyzing && recentlyRan ? "working" : "idle",
      activity,
      recent: activity ? [activity] : [],
      tasks: [],
      startedAt: new Date(agent.last_run_at ?? now).getTime(),
      lastEventAt: activity?.at ?? now,
      statusSince: activity?.at ?? now,
      stats: { toolCalls: 0, tokensIn: 0, tokensOut: 0, subagents: 0 },
      seed: seedOf(agent.id),
    });
  }

  return {
    rev: 1,
    serverTime: now,
    rooms,
    agents,
    // A barra de contas do Habblaud mostra a cota do Claude Opus 5 Code (5 h e
    // semanal). A Growdash nao tem esse numero: as contas de anuncio ja
    // aparecem como salas na barra lateral do escritorio, entao essa faixa
    // fica vazia em vez de mostrar "sem dados" e um botao "Como ativar" que
    // nao se aplica.
    accounts: [],
    meta: { demo: false, sources: [], startedAt: now, version: "growdash" },
  };
}

/** Os itens de feed: os eventos reais, do mais antigo para o mais recente. */
export function buildFeedItems(data: GrowdashOfficeData, snapshot: OfficeSnapshot): FeedItem[] {
  const byId = new Map(data.agents.map((agent) => [agent.id, agent]));
  const events = [...data.events].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const items: FeedItem[] = [];
  for (const event of events) {
    const owner = event.agent_id ? byId.get(event.agent_id) : undefined;
    const coreAgent = owner ? snapshot.agents.find((agent) => agent.id === `nucleo:${owner.id}`) : undefined;
    items.push({
      id: event.id,
      agentId: coreAgent?.id ?? "nucleo",
      roomId: coreAgent?.roomId ?? "nucleo",
      agentName: coreAgent?.name ?? "Núcleo",
      roomName: snapshot.rooms.find((room) => room.id === (coreAgent?.roomId ?? "nucleo"))?.name ?? "Núcleo",
      activity: {
        id: event.id,
        kind: "other",
        icon: event.severity === "critical" ? "🚨" : event.severity === "warning" ? "⚠️" : "ℹ️",
        text: (event.body || event.title).slice(0, 46),
        detail: event.title,
        at: new Date(event.created_at).getTime(),
      },
    });
  }
  return items;
}

/** O nome curto da conta, para o rotulo do orquestrador. */
function shortName(accountName: string): string {
  const cleaned = accountName.replace(/^CA\d*\s*-\s*/i, "").replace(/\[.*?\]/g, "").trim();
  return cleaned.slice(0, 24) || accountName.slice(0, 24);
}

/** O nome de um agente de execucao: varia dentro da sala. */
const WORKER_NAMES = [
  "Bia", "Caio", "Duda", "Eloá", "Fábio", "Gil", "Hugo", "Iara", "João", "Lia",
  "Miguel", "Nara", "Otávio", "Paula", "Rui", "Sofia", "Tiago", "Vera", "Wanda", "Yuri",
];

function workerName(accountName: string, index: number): string {
  const base = WORKER_NAMES[(index - 1) % WORKER_NAMES.length];
  return `${base} · ${shortName(accountName)}`;
}
