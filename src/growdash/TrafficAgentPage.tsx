import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Computer, ExternalLink, Play, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useToast } from "@/hooks/use-toast";
import { PageHeading } from "@/growdash/shared";

type Proposal = { id: string; entity_name: string | null; entity_type: string; status: string; diagnosis: string; proposed_action: string; expected_impact: string | null; risk: string; evidence: Record<string, unknown>; valid_until: string | null; created_at: string };
type Runtime = { status: string; browser_status: string; computer_name: string | null; last_heartbeat_at: string | null; last_analysis_at: string | null; next_analysis_at: string | null; last_error: string | null };

export default function TrafficAgentPage() {
  const { data: workspace } = useWorkspace();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["traffic-agent", workspace?.id],
    enabled: Boolean(workspace?.id),
    refetchInterval: 30_000,
    queryFn: async () => {
      // The new additive tables are generated into Supabase types after the
      // linked migration is applied.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const [runtime, proposals] = await Promise.all([
        db.from("traffic_agent_runtime").select("status,browser_status,computer_name,last_heartbeat_at,last_analysis_at,next_analysis_at,last_error").eq("workspace_id", workspace!.id).maybeSingle(),
        db.from("traffic_action_proposals").select("id,entity_name,entity_type,status,diagnosis,proposed_action,expected_impact,risk,evidence,valid_until,created_at").eq("workspace_id", workspace!.id).in("status", ["awaiting_approval", "approved", "executing", "executed", "failed"]).order("created_at", { ascending: false }).limit(30),
      ]);
      if (runtime.error) throw runtime.error;
      if (proposals.error) throw proposals.error;
      return { runtime: runtime.data as Runtime | null, proposals: (proposals.data || []) as Proposal[] };
    },
  });

  const runAnalysis = async () => {
    setBusy("analysis");
    const { data, error } = await supabase.functions.invoke("traffic-agent-analyze", { body: { trigger: "manual" } });
    setBusy(null);
    if (error || data?.status === "failed") { toast({ title: "Análise não concluída", description: error?.message || "A coleta não pôde ser concluída.", variant: "destructive" }); return; }
    toast({ title: "Análise concluída", description: `${data?.accounts_analyzed || 0} conta(s) analisada(s) e ${data?.proposals_created || 0} proposta(s) criada(s).` });
    await qc.invalidateQueries({ queryKey: ["traffic-agent", workspace?.id] });
  };

  const decide = async (proposal: Proposal, decision: "approved" | "rejected" | "revision_requested") => {
    setBusy(proposal.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("decide_traffic_action_proposal", { p_proposal_id: proposal.id, p_decision: decision, p_comment: decision === "approved" ? "Aprovado pelo proprietário no Growdash." : undefined });
    setBusy(null);
    if (error) { toast({ title: "Decisão não registrada", description: error.message, variant: "destructive" }); return; }
    toast({ title: decision === "approved" ? "Aprovação registrada" : decision === "rejected" ? "Proposta rejeitada" : "Proposta devolvida", description: decision === "approved" ? "O runner local executará somente esta proposta aprovada." : "Nenhuma alteração foi enviada à Meta." });
    await qc.invalidateQueries({ queryKey: ["traffic-agent", workspace?.id] });
  };

  const runtime = query.data?.runtime;
  const proposals = useMemo(() => query.data?.proposals || [], [query.data?.proposals]);
  const pending = useMemo(() => proposals.filter((item) => item.status === "awaiting_approval"), [proposals]);
  const online = runtime?.status && runtime.status !== "offline" && runtime.last_heartbeat_at && Date.now() - new Date(runtime.last_heartbeat_at).getTime() < 5 * 60_000;

  return <div className="mx-auto max-w-[1500px]">
    <PageHeading eyebrow="Tráfego pago autônomo" title="Gestor de tráfego" description="Opera com playbooks de performance para estética, prioriza vendas do RD e executa apenas ações dentro dos guardrails configurados." actions={<button type="button" className="gd-button" onClick={runAnalysis} disabled={busy === "analysis"}><Play className={busy === "analysis" ? "h-4 w-4 animate-pulse" : "h-4 w-4"} /> Analisar agora</button>} />
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Summary icon={<Computer />} label="Computador local" value={online ? "Online" : "Offline"} note={runtime?.computer_name || "Runner não conectado"} tone={online ? "ok" : "warn"} />
      <Summary icon={<ShieldCheck />} label="Modo operacional" value="Aprovação obrigatória" note="Análise autônoma; execução autorizada por você" tone="ok" />
      <Summary icon={<AlertTriangle />} label="Aguardando você" value={String(pending.length)} note="Proposta(s) pendente(s)" tone={pending.length ? "warn" : "ok"} />
      <Summary icon={<Clock3 />} label="Próxima análise" value={runtime?.next_analysis_at ? new Date(runtime.next_analysis_at).toLocaleString("pt-BR") : "08:00 · 14:00"} note={runtime?.last_analysis_at ? `Última: ${new Date(runtime.last_analysis_at).toLocaleString("pt-BR")}` : "Ainda não executada"} tone="neutral" />
    </div>
    {runtime?.last_error && <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm"><AlertTriangle className="h-4 w-4 text-red-500" />{runtime.last_error}</div>}
    <section className="gd-panel overflow-hidden">
      <header className="flex flex-col gap-2 border-b border-border/60 p-4 sm:flex-row sm:items-center"><div><h2 className="font-black">Solicitações e auditoria</h2><p className="text-xs text-muted-foreground">A fonte comercial é o RD Station; a entrega e o gasto vêm da Meta. O gestor propõe; só sua aprovação libera a execução.</p></div><button type="button" className="gd-button-secondary sm:ml-auto" onClick={() => void qc.invalidateQueries({ queryKey: ["traffic-agent", workspace?.id] })}><RefreshCw className="h-4 w-4" /> Atualizar</button></header>
      {!query.data && query.isLoading ? <div className="p-6 text-sm text-muted-foreground">Carregando propostas…</div> : proposals.length === 0 ? <div className="p-6 text-sm text-muted-foreground">Nenhuma proposta aguardando decisão. Execute uma análise para criar recomendações.</div> : <div className="divide-y divide-border/60">{proposals.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal} busy={busy === proposal.id} onDecide={decide} />)}</div>}
    </section>
    <p className="mt-4 text-xs text-muted-foreground">O runner local mantém o computador visível e o heartbeat. Nenhuma alteração é enviada à Meta antes da sua aprovação registrada; sessão, captcha, rate limit ou divergência Meta/RD também bloqueiam a ação.</p>
  </div>;
}

function ProposalCard({ proposal, busy, onDecide }: { proposal: Proposal; busy: boolean; onDecide: (proposal: Proposal, decision: "approved" | "rejected" | "revision_requested") => Promise<void> }) {
  const evidence = proposal.evidence || {};
  const period = evidence.period as { start?: string; end?: string; timezone?: string } | undefined;
  return <article className="p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-start"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black">{proposal.entity_name || "Conta Meta"}</h3><span className="rounded-full border border-border px-2 py-1 text-[10px] font-bold uppercase">{proposal.status === "awaiting_approval" ? "Aguardando aprovação" : proposal.status}</span><span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-bold uppercase text-amber-600">Risco {proposal.risk}</span></div><p className="mt-2 text-sm">{proposal.diagnosis}</p><p className="mt-2 text-xs text-muted-foreground">{proposal.proposed_action}</p><div className="mt-3 grid gap-2 text-xs sm:grid-cols-4"><Metric label="Investimento" value={money(evidence.spend)} /><Metric label="CPL" value={money(evidence.cpl)} /><Metric label="Mediana CPL" value={money(evidence.median_cpl)} /><Metric label="Vendas RD" value={String(evidence.sales ?? "—")} /></div>{period && <p className="mt-3 text-[11px] text-muted-foreground">Período: {period.start} a {period.end} · {period.timezone}</p>}</div>{proposal.status === "awaiting_approval" && <div className="flex shrink-0 flex-wrap gap-2 lg:w-56 lg:flex-col"><button type="button" className="gd-button" disabled={busy} onClick={() => void onDecide(proposal, "approved")}><CheckCircle2 className="h-4 w-4" /> Aprovar</button><button type="button" className="gd-button-secondary" disabled={busy} onClick={() => void onDecide(proposal, "revision_requested")}><RefreshCw className="h-4 w-4" /> Devolver</button><button type="button" className="rounded-lg border border-red-500/30 px-3 py-2 text-xs font-bold text-red-600" disabled={busy} onClick={() => void onDecide(proposal, "rejected")}><XCircle className="h-4 w-4" /> Rejeitar</button></div>}</div>{proposal.expected_impact && <p className="mt-3 rounded-lg bg-muted/50 p-3 text-xs"><b>Impacto esperado:</b> {proposal.expected_impact}</p>}{proposal.status === "approved" && <p className="mt-3 flex items-center gap-2 text-xs text-amber-600"><ExternalLink className="h-3.5 w-3.5" /> Aprovada. O runner local executará somente esta ação.</p>}{proposal.status === "executed" && <p className="mt-3 flex items-center gap-2 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Executada após aprovação explícita.</p>}</article>;
}

function Summary({ icon, label, value, note, tone }: { icon: React.ReactNode; label: string; value: string; note: string; tone: "ok" | "warn" | "neutral" }) { const color = tone === "ok" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : "text-primary"; return <div className="gd-panel p-4"><div className={`flex items-center gap-2 ${color}`}><span>{icon}</span><span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{label}</span></div><b className="mt-2 block text-sm">{value}</b><small className="mt-1 block text-[11px] text-muted-foreground">{note}</small></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-border/60 bg-muted/20 p-2"><span className="block text-[10px] text-muted-foreground">{label}</span><b>{value}</b></div>; }
function money(value: unknown) { const number = Number(value); return Number.isFinite(number) && number > 0 ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(number) : "—"; }
