import { useEffect, useMemo, useState } from "react";
import { Bot, ChevronDown, MessageCircle, Send, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { cn } from "@/lib/utils";
import { businessDateKey } from "@/lib/businessDate";

type DirectorRole = "ceo" | "marketing" | "commercial" | "finance" | "legal";
const FALLBACK = [
  ["ceo", "CEO · Chief of Staff"], ["marketing", "Gestor de Marketing"], ["commercial", "Diretor Comercial"],
  ["finance", "CFO"], ["legal", "Advogado"],
] as const;
type ChatMessage = { id: string; role: "user" | "agent" | "system"; content: string; created_at?: string; sources?: Array<{ label: string }> };

export function AgentChatDock() {
  const { data: workspace } = useWorkspace();
  const { adAccountIds, funnelIds, startDate, endDate } = useGlobalFilters();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<DirectorRole>("ceo");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const agentsQuery = useQuery({
    queryKey: ["agent-office-directors", workspace?.id],
    enabled: !!workspace?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("agent_office_agents").select("id,role,name,runtime_status").eq("workspace_id", workspace!.id).eq("is_visible", true).order("role");
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });
  const directors = useMemo(() => (agentsQuery.data?.length ? agentsQuery.data : FALLBACK.map(([agentRole, name]) => ({ id: agentRole, role: agentRole, name, runtime_status: "idle" }))), [agentsQuery.data]);
  const active = directors.find((agent) => agent.role === role) || directors[0];

  useEffect(() => {
    let cancelled = false;
    const loadHistory = async () => {
      if (!workspace?.id || !active?.id || active.id === active.role) { setConversationId(null); setMessages([]); return; }
      const { data: conversation } = await (supabase as any).from("agent_office_conversations").select("id").eq("workspace_id", workspace.id).eq("agent_id", active.id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (!conversation?.id) { if (!cancelled) { setConversationId(null); setMessages([]); } return; }
      const { data } = await (supabase as any).from("agent_office_messages").select("id,role,content,created_at,sources").eq("conversation_id", conversation.id).order("created_at", { ascending: true }).limit(50);
      if (!cancelled) { setConversationId(conversation.id); setMessages((data || []) as ChatMessage[]); }
    };
    void loadHistory();
    return () => { cancelled = true; };
  }, [active?.id, active?.role, workspace?.id]);

  const send = async () => {
    const question = input.trim();
    if (!question || sending) return;
    setSending(true); setInput("");
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content: question }]);
    const response = await supabase.functions.invoke("agent-office-chat", { body: {
      agent_role: role, conversation_id: conversationId,
      question, scope: { accountIds: adAccountIds, funnelIds, startDate: businessDateKey(startDate, workspace?.timezone || "America/Sao_Paulo"), endDate: businessDateKey(endDate, workspace?.timezone || "America/Sao_Paulo") },
    } });
    if (response.data?.conversationId) setConversationId(response.data.conversationId);
    if (response.data?.message) setMessages((current) => [...current, response.data.message]);
    else setMessages((current) => [...current, { id: crypto.randomUUID(), role: "system", content: response.error?.message || "Não foi possível responder agora." }]);
    setSending(false);
  };

  return <>
    {!open && <button type="button" onClick={() => setOpen(true)} className="agent-dock-launch" aria-label="Abrir escritório de agentes"><Bot className="h-4 w-4" /><span>Agentes</span></button>}
    {open && <aside className="agent-dock" aria-label="Chat do escritório de agentes">
      <header className="agent-dock-header"><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary"><Bot className="h-4 w-4" /></span><div className="min-w-0 grow"><b>Escritório Growdash</b><small>{active?.name || "Diretores"}</small></div><button type="button" onClick={() => setOpen(false)} aria-label="Fechar chat"><X className="h-4 w-4" /></button></header>
      <div className="agent-dock-tabs" role="tablist" aria-label="Diretores"><div className="agent-dock-tab-scroll">{directors.map((agent) => <button key={agent.role} type="button" role="tab" aria-selected={agent.role === role} onClick={() => setRole(agent.role as DirectorRole)} className={cn(agent.role === role && "is-active")}><span>{agent.name.split(" ")[0]}</span><i className={agent.runtime_status === "error" ? "is-error" : ""} /></button>)}</div></div>
      <div className="agent-dock-context">Período selecionado · {startDate.toLocaleDateString("pt-BR")} a {endDate.toLocaleDateString("pt-BR")}</div>
      <div className="agent-dock-messages growdash-scrollbar" aria-live="polite">{messages.length === 0 && <div className="agent-dock-empty"><MessageCircle className="mx-auto mb-2 h-5 w-5" /><p>Pergunte ao {active?.name || "diretor"} sobre o estado da operação.</p></div>}{messages.map((message) => <div key={message.id} className={cn("agent-dock-message", message.role === "user" ? "is-user" : "is-agent")}>{message.content}{message.sources?.length ? <small>Fonte: {message.sources.map((source) => source.label).join(", ")}</small> : null}</div>)}{sending && <div className="agent-dock-message is-agent animate-pulse">Analisando dados reais da operação…</div>}</div>
      <div className="agent-dock-compose"><button type="button" onClick={() => { setConversationId(null); setMessages([]); }} aria-label="Nova conversa" title="Nova conversa"><ChevronDown className="h-4 w-4" /></button><input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void send(); }} placeholder="Pergunte sobre a operação…" aria-label={`Perguntar ao ${active?.name || "diretor"}`} /><button type="button" onClick={() => void send()} disabled={sending || !input.trim()} aria-label="Enviar pergunta"><Send className="h-4 w-4" /></button></div>
    </aside>}
  </>;
}
