import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Bot,
  BriefcaseBusiness,
  Coffee,
  ChevronRight,
  Cpu,
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
import { NavLink } from "react-router-dom";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useInsights } from "@/hooks/useInsights";
import { useRDDealsForPeriod } from "@/hooks/useRDDealsForPeriod";
import { aggregateSales, useSales } from "@/hooks/useSales";
import { buildAgentAnswer, type AgentMetrics } from "@/lib/agentOffice";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AgentStatus = "working" | "walking" | "free";
type ChatMessage = { id: string; role: "agent" | "user"; text: string };

const AGENTS = [
  { id: "atlas", name: "Atlas", role: "Gestor de tráfego", specialty: "Mídia & escala", task: "Otimizando campanhas", color: "#e9b72d", desk: "station-traffic", position: "npc-atlas" },
  { id: "fina", name: "Fina", role: "Gestora financeira", specialty: "Caixa & margem", task: "Conciliando receita", color: "#34d399", desk: "station-finance", position: "npc-fina" },
  { id: "dora", name: "Dora", role: "Gestora comercial", specialty: "Vendas & CRM", task: "Revisando pipeline", color: "#fb7185", desk: "station-sales", position: "npc-dora" },
  { id: "otto", name: "Otto", role: "Especialista SEO", specialty: "Busca & conteúdo", task: "Mapeando oportunidades", color: "#38bdf8", desk: "station-seo", position: "npc-otto" },
  { id: "nina", name: "Nina", role: "Analista de funil", specialty: "Jornadas & conversão", task: "Investigando gargalos", color: "#a78bfa", desk: "station-funnel", position: "npc-nina" },
  { id: "milo", name: "Milo", role: "Diretor de criativos", specialty: "Criativos & testes", task: "Avaliando criativos", color: "#f97316", desk: "station-creative", position: "npc-milo" },
] as const;

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
  const [view, setView] = useState<"map" | "office">("map");
  const [officeAngle, setOfficeAngle] = useState(0);
  const officeDragStart = useRef<number | null>(null);
  const officeAngleStart = useRef(0);
  const [minimized, setMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [statuses, setStatuses] = useState<Record<string, AgentStatus>>(() => readStored("growdash:agent-statuses", Object.fromEntries(AGENTS.map((agent) => [agent.id, "working"]))));
  const [assignments, setAssignments] = useState<Record<string, string>>(() => readStored("growdash:agent-accounts", {}));
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>(() => Object.fromEntries(AGENTS.map((agent) => [agent.id, [{ id: `${agent.id}-welcome`, role: "agent", text: `Olá, eu sou ${agent.name}. Vincule uma conta e pergunte sobre tráfego, leads, funil ou escala.` }]])));
  const activeAgent = AGENTS.find((agent) => agent.id === activeAgentId) || null;
  const activeAccountId = activeAgent ? assignments[activeAgent.id] : undefined;
  const account = visibleAccounts.find((item) => item.id === activeAccountId);
  const { data: insights = [], isFetching: loadingInsights } = useInsights({ adAccountId: activeAccountId, startDate, endDate, enabled: !!activeAccountId });
  const { data: deals = [], isFetching: loadingDeals } = useRDDealsForPeriod({ adAccountId: activeAccountId, startDate, endDate, enabled: !!activeAccountId });
  const { data: sales = [] } = useSales({ adAccountId: activeAccountId, startDate, endDate, enabled: !!activeAccountId });

  useEffect(() => { localStorage.setItem("growdash:agent-statuses", JSON.stringify(statuses)); }, [statuses]);
  useEffect(() => { localStorage.setItem("growdash:agent-accounts", JSON.stringify(assignments)); }, [assignments]);

  const metrics = useMemo<AgentMetrics>(() => {
    const media = insights.reduce((total, row) => ({
      spend: total.spend + Number(row.spend || 0),
      impressions: total.impressions + Number(row.impressions || 0),
      reach: total.reach + Number(row.reach || 0),
      clicks: total.clicks + Number(row.clicks || 0),
      leads: total.leads + Number(row.leads || 0),
    }), { spend: 0, impressions: 0, reach: 0, clicks: 0, leads: 0 });
    const confirmed = aggregateSales(sales);
    return {
      ...media,
      rdLeads: deals.length,
      wonDeals: confirmed.totalQuantity,
      revenue: confirmed.totalNet,
    };
  }, [deals, insights, sales]);

  const updateStatus = (agentId: string, status: AgentStatus) => setStatuses((current) => ({ ...current, [agentId]: status }));
  const openAgent = (agentId: string) => { setActiveAgentId(agentId); setMinimized(false); };
  const sendMessage = () => {
    if (!activeAgent || !input.trim()) return;
    const question = input.trim();
    const period = `${format(startDate, "dd/MM/yyyy")} a ${format(endDate, "dd/MM/yyyy")}`;
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
      <header className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div><span className="text-[10px] font-black uppercase tracking-[.2em] text-primary">Growdash Intelligence Core</span><h1 className="mt-1 text-2xl font-black">Conhecimento & Agentes</h1><p className="mt-1 text-xs text-muted-foreground">Navegue pela inteligência da operação ou entre no escritório 3D dos agentes.</p></div>
        <div className="flex flex-wrap items-center gap-2 text-[10px]"><button type="button" onClick={() => setView("map")} className={cn("rounded-lg border px-3 py-2 font-black", view === "map" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}><Network className="mr-1 inline h-3.5 w-3.5" />Mapa</button><button type="button" onClick={() => setView("office")} className={cn("rounded-lg border px-3 py-2 font-black", view === "office" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}><BriefcaseBusiness className="mr-1 inline h-3.5 w-3.5" />Escritório 3D</button>{view === "office" && <><StatusLegend color="bg-emerald-500" label="Trabalhando" /><StatusLegend color="bg-sky-400" label="Caminhando" /><StatusLegend color="bg-amber-400" label="Tempo livre" /></>}</div>
      </header>

      {view === "map" ? <KnowledgeMap onOpenOffice={() => setView("office")} /> : <div className="agent-office-shell office-3d-stage relative min-h-[660px] overflow-hidden rounded-2xl border border-primary/20 bg-[#070706] shadow-2xl">
        <div className="office-sim-topbar">
          <div className="office-sim-brand"><span className="office-sim-brand-mark"><Bot className="h-3.5 w-3.5" /></span><span><b>GROWDASH HQ</b><small>AGENT OPERATIONS</small></span></div>
          <div className="office-sim-presence" aria-label="Agentes presentes no escritório">
            {AGENTS.map((agent) => <button key={agent.id} type="button" onClick={() => openAgent(agent.id)} className={cn("office-presence-agent", `is-${statuses[agent.id] || "working"}`)} style={{ "--agent-color": agent.color } as React.CSSProperties}><span className="office-presence-avatar"><Bot className="h-3 w-3" /></span><span><b>{agent.name}</b><small>{statuses[agent.id] === "working" ? "online" : statuses[agent.id] === "walking" ? "andando" : "livre"}</small></span><i /></button>)}
          </div>
          <div className="office-sim-live"><span className="office-live-dot" /><span><b>Operação ao vivo</b><small>6 agentes conectados</small></span><button type="button" onClick={() => updateStatus("atlas", "walking")} aria-label="Abrir standup da equipe">STANDUP BOARD</button></div>
        </div>
        <aside className="office-sim-rail" aria-label="Navegação do escritório">
          <span className="office-rail-logo"><Sparkles className="h-4 w-4" /></span>
          <button type="button" className="is-active" aria-label="Escritório"><BriefcaseBusiness className="h-4 w-4" /></button>
          <button type="button" onClick={() => setView("map")} aria-label="Mapa de inteligência"><Network className="h-4 w-4" /></button>
          <button type="button" onClick={() => openAgent(activeAgentId || AGENTS[0].id)} aria-label="Chat dos agentes"><MessageCircle className="h-4 w-4" /></button>
          <button type="button" onClick={() => updateStatus("atlas", "working")} aria-label="Ativar operação"><Activity className="h-4 w-4" /></button>
          <span className="office-rail-spacer" />
          <button type="button" onClick={() => setOfficeAngle(0)} aria-label="Recentrar escritório"><RotateCcw className="h-4 w-4" /></button>
        </aside>
        <div className="office-viewport-toolbar" role="toolbar" aria-label="Controles da câmera do escritório">
          <span className="office-viewport-title"><Rotate3D className="h-3.5 w-3.5" />ESCRITÓRIO 360°</span>
          <span className="office-viewport-hint">Arraste a visão ou use as setas para orbitar</span>
          <div className="office-camera-buttons"><button type="button" onClick={() => setOfficeAngle((value) => Math.max(-28, value - 8))} aria-label="Orbitar para a esquerda"><ArrowLeft className="h-3.5 w-3.5" /></button><button type="button" onClick={() => setOfficeAngle(0)} aria-label="Centralizar câmera"><RotateCcw className="h-3.5 w-3.5" /></button><button type="button" onClick={() => setOfficeAngle((value) => Math.min(28, value + 8))} aria-label="Orbitar para a direita"><ArrowRight className="h-3.5 w-3.5" /></button></div>
        </div>
        <div className="office-3d-world" style={{ "--office-angle": `${officeAngle}deg` } as React.CSSProperties} onPointerDown={(event) => { if ((event.target as HTMLElement).closest("button")) return; officeDragStart.current = event.clientX; officeAngleStart.current = officeAngle; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (officeDragStart.current === null) return; setOfficeAngle(Math.max(-28, Math.min(28, officeAngleStart.current + (event.clientX - officeDragStart.current) / 9))); }} onPointerUp={() => { officeDragStart.current = null; }} onPointerCancel={() => { officeDragStart.current = null; }}>
          <div className="office-room-shell" aria-hidden="true"><span className="room-wall room-wall-back" /><span className="room-wall room-wall-left" /><span className="room-wall room-wall-right" /><span className="room-door room-door-main" /><span className="room-window-strip" /></div>
          <div className="office-zone zone-war"><b>WAR ROOM</b><small>Planejamento</small></div><div className="office-zone zone-lounge"><b>LOUNGE</b><small>Tempo livre</small></div><div className="office-zone zone-focus"><b>FOCUS PODS</b><small>Execução</small></div>
          <div className="office-window"><span /><span /><span /></div>
          <div className="office-wall-sign"><WandSparkles className="h-4 w-4" /> GROWDASH INTELLIGENCE</div>
          <div className="office-floor-grid" />
          <div className="office-rug"><Bot className="h-8 w-8" /><span>AI<br />HUB</span></div>
          <div className="office-plant plant-a"><i /><b /></div><div className="office-plant plant-b"><i /><b /></div>
          <div className="office-room-label room-label-lounge"><Coffee className="h-3 w-3" /> Lounge</div><div className="office-room-label room-label-war"><Sparkles className="h-3 w-3" /> War room</div>
          {AGENTS.map((agent) => <div key={agent.id} className={cn("office-desk", agent.desk)}><span className="office-monitor"><Activity /></span><span className="office-keyboard" /><small>{agent.specialty}</small></div>)}
          <div className="office-lounge"><Coffee className="h-5 w-5" /><span>PAUSA</span></div>
          <div className="office-whiteboard"><b>OPERATIONAL BOARD</b><span>Prioridades · alertas · próximos passos</span><i /><i /><i /></div>

          {AGENTS.map((agent, index) => {
            const status = statuses[agent.id] || "working";
            const assigned = visibleAccounts.find((item) => item.id === assignments[agent.id]);
            return (
              <button key={agent.id} type="button" onClick={() => openAgent(agent.id)} className={cn("office-npc office-3d-npc", agent.position, `is-${status}`)} style={{ "--agent-color": agent.color, "--npc-delay": `${index * -0.7}s` } as React.CSSProperties} aria-label={`Abrir estação de ${agent.name}, ${agent.role}`}>
                <span className="npc-shadow" /><span className="npc-body"><i className="npc-head" /><i className="npc-hair" /><i className="npc-shirt" /><i className="npc-arm npc-arm-left" /><i className="npc-arm npc-arm-right" /><i className="npc-legs" /></span>
                <span className="npc-plumbob" /><span className="npc-task-light" />
                <span className="npc-label"><b>{agent.name}</b><small>{assigned?.name || agent.role}</small><em>{status === "working" ? agent.task : status === "walking" ? "Em movimento" : "Tempo livre"}</em></span>
              </button>
            );
          })}
        </div>

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
                {(loadingInsights || loadingDeals) && activeAccountId && <div className="agent-message is-agent animate-pulse">Atualizando dados da conta em segundo plano…</div>}
              </div>
              <div className="border-t border-white/10 p-3">
                <div className="mb-2 flex gap-1 overflow-x-auto growdash-scrollbar-hidden">{["Leads e CPL", "CTR e criativos", "Vendas e ROAS"].map((suggestion) => <button key={suggestion} type="button" onClick={() => setInput(suggestion)} className="shrink-0 rounded-full border border-white/10 px-2 py-1 text-[9px] text-white/55 hover:border-primary/50 hover:text-primary">{suggestion}</button>)}</div>
                <div className="flex gap-2"><input aria-label={`Perguntar ao agente ${activeAgent.name}`} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") sendMessage(); }} placeholder="Pergunte sobre esta conta…" className="h-10 min-w-0 grow rounded-xl border border-white/15 bg-black/50 px-3 text-xs text-white outline-none placeholder:text-white/25 focus:border-primary/55" /><button type="button" onClick={sendMessage} className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground" aria-label="Enviar pergunta"><Send className="h-4 w-4" /></button></div>
              </div>
            </>}
          </aside>
        )}
      </div>}
    </div>
  );
}

const KNOWLEDGE_NODES = [
  { label: "Tráfego", note: "Mídia, criativos, orçamento e escala", href: "/campanhas", angle: -90, branches: [["Estratégias de mídia", "/campanhas"], ["Criativos & testes", "/campanhas"], ["Alertas de performance", "/saude-dos-dados"]] },
  { label: "CRM", note: "Pipeline, qualificação e follow-up", href: "/crm", angle: -28, branches: [["Pipeline & etapas", "/crm"], ["Scripts de vendas", "/comercial"], ["Follow-ups", "/automacoes"]] },
  { label: "Comercial", note: "Metas, conversão e receita", href: "/comercial", angle: 28, branches: [["Metas e ranking", "/comercial"], ["Playbook de vendas", "/comercial"], ["Forecast", "/centro-inteligencia"]] },
  { label: "Financeiro", note: "Caixa, margem e previsibilidade", href: "/financeiro", angle: 90, branches: [["DRE & caixa", "/financeiro"], ["Margem e custos", "/financeiro"], ["Planejamento", "/centro-inteligencia"]] },
  { label: "Marca", note: "Posicionamento, conteúdo e confiança", href: "/marcas", angle: 152, branches: [["Posicionamento", "/marcas"], ["Conteúdo estratégico", "/marcas"], ["Reputação", "/marcas"]] },
  { label: "Automações", note: "Playbooks, WhatsApp e operações", href: "/automacoes", angle: 208, branches: [["Playbooks", "/automacoes"], ["WhatsApp", "/automacoes"], ["Webhooks & rotinas", "/automacoes"]] },
] as const;

const NEURAL_POINTS = Array.from({ length: 38 }, (_, index) => ({
  id: index,
  x: 4 + ((index * 37) % 92),
  y: 5 + ((index * 53) % 88),
  size: 2 + (index % 4),
  delay: -((index * 0.31) % 4.8),
  duration: 3.2 + ((index * 7) % 18) / 10,
  depth: (index % 5) + 1,
}));

const NEURAL_LINKS = Array.from({ length: 42 }, (_, index) => {
  const from = index % NEURAL_POINTS.length;
  const to = (index * 7 + 11) % NEURAL_POINTS.length;
  return [from, to] as const;
});

const BRAIN_CIRCUITS = [
  "M80 124 H126 V91 H176 V67",
  "M61 169 H113 V143 H161 V112 H194",
  "M74 221 H119 V194 H165 V166 H202",
  "M101 266 V238 H151 V214 H196",
  "M340 124 H294 V91 H244 V67",
  "M359 169 H307 V143 H259 V112 H226",
  "M346 221 H301 V194 H255 V166 H218",
  "M319 266 V238 H269 V214 H224",
  "M132 61 V83 H158",
  "M288 61 V83 H262",
  "M112 286 H153 V260 H193",
  "M308 286 H267 V260 H227",
] as const;

const BRAIN_NODES = [
  [80, 124], [126, 91], [176, 67], [61, 169], [113, 143], [161, 112], [74, 221], [119, 194], [165, 166], [101, 266], [151, 238], [196, 214],
  [340, 124], [294, 91], [244, 67], [359, 169], [307, 143], [259, 112], [346, 221], [301, 194], [255, 166], [319, 266], [269, 238], [224, 214],
] as const;

type CorePhase = "brain" | "entering" | "core";

function KnowledgeMap({ onOpenOffice }: { onOpenOffice: () => void }) {
  const [phase, setPhase] = useState<CorePhase>("brain");
  const transitionTimer = useRef<number | null>(null);
  const stageRef = useRef<HTMLElement | null>(null);
  const isCoreOpen = phase === "core";

  useEffect(() => () => {
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
  }, []);

  const enterCore = () => {
    if (phase !== "brain") return;
    setPhase("entering");
    transitionTimer.current = window.setTimeout(() => setPhase("core"), 1380);
  };

  const resetCore = () => {
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
    transitionTimer.current = null;
    setPhase("brain");
  };

  const updateParallax = (event: React.PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - .5) * 2));
    const y = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - .5) * 2));
    event.currentTarget.style.setProperty("--jarvis-bg-x", `${(x * 28).toFixed(2)}px`);
    event.currentTarget.style.setProperty("--jarvis-bg-y", `${(y * 18).toFixed(2)}px`);
    event.currentTarget.style.setProperty("--jarvis-grid-x", `${(x * -10).toFixed(2)}px`);
    event.currentTarget.style.setProperty("--jarvis-grid-y", `${(y * -8).toFixed(2)}px`);
    event.currentTarget.style.setProperty("--jarvis-field-x", `${(x * 12).toFixed(2)}px`);
    event.currentTarget.style.setProperty("--jarvis-field-y", `${(y * 9).toFixed(2)}px`);
    event.currentTarget.style.setProperty("--jarvis-brain-x", `${(x * 7).toFixed(2)}px`);
    event.currentTarget.style.setProperty("--jarvis-brain-y", `${(y * 5).toFixed(2)}px`);
    event.currentTarget.style.setProperty("--jarvis-point-x", `${(x * 8).toFixed(2)}px`);
    event.currentTarget.style.setProperty("--jarvis-point-y", `${(y * 8 - 10).toFixed(2)}px`);
  };

  const resetParallax = () => {
    ["--jarvis-bg-x", "--jarvis-bg-y", "--jarvis-grid-x", "--jarvis-grid-y", "--jarvis-field-x", "--jarvis-field-y", "--jarvis-brain-x", "--jarvis-brain-y", "--jarvis-point-x", "--jarvis-point-y"].forEach((property) => stageRef.current?.style.setProperty(property, "0px"));
  };

  return <section ref={stageRef} className={cn("jarvis-command-center", `is-${phase}`)} aria-label="Núcleo de inteligência Growdash" onPointerMove={updateParallax} onPointerLeave={resetParallax}>
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

    {isCoreOpen && <svg className="jarvis-links" viewBox="0 0 1000 760" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="jarvis-link" x1="0" x2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".12" /><stop offset=".5" stopColor="currentColor" stopOpacity=".95" /><stop offset="1" stopColor="currentColor" stopOpacity=".16" /></linearGradient></defs>
      {KNOWLEDGE_NODES.map((node, index) => { const radians = node.angle * Math.PI / 180; const x = 500 + Math.cos(radians) * 335; const y = 380 + Math.sin(radians) * 285; const controlX = 500 + Math.cos(radians) * 170 + Math.sin(radians) * (index % 2 === 0 ? 34 : -34); const controlY = 380 + Math.sin(radians) * 145; return <g key={node.label} style={{ "--link-delay": `${index * -.28}s` } as React.CSSProperties}><path d={`M 500 380 Q ${controlX} ${controlY} ${x} ${y}`} stroke="url(#jarvis-link)" strokeWidth="2" strokeDasharray="7 11" fill="none" /><circle cx={x} cy={y} r="6" fill="currentColor" /><circle className="jarvis-node-halo" cx={x} cy={y} r="15" fill="none" stroke="currentColor" /></g>; })}
    </svg>}

    <button type="button" onClick={enterCore} className="jarvis-brain" aria-label={isCoreOpen ? "Núcleo Growdash expandido" : "Entrar no núcleo Growdash"} aria-expanded={isCoreOpen} disabled={phase === "entering"}>
      <span className="jarvis-brain-aura" />
      <span className="jarvis-orbit orbit-one" /><span className="jarvis-orbit orbit-two" /><span className="jarvis-orbit orbit-three" />
      <svg className="jarvis-cortex" viewBox="0 0 420 360" role="img" aria-label="Cérebro eletrônico Growdash">
        <defs>
          <linearGradient id="cortex-metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--brand-gold-light)" /><stop offset=".42" stopColor="var(--brand-gold)" /><stop offset="1" stopColor="var(--brand-bronze)" /></linearGradient>
          <filter id="cortex-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <path className="jarvis-cortex-lobe" d="M204 45C163 24 116 39 95 73C55 79 41 119 55 151C31 181 45 225 76 240C72 276 109 302 143 291C158 322 197 318 210 288V69C210 56 208 50 204 45Z" />
        <path className="jarvis-cortex-lobe" d="M216 45C257 24 304 39 325 73C365 79 379 119 365 151C389 181 375 225 344 240C348 276 311 302 277 291C262 322 223 318 210 288V69C210 56 212 50 216 45Z" />
        <path className="jarvis-cortex-midline" d="M210 65V291M180 300C190 327 184 342 170 354M240 300C230 327 236 342 250 354" />
        {BRAIN_CIRCUITS.map((path, index) => <path key={path} className="jarvis-circuit-trace" d={path} style={{ "--circuit-delay": `${index * -.17}s` } as React.CSSProperties} />)}
        <rect className="jarvis-cortex-chip" x="184" y="130" width="52" height="72" rx="8" />
        <path className="jarvis-cortex-chip-lines" d="M194 143H226M194 155H226M194 167H226M194 179H226M174 143H184M174 160H184M174 177H184M236 143H246M236 160H246M236 177H246" />
        {BRAIN_NODES.map(([x, y], index) => <circle key={`${x}-${y}`} className="jarvis-cortex-node" cx={x} cy={y} r={index % 3 === 0 ? 5 : 3.5} style={{ "--node-delay": `${index * -.11}s` } as React.CSSProperties} />)}
      </svg>
      <span className="jarvis-energy-core"><Cpu /><i /></span>
      <span className="jarvis-brain-copy"><BrainCircuit className="h-7 w-7" /><b>JARVIS</b><small>{phase === "entering" ? "Sincronizando conexões…" : "Clique para entrar no núcleo"}</small></span>
    </button>

    {isCoreOpen && <>
      <div className="jarvis-core-label" aria-live="polite"><i className="brand-mark-tint jarvis-core-mark" /><span>GROWDASH</span><b>OPERATIONAL CORE</b><small>Inteligência conectada de ponta a ponta</small><em><Radar />Grafo vivo · {KNOWLEDGE_NODES.length} áreas · {KNOWLEDGE_NODES.reduce((total, node) => total + node.branches.length, 0)} estratégias</em></div>
      {KNOWLEDGE_NODES.map((node, index) => {
        const radians = node.angle * Math.PI / 180;
        return <article key={node.label} className="jarvis-arm" style={{ left: `${50 + Math.cos(radians) * 35}%`, top: `${50 + Math.sin(radians) * 37.5}%`, "--arm-delay": `${index * 70}ms` } as React.CSSProperties}>
          <NavLink to={node.href} className="jarvis-arm-head"><span><Zap className="h-4 w-4" /></span><div><b>{node.label}</b><small>{node.note}</small></div><ChevronRight className="h-4 w-4" /></NavLink>
          <div className="jarvis-branches" aria-label={`Estratégias de ${node.label}`}>
            {node.branches.map(([label, href]) => <NavLink key={label} to={href} className="jarvis-branch"><i /><span>{label}</span></NavLink>)}
          </div>
        </article>;
      })}
      <div className="jarvis-actions"><button type="button" onClick={resetCore}><RotateCcw className="h-3.5 w-3.5" />Visão do cérebro</button><button type="button" onClick={onOpenOffice}><BriefcaseBusiness className="h-3.5 w-3.5" />Entrar no escritório 3D</button></div>
    </>}

    {!isCoreOpen && <div className="jarvis-intro"><b>Central de comando autônoma</b><span>Entre no cérebro operacional para navegar pelas áreas, conexões e estratégias da Growdash.</span><small><Sparkles />Experiência neural interativa</small></div>}
  </section>;
}

function StatusLegend({ color, label }: { color: string; label: string }) { return <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1"><i className={cn("h-2 w-2 rounded-full", color)} />{label}</span>; }
function AgentModeButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) { return <button type="button" onClick={onClick} className={cn("flex min-w-0 items-center justify-center gap-1 rounded-lg border px-2 py-2 text-[9px] font-bold", active ? "border-primary/60 bg-primary/15 text-primary" : "border-white/10 text-white/45 hover:bg-white/5")}><span className="[&>svg]:h-3 [&>svg]:w-3">{icon}</span>{label}</button>; }
