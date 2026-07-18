import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Activity,
  Bot,
  BriefcaseBusiness,
  Coffee,
  MessageCircle,
  Minimize2,
  Send,
  Sparkles,
  UserCog,
  UsersRound,
  WandSparkles,
  X,
} from "lucide-react";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useInsights } from "@/hooks/useInsights";
import { useRDDealsForPeriod } from "@/hooks/useRDDealsForPeriod";
import { buildAgentAnswer, type AgentMetrics } from "@/lib/agentOffice";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AgentStatus = "working" | "walking" | "free";
type ChatMessage = { id: string; role: "agent" | "user"; text: string };

const AGENTS = [
  { id: "atlas", name: "Atlas", role: "Gestor de tráfego", color: "#e9b72d", desk: "desk-a", position: "npc-a" },
  { id: "nina", name: "Nina", role: "Analista de funil", color: "#38bdf8", desk: "desk-b", position: "npc-b" },
  { id: "milo", name: "Milo", role: "Especialista em criativos", color: "#a78bfa", desk: "desk-c", position: "npc-c" },
  { id: "luna", name: "Luna", role: "Revenue & CRM", color: "#34d399", desk: "desk-d", position: "npc-d" },
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
    return {
      ...media,
      rdLeads: deals.length,
      wonDeals: deals.filter((deal) => deal.win).length,
      revenue: deals.filter((deal) => deal.win).reduce((sum, deal) => sum + Number(deal.amount_total || 0), 0),
    };
  }, [deals, insights]);

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
        <div><span className="text-[10px] font-black uppercase tracking-[.2em] text-primary">Growdash AI Office</span><h1 className="mt-1 text-2xl font-black">Escritório dos Agentes</h1><p className="mt-1 text-xs text-muted-foreground">Agentes por conta, dados reais de Meta Ads e RD Station e recomendações acionáveis.</p></div>
        <div className="flex flex-wrap gap-2 text-[10px]"><StatusLegend color="bg-emerald-500" label="Trabalhando" /><StatusLegend color="bg-sky-400" label="Caminhando" /><StatusLegend color="bg-amber-400" label="Tempo livre" /></div>
      </header>

      <div className="agent-office-shell relative min-h-[660px] overflow-hidden rounded-2xl border border-primary/20 bg-[#070706] shadow-2xl">
        <div className="office-window"><span /><span /><span /></div>
        <div className="office-wall-sign"><WandSparkles className="h-4 w-4" /> GROWDASH INTELLIGENCE</div>
        <div className="office-floor-grid" />
        <div className="office-rug"><Bot className="h-8 w-8" /><span>AI<br />HUB</span></div>
        <div className="office-plant plant-a"><i /><b /></div><div className="office-plant plant-b"><i /><b /></div>
        {AGENTS.map((agent) => <div key={agent.id} className={cn("office-desk", agent.desk)}><span className="office-monitor"><Activity /></span><span className="office-keyboard" /></div>)}

        {AGENTS.map((agent) => {
          const status = statuses[agent.id] || "working";
          const assigned = visibleAccounts.find((item) => item.id === assignments[agent.id]);
          return (
            <button key={agent.id} type="button" onClick={() => openAgent(agent.id)} className={cn("office-npc", agent.position, `is-${status}`)} style={{ "--agent-color": agent.color } as React.CSSProperties} aria-label={`Conversar com ${agent.name}`}>
              <span className="npc-shadow" /><span className="npc-body"><i className="npc-head" /><i className="npc-shirt" /><i className="npc-legs" /></span>
              <span className="npc-plumbob" />
              <span className="npc-label"><b>{agent.name}</b><small>{assigned?.name || agent.role}</small></span>
            </button>
          );
        })}

        <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/65 p-2 backdrop-blur-xl">
          {AGENTS.map((agent) => <button key={agent.id} type="button" onClick={() => openAgent(agent.id)} className="flex min-w-[150px] flex-1 items-center gap-2 rounded-lg px-3 py-2 text-left text-white transition hover:bg-white/10"><span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `${agent.color}22`, color: agent.color }}><Bot className="h-4 w-4" /></span><span className="min-w-0"><b className="block truncate text-xs">{agent.name}</b><small className="block truncate text-[9px] text-white/45">{statuses[agent.id] === "working" ? "Trabalhando" : statuses[agent.id] === "walking" ? "Caminhando" : "Tempo livre"}</small></span></button>)}
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
                <div className="flex gap-2"><input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") sendMessage(); }} placeholder="Pergunte sobre esta conta…" className="h-10 min-w-0 grow rounded-xl border border-white/15 bg-black/50 px-3 text-xs text-white outline-none placeholder:text-white/25 focus:border-primary/55" /><button type="button" onClick={sendMessage} className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground" aria-label="Enviar pergunta"><Send className="h-4 w-4" /></button></div>
              </div>
            </>}
          </aside>
        )}
      </div>
    </div>
  );
}

function StatusLegend({ color, label }: { color: string; label: string }) { return <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1"><i className={cn("h-2 w-2 rounded-full", color)} />{label}</span>; }
function AgentModeButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) { return <button type="button" onClick={onClick} className={cn("flex min-w-0 items-center justify-center gap-1 rounded-lg border px-2 py-2 text-[9px] font-bold", active ? "border-primary/60 bg-primary/15 text-primary" : "border-white/10 text-white/45 hover:bg-white/5")}><span className="[&>svg]:h-3 [&>svg]:w-3">{icon}</span>{label}</button>; }

