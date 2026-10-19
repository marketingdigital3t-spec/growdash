import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  Coffee,
  ChevronRight,
  MessageCircle,
  Minimize2,
  Network,
  Radar,
  Rotate3D,
  RotateCcw,
  Send,
  Sparkles,
  UserCog,
  UsersRound,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useInsights } from "@/hooks/useInsights";
import { useMetaTrafficMetrics } from "@/hooks/useMetaTrafficMetrics";
import { useRDDealsForPeriod } from "@/hooks/useRDDealsForPeriod";
import { aggregateSales, useSales } from "@/hooks/useSales";
import { useWorkspace } from "@/hooks/useWorkspace";
import { buildAgentAnswer, type AgentMetrics } from "@/lib/agentOffice";
import { businessCalendarDate, businessDateKey } from "@/lib/businessDate";
import { buildCoreAccountSummaries, type CoreAccountInput, type CoreAgentConfig, type CoreAreaId, type CoreSchedule } from "@/lib/agentCore";
import { AGENT_NEED_META, advanceAgentLifeState, createInitialAgentLifeStates, formatAgentClock, getAgentPhaseLabel, type AgentLifeState, type AgentNeedKey } from "@/lib/agentLife";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { NeuralCommandCore3D } from "@/growdash/NeuralCommandCore3D";

type AgentStatus = "working" | "walking" | "free";
type ChatMessage = { id: string; role: "agent" | "user"; text: string };

const LifeSimPage = lazy(() => import("@/growdash/LifeSimPage"));

const AGENTS = [
  { id: "ceo", name: "Helena", role: "CEO · Chief of Staff", specialty: "Prioridades & decisões", task: "Consolidando a operação", color: "#e9b72d", desk: "station-traffic", position: "npc-atlas", look: "look-a", skin: "#c88b68", hair: "#291c19", outfit: "#b87924", pants: "#25252b" },
  { id: "marketing", name: "Ágata", role: "Gestora de Marketing", specialty: "Tráfego & crescimento", task: "Analisando campanhas", color: "#38bdf8", desk: "station-creative", position: "npc-milo", look: "look-f", skin: "#f0b18d", hair: "#c36c37", outfit: "#a84e24", pants: "#39333a" },
  { id: "commercial", name: "Camila", role: "Diretora Comercial", specialty: "CRM & vendas", task: "Revisando pipeline", color: "#fb7185", desk: "station-sales", position: "npc-dora", look: "look-c", skin: "#b87556", hair: "#161518", outfit: "#a63e5d", pants: "#272128" },
  { id: "finance", name: "Bianca", role: "CFO", specialty: "Caixa & margem", task: "Conciliando resultado", color: "#34d399", desk: "station-finance", position: "npc-fina", look: "look-b", skin: "#e0a07d", hair: "#4b2b24", outfit: "#266e59", pants: "#343038" },
  { id: "legal", name: "Júlia", role: "Advogada", specialty: "Risco & compliance", task: "Auditando permissões", color: "#a78bfa", desk: "station-seo", position: "npc-otto", look: "look-d", skin: "#efb08d", hair: "#7e3f29", outfit: "#27648d", pants: "#34383d" },
] as const;

const INITIAL_LIFE_STATES = createInitialAgentLifeStates(AGENTS);

function readStored<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || "") as T; } catch { return fallback; }
}

export default function AgentsOfficePage() {
  const { data: accounts = [] } = useAdAccounts();
  const { startDate, endDate, businessUnitId, segment } = useGlobalFilters();
  const visibleAccounts = useMemo(() => businessUnitId
    ? accounts.filter((account) => account.business_unit_id === businessUnitId || (segment === "infoproduto" && !account.business_unit_id))
    : accounts, [accounts, businessUnitId, segment]);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  // The command map is the primary agent surface. The 3D office remains
  // available as a secondary workspace for presence and status controls.
  const [view, setView] = useState<"map" | "office">("map");
  const showLegacyOfficePreview = window.location.hash === "#legacy-office";
  const [officeAngle, setOfficeAngle] = useState(0);
  const officeDragStart = useRef<number | null>(null);
  const officeAngleStart = useRef(0);
  const [minimized, setMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [gameMinutes, setGameMinutes] = useState(8 * 60 + 20);
  const [timeSpeed, setTimeSpeed] = useState<0 | 1 | 2 | 3>(1);
  const [lifeMode, setLifeMode] = useState<"life" | "build">("life");
  const [autonomyEnabled, setAutonomyEnabled] = useState(true);
  const [lifeStates, setLifeStates] = useState<Record<string, AgentLifeState>>(() => INITIAL_LIFE_STATES);
  const [statuses, setStatuses] = useState<Record<string, AgentStatus>>(() => readStored("growdash:agent-statuses", Object.fromEntries(AGENTS.map((agent) => [agent.id, "working"]))));
  const [assignments, setAssignments] = useState<Record<string, string>>(() => readStored("growdash:agent-accounts", {}));
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>(() => Object.fromEntries(AGENTS.map((agent) => [agent.id, [{ id: `${agent.id}-welcome`, role: "agent", text: `Olá, eu sou ${agent.name}. Vincule uma conta e pergunte sobre tráfego, leads, funil ou escala.` }]])));
  const gameMinutesRef = useRef(gameMinutes);
  const statusesRef = useRef(statuses);
  const timeSpeedRef = useRef(timeSpeed);
  const autonomyRef = useRef(autonomyEnabled);
  const lifeStatesRef = useRef(lifeStates);
  const activeAgent = AGENTS.find((agent) => agent.id === activeAgentId) || null;
  const activeAccountId = activeAgent ? assignments[activeAgent.id] : undefined;
  const account = visibleAccounts.find((item) => item.id === activeAccountId);
  const { data: insights = [], isFetching: loadingInsights } = useInsights({ adAccountId: activeAccountId, startDate, endDate, enabled: !!activeAccountId });
  const metaTraffic = useMetaTrafficMetrics({ adAccountIds: activeAccountId ? [activeAccountId] : [], startDate: businessDateKey(startDate), endDate: businessDateKey(endDate) }, !!activeAccountId);
  const { data: deals = [], isFetching: loadingDeals } = useRDDealsForPeriod({ adAccountId: activeAccountId, startDate, endDate, enabled: !!activeAccountId });
  const { data: sales = [] } = useSales({ adAccountId: activeAccountId, startDate, endDate, enabled: !!activeAccountId });

  useEffect(() => { localStorage.setItem("growdash:agent-statuses", JSON.stringify(statuses)); }, [statuses]);
  useEffect(() => { localStorage.setItem("growdash:agent-accounts", JSON.stringify(assignments)); }, [assignments]);
  useEffect(() => { gameMinutesRef.current = gameMinutes; }, [gameMinutes]);
  useEffect(() => { statusesRef.current = statuses; }, [statuses]);
  useEffect(() => { timeSpeedRef.current = timeSpeed; }, [timeSpeed]);
  useEffect(() => { autonomyRef.current = autonomyEnabled; }, [autonomyEnabled]);
  useEffect(() => { lifeStatesRef.current = lifeStates; }, [lifeStates]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const speed = timeSpeedRef.current;
      if (speed === 0) return;
      const nextMinutes = (gameMinutesRef.current + speed) % (24 * 60);
      gameMinutesRef.current = nextMinutes;
      setGameMinutes(nextMinutes);
      setLifeStates((current) => Object.fromEntries(AGENTS.map((agent) => [
        agent.id,
        advanceAgentLifeState(current[agent.id] || INITIAL_LIFE_STATES[agent.id], statusesRef.current[agent.id] || "working", nextMinutes),
      ])));
      if (autonomyRef.current && nextMinutes % 45 === 0) {
        setStatuses((current) => Object.fromEntries(AGENTS.map((agent) => {
          const state = lifeStatesRef.current[agent.id];
          const nextStatus = state?.needs.energia !== undefined && state.needs.energia < 24 ? "free" : current[agent.id] === "free" ? "working" : current[agent.id];
          return [agent.id, nextStatus];
        })) as Record<string, AgentStatus>);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const metrics = useMemo<AgentMetrics>(() => {
    const media = metaTraffic.data;
    const confirmed = aggregateSales(sales);
    return {
      ...media,
      rdLeads: deals.length,
      wonDeals: confirmed.totalQuantity,
      revenue: confirmed.totalNet,
    };
  }, [deals, metaTraffic.data, sales]);

  const activeLifeState = activeAgent ? lifeStates[activeAgent.id] : null;
  const gameClock = formatAgentClock(gameMinutes);
  const fundsLabel = "R$ 284.290";
  const phaseLabel = activeLifeState ? getAgentPhaseLabel(activeLifeState.phase) : "Selecione uma agente";

  const updateStatus = (agentId: string, status: AgentStatus) => setStatuses((current) => ({ ...current, [agentId]: status }));
  const openAgent = (agentId: string) => { setActiveAgentId(agentId); setMinimized(false); };
  const sendMessage = () => {
    if (!activeAgent || !input.trim()) return;
    const question = input.trim();
    const period = `${format(businessCalendarDate(startDate), "dd/MM/yyyy")} a ${format(businessCalendarDate(endDate), "dd/MM/yyyy")}`;
    const answer = activeAccountId
      ? buildAgentAnswer(question, metrics, account?.name || "Conta selecionada", period)
      : "Primeiro escolha uma conta de anúncio para este agente. Assim eu cruzo Meta Ads e RD Station sem misturar operações.";
    setMessages((current) => ({
      ...current,
      [activeAgent.id]: [...(current[activeAgent.id] || []), { id: crypto.randomUUID(), role: "user", text: question }, { id: crypto.randomUUID(), role: "agent", text: answer }],
    }));
    setInput("");
  };

  return (
    <div className="agents-office-page mx-auto w-full max-w-[1920px]">
      {view === "map" ? <KnowledgeMap
        onOpenOffice={() => setView("office")}
        accounts={visibleAccounts.map((account) => ({ id: account.id, name: account.name, target_cpl: account.target_cpl }))}
        startDate={startDate}
        endDate={endDate}
      /> : <>
        <Suspense fallback={<div className="grid min-h-[620px] place-items-center rounded-2xl border border-primary/25 bg-[#161108] text-sm text-primary">Carregando escritório 3D…</div>}>
          <LifeSimPage />
        </Suspense>
        {showLegacyOfficePreview && <div className="agent-office-shell office-3d-stage relative min-h-[660px] overflow-hidden rounded-2xl border border-primary/20 bg-[#070706] shadow-2xl">
        <div className="office-sim-topbar">
          <div className="office-sim-brand"><span className="office-sim-brand-mark"><Bot className="h-3.5 w-3.5" /></span><span><b>GROWDASH LIFE</b><small>AGENT OPERATIONS</small></span></div>
          <div className="office-sim-presence" aria-label="Agentes presentes no escritório">
            {AGENTS.map((agent) => <button key={agent.id} type="button" onClick={() => openAgent(agent.id)} className={cn("office-presence-agent", `is-${statuses[agent.id] || "working"}`)} style={{ "--agent-color": agent.color } as React.CSSProperties}><span className="office-presence-avatar"><Bot className="h-3 w-3" /></span><span><b>{agent.name}</b><small>{statuses[agent.id] === "working" ? "online" : statuses[agent.id] === "walking" ? "andando" : "livre"}</small></span><i /></button>)}
          </div>
          <div className="office-sim-live"><span className="office-live-dot" /><span><b>Operação ao vivo</b><small>5 diretores conectados</small></span><button type="button" onClick={() => updateStatus("ceo", "walking")} aria-label="Abrir standup da equipe">STANDUP BOARD</button></div>
        </div>
        <aside className="office-sim-rail" aria-label="Navegação do escritório">
          <span className="office-rail-logo"><Sparkles className="h-4 w-4" /></span>
          <button type="button" className="is-active" aria-label="Escritório"><BriefcaseBusiness className="h-4 w-4" /></button>
          <button type="button" onClick={() => setView("map")} aria-label="Mapa de inteligência"><Network className="h-4 w-4" /></button>
          <button type="button" onClick={() => openAgent(activeAgentId || AGENTS[0].id)} aria-label="Chat dos agentes"><MessageCircle className="h-4 w-4" /></button>
          <button type="button" onClick={() => updateStatus("ceo", "working")} aria-label="Ativar operação"><Activity className="h-4 w-4" /></button>
          <span className="office-rail-spacer" />
          <button type="button" onClick={() => setOfficeAngle(0)} aria-label="Recentrar escritório"><RotateCcw className="h-4 w-4" /></button>
        </aside>
        <div className="office-viewport-toolbar" role="toolbar" aria-label="Controles da câmera do escritório">
          <span className="office-viewport-title"><Rotate3D className="h-3.5 w-3.5" />ESCRITÓRIO 360°</span>
          <span className="office-viewport-hint">Arraste a visão ou use as setas para orbitar</span>
          <div className="office-camera-buttons"><button type="button" onClick={() => setOfficeAngle((value) => value - 18)} aria-label="Orbitar para a esquerda"><ArrowLeft className="h-3.5 w-3.5" /></button><button type="button" onClick={() => setOfficeAngle(0)} aria-label="Centralizar câmera"><RotateCcw className="h-3.5 w-3.5" /></button><button type="button" onClick={() => setOfficeAngle((value) => value + 18)} aria-label="Orbitar para a direita"><ArrowRight className="h-3.5 w-3.5" /></button></div>
        </div>
        <div className="office-3d-world" style={{ "--office-angle": `${officeAngle}deg` } as React.CSSProperties} onPointerDown={(event) => { if ((event.target as HTMLElement).closest("button")) return; officeDragStart.current = event.clientX; officeAngleStart.current = officeAngle; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (officeDragStart.current === null) return; setOfficeAngle(Math.max(-180, Math.min(180, officeAngleStart.current + (event.clientX - officeDragStart.current) / 4.5))); }} onPointerUp={() => { officeDragStart.current = null; }} onPointerCancel={() => { officeDragStart.current = null; }}>
          <div className="office-life-hud" aria-label="Controles do Growdash Life">
            <div className="office-life-clock"><span className="office-life-clock-icon">◷</span><span><b>{gameClock}</b><small>{timeSpeed === 0 ? "Pausado" : `Velocidade ${timeSpeed}x`}</small></span></div>
            <div className="office-life-mode" role="group" aria-label="Modo do escritório"><button type="button" className={cn(lifeMode === "life" && "is-active")} onClick={() => setLifeMode("life")}>◈ Vida</button><button type="button" className={cn(lifeMode === "build" && "is-active")} onClick={() => setLifeMode("build")}>▦ Construir</button></div>
            <div className="office-life-speed" role="group" aria-label="Velocidade do tempo"><button type="button" className={cn(timeSpeed === 0 && "is-active")} onClick={() => setTimeSpeed(0)} aria-label="Pausar tempo">Ⅱ</button>{([1, 2, 3] as const).map((speed) => <button key={speed} type="button" className={cn(timeSpeed === speed && "is-active")} onClick={() => setTimeSpeed(speed)} aria-label={`Velocidade ${speed}x`}>{speed}×</button>)}</div>
            <div className="office-life-funds"><span>§</span><b>{fundsLabel}</b></div>
            <button type="button" className={cn("office-life-autonomy", autonomyEnabled && "is-active")} onClick={() => setAutonomyEnabled((value) => !value)} aria-pressed={autonomyEnabled}><span className="office-live-dot" /> Autonomia</button>
          </div>
          <div className="office-architecture" aria-hidden="true">
            <span className="office-ceiling-plane"><i /><i /><i /><b>GROWDASH HQ · LIVE INTELLIGENCE FLOOR</b></span>
            <span className="office-architecture-wall office-architecture-wall-back"><i /><i /><i /><b>CONTROL ROOM 01</b></span>
            <span className="office-architecture-wall office-architecture-wall-left"><i /><i /></span>
            <span className="office-architecture-wall office-architecture-wall-right"><i /><i /></span>
            <span className="office-light-beam office-light-beam-a" /><span className="office-light-beam office-light-beam-b" /><span className="office-light-beam office-light-beam-c" />
            <span className="office-ceiling-spot spot-a" /><span className="office-ceiling-spot spot-b" /><span className="office-ceiling-spot spot-c" />
          </div>
          <div className="office-room-shell" aria-hidden="true"><span className="room-wall room-wall-back" /><span className="room-wall room-wall-left" /><span className="room-wall room-wall-right" /><span className="room-door room-door-main" /><span className="room-window-strip" /></div>
          <div className="office-glass-divider divider-a" aria-hidden="true"><i /><i /><i /></div><div className="office-glass-divider divider-b" aria-hidden="true"><i /><i /><i /></div>
          <div className="office-zone zone-war"><b>WAR ROOM</b><small>Planejamento</small></div><div className="office-zone zone-lounge"><b>LOUNGE</b><small>Tempo livre</small></div><div className="office-zone zone-focus"><b>FOCUS PODS</b><small>Execução</small></div>
          <div className="office-window"><span /><span /><span /></div>
          <div className="office-wall-sign"><WandSparkles className="h-4 w-4" /> GROWDASH INTELLIGENCE</div>
          <div className="office-floor-grid" />
          <div className="office-rug"><Bot className="h-8 w-8" /><span>AI<br />HUB</span></div>
          <div className="office-plant plant-a"><i /><b /></div><div className="office-plant plant-b"><i /><b /></div>
          <div className="office-room-label room-label-lounge"><Coffee className="h-3 w-3" /> Lounge</div><div className="office-room-label room-label-war"><Sparkles className="h-3 w-3" /> War room</div>
          {AGENTS.map((agent) => {
            const phase = lifeStates[agent.id]?.phase || "TRABALHAR";
            const monitorOn = phase === "TRABALHAR" || phase === "INTERAGIR";
            return <div key={agent.id} className={cn("office-desk", agent.desk, monitorOn && "is-monitor-on")}>
              <span className="office-desk-top" /><span className="office-desk-leg desk-leg-left" /><span className="office-desk-leg desk-leg-right" />
              <span className="office-monitor-shell"><span className={cn("office-monitor", monitorOn ? "is-on" : "is-off")} aria-label={monitorOn ? "Computador ligado" : "Computador desligado"}><Activity /></span><i className="office-monitor-reflection" /></span>
              <span className="office-keyboard" /><span className="office-desk-lamp"><i /><b /></span><span className="office-chair"><i /><b /></span><small>{agent.specialty}</small>
            </div>;
          })}
          <div className="office-lounge"><Coffee className="h-5 w-5" /><span>PAUSA</span></div>
          <div className="office-whiteboard"><b>OPERATIONAL BOARD</b><span>Prioridades · alertas · próximos passos</span><i /><i /><i /></div>

          {AGENTS.map((agent, index) => {
            const status = statuses[agent.id] || "working";
            const lifeState = lifeStates[agent.id] || INITIAL_LIFE_STATES[agent.id];
            const assigned = visibleAccounts.find((item) => item.id === assignments[agent.id]);
            return (
              <button key={agent.id} type="button" onClick={() => openAgent(agent.id)} className={cn("office-npc office-3d-npc", agent.position, agent.look, `is-${status}`, `phase-${lifeState.phase.toLowerCase()}`, lifeState.phase === "IDLE" && "is-resting")} style={{ "--agent-color": agent.color, "--npc-delay": `${index * -0.7}s`, "--npc-skin": agent.skin, "--npc-hair": agent.hair, "--npc-outfit": agent.outfit, "--npc-pants": agent.pants } as React.CSSProperties} aria-label={`Abrir estação de ${agent.name}, ${agent.role}`}>
                <span className="npc-shadow" /><span className="npc-ground-light" /><span className="npc-chair-back" /><span className="npc-body"><i className="npc-head" /><i className="npc-hair" /><i className="npc-neck" /><i className="npc-shirt" /><i className="npc-arm npc-arm-left" /><i className="npc-arm npc-arm-right" /><i className="npc-legs" /><i className="npc-shoe npc-shoe-left" /><i className="npc-shoe npc-shoe-right" /></span>
                <span className="npc-plumbob" /><span className="npc-task-light" />
                <span className="npc-label"><b>{agent.name}</b><small>{assigned?.name || agent.role}</small><em>{lifeState.phase === "IDLE" && status === "working" ? "Pausa automática" : getAgentPhaseLabel(lifeState.phase)}</em></span>
              </button>
            );
          })}
        </div>

        {activeAgent && activeLifeState && <aside className="office-life-inspector" aria-live="polite">
          <div className="office-life-inspector-head"><span className="office-agent-avatar" style={{ "--agent-color": activeAgent.color } as React.CSSProperties}><Bot className="h-3.5 w-3.5" /></span><span><b>{activeAgent.name}</b><small>{phaseLabel}</small></span><i className={cn(activeLifeState.phase === "IDLE" ? "is-warn" : "is-ok")} /></div>
          <div className="office-needs-grid">{(Object.keys(AGENT_NEED_META) as AgentNeedKey[]).map((key) => { const meta = AGENT_NEED_META[key]; const value = activeLifeState.needs[key]; return <div key={key} className="office-need-row"><span><b>{meta.icon}</b>{meta.label}</span><span className="office-need-track"><i style={{ width: `${value}%`, background: meta.color }} /></span><small>{Math.round(value)}</small></div>; })}</div>
        </aside>}

        <div className="office-command-bar" aria-label="Comandos dos agentes">
          <div className="office-command-copy"><b>Comando do escritório</b><small>Escolha o que cada NPC deve fazer agora.</small></div>
          {AGENTS.map((agent) => <div key={agent.id} className="office-agent-command"><button type="button" onClick={() => openAgent(agent.id)} className="office-agent-identity" style={{ "--agent-color": agent.color } as React.CSSProperties}><span className="office-agent-avatar"><Bot className="h-3.5 w-3.5" /></span><span><b>{agent.name}</b><small>{agent.role}</small></span></button><div className="office-agent-modes"><AgentModeButton active={statuses[agent.id] === "working"} onClick={() => updateStatus(agent.id, "working")} icon={<BriefcaseBusiness />} label="Trabalhar" /><AgentModeButton active={statuses[agent.id] === "walking"} onClick={() => updateStatus(agent.id, "walking")} icon={<UsersRound />} label="Andar" /><AgentModeButton active={statuses[agent.id] === "free"} onClick={() => updateStatus(agent.id, "free")} icon={<Coffee />} label="Livre" /></div></div>)}
        </div>

        {activeAgent && (
          <aside className={cn("agent-chat-panel", minimized && "is-minimized")}>
            <header className="flex items-center gap-3 border-b border-white/10 p-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary"><Bot className="h-5 w-5" /></span>
              <div className="min-w-0 grow"><b className="block truncate text-sm text-white">{activeAgent.name}</b><span className="block truncate text-[9px] text-white/45">{activeAgent.role}</span></div>
              <button type="button" onClick={() => setMinimized((value) => !value)} className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Minimizar chat"><Minimize2 className="h-4 w-4" /></button>
              <button type="button" onClick={() => setActiveAgentId(null)} className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Fechar chat"><X className="h-4 w-4" /></button>
            </header>
            {!minimized && <>
              <div className="border-b border-white/10 p-3">
                <label className="mb-1 block text-[9px] font-black uppercase tracking-wider text-white/45">Conta analisada por este agente</label>
                <Select value={assignments[activeAgent.id] || ""} onValueChange={(value) => setAssignments((current) => ({ ...current, [activeAgent.id]: value }))}><SelectTrigger className="h-9 border-white/15 bg-black/45 text-xs text-white"><SelectValue placeholder="Vincular conta Meta Ads" /></SelectTrigger><SelectContent>{visibleAccounts.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
                <div className="mt-2 grid grid-cols-3 gap-1"><AgentModeButton active={statuses[activeAgent.id] === "working"} onClick={() => updateStatus(activeAgent.id, "working")} icon={<BriefcaseBusiness />} label="Trabalhar" /><AgentModeButton active={statuses[activeAgent.id] === "walking"} onClick={() => updateStatus(activeAgent.id, "walking")} icon={<UsersRound />} label="Andar" /><AgentModeButton active={statuses[activeAgent.id] === "free"} onClick={() => updateStatus(activeAgent.id, "free")} icon={<Coffee />} label="Livre" /></div>
              </div>
              <div className="agent-chat-messages growdash-scrollbar">
                {(messages[activeAgent.id] || []).map((message) => <div key={message.id} className={cn("agent-message", message.role === "user" ? "is-user" : "is-agent")}>{message.text}</div>)}
                {(loadingInsights || metaTraffic.isLoading || loadingDeals) && activeAccountId && <div className="agent-message is-agent animate-pulse">Atualizando dados da conta em segundo plano…</div>}
              </div>
              <div className="border-t border-white/10 p-3">
                <div className="mb-2 flex gap-1 overflow-x-auto growdash-scrollbar-hidden">{["Leads e CPL", "CTR e criativos", "Vendas e ROAS"].map((suggestion) => <button key={suggestion} type="button" onClick={() => setInput(suggestion)} className="shrink-0 rounded-full border border-white/10 px-2 py-1 text-[9px] text-white/55 hover:border-primary/50 hover:text-primary">{suggestion}</button>)}</div>
                <div className="flex gap-2"><input aria-label={`Perguntar ao agente ${activeAgent.name}`} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") sendMessage(); }} placeholder="Pergunte sobre esta conta…" className="h-10 min-w-0 grow rounded-xl border border-white/15 bg-black/50 px-3 text-xs text-white outline-none placeholder:text-white/25 focus:border-primary/55" /><button type="button" onClick={sendMessage} className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground" aria-label="Enviar pergunta"><Send className="h-4 w-4" /></button></div>
              </div>
            </>}
          </aside>
        )}
        </div>}</>}
    </div>
  );
}

const KNOWLEDGE_NODES: KnowledgeNode[] = [
  { id: "strategy", dbRole: "ceo", label: "CEO · Estratégia", agentName: "Helena", agentRole: "Gestora de estratégia", agentColor: "#f2c14e", chatRole: "ceo", note: "Prioridades, decisões e alinhamento", document: "Lê o Cérebro Central e consolida os sinais das outras salas em prioridades de negócio.", decision: "Escolha uma prioridade por ciclo, registre a decisão e encaminhe o próximo passo para o gestor responsável.", strategies: [["Visão executiva", "executive"], ["Prioridades", "priorities"], ["Revisão cruzada", "cross-review"]] },
  { id: "research", dbRole: "research", label: "Pesquisa", agentName: "Rafael", agentRole: "Gestor de pesquisa", agentColor: "#42b8ff", chatRole: "research", note: "Mercado, concorrência e tendências", document: "Organiza hipóteses, benchmarks e evidências para reduzir incerteza antes das decisões.", decision: "Separe dado observado de hipótese e registre a fonte antes de recomendar um novo teste.", strategies: [["Benchmark", "benchmark"], ["Concorrentes", "competitors"], ["Tendências", "trends"]] },
  { id: "traffic", dbRole: "marketing", label: "Tráfego", agentName: "Ágata", agentRole: "Gestora de aquisição", agentColor: "#3fc7f5", chatRole: "marketing", note: "Meta, Google, orçamento e ROAS", document: "Centraliza investimento, campanhas e sinais de aquisição para proteger custo e escalar o que funciona.", decision: "Priorize conjuntos com volume de leads e custo sustentável; qualquer alteração em campanha ativa exige aprovação.", strategies: [["Campanhas", "campaigns"], ["Orçamento", "budget"], ["Alertas", "alerts"]] },
  { id: "creative", dbRole: "designer", label: "Criativo", agentName: "Milo", agentRole: "Gestor criativo", agentColor: "#ae8bff", chatRole: "designer", note: "Copies, hooks e testes", document: "Transforma sinais de campanha em hipóteses de mensagem, roteiros e variações de criativos.", decision: "Teste uma hipótese por vez e preserve a promessa central até que o dado prove o contrário.", strategies: [["Hooks", "hooks"], ["Roteiros", "scripts"], ["Testes A/B", "creative-tests"]] },
  { id: "social", dbRole: "social", label: "Social", agentName: "Sofia", agentRole: "Gestora de conteúdo", agentColor: "#e35fe8", chatRole: "social", note: "Instagram e calendário editorial", document: "Conecta calendário, formatos e distribuição social ao que a operação precisa provar ou reforçar.", decision: "Planeje conteúdo a partir da prioridade do ciclo e acompanhe a resposta antes de replicar o formato.", strategies: [["Calendário", "calendar"], ["Posts", "posts"], ["Distribuição", "distribution"]] },
  { id: "sales", dbRole: "commercial", label: "Vendas", agentName: "Camila", agentRole: "Gestora comercial", agentColor: "#ff718b", chatRole: "commercial", note: "Funil, qualificação e follow-up", document: "Lê o CRM, identifica gargalos e organiza a próxima ação de cada oportunidade sem enviar mensagens automaticamente.", decision: "Use a etapa e o responsável registrados no CRM para definir o próximo follow-up.", strategies: [["Pipeline", "pipeline"], ["Qualificação", "qualification"], ["Follow-up", "followups"]] },
  { id: "analytics", dbRole: "analytics", label: "Analytics", agentName: "Theo", agentRole: "Gestor de dados", agentColor: "#56d5bb", chatRole: "analytics", note: "Métricas, diagnósticos e relatórios", document: "Compara períodos e fontes com o mesmo escopo antes de afirmar que um número está correto.", decision: "Confirme conta, período e definição do evento; divergências sobem ao CEO antes da entrega.", strategies: [["KPIs", "kpis"], ["Diagnóstico", "diagnostics"], ["Relatórios", "reports"]] },
  { id: "finance", dbRole: "finance", label: "Financeiro", agentName: "Bianca", agentRole: "Gestora financeira", agentColor: "#35d7a0", chatRole: "finance", note: "Faturamento, metas e margem", document: "Reúne receita confirmada, investimento e custos para acompanhar resultado e capacidade de decisão.", decision: "Leia receita e mídia juntas; qualquer gasto ou mudança de meta fica pendente de aprovação.", strategies: [["DRE", "dre"], ["Margem", "margin"], ["Projeções", "forecast"]] },
  { id: "legal", dbRole: "legal", label: "Jurídico", agentName: "Júlia", agentRole: "Gestora jurídica", agentColor: "#c5a4ff", chatRole: "legal", note: "Contratos, LGPD e conformidade", document: "Revisa integrações, permissões, contratos e mensagens para reduzir risco antes de qualquer ação externa.", decision: "Prepare a recomendação e escale para aprovação do usuário quando houver impacto legal ou público.", strategies: [["LGPD", "lgpd"], ["Contratos", "contracts"], ["Permissões", "permissions"]] },
  { id: "inbox", dbRole: "inbox", label: "Inbox", agentName: "Nina", agentRole: "Gestora de triagem", agentColor: "#ff9b45", chatRole: "inbox", note: "Mensagens, triagem e encaminhamento", document: "Classifica mensagens, identifica urgência e encaminha cada assunto para a sala responsável.", decision: "Não responda em nome do usuário sem aprovação; registre contexto e próxima ação antes de encaminhar.", strategies: [["Triagem", "triage"], ["Prioridades", "inbox-priorities"], ["Encaminhamentos", "routing"]] },
];

const NEURAL_POINTS = Array.from({ length: 18 }, (_, index) => ({
  id: index,
  x: 4 + ((index * 37) % 92),
  y: 5 + ((index * 53) % 88),
  size: 2 + (index % 4),
  delay: -((index * 0.31) % 4.8),
  duration: 3.2 + ((index * 7) % 18) / 10,
  depth: (index % 5) + 1,
}));

const NEURAL_LINKS = Array.from({ length: 20 }, (_, index) => {
  const from = index % NEURAL_POINTS.length;
  const to = (index * 7 + 11) % NEURAL_POINTS.length;
  return [from, to] as const;
});

type CorePhase = "brain" | "entering" | "core";

type KnowledgeStrategy = readonly [string, string];
type DirectorRole = "ceo" | "marketing" | "commercial" | "finance" | "legal" | "growth" | "designer" | "strategist" | "research" | "social" | "analytics" | "inbox";
type KnowledgeNode = { id: CoreAreaId; dbRole: DirectorRole; label: string; agentName: string; agentRole: string; agentColor: string; chatRole: DirectorRole; note: string; document: string; decision: string; strategies: readonly KnowledgeStrategy[] };
type SpatialGraphNode = { id: string; area: CoreAreaId | null; label: string; kind: "root" | "area" | "topic"; x: number; y: number; strategyId?: string };

const AREA_POSITIONS: Record<CoreAreaId, readonly [number, number]> = {
  strategy: [50, 11], research: [28, 16], traffic: [72, 16], creative: [14, 36], social: [86, 36],
  sales: [14, 66], analytics: [86, 66], finance: [28, 86], legal: [50, 91], inbox: [72, 86],
  crm: [14, 66], commercial: [14, 66], brand: [14, 36], automations: [72, 86],
};

const SPATIAL_GRAPH_NODES: SpatialGraphNode[] = [
  { id: "growdash", area: null, label: "Growdash", kind: "root", x: 50, y: 50 },
  ...KNOWLEDGE_NODES.map((node) => {
    const [x, y] = AREA_POSITIONS[node.id];
    return { id: node.id, area: node.id, label: node.label, kind: "area" as const, x, y };
  }),
];

const SPATIAL_GRAPH_EDGES = [
  ...KNOWLEDGE_NODES.map((node) => ["growdash", node.id] as const),
] as const;

function KnowledgeMap({ onOpenOffice, accounts, startDate, endDate }: { onOpenOffice: () => void; accounts: CoreAccountInput[]; startDate: Date; endDate: Date }) {
  const [phase, setPhase] = useState<CorePhase>("core");
  const [selectedArea, setSelectedArea] = useState<CoreAreaId | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [animationsActive, setAnimationsActive] = useState(true);
  const transitionTimer = useRef<number | null>(null);
  const stageRef = useRef<HTMLElement | null>(null);
  const parallaxFrameRef = useRef<number | null>(null);
  const parallaxValuesRef = useRef({ x: 0, y: 0 });
  const isCoreOpen = phase === "core";
  const selectedNode = KNOWLEDGE_NODES.find((node) => node.id === selectedArea) || null;
  // Load the shared operational signals once the user enters the core. The
  // graph and its health state then use the same real data without a request
  // per node or fabricated placeholders.
  const needsMedia = isCoreOpen;
  const needsDeals = isCoreOpen;
  const needsSales = isCoreOpen;
  const { data: workspace } = useWorkspace();
  const directorsQuery = useQuery<Array<{ id: string; role: string; name: string; status: string; runtime_status: string; is_visible: boolean }>>({
    queryKey: ["agent-core-directors", workspace?.id],
    enabled: isCoreOpen && !!workspace?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("agent_office_agents")
        .select("id,role,name,status,runtime_status,is_visible")
        .eq("workspace_id", workspace!.id)
        .eq("is_visible", true)
        .order("role");
      if (error) {
        console.warn("Growdash agent rooms unavailable:", error.message);
        return [];
      }
      return (data || []) as Array<{ id: string; role: string; name: string; status: string; runtime_status: string; is_visible: boolean }>;
    },
    staleTime: 60_000,
  });
  const mediaQuery = useInsights({ startDate, endDate, enabled: isCoreOpen && needsMedia });
  const dealsQuery = useRDDealsForPeriod({ startDate, endDate, enabled: isCoreOpen && needsDeals });
  const salesQuery = useSales({ startDate, endDate, enabled: isCoreOpen && needsSales });
  const schedulesQuery = useQuery<CoreSchedule[]>({
    queryKey: ["agent-core-schedules", workspace?.id],
    enabled: isCoreOpen && selectedArea === "automations" && !!workspace?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_report_schedules")
        .select("id, ad_account_id, name, enabled, next_run_at, last_status")
        .eq("workspace_id", workspace!.id)
        .order("next_run_at", { ascending: true, nullsFirst: false });
      if (error) {
        console.warn("Growdash core schedules unavailable:", error.message);
        return [];
      }
      return (data || []) as CoreSchedule[];
    },
    staleTime: 5 * 60_000,
  });
  const configsQuery = useQuery<CoreAgentConfig[]>({
    queryKey: ["agent-core-configs", workspace?.id],
    enabled: isCoreOpen && !!selectedArea && !!workspace?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intelligence_agent_configs")
        .select("id, ad_account_id, specialty, objective, status, last_run_at")
        .eq("workspace_id", workspace!.id)
        .order("updated_at", { ascending: false });
      if (error) {
        console.warn("Growdash core agent configs unavailable:", error.message);
        return [];
      }
      return (data || []) as CoreAgentConfig[];
    },
    staleTime: 5 * 60_000,
  });
  const summaries = useMemo(() => buildCoreAccountSummaries(selectedArea || "traffic", {
    accounts,
    insights: mediaQuery.data,
    deals: dealsQuery.data,
    sales: salesQuery.data,
    schedules: schedulesQuery.data,
    agentConfigs: configsQuery.data,
  }), [accounts, configsQuery.data, dealsQuery.data, mediaQuery.data, schedulesQuery.data, selectedArea, salesQuery.data]);
  const directorsByRole = useMemo(() => new Map((directorsQuery.data || []).map((agent) => [agent.role, agent])), [directorsQuery.data]);
  const neuralHealth = useMemo(() => {
    const measured = summaries.filter((summary) => summary.health !== "no-data");
    if (!measured.length) return { status: "no-data" as const, score: null };
    const values = { healthy: 100, attention: 60, critical: 25 } as const;
    const score = Math.round(measured.reduce((total, summary) => total + values[summary.health], 0) / measured.length);
    return {
      status: score < 45 ? "critical" as const : score < 80 ? "attention" as const : "healthy" as const,
      score,
    };
  }, [summaries]);
  const selectedStrategyLabel = selectedNode?.strategies.find(([, id]) => id === selectedStrategy)?.[0] || selectedNode?.strategies[0]?.[0] || "Visão geral";
  const panelLoading = (needsMedia && mediaQuery.isFetching) || (needsDeals && dealsQuery.isFetching) || (needsSales && salesQuery.isFetching) || (selectedArea === "automations" && (schedulesQuery.isFetching || configsQuery.isFetching));

  useEffect(() => () => {
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
    if (parallaxFrameRef.current !== null) window.cancelAnimationFrame(parallaxFrameRef.current);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const updateVisibility = () => setAnimationsActive(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", updateVisibility);
    if (typeof IntersectionObserver === "undefined") return () => document.removeEventListener("visibilitychange", updateVisibility);
    const observer = new IntersectionObserver(([entry]) => setAnimationsActive(entry.isIntersecting && document.visibilityState === "visible"), { threshold: 0.08 });
    observer.observe(stage);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  const enterCore = () => {
    if (phase !== "brain") return;
    setPhase("entering");
    transitionTimer.current = window.setTimeout(() => setPhase("core"), 1140);
  };

  const resetCore = () => {
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
    transitionTimer.current = null;
    setPhase("brain");
    setSelectedArea(null);
    setSelectedStrategy(null);
  };

  const updateParallax = (event: React.PointerEvent<HTMLElement>) => {
    if (window.matchMedia?.("(pointer: coarse)").matches || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - .5) * 2));
    const y = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - .5) * 2));
    parallaxValuesRef.current = { x, y };
    if (parallaxFrameRef.current !== null) return;
    parallaxFrameRef.current = window.requestAnimationFrame(() => {
      parallaxFrameRef.current = null;
      const values = parallaxValuesRef.current;
      const target = stageRef.current;
      if (!target) return;
      target.style.setProperty("--jarvis-bg-x", `${(values.x * 20).toFixed(1)}px`);
      target.style.setProperty("--jarvis-bg-y", `${(values.y * 14).toFixed(1)}px`);
      target.style.setProperty("--jarvis-grid-x", `${(values.x * -7).toFixed(1)}px`);
      target.style.setProperty("--jarvis-grid-y", `${(values.y * -5).toFixed(1)}px`);
      target.style.setProperty("--jarvis-field-x", `${(values.x * 8).toFixed(1)}px`);
      target.style.setProperty("--jarvis-field-y", `${(values.y * 6).toFixed(1)}px`);
    });
  };

  const resetParallax = () => {
    if (parallaxFrameRef.current !== null) window.cancelAnimationFrame(parallaxFrameRef.current);
    parallaxFrameRef.current = null;
    ["--jarvis-bg-x", "--jarvis-bg-y", "--jarvis-grid-x", "--jarvis-grid-y", "--jarvis-field-x", "--jarvis-field-y"].forEach((property) => stageRef.current?.style.setProperty(property, "0px"));
  };

  const openArea = (area: CoreAreaId, strategyId?: string) => {
    setSelectedArea(area);
    setSelectedStrategy(strategyId || KNOWLEDGE_NODES.find((node) => node.id === area)?.strategies[0]?.[1] || null);
  };

  return <section ref={stageRef} className={cn("jarvis-command-center growdash-core-v2", `is-${phase}`, !animationsActive && "is-paused")} aria-label="Núcleo de inteligência Growdash" onPointerMove={updateParallax} onPointerLeave={resetParallax}>
    <div className="knowledge-map-grid" />
    <div className="jarvis-scanline" aria-hidden="true" />
    <div className="jarvis-neural-field" aria-hidden="true">
      <svg viewBox="0 0 1000 760" preserveAspectRatio="none">
        {NEURAL_LINKS.map(([from, to], index) => <line key={`${from}-${to}-${index}`} x1={NEURAL_POINTS[from].x * 10} y1={NEURAL_POINTS[from].y * 7.6} x2={NEURAL_POINTS[to].x * 10} y2={NEURAL_POINTS[to].y * 7.6} style={{ "--link-delay": `${-(index % 9) * .24}s` } as React.CSSProperties} />)}
      </svg>
      {NEURAL_POINTS.map((point) => <i key={point.id} className="jarvis-neural-point" style={{ left: `${point.x}%`, top: `${point.y}%`, width: `${point.size}px`, height: `${point.size}px`, "--point-delay": `${point.delay}s`, "--point-duration": `${point.duration}s`, "--point-depth": point.depth } as React.CSSProperties} />)}
    </div>
    <div className="jarvis-cinematic-tunnel" aria-hidden="true"><i /><i /><i /><i /><span /></div>
    <div className="jarvis-phase-status sr-only" aria-live="polite">{phase === "brain" ? "Cérebro operacional pronto" : phase === "entering" ? "Entrando no núcleo de inteligência" : "Grafo operacional Growdash aberto"}</div>

    <NeuralCommandCore3D expanded={isCoreOpen} entering={phase === "entering"} onEnter={enterCore} health={neuralHealth.status} healthScore={neuralHealth.score} />

    {isCoreOpen && <>
      <div className="jarvis-core-label" aria-live="polite"><Radar /><span>Mapa da operação · {KNOWLEDGE_NODES.length} áreas · {KNOWLEDGE_NODES.reduce((total, node) => total + node.strategies.length, 0)} documentos</span></div>
      <div className="growdash-spatial-graph" aria-label="Mapa mental da operação Growdash">
        <svg className="growdash-spatial-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs><linearGradient id="growdash-map-link" x1="0" x2="1"><stop stopColor="#fff" stopOpacity=".12" /><stop offset=".5" stopColor="#fff" stopOpacity=".72" /><stop offset="1" stopColor="#fff" stopOpacity=".12" /></linearGradient></defs>
          {SPATIAL_GRAPH_EDGES.map(([fromId, toId], index) => {
            const from = SPATIAL_GRAPH_NODES.find((node) => node.id === fromId);
            const to = SPATIAL_GRAPH_NODES.find((node) => node.id === toId);
            // A cross-area connection is optional context. If a strategy is
            // renamed or unavailable in a partial deployment, skip only that
            // edge instead of taking the whole command center down.
            if (!from || !to) return null;
            return <line key={`${fromId}-${toId}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} style={{ "--map-delay": `${-(index % 10) * .25}s` } as React.CSSProperties} />;
          })}
        </svg>
        <button type="button" className="growdash-map-node is-root" style={{ left: "50%", top: "50%" }} aria-label="Growdash, centro do mapa">
          <i aria-hidden="true" /><span>Growdash</span>
        </button>
        <div className="growdash-agent-rooms" aria-label="Salas dos agentes Growdash">
          {KNOWLEDGE_NODES.map((areaNode, index) => {
            const [x, y] = AREA_POSITIONS[areaNode.id];
            const active = selectedArea === areaNode.id;
            const persistedAgent = directorsByRole.get(areaNode.dbRole);
            const agentName = persistedAgent?.name?.split(" · ")[0] || areaNode.agentName;
            const runtime = persistedAgent?.runtime_status || persistedAgent?.status || "aguardando";
            const runtimeLabel = !persistedAgent ? "aguardando conexão" : runtime === "analyzing" || runtime === "working" ? "analisando" : runtime === "waiting_approval" ? "aguardando aprovação" : runtime === "error" ? "com alerta" : "pronto";
            return <button key={areaNode.id} type="button" className={cn("growdash-agent-room", active && "is-selected")} style={{ left: `${x}%`, top: `${y}%`, "--room-index": index, "--agent-color": areaNode.agentColor } as React.CSSProperties} onClick={() => openArea(areaNode.id)} aria-pressed={active} aria-label={`Abrir sala ${areaNode.label} e conversar com ${areaNode.agentName}`}>
              <span className="growdash-agent-room-head"><span className="growdash-agent-room-title"><i aria-hidden="true" /><b>{areaNode.label}</b></span><small>{areaNode.strategies.length} frentes</small></span>
              <span className="growdash-agent-room-floor">
                <span className="growdash-agent-room-agent"><span className="growdash-agent-room-avatar"><Bot className="h-4 w-4" /></span><b>{agentName}</b><small>{areaNode.agentRole}</small><em className={cn(runtime === "error" && "is-alert")}><i />{runtimeLabel}</em></span>
                <span className="growdash-agent-room-workstations">{areaNode.strategies.map(([label, strategyId]) => <span key={strategyId} className="growdash-agent-room-workstation"><i aria-hidden="true" /><span>{label}</span></span>)}</span>
              </span>
              <span className="growdash-agent-room-foot"><span><i /> Gestor conectado ao Cérebro</span><ChevronRight className="h-3 w-3" /></span>
            </button>;
          })}
        </div>
        <div className="growdash-map-legend"><span><i /> Área + agente</span><span><i /> Conexão operacional</span><span>Selecione uma área para ver dados e conversar com o agente</span></div>
      </div>
      <div className="jarvis-actions"><button type="button" onClick={resetCore}><RotateCcw className="h-3.5 w-3.5" />Visão do cérebro</button><button type="button" onClick={onOpenOffice}><BriefcaseBusiness className="h-3.5 w-3.5" />Entrar no escritório 3D</button></div>
      {selectedNode && <OperationalAreaPanel node={selectedNode} summaries={summaries} selectedStrategy={selectedStrategyLabel} loading={panelLoading} onClose={() => setSelectedArea(null)} onSelectStrategy={(id) => setSelectedStrategy(id)} />}
    </>}

    {!isCoreOpen && <div className="jarvis-intro"><b>Central de comando autônoma</b><span>Entre no cérebro operacional para navegar pelas áreas, conexões e estratégias da Growdash.</span><small><Sparkles />Experiência neural interativa</small></div>}
  </section>;
}

function OperationalAreaPanel({ node, summaries, selectedStrategy, loading, onClose, onSelectStrategy }: { node: KnowledgeNode; summaries: ReturnType<typeof buildCoreAccountSummaries>; selectedStrategy: string; loading: boolean; onClose: () => void; onSelectStrategy: (id: string) => void }) {
  const openChat = () => window.dispatchEvent(new CustomEvent("growdash:open-agent-chat", { detail: { role: node.chatRole } }));
  return <aside className="growdash-core-panel" aria-label={`Inteligência de ${node.label}`}>
    <header className="growdash-core-panel-header"><div className="growdash-core-agent-heading"><span className="growdash-core-agent-avatar" style={{ "--agent-color": node.agentColor } as React.CSSProperties}><Bot className="h-4 w-4" /></span><div><span className="growdash-core-kicker">AGENTE · {node.label.toUpperCase()}</span><h2>{node.agentName}</h2><p>{node.agentRole} · {node.note}</p></div></div><button type="button" onClick={onClose} aria-label="Fechar análise da área"><X className="h-4 w-4" /></button></header>
    <div className="growdash-core-agent-actions"><span><i style={{ background: node.agentColor }} /> Dados Growdash conectados</span><button type="button" onClick={openChat}><MessageCircle className="h-3.5 w-3.5" /> Conversar</button><Link to="/integracoes" className="growdash-core-api-link"><Zap className="h-3.5 w-3.5" /> Conexões e APIs</Link></div>
    <div className="growdash-core-strategies" role="tablist" aria-label={`Estratégias de ${node.label}`}>
      {node.strategies.map(([label, id]) => <button type="button" key={id} role="tab" aria-selected={selectedStrategy === label} onClick={() => onSelectStrategy(id)} className={cn(selectedStrategy === label && "is-active")}><span>{label}</span><ChevronRight className="h-3 w-3" /></button>)}
    </div>
    <div className="growdash-core-panel-body">
      <div className="growdash-core-document"><span>Contexto</span><p>{node.document}</p><span>Decisão para escala</span><p>{node.decision}</p></div>
      <div className="growdash-core-panel-intro"><Radar className="h-4 w-4" /><span>{loading ? "Sincronizando sinais reais das contas…" : `Leitura atual · ${selectedStrategy}`}</span></div>
      {loading ? <div className="growdash-core-loading" aria-live="polite"><i /><i /><i /></div> : summaries.length ? <div className="growdash-core-account-list">{summaries.map((summary) => <article key={summary.id} className="growdash-core-account-card"><div className="growdash-core-account-heading"><div><b>{summary.name}</b><small>{summary.strategy}</small></div><span className={`is-${summary.health}`}>{summary.health === "healthy" ? "Em rota" : summary.health === "attention" ? "Atenção" : summary.health === "critical" ? "Risco" : "Sem dados"}</span></div><div className="growdash-core-metrics">{getAreaMetrics(node.id, summary).map((metric) => <div key={metric.label}><small>{metric.label}</small><b>{metric.value}</b></div>)}</div><p>{summary.strategyDetail}</p></article>)}</div> : <div className="growdash-core-empty"><Network className="h-5 w-5" /><p>Nenhuma conta acessível para esta área.</p></div>}
    </div>
  </aside>;
}

function getAreaMetrics(area: CoreAreaId, summary: ReturnType<typeof buildCoreAccountSummaries>[number]) {
  const integer = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
  const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
  if (area === "strategy") return [{ label: "Receita", value: money(summary.revenue) }, { label: "Mídia", value: money(summary.spend) }, { label: "Negócios", value: integer.format(summary.deals) }, { label: "ROAS", value: summary.roas ? `${summary.roas.toFixed(2).replace(".", ",")}x` : "—" }];
  if (area === "research") return [{ label: "Campanha líder", value: summary.topCampaign || "Sem dados" }, { label: "Impressões", value: integer.format(summary.impressions) }, { label: "CTR", value: summary.ctr ? `${summary.ctr.toFixed(2).replace(".", ",")}%` : "—" }, { label: "Objetivo", value: summary.topObjective || "Sem leitura" }];
  if (area === "traffic") return [{ label: "Investimento", value: money(summary.spend) }, { label: "Leads", value: integer.format(summary.leads) }, { label: "CPL", value: summary.cpl ? money(summary.cpl) : "—" }, { label: "Campanhas ativas", value: integer.format(summary.activeCampaigns) }];
  if (area === "creative") return [{ label: "CTR", value: summary.ctr ? `${summary.ctr.toFixed(2).replace(".", ",")}%` : "—" }, { label: "Alcance", value: integer.format(summary.reach) }, { label: "Cliques", value: integer.format(summary.clicks) }, { label: "Campanha", value: summary.topCampaign || "Sem dados" }];
  if (area === "social") return [{ label: "Alcance", value: integer.format(summary.reach) }, { label: "Impressões", value: integer.format(summary.impressions) }, { label: "Cliques", value: integer.format(summary.clicks) }, { label: "CTR", value: summary.ctr ? `${summary.ctr.toFixed(2).replace(".", ",")}%` : "—" }];
  if (area === "crm" || area === "sales") return [{ label: "Negócios", value: integer.format(summary.deals) }, { label: "Ganhos", value: integer.format(summary.wonDeals) }, { label: "Pipeline", value: money(summary.pipeline) }, { label: "Ticket", value: summary.ticket ? money(summary.ticket) : "—" }];
  if (area === "commercial") return [{ label: "Receita", value: money(summary.revenue) }, { label: "Vendas", value: integer.format(summary.sales) }, { label: "Ticket médio", value: summary.ticket ? money(summary.ticket) : "—" }, { label: "Melhor vendedor", value: summary.topSeller || "Sem atribuição" }];
  if (area === "analytics") return [{ label: "Leads", value: integer.format(summary.leads) }, { label: "Negócios", value: integer.format(summary.deals) }, { label: "Receita", value: money(summary.revenue) }, { label: "ROAS", value: summary.roas ? `${summary.roas.toFixed(2).replace(".", ",")}x` : "—" }];
  if (area === "finance") return [{ label: "Receita", value: money(summary.revenue) }, { label: "Mídia", value: money(summary.spend) }, { label: "Resultado", value: money(summary.revenue - summary.spend) }, { label: "ROAS", value: summary.roas ? `${summary.roas.toFixed(2).replace(".", ",")}x` : "—" }];
  if (area === "brand") return [{ label: "Impressões", value: integer.format(summary.impressions) }, { label: "Alcance", value: integer.format(summary.reach) }, { label: "CTR", value: summary.ctr ? `${summary.ctr.toFixed(2).replace(".", ",")}%` : "—" }, { label: "Campanha líder", value: summary.topCampaign || "Sem dados" }];
  if (area === "legal") return [{ label: "Contas", value: summary.spend || summary.revenue ? "Com dados" : "Sem dados" }, { label: "Permissões", value: "Revisão" }, { label: "LGPD", value: "Monitorada" }, { label: "Ação externa", value: "Aprovação" }];
  if (area === "inbox") return [{ label: "Negócios", value: integer.format(summary.deals) }, { label: "Ganhos", value: integer.format(summary.wonDeals) }, { label: "Pipeline", value: money(summary.pipeline) }, { label: "Próxima ação", value: summary.deals > 0 ? "Encaminhar" : "Aguardando" }];
  return [{ label: "Rotinas", value: integer.format(summary.schedules) }, { label: "Ativas", value: integer.format(summary.activeSchedules) }, { label: "Última estratégia", value: summary.strategy }, { label: "Execução", value: summary.activeSchedules > 0 ? "Monitorada" : "Pendente" }];
}

function StatusLegend({ color, label }: { color: string; label: string }) { return <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1"><i className={cn("h-2 w-2 rounded-full", color)} />{label}</span>; }
function AgentModeButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) { return <button type="button" onClick={onClick} className={cn("flex min-w-0 items-center justify-center gap-1 rounded-lg border px-2 py-2 text-[9px] font-bold", active ? "border-primary/60 bg-primary/15 text-primary" : "border-white/10 text-white/45 hover:bg-white/5")}><span className="[&>svg]:h-3 [&>svg]:w-3">{icon}</span>{label}</button>; }
